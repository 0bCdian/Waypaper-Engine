package config

import "encoding/json"

// ConfigManager is the interface for all configuration access in the daemon.
//
// It wraps Viper internally but no other package should import Viper directly.
// This keeps the config backend swappable (e.g. for testing with in-memory config)
// and provides a clean API surface.
//
// The TOML file has four top-level sections: app, daemon, backend, monitors.
// The backend section has a special structure: `backend.type` selects the active
// backend, and `backend.<name>` sub-sections hold per-backend config (opaque to core).
//
// Usage patterns:
//
//	cfg, _ := configManager.GetConfig()             // Full config as struct
//	raw, _ := configManager.GetBackendConfig("awww") // Backend config as raw JSON
type ConfigManager interface {
	// --- Full config access ---

	// GetConfig returns the entire configuration as a typed struct.
	// Per-backend config is NOT included in Config.Backend — only the active
	// backend type is. Use GetBackendConfig() for backend-specific config.
	GetConfig() (*Config, error)

	// UpdateConfig applies a partial update to a config section and persists to disk.
	// `section` is one of: "app", "daemon", "backend", "monitors".
	// `values` is a map of key-value pairs to set within that section.
	// Example: UpdateConfig("app", map[string]any{"theme": "dark", "images_per_page": 100})
	UpdateConfig(section string, values map[string]any) error

	// --- Section access ---

	// GetSection returns a config section as a raw map.
	// Useful for the API layer to serialize a section as JSON without knowing its type.
	GetSection(section string) (map[string]any, error)

	// --- Backend-specific config ---

	// GetBackendConfig returns the configuration for a specific backend as raw JSON.
	// Example: GetBackendConfig("awww") returns the JSON for [backend.awww] in the TOML.
	// The shape of the JSON depends on the backend — the daemon core treats it as opaque.
	GetBackendConfig(backendName string) (json.RawMessage, error)

	// SetBackendConfig replaces the configuration for a specific backend and persists.
	// The raw JSON is validated by the backend's ValidateConfig() before calling this.
	SetBackendConfig(backendName string, raw json.RawMessage) error

	// --- Active backend ---

	// GetActiveBackendType returns the name of the currently active backend
	// (the value of `backend.type` in the config file).
	GetActiveBackendType() string

	// SetActiveBackendType updates the active backend in the config and persists.
	SetActiveBackendType(name string) error

	// --- Change notification ---

	// OnConfigChange registers a callback that fires when the config file changes.
	// The callback receives the section name that changed (or "" if unknown).
	// Backed by Viper's WatchConfig() + OnConfigChange() under the hood.
	// Multiple callbacks can be registered; they are called in registration order.
	OnConfigChange(callback func(section string))

	// --- Path helpers ---

	// GetSocketPath returns the resolved (expanded) Unix socket path.
	GetSocketPath() string

	// GetImagesDir returns the resolved (expanded) images cache directory.
	GetImagesDir() string

	// GetThumbnailsDir returns the resolved (expanded) thumbnails directory.
	GetThumbnailsDir() string

	// GetDatabaseDir returns the resolved (expanded) CloverDB database directory.
	GetDatabaseDir() string

	// GetLogFile returns the resolved (expanded) log file path.
	GetLogFile() string
}
