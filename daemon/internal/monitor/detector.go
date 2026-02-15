package monitor

import "os"

// DetectCompositor determines the active compositor type by inspecting
// environment variables in priority order:
//
//  1. $XDG_SESSION_TYPE — "wayland" or "x11" (set by most display managers)
//  2. $WAYLAND_DISPLAY — present when a Wayland compositor is running
//  3. $DISPLAY — present when an X11 server is running
//
// Returns CompositorWayland by default if no signals are found, since Wayland
// is the primary target for waypaper-engine.
func DetectCompositor() CompositorType {
	if sessionType := os.Getenv("XDG_SESSION_TYPE"); sessionType != "" {
		switch sessionType {
		case "wayland":
			return CompositorWayland
		case "x11":
			return CompositorX11
		}
	}

	if os.Getenv("WAYLAND_DISPLAY") != "" {
		return CompositorWayland
	}

	if os.Getenv("DISPLAY") != "" {
		return CompositorX11
	}

	// Default to Wayland — it's the primary target compositor.
	return CompositorWayland
}
