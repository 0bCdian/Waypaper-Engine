package config

import (
	"fmt"
	"strings"

	"waypaper-engine/daemon-go/internal/backend"
)

// ValidateConfig validates the configuration
func ValidateConfig(config *WaypaperConfig) error {
	var errors []string

	// Validate App config
	if config.App.ImagesPerPage <= 0 {
		errors = append(errors, "app.images_per_page must be greater than 0")
	}
	if config.App.ImageHistoryLimit < 0 {
		errors = append(errors, "app.image_history_limit must be non-negative")
	}
	validThemes := []string{"light", "dark", "auto"}
	themeValid := false
	for _, theme := range validThemes {
		if config.App.Theme == theme {
			themeValid = true
			break
		}
	}
	if !themeValid {
		errors = append(errors, fmt.Sprintf("app.theme must be one of: %v", validThemes))
	}
	validSortBy := []string{"name", "date", "size"}
	sortByValid := false
	for _, sortBy := range validSortBy {
		if config.App.SortBy == sortBy {
			sortByValid = true
			break
		}
	}
	if !sortByValid {
		errors = append(errors, fmt.Sprintf("app.sort_by must be one of: %v", validSortBy))
	}
	if config.App.SortOrder != "asc" && config.App.SortOrder != "desc" {
		errors = append(errors, "app.sort_order must be 'asc' or 'desc'")
	}

	// Validate Daemon config
	if config.Daemon.LogMaxSize < 0 {
		errors = append(errors, "daemon.log_max_size must be non-negative")
	}
	if config.Daemon.LogMaxAge < 0 {
		errors = append(errors, "daemon.log_max_age must be non-negative")
	}
	if config.Daemon.LogMaxBackups < 0 {
		errors = append(errors, "daemon.log_max_backups must be non-negative")
	}
	validLogLevels := []string{"debug", "info", "warn", "error"}
	logLevelValid := false
	for _, level := range validLogLevels {
		if config.Daemon.LogLevel == level {
			logLevelValid = true
			break
		}
	}
	if !logLevelValid {
		errors = append(errors, fmt.Sprintf("daemon.log_level must be one of: %v", validLogLevels))
	}
	validCompositors := []string{"auto", "x11", "wayland"}
	compositorValid := false
	for _, compositor := range validCompositors {
		if config.Daemon.Compositor == compositor {
			compositorValid = true
			break
		}
	}
	if !compositorValid {
		errors = append(errors, fmt.Sprintf("daemon.compositor must be one of: %v", validCompositors))
	}

	// Validate Backend config
	if err := ValidateBackendConfig(config.Backend.Type, config.Backend.Swww); err != nil {
		errors = append(errors, fmt.Sprintf("backend validation failed: %v", err))
	}

	if len(errors) > 0 {
		return fmt.Errorf("validation errors: %s", strings.Join(errors, "; "))
	}

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
	swwwConfig, ok := config.(backend.SwwwConfig)
	if !ok {
		return fmt.Errorf("invalid config type for swww backend")
	}

	var errors []string

	// Validate transition duration
	if swwwConfig.TransitionDuration < 0 {
		errors = append(errors, "transition_duration must be non-negative")
	}

	// Validate transition step
	if swwwConfig.TransitionStep < 0 {
		errors = append(errors, "transition_step must be non-negative")
	}

	// Validate transition FPS
	if swwwConfig.TransitionFPS < 0 {
		errors = append(errors, "transition_fps must be non-negative")
	}

	// Validate transition type enum
	validTransitionTypes := []backend.TransitionType{
		backend.TransitionTypeNone,
		backend.TransitionTypeSimple,
		backend.TransitionTypeFade,
		backend.TransitionTypeLeft,
		backend.TransitionTypeRight,
		backend.TransitionTypeTop,
		backend.TransitionTypeBottom,
		backend.TransitionTypeWipe,
		backend.TransitionTypeWave,
		backend.TransitionTypeGrow,
		backend.TransitionTypeCenter,
		backend.TransitionTypeAny,
		backend.TransitionTypeOuter,
		backend.TransitionTypeRandom,
	}
	if swwwConfig.TransitionType != "" {
		transitionTypeValid := false
		for _, validType := range validTransitionTypes {
			if swwwConfig.TransitionType == validType {
				transitionTypeValid = true
				break
			}
		}
		if !transitionTypeValid {
			errors = append(errors, fmt.Sprintf("transition_type must be one of: %v", validTransitionTypes))
		}
	}

	if len(errors) > 0 {
		return fmt.Errorf("swww config validation errors: %s", strings.Join(errors, "; "))
	}

	return nil
}

// validateHyprpaperConfig validates Hyprpaper-specific configuration
// Note: Hyprpaper backend is not yet implemented, so validation is a placeholder.
// When the backend is implemented, add specific validation rules here.
func validateHyprpaperConfig(config interface{}) error {
	// Placeholder: Hyprpaper backend not yet implemented
	return nil
}
