package walqt

import (
	"context"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"waypaper-engine/daemon/internal/backend/walqt/walqtclient"
)

// newTestControlClient builds a controlClient pointing at srv using plain HTTP
// (not a Unix socket) so unit tests can use httptest.NewServer.
func newTestControlClient(srv *httptest.Server, expectedService, expectedAPI string) *controlClient {
	gen, _ := walqtclient.NewClient(srv.URL, walqtclient.WithHTTPClient(srv.Client()))
	genLoad, _ := walqtclient.NewClient(srv.URL, walqtclient.WithHTTPClient(srv.Client()))
	return &controlClient{
		gen:             gen,
		genLoad:         genLoad,
		loadTimeout:     5 * time.Second,
		expectedService: expectedService,
		expectedAPI:     expectedAPI,
	}
}

func TestControlClientCheckHealth_Success(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		require.Equal(t, "/health", r.URL.Path)
		w.Header().Set("X-API-Version", "0")
		_ = json.NewEncoder(w).Encode(map[string]any{
			"ok":          true,
			"service":     "wal-qt",
			"api_version": "0",
		})
	}))
	t.Cleanup(srv.Close)

	c := newTestControlClient(srv, "wal-qt", "0")
	require.NoError(t, c.checkHealth(context.Background()))
}

func TestControlClientCheckHealth_ServiceMismatch(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("X-API-Version", "0")
		_ = json.NewEncoder(w).Encode(map[string]any{
			"ok":          true,
			"service":     "other-service",
			"api_version": "0",
		})
	}))
	t.Cleanup(srv.Close)

	c := newTestControlClient(srv, "wal-qt", "0")
	err := c.checkHealth(context.Background())
	require.Error(t, err)
	assert.ErrorIs(t, err, errContract)
}

func TestControlClientStatus_DecodesTopology(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		require.Equal(t, "/wallpaper/status", r.URL.Path)
		_ = json.NewEncoder(w).Encode(map[string]any{
			"ok": true,
			"status": map[string]any{
				"topology": []map[string]any{
					{"name": "DP-1", "width": 1920, "height": 1080, "x": 0, "y": 0},
				},
			},
		})
	}))
	t.Cleanup(srv.Close)

	c := newTestControlClient(srv, "", "")
	resp, err := c.status(context.Background())
	require.NoError(t, err)
	require.Len(t, resp.Status.Topology, 1)
	assert.Equal(t, "DP-1", resp.Status.Topology[0].Name)
}

func TestControlClientSetParallax_Success(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		require.Equal(t, http.MethodPost, r.Method)
		require.Equal(t, "/wallpaper/parallax", r.URL.Path)
		raw, err := io.ReadAll(r.Body)
		require.NoError(t, err)
		var payload map[string]any
		require.NoError(t, json.Unmarshal(raw, &payload))
		assert.Contains(t, payload, "zoom")
		assert.Contains(t, payload, "enabled")
		_ = json.NewEncoder(w).Encode(map[string]any{"ok": true})
	}))
	t.Cleanup(srv.Close)

	c := newTestControlClient(srv, "", "")
	err := c.setParallax(context.Background(), buildParallaxRequestBody(defaultConfig()))
	require.NoError(t, err)
}

func TestControlClientParallaxMove_Success(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		require.Equal(t, http.MethodPost, r.Method)
		require.Equal(t, "/wallpaper/parallax-move", r.URL.Path)
		raw, err := io.ReadAll(r.Body)
		require.NoError(t, err)
		var payload map[string]any
		require.NoError(t, json.Unmarshal(raw, &payload))
		assert.Equal(t, "DP-1", payload["name"])
		assert.Equal(t, "right", payload["direction"])
		_ = json.NewEncoder(w).Encode(map[string]any{"ok": true})
	}))
	t.Cleanup(srv.Close)

	c := newTestControlClient(srv, "", "")
	require.NoError(t, c.parallaxMove(context.Background(), "DP-1", "right"))
}
