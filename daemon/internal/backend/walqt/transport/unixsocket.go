// Package transport provides an HTTP client that dials a Unix domain socket.
package transport

import (
	"context"
	"net"
	"net/http"
	"time"
)

// NewClient returns an *http.Client that dials a Unix domain socket at socketPath.
// Use "http://unix" as the base URL when constructing the generated API client.
func NewClient(socketPath string, timeout time.Duration) *http.Client {
	t := &http.Transport{
		DialContext: func(ctx context.Context, _, _ string) (net.Conn, error) {
			var d net.Dialer
			return d.DialContext(ctx, "unix", socketPath)
		},
	}
	return &http.Client{
		Transport: t,
		Timeout:   timeout,
	}
}

// NewClientNoTimeout returns an *http.Client with a Unix domain socket transport
// and no Client-level timeout. Use for endpoints where callers control deadlines
// via context (e.g. /wallpaper/load which can take many seconds).
func NewClientNoTimeout(socketPath string) *http.Client {
	return &http.Client{
		Transport: &http.Transport{
			DialContext: func(ctx context.Context, _, _ string) (net.Conn, error) {
				var d net.Dialer
				return d.DialContext(ctx, "unix", socketPath)
			},
		},
	}
}
