package playlist

import (
	"context"
	"fmt"
	"log/slog"
	"sort"
	"strings"
	"sync"
	"time"

	"waypaper-engine/daemon/internal/backend"
	"waypaper-engine/daemon/internal/config"
	"waypaper-engine/daemon/internal/events"
	"waypaper-engine/daemon/internal/image"
	"waypaper-engine/daemon/internal/monitor"
	"waypaper-engine/daemon/internal/store"
	"waypaper-engine/daemon/internal/wallpaper"
)

// playlistRun groups the scheduler and cancel func for a single Start() invocation.
type playlistRun struct {
	sched      Scheduler
	cancel     context.CancelFunc
	playCtx    context.Context
	playlistID int
	monitors   []monitor.Monitor
	target     monitor.MonitorTarget
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
	cfg               config.ConfigManager

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
	cfg config.ConfigManager,
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
		cfg:               cfg,
		runs:              make(map[int]*playlistRun),
	}
}

// Start begins a playlist on the specified target monitor(s).
func (m *Manager) Start(ctx context.Context, playlistID int, target monitor.MonitorTarget) error {
	return m.startPlaylist(ctx, playlistID, target, startOpts{})
}

func (m *Manager) startPlaylist(ctx context.Context, playlistID int, target monitor.MonitorTarget, opts startOpts) error {
	pl, err := m.playlistStore.GetByID(ctx, playlistID)
	if err != nil {
		return fmt.Errorf("playlist manager: load playlist: %w", err)
	}

	if len(pl.Images) == 0 {
		return fmt.Errorf("playlist manager: playlist %d has no images", playlistID)
	}

	targetEff := target
	if opts.fromPersisted && pl.Playback != nil {
		targetEff = playbackToTarget(pl.Playback)
	}

	monitors, err := m.resolveMonitors(ctx, targetEff)
	if err != nil {
		return err
	}
	if len(monitors) == 0 {
		return fmt.Errorf("playlist manager: no monitors resolved for target %q", targetEff.ID)
	}

	targetNames := monitorNameSet(monitors)
	for _, inst := range m.stateStore.GetActivePlaylists() {
		if monitorsOverlap(inst.Monitors, targetNames) {
			id := inst.PlaylistID
			instCopy := inst
			m.persistPlaybackWithInst(ctx, id, &instCopy, false)
			m.stopPlaylist(id)
		}
	}

	timeSlots, startIdx, tIdx, tCur := m.playlistStartIndices(pl, opts)
	applyRow := startIdx
	if len(tIdx) > 0 && tCur >= 0 && tCur < len(tIdx) {
		applyRow = tIdx[tCur]
	}

	sched := NewScheduler(SchedulerConfig{
		Type:         pl.Configuration.Type,
		Interval:     pl.Configuration.Interval,
		Order:        pl.Configuration.Order,
		TotalImages:  len(pl.Images),
		StartIndex:   startIdx,
		TimeSlots:    timeSlots,
		TimerIndices: tIdx,
		TimerCursor:  tCur,
	})

	playCtx, playCancel := context.WithCancel(context.Background())

	run := &playlistRun{
		sched:      sched,
		cancel:     playCancel,
		playCtx:    playCtx,
		playlistID: pl.ID,
		monitors:   monitors,
		target:     targetEff,
	}

	m.mu.Lock()
	m.runs[pl.ID] = run
	m.mu.Unlock()

	if pl.Configuration.Type == "time_of_day" || pl.Configuration.Type == "day_of_week" {
		go m.missedEventChecker(playCtx, pl.ID, monitors, targetEff)
	}

	effectiveIdx := applyRow
	if !opts.fromPersisted {
		result, err := m.applyImage(ctx, pl, applyRow, monitors, targetEff.Mode, compatForward)
		if err != nil {
			slog.Warn("playlist: failed to apply first image", "error", err)
		}
		if result.AppliedIndex >= 0 {
			effectiveIdx = result.AppliedIndex
		}
	}
	// On fromPersisted, wallpaper.Restore already set the wallpaper for each
	// monitor in monitor_state. Re-applying here races with that path and (in
	// wayland-utauri) can cause the second monitor's load to be dropped during
	// the retry-loop collision.

	sched.Start(func(index int) bool {
		return m.onTick(playCtx, pl.ID, index, monitors, targetEff)
	})

	monNames := monitorNames(monitors)
	resumePaused := opts.fromPersisted && pl.Playback != nil && pl.Playback.Paused
	nextAt := sched.NextChangeAt()
	if resumePaused {
		nextAt = nil
	}
	instance := store.ActivePlaylistInstance{
		ActivePlaylistState: store.ActivePlaylistState{
			PlaylistID:   pl.ID,
			PlaylistName: pl.Name,
			TotalImages:  len(pl.Images),
			Paused:       resumePaused,
			StartedAt:    time.Now(),
			NextChangeAt: nextAt,
		},
		Mode:     string(targetEff.Mode),
		Monitors: monNames,
	}
	updateInstanceIndex(&instance, pl, effectiveIdx)
	m.stateStore.SetActivePlaylist(instance)

	if resumePaused {
		run.sched.Pause()
	}

	if inst := m.stateStore.GetActivePlaylistByID(pl.ID); inst != nil {
		m.persistPlaybackWithInst(ctx, pl.ID, inst, true)
	}

	m.bus.Publish(events.Event{
		Type: events.PlaylistStarted,
		Data: map[string]any{
			"playlist_id":   pl.ID,
			"playlist_name": pl.Name,
			"monitors":      monNames,
			"mode":          targetEff.Mode,
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

	instCopy := *inst
	m.persistPlaybackWithInst(ctx, playlistID, &instCopy, false)
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

	if inst := m.stateStore.GetActivePlaylistByID(playlistID); inst != nil {
		m.persistPlaybackWithInst(ctx, playlistID, inst, true)
	}

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

	if inst := m.stateStore.GetActivePlaylistByID(playlistID); inst != nil {
		m.persistPlaybackWithInst(ctx, playlistID, inst, true)
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
// Playback on disk is marked was_running=false so a later daemon start does not auto-resume.
func (m *Manager) StopAll() int {
	return m.stopAllPersistingWasRunning(context.Background(), false)
}

// Shutdown stops every running playlist during daemon teardown. Playback is saved with
// was_running=true so RestorePersistedRuns can restart them after reboot or process restart.
func (m *Manager) Shutdown(ctx context.Context) int {
	return m.stopAllPersistingWasRunning(ctx, true)
}

func (m *Manager) stopAllPersistingWasRunning(ctx context.Context, resumeAfterRestart bool) int {
	active := m.stateStore.GetActivePlaylists()
	count := 0
	for playlistID, inst := range active {
		instCopy := inst
		m.persistPlaybackWithInst(ctx, playlistID, &instCopy, resumeAfterRestart)
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
		if inst := m.stateStore.GetActivePlaylistByID(playlistID); inst != nil {
			m.persistPlaybackWithInst(ctx, playlistID, inst, true)
		}
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
		if inst := m.stateStore.GetActivePlaylistByID(playlistID); inst != nil {
			m.persistPlaybackWithInst(ctx, playlistID, inst, true)
		}
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
	if len(pl.Images) == 0 {
		return fmt.Errorf("playlist manager: playlist %d has no images", playlistID)
	}

	newIdx := advancePlaylistRow(inst, pl, delta)
	playbackRow := resolvePlaylistRowForPlayback(inst, pl)
	slog.Debug("playlist manual advance",
		"playlist_id", playlistID,
		"delta", delta,
		"stored_index", inst.CurrentIndex,
		"playback_row", playbackRow,
		"next_index", newIdx,
		"n_images", len(pl.Images),
		"selection_mode", m.cfg.GetSelectionMode())

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

	walk := compatForward
	if delta < 0 {
		walk = compatBackward
	}
	result, applyErr := m.applyImage(ctx, pl, newIdx, targetMonitors, mode, walk)
	if applyErr != nil {
		return applyErr
	}
	if result.AppliedIndex < 0 {
		return nil
	}

	effectiveIdx := result.AppliedIndex

	m.mu.RLock()
	run, runOK := m.runs[playlistID]
	m.mu.RUnlock()
	if runOK && pl.Configuration.Type == "timer" {
		run.sched.AfterManualNavigation(effectiveIdx)
	}
	var nextChange *time.Time
	m.mu.RLock()
	if r2, ok := m.runs[playlistID]; ok {
		nextChange = r2.sched.NextChangeAt()
	}
	m.mu.RUnlock()

	m.stateStore.UpdateActivePlaylist(playlistID, func(inst *store.ActivePlaylistInstance) {
		updateInstanceIndex(inst, pl, effectiveIdx)
		if effectiveIdx > 0 && len(pl.Images) > 1 {
			pid := pl.Images[effectiveIdx-1].ImageID
			inst.PreviousImageID = &pid
		}
		inst.NextChangeAt = nextChange
	})

	m.persistPlayback(ctx, playlistID, true)

	m.bus.Publish(events.Event{
		Type: events.PlaylistImageChanged,
		Data: map[string]any{
			"playlist_id": playlistID,
			"image_index": effectiveIdx,
			"image_id":    pl.Images[effectiveIdx].ImageID,
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

// ReconcileAfterPlaylistUpdate reloads the running timer playlist from the persisted document after PATCH.
// Maps the same slide onto the new images[] order (resolvePlaylistRowForPlayback), then
// timerReloadAfterPlaylistDocumentChange — same intent as legacy Node updatePlaylist() +
// timedPlaylist(firstPlay). No-op if not running; stops if doc is empty, not timer, or no active instance.
func (m *Manager) ReconcileAfterPlaylistUpdate(ctx context.Context, playlistID int) error {
	m.mu.RLock()
	run := m.runs[playlistID]
	m.mu.RUnlock()
	if run == nil {
		if inst := m.stateStore.GetActivePlaylistByID(playlistID); inst != nil {
			slog.Warn("playlist reconcile noop: active state but no scheduler run",
				"playlist_id", playlistID,
				"current_image_id", inst.CurrentImageID,
				"current_index", inst.CurrentIndex,
				"total_images", inst.TotalImages)
		} else {
			slog.Debug("playlist reconcile skipped",
				"playlist_id", playlistID,
				"reason", "playlist_not_running")
		}
		return nil
	}

	pl, err := m.playlistStore.GetByID(ctx, playlistID)
	if err != nil {
		return fmt.Errorf("playlist reconcile: load playlist: %w", err)
	}

	if len(pl.Images) == 0 {
		slog.Warn("playlist reconcile stopping run (empty playlist doc)",
			"playlist_id", playlistID)
		m.stopPlaylist(playlistID)
		return nil
	}

	if pl.Configuration.Type != "timer" {
		target := run.target
		slog.Info("playlist reconcile: restarting run after document update",
			"playlist_id", playlistID,
			"type", pl.Configuration.Type)
		m.stopPlaylist(playlistID)
		if err := m.startPlaylist(ctx, playlistID, target, startOpts{}); err != nil {
			return fmt.Errorf("playlist reconcile: restart after PATCH: %w", err)
		}
		return nil
	}

	inst := m.stateStore.GetActivePlaylistByID(playlistID)
	if inst == nil {
		slog.Warn("playlist reconcile stopping run (no active instance)",
			"playlist_id", playlistID)
		m.stopPlaylist(playlistID)
		return nil
	}

	anchorRow := resolvePlaylistRowForPlayback(inst, pl)
	return m.timerReloadAfterPlaylistDocumentChange(ctx, playlistID, pl, anchorRow, inst)
}

// onTick is called by the scheduler when it's time to change the wallpaper.
// Returns whether the slide was applied; the timer scheduler only advances traversal when true.
func (m *Manager) onTick(ctx context.Context, playlistID int, index int, monitors []monitor.Monitor, target monitor.MonitorTarget) bool {
	pl, err := m.playlistStore.GetByID(ctx, playlistID)
	if err != nil {
		slog.Warn("playlist tick: load playlist", "playlist_id", playlistID, "error", err)
		return false
	}
	if len(pl.Images) == 0 {
		return false
	}

	result, err := m.applyImage(ctx, pl, index, monitors, target.Mode, compatForward)
	if err != nil {
		slog.Warn("playlist tick: failed to apply image", "playlist_id", playlistID, "index", index, "error", err)
		return false
	}
	if result.AppliedIndex < 0 {
		slog.Debug("playlist timer tick not applied",
			"playlist_id", playlistID,
			"requested_index", index,
			"applied_index", result.AppliedIndex,
			"skipped_compat", result.Skipped)
		return false
	}

	effectiveIdx := result.AppliedIndex
	slog.Debug("playlist timer tick ok",
		"playlist_id", playlistID,
		"requested_index", index,
		"applied_index", effectiveIdx,
		"applied_image_id", pl.Images[effectiveIdx].ImageID,
		"selection_mode", m.cfg.GetSelectionMode())

	m.mu.RLock()
	var nextChange *time.Time
	if run, ok := m.runs[pl.ID]; ok {
		nextChange = run.sched.NextChangeAt()
	}
	m.mu.RUnlock()

	m.stateStore.UpdateActivePlaylist(pl.ID, func(inst *store.ActivePlaylistInstance) {
		updateInstanceIndex(inst, pl, effectiveIdx)
		inst.NextChangeAt = nextChange
	})

	m.persistPlayback(ctx, pl.ID, true)

	m.bus.Publish(events.Event{
		Type: events.PlaylistImageChanged,
		Data: map[string]any{
			"playlist_id": pl.ID,
			"image_index": effectiveIdx,
			"image_id":    pl.Images[effectiveIdx].ImageID,
			"monitors":    monitorNames(monitors),
		},
	})
	return true
}

// compatWalk selects how findCompatibleIndex searches the playlist when some
// entries are not supported by the active backend. Forward matches timer/next
// (walk increasing indices from start); Backward matches previous (walk
// decreasing from start) so we land on the prior compatible item instead of
// wrapping forward to the current one.
type compatWalk int

const (
	compatForward compatWalk = iota
	compatBackward
)

// applyResult holds the outcome of a playlist image application attempt.
type applyResult struct {
	// AppliedIndex is the playlist index that was actually set, or -1 if nothing was applied.
	AppliedIndex int
	// Skipped is the count of items skipped due to backend incompatibility.
	Skipped int
}

// applyImage resolves the next compatible image starting at index, applies it,
// and returns which index was actually applied. If no compatible item exists in
// the entire playlist, it publishes PlaylistNoCompatibleItem and returns
// AppliedIndex == -1 with a nil error (not a hard failure).
//
// In auto mode, the backend is resolved per item via PickBackend and switched
// transparently (no restore, no config persist).
func (m *Manager) applyImage(ctx context.Context, pl *store.Playlist, index int, monitors []monitor.Monitor, mode monitor.MonitorMode, walk compatWalk) (applyResult, error) {
	if index >= len(pl.Images) {
		return applyResult{AppliedIndex: -1}, fmt.Errorf("image index %d out of range (total: %d)", index, len(pl.Images))
	}

	selMode := m.cfg.GetSelectionMode()

	if selMode == "auto" {
		return m.applyImageAuto(ctx, pl, index, monitors, mode)
	}
	return m.applyImageFixed(ctx, pl, index, monitors, mode, walk)
}

func (m *Manager) applyImageFixed(ctx context.Context, pl *store.Playlist, index int, monitors []monitor.Monitor, mode monitor.MonitorMode, walk compatWalk) (applyResult, error) {
	activeBackend := m.registry.Active()
	caps := activeBackend.Capabilities()

	resolvedIdx, skipped, skipItems := findCompatibleIndexWithWalk(ctx, pl, index, walk, caps, m.imageStore)
	if resolvedIdx < 0 {
		slog.Warn("playlist: no compatible item for active backend",
			"playlist_id", pl.ID,
			"backend", activeBackend.Name(),
		)
		m.bus.Publish(events.Event{
			Type: events.PlaylistNoCompatibleItem,
			Data: map[string]any{
				"playlist_id":   pl.ID,
				"playlist_name": pl.Name,
				"backend":       activeBackend.Name(),
				"total_images":  len(pl.Images),
			},
		})
		return applyResult{AppliedIndex: -1, Skipped: skipped}, nil
	}

	if skipped > 0 {
		slog.Info("playlist: skipped incompatible items",
			"playlist_id", pl.ID,
			"skipped", skipped,
			"backend", activeBackend.Name(),
			"applied_index", resolvedIdx,
		)
		skipPayload := make([]map[string]any, 0, len(skipItems))
		for _, it := range skipItems {
			skipPayload = append(skipPayload, map[string]any{
				"image_id":   it.ImageID,
				"media_type": it.MediaType,
				"slot_index": it.SlotIndex,
			})
		}
		m.bus.Publish(events.Event{
			Type: events.PlaylistSkippedIncompatible,
			Data: map[string]any{
				"playlist_id":   pl.ID,
				"playlist_name": pl.Name,
				"backend":       activeBackend.Name(),
				"skipped":       skipped,
				"applied_index": resolvedIdx,
				"skipped_items": skipPayload,
			},
		})
	}

	return m.doApply(ctx, pl, resolvedIdx, monitors, mode, skipped)
}

func (m *Manager) applyImageAuto(ctx context.Context, pl *store.Playlist, index int, monitors []monitor.Monitor, mode monitor.MonitorMode) (applyResult, error) {
	imgRef := pl.Images[index]
	mt := imgRef.MediaType
	if mt == "" {
		if img, err := m.imageStore.GetByID(ctx, imgRef.ImageID); err == nil && img != nil {
			mt = strings.ToLower(strings.TrimSpace(img.MediaType))
		}
	}

	prio := m.cfg.GetAutoPriorities()
	priorities := map[string][]string{
		"image": prio.Image,
		"video": prio.Video,
		"web":   prio.Web,
	}

	targetName, err := backend.PickBackend(m.registry, "auto", mt, priorities)
	if err != nil {
		slog.Warn("playlist auto: no backend for media", "media_type", mt, "error", err)
		m.bus.Publish(events.Event{
			Type: events.PlaylistNoCompatibleItem,
			Data: map[string]any{
				"playlist_id":   pl.ID,
				"playlist_name": pl.Name,
				"media_type":    mt,
				"total_images":  len(pl.Images),
			},
		})
		return applyResult{AppliedIndex: -1}, nil
	}

	if err := backend.SwitchActiveBackend(ctx, m.registry, targetName, m.cfg, backend.SwitchOpts{
		PersistConfig: false,
	}); err != nil {
		return applyResult{AppliedIndex: -1}, fmt.Errorf("auto switch to %s: %w", targetName, err)
	}

	return m.doApply(ctx, pl, index, monitors, mode, 0)
}

func (m *Manager) doApply(ctx context.Context, pl *store.Playlist, index int, monitors []monitor.Monitor, mode monitor.MonitorMode, skipped int) (applyResult, error) {
	imgRef := pl.Images[index]
	img, err := m.imageStore.GetByID(ctx, imgRef.ImageID)
	if err != nil {
		return applyResult{AppliedIndex: -1, Skipped: skipped}, fmt.Errorf("load image %d: %w", imgRef.ImageID, err)
	}

	if err := wallpaper.Apply(ctx, wallpaper.ApplyOpts{
		Image:    img,
		Monitors: monitors,
		Mode:     mode,
		Source: store.HistorySource{
			Type:         "playlist",
			PlaylistID:   &pl.ID,
			PlaylistName: pl.Name,
		},
		Backend:           m.registry.Active(),
		Splitter:          m.splitter,
		History:           m.historyStore,
		MonState:          m.monitorStateStore,
		State:             m.stateStore,
		VideoAudioDefault: wallpaper.VideoAudioDefaultFromCfg(m.cfg),
		Bus:               m.bus,
	}); err != nil {
		return applyResult{AppliedIndex: -1, Skipped: skipped}, err
	}

	return applyResult{AppliedIndex: index, Skipped: skipped}, nil
}

// skippedPlaylistItem describes one playlist entry that was not applied because
// the active backend does not support its media type.
type skippedPlaylistItem struct {
	ImageID   int
	MediaType string
	SlotIndex int
}

func resolvePlaylistImageMediaType(ctx context.Context, imgRef store.PlaylistImage, images store.ImageStore) string {
	mt := imgRef.MediaType
	if mt == "" {
		if img, err := images.GetByID(ctx, imgRef.ImageID); err == nil && img != nil {
			mt = strings.ToLower(strings.TrimSpace(img.MediaType))
		}
	}
	return mt
}

// findCompatibleIndex walks forward from start (used by tests and as a thin wrapper).
func findCompatibleIndex(ctx context.Context, pl *store.Playlist, start int, caps backend.Capabilities, images store.ImageStore) (idx int, skipped int) {
	idx, skipped, _ = findCompatibleIndexWithWalk(ctx, pl, start, compatForward, caps, images)
	return idx, skipped
}

// findCompatibleIndexWithWalk walks the playlist from start in the given
// direction, wrapping at most once. Returns the resolved index, skip count, and
// per-slot skip metadata for UI toasts, or (-1, n, items) if nothing is compatible.
func findCompatibleIndexWithWalk(ctx context.Context, pl *store.Playlist, start int, walk compatWalk, caps backend.Capabilities, images store.ImageStore) (idx int, skipped int, skippedItems []skippedPlaylistItem) {
	n := len(pl.Images)
	if n == 0 {
		return -1, 0, nil
	}
	start = ((start % n) + n) % n
	var order []int
	order = make([]int, n)
	if walk == compatForward {
		for i := range n {
			order[i] = (start + i) % n
		}
	} else {
		for i := range n {
			order[i] = (start - i + n) % n
		}
	}
	for i, candidate := range order {
		imgRef := pl.Images[candidate]
		mt := resolvePlaylistImageMediaType(ctx, imgRef, images)
		if backend.SupportsMedia(caps, mt) {
			return candidate, i, skippedItems
		}
		skippedItems = append(skippedItems, skippedPlaylistItem{
			ImageID:   imgRef.ImageID,
			MediaType: mt,
			SlotIndex: candidate,
		})
	}
	return -1, n, skippedItems
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
func (m *Manager) missedEventChecker(ctx context.Context, playlistID int, monitors []monitor.Monitor, target monitor.MonitorTarget) {
	ticker := time.NewTicker(10 * time.Second)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			inst := m.stateStore.GetActivePlaylistByID(playlistID)
			if inst == nil {
				return
			}
			if inst.Paused {
				continue
			}
			if inst.NextChangeAt == nil {
				continue
			}

			pl, loadErr := m.playlistStore.GetByID(ctx, playlistID)
			if loadErr != nil {
				slog.Warn("missed event: load playlist", "playlist_id", playlistID, "error", loadErr)
				continue
			}
			if len(pl.Images) == 0 {
				return
			}

			now := time.Now()
			if now.After(inst.NextChangeAt.Add(30 * time.Second)) {
				slog.Warn("missed event detected, re-triggering scheduler",
					"monitors", inst.Monitors,
					"expected_time", inst.NextChangeAt,
					"current_time", now,
					"playlist_id", playlistID,
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

				result, applyErr := m.applyImage(ctx, pl, newIdx, monitors, target.Mode, compatForward)
				if applyErr != nil {
					slog.Warn("missed event: failed to apply image", "error", applyErr)
					continue
				}
				if result.AppliedIndex < 0 {
					continue
				}

				effectiveIdx := result.AppliedIndex

				m.mu.RLock()
				var nextChange *time.Time
				if run, ok := m.runs[playlistID]; ok {
					nextChange = run.sched.NextChangeAt()
				}
				m.mu.RUnlock()

				m.stateStore.UpdateActivePlaylist(playlistID, func(upd *store.ActivePlaylistInstance) {
					updateInstanceIndex(upd, pl, effectiveIdx)
					upd.NextChangeAt = nextChange
				})

				m.persistPlayback(ctx, playlistID, true)

				m.bus.Publish(events.Event{
					Type: events.PlaylistImageChanged,
					Data: map[string]any{
						"playlist_id": playlistID,
						"image_index": effectiveIdx,
						"image_id":    pl.Images[effectiveIdx].ImageID,
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

// buildTimeSlots extracts TimeSlot entries from the playlist's images and sorts them
// by minutes ascending. findClosestTimeSlot and timeOfDayScheduler.nextTransition require
// this ordering (same assumption as legacy Node binary search on a time-sorted strip).
func buildTimeSlots(pl *store.Playlist) []TimeSlot {
	var slots []TimeSlot
	for i, pimg := range pl.Images {
		if pimg.Time != nil {
			slots = append(slots, TimeSlot{Minutes: *pimg.Time, ImageIndex: i})
		}
	}
	sort.Slice(slots, func(a, b int) bool {
		if slots[a].Minutes != slots[b].Minutes {
			return slots[a].Minutes < slots[b].Minutes
		}
		return slots[a].ImageIndex < slots[b].ImageIndex
	})
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
