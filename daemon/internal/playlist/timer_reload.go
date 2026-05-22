package playlist

import (
	"context"
	"log/slog"

	"waypaper-engine/daemon/internal/store"
)

// timerReloadAfterPlaylistDocumentChange rebuilds the timer scheduler after the persisted playlist
// document changed (PATCH). Same role as legacy Node updatePlaylist() → reload rows from DB,
// timedPlaylist(firstPlay): stop old interval, re-apply the current slide from the new images[]
// slice, install a fresh scheduler.
//
// anchorRow is the playlist row to apply first — typically from resolvePlaylistRowForPlayback so the
// same image stays on screen after reorder (WYSIWYG).
func (m *Manager) timerReloadAfterPlaylistDocumentChange(
	ctx context.Context,
	playlistID int,
	pl *store.Playlist,
	anchorRow int,
	inst *store.ActivePlaylistInstance,
) error {
	startIdx, tIdx, tCur := timerReconcileSchedulerConfig(pl.Configuration.Order, len(pl.Images), anchorRow)

	newSched := NewScheduler(SchedulerConfig{
		Type:         "timer",
		Interval:     pl.Configuration.Interval,
		Order:        pl.Configuration.Order,
		TotalImages:  len(pl.Images),
		StartIndex:   startIdx,
		TimeSlots:    nil,
		TimerIndices: tIdx,
		TimerCursor:  tCur,
	})

	m.mu.Lock()
	run := m.runs[playlistID]
	if run == nil {
		m.mu.Unlock()
		slog.Warn("playlist reconcile aborted (run disappeared during reconcile)",
			"playlist_id", playlistID)
		return nil
	}
	oldSched := run.sched
	monitors := run.monitors
	target := run.target
	playCtx := run.playCtx
	m.mu.Unlock()

	oldSched.Stop()

	res, applyErr := m.applyImage(ctx, pl, anchorRow, monitors, target.Mode, compatForward)
	row := anchorRow
	if applyErr != nil {
		slog.Warn("playlist reconcile: apply image", "playlist_id", playlistID, "error", applyErr)
	} else if res.AppliedIndex >= 0 {
		row = res.AppliedIndex
	}

	slog.Debug("playlist timer reload after PATCH",
		"playlist_id", playlistID,
		"anchor_row", anchorRow,
		"effective_row", row,
		"apply_failed", applyErr != nil,
		"n_images", len(pl.Images),
		"order", pl.Configuration.Order)

	m.mu.Lock()
	run = m.runs[playlistID]
	if run == nil {
		slog.Warn("playlist reconcile aborted after apply (run disappeared)",
			"playlist_id", playlistID)
		m.mu.Unlock()
		return nil
	}
	run.sched = newSched
	m.mu.Unlock()

	if shIdx, shCur, okShuffle := TimerTraversalSnapshot(newSched); okShuffle {
		slog.Debug("playlist timer reload shuffle snapshot",
			"playlist_id", playlistID,
			"shuffle_cursor", shCur,
			"shuffle_indices", shIdx)
	}

	pid := playlistID
	newSched.Start(func(index int) bool {
		return m.onTick(playCtx, pid, index, monitors, target)
	})

	paused := inst.Paused
	if paused {
		newSched.Pause()
	}

	nextAt := newSched.NextChangeAt()
	if paused {
		nextAt = nil
	}

	m.stateStore.UpdateActivePlaylist(playlistID, func(upd *store.ActivePlaylistInstance) {
		upd.PlaylistName = pl.Name
		upd.TotalImages = len(pl.Images)
		updateInstanceIndex(upd, pl, row)
		upd.NextChangeAt = nextAt
	})

	m.persistPlayback(ctx, playlistID, true)

	slog.Debug("playlist timer reload done",
		"playlist_id", playlistID,
		"paused", paused,
		"next_change_at", nextAt)

	return nil
}
