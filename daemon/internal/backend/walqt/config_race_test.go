package walqt

import (
	"os"
	"path/filepath"
	"sync"
	"testing"
	"waypaper-engine/daemon/internal/config"
)

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
	w.RegisterDefaults(cfg.Viper())
	w.SetConfigReader(cfg)

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
			name := "wal-qt"
			if i%2 == 1 {
				name = "awww"
			}
			_ = cfg.SetActiveBackendType(name)
		}
	}()
	wg.Wait()
}

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
