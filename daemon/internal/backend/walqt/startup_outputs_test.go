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

func TestInitialize_WaitsForOutputsBeforeReportingReady(t *testing.T) {
	tmpDir := t.TempDir()
	dummyBin := tmpDir + "/wal-qt-host"
	require.NoError(t, os.WriteFile(dummyBin, []byte("#!/bin/sh\nsleep 30\n"), 0o755))
	t.Setenv("PATH", tmpDir+":"+os.Getenv("PATH"))

	var statusCalls int64
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

	assert.Greater(t, atomic.LoadInt64(&statusCalls), int64(zeroOutputPolls),
		"Initialize returned before wal-qt reported any outputs")
}

func TestInitialize_WaitsForOutputsAfterSpawningChild(t *testing.T) {
	tmpDir := t.TempDir()
	dummyBin := tmpDir + "/wal-qt-host"
	require.NoError(t, os.WriteFile(dummyBin, []byte("#!/bin/sh\nsleep 30\n"), 0o755))
	t.Setenv("PATH", tmpDir+":"+os.Getenv("PATH"))

	var healthCalls, statusCalls int64
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
