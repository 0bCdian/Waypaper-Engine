package playlist

import (
	"context"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"waypaper-engine/daemon/internal/backend"
	"waypaper-engine/daemon/internal/monitor"
	"waypaper-engine/daemon/internal/store"
)

// TestReconcileAfterPlaylistUpdate_InsertAndReorder verifies that after adding
// images and reordering a running ordered-timer playlist, the next tick shows
// the image that immediately follows the current image in the NEW order.
//
// Scenario (mirrors the user report):
//   - Playlist starts as [img1, img2, img3]. Currently showing img2 (CurrentIndex=1).
//   - User saves reordered list: [img1, img2, img4, img5, img3].
//   - After reconcile, the scheduler must show img4 next (index 2 in new list),
//     NOT jump over img4+img5 to img3.
func TestReconcileAfterPlaylistUpdate_InsertAndReorder(t *testing.T) {
	ctx := context.Background()

	images := map[int]*store.Image{
		1: {ID: 1, Path: "/1.jpg", MediaType: "image"},
		2: {ID: 2, Path: "/2.jpg", MediaType: "image"},
		3: {ID: 3, Path: "/3.jpg", MediaType: "image"},
		4: {ID: 4, Path: "/4.jpg", MediaType: "image"},
		5: {ID: 5, Path: "/5.jpg", MediaType: "image"},
	}

	pl := &store.Playlist{
		ID:   1,
		Name: "test",
		Images: []store.PlaylistImage{
			{ImageID: 1, MediaType: "image"},
			{ImageID: 2, MediaType: "image"},
			{ImageID: 3, MediaType: "image"},
		},
		Configuration: store.PlaylistConfiguration{
			Type:     "timer",
			Interval: 3600, // long interval — ticks won't fire during test
			Order:    "ordered",
		},
	}

	rec := &recordingBackend{}
	playlistStore := newInMemPlaylistStore(pl)
	stateStore := newInMemStateStore()
	monMgr := &staticMonitorManager{monitors: []monitor.Monitor{{Name: "DP-1"}}}

	mgr := NewManager(
		playlistStore,
		stateStore,
		&noopHistoryStore{},
		&stubImageStore{images: images},
		&noopMonitorStateStore{},
		&simpleRegistry{active: rec},
		monMgr,
		&noopBus{},
		nil,
		&noopConfig{},
	)

	// Start: applies img1 (index 0).
	target := monitor.MonitorTarget{ID: "DP-1", Mode: monitor.ModeIndividual}
	require.NoError(t, mgr.Start(ctx, 1, target))

	rec.mu.Lock()
	require.Len(t, rec.calls, 1)
	assert.Equal(t, "/1.jpg", rec.calls[0].ImagePath, "startPlaylist should apply first image")
	rec.mu.Unlock()

	// Simulate state after scheduler advanced once: currently on img2 (CurrentIndex=1).
	stateStore.UpdateActivePlaylist(1, func(inst *store.ActivePlaylistInstance) {
		inst.CurrentIndex = 1
		inst.CurrentImageID = 2 // img2.ID
	})

	// Update playlist in store: insert img4, img5 between img2 and img3.
	playlistStore.mu.Lock()
	playlistStore.playlists[1].Images = []store.PlaylistImage{
		{ImageID: 1, MediaType: "image"},
		{ImageID: 2, MediaType: "image"},
		{ImageID: 4, MediaType: "image"},
		{ImageID: 5, MediaType: "image"},
		{ImageID: 3, MediaType: "image"},
	}
	playlistStore.mu.Unlock()

	rec.mu.Lock()
	rec.calls = nil
	rec.mu.Unlock()

	// Reconcile: should re-apply img2 (current image) and set up scheduler at index 1.
	require.NoError(t, mgr.ReconcileAfterPlaylistUpdate(ctx, 1))

	rec.mu.Lock()
	require.Len(t, rec.calls, 1, "reconcile must re-apply the current image")
	assert.Equal(t, "/2.jpg", rec.calls[0].ImagePath, "reconcile must re-apply img2 (no visual change)")
	rec.mu.Unlock()

	// Verify scheduler currentIndex = 1 so the next natural tick goes to index 2 = img4.
	mgr.mu.RLock()
	run := mgr.runs[1]
	mgr.mu.RUnlock()
	require.NotNil(t, run, "playlist run must still be active after reconcile")

	ts, ok := run.sched.(*timerScheduler)
	require.True(t, ok)

	ts.mu.Lock()
	schedIdx := ts.currentIndex
	schedIndices := append([]int(nil), ts.indices...)
	ts.mu.Unlock()

	assert.Equal(t, 1, schedIdx, "scheduler.currentIndex must equal img2's slot (1) in the new 5-image list")
	nextPos := (schedIdx + 1) % len(schedIndices)
	assert.Equal(t, 2, schedIndices[nextPos], "next tick index must be 2 (img4)")

	// Also confirm active playlist state is correct.
	inst := stateStore.GetActivePlaylistByID(1)
	require.NotNil(t, inst)
	assert.Equal(t, 1, inst.CurrentIndex, "active state CurrentIndex must point to img2's slot")
	assert.Equal(t, 2, inst.CurrentImageID, "active state CurrentImageID must be img2's ID")
}

// TestReconcileAfterPlaylistUpdate_CurrentImageMovedSlot verifies correct
// behaviour when the current image is moved to a different slot (pure reorder,
// no insertions).
//
// Playlist [img1, img2, img3] currently at img3 (index 2).
// After reorder: [img3, img1, img2].  img3 is now at index 0.
// Next tick should follow the new order: img1 (index 1).
func TestReconcileAfterPlaylistUpdate_CurrentImageMovedSlot(t *testing.T) {
	ctx := context.Background()

	images := map[int]*store.Image{
		1: {ID: 1, Path: "/1.jpg", MediaType: "image"},
		2: {ID: 2, Path: "/2.jpg", MediaType: "image"},
		3: {ID: 3, Path: "/3.jpg", MediaType: "image"},
	}

	pl := &store.Playlist{
		ID:   2,
		Name: "reorder-test",
		Images: []store.PlaylistImage{
			{ImageID: 1, MediaType: "image"},
			{ImageID: 2, MediaType: "image"},
			{ImageID: 3, MediaType: "image"},
		},
		Configuration: store.PlaylistConfiguration{
			Type:     "timer",
			Interval: 3600,
			Order:    "ordered",
		},
	}

	rec := &recordingBackend{}
	playlistStore := newInMemPlaylistStore(pl)
	stateStore := newInMemStateStore()
	monMgr := &staticMonitorManager{monitors: []monitor.Monitor{{Name: "DP-1"}}}

	mgr := NewManager(
		playlistStore, stateStore, &noopHistoryStore{},
		&stubImageStore{images: images}, &noopMonitorStateStore{},
		&simpleRegistry{active: rec}, monMgr, &noopBus{}, nil, &noopConfig{},
	)

	require.NoError(t, mgr.Start(ctx, 2, monitor.MonitorTarget{ID: "DP-1", Mode: monitor.ModeIndividual}))

	// Simulate: currently at img3 (index 2 in old list).
	stateStore.UpdateActivePlaylist(2, func(inst *store.ActivePlaylistInstance) {
		inst.CurrentIndex = 2
		inst.CurrentImageID = 3
	})

	// Reorder: [img3, img1, img2] — img3 moved to slot 0.
	playlistStore.mu.Lock()
	playlistStore.playlists[2].Images = []store.PlaylistImage{
		{ImageID: 3, MediaType: "image"},
		{ImageID: 1, MediaType: "image"},
		{ImageID: 2, MediaType: "image"},
	}
	playlistStore.mu.Unlock()

	rec.mu.Lock()
	rec.calls = nil
	rec.mu.Unlock()

	require.NoError(t, mgr.ReconcileAfterPlaylistUpdate(ctx, 2))

	rec.mu.Lock()
	require.Len(t, rec.calls, 1)
	assert.Equal(t, "/3.jpg", rec.calls[0].ImagePath, "reconcile must re-apply img3 (now at slot 0)")
	rec.mu.Unlock()

	mgr.mu.RLock()
	run := mgr.runs[2]
	mgr.mu.RUnlock()
	require.NotNil(t, run)

	ts, ok := run.sched.(*timerScheduler)
	require.True(t, ok)

	ts.mu.Lock()
	schedIdx := ts.currentIndex
	schedIndices := append([]int(nil), ts.indices...)
	ts.mu.Unlock()

	// img3 is now at slot 0; scheduler must reflect that.
	assert.Equal(t, 0, schedIdx, "scheduler.currentIndex must equal img3's new slot (0)")
	nextPos := (schedIdx + 1) % len(schedIndices)
	assert.Equal(t, 1, schedIndices[nextPos], "next tick must be slot 1 = img1 in new order")
}

// TestReconcileAfterPlaylistUpdate_ShortInterval_TickShowsNextImage is an
// end-to-end timing test: it sets a very short scheduler interval and lets the
// timer fire naturally, verifying the first post-reconcile tick shows img4.
func TestReconcileAfterPlaylistUpdate_ShortInterval_TickShowsNextImage(t *testing.T) {
	ctx := context.Background()

	images := map[int]*store.Image{
		1: {ID: 1, Path: "/1.jpg", MediaType: "image"},
		2: {ID: 2, Path: "/2.jpg", MediaType: "image"},
		3: {ID: 3, Path: "/3.jpg", MediaType: "image"},
		4: {ID: 4, Path: "/4.jpg", MediaType: "image"},
		5: {ID: 5, Path: "/5.jpg", MediaType: "image"},
	}

	pl := &store.Playlist{
		ID:   3,
		Name: "timing-test",
		Images: []store.PlaylistImage{
			{ImageID: 1, MediaType: "image"},
			{ImageID: 2, MediaType: "image"},
			{ImageID: 3, MediaType: "image"},
		},
		Configuration: store.PlaylistConfiguration{
			Type:     "timer",
			Interval: 3600,
			Order:    "ordered",
		},
	}

	rec := &recordingBackend{}
	playlistStore := newInMemPlaylistStore(pl)
	stateStore := newInMemStateStore()
	monMgr := &staticMonitorManager{monitors: []monitor.Monitor{{Name: "DP-1"}}}

	mgr := NewManager(
		playlistStore, stateStore, &noopHistoryStore{},
		&stubImageStore{images: images}, &noopMonitorStateStore{},
		&simpleRegistry{active: rec}, monMgr, &noopBus{}, nil, &noopConfig{},
	)

	require.NoError(t, mgr.Start(ctx, 3, monitor.MonitorTarget{ID: "DP-1", Mode: monitor.ModeIndividual}))

	// Simulate currently at img2 (index 1).
	stateStore.UpdateActivePlaylist(3, func(inst *store.ActivePlaylistInstance) {
		inst.CurrentIndex = 1
		inst.CurrentImageID = 2
	})

	// Update playlist: [img1, img2, img4, img5, img3].
	playlistStore.mu.Lock()
	playlistStore.playlists[3].Images = []store.PlaylistImage{
		{ImageID: 1, MediaType: "image"},
		{ImageID: 2, MediaType: "image"},
		{ImageID: 4, MediaType: "image"},
		{ImageID: 5, MediaType: "image"},
		{ImageID: 3, MediaType: "image"},
	}
	playlistStore.mu.Unlock()

	require.NoError(t, mgr.ReconcileAfterPlaylistUpdate(ctx, 3))

	// After reconcile, override the scheduler interval to trigger ticks fast.
	mgr.mu.RLock()
	run := mgr.runs[3]
	mgr.mu.RUnlock()
	require.NotNil(t, run)

	ts, ok := run.sched.(*timerScheduler)
	require.True(t, ok)

	ts.mu.Lock()
	ts.interval = 20 * time.Millisecond
	ts.mu.Unlock()

	// Wait for at least one tick beyond the reconcile re-apply.
	deadline := time.Now().Add(500 * time.Millisecond)
	var img4Seen bool
	for time.Now().Before(deadline) {
		time.Sleep(30 * time.Millisecond)
		rec.mu.Lock()
		calls := append([]backend.WallpaperRequest(nil), rec.calls...)
		rec.mu.Unlock()
		// calls[0] = startPlaylist img1, calls[1] = reconcile img2, calls[2+] = ticks
		for i := 2; i < len(calls); i++ {
			if calls[i].ImagePath == "/4.jpg" {
				img4Seen = true
				break
			}
			// Any call that is NOT img4 before img4 is a bug (img4+img5 skipped).
			if calls[i].ImagePath != "/2.jpg" {
				t.Errorf("unexpected image before img4: got %s, want /4.jpg", calls[i].ImagePath)
				return
			}
		}
		if img4Seen {
			break
		}
	}

	assert.True(t, img4Seen, "first tick after reconcile must show img4 (/4.jpg)")
}
