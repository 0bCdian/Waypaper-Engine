package config

import (
	"encoding/json"
	"fmt"
	"os"
	"sync"

	"waypaper-engine/daemon/internal/system"

	"github.com/fsnotify/fsnotify"
	"github.com/spf13/viper"
)

// validSections lists the top-level config sections that UpdateConfig/GetSection accept.
var validSections = map[string]bool{
	"app":       true,
	"daemon":    true,
	"backend":   true,
	"monitors":  true,
	"wallhaven": true,
}

// ViperManager implements ConfigManager using Viper for TOML-based configuration.
// All public methods are safe for concurrent use.
type ViperManager struct {
	v  *viper.Viper
	mu sync.RWMutex

	// callbacks registered via OnConfigChange, called in order.
	cbMu      sync.RWMutex
	callbacks []func(section string)
}

// Compile-time assertion that ViperManager satisfies ConfigManager.
var _ ConfigManager = (*ViperManager)(nil)

// NewViperManager creates a ConfigManager backed by Viper.
// configPath is the absolute path to the TOML config file.
// If the file does not exist, Viper will use defaults and the file
// will be created on the first call to a write method.
func NewViperManager(configPath string) (*ViperManager, error) {
	v := viper.New()
	v.SetConfigFile(configPath)
	v.SetConfigType("toml")

	setDefaults(v)

	if err := v.ReadInConfig(); err != nil {
		if _, ok := err.(viper.ConfigFileNotFoundError); !ok {
			// If the file simply doesn't exist, we proceed with defaults.
			// For any other error (parse error, permission, etc.) we fail.
			if !isFileNotFound(err) {
				return nil, fmt.Errorf("config: read %s: %w", configPath, err)
			}
		}
		// Ensure the parent directory exists so WriteConfig can succeed later.
		if err := system.EnsureParentDir(configPath); err != nil {
			return nil, fmt.Errorf("config: ensure config dir: %w", err)
		}
		// Persist defaults so the user has a concrete file to edit.
		if err := v.WriteConfigAs(configPath); err != nil {
			// Non-critical: daemon works fine with in-memory defaults.
			// Log-level logging isn't set up yet, so just ignore.
			_ = err
		}
	}

	m := &ViperManager{v: v}

	// Start watching for external changes.
	v.OnConfigChange(func(e fsnotify.Event) {
		m.notifyCallbacks("")
	})
	v.WatchConfig()

	return m, nil
}

// Viper returns the underlying Viper instance.
// This is exposed so that backends can call RegisterDefaults(v) at startup.
// Callers MUST NOT use it for general config access — use the ConfigManager
// interface methods instead.
func (m *ViperManager) Viper() *viper.Viper {
	return m.v
}

// ---------- Full config access ----------

func (m *ViperManager) GetConfig() (*Config, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()

	var cfg Config
	if err := m.v.Unmarshal(&cfg); err != nil {
		return nil, fmt.Errorf("config: unmarshal: %w", err)
	}
	return &cfg, nil
}

func (m *ViperManager) UpdateConfig(section string, values map[string]any) error {
	if !validSections[section] {
		return fmt.Errorf("config: unknown section %q (valid: app, daemon, backend, monitors, wallhaven)", section)
	}

	m.mu.Lock()
	defer m.mu.Unlock()

	// Read the current section as a flat map, merge new values, then set as a whole.
	// This avoids Viper's dotted-key override shadowing the config-file layer.
	existing := m.v.GetStringMap(section)
	for k, val := range values {
		existing[k] = val
	}
	m.v.Set(section, existing)

	if err := m.v.WriteConfig(); err != nil {
		return fmt.Errorf("config: write after update: %w", err)
	}

	return nil
}

// ---------- Section access ----------

func (m *ViperManager) GetSection(section string) (map[string]any, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()

	sub := m.v.Sub(section)
	if sub == nil {
		// Sub returns nil if the key doesn't exist. Return empty map.
		return map[string]any{}, nil
	}

	return sub.AllSettings(), nil
}

func (m *ViperManager) UnmarshalSection(section string, target any) error {
	m.mu.RLock()
	defer m.mu.RUnlock()

	return m.v.UnmarshalKey(section, target)
}

// ---------- Backend-specific config ----------

func (m *ViperManager) GetBackendConfig(backendName string) (json.RawMessage, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()

	key := "backend." + backendName
	sub := m.v.Sub(key)
	if sub == nil {
		return json.RawMessage("{}"), nil
	}

	raw, err := json.Marshal(sub.AllSettings())
	if err != nil {
		return nil, fmt.Errorf("config: marshal backend %s: %w", backendName, err)
	}
	return raw, nil
}

func (m *ViperManager) SetBackendConfig(backendName string, raw json.RawMessage) error {
	var values map[string]any
	if err := json.Unmarshal(raw, &values); err != nil {
		return fmt.Errorf("config: unmarshal backend config JSON: %w", err)
	}

	m.mu.Lock()
	defer m.mu.Unlock()

	// Read-modify-write: read the current backend sub-section, merge new values,
	// then set as a whole to avoid Viper dotted-key override shadowing.
	key := "backend." + backendName
	existing := m.v.GetStringMap(key)
	for k, val := range values {
		existing[k] = val
	}
	m.v.Set(key, existing)

	if err := m.v.WriteConfig(); err != nil {
		return fmt.Errorf("config: write after backend config update: %w", err)
	}

	return nil
}

// ---------- Active backend ----------

func (m *ViperManager) GetActiveBackendType() string {
	m.mu.RLock()
	defer m.mu.RUnlock()

	return m.v.GetString("backend.type")
}

func (m *ViperManager) SetActiveBackendType(name string) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	// Read-modify-write for backend section to preserve other backend keys.
	existing := m.v.GetStringMap("backend")
	existing["type"] = name
	m.v.Set("backend", existing)

	if err := m.v.WriteConfig(); err != nil {
		return fmt.Errorf("config: write after active backend change: %w", err)
	}

	return nil
}

// ---------- Change notification ----------

func (m *ViperManager) OnConfigChange(callback func(section string)) {
	m.cbMu.Lock()
	defer m.cbMu.Unlock()
	m.callbacks = append(m.callbacks, callback)
}

func (m *ViperManager) notifyCallbacks(section string) {
	m.cbMu.RLock()
	defer m.cbMu.RUnlock()
	for _, cb := range m.callbacks {
		cb(section)
	}
}

// ---------- Path helpers ----------

func (m *ViperManager) GetSocketPath() string {
	m.mu.RLock()
	defer m.mu.RUnlock()
	return system.ExpandPath(m.v.GetString("daemon.socket_path"))
}

func (m *ViperManager) GetImagesDir() string {
	m.mu.RLock()
	defer m.mu.RUnlock()
	return system.ExpandPath(m.v.GetString("daemon.images_dir"))
}

func (m *ViperManager) GetThumbnailsDir() string {
	m.mu.RLock()
	defer m.mu.RUnlock()
	return system.ExpandPath(m.v.GetString("daemon.thumbnails_dir"))
}

func (m *ViperManager) GetDatabaseDir() string {
	m.mu.RLock()
	defer m.mu.RUnlock()
	return system.ExpandPath(m.v.GetString("daemon.database_dir"))
}

func (m *ViperManager) GetLogFile() string {
	m.mu.RLock()
	defer m.mu.RUnlock()
	return system.ExpandPath(m.v.GetString("daemon.log_file"))
}

// ---------- Defaults ----------

func setDefaults(v *viper.Viper) {
	// App defaults
	v.SetDefault("app.kill_daemon_on_exit", false)
	v.SetDefault("app.notifications", true)
	v.SetDefault("app.start_minimized", false)
	v.SetDefault("app.minimize_instead_of_close", false)
	v.SetDefault("app.show_monitor_modal_on_start", false)
	v.SetDefault("app.images_per_page", 50)
	v.SetDefault("app.theme", "dark")
	v.SetDefault("app.image_history_limit", 100)
	v.SetDefault("app.sort_by", "imported_at")
	v.SetDefault("app.sort_order", "desc")

	// Daemon defaults
	v.SetDefault("daemon.images_dir", system.DefaultImagesDir())
	v.SetDefault("daemon.thumbnails_dir", system.DefaultThumbnailsDir())
	v.SetDefault("daemon.database_dir", system.DefaultDatabaseDir())
	v.SetDefault("daemon.socket_path", system.DefaultSocketPath())
	v.SetDefault("daemon.log_level", "info")
	v.SetDefault("daemon.log_file", system.DefaultLogFile())
	v.SetDefault("daemon.log_max_size_mb", 10)
	v.SetDefault("daemon.log_max_backups", 3)
	v.SetDefault("daemon.compositor", "auto")

	// Backend defaults
	v.SetDefault("backend.type", "swww")

	// Wallhaven defaults
	v.SetDefault("wallhaven.scroll_mode", "paginated")

	// Monitors defaults
	v.SetDefault("monitors.selected_monitors", []string{})
	v.SetDefault("monitors.image_set_type", "individual")
}

// ---------- helpers ----------

// isFileNotFound returns true for any error indicating the file does not exist,
// covering both os.ErrNotExist and viper.ConfigFileNotFoundError.
func isFileNotFound(err error) bool {
	if _, ok := err.(viper.ConfigFileNotFoundError); ok {
		return true
	}
	// os.IsNotExist catches the wrapped os-level error.
	return os.IsNotExist(err)
}
