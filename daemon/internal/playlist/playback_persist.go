package playlist

import (
	"context"
	"log/slog"

	"waypaper-engine/daemon/internal/monitor"
	"waypaper-engine/daemon/internal/store"
)

type startOpts struct {
	fromPersisted bool
}

func clampPlaylistIndex(idx, n int) int {
	if n <= 0 {
		return 0
	}
	if idx < 0 {
		return 0
	}
	if idx >= n {
		return n - 1
	}
	return idx
}

// resolvePlaylistRowForPlayback maps the in-memory cursor onto pl.Images after the playlist document
// changed (new order / inserts). Prefer the slot where CurrentImageID appears in the new slice so the
// same wallpaper stays current (PATCH reload); if that id was removed, fall back to clamp(CurrentIndex).
func resolvePlaylistRowForPlayback(inst *store.ActivePlaylistInstance, pl *store.Playlist) int {
	n := len(pl.Images)
	if n == 0 || inst == nil {
		return 0
	}
	want := inst.CurrentImageID
	for i := range pl.Images {
		if pl.Images[i].ImageID == want {
			return i
		}
	}
	return clampPlaylistIndex(inst.CurrentIndex, n)
}

// advancePlaylistRow is Next/Previous stepping on the current strip; uses the same row resolution as
// PATCH reload so CurrentIndex and CurrentImageID stay aligned after reorder.
func advancePlaylistRow(inst *store.ActivePlaylistInstance, pl *store.Playlist, delta int) int {
	n := len(pl.Images)
	if n == 0 {
		return 0
	}
	cur := resolvePlaylistRowForPlayback(inst, pl)
	return (cur + delta + n) % n
}

func playbackToTarget(pb *store.PlaylistPlayback) monitor.MonitorTarget {
	mode := monitor.MonitorMode(pb.Mode)
	if mode == "" {
		mode = monitor.ModeIndividual
	}
	if len(pb.Monitors) == 1 {
		return monitor.MonitorTarget{ID: pb.Monitors[0], Mode: mode}
	}
	return monitor.MonitorTarget{ID: "*", Mode: mode}
}

func (m *Manager) playlistStartIndices(pl *store.Playlist, opts startOpts) (timeSlots []TimeSlot, startIdx int, timerIdx []int, timerCur int) {
	pb := pl.Playback
	n := len(pl.Images)
	timerFromPB := func() ([]int, int) {
		if n == 0 || pb == nil {
			return nil, 0
		}
		if pl.Configuration.Type == "timer" && pl.Configuration.Order == "random" && len(pb.TimerIndices) == n {
			tIdx := append([]int(nil), pb.TimerIndices...)
			tCur := pb.TimerCursor
			if tCur < 0 || tCur >= len(tIdx) {
				tCur = 0
			}
			return tIdx, tCur
		}
		return nil, 0
	}

	// time_of_day: active row follows wall clock (legacy Node findClosestImageIndex).
	// Persisted playback.current_index must not override that when unpaused — it goes stale as
	// real time passes (e.g. index 3 at 18:48 while it is already 20:44 and slot 5 is current).
	if pl.Configuration.Type == "time_of_day" && n > 0 {
		timeSlots = buildTimeSlots(pl)
		tIdx, tCur := timerFromPB()
		if len(timeSlots) == 0 {
			return timeSlots, 0, tIdx, tCur
		}
		if pl.Configuration.AlwaysStartOnFirstImage {
			return timeSlots, 0, tIdx, tCur
		}
		if pb != nil && pb.Paused {
			return timeSlots, clampPlaylistIndex(pb.CurrentIndex, n), tIdx, tCur
		}
		return timeSlots, findClosestTimeSlot(timeSlots), tIdx, tCur
	}

	if opts.fromPersisted && pb != nil && n > 0 {
		tIdx, tCur := timerFromPB()
		return timeSlots, clampPlaylistIndex(pb.CurrentIndex, n), tIdx, tCur
	}
	timeSlots, startIdx = computeInitialState(pl)
	if !pl.Configuration.AlwaysStartOnFirstImage && pb != nil && n > 0 {
		tIdx, tCur := timerFromPB()
		return timeSlots, clampPlaylistIndex(pb.CurrentIndex, n), tIdx, tCur
	}
	return timeSlots, startIdx, nil, 0
}

func (m *Manager) buildPlayback(inst *store.ActivePlaylistInstance, pl *store.Playlist, run *playlistRun, wasRunning bool) *store.PlaylistPlayback {
	pb := &store.PlaylistPlayback{
		WasRunning:   wasRunning,
		CurrentIndex: resolvePlaylistRowForPlayback(inst, pl),
		Paused:       inst.Paused,
		Mode:         inst.Mode,
		Monitors:     append([]string(nil), inst.Monitors...),
	}
	if pl.Configuration.Type == "timer" && pl.Configuration.Order == "random" && run != nil {
		idx, cur, ok := TimerTraversalSnapshot(run.sched)
		if ok && len(idx) == len(pl.Images) {
			pb.TimerIndices = append([]int(nil), idx...)
			pb.TimerCursor = cur
		}
	}
	return pb
}

func (m *Manager) persistPlaybackWithInst(ctx context.Context, playlistID int, inst *store.ActivePlaylistInstance, wasRunning bool) {
	if inst == nil {
		return
	}
	pl, err := m.playlistStore.GetByID(ctx, playlistID)
	if err != nil {
		slog.Warn("playlist persist: load playlist failed", "playlist_id", playlistID, "error", err)
		return
	}
	m.mu.RLock()
	run := m.runs[playlistID]
	m.mu.RUnlock()
	pb := m.buildPlayback(inst, pl, run, wasRunning)
	if err := m.playlistStore.SavePlaybackState(ctx, playlistID, pb); err != nil {
		slog.Warn("playlist persist: save failed", "playlist_id", playlistID, "error", err)
	}
}

func (m *Manager) persistPlayback(ctx context.Context, playlistID int, wasRunning bool) {
	inst := m.stateStore.GetActivePlaylistByID(playlistID)
	m.persistPlaybackWithInst(ctx, playlistID, inst, wasRunning)
}

// RestorePersistedRuns starts every playlist whose playback.was_running is true.
// Graceful daemon shutdown uses Manager.Shutdown, which persists was_running=true before
// stopping runs. API StopAll persists was_running=false so explicit stop-all does not resume.
func (m *Manager) RestorePersistedRuns(ctx context.Context) error {
	playlists, err := m.playlistStore.GetAll(ctx)
	if err != nil {
		return err
	}
	for i := range playlists {
		pl := &playlists[i]
		if pl.Playback == nil || !pl.Playback.WasRunning || len(pl.Images) == 0 {
			continue
		}
		target := playbackToTarget(pl.Playback)
		if err := m.startPlaylist(ctx, pl.ID, target, startOpts{fromPersisted: true}); err != nil {
			slog.Warn("playlist restore failed", "playlist_id", pl.ID, "error", err)
		}
	}
	return nil
}
