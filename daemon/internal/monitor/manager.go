package monitor

import "context"

// MonitorManager is the high-level interface for monitor management.
//
// It wraps a MonitorProvider with caching and provides a stable interface
// for the rest of the daemon. The concrete implementation:
//   - Auto-detects the compositor at construction time
//   - Selects the highest-priority available provider
//   - Caches the last known monitor list for fast access
//   - Supports forced refresh via Refresh()
type MonitorManager interface {
	// GetMonitors returns the current list of connected monitors.
	// May return a cached result. Call Refresh() first if a fresh query is needed.
	GetMonitors(ctx context.Context) ([]Monitor, error)

	// GetMonitorByName returns a single monitor by its output name (e.g. "HDMI-A-1").
	// Returns an error if the monitor is not found.
	GetMonitorByName(ctx context.Context, name string) (Monitor, error)

	// Refresh forces a fresh query to the underlying provider, updating the cache.
	// Called by GET /monitors to ensure the API returns up-to-date data.
	Refresh(ctx context.Context) error

	// Compositor returns the detected compositor type.
	Compositor() CompositorType
}
