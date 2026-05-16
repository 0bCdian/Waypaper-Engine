package shadowtest

import (
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"sync"
	"testing"

	"github.com/spf13/viper"

	"waypaper-engine/daemon/internal/backend"
	"waypaper-engine/daemon/internal/backend/walqt"
)

// WalQtCaptor captures the JSON body POSTed to /wallpaper/load by the WalQt backend.
// It uses an httptest server as the wal-qt control plane so no real wal-qt binary
// is required.
type WalQtCaptor struct {
	backend backend.Backend

	mu      sync.Mutex
	lastReq []byte
}

// NewWalQtCaptor builds a WalQt backend pointed at an in-process httptest server.
// The server records the /wallpaper/load body and returns success responses.
func NewWalQtCaptor(t *testing.T) *WalQtCaptor {
	t.Helper()

	c := &WalQtCaptor{}

	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case "/health":
			w.Header().Set("X-API-Version", "0")
			_ = json.NewEncoder(w).Encode(map[string]any{
				"ok":          true,
				"service":     "wal-qt",
				"api_version": "0",
			})
		case "/wallpaper/status":
			_ = json.NewEncoder(w).Encode(map[string]any{
				"ok": true,
				"status": map[string]any{
					"topology":      []any{},
					"monitors":      []any{},
					"monitor_count": 0,
					"scheduler": map[string]any{
						"mode":            "sequential",
						"max_queue_size":  1,
						"queued_requests": 0,
					},
				},
			})
		case "/wallpaper/load":
			raw, err := io.ReadAll(r.Body)
			if err != nil {
				w.WriteHeader(http.StatusInternalServerError)
				return
			}
			c.mu.Lock()
			c.lastReq = raw
			c.mu.Unlock()
			w.Header().Set("Content-Type", "application/json")
			_ = json.NewEncoder(w).Encode(map[string]any{"ok": true})
		case "/wallpaper/parallax":
			_ = json.NewEncoder(w).Encode(map[string]any{"ok": true})
		default:
			w.WriteHeader(http.StatusNotFound)
		}
	}))
	t.Cleanup(srv.Close)

	b := walqt.NewWalQtWithHTTPClient(srv.URL, srv.Client())
	v := viper.New()
	b.RegisterDefaults(v)

	c.backend = b
	return c
}

// LastLoadBody returns the raw JSON body of the most recent /wallpaper/load POST.
func (c *WalQtCaptor) LastLoadBody() []byte {
	c.mu.Lock()
	defer c.mu.Unlock()
	return c.lastReq
}

// CaptureSetWallpaper runs SetWallpaper and returns the captured /wallpaper/load body.
func (c *WalQtCaptor) CaptureSetWallpaper(t *testing.T, req backend.WallpaperRequest) []byte {
	t.Helper()
	_ = c.backend.SetWallpaper(t.Context(), req)
	return c.LastLoadBody()
}

// CaptureApply runs Apply and returns the captured /wallpaper/load body.
func (c *WalQtCaptor) CaptureApply(t *testing.T, snap backend.Snapshot) []byte {
	t.Helper()
	_ = c.backend.Apply(t.Context(), snap)
	return c.LastLoadBody()
}
