package monitor

import (
	"fmt"
	"os"
)

// DetectCompositor detects the current compositor environment
func DetectCompositor() (*CompositorInfo, error) {
	sessionType := os.Getenv("XDG_SESSION_TYPE")

	if sessionType == "wayland" {
		return &CompositorInfo{
			Type: CompositorTypeWayland,
		}, nil
	}

	if sessionType == "x11" {
		return &CompositorInfo{
			Type: CompositorTypeX11,
		}, nil
	}

	// Fallback to environment variables
	if waylandDisplay := os.Getenv("WAYLAND_DISPLAY"); waylandDisplay != "" {
		return &CompositorInfo{
			Type: CompositorTypeWayland,
		}, nil
	}

	if x11Display := os.Getenv("DISPLAY"); x11Display != "" {
		return &CompositorInfo{
			Type: CompositorTypeX11,
		}, nil
	}

	return nil, fmt.Errorf("no compositor detected")
}

// CreateMonitorManager creates a monitor manager for the detected compositor
func CreateMonitorManager(compositorInfo *CompositorInfo) (MonitorManager, error) {
	// Use unified implementation
	return NewUnifiedMonitorManager()
}

// GetPrimaryMonitorFromMap returns the primary monitor from a map
func GetPrimaryMonitorFromMap(monitors Monitors) *Monitor {
	for _, monitor := range monitors {
		if monitor.Position.X == 0 && monitor.Position.Y == 0 {
			return &monitor
		}
	}
	// If no monitor at origin, return the first one
	for _, monitor := range monitors {
		return &monitor
	}
	return nil
}
