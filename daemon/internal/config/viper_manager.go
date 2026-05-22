package config

import (
	"encoding/json"
	"errors"
	"fmt"
	"io/fs"
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

	// backendDefaults, set once via EnsureDefaultsPersisted, registers every
	// backend's SetDefault entries onto the throwaway writer Vipers used to
	// persist changes. Without it a write only knows core defaults, so a
	// [backend.<name>] subtable collapses to just the explicitly-set keys and
	// the UI (which reads via Sub) sees the rest as missing. Guarded by mu.
	backendDefaults func(*viper.Viper)
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
	v.OnConfigChange(func(_ fsnotify.Event) {
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

	return m.mergeAndSet(section, values)
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

	return m.mergeAndSet("backend."+backendName, values)
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

	return m.mergeAndSet("backend", map[string]any{"type": name})
}

func (m *ViperManager) GetSelectionMode() string {
	m.mu.RLock()
	defer m.mu.RUnlock()
	mode := m.v.GetString("backend.selection_mode")
	if mode != "auto" {
		return "fixed"
	}
	return "auto"
}

func (m *ViperManager) GetAutoPriorities() AutoPriorities {
	m.mu.RLock()
	defer m.mu.RUnlock()
	return AutoPriorities{
		Image: m.v.GetStringSlice("backend.auto_priorities.image"),
		Video: m.v.GetStringSlice("backend.auto_priorities.video"),
		Web:   m.v.GetStringSlice("backend.auto_priorities.web"),
	}
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

// ResetToFactoryDefaults replaces the persisted config file with built-in defaults (all sections
// plus backend subsections from registerBackendDefaults when non-nil).
//
// registerBackendDefaults must be supplied by the caller (e.g. control passes
// backenddefaults.RegisterInto); this package cannot import backenddefaults without an
// import cycle (backend → config → backenddefaults → backend subpackages → backend).
func (m *ViperManager) ResetToFactoryDefaults(registerBackendDefaults func(*viper.Viper)) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	cfgPath := m.v.ConfigFileUsed()
	fresh := viper.New()
	fresh.SetConfigFile(cfgPath)
	fresh.SetConfigType("toml")
	setDefaults(fresh)
	if registerBackendDefaults != nil {
		registerBackendDefaults(fresh)
	}

	if err := system.EnsureParentDir(cfgPath); err != nil {
		return fmt.Errorf("config: reset ensure parent dir: %w", err)
	}

	_ = os.Remove(cfgPath)

	if err := fresh.WriteConfigAs(cfgPath); err != nil {
		return fmt.Errorf("config: write factory defaults: %w", err)
	}

	if err := m.v.ReadInConfig(); err != nil && !isFileNotFound(err) {
		return fmt.Errorf("config: reload after factory reset: %w", err)
	}

	m.notifyCallbacks("")
	return nil
}

// EnsureDefaultsPersisted records the backend-defaults registrar (so later
// persist operations keep [backend.<name>] subtables complete) and writes the
// config file so it physically contains every default key. Call once at startup
// after every backend has registered its defaults onto Viper().
//
// The write is skipped when the file already holds every in-memory key, so a
// complete, user-edited file is not churned. registerBackendDefaults must be
// supplied by the caller (e.g. backenddefaults.RegisterInto); this package
// cannot import backenddefaults without an import cycle.
func (m *ViperManager) EnsureDefaultsPersisted(registerBackendDefaults func(*viper.Viper)) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	m.backendDefaults = registerBackendDefaults

	cfgPath := m.v.ConfigFileUsed()
	if cfgPath == "" {
		return nil
	}
	if err := system.EnsureParentDir(cfgPath); err != nil {
		return fmt.Errorf("config: ensure dir before persisting defaults: %w", err)
	}

	// Skip the write when every in-memory key (defaults included) is already on
	// disk — avoids rewriting a file that is already complete.
	onDisk := viper.New()
	onDisk.SetConfigFile(cfgPath)
	onDisk.SetConfigType("toml")
	if err := onDisk.ReadInConfig(); err != nil {
		if !isFileNotFound(err) {
			return fmt.Errorf("config: read before persisting defaults: %w", err)
		}
	} else {
		diskKeys := make(map[string]struct{})
		for _, k := range onDisk.AllKeys() {
			diskKeys[k] = struct{}{}
		}
		complete := true
		for _, k := range m.v.AllKeys() {
			if _, ok := diskKeys[k]; !ok {
				complete = false
				break
			}
		}
		if complete {
			return nil
		}
	}

	// m.v already carries the loaded file plus every registered default, so
	// WriteConfigAs emits file values where present and defaults elsewhere.
	if err := m.v.WriteConfigAs(cfgPath); err != nil {
		return fmt.Errorf("config: persist complete defaults: %w", err)
	}
	return nil
}

// ReplaceBackendNamedConfig persists backend.<backendName> as exactly values, dropping any keys
// that existed in that subsection before this call.
func (m *ViperManager) ReplaceBackendNamedConfig(backendName string, values map[string]any) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	key := "backend." + backendName
	copyVals := make(map[string]any, len(values))
	for k, val := range values {
		copyVals[k] = val
	}

	return m.persistKeyReplace(key, copyVals)
}

// ---------- Defaults ----------

func setDefaults(v *viper.Viper) {
	// App defaults
	v.SetDefault("app.kill_daemon_on_exit", false)
	v.SetDefault("app.notifications", true)
	v.SetDefault("app.start_minimized", false)
	v.SetDefault("app.minimize_instead_of_close", false)
	v.SetDefault("app.show_monitor_modal_on_start", true)
	v.SetDefault("app.startup_intro", true)
	v.SetDefault("app.images_per_page", 50)
	v.SetDefault("app.theme", "kolision-raw")
	v.SetDefault("app.font_preset", "bundled")
	v.SetDefault("app.font_family_body", "")
	v.SetDefault("app.font_family_display", "")
	v.SetDefault("app.font_family_mono", "")
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
	v.SetDefault("backend.type", "awww")
	v.SetDefault("backend.selection_mode", "fixed")
	v.SetDefault("backend.auto_priorities.image", []string{"awww", "hyprpaper", "swaybg", "feh", "wal-qt"})
	v.SetDefault("backend.auto_priorities.video", []string{"mpvpaper", "wal-qt"})
	v.SetDefault("backend.auto_priorities.web", []string{"wal-qt"})

	// Wallhaven defaults
	v.SetDefault("wallhaven.api_key", "")
	v.SetDefault("wallhaven.enabled", false)
	v.SetDefault("wallhaven.scroll_mode", "paginated")
	v.SetDefault("wallhaven.blur_nsfw_thumbnails", true)

	// Monitors defaults
	v.SetDefault("monitors.selected_monitors", []string{})
	v.SetDefault("monitors.image_set_type", "individual")
}

// ---------- internal helpers ----------

// newConfigWriter builds a throwaway Viper for persisting changes. It carries
// all defaults — core plus every backend's, once EnsureDefaultsPersisted has run
// — so WriteConfig serializes complete [backend.<name>] subtables instead of
// only the keys physically in the file. It is never used for daemon reads, so
// MergeConfigMap on it cannot create overrides that shadow file values.
// Must be called with m.mu held.
func (m *ViperManager) newConfigWriter(cfgPath string) *viper.Viper {
	writer := viper.New()
	writer.SetConfigFile(cfgPath)
	writer.SetConfigType("toml")
	setDefaults(writer)
	if m.backendDefaults != nil {
		m.backendDefaults(writer)
	}
	return writer
}

// mergeAndSet reads the current value of key as a map, merges values into it,
// writes to the config register (not the override register), and persists.
// Using MergeConfigMap instead of Set avoids creating overrides that would
// permanently shadow file values on subsequent ReadInConfig calls.
// Must be called with m.mu held.
func (m *ViperManager) mergeAndSet(key string, values map[string]any) error {
	cfgPath := m.v.ConfigFileUsed()
	writer := m.newConfigWriter(cfgPath)
	if err := writer.ReadInConfig(); err != nil && !isFileNotFound(err) {
		return fmt.Errorf("config: read before update (%s): %w", key, err)
	}

	existing := writer.GetStringMap(key)
	for k, val := range values {
		existing[k] = val
	}

	if err := writer.MergeConfigMap(map[string]any{key: existing}); err != nil {
		return fmt.Errorf("config: merge after update (%s): %w", key, err)
	}

	if _, err := os.Stat(cfgPath); errors.Is(err, fs.ErrNotExist) {
		if err := writer.WriteConfigAs(cfgPath); err != nil {
			return fmt.Errorf("config: write new file after update (%s): %w", key, err)
		}
	} else if err != nil {
		return fmt.Errorf("config: stat before write (%s): %w", key, err)
	} else if err := writer.WriteConfig(); err != nil {
		return fmt.Errorf("config: write after update (%s): %w", key, err)
	}

	if err := m.v.ReadInConfig(); err != nil && !isFileNotFound(err) {
		return fmt.Errorf("config: reload after update (%s): %w", key, err)
	}
	return nil
}

// persistKeyReplace writes key using exactly vals (no merge). Must be called with m.mu held.
func (m *ViperManager) persistKeyReplace(key string, vals map[string]any) error {
	cfgPath := m.v.ConfigFileUsed()
	writer := m.newConfigWriter(cfgPath)
	if err := writer.ReadInConfig(); err != nil && !isFileNotFound(err) {
		return fmt.Errorf("config: read before replace (%s): %w", key, err)
	}

	if err := writer.MergeConfigMap(map[string]any{key: vals}); err != nil {
		return fmt.Errorf("config: merge replace (%s): %w", key, err)
	}

	if _, err := os.Stat(cfgPath); errors.Is(err, fs.ErrNotExist) {
		if err := writer.WriteConfigAs(cfgPath); err != nil {
			return fmt.Errorf("config: write new file replace (%s): %w", key, err)
		}
	} else if err != nil {
		return fmt.Errorf("config: stat replace (%s): %w", key, err)
	} else if err := writer.WriteConfig(); err != nil {
		return fmt.Errorf("config: write replace (%s): %w", key, err)
	}

	if err := m.v.ReadInConfig(); err != nil && !isFileNotFound(err) {
		return fmt.Errorf("config: reload replace (%s): %w", key, err)
	}
	return nil
}

// ---------- file helpers ----------

// isFileNotFound returns true for any error indicating the file does not exist,
// covering both os.ErrNotExist and viper.ConfigFileNotFoundError.
func isFileNotFound(err error) bool {
	var viperNotFound viper.ConfigFileNotFoundError
	if errors.As(err, &viperNotFound) {
		return true
	}
	return errors.Is(err, fs.ErrNotExist)
}
