package monitor

import "context"

// MonitorProvider is the interface for a specific monitor detection tool.
//
// Multiple providers can exist for the same compositor. For example, on Wayland:
//   - hyprctl (priority 20) — best for Hyprland, outputs JSON
//   - swaymsg (priority 20) — best for Sway, outputs JSON
//   - wlr-randr (priority 10) — generic wlroots fallback, text parsing
//
// The MonitorManager tries providers in descending priority order and uses the
// first one that is available.
type MonitorProvider interface {
	// Name returns a human-readable identifier for this provider (e.g. "hyprctl", "wlr-randr").
	Name() string

	// IsAvailable checks whether the provider's tool is installed and functional.
	// For example, checks if `hyprctl` exists in $PATH.
	IsAvailable() bool

	// Compositor returns which compositor type this provider serves.
	Compositor() CompositorType

	// Priority determines provider preference when multiple providers are available
	// for the same compositor. Higher values are preferred.
	// Compositor-specific tools (hyprctl, swaymsg) should use priority 20.
	// Generic tools (wlr-randr, xrandr) should use priority 10.
	Priority() int

	// Detect queries the system for all connected monitors and returns their
	// geometry and metadata. This should be a fresh query (not cached).
	Detect(ctx context.Context) ([]Monitor, error)
}
