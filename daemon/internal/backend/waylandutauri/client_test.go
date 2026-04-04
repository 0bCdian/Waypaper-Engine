package waylandutauri

import (
	"context"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestControlClientCheckHealth_Success(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		require.Equal(t, "/health", r.URL.Path)
		w.Header().Set("X-API-Version", "0")
		_ = json.NewEncoder(w).Encode(map[string]any{
			"ok":          true,
			"service":     "wayland-utauri",
			"api_version": "0",
		})
	}))
	t.Cleanup(srv.Close)

	c := &controlClient{
		httpClient:      srv.Client(),
		baseURL:         srv.URL,
		expectedService: "wayland-utauri",
		expectedAPI:     "0",
	}

	require.NoError(t, c.checkHealth(context.Background()))
}

func TestControlClientCheckHealth_ServiceMismatch(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("X-API-Version", "1")
		_ = json.NewEncoder(w).Encode(map[string]any{
			"ok":          true,
			"service":     "other-service",
			"api_version": "1",
		})
	}))
	t.Cleanup(srv.Close)

	c := &controlClient{
		httpClient:      srv.Client(),
		baseURL:         srv.URL,
		expectedService: "wayland-utauri",
		expectedAPI:     "0",
	}

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
					{"monitor": 1, "stable_id": "DP-1"},
				},
			},
		})
	}))
	t.Cleanup(srv.Close)

	c := &controlClient{httpClient: srv.Client(), baseURL: srv.URL}
	resp, err := c.status(context.Background())
	require.NoError(t, err)
	require.Len(t, resp.Status.Topology, 1)
	assert.Equal(t, uint32(1), resp.Status.Topology[0].Monitor)
	assert.Equal(t, "DP-1", resp.Status.Topology[0].StableID)
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

	c := &controlClient{httpClient: srv.Client(), baseURL: srv.URL}
	err := c.setParallax(context.Background(), buildParallaxRequestBody(defaultConfig()))
	require.NoError(t, err)
}
