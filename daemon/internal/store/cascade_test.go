package store_test

import (
	"context"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"waypaper-engine/daemon/internal/store"
	"waypaper-engine/daemon/internal/testutil"
)

func setupCascadeFixture(t *testing.T, imageID int) (store.DB, context.Context) {
	t.Helper()
	db := testutil.OpenTestDB(t)
	ctx := context.Background()

	img := testutil.SampleImage(0)
	created, err := db.ImageStore().Create(ctx, []store.Image{img})
	require.NoError(t, err)
	require.Len(t, created, 1)
	// The store auto-assigns ID 1. If caller wants a specific ID we just note it.
	_ = imageID
	return db, ctx
}

func TestPurgeImageReferences_MonitorState(t *testing.T) {
	db, ctx := setupCascadeFixture(t, 1)

	err := db.MonitorStateStore().Set(ctx, store.MonitorState{
		MonitorName: "DP-1",
		ImageID:     1,
		ImageName:   "foo.jpg",
		ImagePath:   "/tmp/foo.jpg",
		Mode:        "clone",
		Backend:     "hyprpaper",
		SetAt:       time.Now(),
	})
	require.NoError(t, err)

	result, err := store.PurgeImageReferences(ctx, 1,
		db.MonitorStateStore(), db.HistoryStore(), db.PlaylistStore())
	require.NoError(t, err)
	assert.Equal(t, []string{"DP-1"}, result.MonitorStatesPurged)

	st, err := db.MonitorStateStore().Get(ctx, "DP-1")
	require.NoError(t, err)
	assert.Nil(t, st, "monitor state should be removed")
}

func TestPurgeImageReferences_ImageHistory(t *testing.T) {
	db, ctx := setupCascadeFixture(t, 1)

	_, err := db.HistoryStore().Append(ctx, store.ImageHistoryEntry{
		ImageID:   1,
		ImageName: "foo.jpg",
		Monitors:  []string{"DP-1"},
		Mode:      "clone",
		SetAt:     time.Now(),
		Backend:   "hyprpaper",
	})
	require.NoError(t, err)
	// Add a second entry for a different image — should survive.
	_, err = db.HistoryStore().Append(ctx, store.ImageHistoryEntry{
		ImageID:   2,
		ImageName: "bar.jpg",
		Monitors:  []string{"DP-2"},
		Mode:      "clone",
		SetAt:     time.Now(),
		Backend:   "hyprpaper",
	})
	require.NoError(t, err)

	result, err := store.PurgeImageReferences(ctx, 1,
		db.MonitorStateStore(), db.HistoryStore(), db.PlaylistStore())
	require.NoError(t, err)
	assert.Equal(t, 1, result.HistoryEntriesPurged)

	// Only the entry for image 2 remains.
	entries, err := db.HistoryStore().GetRecent(ctx, store.HistoryQueryOpts{Limit: 100})
	require.NoError(t, err)
	require.Len(t, entries, 1)
	assert.Equal(t, 2, entries[0].ImageID)
}

func TestPurgeImageReferences_Playlists(t *testing.T) {
	db, ctx := setupCascadeFixture(t, 1)

	pl, err := db.PlaylistStore().Create(ctx, store.Playlist{
		Name: "test",
		Images: []store.PlaylistImage{
			{ImageID: 1, MediaType: "image"},
			{ImageID: 2, MediaType: "image"},
		},
	})
	require.NoError(t, err)

	result, err := store.PurgeImageReferences(ctx, 1,
		db.MonitorStateStore(), db.HistoryStore(), db.PlaylistStore())
	require.NoError(t, err)
	assert.Equal(t, []int{pl.ID}, result.PlaylistsAffected)

	updated, err := db.PlaylistStore().GetByID(ctx, pl.ID)
	require.NoError(t, err)
	require.Len(t, updated.Images, 1)
	assert.Equal(t, 2, updated.Images[0].ImageID)
}

func TestPurgeImageReferences_Idempotent(t *testing.T) {
	db, ctx := setupCascadeFixture(t, 1)

	err := db.MonitorStateStore().Set(ctx, store.MonitorState{
		MonitorName: "DP-1",
		ImageID:     1,
		ImageName:   "foo.jpg",
		ImagePath:   "/tmp/foo.jpg",
		Mode:        "clone",
		Backend:     "hyprpaper",
		SetAt:       time.Now(),
	})
	require.NoError(t, err)

	// First call — should purge.
	r1, err := store.PurgeImageReferences(ctx, 1,
		db.MonitorStateStore(), db.HistoryStore(), db.PlaylistStore())
	require.NoError(t, err)
	assert.Len(t, r1.MonitorStatesPurged, 1)

	// Second call — zero counts.
	r2, err := store.PurgeImageReferences(ctx, 1,
		db.MonitorStateStore(), db.HistoryStore(), db.PlaylistStore())
	require.NoError(t, err)
	assert.Empty(t, r2.MonitorStatesPurged)
	assert.Equal(t, 0, r2.HistoryEntriesPurged)
	assert.Empty(t, r2.PlaylistsAffected)
}

func TestPurgeImageReferences_NoReferences(t *testing.T) {
	db, ctx := setupCascadeFixture(t, 1)

	result, err := store.PurgeImageReferences(ctx, 99,
		db.MonitorStateStore(), db.HistoryStore(), db.PlaylistStore())
	require.NoError(t, err)
	assert.Empty(t, result.MonitorStatesPurged)
	assert.Equal(t, 0, result.HistoryEntriesPurged)
	assert.Empty(t, result.PlaylistsAffected)
}

func TestPurgeImageReferences_AllThreeCollections(t *testing.T) {
	db, ctx := setupCascadeFixture(t, 1)

	// Populate all three collections.
	require.NoError(t, db.MonitorStateStore().Set(ctx, store.MonitorState{
		MonitorName: "HDMI-1",
		ImageID:     1,
		ImageName:   "foo.jpg",
		ImagePath:   "/tmp/foo.jpg",
		Mode:        "clone",
		Backend:     "swaybg",
		SetAt:       time.Now(),
	}))
	_, err := db.HistoryStore().Append(ctx, store.ImageHistoryEntry{
		ImageID:   1,
		ImageName: "foo.jpg",
		Monitors:  []string{"HDMI-1"},
		Mode:      "clone",
		SetAt:     time.Now(),
		Backend:   "swaybg",
	})
	require.NoError(t, err)
	pl, err := db.PlaylistStore().Create(ctx, store.Playlist{
		Name: "all-test",
		Images: []store.PlaylistImage{
			{ImageID: 1, MediaType: "image"},
		},
	})
	require.NoError(t, err)

	result, err := store.PurgeImageReferences(ctx, 1,
		db.MonitorStateStore(), db.HistoryStore(), db.PlaylistStore())
	require.NoError(t, err)
	assert.Equal(t, []string{"HDMI-1"}, result.MonitorStatesPurged)
	assert.Equal(t, 1, result.HistoryEntriesPurged)
	assert.Equal(t, []int{pl.ID}, result.PlaylistsAffected)

	// Verify all cleared.
	st, err := db.MonitorStateStore().Get(ctx, "HDMI-1")
	require.NoError(t, err)
	assert.Nil(t, st)

	entries, err := db.HistoryStore().GetRecent(ctx, store.HistoryQueryOpts{Limit: 100})
	require.NoError(t, err)
	assert.Empty(t, entries)

	updated, err := db.PlaylistStore().GetByID(ctx, pl.ID)
	require.NoError(t, err)
	assert.Empty(t, updated.Images)
}
