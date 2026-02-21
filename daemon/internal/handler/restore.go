package handler

import (
	"context"
	"log/slog"

	"waypaper-engine/daemon/internal/backend"
	"waypaper-engine/daemon/internal/image"
	"waypaper-engine/daemon/internal/monitor"
	"waypaper-engine/daemon/internal/store"
)

type extendGroup struct {
	state    store.MonitorState
	monitors []monitor.Monitor
}

// RestoreWallpapers re-applies the last known wallpaper for each connected
// monitor using the persisted monitor state from the database. This is called
// during startup and after backend activation so monitors show the correct
// wallpaper. Best-effort: errors are logged but do not block the caller.
func RestoreWallpapers(
	ctx context.Context,
	monitorStateStore store.MonitorStateStore,
	stateStore store.StateStore,
	reg backend.Registry,
	monManager monitor.MonitorManager,
	splitter *image.Splitter,
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
	caps := activeBackend.Capabilities()
	restored := 0
	skipped := 0

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
		restored += restoreExtendGroup(ctx, grp, activeBackend, caps, splitter, stateStore)
	}

	for _, state := range nonExtendStates {
		if restoreIndividual(ctx, state, connected[state.MonitorName], activeBackend, stateStore) {
			restored++
		}
	}

	slog.Info("wallpaper restore complete", "restored", restored, "skipped", skipped)
}

func restoreExtendGroup(
	ctx context.Context,
	grp *extendGroup,
	activeBackend backend.Backend,
	caps backend.Capabilities,
	splitter *image.Splitter,
	stateStore store.StateStore,
) int {
	restored := 0

	if !caps.NativeExtend && splitter != nil && len(grp.monitors) > 1 {
		splitPaths, err := splitter.Split(grp.state.ImagePath, grp.state.ImageID, grp.monitors)
		if err != nil {
			slog.Warn("restore: failed to split image for extend",
				"image_id", grp.state.ImageID,
				"image_path", grp.state.ImagePath,
				"error", err,
			)
			return 0
		}

		for _, mon := range grp.monitors {
			splitPath, ok := splitPaths[mon.Name]
			if !ok {
				continue
			}
			req := backend.WallpaperRequest{
				ImagePath: splitPath,
				Monitors:  []monitor.Monitor{mon},
				Mode:      monitor.ModeIndividual,
			}
			if err := activeBackend.SetWallpaper(ctx, req); err != nil {
				slog.Warn("restore: failed to set split wallpaper", "monitor", mon.Name, "error", err)
				continue
			}
			stateStore.SetCurrentWallpaper(mon.Name, restoreEntry(grp.state, []string{mon.Name}))
			restored++
		}
	} else {
		req := backend.WallpaperRequest{
			ImagePath: grp.state.ImagePath,
			Monitors:  grp.monitors,
			Mode:      monitor.ModeExtend,
		}
		if err := activeBackend.SetWallpaper(ctx, req); err != nil {
			slog.Warn("restore: failed to set extend wallpaper", "image_id", grp.state.ImageID, "error", err)
			return 0
		}
		monNames := make([]string, len(grp.monitors))
		for i, mon := range grp.monitors {
			monNames[i] = mon.Name
			stateStore.SetCurrentWallpaper(mon.Name, restoreEntry(grp.state, monNames))
		}
		restored += len(grp.monitors)
	}

	return restored
}

func restoreIndividual(
	ctx context.Context,
	state store.MonitorState,
	mon monitor.Monitor,
	activeBackend backend.Backend,
	stateStore store.StateStore,
) bool {
	req := backend.WallpaperRequest{
		ImagePath: state.ImagePath,
		Monitors:  []monitor.Monitor{mon},
		Mode:      monitor.MonitorMode(state.Mode),
	}

	if err := activeBackend.SetWallpaper(ctx, req); err != nil {
		slog.Warn("restore: failed to set wallpaper",
			"monitor", state.MonitorName, "image_id", state.ImageID, "error", err)
		return false
	}

	stateStore.SetCurrentWallpaper(state.MonitorName, restoreEntry(state, []string{state.MonitorName}))
	return true
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
