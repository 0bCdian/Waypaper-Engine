package daemon_test

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"testing"
	"time"

	"github.com/spf13/viper"

	"waypaper-engine/daemon/internal/backend"
	"waypaper-engine/daemon/internal/config"
	"waypaper-engine/daemon/internal/daemon"
	"waypaper-engine/daemon/internal/monitor"
	"waypaper-engine/daemon/internal/store"
)

// ---------------------------------------------------------------------------
// Mock backend
// ---------------------------------------------------------------------------

type mockBackend struct {
	name string
}

func (m *mockBackend) Name() string      { return m.name }
func (m *mockBackend) IsAvailable() bool { return true }
func (m *mockBackend) Capabilities() backend.Capabilities {
	return backend.Capabilities{
		ContentKinds: []backend.ContentKind{backend.KindStaticImage},
	}
}
func (m *mockBackend) Initialize(_ context.Context) error { return nil }
func (m *mockBackend) Shutdown(_ context.Context) error   { return nil }
func (m *mockBackend) SetWallpaper(_ context.Context, _ backend.WallpaperRequest) error {
	return nil
}
func (m *mockBackend) RegisterDefaults(_ *viper.Viper)                            {}
func (m *mockBackend) ValidateConfig(_ json.RawMessage) error                     { return nil }
func (m *mockBackend) ParseConfig(_ json.RawMessage) (any, error)                 { return nil, nil }
func (m *mockBackend) OnConfigChanged(_ context.Context, _ json.RawMessage) error { return nil }

// ---------------------------------------------------------------------------
// Mock config manager
// ---------------------------------------------------------------------------

type mockCfg struct {
	socketPath    string
	imagesDir     string
	thumbnailsDir string
	dbDir         string
}

func (m *mockCfg) GetConfig() (*config.Config, error)                 { return &config.Config{}, nil }
func (m *mockCfg) UpdateConfig(_ string, _ map[string]any) error      { return nil }
func (m *mockCfg) GetSection(_ string) (map[string]any, error)        { return nil, nil }
func (m *mockCfg) GetBackendConfig(_ string) (json.RawMessage, error) { return nil, nil }
func (m *mockCfg) SetBackendConfig(_ string, _ json.RawMessage) error { return nil }
func (m *mockCfg) GetActiveBackendType() string                       { return "mock" }
func (m *mockCfg) SetActiveBackendType(_ string) error                { return nil }
func (m *mockCfg) GetSelectionMode() string                           { return "fixed" }
func (m *mockCfg) GetAutoPriorities() config.AutoPriorities           { return config.AutoPriorities{} }
func (m *mockCfg) OnConfigChange(_ func(string))                      {}
func (m *mockCfg) GetSocketPath() string                              { return m.socketPath }
func (m *mockCfg) GetImagesDir() string                               { return m.imagesDir }
func (m *mockCfg) GetThumbnailsDir() string                           { return m.thumbnailsDir }
func (m *mockCfg) GetDatabaseDir() string                             { return m.dbDir }
func (m *mockCfg) GetLogFile() string                                 { return "" }
func (m *mockCfg) ResetToFactoryDefaults(func(*viper.Viper)) error    { return nil }
func (m *mockCfg) ReplaceBackendNamedConfig(string, map[string]any) error {
	return nil
}

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

// startTestDaemon opens a real CloverDB in t.TempDir(), constructs a Daemon
// with a mock backend, starts it in a goroutine, and waits for the socket to
// be ready. It returns the http.Client to use and a cancel func to stop the daemon.
func startTestDaemon(t *testing.T) (*http.Client, string, context.CancelFunc) {
	t.Helper()

	tmp := t.TempDir()
	dbDir := filepath.Join(tmp, "db")
	imagesDir := filepath.Join(tmp, "images")
	thumbnailsDir := filepath.Join(tmp, "thumbnails")
	socketPath := filepath.Join(tmp, "daemon.sock")

	if err := os.MkdirAll(dbDir, 0o750); err != nil {
		t.Fatalf("create db dir: %v", err)
	}
	db, err := store.OpenDB(dbDir)
	if err != nil {
		t.Fatalf("open db: %v", err)
	}
	t.Cleanup(func() { _ = db.Close() })

	mb := &mockBackend{name: "mock"}
	reg := backend.NewRegistry()
	if err := reg.Register(mb); err != nil {
		t.Fatalf("register backend: %v", err)
	}
	if err := reg.SetActive("mock"); err != nil {
		t.Fatalf("set active backend: %v", err)
	}

	cfg := &mockCfg{
		socketPath:    socketPath,
		imagesDir:     imagesDir,
		thumbnailsDir: thumbnailsDir,
		dbDir:         dbDir,
	}

	v := viper.New()

	opts := daemon.Options{
		SocketPath:       socketPath,
		DB:               db,
		Registry:         reg,
		Cfg:              cfg,
		Viper:            v,
		ImagesDir:        imagesDir,
		ThumbnailsDir:    thumbnailsDir,
		Version:          "test",
		Compositor:       monitor.CompositorType(""),
		MonitorProviders: nil, // no providers in tests
	}

	d, err := daemon.New(opts)
	if err != nil {
		t.Fatalf("daemon.New: %v", err)
	}

	ctx, cancel := context.WithCancel(context.Background())

	errCh := make(chan error, 1)
	go func() {
		errCh <- d.Start(ctx)
	}()

	if err := daemon.WaitForSocket(socketPath, 5*time.Second); err != nil {
		cancel()
		t.Fatalf("daemon socket not ready: %v", err)
	}

	client := daemon.UnixClient(socketPath)

	stopFn := func() {
		cancel()
		select {
		case <-errCh:
		case <-time.After(5 * time.Second):
			t.Logf("warning: daemon did not stop within timeout")
		}
	}

	return client, socketPath, stopFn
}

func get(t *testing.T, client *http.Client, url string) *http.Response {
	t.Helper()
	resp, err := client.Get(url)
	if err != nil {
		t.Fatalf("GET %s: %v", url, err)
	}
	return resp
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

func TestDaemon_HealthzReturns200(t *testing.T) {
	client, _, stop := startTestDaemon(t)
	defer stop()

	resp := get(t, client, "http://daemon/healthz")
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		t.Fatalf("expected 200, got %d: %s", resp.StatusCode, body)
	}
}

func TestDaemon_GetApiThemesReturns200EmptyArray(t *testing.T) {
	client, _, stop := startTestDaemon(t)
	defer stop()

	resp := get(t, client, "http://daemon/api/themes")
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		t.Fatalf("expected 200, got %d: %s", resp.StatusCode, body)
	}
	body, _ := io.ReadAll(resp.Body)
	var themes []any
	if err := json.Unmarshal(body, &themes); err != nil {
		t.Fatalf("expected JSON array: %v\nbody: %s", err, body)
	}
	if len(themes) != 0 {
		t.Errorf("expected no themes in empty temp themes dir, got %d", len(themes))
	}
}

func TestDaemon_GetImagesEmpty(t *testing.T) {
	client, _, stop := startTestDaemon(t)
	defer stop()

	resp := get(t, client, "http://daemon/images")
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		t.Fatalf("expected 200, got %d: %s", resp.StatusCode, body)
	}

	var result struct {
		Pagination struct {
			TotalItems int `json:"total_items"`
		} `json:"pagination"`
	}
	body, _ := io.ReadAll(resp.Body)
	if err := json.Unmarshal(body, &result); err != nil {
		t.Fatalf("decode response: %v\nbody: %s", err, body)
	}
	if result.Pagination.TotalItems != 0 {
		t.Errorf("expected total_items=0, got %d", result.Pagination.TotalItems)
	}
}

func TestDaemon_GetBackends(t *testing.T) {
	client, _, stop := startTestDaemon(t)
	defer stop()

	resp := get(t, client, "http://daemon/backends")
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		t.Fatalf("expected 200, got %d: %s", resp.StatusCode, body)
	}

	var result []struct {
		Name   string `json:"name"`
		Active bool   `json:"active"`
	}
	body, _ := io.ReadAll(resp.Body)
	if err := json.Unmarshal(body, &result); err != nil {
		t.Fatalf("decode response: %v\nbody: %s", err, body)
	}

	found := false
	for _, b := range result {
		if b.Name == "mock" {
			found = true
			if !b.Active {
				t.Errorf("expected mock backend to be active")
			}
		}
	}
	if !found {
		t.Errorf("mock backend not found in response: %s", fmt.Sprint(result))
	}
}
