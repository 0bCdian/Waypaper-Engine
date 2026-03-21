package playlist

import (
	"context"
	"fmt"
	"log/slog"
	"strings"
	"sync"
	"time"

	"waypaper-engine/daemon/internal/backend"
	"waypaper-engine/daemon/internal/events"
	"waypaper-engine/daemon/internal/image"
	"waypaper-engine/daemon/internal/media"
	"waypaper-engine/daemon/internal/monitor"
	"waypaper-engine/daemon/internal/store"
	"waypaper-engine/daemon/internal/wallpaper"
)

// playlistRun groups the scheduler and cancel func for a single Start() invocation.
type playlistRun struct {
	sched  Scheduler
	cancel context.CancelFunc
}

// Manager handles playlist lifecycle: start, stop, pause, resume, next, previous.
type Manager struct {
	mu                sync.RWMutex
	playlistStore     store.PlaylistStore
	stateStore        store.StateStore
	historyStore      store.HistoryStore
	monitorStateStore store.MonitorStateStore
	registry          backend.Registry
	monitorManager    monitor.MonitorManager
	bus               events.Bus
	splitter          *image.Splitter
	imageStore        store.ImageStore

	// runs tracks active playlist runs keyed by playlist ID.
	runs map[int]*playlistRun
}

// NewManager creates a new playlist manager with all required dependencies.
func NewManager(
	playlistStore store.PlaylistStore,
	stateStore store.StateStore,
	historyStore store.HistoryStore,
	imageStore store.ImageStore,
	monitorStateStore store.MonitorStateStore,
	registry backend.Registry,
	monitorManager monitor.MonitorManager,
	bus events.Bus,
	splitter *image.Splitter,
) *Manager {
	return &Manager{
		playlistStore:     playlistStore,
		stateStore:        stateStore,
		historyStore:      historyStore,
		imageStore:        imageStore,
		monitorStateStore: monitorStateStore,
		registry:          registry,
		monitorManager:    monitorManager,
		bus:               bus,
		splitter:          splitter,
		runs:              make(map[int]*playlistRun),
	}
}

// Start begins a playlist on the specified target monitor(s).
func (m *Manager) Start(ctx context.Context, playlistID int, target monitor.MonitorTarget) error {
	pl, err := m.playlistStore.GetByID(ctx, playlistID)
	if err != nil {
		return fmt.Errorf("playlist manager: load playlist: %w", err)
	}

	if len(pl.Images) == 0 {
		return fmt.Errorf("playlist manager: playlist %d has no images", playlistID)
	}

	// Resolve monitors.
	monitors, err := m.resolveMonitors(ctx, target)
	if err != nil {
		return err
	}
	if len(monitors) == 0 {
		return fmt.Errorf("playlist manager: no monitors resolved for target %q", target.ID)
	}

	// Stop any existing playlist that owns any of the target monitors.
	targetNames := monitorNameSet(monitors)
	for _, inst := range m.stateStore.GetActivePlaylists() {
		if monitorsOverlap(inst.Monitors, targetNames) {
			m.stopPlaylist(inst.PlaylistID)
		}
	}

	timeSlots, startIdx := computeInitialState(pl)

	sched := NewScheduler(SchedulerConfig{
		Type:        pl.Configuration.Type,
		Interval:    pl.Configuration.Interval,
		Order:       pl.Configuration.Order,
		TotalImages: len(pl.Images),
		StartIndex:  startIdx,
		TimeSlots:   timeSlots,
	})

	// Use a detached context for playlist lifecycle — the HTTP request context
	// (ctx) is cancelled as soon as the response is written, but the playlist
	// must keep running independently.
	playCtx, playCancel := context.WithCancel(context.Background())

	run := &playlistRun{sched: sched, cancel: playCancel}

	m.mu.Lock()
	m.runs[pl.ID] = run
	m.mu.Unlock()

	// Start missed event checker for time-based playlists (one per playlist).
	if pl.Configuration.Type == "time_of_day" || pl.Configuration.Type == "day_of_week" {
		go m.missedEventChecker(playCtx, pl, monitors, target)
	}

	// Apply first image (still use the original ctx since the HTTP request is alive).
	if err := m.applyImage(ctx, pl, startIdx, monitors, target.Mode); err != nil {
		slog.Warn("playlist: failed to apply first image", "error", err)
	}
	// Start scheduler with detached context so ticks survive after HTTP response.
	sched.Start(func(index int) {
		m.onTick(playCtx, pl, index, monitors, target)
	})

	monNames := monitorNames(monitors)
	instance := store.ActivePlaylistInstance{
		ActivePlaylistState: store.ActivePlaylistState{
			PlaylistID:   pl.ID,
			PlaylistName: pl.Name,
			TotalImages:  len(pl.Images),
			Paused:       false,
			StartedAt:    time.Now(),
			NextChangeAt: sched.NextChangeAt(),
		},
		Mode:     string(target.Mode),
		Monitors: monNames,
	}
	updateInstanceIndex(&instance, pl, startIdx)
	m.stateStore.SetActivePlaylist(instance)

	m.bus.Publish(events.Event{
		Type: events.PlaylistStarted,
		Data: map[string]any{
			"playlist_id":   pl.ID,
			"playlist_name": pl.Name,
			"monitors":      monNames,
			"mode":          target.Mode,
		},
	})

	slog.Info("playlist started", "id", pl.ID, "name", pl.Name, "monitors", monNames)
	return nil
}

// Stop stops a playlist by its ID.
func (m *Manager) Stop(ctx context.Context, playlistID int) error {
	inst := m.stateStore.GetActivePlaylistByID(playlistID)
	if inst == nil {
		return fmt.Errorf("playlist manager: playlist %d is not running", playlistID)
	}

	m.stopPlaylist(playlistID)

	m.bus.Publish(events.Event{
		Type: events.PlaylistStopped,
		Data: map[string]any{
			"playlist_id": playlistID,
		},
	})

	slog.Info("playlist stopped", "id", playlistID)
	return nil
}

// Pause pauses a running playlist.
func (m *Manager) Pause(ctx context.Context, playlistID int) error {
	m.mu.RLock()
	run, ok := m.runs[playlistID]
	m.mu.RUnlock()
	if !ok {
		return fmt.Errorf("playlist manager: playlist %d is not running", playlistID)
	}

	run.sched.Pause()

	m.stateStore.UpdateActivePlaylist(playlistID, func(inst *store.ActivePlaylistInstance) {
		inst.Paused = true
		inst.NextChangeAt = nil
	})

	m.bus.Publish(events.Event{
		Type: events.PlaylistPaused,
		Data: map[string]any{"playlist_id": playlistID},
	})
	return nil
}

// Resume resumes a paused playlist.
func (m *Manager) Resume(ctx context.Context, playlistID int) error {
	m.mu.RLock()
	run, ok := m.runs[playlistID]
	m.mu.RUnlock()
	if !ok {
		return fmt.Errorf("playlist manager: playlist %d is not running", playlistID)
	}

	run.sched.Resume()
	nextChange := run.sched.NextChangeAt()

	m.stateStore.UpdateActivePlaylist(playlistID, func(inst *store.ActivePlaylistInstance) {
		inst.Paused = false
		inst.NextChangeAt = nextChange
	})

	m.bus.Publish(events.Event{
		Type: events.PlaylistResumed,
		Data: map[string]any{"playlist_id": playlistID},
	})
	return nil
}

// Next advances to the next image in the playlist.
func (m *Manager) Next(ctx context.Context, playlistID int) error {
	return m.advancePlaylist(ctx, playlistID, 1)
}

// Previous goes back to the previous image in the playlist.
func (m *Manager) Previous(ctx context.Context, playlistID int) error {
	return m.advancePlaylist(ctx, playlistID, -1)
}

// StopAll stops all running playlists and returns the count of stopped instances.
func (m *Manager) StopAll() int {
	active := m.stateStore.GetActivePlaylists()
	count := 0
	for playlistID := range active {
		m.stopPlaylist(playlistID)
		count++
	}
	if count > 0 {
		m.bus.Publish(events.Event{
			Type: events.PlaylistStopped,
			Data: map[string]any{"action": "stop_all", "stopped": count},
		})
	}
	return count
}

// PauseAll pauses all running playlists and returns the count of paused instances.
func (m *Manager) PauseAll(ctx context.Context) int {
	active := m.stateStore.GetActivePlaylists()
	count := 0
	for playlistID, inst := range active {
		if inst.Paused {
			continue
		}
		m.mu.RLock()
		if run, ok := m.runs[playlistID]; ok {
			run.sched.Pause()
		}
		m.mu.RUnlock()

		m.stateStore.UpdateActivePlaylist(playlistID, func(inst *store.ActivePlaylistInstance) {
			inst.Paused = true
			inst.NextChangeAt = nil
		})
		count++
	}
	if count > 0 {
		m.bus.Publish(events.Event{
			Type: events.PlaylistPaused,
			Data: map[string]any{"action": "pause_all", "paused": count},
		})
	}
	return count
}

// ResumeAll resumes all paused playlists and returns the count of resumed instances.
func (m *Manager) ResumeAll(ctx context.Context) int {
	active := m.stateStore.GetActivePlaylists()
	count := 0
	for playlistID, inst := range active {
		if !inst.Paused {
			continue
		}
		m.mu.RLock()
		run, ok := m.runs[playlistID]
		m.mu.RUnlock()
		if !ok {
			continue
		}

		run.sched.Resume()
		nextChange := run.sched.NextChangeAt()

		m.stateStore.UpdateActivePlaylist(playlistID, func(inst *store.ActivePlaylistInstance) {
			inst.Paused = false
			inst.NextChangeAt = nextChange
		})
		count++
	}
	if count > 0 {
		m.bus.Publish(events.Event{
			Type: events.PlaylistResumed,
			Data: map[string]any{"action": "resume_all", "resumed": count},
		})
	}
	return count
}

// NextAll advances all running playlists and returns the count of advanced instances.
func (m *Manager) NextAll(ctx context.Context) int {
	active := m.stateStore.GetActivePlaylists()
	count := 0
	for playlistID := range active {
		if err := m.Next(ctx, playlistID); err != nil {
			slog.Warn("next_all: failed to advance playlist", "playlist_id", playlistID, "error", err)
			continue
		}
		count++
	}
	return count
}

// PreviousAll reverses all running playlists and returns the count of reversed instances.
func (m *Manager) PreviousAll(ctx context.Context) int {
	active := m.stateStore.GetActivePlaylists()
	count := 0
	for playlistID := range active {
		if err := m.Previous(ctx, playlistID); err != nil {
			slog.Warn("previous_all: failed to reverse playlist", "playlist_id", playlistID, "error", err)
			continue
		}
		count++
	}
	return count
}

// advancePlaylist moves the playlist index by delta (+1 or -1).
func (m *Manager) advancePlaylist(ctx context.Context, playlistID int, delta int) error {
	inst := m.stateStore.GetActivePlaylistByID(playlistID)
	if inst == nil {
		return fmt.Errorf("playlist manager: playlist %d is not running", playlistID)
	}

	mode := monitor.MonitorMode(inst.Mode)

	pl, err := m.playlistStore.GetByID(ctx, playlistID)
	if err != nil {
		return err
	}

	newIdx := (inst.CurrentIndex + delta + len(pl.Images)) % len(pl.Images)

	allMonitors, err := m.monitorManager.GetMonitors(ctx)
	if err != nil {
		return err
	}

	monSet := monitorNameSet2(inst.Monitors)
	var targetMonitors []monitor.Monitor
	for _, mon := range allMonitors {
		if _, ok := monSet[mon.Name]; ok {
			targetMonitors = append(targetMonitors, mon)
		}
	}

	if err := m.applyImage(ctx, pl, newIdx, targetMonitors, mode); err != nil {
		return err
	}

	m.stateStore.UpdateActivePlaylist(playlistID, func(inst *store.ActivePlaylistInstance) {
		updateInstanceIndex(inst, pl, newIdx)
		if newIdx > 0 && len(pl.Images) > 1 {
			pid := pl.Images[newIdx-1].ImageID
			inst.PreviousImageID = &pid
		}
	})

	m.bus.Publish(events.Event{
		Type: events.PlaylistImageChanged,
		Data: map[string]any{
			"playlist_id": playlistID,
			"image_index": newIdx,
			"image_id":    pl.Images[newIdx].ImageID,
			"monitors":    inst.Monitors,
		},
	})
	return nil
}

// stopPlaylist tears down the scheduler and removes state for a playlist.
func (m *Manager) stopPlaylist(playlistID int) {
	m.mu.Lock()
	if run, ok := m.runs[playlistID]; ok {
		run.sched.Stop()
		run.cancel()
		delete(m.runs, playlistID)
	}
	m.mu.Unlock()

	m.stateStore.RemoveActivePlaylist(playlistID)
}

// onTick is called by the scheduler when it's time to change the wallpaper.
func (m *Manager) onTick(ctx context.Context, pl *store.Playlist, index int, monitors []monitor.Monitor, target monitor.MonitorTarget) {
	if err := m.applyImage(ctx, pl, index, monitors, target.Mode); err != nil {
		slog.Warn("playlist tick: failed to apply image", "playlist_id", pl.ID, "index", index, "error", err)
		return
	}

	m.mu.RLock()
	var nextChange *time.Time
	if run, ok := m.runs[pl.ID]; ok {
		nextChange = run.sched.NextChangeAt()
	}
	m.mu.RUnlock()

	m.stateStore.UpdateActivePlaylist(pl.ID, func(inst *store.ActivePlaylistInstance) {
		updateInstanceIndex(inst, pl, index)
		inst.NextChangeAt = nextChange
	})

	m.bus.Publish(events.Event{
		Type: events.PlaylistImageChanged,
		Data: map[string]any{
			"playlist_id": pl.ID,
			"image_index": index,
			"image_id":    pl.Images[index].ImageID,
			"monitors":    monitorNames(monitors),
		},
	})
}

// applyImage sets a wallpaper from a playlist on the target monitors.
func (m *Manager) applyImage(ctx context.Context, pl *store.Playlist, index int, monitors []monitor.Monitor, mode monitor.MonitorMode) error {
	if index >= len(pl.Images) {
		return fmt.Errorf("image index %d out of range (total: %d)", index, len(pl.Images))
	}

	imgRef := pl.Images[index]
	img, err := m.imageStore.GetByID(ctx, imgRef.ImageID)
	if err != nil {
		return fmt.Errorf("load image %d: %w", imgRef.ImageID, err)
	}
	if imgRef.MediaType == "" {
		imgRef.MediaType = strings.ToLower(strings.TrimSpace(img.MediaType))
	}

	activeBackend := m.registry.Active()
	if !backendSupportsMedia(activeBackend.Capabilities(), img.MediaType) {
		slog.Warn("playlist: skipping media unsupported by backend",
			"playlist_id", pl.ID,
			"image_id", img.ID,
			"media_type", img.MediaType,
			"backend", activeBackend.Name(),
		)
		return nil
	}

	return wallpaper.Apply(ctx, wallpaper.ApplyOpts{
		Image:    img,
		Monitors: monitors,
		Mode:     mode,
		Source: store.HistorySource{
			Type:         "playlist",
			PlaylistID:   &pl.ID,
			PlaylistName: pl.Name,
		},
		Backend:  activeBackend,
		Splitter: m.splitter,
		History:  m.historyStore,
		MonState: m.monitorStateStore,
		State:    m.stateStore,
	})
}

func backendSupportsMedia(caps backend.Capabilities, mediaType string) bool {
	target := strings.ToLower(strings.TrimSpace(mediaType))
	if target == "" {
		target = string(media.MediaTypeImage)
	}
	for _, mt := range caps.MediaTypes {
		if strings.ToLower(string(mt)) == target {
			return true
		}
	}
	return false
}

// resolveMonitors resolves the target specification to concrete monitors.
func (m *Manager) resolveMonitors(ctx context.Context, target monitor.MonitorTarget) ([]monitor.Monitor, error) {
	if target.ID == "*" {
		monitors, err := m.monitorManager.GetMonitors(ctx)
		if err != nil {
			return nil, fmt.Errorf("playlist manager: get monitors: %w", err)
		}
		return monitors, nil
	}

	mon, err := m.monitorManager.GetMonitorByName(ctx, target.ID)
	if err != nil {
		return nil, fmt.Errorf("playlist manager: get monitor %s: %w", target.ID, err)
	}
	return []monitor.Monitor{mon}, nil
}

// missedEventChecker polls every 10 seconds to detect missed scheduler events
// (e.g. after system sleep/wake). If the expected next change time has passed
// by more than 30 seconds, it re-triggers the scheduler by computing the
// correct current image and applying it.
func (m *Manager) missedEventChecker(ctx context.Context, pl *store.Playlist, monitors []monitor.Monitor, target monitor.MonitorTarget) {
	ticker := time.NewTicker(10 * time.Second)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			inst := m.stateStore.GetActivePlaylistByID(pl.ID)
			if inst == nil {
				return
			}
			if inst.Paused {
				continue
			}
			if inst.NextChangeAt == nil {
				continue
			}

			now := time.Now()
			if now.After(inst.NextChangeAt.Add(30 * time.Second)) {
				slog.Warn("missed event detected, re-triggering scheduler",
					"monitors", inst.Monitors,
					"expected_time", inst.NextChangeAt,
					"current_time", now,
					"playlist_id", pl.ID,
					"playlist_type", pl.Configuration.Type,
				)

				var newIdx int
				switch pl.Configuration.Type {
				case "time_of_day":
					newIdx = findClosestTimeSlot(buildTimeSlots(pl))
				case "day_of_week":
					weekday := int(now.Weekday())
					newIdx = min(weekday, len(pl.Images)-1)
				}

				if err := m.applyImage(ctx, pl, newIdx, monitors, target.Mode); err != nil {
					slog.Warn("missed event: failed to apply image", "error", err)
					continue
				}

				m.mu.RLock()
				var nextChange *time.Time
				if run, ok := m.runs[pl.ID]; ok {
					nextChange = run.sched.NextChangeAt()
				}
				m.mu.RUnlock()

				m.stateStore.UpdateActivePlaylist(pl.ID, func(inst *store.ActivePlaylistInstance) {
					updateInstanceIndex(inst, pl, newIdx)
					inst.NextChangeAt = nextChange
				})

				m.bus.Publish(events.Event{
					Type: events.PlaylistImageChanged,
					Data: map[string]any{
						"playlist_id": pl.ID,
						"image_index": newIdx,
						"image_id":    pl.Images[newIdx].ImageID,
						"monitors":    inst.Monitors,
						"source":      "missed_event_recovery",
					},
				})
			}
		}
	}
}

// computeInitialState returns the time slots and starting image index for a
// playlist, respecting AlwaysStartOnFirstImage and playlist type.
func computeInitialState(pl *store.Playlist) ([]TimeSlot, int) {
	var timeSlots []TimeSlot
	if pl.Configuration.Type == "time_of_day" {
		timeSlots = buildTimeSlots(pl)
	}

	if pl.Configuration.AlwaysStartOnFirstImage {
		return timeSlots, 0
	}

	switch pl.Configuration.Type {
	case "time_of_day":
		return timeSlots, findClosestTimeSlot(timeSlots)
	case "day_of_week":
		weekday := int(time.Now().Weekday())
		if weekday >= len(pl.Images) {
			return timeSlots, len(pl.Images) - 1
		}
		return timeSlots, weekday
	default:
		return timeSlots, 0
	}
}

// buildTimeSlots extracts TimeSlot entries from the playlist's images.
func buildTimeSlots(pl *store.Playlist) []TimeSlot {
	var slots []TimeSlot
	for i, pimg := range pl.Images {
		if pimg.Time != nil {
			slots = append(slots, TimeSlot{Minutes: *pimg.Time, ImageIndex: i})
		}
	}
	return slots
}

// updateInstanceIndex updates the navigation fields (CurrentIndex,
// CurrentImageID, NextImageID) on an ActivePlaylistInstance.
func updateInstanceIndex(inst *store.ActivePlaylistInstance, pl *store.Playlist, newIdx int) {
	inst.CurrentIndex = newIdx
	inst.CurrentImageID = pl.Images[newIdx].ImageID
	if len(pl.Images) > 1 {
		nid := pl.Images[(newIdx+1)%len(pl.Images)].ImageID
		inst.NextImageID = &nid
	}
}

// monitorNames extracts names from a list of monitors.
func monitorNames(monitors []monitor.Monitor) []string {
	names := make([]string, len(monitors))
	for i, mon := range monitors {
		names[i] = mon.Name
	}
	return names
}

// monitorNameSet builds a set from monitor objects for O(1) membership checks.
func monitorNameSet(monitors []monitor.Monitor) map[string]struct{} {
	s := make(map[string]struct{}, len(monitors))
	for _, mon := range monitors {
		s[mon.Name] = struct{}{}
	}
	return s
}

// monitorNameSet2 builds a set from a string slice.
func monitorNameSet2(names []string) map[string]struct{} {
	s := make(map[string]struct{}, len(names))
	for _, n := range names {
		s[n] = struct{}{}
	}
	return s
}

// monitorsOverlap returns true if any monitor name in the instance's list
// is present in the target set.
func monitorsOverlap(instMonitors []string, targetSet map[string]struct{}) bool {
	for _, name := range instMonitors {
		if _, ok := targetSet[name]; ok {
			return true
		}
	}
	return false
}

// findClosestTimeSlot returns the image index for the time slot closest to
// (but not after) the current time. Uses binary search. Returns 0 if no
// slots or all slots are in the future (wraps to last slot).
func findClosestTimeSlot(slots []TimeSlot) int {
	if len(slots) == 0 {
		return 0
	}

	now := time.Now()
	currentMinutes := now.Hour()*60 + now.Minute()

	// Binary search for the latest slot that is <= currentMinutes.
	low, high := 0, len(slots)-1
	closestIdx := -1

	for low <= high {
		mid := (low + high) / 2
		if slots[mid].Minutes <= currentMinutes {
			closestIdx = mid
			low = mid + 1
		} else {
			high = mid - 1
		}
	}

	// If no slot before current time, wrap to last slot (yesterday's last slot).
	if closestIdx == -1 {
		closestIdx = len(slots) - 1
	}

	return slots[closestIdx].ImageIndex
}
