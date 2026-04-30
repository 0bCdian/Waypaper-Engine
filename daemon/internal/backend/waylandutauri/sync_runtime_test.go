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

func TestWaylandUtauri_OnConfigChanged_Success(t *testing.T) {
	var sawParallax, sawNetwork, sawImagePresentation bool
	var requestOrder []string
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method == http.MethodPost {
			requestOrder = append(requestOrder, r.URL.Path)
		}
		if r.URL.Path == "/wallpaper/parallax" && r.Method == http.MethodPost {
			sawParallax = true
		}
		if r.URL.Path == "/settings/network" && r.Method == http.MethodPost {
			sawNetwork = true
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

	err := wut.OnConfigChanged(context.Background(), nil)
	require.NoError(t, err)
	assert.True(t, sawParallax, "expected POST /wallpaper/parallax")
	assert.True(t, sawNetwork, "expected POST /settings/network")
	assert.True(t, sawImagePresentation, "expected POST /settings/image-presentation")

	idxNetwork := -1
	idxImagePresentation := -1
	for i, p := range requestOrder {
		if p == "/settings/network" && idxNetwork < 0 {
			idxNetwork = i
		}
		if p == "/settings/image-presentation" && idxImagePresentation < 0 {
			idxImagePresentation = i
		}
	}
	require.GreaterOrEqual(t, idxNetwork, 0)
	require.GreaterOrEqual(t, idxImagePresentation, 0)
	assert.Less(t, idxNetwork, idxImagePresentation, "network policy must be pushed before image presentation")
}

func TestWaylandUtauri_OnConfigChanged_ClientError(t *testing.T) {
	v := viper.New()
	wut := &WaylandUtauri{
		v: v,
		makeClient: func(_ *Config) (*controlClient, error) {
			return nil, errUnavailable
		},
	}
	wut.RegisterDefaults(v)

	err := wut.OnConfigChanged(context.Background(), nil)
	require.Error(t, err)
	assert.ErrorContains(t, err, "runtime sync")
}
