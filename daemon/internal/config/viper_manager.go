package config

import (
	"encoding/json"
	"errors"
	"fmt"
	"io/fs"
	"os"
	"path/filepath"
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

	// watcher and watchDone back Close(): watcher is the fsnotify (inotify)
	// instance owned by the goroutine started in startWatch, and watchDone is
	// closed by that goroutine right before it returns. Both are set once in
	// NewViperManager/startWatch, before the *ViperManager is handed to any
	// caller, so reading them in Close() needs no lock. Nil when startWatch
	// failed (watching is best-effort — see NewViperManager).
	watcher   *fsnotify.Watcher
	watchDone chan struct{}
	closeOnce sync.Once

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

	// Start watching for external changes. We deliberately do not use viper's
	// own WatchConfig/OnConfigChange: viper's watcher goroutine calls
	// v.ReadInConfig() directly on m.v, completely unguarded by any lock, which
	// races with every other ViperManager method (including our own writes,
	// which reload m.v via mergeAndSet/persistKeyReplace under m.mu). Every
	// config-writing method here writes to the exact file being watched, so in
	// production this is a real, reachable race, not a test artifact. Running
	// our own loop lets us take m.mu around the reload.
	if err := m.startWatch(configPath); err != nil {
		// Non-critical: the daemon still works without picking up external
		// edits to the config file.
		_ = err
	}

	return m, nil
}

// startWatch begins watching configPath for external changes, mirroring
// viper.Viper.WatchConfig's algorithm (watch the containing directory to catch
// renames/atomic saves, and symlink swaps such as k8s ConfigMap updates) but
// guarding every touch of m.v with m.mu so the watcher goroutine can never run
// concurrently with a request-driven read or write.
func (m *ViperManager) startWatch(configPath string) error {
	watcher, err := fsnotify.NewWatcher()
	if err != nil {
		return err
	}

	configFile := filepath.Clean(configPath)
	configDir := filepath.Dir(configFile)
	realConfigFile, _ := filepath.EvalSymlinks(configPath)

	if err := watcher.Add(configDir); err != nil {
		_ = watcher.Close()
		return err
	}

	m.watcher = watcher
	m.watchDone = make(chan struct{})

	go func() {
		defer close(m.watchDone)
		defer watcher.Close()
		for {
			select {
			case event, ok := <-watcher.Events:
				if !ok {
					return
				}
				currentConfigFile, _ := filepath.EvalSymlinks(configPath)
				if (filepath.Clean(event.Name) == configFile &&
					(event.Has(fsnotify.Write) || event.Has(fsnotify.Create))) ||
					(currentConfigFile != "" && currentConfigFile != realConfigFile) {
					realConfigFile = currentConfigFile

					m.mu.Lock()
					readErr := m.v.ReadInConfig()
					m.mu.Unlock()
					if readErr != nil && !isFileNotFound(readErr) {
						continue
					}
					m.notifyCallbacks("")
				} else if filepath.Clean(event.Name) == configFile && event.Has(fsnotify.Remove) {
					return
				}
			case _, ok := <-watcher.Errors:
				if !ok {
					return
				}
				return
			}
		}
	}()

	return nil
}

// Close stops the config file watcher goroutine and releases its fsnotify
// (inotify) instance, a limited per-user kernel resource. Idempotent and safe
// to call from multiple goroutines or more than once. Blocks until the
// watcher goroutine has actually exited.
//
// Closing is optional for correctness: a ViperManager that is never closed
// keeps behaving exactly as it does today (it just leaks the watcher, same
// as before this method existed). Callers that own a ViperManager for the
// life of a process or long-running test — notably daemon shutdown — should
// call Close to release the inotify instance.
func (m *ViperManager) Close() error {
	var err error
	m.closeOnce.Do(func() {
		if m.watcher == nil {
			// startWatch failed or was never called; nothing to release.
			return
		}
		err = m.watcher.Close()
		<-m.watchDone
	})
	return err
}

// Viper returns the underlying Viper instance, bypassing m.mu entirely.
// Callers MUST NOT use it for general config access — use the ConfigManager
// interface methods instead, which all take m.mu.
//
// Two distinct usage patterns exist among current callers, and only the first
// is safe:
//
//  1. Call once, at startup, before the watcher's writes matter (e.g.
//     Backend.RegisterDefaults(cfg.Viper()), main.go's EnsureDefaultsPersisted
//     sequence). Safe today only because it happens before the HTTP server and
//     any concurrent config activity are live — ordering, not a guarantee this
//     method provides.
//  2. Retain the returned pointer and call read methods (GetString, GetInt,
//     ...) on it later, from goroutines that outlive startup. This is NOT
//     safe: those reads run concurrently with the watcher goroutine's
//     m.mu-guarded ReadInConfig, unguarded by any lock, which is exactly the
//     race this package's fsnotify rewrite (see startWatch) exists to
//     eliminate for every other access path. walqt's monitor provider
//     (internal/backend/walqt/monitor_provider.go, NewMonitorProvider) does
//     this today via a retained *viper.Viper read in Detect().
//
// Do not add a new pattern-2 caller. If you need config access from a
// long-lived component, go through the ConfigManager interface instead.
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

// ---------- Generic key access (backend.ConfigReader) ----------
//
// These implement backend.ConfigReader (structurally — this package does not
// import internal/backend) so backends can retain *ViperManager instead of
// the raw *viper.Viper for reads after startup. See the Viper() doc comment
// for why retaining the raw *viper.Viper is unsafe.

func (m *ViperManager) GetString(key string) string {
	m.mu.RLock()
	defer m.mu.RUnlock()
	return m.v.GetString(key)
}

func (m *ViperManager) GetInt(key string) int {
	m.mu.RLock()
	defer m.mu.RUnlock()
	return m.v.GetInt(key)
}

func (m *ViperManager) GetFloat64(key string) float64 {
	m.mu.RLock()
	defer m.mu.RUnlock()
	return m.v.GetFloat64(key)
}

func (m *ViperManager) GetBool(key string) bool {
	m.mu.RLock()
	defer m.mu.RUnlock()
	return m.v.GetBool(key)
}

func (m *ViperManager) GetStringSlice(key string) []string {
	m.mu.RLock()
	defer m.mu.RUnlock()
	return m.v.GetStringSlice(key)
}

func (m *ViperManager) IsSet(key string) bool {
	m.mu.RLock()
	defer m.mu.RUnlock()
	return m.v.IsSet(key)
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
