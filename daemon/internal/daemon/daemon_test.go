package daemon_test

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"testing"
	"time"
	"waypaper-engine/daemon/internal/backend"
	"waypaper-engine/daemon/internal/config"
	"waypaper-engine/daemon/internal/daemon"
	"waypaper-engine/daemon/internal/monitor"
	"waypaper-engine/daemon/internal/store"

	"github.com/spf13/viper"
)

type mockBackend struct {
	name      string
	initDelay time.Duration

	mu      sync.Mutex
	applied []string // first output's static image path, per Apply call
}

func (m *mockBackend) appliedPaths() []string {
	m.mu.Lock()
	defer m.mu.Unlock()
	return append([]string(nil), m.applied...)
}

func (m *mockBackend) Name() string      { return m.name }
func (m *mockBackend) IsAvailable() bool { return true }
func (m *mockBackend) Capabilities() backend.Capabilities {
	return backend.Capabilities{
		ContentKinds: []backend.ContentKind{backend.KindStaticImage},
	}
}
func (m *mockBackend) Initialize(_ context.Context) error {
	time.Sleep(m.initDelay)
	return nil
}
func (m *mockBackend) Shutdown(_ context.Context) error       { return nil }
func (m *mockBackend) RegisterDefaults(_ *viper.Viper)        {}
func (m *mockBackend) ValidateConfig(_ json.RawMessage) error { return nil }
func (m *mockBackend) Apply(_ context.Context, snap backend.Snapshot) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	if len(snap.Outputs) > 0 {
		if img, ok := snap.Outputs[0].Content.(backend.StaticImage); ok {
			m.applied = append(m.applied, img.Path_)
		}
	}
	return nil
}

type fakeMonitorProvider struct{}

func (fakeMonitorProvider) Name() string                       { return "fake" }
func (fakeMonitorProvider) Compositor() monitor.CompositorType { return monitor.CompositorWayland }
func (fakeMonitorProvider) Priority() int                      { return 1 }
func (fakeMonitorProvider) Detect(context.Context) ([]monitor.Monitor, error) {
	return []monitor.Monitor{{Name: "TEST-1", Width: 1920, Height: 1080}}, nil
}

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

func startTestDaemon(t *testing.T) (*http.Client, string, context.CancelFunc) {
	t.Helper()
	return startTestDaemonWith(t, testDaemonSetup{})
}

type testDaemonSetup struct {
	backend   *mockBackend
	providers []monitor.MonitorProvider
	seed      func(store.DB)
}

func startTestDaemonWith(t *testing.T, setup testDaemonSetup) (*http.Client, string, context.CancelFunc) {
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
	if setup.seed != nil {
		setup.seed(db)
	}

	mb := setup.backend
	if mb == nil {
		mb = &mockBackend{name: "mock"}
	}
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

	opts := daemon.Options{
		SocketPath:       socketPath,
		DB:               db,
		Registry:         reg,
		Cfg:              cfg,
		ImagesDir:        imagesDir,
		ThumbnailsDir:    thumbnailsDir,
		Version:          "test",
		Compositor:       monitor.CompositorWayland,
		MonitorProviders: setup.providers,
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

// seedRestorableWallpaper stores images A and B and a persisted monitor state showing A on TEST-1.
func seedRestorableWallpaper(t *testing.T, dir string) (func(store.DB), *[2]store.Image) {
	t.Helper()
	var imgs [2]store.Image
	return func(db store.DB) {
		ctx := context.Background()
		var batch []store.Image
		for _, name := range []string{"a.png", "b.png"} {
			path := filepath.Join(dir, name)
			if err := os.WriteFile(path, []byte("png"), 0o644); err != nil {
				t.Fatalf("write %s: %v", name, err)
			}
			batch = append(batch, store.Image{Name: name, Path: path, MediaType: "image", Format: "png", Width: 1920, Height: 1080})
		}
		created, err := db.ImageStore().Create(ctx, batch)
		if err != nil || len(created) != 2 {
			t.Fatalf("create images: %v", err)
		}
		copy(imgs[:], created)
		if err := db.MonitorStateStore().Set(ctx, store.MonitorState{
			MonitorName: "TEST-1", ImageID: imgs[0].ID, ImageName: imgs[0].Name, ImagePath: imgs[0].Path,
			Mode: "individual", Backend: "mock", SetAt: time.Now(),
		}); err != nil {
			t.Fatalf("seed monitor state: %v", err)
		}
	}, &imgs
}

func TestDaemon_ServesReadsWhileBackendInitializes(t *testing.T) {
	mb := &mockBackend{name: "mock", initDelay: 2 * time.Second}
	launched := time.Now()
	client, _, stop := startTestDaemonWith(t, testDaemonSetup{backend: mb})
	defer stop()

	for _, path := range []string{"/healthz", "/images"} {
		resp := get(t, client, "http://daemon"+path)
		resp.Body.Close()
		if resp.StatusCode != http.StatusOK {
			t.Fatalf("GET %s: status %d", path, resp.StatusCode)
		}
	}
	if elapsed := time.Since(launched); elapsed > time.Second {
		t.Errorf("reads answered %v after launch; want well before the 2s backend init finishes", elapsed)
	}
}

func TestDaemon_HealthzReportsBackendReadiness(t *testing.T) {
	mb := &mockBackend{name: "mock", initDelay: 500 * time.Millisecond}
	client, _, stop := startTestDaemonWith(t, testDaemonSetup{backend: mb})
	defer stop()

	backendReady := func() bool {
		resp := get(t, client, "http://daemon/healthz")
		defer resp.Body.Close()
		var body struct {
			BackendReady bool `json:"backend_ready"`
		}
		if err := json.NewDecoder(resp.Body).Decode(&body); err != nil {
			t.Fatalf("decode healthz: %v", err)
		}
		return body.BackendReady
	}

	if backendReady() {
		t.Fatal("expected backend_ready=false while the backend initializes")
	}
	deadline := time.Now().Add(3 * time.Second)
	for !backendReady() {
		if time.Now().After(deadline) {
			t.Fatal("backend_ready never became true")
		}
		time.Sleep(20 * time.Millisecond)
	}
}

func TestDaemon_SetWallpaperDuringStartupWinsOverRestore(t *testing.T) {
	seed, imgs := seedRestorableWallpaper(t, t.TempDir())
	mb := &mockBackend{name: "mock", initDelay: time.Second}
	client, _, stop := startTestDaemonWith(t, testDaemonSetup{
		backend:   mb,
		providers: []monitor.MonitorProvider{fakeMonitorProvider{}},
		seed:      seed,
	})
	defer stop()

	body := fmt.Sprintf(`{"image_id":%d,"monitor":"TEST-1"}`, imgs[1].ID)
	resp, err := client.Post("http://daemon/wallpaper/set", "application/json", strings.NewReader(body))
	if err != nil {
		t.Fatalf("POST /wallpaper/set: %v", err)
	}
	resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("POST /wallpaper/set: status %d", resp.StatusCode)
	}

	applied := mb.appliedPaths()
	if len(applied) == 0 || applied[len(applied)-1] != imgs[1].Path {
		t.Fatalf("last applied = %v, want %s (user choice) after restore", applied, imgs[1].Path)
	}
	if applied[0] != imgs[0].Path {
		t.Errorf("first applied = %s, want restored %s", applied[0], imgs[0].Path)
	}
}
