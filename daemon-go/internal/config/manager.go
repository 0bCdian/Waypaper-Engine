package config

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"time"

	"waypaper-engine/daemon-go/internal/models"
)

// SetAppConfig sets the application configuration
func (cm *ConfigManager) SetAppConfig(config *models.AppConfig) error {
	cm.mu.Lock()
	defer cm.mu.Unlock()

	cm.appConfig = config
	return cm.saveAppConfig()
}

// SetSwwwConfig sets the swww configuration
func (cm *ConfigManager) SetSwwwConfig(config *models.SwwwConfig) error {
	cm.mu.Lock()
	defer cm.mu.Unlock()

	cm.swwwConfig = config
	return cm.saveSwwwConfig()
}

// GetMonitors returns the monitor configuration
func (cm *ConfigManager) GetMonitors() []models.Monitor {
	cm.mu.RLock()
	defer cm.mu.RUnlock()
	return cm.monitors
}

// SetMonitors sets the monitor configuration
func (cm *ConfigManager) SetMonitors(monitors []models.Monitor) error {
	cm.mu.Lock()
	defer cm.mu.Unlock()

	cm.monitors = monitors
	return cm.saveMonitorsConfig()
}

// GetConfigValue gets a specific configuration value by key
func (cm *ConfigManager) GetConfigValue(key string) (interface{}, error) {
	cm.mu.RLock()
	defer cm.mu.RUnlock()

	// Parse key (e.g., "app.notifications" or "swww.resizeType")
	return cm.getNestedValue(key)
}

// SetConfigValue sets a specific configuration value by key
func (cm *ConfigManager) SetConfigValue(key string, value interface{}) error {
	cm.mu.Lock()
	defer cm.mu.Unlock()

	// Parse key and set nested value
	if err := cm.setNestedValue(key, value); err != nil {
		return err
	}

	// Save the appropriate config file
	return cm.saveConfigByKey(key)
}

// ReloadConfig reloads all configuration files
func (cm *ConfigManager) ReloadConfig() error {
	cm.mu.Lock()
	defer cm.mu.Unlock()

	return cm.loadAllConfigs()
}

// WatchConfig starts watching configuration files for changes
func (cm *ConfigManager) WatchConfig(callback func(string)) error {
	// This is a placeholder - in a real implementation, you'd use fsnotify
	// to watch for file changes and call the callback
	go func() {
		ticker := time.NewTicker(5 * time.Second)
		defer ticker.Stop()

		for range ticker.C {
			// Check if any config files have changed
			if cm.hasConfigChanged() {
				cm.ReloadConfig()
				callback("config_changed")
			}
		}
	}()

	return nil
}

// Private methods

func (cm *ConfigManager) loadAllConfigs() error {
	// Load app config
	if err := cm.loadAppConfig(); err != nil {
		return fmt.Errorf("failed to load app config: %w", err)
	}

	// Load swww config
	if err := cm.loadSwwwConfig(); err != nil {
		return fmt.Errorf("failed to load swww config: %w", err)
	}

	// Load monitors config
	if err := cm.loadMonitorsConfig(); err != nil {
		return fmt.Errorf("failed to load monitors config: %w", err)
	}

	return nil
}

func (cm *ConfigManager) loadAppConfig() error {
	if _, err := os.Stat(cm.appConfigPath); os.IsNotExist(err) {
		// Create default app config
		cm.appConfig = &models.AppConfig{
			KillDaemon:              false,
			Notifications:           true,
			StartMinimized:          false,
			MinimizeInsteadOfClose:  true,
			RandomImageMonitor:      "individual",
			ShowMonitorModalOnStart: true,
			ImagesPerPage:           20,
		}
		return cm.saveAppConfig()
	}

	data, err := os.ReadFile(cm.appConfigPath)
	if err != nil {
		return err
	}

	var config models.AppConfig
	if err := json.Unmarshal(data, &config); err != nil {
		return err
	}

	cm.appConfig = &config
	return nil
}

func (cm *ConfigManager) loadSwwwConfig() error {
	if _, err := os.Stat(cm.swwwConfigPath); os.IsNotExist(err) {
		// Create default swww config
		cm.swwwConfig = &models.SwwwConfig{
			ResizeType:               models.ResizeTypeFit,
			FillColor:                "#000000",
			FilterType:               models.FilterTypeLanczos3,
			TransitionType:           models.TransitionTypeFade,
			TransitionStep:           90,
			TransitionDuration:       200,
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
		return cm.saveSwwwConfig()
	}

	data, err := os.ReadFile(cm.swwwConfigPath)
	if err != nil {
		return err
	}

	var config models.SwwwConfig
	if err := json.Unmarshal(data, &config); err != nil {
		return err
	}

	cm.swwwConfig = &config
	return nil
}

func (cm *ConfigManager) loadMonitorsConfig() error {
	if _, err := os.Stat(cm.monitorsConfigPath); os.IsNotExist(err) {
		// Create default monitors config
		cm.monitors = []models.Monitor{}
		return cm.saveMonitorsConfig()
	}

	data, err := os.ReadFile(cm.monitorsConfigPath)
	if err != nil {
		return err
	}

	var config struct {
		Version  string           `json:"version"`
		Monitors []models.Monitor `json:"monitors"`
	}

	if err := json.Unmarshal(data, &config); err != nil {
		return err
	}

	cm.monitors = config.Monitors
	return nil
}

func (cm *ConfigManager) saveAppConfig() error {
	return cm.saveConfigFile(cm.appConfigPath, cm.appConfig)
}

func (cm *ConfigManager) saveSwwwConfig() error {
	return cm.saveConfigFile(cm.swwwConfigPath, cm.swwwConfig)
}

func (cm *ConfigManager) saveMonitorsConfig() error {
	config := struct {
		Version  string           `json:"version"`
		Monitors []models.Monitor `json:"monitors"`
	}{
		Version:  "1.0.0",
		Monitors: cm.monitors,
	}
	return cm.saveConfigFile(cm.monitorsConfigPath, config)
}

func (cm *ConfigManager) saveConfigFile(path string, data interface{}) error {
	// Create directory if it doesn't exist
	dir := filepath.Dir(path)
	if err := os.MkdirAll(dir, 0755); err != nil {
		return err
	}

	jsonData, err := json.MarshalIndent(data, "", "  ")
	if err != nil {
		return err
	}

	return os.WriteFile(path, jsonData, 0644)
}

func (cm *ConfigManager) getNestedValue(key string) (interface{}, error) {
	// This is a simplified implementation
	// In a real implementation, you'd parse the key and navigate the nested structure
	switch key {
	case "app.notifications":
		return cm.appConfig.Notifications, nil
	case "app.startMinimized":
		return cm.appConfig.StartMinimized, nil
	case "swww.resizeType":
		return cm.swwwConfig.ResizeType, nil
	case "swww.transitionType":
		return cm.swwwConfig.TransitionType, nil
	default:
		return nil, fmt.Errorf("unknown config key: %s", key)
	}
}

func (cm *ConfigManager) setNestedValue(key string, value interface{}) error {
	// This is a simplified implementation
	// In a real implementation, you'd parse the key and set the nested value
	switch key {
	case "app.notifications":
		if v, ok := value.(bool); ok {
			cm.appConfig.Notifications = v
		} else {
			return fmt.Errorf("invalid value type for %s", key)
		}
	case "app.startMinimized":
		if v, ok := value.(bool); ok {
			cm.appConfig.StartMinimized = v
		} else {
			return fmt.Errorf("invalid value type for %s", key)
		}
	case "swww.resizeType":
		if v, ok := value.(string); ok {
			cm.swwwConfig.ResizeType = models.ResizeType(v)
		} else {
			return fmt.Errorf("invalid value type for %s", key)
		}
	case "swww.transitionType":
		if v, ok := value.(string); ok {
			cm.swwwConfig.TransitionType = models.TransitionType(v)
		} else {
			return fmt.Errorf("invalid value type for %s", key)
		}
	default:
		return fmt.Errorf("unknown config key: %s", key)
	}

	return nil
}

func (cm *ConfigManager) saveConfigByKey(key string) error {
	if len(key) >= 4 && key[:4] == "app." {
		return cm.saveAppConfig()
	} else if len(key) >= 6 && key[:6] == "swww." {
		return cm.saveSwwwConfig()
	} else if len(key) >= 9 && key[:9] == "monitors." {
		return cm.saveMonitorsConfig()
	}
	return fmt.Errorf("unknown config type for key: %s", key)
}

func (cm *ConfigManager) hasConfigChanged() bool {
	// This is a placeholder - in a real implementation, you'd check file modification times
	return false
}
