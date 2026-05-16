// Package backend defines the interfaces and types for wallpaper backend abstraction.
//
// Each backend (awww, feh, hyprpaper, etc.) implements the Backend interface.
// Backends are compiled into the daemon binary and registered at startup via the Registry.
//
// The daemon core never inspects backend-specific configuration — it treats it as opaque
// json.RawMessage or typed `any` values that only the backend itself understands.
package backend

import (
	"context"
	"encoding/json"
	"strings"

	"waypaper-engine/daemon/internal/monitor"

	"github.com/spf13/viper"
)

// WalQtBackendName is the stable Name() value for the wal-qt backend.
const WalQtBackendName = "wal-qt"

// Backend is the core interface that every wallpaper backend must implement.
//
// Lifecycle:
//   - RegisterDefaults() is called once at startup for ALL registered backends.
//   - Initialize() is called only on the ACTIVE backend when the daemon starts
//     or when switching to this backend via POST /backends/{name}/activate.
//   - Shutdown() is called when the daemon stops or when switching away from this backend.
//   - Apply() is only called on the active backend.
type Backend interface {
	// Name returns the unique identifier for this backend (e.g. "awww", "feh", "hyprpaper").
	Name() string

	// IsAvailable checks whether the backend's external dependencies are installed
	// on the system (e.g. the `awww` binary exists in $PATH).
	// This is a runtime check, not a compile-time one.
	IsAvailable() bool

	// Capabilities returns what this backend supports. The daemon and frontend use this
	// to adapt behavior (e.g. hide transition UI if Transitions is false).
	Capabilities() Capabilities

	// Initialize prepares the backend for use. For daemon-based backends (e.g. awww),
	// this starts the background process. For simple backends (e.g. feh), this may be a no-op.
	// Called once when the backend becomes active.
	Initialize(ctx context.Context) error

	// Shutdown cleans up resources. For daemon-based backends, this stops the background
	// process. Called when the backend is deactivated or when the daemon exits.
	Shutdown(ctx context.Context) error

	// Apply applies a Snapshot to all outputs. Returns nil only if every output
	// in the snapshot was successfully applied. On error, display state is
	// indeterminate; the caller must not assume rollback.
	Apply(ctx context.Context, snap Snapshot) error

	// RegisterDefaults registers this backend's default configuration values with Viper.
	// Called at startup for every registered backend (not just the active one).
	// Example: v.SetDefault("backend.awww.transition_type", "wipe")
	RegisterDefaults(v *viper.Viper)

	// ValidateConfig checks whether the given raw JSON is valid configuration for
	// this backend. Returns nil if valid, or a descriptive error.
	// Called before applying a PATCH /config update to the backend's section.
	ValidateConfig(raw json.RawMessage) error
}

// Capabilities declares what a backend supports.
type Capabilities struct {
	// ContentKinds lists the Content variants this backend can display.
	ContentKinds []ContentKind `json:"content_kinds"`

	// Compositors lists which display server protocols this backend works with.
	Compositors []monitor.CompositorType `json:"compositors"`
}

// SupportsMedia reports whether caps handles the given media type string.
// An empty mediaType is treated as "image" (the default).
func SupportsMedia(caps Capabilities, mediaType string) bool {
	kind := mediaTypeToContentKind(strings.ToLower(strings.TrimSpace(mediaType)))
	for _, k := range caps.ContentKinds {
		if k == kind {
			return true
		}
	}
	return false
}

// mediaTypeToContentKind maps legacy media type strings to ContentKind values.
// "gif" and "image" both resolve to their respective kinds; empty → KindStaticImage.
func mediaTypeToContentKind(mt string) ContentKind {
	switch mt {
	case "gif":
		return KindGIF
	case "video":
		return KindVideo
	case "web":
		return KindWebWallpaper
	default:
		return KindStaticImage
	}
}

// UnmarshalValidateConfig is a generic helper for backends whose ValidateConfig
// just unmarshals the JSON into their typed config struct.
func UnmarshalValidateConfig[T any](raw json.RawMessage) error {
	var cfg T
	return json.Unmarshal(raw, &cfg)
}
