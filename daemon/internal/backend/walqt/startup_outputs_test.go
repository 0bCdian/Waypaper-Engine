package walqt

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"sync/atomic"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// wal-qt answers GET /health as soon as its HTTP server binds, which happens
// well before LayerShellQt has created the per-output surfaces. Applying a
// wallpaper in that window is accepted and recorded by wal-qt but never
// painted, leaving a black desktop until something applies again. Initialize
// must therefore keep waiting until wal-qt reports at least one output.
func TestInitialize_WaitsForOutputsBeforeReportingReady(t *testing.T) {
	tmpDir := t.TempDir()
	dummyBin := tmpDir + "/wal-qt-host"
	require.NoError(t, os.WriteFile(dummyBin, []byte("#!/bin/sh\nsleep 30\n"), 0o755))
	t.Setenv("PATH", tmpDir+":"+os.Getenv("PATH"))

	var statusCalls int64
	// Report zero outputs for the first two status polls, then two monitors —
	// mirroring wal-qt's real startup, where outputs appear after /health is up.
	const zeroOutputPolls = 2

	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case "/health":
			_ = json.NewEncoder(w).Encode(map[string]any{
				"ok": true, "service": "wal-qt", "api_version": "0",
			})
		case "/wallpaper/status":
			n := atomic.AddInt64(&statusCalls, 1)
			count := 2
			if n <= zeroOutputPolls {
				count = 0
			}
			_ = json.NewEncoder(w).Encode(map[string]any{
				"ok": true, "api_version": "0",
				"status": map[string]any{"monitor_count": count},
			})
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

	require.NoError(t, b.Initialize(context.Background()))

	// Initialize must not report ready while wal-qt still has zero outputs.
	assert.Greater(t, atomic.LoadInt64(&statusCalls), int64(zeroOutputPolls),
		"Initialize returned before wal-qt reported any outputs")
}

// Same guarantee on the spawn path: this is the sequence that actually left the
// desktop black at login — the daemon spawned wal-qt, saw /health go green
// ~450ms later, and applied the restore snapshot before any output existed.
func TestInitialize_WaitsForOutputsAfterSpawningChild(t *testing.T) {
	tmpDir := t.TempDir()
	dummyBin := tmpDir + "/wal-qt-host"
	require.NoError(t, os.WriteFile(dummyBin, []byte("#!/bin/sh\nsleep 30\n"), 0o755))
	t.Setenv("PATH", tmpDir+":"+os.Getenv("PATH"))

	var healthCalls, statusCalls int64
	// Health is refused until the child "boots", forcing the spawn path.
	const unhealthyPolls = 1
	const zeroOutputPolls = 2

	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case "/health":
			if atomic.AddInt64(&healthCalls, 1) <= unhealthyPolls {
				w.WriteHeader(http.StatusServiceUnavailable)
				return
			}
			_ = json.NewEncoder(w).Encode(map[string]any{
				"ok": true, "service": "wal-qt", "api_version": "0",
			})
		case "/wallpaper/status":
			n := atomic.AddInt64(&statusCalls, 1)
			count := 2
			if n <= zeroOutputPolls {
				count = 0
			}
			_ = json.NewEncoder(w).Encode(map[string]any{
				"ok": true, "api_version": "0",
				"status": map[string]any{"monitor_count": count},
			})
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

	require.NoError(t, b.Initialize(context.Background()))

	require.Greater(t, atomic.LoadInt64(&healthCalls), int64(unhealthyPolls),
		"expected the spawn path to be exercised")
	assert.Greater(t, atomic.LoadInt64(&statusCalls), int64(zeroOutputPolls),
		"Initialize returned before wal-qt reported any outputs")
}
