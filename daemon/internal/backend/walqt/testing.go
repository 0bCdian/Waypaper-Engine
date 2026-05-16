package walqt

import (
	"net/http"
	"time"

	"waypaper-engine/daemon/internal/backend/walqt/walqtclient"
)

// NewWalQtWithHTTPClient builds a *WalQt whose control client uses the given HTTP
// client and base URL instead of a Unix socket. Intended for use in test helpers
// that need to intercept /wallpaper/load without spawning wal-qt-host.
func NewWalQtWithHTTPClient(baseURL string, httpClient *http.Client) *WalQt {
	return &WalQt{
		makeClient: func(cfg *Config) (*controlClient, error) {
			gen, _ := walqtclient.NewClient(baseURL, walqtclient.WithHTTPClient(httpClient))
			genLoad, _ := walqtclient.NewClient(baseURL, walqtclient.WithHTTPClient(httpClient))
			return &controlClient{
				gen:             gen,
				genLoad:         genLoad,
				loadTimeout:     5 * time.Second,
				expectedService: "wal-qt",
				expectedAPI:     "0",
			}, nil
		},
	}
}
