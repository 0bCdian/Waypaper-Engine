package monitor

import "context"

// MonitorProvider is the interface for a specific monitor detection tool.
//
// Multiple providers can exist for the same compositor. For example, on Wayland:
//   - wayland-utauri (priority 30) — topology from control API when the sidecar is running
//   - wlr-randr (priority 10) — generic wlroots output query
//
// The MonitorManager tries providers in descending priority order and uses the
// first one that is available.
type MonitorProvider interface {
	// Name returns a human-readable identifier for this provider (e.g. "wayland-utauri", "wlr-randr").
	Name() string

	// IsAvailable checks whether the provider's tool is installed and functional.
	// For example, checks if a control socket responds to health checks.
	IsAvailable() bool

	// Compositor returns which compositor type this provider serves.
	Compositor() CompositorType

	// Priority determines provider preference when multiple providers are available
	// for the same compositor. Higher values are preferred.
	// Prefer wayland-utauri control API above generic tools (e.g. wlr-randr priority 10, xrandr 10).
	Priority() int

	// Detect queries the system for all connected monitors and returns their
	// geometry and metadata. This should be a fresh query (not cached).
	Detect(ctx context.Context) ([]Monitor, error)
}
