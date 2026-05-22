package playlist

import (
	"context"
	"errors"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"waypaper-engine/daemon/internal/monitor"
	"waypaper-engine/daemon/internal/store"
)

func intPtr(v int) *int { return &v }

func TestNext_RejectsTimeOfDayAndDayOfWeek(t *testing.T) {
	ctx := context.Background()

	images := map[int]*store.Image{
		1: {ID: 1, Path: "/1.jpg", MediaType: "image"},
		2: {ID: 2, Path: "/2.jpg", MediaType: "image"},
	}

	for _, tc := range []struct {
		name string
		pl   *store.Playlist
	}{
		{
			name: "time_of_day",
			pl: &store.Playlist{
				ID:   10,
				Name: "tod",
				Images: []store.PlaylistImage{
					{ImageID: 1, MediaType: "image", Time: intPtr(100)},
					{ImageID: 2, MediaType: "image", Time: intPtr(200)},
				},
				Configuration: store.PlaylistConfiguration{Type: "time_of_day", Order: "ordered"},
			},
		},
		{
			name: "day_of_week",
			pl: &store.Playlist{
				ID:   11,
				Name: "dow",
				Images: []store.PlaylistImage{
					{ImageID: 1, MediaType: "image"},
					{ImageID: 2, MediaType: "image"},
				},
				Configuration: store.PlaylistConfiguration{Type: "day_of_week", Order: "ordered"},
			},
		},
	} {
		t.Run(tc.name, func(t *testing.T) {
			playlistStore := newInMemPlaylistStore(tc.pl)
			stateStore := newInMemStateStore()
			monMgr := &staticMonitorManager{monitors: []monitor.Monitor{{Name: "DP-1"}}}
			mgr := NewManager(
				playlistStore, stateStore, &noopHistoryStore{},
				&stubImageStore{images: images}, &noopMonitorStateStore{},
				&simpleRegistry{active: &recordingBackend{}}, monMgr, &noopBus{}, nil, &noopConfig{},
			)

			require.NoError(t, mgr.Start(ctx, tc.pl.ID, monitor.MonitorTarget{ID: "DP-1", Mode: monitor.ModeIndividual}))

			err := mgr.Next(ctx, tc.pl.ID)
			require.Error(t, err)
			assert.True(t, errors.Is(err, ErrManualAdvanceNotAllowed))

			err = mgr.Previous(ctx, tc.pl.ID)
			require.Error(t, err)
			assert.True(t, errors.Is(err, ErrManualAdvanceNotAllowed))
		})
	}
}

func TestNextAll_MixedSkipsScheduleOnly(t *testing.T) {
	ctx := context.Background()

	images := map[int]*store.Image{
		1: {ID: 1, Path: "/1.jpg", MediaType: "image"},
		2: {ID: 2, Path: "/2.jpg", MediaType: "image"},
		3: {ID: 3, Path: "/3.jpg", MediaType: "image"},
		4: {ID: 4, Path: "/4.jpg", MediaType: "image"},
	}

	plTimer := &store.Playlist{
		ID:   1,
		Name: "timer",
		Images: []store.PlaylistImage{
			{ImageID: 1, MediaType: "image"},
			{ImageID: 2, MediaType: "image"},
		},
		Configuration: store.PlaylistConfiguration{Type: "timer", Interval: 3600, Order: "ordered"},
	}
	plTod := &store.Playlist{
		ID:   2,
		Name: "tod",
		Images: []store.PlaylistImage{
			{ImageID: 3, MediaType: "image", Time: intPtr(100)},
			{ImageID: 4, MediaType: "image", Time: intPtr(200)},
		},
		Configuration: store.PlaylistConfiguration{Type: "time_of_day", Order: "ordered"},
	}

	playlistStore := newInMemPlaylistStore(plTimer, plTod)
	stateStore := newInMemStateStore()
	monMgr := &staticMonitorManager{monitors: []monitor.Monitor{
		{Name: "DP-1"},
		{Name: "HDMI-A-1"},
	}}
	mgr := NewManager(
		playlistStore, stateStore, &noopHistoryStore{},
		&stubImageStore{images: images}, &noopMonitorStateStore{},
		&simpleRegistry{active: &recordingBackend{}}, monMgr, &noopBus{}, nil, &noopConfig{},
	)

	require.NoError(t, mgr.Start(ctx, 1, monitor.MonitorTarget{ID: "DP-1", Mode: monitor.ModeIndividual}))
	require.NoError(t, mgr.Start(ctx, 2, monitor.MonitorTarget{ID: "HDMI-A-1", Mode: monitor.ModeIndividual}))

	n, err := mgr.NextAll(ctx)
	require.NoError(t, err)
	assert.Equal(t, 1, n)
}

func TestNextAll_AllSchedulePlaylistsReturnsErr(t *testing.T) {
	ctx := context.Background()

	images := map[int]*store.Image{
		1: {ID: 1, Path: "/1.jpg", MediaType: "image"},
		2: {ID: 2, Path: "/2.jpg", MediaType: "image"},
		3: {ID: 3, Path: "/3.jpg", MediaType: "image"},
		4: {ID: 4, Path: "/4.jpg", MediaType: "image"},
	}

	a := &store.Playlist{
		ID:   1,
		Name: "a",
		Images: []store.PlaylistImage{
			{ImageID: 1, MediaType: "image", Time: intPtr(100)},
			{ImageID: 2, MediaType: "image", Time: intPtr(200)},
		},
		Configuration: store.PlaylistConfiguration{Type: "time_of_day", Order: "ordered"},
	}
	b := &store.Playlist{
		ID:   2,
		Name: "b",
		Images: []store.PlaylistImage{
			{ImageID: 3, MediaType: "image", Time: intPtr(300)},
			{ImageID: 4, MediaType: "image", Time: intPtr(400)},
		},
		Configuration: store.PlaylistConfiguration{Type: "time_of_day", Order: "ordered"},
	}

	playlistStore := newInMemPlaylistStore(a, b)
	stateStore := newInMemStateStore()
	monMgr := &staticMonitorManager{monitors: []monitor.Monitor{
		{Name: "DP-1"},
		{Name: "HDMI-A-1"},
	}}
	mgr := NewManager(
		playlistStore, stateStore, &noopHistoryStore{},
		&stubImageStore{images: images}, &noopMonitorStateStore{},
		&simpleRegistry{active: &recordingBackend{}}, monMgr, &noopBus{}, nil, &noopConfig{},
	)

	require.NoError(t, mgr.Start(ctx, 1, monitor.MonitorTarget{ID: "DP-1", Mode: monitor.ModeIndividual}))
	require.NoError(t, mgr.Start(ctx, 2, monitor.MonitorTarget{ID: "HDMI-A-1", Mode: monitor.ModeIndividual}))

	_, err := mgr.NextAll(ctx)
	require.Error(t, err)
	assert.True(t, errors.Is(err, ErrManualAdvanceNotAllowed))
}

func TestNextAll_NoActivePlaylists(t *testing.T) {
	ctx := context.Background()
	pl := &store.Playlist{
		ID:   1,
		Name: "x",
		Images: []store.PlaylistImage{
			{ImageID: 1, MediaType: "image"},
		},
		Configuration: store.PlaylistConfiguration{Type: "timer", Interval: 60, Order: "ordered"},
	}
	mgr := NewManager(
		newInMemPlaylistStore(pl), newInMemStateStore(), &noopHistoryStore{},
		&stubImageStore{images: map[int]*store.Image{1: {ID: 1, Path: "/1.jpg", MediaType: "image"}}},
		&noopMonitorStateStore{},
		&simpleRegistry{active: &recordingBackend{}},
		&staticMonitorManager{monitors: []monitor.Monitor{{Name: "DP-1"}}},
		&noopBus{}, nil, &noopConfig{},
	)
	n, err := mgr.NextAll(ctx)
	require.NoError(t, err)
	assert.Equal(t, 0, n)
}
