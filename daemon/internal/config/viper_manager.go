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

var validSections = map[string]bool{
	"app":       true,
	"daemon":    true,
	"backend":   true,
	"monitors":  true,
	"wallhaven": true,
}

type ViperManager struct {
	v  *viper.Viper
	mu sync.RWMutex

	watcher   *fsnotify.Watcher
	watchDone chan struct{}
	closeOnce sync.Once

	cbMu      sync.RWMutex
	callbacks []func(section string)

	backendDefaults func(*viper.Viper)
}

var _ ConfigManager = (*ViperManager)(nil)

func NewViperManager(configPath string) (*ViperManager, error) {
	v := viper.New()
	v.SetConfigFile(configPath)
	v.SetConfigType("toml")

	setDefaults(v)

	if err := v.ReadInConfig(); err != nil {
		if _, ok := err.(viper.ConfigFileNotFoundError); !ok {
			if !isFileNotFound(err) {
				return nil, fmt.Errorf("config: read %s: %w", configPath, err)
			}
		}
		if err := system.EnsureParentDir(configPath); err != nil {
			return nil, fmt.Errorf("config: ensure config dir: %w", err)
		}
		if err := v.WriteConfigAs(configPath); err != nil {
			_ = err
		}
	}

	m := &ViperManager{v: v}

	if err := m.startWatch(configPath); err != nil {
		_ = err
	}

	return m, nil
}

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

func (m *ViperManager) Close() error {
	var err error
	m.closeOnce.Do(func() {
		if m.watcher == nil {
			return
		}
		err = m.watcher.Close()
		<-m.watchDone
	})
	return err
}

func (m *ViperManager) Viper() *viper.Viper {
	return m.v
}

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

func (m *ViperManager) GetSection(section string) (map[string]any, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()

	sub := m.v.Sub(section)
	if sub == nil {
		return map[string]any{}, nil
	}

	return sub.AllSettings(), nil
}

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

	if err := m.v.WriteConfigAs(cfgPath); err != nil {
		return fmt.Errorf("config: persist complete defaults: %w", err)
	}
	return nil
}

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

func isFileNotFound(err error) bool {
	var viperNotFound viper.ConfigFileNotFoundError
	if errors.As(err, &viperNotFound) {
		return true
	}
	return errors.Is(err, fs.ErrNotExist)
}
