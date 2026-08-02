package playlist

import (
	"context"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"waypaper-engine/daemon/internal/monitor"
	"waypaper-engine/daemon/internal/store"
)

func newTargetTestManager(t *testing.T, connected ...string) (*Manager, *inMemPlaylistStore, *inMemStateStore) {
	t.Helper()

	pl := &store.Playlist{
		ID:   1,
		Name: "declared",
		Images: []store.PlaylistImage{
			{ImageID: 10, MediaType: "image"},
		},
		Configuration: store.PlaylistConfiguration{
			Type:     "timer",
			Interval: 3600,
			Order:    "ordered",
		},
	}

	monitors := make([]monitor.Monitor, 0, len(connected))
	for _, name := range connected {
		monitors = append(monitors, monitor.Monitor{Name: name})
	}

	playlistStore := newInMemPlaylistStore(pl)
	stateStore := newInMemStateStore()

	mgr := NewManager(
		playlistStore,
		stateStore,
		&noopHistoryStore{},
		&stubImageStore{images: map[int]*store.Image{
			10: {ID: 10, Path: "/a.jpg", MediaType: "image"},
		}},
		&noopMonitorStateStore{},
		&simpleRegistry{active: &recordingBackend{}},
		&staticMonitorManager{monitors: monitors},
		&noopBus{},
		nil,
		&noopConfig{},
	)
	return mgr, playlistStore, stateStore
}

func TestStart_keepsDeclaredMonitorsAndRecordsAppliedSubset(t *testing.T) {
	ctx := context.Background()
	mgr, _, stateStore := newTargetTestManager(t, "DP-1")

	require.NoError(t, mgr.Start(ctx, 1, monitor.Target{Monitors: []string{"DP-1", "DP-2"}}))

	inst := stateStore.GetActivePlaylistByID(1)
	require.NotNil(t, inst)
	assert.Equal(t, []string{"DP-1", "DP-2"}, inst.Monitors)
	assert.Equal(t, []string{"DP-1"}, inst.AppliedTo)
}

func TestStart_noDeclaredMonitorConnectedFails(t *testing.T) {
	ctx := context.Background()
	mgr, _, _ := newTargetTestManager(t, "DP-1")

	require.Error(t, mgr.Start(ctx, 1, monitor.Target{Monitors: []string{"DP-9"}}))
}

func TestStartStopStart_declaredSetIsIdenticalEveryTime(t *testing.T) {
	ctx := context.Background()
	mgr, _, stateStore := newTargetTestManager(t, "DP-1")

	declared := []string{"DP-1", "DP-2"}

	require.NoError(t, mgr.Start(ctx, 1, monitor.Target{Monitors: declared}))
	first := stateStore.GetActivePlaylistByID(1).Monitors

	require.NoError(t, mgr.Stop(ctx, 1))

	require.NoError(t, mgr.Start(ctx, 1, monitor.Target{Monitors: declared}))
	second := stateStore.GetActivePlaylistByID(1).Monitors

	assert.Equal(t, declared, first)
	assert.Equal(t, declared, second)
}

func TestPlaybackRoundTrip_restoresFullDeclaredSet(t *testing.T) {
	ctx := context.Background()
	mgr, playlistStore, stateStore := newTargetTestManager(t, "DP-1")

	require.NoError(t, mgr.Start(ctx, 1, monitor.Target{Monitors: []string{"DP-1", "DP-2"}, Extend: true}))
	mgr.Shutdown(ctx)

	playlistStore.mu.RLock()
	pb := playlistStore.playbacks[1]
	playlistStore.mu.RUnlock()
	require.NotNil(t, pb)
	assert.Equal(t, []string{"DP-1", "DP-2"}, pb.Monitors)
	assert.True(t, pb.Extend)

	require.NoError(t, mgr.RestorePersistedRuns(ctx))

	inst := stateStore.GetActivePlaylistByID(1)
	require.NotNil(t, inst)
	assert.Equal(t, []string{"DP-1", "DP-2"}, inst.Monitors)
	assert.Equal(t, []string{"DP-1"}, inst.AppliedTo)
	assert.True(t, inst.Extend)
}
