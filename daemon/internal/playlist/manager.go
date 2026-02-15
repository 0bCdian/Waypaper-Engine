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

// Manager handles playlist lifecycle: start, stop, pause, resume, next, previous.
type Manager struct {
	mu             sync.RWMutex
	playlistStore  store.PlaylistStore
	stateStore     store.StateStore
	historyStore   store.HistoryStore
	registry       backend.Registry
	monitorManager monitor.MonitorManager
	bus            events.Bus
	splitter       *image.Splitter
	imageStore     store.ImageStore

	// schedulers tracks running schedulers keyed by monitor name.
	schedulers map[string]Scheduler
	// cancelFuncs tracks cancel functions for scheduler goroutine contexts.
	cancelFuncs map[string]context.CancelFunc
}

// NewManager creates a new playlist manager with all required dependencies.
func NewManager(
	playlistStore store.PlaylistStore,
	stateStore store.StateStore,
	historyStore store.HistoryStore,
	imageStore store.ImageStore,
	registry backend.Registry,
	monitorManager monitor.MonitorManager,
	bus events.Bus,
	splitter *image.Splitter,
) *Manager {
	return &Manager{
		playlistStore:  playlistStore,
		stateStore:     stateStore,
		historyStore:   historyStore,
		imageStore:     imageStore,
		registry:       registry,
		monitorManager: monitorManager,
		bus:            bus,
		splitter:       splitter,
		schedulers:     make(map[string]Scheduler),
		cancelFuncs:    make(map[string]context.CancelFunc),
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

	// Stop any existing playlist on target monitors.
	for _, mon := range monitors {
		if existing := m.stateStore.GetActivePlaylistByMonitor(mon.Name); existing != nil {
			m.stopForMonitor(mon.Name)
		}
	}

	// Determine start index.
	startIdx := 0
	if pl.Configuration.AlwaysStartOnFirstImage {
		startIdx = 0
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

	// Create scheduler.
	sched := NewScheduler(SchedulerConfig{
		Type:        pl.Configuration.Type,
		Interval:    pl.Configuration.Interval,
		Order:       pl.Configuration.Order,
		TotalImages: len(pl.Images),
		StartIndex:  startIdx,
		TimeSlots:   timeSlots,
	})

	// Register state and start scheduler for each target monitor.
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

		m.mu.Lock()
		m.schedulers[mon.Name] = sched
		m.mu.Unlock()
	}

	// Apply first image.
	if err := m.applyImage(ctx, pl, startIdx, monitors, target.Mode); err != nil {
		slog.Warn("playlist: failed to apply first image", "error", err)
	}

	// Start scheduler with callback.
	sched.Start(func(index int) {
		m.onTick(ctx, pl, index, monitors, target)
	})

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
			if sched, ok := m.schedulers[monName]; ok {
				sched.Pause()
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
			if sched, ok := m.schedulers[monName]; ok {
				sched.Resume()
				inst.NextChangeAt = sched.NextChangeAt()
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

// StopAll stops all running playlists.
func (m *Manager) StopAll() {
	active := m.stateStore.GetActivePlaylists()
	for monName := range active {
		m.stopForMonitor(monName)
	}
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
func (m *Manager) stopForMonitor(monName string) {
	m.mu.Lock()
	if sched, ok := m.schedulers[monName]; ok {
		sched.Stop()
		delete(m.schedulers, monName)
	}
	if cancel, ok := m.cancelFuncs[monName]; ok {
		cancel()
		delete(m.cancelFuncs, monName)
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
		if sched, ok := m.schedulers[mon.Name]; ok {
			inst.NextChangeAt = sched.NextChangeAt()
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

	// Update current wallpaper in state store.
	for _, mon := range monitors {
		m.stateStore.SetCurrentWallpaper(mon.Name, entry)
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

// monitorNames extracts names from a list of monitors.
func monitorNames(monitors []monitor.Monitor) []string {
	names := make([]string, len(monitors))
	for i, mon := range monitors {
		names[i] = mon.Name
	}
	return names
}
