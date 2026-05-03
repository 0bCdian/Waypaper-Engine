package waylandutauri

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"sync/atomic"
	"testing"
	"time"

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
		case "/health":
			w.Header().Set("X-API-Version", "0")
			_ = json.NewEncoder(w).Encode(map[string]any{
				"ok":          true,
				"service":     "wayland-utauri",
				"api_version": "0",
			})
		case "/wallpaper/status":
			_ = json.NewEncoder(w).Encode(map[string]any{
				"ok": true,
				"status": map[string]any{
					"topology": []map[string]any{
						{"name": "DP-1", "width": 1920, "height": 1080, "x": 0, "y": 0},
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
		case "/settings/network":
			_ = json.NewEncoder(w).Encode(map[string]any{"ok": true})
		default:
			w.WriteHeader(http.StatusNotFound)
		}
	}))
	t.Cleanup(srv.Close)

	b := &WaylandUtauri{
		makeClient: func(_ *Config) (*controlClient, error) {
			return &controlClient{
				httpClient:  srv.Client(),
				loadClient:  srv.Client(),
				loadTimeout: 5 * time.Second,
				baseURL:     srv.URL,
			}, nil
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
	assert.Equal(t, 15000, cfg.LoadTimeoutMS)
	assert.Equal(t, "0.54,0,0.34,0.99", cfg.TransitionBezier)
	assert.Equal(t, "cover", cfg.ImageFitMode)
	assert.Equal(t, "auto", cfg.ImageRendering)
}

func TestValidateConfig_RejectsInvalidImageDisplayModes(t *testing.T) {
	b := &WaylandUtauri{}

	err := b.ValidateConfig(json.RawMessage(`{"image_fit_mode":"outside"}`))
	require.Error(t, err)
	assert.Contains(t, err.Error(), "image_fit_mode")

	err = b.ValidateConfig(json.RawMessage(`{"image_rendering":"sharp"}`))
	require.Error(t, err)
	assert.Contains(t, err.Error(), "image_rendering")
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
			"api_version": "0",
		})
	}))
	t.Cleanup(srv.Close)

	b := &WaylandUtauri{
		makeClient: func(_ *Config) (*controlClient, error) {
			return &controlClient{
				httpClient:      srv.Client(),
				baseURL:         srv.URL,
				expectedService: "wayland-utauri",
				expectedAPI:     "0",
			}, nil
		},
	}
	err := b.Initialize(context.Background())
	require.Error(t, err)
	assert.ErrorIs(t, err, errContract)
}
