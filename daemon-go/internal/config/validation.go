package config

import (
	"fmt"
)

// ValidateConfig validates the configuration
func ValidateConfig(config *WaypaperConfig) error {
	// For now, just return nil to disable validation
	// TODO: Implement custom validation or fix Zog integration
	return nil
}

// ValidateBackendConfig validates backend-specific configuration
func ValidateBackendConfig(backendType string, config interface{}) error {
	switch backendType {
	case "swww":
		return validateSwwwConfig(config)
	case "hyprpaper":
		return validateHyprpaperConfig(config)
	default:
		return fmt.Errorf("unsupported backend type: %s", backendType)
	}
}

// validateSwwwConfig validates Swww-specific configuration
func validateSwwwConfig(config interface{}) error {
	// For now, just return nil - we can add specific Swww validation later
	return nil
}

// validateHyprpaperConfig validates Hyprpaper-specific configuration
func validateHyprpaperConfig(config interface{}) error {
	// For now, just return nil - we can add specific Hyprpaper validation later
	return nil
}
