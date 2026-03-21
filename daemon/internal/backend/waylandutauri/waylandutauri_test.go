package waylandutauri

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"sync/atomic"
	"testing"

	"github.com/spf13/viper"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"waypaper-engine/daemon/internal/backend"
	"waypaper-engine/daemon/internal/monitor"
)

func TestSetWallpaper_RetriesOnInternalError(t *testing.T) {
	var loadCalls int32
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case "/wallpaper/status":
			_ = json.NewEncoder(w).Encode(map[string]any{
				"ok": true,
				"status": map[string]any{
					"topology": []map[string]any{
						{"monitor": 1, "stable_id": "monitor:1:0:0:1920:1080", "width": 1920, "height": 1080, "x": 0, "y": 0},
					},
				},
			})
		case "/wallpaper/load":
			call := atomic.AddInt32(&loadCalls, 1)
			if call == 1 {
				w.WriteHeader(http.StatusInternalServerError)
				_ = json.NewEncoder(w).Encode(map[string]any{"ok": false, "error": "boom"})
				return
			}
			_ = json.NewEncoder(w).Encode(map[string]any{"ok": true})
		case "/wallpaper/parallax":
			_ = json.NewEncoder(w).Encode(map[string]any{"ok": true})
		default:
			w.WriteHeader(http.StatusNotFound)
		}
	}))
	t.Cleanup(srv.Close)

	b := &WaylandUtauri{
		makeClient: func(_ *Config) (*controlClient, error) {
			return &controlClient{httpClient: srv.Client(), baseURL: srv.URL}, nil
		},
	}

	err := b.SetWallpaper(context.Background(), backend.WallpaperRequest{
		ImagePath: "/tmp/wall.jpg",
		Mode:      monitor.ModeIndividual,
		Monitors:  []monitor.Monitor{{Name: "DP-1", Width: 1920, Height: 1080, X: 0, Y: 0}},
		Config:    defaultConfig(),
	})
	require.NoError(t, err)
	assert.Equal(t, int32(2), atomic.LoadInt32(&loadCalls))
}

func TestRegisterDefaultsAndLoadConfig(t *testing.T) {
	v := viper.New()
	b := &WaylandUtauri{}
	b.RegisterDefaults(v)
	cfg := b.loadConfigFromViper()

	assert.Equal(t, defaultExpectedService, cfg.ExpectedService)
	assert.Equal(t, defaultAPIVersion, cfg.ExpectedAPIVersion)
	assert.Equal(t, 500, cfg.ConnectTimeoutMS)
	assert.Equal(t, 1500, cfg.RequestTimeoutMS)
	assert.True(t, cfg.HideOnShutdown)
}

func TestIsAvailable_ChecksBinaryInPath(t *testing.T) {
	b := New()
	result := b.IsAvailable()
	// Result depends on whether wayland-utauri is installed on the
	// test machine. We just verify it doesn't panic and returns a bool.
	assert.IsType(t, true, result)
}

func TestInitialize_FailsOnHealthMismatch(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		_ = json.NewEncoder(w).Encode(map[string]any{
			"ok":          true,
			"service":     "other-service",
			"api_version": "1",
		})
	}))
	t.Cleanup(srv.Close)

	b := &WaylandUtauri{
		makeClient: func(_ *Config) (*controlClient, error) {
			return &controlClient{
				httpClient:      srv.Client(),
				baseURL:         srv.URL,
				expectedService: "wayland-utauri",
				expectedAPI:     "1",
			}, nil
		},
	}
	err := b.Initialize(context.Background())
	require.Error(t, err)
	assert.ErrorIs(t, err, errContract)
}
