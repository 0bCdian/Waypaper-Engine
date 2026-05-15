package store

import (
	"context"
	"fmt"
	"time"

	"github.com/ostafen/clover/v2/query"
)

// PurgeResult holds the counts of references removed by PurgeImageReferences.
type PurgeResult struct {
	ImageID              int
	MonitorStatesPurged  []string // monitor names
	HistoryEntriesPurged int
	PlaylistsAffected    []int // playlist IDs modified
}

// PurgeImageReferences removes all DB references to imageID from monitor_state,
// image_history, and playlists.images[]. It is idempotent: calling twice with
// the same ID returns zero counts on the second call.
func PurgeImageReferences(
	ctx context.Context,
	imageID int,
	monStateStore MonitorStateStore,
	histStore HistoryStore,
	playlistStore PlaylistStore,
) (PurgeResult, error) {
	result := PurgeResult{ImageID: imageID}

	// --- monitor_state ---
	states, err := monStateStore.GetAll(ctx)
	if err != nil {
		return result, fmt.Errorf("cascade: get monitor states: %w", err)
	}
	for _, st := range states {
		if st.ImageID != imageID {
			continue
		}
		if rmErr := monStateStore.Remove(ctx, st.MonitorName); rmErr != nil {
			return result, fmt.Errorf("cascade: remove monitor state %q: %w", st.MonitorName, rmErr)
		}
		result.MonitorStatesPurged = append(result.MonitorStatesPurged, st.MonitorName)
	}

	// --- image_history ---
	// historyStore doesn't expose a DeleteByImageID method; access CloverDB directly
	// through the concrete implementation. We need to operate at the store package
	// level so we can use the underlying concrete type.
	if hs, ok := histStore.(*historyStore); ok {
		q := query.NewQuery(CollectionHistory).Where(query.Field("image_id").Eq(imageID))
		count, err := hs.db.Count(q)
		if err != nil {
			return result, fmt.Errorf("cascade: count history for image %d: %w", imageID, err)
		}
		if count > 0 {
			if err := hs.db.Delete(q); err != nil {
				return result, fmt.Errorf("cascade: delete history for image %d: %w", imageID, err)
			}
			result.HistoryEntriesPurged = count
		}
	}

	// --- playlists.images[] ---
	playlists, err := playlistStore.GetAll(ctx)
	if err != nil {
		return result, fmt.Errorf("cascade: get playlists: %w", err)
	}
	for _, pl := range playlists {
		filtered := make([]PlaylistImage, 0, len(pl.Images))
		for _, pi := range pl.Images {
			if pi.ImageID != imageID {
				filtered = append(filtered, pi)
			}
		}
		if len(filtered) == len(pl.Images) {
			continue // no change
		}
		_, err := playlistStore.Update(ctx, pl.ID, map[string]any{
			"images":     jsonValue(filtered),
			"updated_at": time.Now(),
		})
		if err != nil {
			return result, fmt.Errorf("cascade: update playlist %d: %w", pl.ID, err)
		}
		result.PlaylistsAffected = append(result.PlaylistsAffected, pl.ID)
	}

	return result, nil
}
