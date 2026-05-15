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
	"fmt"
	"strings"

	"waypaper-engine/daemon/internal/media"
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
//   - SetWallpaper() is only called on the active backend.
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

	// Apply applies a Snapshot to the backend. It is the new entry point for
	// wallpaper application; the daemon will call Apply instead of SetWallpaper
	// once all backends have native Snapshot support (T7–T12). Until then each
	// backend provides a shim that translates Snapshot → WallpaperRequest and
	// delegates to SetWallpaper.
	Apply(ctx context.Context, snap Snapshot) error

	// SetWallpaper applies a wallpaper to the specified monitor(s).
	//
	// The WallpaperRequest contains monitor geometry and mode information.
	// For extend mode with static raster images and multiple monitors, the daemon
	// splits the image first and calls SetWallpaper once per monitor with
	// Mode=individual. Interactive media (gif/video/web) uses clone semantics
	// when the user chose extend.
	SetWallpaper(ctx context.Context, req WallpaperRequest) error

	// RegisterDefaults registers this backend's default configuration values with Viper.
	// Called at startup for every registered backend (not just the active one).
	// Example: v.SetDefault("backend.awww.transition_type", "wipe")
	RegisterDefaults(v *viper.Viper)

	// ValidateConfig checks whether the given raw JSON is valid configuration for
	// this backend. Returns nil if valid, or a descriptive error.
	// Called before applying a PATCH /config update to the backend's section.
	ValidateConfig(raw json.RawMessage) error

	// ParseConfig decodes raw JSON into the backend's own typed config struct.
	// The returned value is opaque to the daemon core — it's passed back into
	// SetWallpaper via WallpaperRequest.Config.
	ParseConfig(raw json.RawMessage) (any, error)

	// OnConfigChanged is called when the backend's configuration section is
	// updated via PATCH /config/backends/{name}. Implementations must apply
	// the new config immediately:
	//   - Daemon-process backends (e.g. wal-qt) push the change to
	//     the live renderer without restarting.
	//   - Stateless backends (feh, hyprpaper, mpvpaper, awww) re-apply the
	//     current wallpaper so the new config takes effect immediately.
	//
	// Called only when this backend is the active backend. newConfig is the
	// full backend config section as raw JSON.
	OnConfigChanged(ctx context.Context, newConfig json.RawMessage) error
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

// UnmarshalParseConfig is a generic helper for backends whose ParseConfig
// unmarshals the JSON and returns the typed config pointer.
func UnmarshalParseConfig[T any](raw json.RawMessage, backendName string) (*T, error) {
	var cfg T
	if err := json.Unmarshal(raw, &cfg); err != nil {
		return nil, fmt.Errorf("%s: parse config: %w", backendName, err)
	}
	return &cfg, nil
}

// WallpaperRequest contains everything a backend needs to set a wallpaper.
type WallpaperRequest struct {
	// MediaType is the wallpaper media kind.
	MediaType media.MediaType `json:"media_type"`

	// ImagePath is the absolute filesystem path to the image file.
	ImagePath string `json:"image_path"`

	// IndividualTargets: per-monitor paths for one wal-qt multi-target load (ignored by other backends).
	IndividualTargets []IndividualLoadTarget `json:"-"`

	// AudioEnabled indicates whether audio should be enabled for video media.
	AudioEnabled bool `json:"audio_enabled"`

	// Monitors contains the target monitor(s) with their geometry (position, size).
	// For individual mode, this is a single monitor.
	// For clone/extend modes, this includes all relevant monitors.
	Monitors []monitor.Monitor `json:"monitors"`

	// Mode is how the wallpaper should be applied across monitors.
	Mode monitor.MonitorMode `json:"mode"`

	// WallpaperConfigValues is merged manifest defaults + user overrides for web wallpapers.
	WallpaperConfigValues json.RawMessage `json:"-"`

	// ParallaxDirection is optional waypaper.json override: "horizontal" or "vertical" (empty = backend default only).
	ParallaxDirection string `json:"-"`

	// WaitForCompletion, when true, asks backends that support it to block until the wallpaper
	// operation finishes (e.g. wal-qt POST /wallpaper/load with wait_for_completion).
	// Used for restore to avoid 202 + queued-load races on cold start. Other backends may ignore.
	WaitForCompletion bool `json:"-"`

	// ExtendGroup is populated only when Mode == ModeExtend with a static image
	// split across multiple monitors. It lists all compositor output names that
	// share the same logical source image (including the current monitor).
	// Backends that run a persistent renderer (e.g. wal-qt) use this to
	// coordinate per-output effects (e.g. parallax) so seams stay aligned.
	// Other backends ignore this field.
	ExtendGroup []string `json:"-"`

	// Config is the backend's own typed configuration, as returned by ParseConfig().
	// The daemon core does not inspect this value — it passes it through opaquely.
	// Each backend type-asserts this to its own config struct internally.
	Config any `json:"-"`
}

// IndividualLoadTarget is one compositor output plus its media path for a batched individual load.
type IndividualLoadTarget struct {
	Monitor   monitor.Monitor
	Path      string
	MediaType media.MediaType
}
