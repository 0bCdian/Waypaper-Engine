package playlist

import (
	"context"
	"fmt"
	"log/slog"
	"sync"
	"time"

	"waypaper-engine/daemon/internal/backend"
	"waypaper-engine/daemon/internal/events"
	"waypaper-engine/daemon/internal/image"
	"waypaper-engine/daemon/internal/monitor"
	"waypaper-engine/daemon/internal/store"
)

// playlistRun groups the scheduler and cancel func for a single Start() invocation.
// Multiple monitors may share the same run (e.g. clone/extend mode).
// Identified by pointer identity so stopForMonitor can safely check if other
// monitors still reference the same run before tearing it down.
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

	// runs tracks active playlist runs keyed by monitor name.
	// Monitors that were started together share the same *playlistRun pointer.
	runs map[string]*playlistRun
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
		runs:              make(map[string]*playlistRun),
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

	// Stop any existing playlist on target monitors.
	for _, mon := range monitors {
		if existing := m.stateStore.GetActivePlaylistByMonitor(mon.Name); existing != nil {
			m.stopForMonitor(mon.Name)
		}
	}

	// Build time slots for time_of_day playlists.
	var timeSlots []TimeSlot
	if pl.Configuration.Type == "time_of_day" {
		for i, pimg := range pl.Images {
			if pimg.Time != nil {
				timeSlots = append(timeSlots, TimeSlot{
					Minutes:    *pimg.Time,
					ImageIndex: i,
				})
			}
		}
	}

	// Determine start index based on playlist type and AlwaysStartOnFirstImage.
	startIdx := 0
	if !pl.Configuration.AlwaysStartOnFirstImage {
		switch pl.Configuration.Type {
		case "time_of_day":
			startIdx = findClosestTimeSlot(timeSlots)
		case "day_of_week":
			weekday := int(time.Now().Weekday())
			if weekday >= len(pl.Images) {
				startIdx = len(pl.Images) - 1
			} else {
				startIdx = weekday
			}
		}
	}

	// Create scheduler.
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

	// Create a shared run for all target monitors in this Start() call.
	run := &playlistRun{sched: sched, cancel: playCancel}

	// Register the run for each target monitor.
	for _, mon := range monitors {
		m.mu.Lock()
		m.runs[mon.Name] = run
		m.mu.Unlock()

		// Start missed event checker for time-based playlists.
		if pl.Configuration.Type == "time_of_day" || pl.Configuration.Type == "day_of_week" {
			go m.missedEventChecker(playCtx, mon.Name, pl, monitors, target)
		}
	}

	// Apply first image (still use the original ctx since the HTTP request is alive).
	if err := m.applyImage(ctx, pl, startIdx, monitors, target.Mode); err != nil {
		slog.Warn("playlist: failed to apply first image", "error", err)
	}
	// Start scheduler with detached context so ticks survive after HTTP response.
	sched.Start(func(index int) {
		m.onTick(playCtx, pl, index, monitors, target)
	})

	// Update state AFTER sched.Start() so NextChangeAt is populated.
	for _, mon := range monitors {
		firstImageID := pl.Images[startIdx].ImageID
		var nextImageID *int
		if len(pl.Images) > 1 {
			nid := pl.Images[(startIdx+1)%len(pl.Images)].ImageID
			nextImageID = &nid
		}

		instance := store.ActivePlaylistInstance{
			PlaylistID:     pl.ID,
			PlaylistName:   pl.Name,
			CurrentIndex:   startIdx,
			CurrentImageID: firstImageID,
			NextImageID:    nextImageID,
			TotalImages:    len(pl.Images),
			Paused:         false,
			Mode:           string(target.Mode),
			StartedAt:      time.Now(),
			NextChangeAt:   sched.NextChangeAt(),
		}
		m.stateStore.SetActivePlaylist(mon.Name, instance)
	}

	m.bus.Publish(events.Event{
		Type: events.PlaylistStarted,
		Data: map[string]any{
			"playlist_id":   pl.ID,
			"playlist_name": pl.Name,
			"monitors":      monitorNames(monitors),
			"mode":          target.Mode,
		},
	})

	slog.Info("playlist started", "id", pl.ID, "name", pl.Name, "monitors", monitorNames(monitors))
	return nil
}

// Stop stops a playlist by its ID.
func (m *Manager) Stop(ctx context.Context, playlistID int) error {
	// Find all monitors running this playlist.
	active := m.stateStore.GetActivePlaylists()
	found := false
	for monName, inst := range active {
		if inst.PlaylistID == playlistID {
			m.stopForMonitor(monName)
			found = true
		}
	}

	if !found {
		return fmt.Errorf("playlist manager: playlist %d is not running", playlistID)
	}

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
	active := m.stateStore.GetActivePlaylists()
	found := false
	for monName, inst := range active {
		if inst.PlaylistID == playlistID {
			m.mu.RLock()
			if run, ok := m.runs[monName]; ok {
				run.sched.Pause()
			}
			m.mu.RUnlock()

			inst.Paused = true
			inst.NextChangeAt = nil
			m.stateStore.SetActivePlaylist(monName, inst)
			found = true
		}
	}

	if !found {
		return fmt.Errorf("playlist manager: playlist %d is not running", playlistID)
	}

	m.bus.Publish(events.Event{
		Type: events.PlaylistPaused,
		Data: map[string]any{"playlist_id": playlistID},
	})
	return nil
}

// Resume resumes a paused playlist.
func (m *Manager) Resume(ctx context.Context, playlistID int) error {
	active := m.stateStore.GetActivePlaylists()
	found := false
	for monName, inst := range active {
		if inst.PlaylistID == playlistID {
			m.mu.RLock()
			if run, ok := m.runs[monName]; ok {
				run.sched.Resume()
				inst.NextChangeAt = run.sched.NextChangeAt()
			}
			m.mu.RUnlock()

			inst.Paused = false
			m.stateStore.SetActivePlaylist(monName, inst)
			found = true
		}
	}

	if !found {
		return fmt.Errorf("playlist manager: playlist %d is not running", playlistID)
	}

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
	for monName := range active {
		m.stopForMonitor(monName)
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
	for monName, inst := range active {
		if inst.Paused {
			continue
		}
		m.mu.RLock()
		if run, ok := m.runs[monName]; ok {
			run.sched.Pause()
		}
		m.mu.RUnlock()

		inst.Paused = true
		inst.NextChangeAt = nil
		m.stateStore.SetActivePlaylist(monName, inst)
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
	for monName, inst := range active {
		if !inst.Paused {
			continue
		}
		m.mu.RLock()
		if run, ok := m.runs[monName]; ok {
			run.sched.Resume()
			inst.NextChangeAt = run.sched.NextChangeAt()
		}
		m.mu.RUnlock()

		inst.Paused = false
		m.stateStore.SetActivePlaylist(monName, inst)
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
	// Collect unique playlist IDs to avoid advancing the same playlist twice.
	seen := make(map[int]bool)
	for _, inst := range active {
		if seen[inst.PlaylistID] {
			continue
		}
		seen[inst.PlaylistID] = true
		if err := m.Next(ctx, inst.PlaylistID); err != nil {
			slog.Warn("next_all: failed to advance playlist", "playlist_id", inst.PlaylistID, "error", err)
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
	seen := make(map[int]bool)
	for _, inst := range active {
		if seen[inst.PlaylistID] {
			continue
		}
		seen[inst.PlaylistID] = true
		if err := m.Previous(ctx, inst.PlaylistID); err != nil {
			slog.Warn("previous_all: failed to reverse playlist", "playlist_id", inst.PlaylistID, "error", err)
			continue
		}
		count++
	}
	return count
}

// advancePlaylist moves the playlist index by delta (+1 or -1).
func (m *Manager) advancePlaylist(ctx context.Context, playlistID int, delta int) error {
	active := m.stateStore.GetActivePlaylists()
	for monName, inst := range active {
		if inst.PlaylistID != playlistID {
			continue
		}

		pl, err := m.playlistStore.GetByID(ctx, playlistID)
		if err != nil {
			return err
		}

		newIdx := (inst.CurrentIndex + delta + len(pl.Images)) % len(pl.Images)

		monitors, err := m.monitorManager.GetMonitors(ctx)
		if err != nil {
			return err
		}

		var targetMonitors []monitor.Monitor
		for _, mon := range monitors {
			if mon.Name == monName {
				targetMonitors = append(targetMonitors, mon)
				break
			}
		}

		mode := monitor.MonitorMode(inst.Mode)
		if err := m.applyImage(ctx, pl, newIdx, targetMonitors, mode); err != nil {
			return err
		}

		// Update state.
		inst.CurrentIndex = newIdx
		inst.CurrentImageID = pl.Images[newIdx].ImageID
		if len(pl.Images) > 1 {
			nid := pl.Images[(newIdx+1)%len(pl.Images)].ImageID
			inst.NextImageID = &nid
			if newIdx > 0 {
				pid := pl.Images[newIdx-1].ImageID
				inst.PreviousImageID = &pid
			}
		}
		m.stateStore.SetActivePlaylist(monName, inst)

		m.bus.Publish(events.Event{
			Type: events.PlaylistImageChanged,
			Data: map[string]any{
				"playlist_id": playlistID,
				"image_index": newIdx,
				"image_id":    pl.Images[newIdx].ImageID,
				"monitor":     monName,
			},
		})
		return nil
	}

	return fmt.Errorf("playlist manager: playlist %d is not running", playlistID)
}

// stopForMonitor stops the scheduler and cleans up state for a single monitor.
// If other monitors share the same run (e.g. clone/extend), the scheduler is
// only stopped when the last monitor referencing it is removed.
func (m *Manager) stopForMonitor(monName string) {
	m.mu.Lock()
	run, ok := m.runs[monName]
	if ok {
		delete(m.runs, monName)

		// Check if any other monitor still references this run.
		shared := false
		for _, r := range m.runs {
			if r == run {
				shared = true
				break
			}
		}

		// Only tear down the scheduler/context when no monitors remain.
		if !shared {
			run.sched.Stop()
			run.cancel()
		}
	}
	m.mu.Unlock()

	m.stateStore.RemoveActivePlaylist(monName)
}

// onTick is called by the scheduler when it's time to change the wallpaper.
func (m *Manager) onTick(ctx context.Context, pl *store.Playlist, index int, monitors []monitor.Monitor, target monitor.MonitorTarget) {
	if err := m.applyImage(ctx, pl, index, monitors, target.Mode); err != nil {
		slog.Warn("playlist tick: failed to apply image", "playlist_id", pl.ID, "index", index, "error", err)
		return
	}

	// Update state for each monitor.
	for _, mon := range monitors {
		inst := m.stateStore.GetActivePlaylistByMonitor(mon.Name)
		if inst == nil {
			continue
		}

		inst.CurrentIndex = index
		inst.CurrentImageID = pl.Images[index].ImageID
		if len(pl.Images) > 1 {
			nid := pl.Images[(index+1)%len(pl.Images)].ImageID
			inst.NextImageID = &nid
		}
		m.mu.RLock()
		if run, ok := m.runs[mon.Name]; ok {
			inst.NextChangeAt = run.sched.NextChangeAt()
		}
		m.mu.RUnlock()

		m.stateStore.SetActivePlaylist(mon.Name, *inst)
	}

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

	activeBackend := m.registry.Active()
	caps := activeBackend.Capabilities()

	// Handle extend mode: split image if backend doesn't support native extend.
	if mode == monitor.ModeExtend && !caps.NativeExtend && m.splitter != nil && len(monitors) > 1 {
		splitPaths, err := m.splitter.Split(img.Path, img.ID, monitors)
		if err != nil {
			return fmt.Errorf("split image: %w", err)
		}

		for _, mon := range monitors {
			if splitPath, ok := splitPaths[mon.Name]; ok {
				req := backend.WallpaperRequest{
					ImagePath: splitPath,
					Monitors:  []monitor.Monitor{mon},
					Mode:      monitor.ModeIndividual,
				}
				if err := activeBackend.SetWallpaper(ctx, req); err != nil {
					return fmt.Errorf("set wallpaper for %s: %w", mon.Name, err)
				}
			}
		}
	} else {
		req := backend.WallpaperRequest{
			ImagePath: img.Path,
			Monitors:  monitors,
			Mode:      mode,
		}
		if err := activeBackend.SetWallpaper(ctx, req); err != nil {
			return fmt.Errorf("set wallpaper: %w", err)
		}
	}

	// Record history.
	entry := store.ImageHistoryEntry{
		ImageID:   img.ID,
		ImageName: img.Name,
		Monitors:  monitorNames(monitors),
		Mode:      string(mode),
		SetAt:     time.Now(),
		Source: store.HistorySource{
			Type:         "playlist",
			PlaylistID:   &pl.ID,
			PlaylistName: pl.Name,
		},
		Backend: activeBackend.Name(),
	}
	_, _ = m.historyStore.Append(ctx, entry)

	// Update current wallpaper state (in-memory + persisted).
	for _, mon := range monitors {
		m.stateStore.SetCurrentWallpaper(mon.Name, entry)

		// Persist to CloverDB for restore on restart.
		if err := m.monitorStateStore.Set(ctx, store.MonitorState{
			MonitorName: mon.Name,
			ImageID:     img.ID,
			ImageName:   img.Name,
			ImagePath:   img.Path,
			Mode:        string(mode),
			Backend:     activeBackend.Name(),
			SetAt:       entry.SetAt,
		}); err != nil {
			slog.Warn("failed to persist monitor state", "monitor", mon.Name, "error", err)
		}
	}

	return nil
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
func (m *Manager) missedEventChecker(ctx context.Context, monName string, pl *store.Playlist, monitors []monitor.Monitor, target monitor.MonitorTarget) {
	ticker := time.NewTicker(10 * time.Second)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			inst := m.stateStore.GetActivePlaylistByMonitor(monName)
			if inst == nil {
				// Playlist was stopped.
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
					"monitor", monName,
					"expected_time", inst.NextChangeAt,
					"current_time", now,
					"playlist_id", pl.ID,
					"playlist_type", pl.Configuration.Type,
				)

				// Compute the correct image index for the current time.
				var newIdx int
				switch pl.Configuration.Type {
				case "time_of_day":
					var slots []TimeSlot
					for i, pimg := range pl.Images {
						if pimg.Time != nil {
							slots = append(slots, TimeSlot{Minutes: *pimg.Time, ImageIndex: i})
						}
					}
					newIdx = findClosestTimeSlot(slots)
				case "day_of_week":
					weekday := int(now.Weekday())
					newIdx = min(weekday, len(pl.Images)-1)
				}

				// Apply the correct image.
				if err := m.applyImage(ctx, pl, newIdx, monitors, target.Mode); err != nil {
					slog.Warn("missed event: failed to apply image", "error", err)
					continue
				}

				// Update state.
				inst.CurrentIndex = newIdx
				inst.CurrentImageID = pl.Images[newIdx].ImageID
				if len(pl.Images) > 1 {
					nid := pl.Images[(newIdx+1)%len(pl.Images)].ImageID
					inst.NextImageID = &nid
				}
				m.mu.RLock()
				if run, ok := m.runs[monName]; ok {
					inst.NextChangeAt = run.sched.NextChangeAt()
				}
				m.mu.RUnlock()
				m.stateStore.SetActivePlaylist(monName, *inst)

				m.bus.Publish(events.Event{
					Type: events.PlaylistImageChanged,
					Data: map[string]any{
						"playlist_id": pl.ID,
						"image_index": newIdx,
						"image_id":    pl.Images[newIdx].ImageID,
						"monitor":     monName,
						"source":      "missed_event_recovery",
					},
				})
			}
		}
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
