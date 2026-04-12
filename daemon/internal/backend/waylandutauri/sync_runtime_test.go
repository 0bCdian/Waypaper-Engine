package waylandutauri

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/spf13/viper"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestWaylandUtauri_SyncRuntimeFromConfig_Success(t *testing.T) {
	var sawParallax, sawNetwork, sawWebCapPolicy, sawImagePresentation bool
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/wallpaper/parallax" && r.Method == http.MethodPost {
			sawParallax = true
		}
		if r.URL.Path == "/settings/network" && r.Method == http.MethodPost {
			sawNetwork = true
		}
		if r.URL.Path == "/settings/web-capability-policy" && r.Method == http.MethodPost {
			sawWebCapPolicy = true
		}
		if r.URL.Path == "/settings/image-presentation" && r.Method == http.MethodPost {
			sawImagePresentation = true
		}
		w.WriteHeader(http.StatusOK)
	}))
	t.Cleanup(srv.Close)

	v := viper.New()
	wut := &WaylandUtauri{
		v: v,
		makeClient: func(_ *Config) (*controlClient, error) {
			return &controlClient{httpClient: srv.Client(), baseURL: srv.URL}, nil
		},
	}
	wut.RegisterDefaults(v)

	err := wut.SyncRuntimeFromConfig(context.Background())
	require.NoError(t, err)
	assert.True(t, sawParallax, "expected POST /wallpaper/parallax")
	assert.True(t, sawNetwork, "expected POST /settings/network")
	assert.True(t, sawWebCapPolicy, "expected POST /settings/web-capability-policy")
	assert.True(t, sawImagePresentation, "expected POST /settings/image-presentation")
}

func TestWaylandUtauri_SyncRuntimeFromConfig_ClientError(t *testing.T) {
	v := viper.New()
	wut := &WaylandUtauri{
		v: v,
		makeClient: func(_ *Config) (*controlClient, error) {
			return nil, errUnavailable
		},
	}
	wut.RegisterDefaults(v)

	err := wut.SyncRuntimeFromConfig(context.Background())
	require.Error(t, err)
	assert.ErrorContains(t, err, "runtime sync")
}
