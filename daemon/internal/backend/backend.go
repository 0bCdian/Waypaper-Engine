// Package backend defines the interfaces and types for wallpaper backend abstraction.
//
// Each backend (swww, feh, hyprpaper, etc.) implements the Backend interface.
// Backends are compiled into the daemon binary and registered at startup via the Registry.
//
// The daemon core never inspects backend-specific configuration — it treats it as opaque
// json.RawMessage or typed `any` values that only the backend itself understands.
package backend

import (
	"context"
	"encoding/json"

	"waypaper-engine/daemon/internal/media"
	"waypaper-engine/daemon/internal/monitor"

	"github.com/spf13/viper"
)

// Backend is the core interface that every wallpaper backend must implement.
//
// Lifecycle:
//   - RegisterDefaults() is called once at startup for ALL registered backends.
//   - Initialize() is called only on the ACTIVE backend when the daemon starts
//     or when switching to this backend via POST /backends/{name}/activate.
//   - Shutdown() is called when the daemon stops or when switching away from this backend.
//   - SetWallpaper() is only called on the active backend.
type Backend interface {
	// Name returns the unique identifier for this backend (e.g. "swww", "feh", "hyprpaper").
	Name() string

	// IsAvailable checks whether the backend's external dependencies are installed
	// on the system (e.g. the `swww` binary exists in $PATH).
	// This is a runtime check, not a compile-time one.
	IsAvailable() bool

	// Capabilities returns what this backend supports. The daemon and frontend use this
	// to adapt behavior (e.g. skip image splitting if NativeExtend is true, hide
	// transition UI if Transitions is false).
	Capabilities() Capabilities

	// Initialize prepares the backend for use. For daemon-based backends (e.g. swww),
	// this starts the background process. For simple backends (e.g. feh), this may be a no-op.
	// Called once when the backend becomes active.
	Initialize(ctx context.Context) error

	// Shutdown cleans up resources. For daemon-based backends, this stops the background
	// process. Called when the backend is deactivated or when the daemon exits.
	Shutdown(ctx context.Context) error

	// SetWallpaper applies a wallpaper to the specified monitor(s).
	//
	// The WallpaperRequest contains monitor geometry and mode information.
	// For backends with NativeExtend=false, the daemon will have already split
	// the image and will call SetWallpaper once per monitor with Mode="individual".
	// For backends with NativeExtend=true, the daemon passes the full image and
	// all monitors, letting the backend handle spanning.
	SetWallpaper(ctx context.Context, req WallpaperRequest) error

	// RegisterDefaults registers this backend's default configuration values with Viper.
	// Called at startup for every registered backend (not just the active one).
	// Example: v.SetDefault("backend.swww.transition_type", "wipe")
	RegisterDefaults(v *viper.Viper)

	// ValidateConfig checks whether the given raw JSON is valid configuration for
	// this backend. Returns nil if valid, or a descriptive error.
	// Called before applying a PATCH /config update to the backend's section.
	ValidateConfig(raw json.RawMessage) error

	// ParseConfig decodes raw JSON into the backend's own typed config struct.
	// The returned value is opaque to the daemon core — it's passed back into
	// SetWallpaper via WallpaperRequest.Config.
	ParseConfig(raw json.RawMessage) (any, error)
}

// Capabilities declares what a backend supports. Used by the daemon to adapt its
// behavior and by the frontend to show/hide UI elements.
type Capabilities struct {
	// Compositors lists which display server protocols this backend works with.
	Compositors []monitor.CompositorType `json:"compositors"`

	// MediaTypes lists what kinds of media this backend can display.
	MediaTypes []media.MediaType `json:"media_types"`

	// Transitions indicates whether the backend supports animated transitions
	// between wallpapers (e.g. fade, wipe, grow).
	Transitions bool `json:"transitions"`

	// PerMonitor indicates whether the backend can target a single monitor.
	// If false, the backend can only set the wallpaper for all monitors at once
	// (e.g. feh on X11 sets the root window).
	PerMonitor bool `json:"per_monitor"`

	// NativeExtend indicates whether the backend can span a single image across
	// multiple monitors by itself. If false, the daemon performs image splitting
	// before calling SetWallpaper.
	NativeExtend bool `json:"native_extend"`

	// DaemonProcess indicates whether the backend requires a long-running
	// background process (e.g. swww-daemon, hyprpaper).
	DaemonProcess bool `json:"daemon_process"`
}

// WallpaperRequest contains everything a backend needs to set a wallpaper.
type WallpaperRequest struct {
	// ImagePath is the absolute filesystem path to the image file.
	ImagePath string `json:"image_path"`

	// Monitors contains the target monitor(s) with their geometry (position, size).
	// For individual mode, this is a single monitor.
	// For clone/extend modes, this includes all relevant monitors.
	Monitors []monitor.Monitor `json:"monitors"`

	// Mode is how the wallpaper should be applied across monitors.
	Mode monitor.MonitorMode `json:"mode"`

	// Config is the backend's own typed configuration, as returned by ParseConfig().
	// The daemon core does not inspect this value — it passes it through opaquely.
	// Each backend type-asserts this to its own config struct internally.
	Config any `json:"-"`
}
