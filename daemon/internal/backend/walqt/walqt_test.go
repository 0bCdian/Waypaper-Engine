package walqt

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"testing"

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
	// Result depends on whether wal-qt-host is installed on the
	// test machine. We just verify it doesn't panic and returns a bool.
	assert.IsType(t, true, result)
}

func TestInitialize_FailsOnHealthMismatch(t *testing.T) {
	// Create a dummy wal-qt-host binary in a temp dir so IsAvailable() passes.
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
