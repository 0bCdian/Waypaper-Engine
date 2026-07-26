package walqt

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"sync/atomic"
	"testing"
	"waypaper-engine/daemon/internal/backend"
	"waypaper-engine/daemon/internal/monitor"

	"github.com/spf13/viper"
	"github.com/stretchr/testify/require"
)

func TestApply_PushesAllowNetworkWallpapersForWebOutput(t *testing.T) {
	var sawNetworkPOST atomic.Bool
	var sawAllow atomic.Bool

	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch {
		case r.URL.Path == "/health":
			_ = json.NewEncoder(w).Encode(map[string]any{"ok": true, "service": "wal-qt", "api_version": "0"})
		case r.URL.Path == "/settings/network" && r.Method == http.MethodPost:
			var body struct {
				AllowNetworkWallpapers *bool `json:"allow_network_wallpapers"`
			}
			require.NoError(t, json.NewDecoder(r.Body).Decode(&body))
			require.NotNil(t, body.AllowNetworkWallpapers)
			sawAllow.Store(*body.AllowNetworkWallpapers)
			sawNetworkPOST.Store(true)
			_ = json.NewEncoder(w).Encode(map[string]any{"ok": true})
		case r.URL.Path == "/wallpaper/load":
			_ = json.NewEncoder(w).Encode(map[string]any{
				"ok":         true,
				"request_id": 1,
				"results": []map[string]any{
					{"name": "DP-1", "outcome": "applied"},
				},
			})
		default:
			t.Fatalf("unexpected request: %s %s", r.Method, r.URL.Path)
		}
	}))
	t.Cleanup(srv.Close)

	b := &WalQt{
		makeClient: func(cfg *Config) (*controlClient, error) {
			return newTestControlClient(srv, "wal-qt", "0"), nil
		},
	}

	v := viper.New()
	b.RegisterDefaults(v)
	b.SetConfigReader(v)
	v.Set(viperBackendKey+".allow_network_wallpapers", true)

	snap := backend.Snapshot{
		Outputs: []backend.Output{
			{
				Monitor: monitor.Monitor{Name: "DP-1"},
				Content: backend.WebWallpaper{ManifestPath: "/tmp/wall/manifest.json"},
			},
		},
	}

	require.NoError(t, b.Apply(t.Context(), snap))
	require.True(t, sawNetworkPOST.Load(), "expected a POST /settings/network for the web wallpaper output")
	require.True(t, sawAllow.Load(), "expected allow_network_wallpapers=true to be transmitted")
}
