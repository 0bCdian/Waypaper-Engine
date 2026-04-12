package handler

import (
	"context"
	"log/slog"
	"strings"
	"time"

	"waypaper-engine/daemon/internal/backend"
	"waypaper-engine/daemon/internal/events"
	"waypaper-engine/daemon/internal/image"
	"waypaper-engine/daemon/internal/media"
	"waypaper-engine/daemon/internal/monitor"
	"waypaper-engine/daemon/internal/store"
	"waypaper-engine/daemon/internal/wallpaper"
)

type extendGroup struct {
	state    store.MonitorState
	monitors []monitor.Monitor
}

// StartDeferredDaemonRestore runs in a background goroutine. It retries
// reg.Active().Initialize until success (with exponential backoff), then calls
// RestoreWallpapers. Use when a DaemonProcess backend failed Initialize at
// startup so wallpapers apply once the child process becomes available.
// Stops when stopCtx is cancelled or after maxAttempts.
func StartDeferredDaemonRestore(
	stopCtx context.Context,
	reg backend.Registry,
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
			RestoreWallpapers(context.Background(), monitorStateStore, stateStore, reg, monManager, images, splitter, bus)
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
					"message": "Wallpaper backend did not become ready after repeated retries; check wayland-utauri and socket_path in config.",
				},
			})
		}
	}()
}

// restoreFailure captures a single per-monitor restore failure for aggregated SSE.
type restoreFailure struct {
	Monitor   string `json:"monitor"`
	ImageID   int    `json:"image_id"`
	MediaType string `json:"media_type"`
	Reason    string `json:"reason"`
}

// RestoreWallpapers re-applies the last known wallpaper for each connected
// monitor using the persisted monitor state from the database. This is called
// during startup and after backend activation so monitors show the correct
// wallpaper. Best-effort: errors are logged but do not block the caller.
// If bus is non-nil, a single WallpaperRestoreFailed event is published when
// any monitors fail to restore.
func RestoreWallpapers(
	ctx context.Context,
	monitorStateStore store.MonitorStateStore,
	stateStore store.StateStore,
	reg backend.Registry,
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
	restored := 0
	skipped := 0
	var failures []restoreFailure

	extendGroups := make(map[int]*extendGroup)
	var nonExtendStates []store.MonitorState

	for _, state := range states {
		if _, ok := connected[state.MonitorName]; !ok {
			slog.Warn("restore: monitor not connected, skipping",
				"persisted_name", state.MonitorName,
				"connected_monitors", connectedNames,
			)
			skipped++
			continue
		}

		if state.Mode == string(monitor.ModeExtend) {
			grp, exists := extendGroups[state.ImageID]
			if !exists {
				grp = &extendGroup{state: state}
				extendGroups[state.ImageID] = grp
			}
			grp.monitors = append(grp.monitors, connected[state.MonitorName])
		} else {
			nonExtendStates = append(nonExtendStates, state)
		}
	}

	for _, grp := range extendGroups {
		n, grpFailures := restoreExtendGroup(ctx, grp, activeBackend, splitter, stateStore, images)
		restored += n
		failures = append(failures, grpFailures...)
	}

	for _, state := range nonExtendStates {
		ok, fail := restoreIndividual(ctx, state, connected[state.MonitorName], activeBackend, stateStore, images)
		if ok {
			restored++
		}
		if fail != nil {
			failures = append(failures, *fail)
		}
	}

	slog.Info("wallpaper restore complete", "restored", restored, "skipped", skipped, "failed", len(failures))

	if len(failures) > 0 && bus != nil {
		bus.Publish(events.Event{
			Type: events.WallpaperRestoreFailed,
			Data: map[string]any{
				"backend":  activeBackend.Name(),
				"failures": failures,
			},
		})
	}
}

func normalizeRestoreMediaType(value string) media.MediaType {
	switch strings.ToLower(strings.TrimSpace(value)) {
	case string(media.MediaTypeGIF):
		return media.MediaTypeGIF
	case string(media.MediaTypeVideo):
		return media.MediaTypeVideo
	case string(media.MediaTypeWeb):
		return media.MediaTypeWeb
	default:
		return media.MediaTypeImage
	}
}

func restoreExtendGroup(
	ctx context.Context,
	grp *extendGroup,
	activeBackend backend.Backend,
	splitter *image.Splitter,
	stateStore store.StateStore,
	images store.ImageStore,
) (int, []restoreFailure) {
	restored := 0
	var failures []restoreFailure

	img, err := images.GetByID(ctx, grp.state.ImageID)
	resolved := err == nil && img != nil
	var imgPtr *store.Image
	if resolved {
		imgPtr = img
	}
	mt := media.MediaTypeImage
	audio := false
	if resolved {
		mt = normalizeRestoreMediaType(img.MediaType)
		audio = img.AudioEnabled
	}
	cfgVals := wallpaper.MergedWallpaperConfigForImage(imgPtr)

	useSplit := resolved && mt == media.MediaTypeImage && splitter != nil && len(grp.monitors) > 1

	if useSplit {
		splitPaths, err := splitter.Split(grp.state.ImagePath, grp.state.ImageID, grp.monitors)
		if err != nil {
			slog.Warn("restore: failed to split image for extend",
				"image_id", grp.state.ImageID,
				"image_path", grp.state.ImagePath,
				"error", err,
			)
			for _, mon := range grp.monitors {
				failures = append(failures, restoreFailure{
					Monitor: mon.Name, ImageID: grp.state.ImageID,
					MediaType: string(mt), Reason: "image split failed",
				})
			}
			return 0, failures
		}

		for _, mon := range grp.monitors {
			splitPath, ok := splitPaths[mon.Name]
			if !ok {
				continue
			}
			req := backend.WallpaperRequest{
				MediaType:             media.MediaTypeImage,
				ImagePath:             splitPath,
				AudioEnabled:          audio,
				Monitors:              []monitor.Monitor{mon},
				Mode:                  monitor.ModeIndividual,
				WallpaperConfigValues: cfgVals,
				ParallaxDirection:     wallpaper.ParallaxDirectionOverrideFromImage(imgPtr),
			}
			if err := activeBackend.SetWallpaper(ctx, req); err != nil {
				slog.Warn("restore: failed to set split wallpaper", "monitor", mon.Name, "error", err)
				failures = append(failures, restoreFailure{
					Monitor: mon.Name, ImageID: grp.state.ImageID,
					MediaType: string(mt), Reason: classifyRestoreError(err, activeBackend, string(mt)),
				})
				continue
			}
			stateStore.SetCurrentWallpaper(mon.Name, restoreEntry(grp.state, []string{mon.Name}))
			restored++
		}
	} else {
		req := backend.WallpaperRequest{
			MediaType:             mt,
			ImagePath:             grp.state.ImagePath,
			AudioEnabled:          audio,
			Monitors:              grp.monitors,
			Mode:                  monitor.ModeClone,
			WallpaperConfigValues: cfgVals,
			ParallaxDirection:     wallpaper.ParallaxDirectionOverrideFromImage(imgPtr),
		}
		if err := activeBackend.SetWallpaper(ctx, req); err != nil {
			slog.Warn("restore: failed to set extend wallpaper", "image_id", grp.state.ImageID, "error", err)
			for _, mon := range grp.monitors {
				failures = append(failures, restoreFailure{
					Monitor: mon.Name, ImageID: grp.state.ImageID,
					MediaType: string(mt), Reason: classifyRestoreError(err, activeBackend, string(mt)),
				})
			}
			return 0, failures
		}
		monNames := make([]string, len(grp.monitors))
		for i, mon := range grp.monitors {
			monNames[i] = mon.Name
		}
		for _, mon := range grp.monitors {
			stateStore.SetCurrentWallpaper(mon.Name, restoreEntry(grp.state, monNames))
		}
		restored += len(grp.monitors)
	}

	return restored, failures
}

func restoreIndividual(
	ctx context.Context,
	state store.MonitorState,
	mon monitor.Monitor,
	activeBackend backend.Backend,
	stateStore store.StateStore,
	images store.ImageStore,
) (bool, *restoreFailure) {
	mt := media.MediaTypeImage
	audio := false
	var imgPtr *store.Image
	if img, err := images.GetByID(ctx, state.ImageID); err == nil && img != nil {
		imgPtr = img
		mt = normalizeRestoreMediaType(img.MediaType)
		audio = img.AudioEnabled
	}
	req := backend.WallpaperRequest{
		MediaType:             mt,
		ImagePath:             state.ImagePath,
		AudioEnabled:          audio,
		Monitors:              []monitor.Monitor{mon},
		Mode:                  monitor.MonitorMode(state.Mode),
		WallpaperConfigValues: wallpaper.MergedWallpaperConfigForImage(imgPtr),
		ParallaxDirection:     wallpaper.ParallaxDirectionOverrideFromImage(imgPtr),
	}

	if err := activeBackend.SetWallpaper(ctx, req); err != nil {
		slog.Warn("restore: failed to set wallpaper",
			"monitor", state.MonitorName, "image_id", state.ImageID, "error", err)
		return false, &restoreFailure{
			Monitor:   state.MonitorName,
			ImageID:   state.ImageID,
			MediaType: string(mt),
			Reason:    classifyRestoreError(err, activeBackend, string(mt)),
		}
	}

	stateStore.SetCurrentWallpaper(state.MonitorName, restoreEntry(state, []string{state.MonitorName}))
	return true, nil
}

func classifyRestoreError(err error, b backend.Backend, mediaType string) string {
	if !backend.SupportsMedia(b.Capabilities(), mediaType) {
		return "media type incompatible with current backend"
	}
	return err.Error()
}

func restoreEntry(state store.MonitorState, monitors []string) store.ImageHistoryEntry {
	return store.ImageHistoryEntry{
		ImageID:   state.ImageID,
		ImageName: state.ImageName,
		Monitors:  monitors,
		Mode:      state.Mode,
		SetAt:     state.SetAt,
		Source:    store.HistorySource{Type: "restore"},
		Backend:   state.Backend,
	}
}
