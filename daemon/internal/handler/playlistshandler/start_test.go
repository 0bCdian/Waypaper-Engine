package playlistshandler

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"waypaper-engine/daemon/internal/monitor"
	"waypaper-engine/daemon/internal/testutil"
)

func connectedMonitors(names ...string) *testutil.MockMonitorManager {
	return &testutil.MockMonitorManager{
		GetMonitorsFn: func(_ context.Context) ([]monitor.Monitor, error) {
			mons := make([]monitor.Monitor, 0, len(names))
			for _, n := range names {
				mons = append(mons, monitor.Monitor{Name: n})
			}
			return mons, nil
		},
	}
}

func TestResolveDeclaredMonitors_explicitNamesPassThrough(t *testing.T) {
	got, err := resolveDeclaredMonitors(context.Background(), connectedMonitors("DP-1"), []string{"DP-1", "DP-2"})
	require.NoError(t, err)
	assert.Equal(t, []string{"DP-1", "DP-2"}, got)
}

func TestResolveDeclaredMonitors_emptyExpandsToConnected(t *testing.T) {
	mm := connectedMonitors("DP-1", "DP-2")

	got, err := resolveDeclaredMonitors(context.Background(), mm, nil)
	require.NoError(t, err)
	assert.Equal(t, []string{"DP-1", "DP-2"}, got)

	got, err = resolveDeclaredMonitors(context.Background(), mm, []string{})
	require.NoError(t, err)
	assert.Equal(t, []string{"DP-1", "DP-2"}, got)
}

func TestResolveDeclaredMonitors_noneConnectedIsError(t *testing.T) {
	_, err := resolveDeclaredMonitors(context.Background(), connectedMonitors("DP-1"), []string{"DP-9"})
	assert.Error(t, err)
}

func TestPlaylistHandler_Start_noneConnectedIsBadRequest(t *testing.T) {
	h := NewPlaylistHandler(&testutil.MockPlaylistStore{}, &testutil.MockStateStore{}, nil, &testutil.MockBus{},
		connectedMonitors("DP-1"))

	w := httptest.NewRecorder()
	r := httptest.NewRequest(http.MethodPost, "/playlists/1/start",
		testutil.JSONBody(t, map[string]any{"monitors": []string{"DP-9"}}))
	r = testutil.WithChiURLParams(r, map[string]string{"id": "1"})
	h.Start(w, r)

	assert.Equal(t, http.StatusBadRequest, w.Code)
}
