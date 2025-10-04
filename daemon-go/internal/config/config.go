package config

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"sync"

	"waypaper-engine/daemon-go/internal/models"

	"github.com/BurntSushi/toml"
)

type AppConfig struct {
	KillDaemonOnExit        bool   `toml:"kill_daemon_on_exit"`
	Notifications           bool   `toml:"notifications"`
	StartMinimized          bool   `toml:"start_minimized"`
	MinimizeInsteadOfClose  bool   `toml:"minimize_instead_of_close"`
	RandomImageMonitor      string `toml:"random_image_monitor"`
	ShowMonitorModalOnStart bool   `toml:"show_monitor_modal_on_start"`
	ImagesPerPage           int    `toml:"images_per_page"`
	Theme                   string `toml:"theme"`
	SidebarCollapsed        bool   `toml:"sidebar_collapsed"`
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
	LogFile           string `toml:"log_file"`        // Optional log file path
	LogMaxSize        int    `toml:"log_max_size"`    // Max log file size in MB
	LogMaxAge         int    `toml:"log_max_age"`     // Max log age in days
	LogMaxBackups     int    `toml:"log_max_backups"` // Max backup files
	Compositor        string `toml:"compositor"`      // Force compositor: auto, x11, wayland
}

type SwwwConfig struct {
	TransitionType     string `toml:"transition_type"`
	TransitionStep     int    `toml:"transition_step"`
	TransitionDuration int    `toml:"transition_duration"`
	TransitionAngle    int    `toml:"transition_angle"`
	TransitionPos      string `toml:"transition_pos"`
	TransitionBezier   string `toml:"transition_bezier"`
	TransitionWave     string `toml:"transition_wave"`
}

type BackendConfig struct {
	Type string     `toml:"type"`
	Swww SwwwConfig `toml:"swww"`
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

	// Configuration data
	appConfig  *models.AppConfig
	swwwConfig *models.SwwwConfig
	monitors   []models.Monitor

	// File paths
	appConfigPath      string
	swwwConfigPath     string
	monitorsConfigPath string
}

func NewConfigManager(configPath string) *ConfigManager {
	configDir := filepath.Dir(configPath)
	return &ConfigManager{
		configPath:         configPath,
		appConfigPath:      filepath.Join(configDir, "app.json"),
		swwwConfigPath:     filepath.Join(configDir, "swww.json"),
		monitorsConfigPath: filepath.Join(configDir, "monitors.json"),
	}
}

func (cm *ConfigManager) LoadConfig() (*WaypaperConfig, error) {
	if cm.config != nil {
		return cm.config, nil
	}

	// Ensure the config directory exists
	configDir := filepath.Dir(cm.configPath)
	if err := os.MkdirAll(configDir, 0755); err != nil {
		return nil, fmt.Errorf("failed to create config directory: %w", err)
	}

	// Try to read the config file
	if _, err := os.Stat(cm.configPath); os.IsNotExist(err) {
		// File doesn't exist, create default config
		cm.config = cm.getDefaultConfig()
		if err := cm.SaveConfig(); err != nil {
			return nil, fmt.Errorf("failed to save default config: %w", err)
		}
		return cm.config, nil
	}

	// Read and parse the config file
	var config WaypaperConfig
	if _, err := toml.DecodeFile(cm.configPath, &config); err != nil {
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

	// Convert paths back to tilde notation for storage
	configToSave := cm.contractPaths(cm.config)

	// Write the config file
	file, err := os.Create(cm.configPath)
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
		RandomImageMonitor:      config.App.RandomImageMonitor,
		ShowMonitorModalOnStart: config.App.ShowMonitorModalOnStart,
		ImagesPerPage:           config.App.ImagesPerPage,
		ImageHistoryLimit:       config.App.ImageHistoryLimit,
	}
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
		TransitionFPS:            60, // Default since TOML doesn't have this field
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

func (cm *ConfigManager) getDefaultConfig() *WaypaperConfig {
	homeDir, _ := os.UserHomeDir()

	// Check if we're in development mode
	var baseDir string
	if os.Getenv("DEV") == "true" {
		baseDir = "/tmp/waypaper-engine"
	} else {
		baseDir = homeDir
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
			DatabasePath:      filepath.Join(baseDir, ".waypaper-engine", "data"),
			ImagesDir:         filepath.Join(baseDir, ".waypaper-engine", "images"),
			ThumbnailsDir:     filepath.Join(baseDir, ".waypaper-engine", "data", "cache", "thumbnails"),
			MonitorsStateFile: filepath.Join(baseDir, ".cache", "waypaper-engine", "monitors.json"),
			SocketPath:        "/tmp/waypaper-engine.sock",
			LogLevel:          "info",
			LogFile:           "",     // Empty means no log file (stdout only)
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
