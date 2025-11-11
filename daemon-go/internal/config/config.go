package config

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"waypaper-engine/daemon-go/internal/backend"
	"waypaper-engine/daemon-go/internal/monitor"
	"waypaper-engine/daemon-go/internal/store"

	"github.com/BurntSushi/toml"
)

type AppConfig struct {
	KillDaemonOnExit        bool   `toml:"kill_daemon_on_exit"` // kill daemon on exit or not when the frontend is closed
	Notifications           bool   `toml:"notifications"`
	StartMinimized          bool   `toml:"start_minimized"`
	MinimizeInsteadOfClose  bool   `toml:"minimize_instead_of_close"`
	ShowMonitorModalOnStart bool   `toml:"show_monitor_modal_on_start"` // show monitor modal on start or not
	ImagesPerPage           int    `toml:"images_per_page"`             // number of images to show per page on frontend gallery
	Theme                   string `toml:"theme"`                       // string theme, for daisy ui
	SortBy                  string `toml:"sort_by"`
	SortOrder               string `toml:"sort_order"`          // "asc" | "desc"
	ImageHistoryLimit       int    `toml:"image_history_limit"` // Maximum number of images to store in history
}

type DaemonConfig struct {
	DatabasePath      string `toml:"database_path"`       // where to store the images.json database
	ImagesDir         string `toml:"images_dir"`          // where to copy images when the user add's them to the gallery,
	ThumbnailsDir     string `toml:"thumbnails_dir"`      // Where to create the thumbnails for the images saved
	CacheDir          string `toml:"cache_dir"`           // Where to store processed/split images cache
	MonitorsStateFile string `toml:"monitors_state_file"` // Where to store the current images/montior state, this is where we store which images are set on which monitors, with which backend, etc. So we can restore them at start.
	SocketPath        string `toml:"socket_path"`         // Where to store the socket where the daemon listens for connections
	LogLevel          string `toml:"log_level"`           // Log level: debug, info, warn, error
	LogFile           string `toml:"log_file"`            // Optional log file path
	LogMaxSize        int    `toml:"log_max_size"`        // Max log file size in MB
	LogMaxAge         int    `toml:"log_max_age"`         // Max log age in days
	LogMaxBackups     int    `toml:"log_max_backups"`     // Max log backups to keep
	Compositor        string `toml:"compositor"`          // Force compositor: auto, x11, wayland, by default always auto.
}

type BackendConfig struct {
	Type string `toml:"type"`
	// Dynamic backend configs - each backend can have its own config section
	// This will be populated from TOML sections like [backend.swww], [backend.hyprpaper]
	Swww backend.SwwwConfig `toml:"swww,omitempty"`
	// TODO: Add more backends as they are implemented
}

// Selected monitors refers to "when I get a start playlist/image set command, where to display those images, and how: extend across or duplicate, i nthe frontend this is set by the monitor's modal"
type MonitorsConfig struct {
	SelectedMonitors []string                  `toml:"selected_monitors"`
	ImageSetType     string                    `toml:"image_set_type"`
	ActiveMonitor    *monitor.MonitorSelection `toml:"active_monitor,omitempty"`
}

// This represents the .toml file that is shared between the daemon and the frontend, it is used to store the configuration for the app, daemon, backend, and monitors.
type WaypaperConfig struct {
	App      AppConfig      `toml:"app"`
	Daemon   DaemonConfig   `toml:"daemon"`
	Backend  BackendConfig  `toml:"backend"`
	Monitors MonitorsConfig `toml:"monitors"`
}

type ConfigManager struct {
	configPath string
	config     *WaypaperConfig
	mu         sync.RWMutex

	// File watching
	watchers    []func(string) // Config change callbacks
	lastModTime time.Time

	// Environment detection
	isDev bool

	// Backend config registry
	backendRegistry *BackendConfigRegistry
}

func NewConfigManager(configPath string) *ConfigManager {
	isDev := os.Getenv("DEV") == "true"
	return &ConfigManager{
		configPath:      configPath,
		isDev:           isDev,
		backendRegistry: NewBackendConfigRegistry(),
	}
}

func (cm *ConfigManager) LoadConfig() (*WaypaperConfig, error) {
	// If the config is already loaded, return it
	if cm.config != nil {
		return cm.config, nil
	}

	// Determine the correct config file path based on environment
	configPath := cm.GetConfigFilePath()

	// Ensure the config directory exists
	configDir := filepath.Dir(configPath)
	if err := os.MkdirAll(configDir, 0755); err != nil {
		return nil, fmt.Errorf("failed to create config directory: %w", err)
	}

	// Try to read the config file
	if _, err := os.Stat(configPath); os.IsNotExist(err) {
		// File doesn't exist, create default config
		cm.config = cm.getDefaultConfig()
		if err := cm.SaveConfig(); err != nil {
			return nil, fmt.Errorf("failed to save default config: %w", err)
		}
		return cm.config, nil
	}

	// Read and parse the config file
	var config WaypaperConfig
	if _, err := toml.DecodeFile(configPath, &config); err != nil {
		return nil, fmt.Errorf("failed to parse config file: %w", err)
	}

	// Validate the configuration
	if err := ValidateConfig(&config); err != nil {
		// Log validation warning (using fmt since ConfigManager doesn't have logger yet)
		fmt.Printf("Config validation warning: %v\n", err)
		config = *cm.applyDefaults(&config, err)
	}

	// Expand tilde paths
	cm.config = cm.expandPaths(&config)
	return cm.config, nil
}

func (cm *ConfigManager) SaveConfig() error {
	if cm.config == nil {
		return fmt.Errorf("no config to save")
	}

	// Determine the correct config file path based on environment
	configPath := cm.GetConfigFilePath()

	// Convert paths back to tilde notation for storage
	configToSave := cm.contractPaths(cm.config)

	// Write the config file
	file, err := os.Create(configPath)
	if err != nil {
		return fmt.Errorf("failed to create config file: %w", err)
	}
	defer file.Close()

	encoder := toml.NewEncoder(file)
	if err := encoder.Encode(configToSave); err != nil {
		return fmt.Errorf("failed to encode config: %w", err)
	}

	return nil
}

func (cm *ConfigManager) UpdateConfig(updates *WaypaperConfig) error {
	// For now, just replace the entire config
	// TODO: Implement proper deep merge if needed
	cm.mu.Lock()
	defer cm.mu.Unlock()

	cm.config = updates
	return cm.SaveConfig()
}

func (cm *ConfigManager) GetConfig() (*WaypaperConfig, error) {
	return cm.LoadConfig()
}

func (cm *ConfigManager) expandPaths(config *WaypaperConfig) *WaypaperConfig {
	expanded := *config

	homeDir, err := os.UserHomeDir()
	if err != nil {
		// If we can't get home dir, just return the config as-is
		return &expanded
	}

	expandPath := func(path string) string {
		if strings.HasPrefix(path, "~/") {
			return filepath.Join(homeDir, path[2:])
		}
		return path
	}

	expanded.Daemon.DatabasePath = expandPath(expanded.Daemon.DatabasePath)
	expanded.Daemon.ImagesDir = expandPath(expanded.Daemon.ImagesDir)
	expanded.Daemon.ThumbnailsDir = expandPath(expanded.Daemon.ThumbnailsDir)
	expanded.Daemon.MonitorsStateFile = expandPath(expanded.Daemon.MonitorsStateFile)

	return &expanded
}

func (cm *ConfigManager) contractPaths(config *WaypaperConfig) *WaypaperConfig {
	contracted := *config

	homeDir, err := os.UserHomeDir()
	if err != nil {
		// If we can't get home dir, just return the config as-is
		return &contracted
	}

	contractPath := func(path string) string {
		if strings.HasPrefix(path, homeDir) {
			return "~" + path[len(homeDir):]
		}
		return path
	}

	contracted.Daemon.DatabasePath = contractPath(contracted.Daemon.DatabasePath)
	contracted.Daemon.ImagesDir = contractPath(contracted.Daemon.ImagesDir)
	contracted.Daemon.ThumbnailsDir = contractPath(contracted.Daemon.ThumbnailsDir)
	contracted.Daemon.MonitorsStateFile = contractPath(contracted.Daemon.MonitorsStateFile)

	return &contracted
}

// GetImagesDir returns the images directory path
func (cm *ConfigManager) GetImagesDir() (string, error) {
	config, err := cm.LoadConfig()
	if err != nil {
		return "", err
	}
	return config.Daemon.ImagesDir, nil
}

// GetThumbnailsDir returns the thumbnails directory path
func (cm *ConfigManager) GetThumbnailsDir() (string, error) {
	config, err := cm.LoadConfig()
	if err != nil {
		return "", err
	}
	return config.Daemon.ThumbnailsDir, nil
}

// GetCacheDir returns the cache directory path for processed images
func (cm *ConfigManager) GetCacheDir() (string, error) {
	config, err := cm.LoadConfig()
	if err != nil {
		return "", err
	}

	// If CacheDir is explicitly set, use it
	if config.Daemon.CacheDir != "" {
		return config.Daemon.CacheDir, nil
	}

	// Otherwise, default to thumbnails_dir/processed
	thumbnailsDir, err := cm.GetThumbnailsDir()
	if err != nil {
		return "", err
	}
	return filepath.Join(thumbnailsDir, "processed"), nil
}

// GetDatabasePath returns the database directory path
func (cm *ConfigManager) GetDatabasePath() (string, error) {
	config, err := cm.LoadConfig()
	if err != nil {
		return "", err
	}
	return config.Daemon.DatabasePath, nil
}

// GetMonitorsStateFile returns the monitors state file path
func (cm *ConfigManager) GetMonitorsStateFile() (string, error) {
	config, err := cm.LoadConfig()
	if err != nil {
		return "", err
	}
	return config.Daemon.MonitorsStateFile, nil
}

// GetSocketPath returns the socket path
func (cm *ConfigManager) GetSocketPath() (string, error) {
	config, err := cm.LoadConfig()
	if err != nil {
		return "", err
	}
	return config.Daemon.SocketPath, nil
}

// GetLogFile returns the log file path
func (cm *ConfigManager) GetLogFile() (string, error) {
	config, err := cm.LoadConfig()
	if err != nil {
		return "", err
	}
	return config.Daemon.LogFile, nil
}

// IsDevMode returns true if running in development mode
func (cm *ConfigManager) IsDevMode() bool {
	return cm.isDev
}

// SetActiveBackend sets the active backend type in the TOML config
func (cm *ConfigManager) SetActiveBackend(backendType string) error {
	cm.mu.Lock()
	defer cm.mu.Unlock()

	config, err := cm.LoadConfig()
	if err != nil {
		return err
	}

	config.Backend.Type = backendType
	cm.config = config
	return cm.SaveConfig()
}

// GetActiveBackendType returns the currently active backend type
func (cm *ConfigManager) GetActiveBackendType() string {
	config, err := cm.LoadConfig()
	if err != nil {
		return "swww" // Default fallback
	}
	return config.Backend.Type
}

// GetBackendConfigForType returns the configuration for a specific backend type
func (cm *ConfigManager) GetBackendConfigForType(backendType string) (any, error) {
	// First check if we have it in the registry
	if cm.backendRegistry.HasBackendConfig(backendType) {
		return cm.backendRegistry.GetBackendConfig(backendType)
	}

	// Otherwise, get default config
	return cm.backendRegistry.GetDefaultBackendConfig(backendType)
}

// SetBackendConfigForType sets the configuration for a specific backend type
func (cm *ConfigManager) SetBackendConfigForType(backendType string, config any) error {
	cm.backendRegistry.RegisterBackendConfig(backendType, config)

	// Also update the TOML config if it's the active backend
	if backendType == cm.GetActiveBackendType() {
		cm.mu.Lock()
		defer cm.mu.Unlock()

		waypaperConfig, err := cm.LoadConfig()
		if err != nil {
			return err
		}

		// Update the specific backend config in the TOML structure
		switch backendType {
		case "swww":
			if swwwConfig, ok := config.(backend.SwwwConfig); ok {
				waypaperConfig.Backend.Swww = swwwConfig
			}
			// TODO: Add other backends as they are implemented
		}

		cm.config = waypaperConfig
		return cm.SaveConfig()
	}

	return nil
}

// SetActiveMonitor sets the active monitor selection after validation
func (cm *ConfigManager) SetActiveMonitor(monitorManager interface{}, selection *monitor.MonitorSelection) error {
	// Note: monitorManager parameter is interface{} to avoid circular import
	// The caller should pass the actual monitor manager for validation

	cm.mu.Lock()
	defer cm.mu.Unlock()

	config, err := cm.LoadConfig()
	if err != nil {
		return err
	}

	config.Monitors.ActiveMonitor = selection
	cm.config = config
	return cm.SaveConfig()
}

// GetActiveMonitor returns the currently selected monitor configuration
func (cm *ConfigManager) GetActiveMonitor() (*monitor.MonitorSelection, error) {
	config, err := cm.LoadConfig()
	if err != nil {
		return nil, err
	}
	return config.Monitors.ActiveMonitor, nil
}

// SetAppConfig sets a specific app configuration value
func (cm *ConfigManager) SetAppConfig(key string, value any) error {
	cm.mu.Lock()
	defer cm.mu.Unlock()

	config, err := cm.LoadConfig()
	if err != nil {
		return err
	}

	// Update the specific field based on key
	switch key {
	case "kill_daemon_on_exit":
		if v, ok := value.(bool); ok {
			config.App.KillDaemonOnExit = v
		}
	case "notifications":
		if v, ok := value.(bool); ok {
			config.App.Notifications = v
		}
	case "start_minimized":
		if v, ok := value.(bool); ok {
			config.App.StartMinimized = v
		}
	case "minimize_instead_of_close":
		if v, ok := value.(bool); ok {
			config.App.MinimizeInsteadOfClose = v
		}
	case "show_monitor_modal_on_start":
		if v, ok := value.(bool); ok {
			config.App.ShowMonitorModalOnStart = v
		}
	case "images_per_page":
		if v, ok := value.(int); ok {
			config.App.ImagesPerPage = v
		}
	case "theme":
		if v, ok := value.(string); ok {
			config.App.Theme = v
		}
	case "sort_by":
		if v, ok := value.(string); ok {
			config.App.SortBy = v
		}
	case "sort_order":
		if v, ok := value.(string); ok {
			config.App.SortOrder = v
		}
	case "image_history_limit":
		if v, ok := value.(int); ok {
			config.App.ImageHistoryLimit = v
		}
	default:
		return fmt.Errorf("unknown app config key: %s", key)
	}

	cm.config = config
	return cm.SaveConfig()
}

// GetAppConfig returns the app configuration in the format expected by the frontend
func (cm *ConfigManager) GetAppConfig() *store.AppConfig {
	config, err := cm.LoadConfig()
	if err != nil {
		return &store.AppConfig{
			KillDaemonOnExit:        false,
			Notifications:           true,
			StartMinimized:          false,
			MinimizeInsteadOfClose:  true,
			ShowMonitorModalOnStart: false,
			ImagesPerPage:           20,
		}
	}

	return &store.AppConfig{
		KillDaemonOnExit:        config.App.KillDaemonOnExit,
		Notifications:           config.App.Notifications,
		StartMinimized:          config.App.StartMinimized,
		MinimizeInsteadOfClose:  config.App.MinimizeInsteadOfClose,
		ShowMonitorModalOnStart: config.App.ShowMonitorModalOnStart,
		ImagesPerPage:           config.App.ImagesPerPage,
		ImageHistoryLimit:       config.App.ImageHistoryLimit,
	}
}

// GetConfigFilePath returns the appropriate config file path based on environment
func (cm *ConfigManager) GetConfigFilePath() string {
	homeDir, _ := os.UserHomeDir()
	configDir := filepath.Join(homeDir, ".config", "waypaper-engine")

	if cm.isDev {
		return filepath.Join(configDir, "config-dev.toml")
	}
	return filepath.Join(configDir, "config.toml")
}

// EnsureAllDirectories creates all necessary directories based on the current config
func (cm *ConfigManager) EnsureAllDirectories() error {
	config, err := cm.LoadConfig()
	if err != nil {
		return fmt.Errorf("failed to load config: %w", err)
	}

	// Create all directories from config
	dirs := []string{
		config.Daemon.DatabasePath,
		config.Daemon.ImagesDir,
		config.Daemon.ThumbnailsDir,
		filepath.Dir(config.Daemon.MonitorsStateFile),
		filepath.Dir(config.Daemon.LogFile),
	}

	for _, dir := range dirs {
		if err := os.MkdirAll(dir, 0755); err != nil {
			return fmt.Errorf("failed to create directory %s: %w", dir, err)
		}
	}

	return nil
}

// WatchConfig starts watching the config file for changes
func (cm *ConfigManager) WatchConfig(callback func(string)) error {
	cm.watchers = append(cm.watchers, callback)

	go func() {
		ticker := time.NewTicker(2 * time.Second)
		defer ticker.Stop()

		for range ticker.C {
			if cm.hasConfigChanged() {
				// Reload config
				cm.mu.Lock()
				cm.config = nil // Force reload
				cm.mu.Unlock()

				// Notify all watchers
				for _, watcher := range cm.watchers {
					watcher("config_changed")
				}
			}
		}
	}()

	return nil
}

// hasConfigChanged checks if the config file has been modified
func (cm *ConfigManager) hasConfigChanged() bool {
	configPath := cm.GetConfigFilePath()
	info, err := os.Stat(configPath)
	if err != nil {
		return false
	}

	if info.ModTime().After(cm.lastModTime) {
		cm.lastModTime = info.ModTime()
		return true
	}

	return false
}

func (cm *ConfigManager) getDefaultConfig() *WaypaperConfig {
	homeDir, _ := os.UserHomeDir()
	isDev := os.Getenv("DEV") == "true"

	// Development vs Production paths
	var (
		baseDir       string
		configDir     string
		cacheDir      string
		imagesDir     string
		thumbnailsDir string
		monitorsFile  string
		logFile       string
	)

	if isDev {
		// Development mode: use /tmp/waypaper-engine
		baseDir = "/tmp/waypaper-engine"
		configDir = baseDir
		cacheDir = filepath.Join(baseDir, "data", "cache")
		imagesDir = filepath.Join(baseDir, "images")
		thumbnailsDir = filepath.Join(baseDir, "data", "cache", "thumbnails")
		monitorsFile = filepath.Join(baseDir, "data", "monitors.json")
		logFile = filepath.Join(baseDir, "daemon.log")
	} else {
		// Production mode: use standard user directories
		configDir = filepath.Join(homeDir, ".config", "waypaper-engine")
		cacheDir = filepath.Join(homeDir, ".cache", "waypaper-engine")
		imagesDir = filepath.Join(homeDir, ".waypaper-engine", "images")
		thumbnailsDir = filepath.Join(homeDir, ".waypaper-engine", "data", "cache", "thumbnails")
		monitorsFile = filepath.Join(cacheDir, "monitors.json")
		logFile = filepath.Join(configDir, "daemon.log")
	}

	return &WaypaperConfig{
		App: AppConfig{
			KillDaemonOnExit:        true,
			Notifications:           true,
			StartMinimized:          false,
			MinimizeInsteadOfClose:  true,
			ShowMonitorModalOnStart: false,
			ImagesPerPage:           20,
			Theme:                   "dark",
			SortBy:                  "name",
			SortOrder:               "asc",
			ImageHistoryLimit:       50,
		},
		Daemon: DaemonConfig{
			DatabasePath:      filepath.Join(configDir, "data"),
			ImagesDir:         imagesDir,
			ThumbnailsDir:     thumbnailsDir,
			CacheDir:          filepath.Join(thumbnailsDir, "processed"),
			MonitorsStateFile: monitorsFile,
			SocketPath:        "/tmp/waypaper-engine.sock",
			LogLevel:          "info",
			LogFile:           logFile,
			LogMaxSize:        10,     // 10 MB max log file size
			LogMaxAge:         7,      // Keep logs for 7 days
			LogMaxBackups:     3,      // Keep 3 backup files
			Compositor:        "auto", // Auto-detect compositor
		},
		Backend: BackendConfig{ // Maybe each backend should have a function or satic struct that returns the default config for that backend, so we can use that here.
			Type: "swww",
			Swww: backend.SwwwConfig{
				TransitionType:     "simple",
				TransitionStep:     90,
				TransitionDuration: 200, // Keep as milliseconds in TOML config
				TransitionAngle:    45,
				TransitionPos:      "center",
				TransitionBezier:   "0.4,0.0,0.2,1",
				TransitionWave:     "0,0,0,0",
			},
		},
		Monitors: MonitorsConfig{
			SelectedMonitors: []string{},
			ImageSetType:     "individual",
		},
	}
}

// applyDefaults applies default values for invalid configuration fields
// Currently returns the full default config as a simple fallback.
// A more sophisticated implementation would apply defaults only to invalid fields
// while preserving valid ones, but this approach ensures a working configuration.
func (cm *ConfigManager) applyDefaults(config *WaypaperConfig, validationError error) *WaypaperConfig {
	// Return default config as fallback - ensures daemon can start with valid config
	return cm.getDefaultConfig()
}
