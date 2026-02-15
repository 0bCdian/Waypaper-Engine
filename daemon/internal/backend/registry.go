package backend

import "waypaper-engine/daemon/internal/monitor"

// BackendInfo is the API-facing representation of a registered backend.
// Returned by GET /backends.
type BackendInfo struct {
	// Name is the unique identifier (e.g. "swww", "feh").
	Name string `json:"name"`

	// Available indicates whether the backend's dependencies are installed on this system.
	Available bool `json:"available"`

	// Active indicates whether this is the currently selected backend.
	Active bool `json:"active"`

	// Capabilities describes what the backend supports.
	Capabilities Capabilities `json:"capabilities"`
}

// Registry manages the set of registered backends and tracks which one is active.
//
// All backends are registered at startup. Only one backend is active at a time.
// The registry is used by:
//   - The daemon core to get the active backend for wallpaper operations.
//   - The GET /backends handler to list available backends.
//   - The POST /backends/{name}/activate handler to switch backends.
type Registry interface {
	// Register adds a backend to the registry. Called at startup for each
	// compiled-in backend. Returns an error if a backend with the same name
	// is already registered.
	Register(b Backend) error

	// Get returns a backend by name, or false if not registered.
	Get(name string) (Backend, bool)

	// Active returns the currently active backend.
	// Panics if no backend has been activated (programming error).
	Active() Backend

	// SetActive switches the active backend to the one with the given name.
	// Returns an error if the name is not registered or the backend is not available.
	// Does NOT call Initialize/Shutdown — the caller is responsible for lifecycle.
	SetActive(name string) error

	// Available returns info about all registered backends.
	// Includes both available and unavailable backends.
	Available() []BackendInfo

	// Compatible returns info about backends that support the given compositor.
	Compatible(compositor monitor.CompositorType) []BackendInfo
}
