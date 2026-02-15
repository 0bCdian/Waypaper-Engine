// Package monitor defines the types and interfaces for monitor detection and management.
//
// Monitor detection is compositor-specific (Wayland vs X11). The MonitorProvider
// interface abstracts this — multiple providers can exist for the same compositor
// (e.g. hyprctl for Hyprland, swaymsg for Sway, wlr-randr as generic fallback).
// The MonitorManager auto-selects the best available provider at startup.
package monitor

// CompositorType identifies the display server protocol in use.
type CompositorType string

const (
	CompositorWayland CompositorType = "wayland"
	CompositorX11     CompositorType = "x11"
)

// MonitorMode defines how a wallpaper is applied across monitors.
type MonitorMode string

const (
	// ModeIndividual sets the wallpaper on a single specific monitor.
	ModeIndividual MonitorMode = "individual"

	// ModeClone sets the same image on every monitor (each monitor shows the full image).
	ModeClone MonitorMode = "clone"

	// ModeExtend spans a single image across all monitors, slicing it based on
	// monitor geometry (position + resolution).
	ModeExtend MonitorMode = "extend"
)

// Monitor represents a single physical display with its geometry and metadata.
type Monitor struct {
	// Name is the output identifier as reported by the compositor (e.g. "HDMI-A-1", "eDP-1").
	Name string `json:"name"`

	// Width is the horizontal resolution in pixels.
	Width int `json:"width"`

	// Height is the vertical resolution in pixels.
	Height int `json:"height"`

	// X is the horizontal position in the compositor's coordinate space.
	// Used for extend mode to compute which slice of the image maps to this monitor.
	X int `json:"x"`

	// Y is the vertical position in the compositor's coordinate space.
	Y int `json:"y"`

	// Scale is the output scale factor (e.g. 1.0, 1.5, 2.0).
	Scale float64 `json:"scale"`

	// RefreshRate is the monitor's refresh rate in Hz (e.g. 60.0, 144.0).
	RefreshRate float64 `json:"refresh_rate"`

	// Transform is the rotation/reflection applied to the output.
	// 0=normal, 1=90°, 2=180°, 3=270°, 4=flipped, 5=flipped-90°, 6=flipped-180°, 7=flipped-270°.
	Transform int `json:"transform"`
}

// MonitorTarget is used in API request bodies to specify which monitor(s) an action targets.
type MonitorTarget struct {
	// ID is the monitor name (e.g. "HDMI-A-1") or "*" for all monitors.
	ID string `json:"id"`

	// Mode is how the wallpaper should be applied.
	Mode MonitorMode `json:"mode"`
}
