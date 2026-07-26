package walqt

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"testing"
	"waypaper-engine/daemon/internal/backend"
	"waypaper-engine/daemon/internal/monitor"

	"github.com/spf13/viper"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestRegisterDefaultsAndLoadConfig(t *testing.T) {
	v := viper.New()
	b := &WalQt{}
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
	b := &WalQt{}

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
	assert.IsType(t, true, result)
}

func TestInitialize_FailsOnHealthMismatch(t *testing.T) {
	tmpDir := t.TempDir()
	dummyBin := tmpDir + "/wal-qt-host"
	require.NoError(t, os.WriteFile(dummyBin, []byte("#!/bin/sh\nexit 1\n"), 0o755))
	t.Setenv("PATH", tmpDir+":"+os.Getenv("PATH"))

	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		_ = json.NewEncoder(w).Encode(map[string]any{
			"ok":          true,
			"service":     "other-service",
			"api_version": "0",
		})
	}))
	t.Cleanup(srv.Close)

	b := &WalQt{
		makeClient: func(_ *Config) (*controlClient, error) {
			return newTestControlClient(srv, "wal-qt", "0"), nil
		},
	}
	err := b.Initialize(context.Background())
	require.Error(t, err)
	assert.ErrorIs(t, err, errContract)
}

func newLoadTestSnapshot() backend.Snapshot {
	return backend.Snapshot{
		Outputs: []backend.Output{
			{
				Monitor: monitor.Monitor{Name: "DP-1", Width: 1920, Height: 1080},
				Content: backend.StaticImage{Path_: "/tmp/wall.jpg"},
			},
		},
	}
}

func TestApply_TrustsPerTargetLoadOutcome(t *testing.T) {
	tests := []struct {
		name           string
		loadStatus     int
		loadBody       string
		wantErr        bool
		wantErrIs      error
		wantErrContain []string
	}{
		{
			name:       "all applied",
			loadStatus: http.StatusOK,
			loadBody:   `{"ok":true,"request_id":1,"results":[{"name":"DP-1","outcome":"applied"}]}`,
			wantErr:    false,
		},
		{
			name:       "mix of applied and superseded",
			loadStatus: http.StatusOK,
			loadBody:   `{"ok":true,"request_id":2,"results":[{"name":"DP-1","outcome":"applied"},{"name":"HDMI-A-1","outcome":"superseded"}]}`,
			wantErr:    false,
		},
		{
			name:           "one failed",
			loadStatus:     http.StatusOK,
			loadBody:       `{"ok":false,"request_id":3,"results":[{"name":"DP-1","outcome":"failed","error":"unresolved target: /x/y"}]}`,
			wantErr:        true,
			wantErrContain: []string{"DP-1", "unresolved target: /x/y"},
		},
		{
			name:           "one timeout",
			loadStatus:     http.StatusOK,
			loadBody:       `{"ok":false,"request_id":4,"results":[{"name":"DP-1","outcome":"timeout"}]}`,
			wantErr:        true,
			wantErrContain: []string{"DP-1"},
		},
		{
			name:       "non-2xx uses existing retry/classify behaviour",
			loadStatus: http.StatusBadRequest,
			loadBody:   `bad request body`,
			wantErr:    true,
			wantErrIs:  errBadRequest,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				switch r.URL.Path {
				case "/health":
					w.Header().Set("X-API-Version", "0")
					_ = json.NewEncoder(w).Encode(map[string]any{
						"ok": true, "service": "wal-qt", "api_version": "0",
					})
				case "/wallpaper/load":
					w.WriteHeader(tt.loadStatus)
					_, _ = w.Write([]byte(tt.loadBody))
				default:
					w.WriteHeader(http.StatusNotFound)
				}
			}))
			t.Cleanup(srv.Close)

			b := &WalQt{
				makeClient: func(_ *Config) (*controlClient, error) {
					return newTestControlClient(srv, "wal-qt", "0"), nil
				},
			}

			err := b.Apply(context.Background(), newLoadTestSnapshot())

			if !tt.wantErr {
				require.NoError(t, err)
				return
			}
			require.Error(t, err)
			if tt.wantErrIs != nil {
				assert.ErrorIs(t, err, tt.wantErrIs)
			}
			for _, want := range tt.wantErrContain {
				assert.Contains(t, err.Error(), want)
			}
		})
	}
}
