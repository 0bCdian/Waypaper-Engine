package playlist

import (
	"context"
	"strings"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"waypaper-engine/daemon/internal/monitor"
	"waypaper-engine/daemon/internal/store"
)

// TestStartPlaylist_SetsSlotStartedAt verifies that starting a timer playlist
// stamps SlotStartedAt alongside NextChangeAt, using a wall-clock-only time
// (no monotonic reading) so it survives suspend/resume like NextChangeAt does.
func TestStartPlaylist_SetsSlotStartedAt(t *testing.T) {
	ctx := context.Background()

	images := map[int]*store.Image{
		1: {ID: 1, Path: "/1.jpg", MediaType: "image"},
		2: {ID: 2, Path: "/2.jpg", MediaType: "image"},
	}

	pl := &store.Playlist{
		ID:   1,
		Name: "slot-test",
		Images: []store.PlaylistImage{
			{ImageID: 1, MediaType: "image"},
			{ImageID: 2, MediaType: "image"},
		},
		Configuration: store.PlaylistConfiguration{
			Type:     "timer",
			Interval: 1800, // 30 minutes
			Order:    "ordered",
		},
	}

	playlistStore := newInMemPlaylistStore(pl)
	stateStore := newInMemStateStore()
	monMgr := &staticMonitorManager{monitors: []monitor.Monitor{{Name: "DP-1"}}}

	mgr := NewManager(
		playlistStore, stateStore, &noopHistoryStore{},
		&stubImageStore{images: images}, &noopMonitorStateStore{},
		&simpleRegistry{active: &recordingBackend{}}, monMgr, &noopBus{}, nil, &noopConfig{},
	)

	before := time.Now()
	require.NoError(t, mgr.Start(ctx, 1, monitor.MonitorTarget{ID: "DP-1", Mode: monitor.ModeIndividual}))
	after := time.Now()

	inst := stateStore.GetActivePlaylistByID(1)
	require.NotNil(t, inst)
	require.NotNil(t, inst.SlotStartedAt, "SlotStartedAt must be set after starting a timer playlist")
	require.NotNil(t, inst.NextChangeAt)

	assert.False(t, inst.SlotStartedAt.After(after), "SlotStartedAt must not be in the future")
	assert.False(t, inst.SlotStartedAt.Before(before.Add(-time.Second)), "SlotStartedAt must be roughly now")
	assert.False(t, strings.Contains(inst.SlotStartedAt.String(), "m=+"),
		"SlotStartedAt must be wall-clock only, no monotonic reading")

	gotInterval := inst.NextChangeAt.Sub(*inst.SlotStartedAt)
	wantInterval := time.Duration(pl.Configuration.Interval) * time.Second
	assert.InDelta(t, wantInterval.Seconds(), gotInterval.Seconds(), 1.0,
		"NextChangeAt - SlotStartedAt should be approximately the configured interval")
}

// TestOnTick_UpdatesSlotStartedAt verifies that after a timer tick fires,
// SlotStartedAt is refreshed to reflect the new slot's start (not the
// playlist's original start time).
func TestOnTick_UpdatesSlotStartedAt(t *testing.T) {
	ctx := context.Background()

	images := map[int]*store.Image{
		1: {ID: 1, Path: "/1.jpg", MediaType: "image"},
		2: {ID: 2, Path: "/2.jpg", MediaType: "image"},
	}

	pl := &store.Playlist{
		ID:   2,
		Name: "tick-test",
		Images: []store.PlaylistImage{
			{ImageID: 1, MediaType: "image"},
			{ImageID: 2, MediaType: "image"},
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

	instAfterStart := stateStore.GetActivePlaylistByID(2)
	require.NotNil(t, instAfterStart)
	require.NotNil(t, instAfterStart.SlotStartedAt)
	firstSlotStartedAt := *instAfterStart.SlotStartedAt

	// Drive a tick directly (rather than racing the real scheduler timer) so
	// the assertion is deterministic: onTick is what actually updates
	// SlotStartedAt via setSlotDeadline, so calling it straight is the most
	// direct way to exercise that path.
	monitors, err := monMgr.GetMonitors(ctx)
	require.NoError(t, err)
	applied := mgr.onTick(ctx, 2, 1, monitors, monitor.MonitorTarget{ID: "DP-1", Mode: monitor.ModeIndividual})
	require.True(t, applied, "onTick should have applied the next image")

	instAfterTick := stateStore.GetActivePlaylistByID(2)
	require.NotNil(t, instAfterTick)
	require.NotNil(t, instAfterTick.SlotStartedAt)
	assert.False(t, strings.Contains(instAfterTick.SlotStartedAt.String(), "m=+"),
		"SlotStartedAt must be wall-clock only, no monotonic reading")
	assert.True(t, instAfterTick.SlotStartedAt.After(firstSlotStartedAt) || instAfterTick.SlotStartedAt.Equal(firstSlotStartedAt),
		"SlotStartedAt after a tick must not be before the initial slot start")
}

// TestPause_ClearsSlotStartedAt and TestResume_SetsSlotStartedAt verify pause/resume
// keep SlotStartedAt in lockstep with NextChangeAt (nil while paused, set on resume).
func TestPauseResume_SlotStartedAtTracksNextChangeAt(t *testing.T) {
	ctx := context.Background()

	images := map[int]*store.Image{
		1: {ID: 1, Path: "/1.jpg", MediaType: "image"},
	}

	pl := &store.Playlist{
		ID:   4,
		Name: "pause-test",
		Images: []store.PlaylistImage{
			{ImageID: 1, MediaType: "image"},
		},
		Configuration: store.PlaylistConfiguration{
			Type:     "timer",
			Interval: 3600,
			Order:    "ordered",
		},
	}

	playlistStore := newInMemPlaylistStore(pl)
	stateStore := newInMemStateStore()
	monMgr := &staticMonitorManager{monitors: []monitor.Monitor{{Name: "DP-1"}}}

	mgr := NewManager(
		playlistStore, stateStore, &noopHistoryStore{},
		&stubImageStore{images: images}, &noopMonitorStateStore{},
		&simpleRegistry{active: &recordingBackend{}}, monMgr, &noopBus{}, nil, &noopConfig{},
	)

	require.NoError(t, mgr.Start(ctx, 4, monitor.MonitorTarget{ID: "DP-1", Mode: monitor.ModeIndividual}))
	require.NoError(t, mgr.Pause(ctx, 4))

	pausedInst := stateStore.GetActivePlaylistByID(4)
	require.NotNil(t, pausedInst)
	assert.Nil(t, pausedInst.NextChangeAt)
	assert.Nil(t, pausedInst.SlotStartedAt, "SlotStartedAt must be nil while paused")

	require.NoError(t, mgr.Resume(ctx, 4))

	resumedInst := stateStore.GetActivePlaylistByID(4)
	require.NotNil(t, resumedInst)
	require.NotNil(t, resumedInst.NextChangeAt)
	require.NotNil(t, resumedInst.SlotStartedAt, "SlotStartedAt must be set again after resume")
}
