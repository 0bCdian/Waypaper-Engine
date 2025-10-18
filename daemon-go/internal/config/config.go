package config

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"waypaper-engine/daemon-go/internal/models"

	"github.com/BurntSushi/toml"
)

type AppConfig struct {
	KillDaemonOnExit        bool   `toml:"kill_daemon_on_exit"`
	Notifications           bool   `toml:"notifications"`
	StartMinimized          bool   `toml:"start_minimized"`
	MinimizeInsteadOfClose  bool   `toml:"minimize_instead_of_close"`
	ShowMonitorModalOnStart bool   `toml:"show_monitor_modal_on_start"`
	ImagesPerPage           int    `toml:"images_per_page"`
	Theme                   string `toml:"theme"`
	SortBy                  string `toml:"sort_by"`
	SortOrder               string `toml:"sort_order"`
	ImageHistoryLimit       int    `toml:"image_history_limit"`
}

type DaemonConfig struct {
	DatabasePath      string `toml:"database_path"`
	ImagesDir         string `toml:"images_dir"`
	ThumbnailsDir     string `toml:"thumbnails_dir"`
	MonitorsStateFile string `toml:"monitors_state_file"`
	SocketPath        string `toml:"socket_path"`
	LogLevel          string `toml:"log_level"`
	LogFile           string `toml:"log_file"`     // Optional log file path
	LogMaxSize        int    `toml:"log_max_size"` // Max log file size in MB
	LogMaxAge         int    `toml:"log_max_age"`  // Max log age in days
	Compositor        string `toml:"compositor"`   // Force compositor: auto, x11, wayland
}

type BackendConfig struct {
	Type string     `toml:"type"`
	Swww SwwwConfig `toml:"swww"`
	// TODO: Implement more backends in future implementations
}

type MonitorsConfig struct {
	SelectedMonitors []string `toml:"selected_monitors"`
	ImageSetType     string   `toml:"image_set_type"`
}

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
}

func NewConfigManager(configPath string) *ConfigManager {
	isDev := os.Getenv("DEV") == "true"
	return &ConfigManager{
		configPath: configPath,
		isDev:      isDev,
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
	currentConfig, err := cm.LoadConfig()
	if err != nil {
		return err
	}

	// Deep merge the updates
	cm.config = cm.deepMerge(currentConfig, updates)
	return cm.SaveConfig()
}

func (cm *ConfigManager) GetConfig() (*WaypaperConfig, error) {
	return cm.LoadConfig()
}

// GetSwwwConfig returns the swww configuration in the format expected by the frontend
func (cm *ConfigManager) GetSwwwConfig() *models.SwwwConfig {
	config, err := cm.LoadConfig()
	if err != nil {
		return &models.SwwwConfig{
			ResizeType:               models.ResizeTypeCrop,
			FillColor:                "#000000",
			FilterType:               models.FilterTypeLanczos3,
			TransitionType:           models.TransitionTypeFade,
			TransitionStep:           90,
			TransitionDuration:       0.2, // 200ms in seconds
			TransitionFPS:            60,
			TransitionAngle:          0,
			TransitionPositionType:   models.TransitionPositionTypeAlias,
			TransitionPosition:       models.TransitionPositionCenter,
			TransitionPositionIntX:   0,
			TransitionPositionIntY:   0,
			TransitionPositionFloatX: 0.5,
			TransitionPositionFloatY: 0.5,
			InvertY:                  false,
			TransitionBezier:         "0.25,0.1,0.25,1",
			TransitionWaveX:          20,
			TransitionWaveY:          20,
		}
	}

	return &models.SwwwConfig{
		ResizeType:               models.ResizeTypeCrop,     // Default since TOML doesn't have this field
		FillColor:                "#000000",                 // Default since TOML doesn't have this field
		FilterType:               models.FilterTypeLanczos3, // Default since TOML doesn't have this field
		TransitionType:           models.TransitionType(config.Backend.Swww.TransitionType),
		TransitionStep:           config.Backend.Swww.TransitionStep,
		TransitionDuration:       float64(config.Backend.Swww.TransitionDuration) / 1000, // Convert milliseconds to seconds
		TransitionFPS:            60,                                                     // Default since TOML doesn't have this field
		TransitionAngle:          int(config.Backend.Swww.TransitionAngle),
		TransitionPositionType:   models.TransitionPositionTypeAlias, // Default since TOML doesn't have this field
		TransitionPosition:       models.TransitionPositionCenter,    // Default since TOML doesn't have this field
		TransitionPositionIntX:   0,                                  // Default since TOML doesn't have this field
		TransitionPositionIntY:   0,                                  // Default since TOML doesn't have this field
		TransitionPositionFloatX: 0.5,                                // Default since TOML doesn't have this field
		TransitionPositionFloatY: 0.5,                                // Default since TOML doesn't have this field
		InvertY:                  false,                              // Default since TOML doesn't have this field
		TransitionBezier:         config.Backend.Swww.TransitionBezier,
		TransitionWaveX:          20, // Default since TOML doesn't have this field
		TransitionWaveY:          20, // Default since TOML doesn't have this field
	}
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

func (cm *ConfigManager) deepMerge(target, source *WaypaperConfig) *WaypaperConfig {
	// For simplicity, we'll just copy the source over the target
	// In a more complex scenario, you'd want to do proper deep merging
	return source
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
	case "random_image_monitor":
		if v, ok := value.(string); ok {
			config.App.RandomImageMonitor = v
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
	case "sidebar_collapsed":
		if v, ok := value.(bool); ok {
			config.App.SidebarCollapsed = v
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
func (cm *ConfigManager) GetAppConfig() *models.AppConfig {
	config, err := cm.LoadConfig()
	if err != nil {
		return &models.AppConfig{
			KillDaemon:              false,
			Notifications:           true,
			StartMinimized:          false,
			MinimizeInsteadOfClose:  true,
			RandomImageMonitor:      "individual",
			ShowMonitorModalOnStart: false,
			ImagesPerPage:           20,
		}
	}

	return &models.AppConfig{
		KillDaemon:              config.App.KillDaemonOnExit,
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
			RandomImageMonitor:      "individual",
			ShowMonitorModalOnStart: false,
			ImagesPerPage:           20,
			Theme:                   "dark",
			SidebarCollapsed:        false,
			SortBy:                  "name",
			SortOrder:               "asc",
			ImageHistoryLimit:       50,
		},
		Daemon: DaemonConfig{
			DatabasePath:      filepath.Join(configDir, "data"),
			ImagesDir:         imagesDir,
			ThumbnailsDir:     thumbnailsDir,
			MonitorsStateFile: monitorsFile,
			SocketPath:        "/tmp/waypaper-engine.sock",
			LogLevel:          "info",
			LogFile:           logFile,
			LogMaxSize:        10,     // 10 MB max log file size
			LogMaxAge:         7,      // Keep logs for 7 days
			LogMaxBackups:     3,      // Keep 3 backup files
			Compositor:        "auto", // Auto-detect compositor
		},
		Backend: BackendConfig{
			Type: "swww",
			Swww: SwwwConfig{
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
