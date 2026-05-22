package wallpaper

import (
	"context"
	"log/slog"
	"time"

	"waypaper-engine/daemon/internal/backend"
	"waypaper-engine/daemon/internal/config"
	"waypaper-engine/daemon/internal/events"
	"waypaper-engine/daemon/internal/image"
	"waypaper-engine/daemon/internal/monitor"
	"waypaper-engine/daemon/internal/store"
)

// StartDeferredDaemonRestore runs in a background goroutine. It retries
// reg.Active().Initialize until success (with exponential backoff), then calls
// Restore. Use when a DaemonProcess backend failed Initialize at
// startup so wallpapers apply once the child process becomes available.
// Stops when stopCtx is cancelled or after maxAttempts.
func StartDeferredDaemonRestore(
	stopCtx context.Context,
	reg backend.Registry,
	cfg config.ConfigManager,
	monitorStateStore store.MonitorStateStore,
	stateStore store.StateStore,
	monManager monitor.MonitorManager,
	images store.ImageStore,
	splitter *image.Splitter,
	bus events.Bus,
) {
	go func() {
		const maxAttempts = 36
		backoff := time.Second
		const maxBackoff = 32 * time.Second

		for attempt := 1; attempt <= maxAttempts; attempt++ {
			select {
			case <-stopCtx.Done():
				slog.Debug("deferred wallpaper restore cancelled")
				return
			default:
			}

			active := reg.Active()
			initCtx, cancel := context.WithTimeout(context.Background(), 45*time.Second)
			err := active.Initialize(initCtx)
			cancel()
			if err != nil {
				slog.Warn("deferred restore: backend initialize failed, will retry",
					"backend", active.Name(),
					"attempt", attempt,
					"max_attempts", maxAttempts,
					"error", err,
				)
				select {
				case <-stopCtx.Done():
					return
				case <-time.After(backoff):
				}
				next := backoff * 2
				if next > maxBackoff {
					next = maxBackoff
				}
				backoff = next
				continue
			}

			slog.Info("deferred restore: backend ready, applying persisted wallpapers",
				"backend", active.Name(),
				"attempt", attempt,
			)
			Restore(context.Background(), monitorStateStore, stateStore, reg, cfg, monManager, images, splitter, bus)
			return
		}

		slog.Error("deferred restore: exhausted retries; ensure the backend binary is on PATH and the control socket path matches",
			"backend", reg.Active().Name(),
			"max_attempts", maxAttempts,
		)
		if bus != nil {
			bus.Publish(events.Event{
				Type: events.BackendUnavailable,
				Data: map[string]any{
					"backend": reg.Active().Name(),
					"message": "Wallpaper backend did not become ready after repeated retries; check wal-qt and socket_path in config.",
				},
			})
		}
	}()
}

// Restore re-applies the last known wallpaper for each connected monitor using
// the persisted monitor state from the database. This is called during startup
// and after backend activation so monitors show the correct wallpaper.
// Best-effort: errors are logged but do not block the caller. If bus is
// non-nil, a single WallpaperRestoreFailed event is published when restore fails.
func Restore(
	ctx context.Context,
	monitorStateStore store.MonitorStateStore,
	stateStore store.StateStore,
	reg backend.Registry,
	cfg config.ConfigManager,
	monManager monitor.MonitorManager,
	images store.ImageStore,
	splitter *image.Splitter,
	bus events.Bus,
) {
	states, err := monitorStateStore.GetAll(ctx)
	if err != nil {
		slog.Warn("restore: failed to load monitor states", "error", err)
		return
	}
	if len(states) == 0 {
		slog.Info("restore: no persisted monitor state, skipping")
		return
	}

	stateNames := make([]string, len(states))
	for i, s := range states {
		stateNames[i] = s.MonitorName
	}
	slog.Info("restore: loaded persisted states", "monitors", stateNames)

	monitors, err := monManager.GetMonitors(ctx)
	if err != nil {
		slog.Warn("restore: failed to get monitors", "error", err)
		return
	}

	connected := make(map[string]monitor.Monitor, len(monitors))
	connectedNames := make([]string, len(monitors))
	for i, mon := range monitors {
		connected[mon.Name] = mon
		connectedNames[i] = mon.Name
	}
	slog.Info("restore: detected monitors", "monitors", connectedNames)

	activeBackend := reg.Active()
	videoAudioDefault := VideoAudioDefaultFromCfg(cfg)

	snap, skips, err := BuildSnapshot(
		ctx,
		states,
		connected,
		images,
		splitter,
		activeBackend,
		monitorStateStore,
		nil, // historyStore — restore does not write history
		nil, // playlistStore
		bus,
		videoAudioDefault,
	)
	if err != nil {
		slog.Warn("restore: failed to build snapshot", "error", err)
		return
	}

	for _, skip := range skips {
		slog.Info("restore: skipped monitor",
			"monitor", skip.MonitorName,
			"image_id", skip.ImageID,
			"reason", skip.Kind,
			"detail", skip.Detail,
		)
	}

	if len(snap.Outputs) == 0 {
		slog.Info("restore: no outputs to apply (all monitors skipped)")
		return
	}

	if err := activeBackend.Apply(ctx, snap); err != nil {
		slog.Warn("restore: backend apply failed", "backend", activeBackend.Name(), "error", err)
		if bus != nil {
			bus.Publish(events.Event{
				Type: events.WallpaperRestoreFailed,
				Data: map[string]any{
					"backend": activeBackend.Name(),
					"error":   err.Error(),
				},
			})
		}
		return
	}

	// Update in-memory current wallpaper state for each restored output.
	for _, out := range snap.Outputs {
		entry := store.ImageHistoryEntry{
			Monitors: []string{out.Monitor.Name},
			Mode:     string(backend.ModeClone), // best-effort; mode not tracked per-output here
			SetAt:    time.Now(),
			Source:   store.HistorySource{Type: "restore"},
			Backend:  activeBackend.Name(),
		}
		stateStore.SetCurrentWallpaper(out.Monitor.Name, entry)
	}

	slog.Info("wallpaper restore complete", "restored", len(snap.Outputs), "skipped", len(skips))
}
