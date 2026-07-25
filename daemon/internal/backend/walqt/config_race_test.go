package walqt

import (
	"os"
	"path/filepath"
	"sync"
	"testing"

	"waypaper-engine/daemon/internal/config"
)

// TestConfigReaderRace_WalQtLoadConfig is a permanent -race guard for the bug
// fixed alongside it: WalQt used to retain the raw *viper.Viper handed to
// RegisterDefaults and read it later (loadConfigFromViper, called on every
// Apply — every playlist tick and manual set). Meanwhile config.ViperManager's
// file-watcher goroutine calls ReadInConfig() (a map write) on that same
// instance under its own mutex, which a caller holding only the raw
// *viper.Viper never takes. That is a proven, reachable data race.
//
// The fix: WalQt.SetConfigReader wires in a config.ViperManager (which
// implements backend.ConfigReader with its own locking) instead of the raw
// viper. This test exercises exactly that path — RegisterDefaults +
// SetConfigReader, the same sequence cmd/daemon/main.go performs — racing
// concurrent loadConfigFromViper calls against concurrent ReadInConfig calls
// (standing in for the file watcher). Run with -race; it must report zero
// races.
func TestConfigReaderRace_WalQtLoadConfig(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, "config.toml")
	if err := os.WriteFile(path, []byte("[backend.wal-qt]\nsocket_path = \"/tmp/a.sock\"\n"), 0o644); err != nil {
		t.Fatalf("write config: %v", err)
	}

	cfg, err := config.NewViperManager(path)
	if err != nil {
		t.Fatalf("NewViperManager: %v", err)
	}
	t.Cleanup(func() { _ = cfg.Close() })

	w := &WalQt{}
	w.RegisterDefaults(cfg.Viper()) // exactly what cmd/daemon/main.go does at startup
	w.SetConfigReader(cfg)          // exactly what cmd/daemon/main.go does right after

	var wg sync.WaitGroup
	wg.Add(2)
	go func() {
		defer wg.Done()
		for range 200 {
			_ = w.loadConfigFromViper()
		}
	}()
	go func() {
		defer wg.Done()
		for i := range 50 {
			// SetActiveBackendType persists to disk and then reloads m.v via
			// ReadInConfig — the same map-mutating operation the file-watcher
			// goroutine performs on every external edit (see startWatch in
			// viper_manager.go). This is what would race against an unguarded
			// raw-viper read in loadConfigFromViper.
			name := "wal-qt"
			if i%2 == 1 {
				name = "awww"
			}
			_ = cfg.SetActiveBackendType(name)
		}
	}()
	wg.Wait()
}

// TestConfigReaderRace_MonitorProviderDetect is the equivalent guard for
// walqtMonitorProvider: NewMonitorProvider used to retain the raw
// *viper.Viper and read it from controlConfig() on every Detect() call
// (every GET /monitors). Same fix, same shape of test.
func TestConfigReaderRace_MonitorProviderDetect(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, "config.toml")
	if err := os.WriteFile(path, []byte("[backend.wal-qt]\nsocket_path = \"/tmp/a.sock\"\n"), 0o644); err != nil {
		t.Fatalf("write config: %v", err)
	}

	cfg, err := config.NewViperManager(path)
	if err != nil {
		t.Fatalf("NewViperManager: %v", err)
	}
	t.Cleanup(func() { _ = cfg.Close() })

	provider := NewMonitorProvider(cfg).(*walqtMonitorProvider)

	var wg sync.WaitGroup
	wg.Add(2)
	go func() {
		defer wg.Done()
		for range 200 {
			_ = provider.controlConfig()
		}
	}()
	go func() {
		defer wg.Done()
		for i := range 50 {
			name := "wal-qt"
			if i%2 == 1 {
				name = "awww"
			}
			_ = cfg.SetActiveBackendType(name)
		}
	}()
	wg.Wait()
}
