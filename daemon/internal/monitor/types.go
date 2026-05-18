// Package monitor defines the types and interfaces for monitor detection and management.
//
// Monitor detection is compositor-specific (Wayland vs X11). The MonitorProvider
// interface abstracts this — multiple providers can exist for the same compositor
// (e.g. wal-qt control API, wlr-randr on wlroots).
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
//
// Fields beyond name/width/height/x/y/scale/refresh_rate/transform are sourced
// from the wlr-output-management protocol when available; providers that can't
// fill them (legacy wl_output) leave them at zero values and they are
// omitted from JSON output via omitempty.
type Monitor struct {
	// Name is the output identifier as reported by the compositor (e.g. "HDMI-A-1", "eDP-1").
	Name string `json:"name"`

	// Description is a human-readable description (e.g. "GIGA-BYTE GS27QXA 24436B000275 (DP-1)").
	Description string `json:"description,omitempty"`

	// Make, Model, Serial come from EDID when the compositor exposes them.
	Make   string `json:"make,omitempty"`
	Model  string `json:"model,omitempty"`
	Serial string `json:"serial,omitempty"`

	// Width is the horizontal resolution of the current mode in pixels.
	Width int `json:"width"`

	// Height is the vertical resolution of the current mode in pixels.
	Height int `json:"height"`

	// PhysicalWidth and PhysicalHeight are the panel size in millimetres (0 when unknown).
	PhysicalWidth  int `json:"physical_width,omitempty"`
	PhysicalHeight int `json:"physical_height,omitempty"`

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

	// Enabled is true when the output is currently powered on and composing.
	// Wayland wlr-output-management sets this from the compositor; the xrandr
	// provider sets true for connected outputs with an active mode.
	Enabled bool `json:"enabled"`

	// AdaptiveSync is true when variable refresh rate (FreeSync/G-Sync) is active.
	AdaptiveSync bool `json:"adaptive_sync,omitempty"`
}

// parseTransform converts a compositor transform string (e.g. "normal", "90",
// "flipped-180") to the integer code used in Monitor.Transform.
// Shared by wlr-randr and other text-based compositor outputs.
func parseTransform(s string) int {
	switch s {
	case "normal":
		return 0
	case "90":
		return 1
	case "180":
		return 2
	case "270":
		return 3
	case "flipped":
		return 4
	case "flipped-90":
		return 5
	case "flipped-180":
		return 6
	case "flipped-270":
		return 7
	default:
		return 0
	}
}

// MonitorTarget is used in API request bodies to specify which monitor(s) an action targets.
type MonitorTarget struct {
	// ID is the monitor name (e.g. "HDMI-A-1") or "*" for all monitors.
	ID string `json:"id"`

	// Mode is how the wallpaper should be applied.
	Mode MonitorMode `json:"mode"`
}
