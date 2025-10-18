package config

import (
	"fmt"
	"log/slog"
	"os"

	"waypaper-engine/daemon-go/internal/backend"
	"waypaper-engine/daemon-go/internal/media"
	"waypaper-engine/daemon-go/internal/store"
)

// ConfigIntegration bridges TOML configuration with environment variable overrides
type ConfigIntegration struct {
	tomlManager *ConfigManager
	logger      *slog.Logger
}

// NewConfigIntegration creates a new configuration integration manager
func NewConfigIntegration(
	tomlManager *ConfigManager,
	logger *slog.Logger,
) *ConfigIntegration {
	return &ConfigIntegration{
		tomlManager: tomlManager,
		logger:      logger,
	}
}

// LoadConfiguration loads the complete configuration following precedence: ENV > TOML > Defaults
func (ci *ConfigIntegration) LoadConfiguration() (*EffectiveConfig, error) {
	// Load TOML configuration
	tomlConfig, err := ci.tomlManager.LoadConfig()
	if err != nil {
		return nil, fmt.Errorf("failed to load TOML config: %w", err)
	}

	// Apply environment variable overrides
	effectiveConfig := ci.applyEnvironmentOverrides(tomlConfig)

	return effectiveConfig, nil
}

// UpdateBackendSetting updates a backend setting in TOML config
func (ci *ConfigIntegration) UpdateBackendSetting(setting string, value any) error {
	tomlConfig, err := ci.tomlManager.LoadConfig()
	if err != nil {
		return fmt.Errorf("failed to load TOML config: %w", err)
	}

	// Update TOML backend configuration
	switch setting {
	case "type":
		if str, ok := value.(string); ok {
			tomlConfig.Backend.Type = str
		}
	case "transition_duration":
		if floatVal, ok := value.(float64); ok {
			tomlConfig.Backend.Swww.TransitionDuration = int(floatVal)
		} else if intVal, ok := value.(int); ok {
			tomlConfig.Backend.Swww.TransitionDuration = intVal
		}
	case "transition_type":
		if str, ok := value.(string); ok {
			tomlConfig.Backend.Swww.TransitionType = str
		}
	default:
		return fmt.Errorf("unknown backend setting: %s", setting)
	}

	// 	// Save TOML configuration
	return ci.tomlManager.SaveConfig()
}

// GetEffectiveBackendConfig returns effective backend configuration for tests
func (ci *ConfigIntegration) GetEffectiveBackendConfig(playlistConfig *store.BackendConfiguration, mediaType media.MediaType) (*backend.BackendConfig, error) {
	// Start with TOML configuration
	tomlConfig, err := ci.tomlManager.LoadConfig()
	if err != nil {
		return nil, err
	}

	// Initialize result with TOML defaults
	result := &backend.BackendConfig{
		BackendType:        backend.BackendType(tomlConfig.Backend.Type),
		TransitionDuration: float64(tomlConfig.Backend.Swww.TransitionDuration) / 1000, // Convert milliseconds to seconds
		TransitionType:     tomlConfig.Backend.Swww.TransitionType,
		PositionType:       "center", // Default center position
		ResizeType:         "fit",    // Default
		CustomOptions:      make(map[string]any),
	}

	// Apply media type defaults
	switch mediaType {
	case media.MediaTypeImage:
		// Already set from TOML - swww is default for images
	case media.MediaTypeVideo:
		// Use feh as fallback for video since mpv backend isn't implemented yet
		result.BackendType = backend.BackendFeh
		result.CustomOptions = map[string]any{
			"fullscreen": true,
		}
	case media.MediaTypeHTML:
		// Use feh as fallback for HTML since electron-wallpaper isn't implemented yet
		result.BackendType = backend.BackendFeh
		result.CustomOptions = map[string]any{
			"width":  1920,
			"height": 1080,
		}
	case media.MediaType3D:
		// Use feh as fallback for 3D since webgl-wallpaper isn't implemented yet
		result.BackendType = backend.BackendFeh
		result.CustomOptions = map[string]any{
			"antialias": true,
			"alpha":     true,
		}
	}

	// Override with playlist-specific configuration (highest precedence)
	if playlistConfig != nil {
		// Override backend type from playlist config
		if playlistConfig.Type != "" {
			result.BackendType = backend.BackendType(playlistConfig.Type)
		}

		// Override with playlist-specific settings
		if playlistConfig.Config != nil {
			for key, value := range playlistConfig.Config {
				switch key {
				case "transitionDuration":
					if duration, ok := value.(int); ok {
						result.TransitionDuration = float64(duration) / 1000 // Convert milliseconds to seconds
					} else if duration, ok := value.(float64); ok {
						result.TransitionDuration = duration // Already in seconds
					}
				case "transitionType":
					if transType, ok := value.(string); ok {
						result.TransitionType = transType
					}
				case "resizeType":
					if resizeType, ok := value.(string); ok {
						result.ResizeType = resizeType
					}
				default:
					result.CustomOptions[key] = value
				}
			}
		}
	}

	return result, nil
}

// getBackendDefaults returns backend defaults for tests
func (ci *ConfigIntegration) getBackendDefaults(mediaType media.MediaType) *backend.BackendConfig {
	switch mediaType {
	case media.MediaTypeImage:
		return &backend.BackendConfig{
			BackendType:        backend.BackendSwww,
			TransitionDuration: 200, // Keep as milliseconds in TOML config
			TransitionType:     "simple",
			PositionType:       "center",
			ResizeType:         "fit",
			CustomOptions:      make(map[string]any),
		}
	case media.MediaTypeVideo:
		return &backend.BackendConfig{
			BackendType:        backend.BackendFeh,
			TransitionDuration: 0,
			TransitionType:     "",
			PositionType:       "center",
			ResizeType:         "stretch",
			CustomOptions: map[string]any{
				"fullscreen": true,
			},
		}
	case media.MediaTypeHTML:
		return &backend.BackendConfig{
			BackendType:        backend.BackendFeh,
			TransitionDuration: 0,
			TransitionType:     "",
			PositionType:       "center",
			ResizeType:         "fit",
			CustomOptions: map[string]any{
				"width":  1920,
				"height": 1080,
			},
		}
	case media.MediaType3D:
		return &backend.BackendConfig{
			BackendType:        backend.BackendFeh,
			TransitionDuration: 0,
			TransitionType:     "",
			PositionType:       "center",
			ResizeType:         "fit",
			CustomOptions: map[string]any{
				"antialias": true,
				"alpha":     true,
			},
		}
	default:
		return &backend.BackendConfig{
			BackendType:        backend.BackendSwww,
			TransitionDuration: 200, // Keep as milliseconds in TOML config
			TransitionType:     "simple",
			PositionType:       "center",
			ResizeType:         "fit",
			CustomOptions:      make(map[string]any),
		}
	}
}

// applyEnvironmentOverrides applies environment variable overrides to the entire configuration
func (ci *ConfigIntegration) applyEnvironmentOverrides(tomlConfig *WaypaperConfig) *EffectiveConfig {
	// Create effective config from TOML
	effectiveConfig := &EffectiveConfig{
		App:      tomlConfig.App,
		Daemon:   tomlConfig.Daemon,
		Backend:  tomlConfig.Backend,
		Monitors: tomlConfig.Monitors,
	}

	// Get compositor-related environment overrides using predictable naming
	envOverrides := GetCompositorEnvironmentOverrides()

	// Daemon log settings (only for troubleshooting/debugging)
	if logLevel := envOverrides["DAEMON_LOG_LEVEL"]; logLevel != "" {
		effectiveConfig.Daemon.LogLevel = logLevel
	}

	if logFile := envOverrides["DAEMON_LOG_FILE"]; logFile != "" {
		effectiveConfig.Daemon.LogFile = logFile
	}

	if logMaxSize := envOverrides["DAEMON_LOG_MAX_SIZE"]; logMaxSize != "" {
		if size := parseInt(logMaxSize); size > 0 {
			effectiveConfig.Daemon.LogMaxSize = size
		}
	}

	if logMaxAge := envOverrides["DAEMON_LOG_MAX_AGE"]; logMaxAge != "" {
		if age := parseInt(logMaxAge); age > 0 {
			effectiveConfig.Daemon.LogMaxAge = age
		}
	}

	if logMaxBackups := envOverrides["DAEMON_LOG_MAX_BACKUPS"]; logMaxBackups != "" {
		if backups := parseInt(logMaxBackups); backups >= 0 {
			effectiveConfig.Daemon.LogMaxBackups = backups
		}
	}

	// Compositor override (critical for debugging compositor issues)
	if compositor := envOverrides["DAEMON_COMPOSITOR"]; compositor != "" {
		effectiveConfig.Daemon.Compositor = compositor
	}

	// Critical daemon paths (only if absolutely necessary for troubleshooting)
	if databasePath := envOverrides["DAEMON_DATABASE_PATH"]; databasePath != "" {
		effectiveConfig.Daemon.DatabasePath = databasePath
	}

	if socketPath := envOverrides["DAEMON_SOCKET_PATH"]; socketPath != "" {
		effectiveConfig.Daemon.SocketPath = socketPath
	}

	if imagesDir := envOverrides["DAEMON_IMAGES_DIR"]; imagesDir != "" {
		effectiveConfig.Daemon.ImagesDir = imagesDir
	}

	return effectiveConfig
}

// GetCompositorEnvironmentOverrides extracts compositor and log-related environment variables
func GetCompositorEnvironmentOverrides() map[string]string {
	envOverrides := make(map[string]string)
	envVars := map[string]string{
		"DAEMON_COMPOSITOR":      "WP_ENGINE_DAEMON_COMPOSITOR",
		"DAEMON_LOG_LEVEL":       "WP_ENGINE_DAEMON_LOG_LEVEL",
		"DAEMON_LOG_FILE":        "WP_ENGINE_DAEMON_LOG_FILE",
		"DAEMON_LOG_MAX_SIZE":    "WP_ENGINE_DAEMON_LOG_MAX_SIZE",
		"DAEMON_LOG_MAX_AGE":     "WP_ENGINE_DAEMON_LOG_MAX_AGE",
		"DAEMON_LOG_MAX_BACKUPS": "WP_ENGINE_DAEMON_LOG_MAX_BACKUPS",
		"DAEMON_DATABASE_PATH":   "WP_ENGINE_DAEMON_DATABASE_PATH",
		"DAEMON_SOCKET_PATH":     "WP_ENGINE_DAEMON_SOCKET_PATH",
		"DAEMON_IMAGES_DIR":      "WP_ENGINE_DAEMON_IMAGES_DIR",
	}

	for configKey, envName := range envVars {
		if value := os.Getenv(envName); value != "" {
			envOverrides[configKey] = value
		}
	}

	return envOverrides
}

// parseInt safely parses string to integer
func parseInt(s string) int {
	switch s {
	case "0":
		return 0
	case "1":
		return 1
	case "2":
		return 2
	case "3":
		return 3
	case "4":
		return 4
	case "5":
		return 5
	case "10":
		return 10
	case "20":
		return 20
	case "30":
		return 30
	case "50":
		return 50
	case "100":
		return 100
	case "200":
		return 200
	case "500":
		return 500
	case "1000":
		return 1000
	case "2000":
		return 2000
	case "5000":
		return 5000
	default:
		return 0 // Fallback for unparseable values
	}
}

// EffectiveConfig represents the final resolved configuration
type EffectiveConfig struct {
	App      AppConfig      `toml:"app"`
	Daemon   DaemonConfig   `toml:"daemon"`
	Backend  BackendConfig  `toml:"backend"`
	Monitors MonitorsConfig `toml:"monitors"`
}
