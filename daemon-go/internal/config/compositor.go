package config

import (
	"fmt"
	"os"
	"strings"
)

// CompositorType represents the type of display server/compositor
type CompositorType string

const (
	CompositorAuto    CompositorType = "auto"
	CompositorX11     CompositorType = "x11"
	CompositorWayland CompositorType = "wayland"
)

// CompositorDetector detects the current compositor/display server
type CompositorDetector struct {
	// Cache detected compositor to avoid repeated detection
	cachedCompositor CompositorType
	cached           bool
}

// NewCompositorDetector creates a new compositor detector
func NewCompositorDetector() *CompositorDetector {
	return &CompositorDetector{}
}

// DetectCompositor detects the current compositor/display server
func (cd *CompositorDetector) DetectCompositor() CompositorType {
	if cd.cached {
		return cd.cachedCompositor
	}

	// Check environment variables first
	if display := os.Getenv("WAYLAND_DISPLAY"); display != "" {
		cd.cachedCompositor = CompositorWayland
		cd.cached = true
		return cd.cachedCompositor
	}

	if display := os.Getenv("DISPLAY"); display != "" {
		// Additional checks to distinguish between pure X11 and Wayland-on-X11
		if session := os.Getenv("XDG_SESSION_TYPE"); session != "" {
			switch strings.ToLower(session) {
			case "wayland":
				cd.cachedCompositor = CompositorWayland
			case "x11":
				cd.cachedCompositor = CompositorX11
			default:
				cd.cachedCompositor = CompositorX11 // Default fallback
			}
		} else {
			cd.cachedCompositor = CompositorX11
		}
		cd.cached = true
		return cd.cachedCompositor
	}

	// If no display variables are set, check for specific directories/files
	if _, err := os.Stat("/proc/self/files"); err == nil {
		// Check if any file descriptors contain wayland/x11 references
		if cd.checkProcFiles() {
			cd.cachedCompositor = CompositorWayland
		} else {
			cd.cachedCompositor = CompositorX11
		}
	} else {
		// Ultimate fallback - assume X11
		cd.cachedCompositor = CompositorX11
	}

	cd.cached = true
	return cd.cachedCompositor
}

// DetectCompositorWithOverride detects compositor with potential override
func (cd *CompositorDetector) DetectCompositorWithOverride(override CompositorType) CompositorType {
	if override != CompositorAuto {
		return override
	}
	return cd.DetectCompositor()
}

// checkProcFiles checks /proc/self/fd for wayland/x11 indicators
func (cd *CompositorDetector) checkProcFiles() bool {
	// This is a simplified check - in reality you'd read /proc/self/fd/* and check symlinks
	// For now, we'll use additional environment hints

	// Check for specific Wayland session variables
	waylandVars := []string{
		"GDK_BACKEND",
		"QT_QPA_PLATFORM",
		"WL_DISPLAY",
	}

	for _, varName := range waylandVars {
		if val := os.Getenv(varName); val != "" && strings.Contains(strings.ToLower(val), "wayland") {
			return true
		}
	}

	return false
}

// ValidateCompositorCompatibility checks if a backend is compatible with the current compositor
func ValidateCompositorCompatibility(backendType string, requiredSupportedCompositor CompositorType, currentCompositor CompositorType) error {
	if backendType != "" {
		// For now, we'll do basic compatibility checking
		// This would be expanded based on actual backend capabilities

		switch backendType {
		case "swww":
			// SWW is Wayland-only
			if currentCompositor != CompositorWayland {
				return fmt.Errorf("backend '%s' requires Wayland compositor, but current compositor is %s", backendType, currentCompositor)
			}
		case "feh", "nitrogen", "xsetbg":
			// These are X11-only
			if currentCompositor != CompositorX11 {
				return fmt.Errorf("backend '%s' requires X11 compositor, but current compositor is %s", backendType, currentCompositor)
			}
		case "mpv", "vlc", "ffplay":
			// These work on both
			// No restriction - they can work with both X11 and Wayland
		case "electron-wallpaper", "webgl-wallpaper", "gstreamer-wallpaper":
			// Modern backends that can work with both
			// No restriction
		default:
			// Unknown backend - default to allowing it and letting the backend itself fail
			// This preserves backward compatibility
		}
	}

	return nil
}

// GetCompositorEnvironmentVariables returns environment variable names for compositor overrides
func GetCompositorEnvironmentVariables() map[string]string {
	return map[string]string{
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
}

// GetCompositorEnvironmentOverrides is defined in integration.go
