package monitor

import (
	"fmt"
	"strings"
)

// wlrSnapshot is a Go-native, cgo-free representation of one moment of the
// wlr-output-management protocol state. The cgo layer in provider_wayland.go
// fills CWlrState from wayland events, then the boundary copy in
// cWlrStateToGo turns it into a wlrSnapshot. From there everything is pure
// Go and unit-testable.
type wlrSnapshot struct {
	Heads []wlrHead
}

// wlrHead mirrors zwlr_output_head_v1 state. CurrentModeIndex is an index
// into Modes (resolved on the C side), or -1 when the head is disabled or
// the current mode is otherwise unset.
type wlrHead struct {
	Name             string
	Description      string
	Make             string
	Model            string
	Serial           string
	PhysicalWidth    int
	PhysicalHeight   int
	Enabled          bool
	Finished         bool
	X                int
	Y                int
	Transform        int
	Scale            float64
	AdaptiveSync     bool
	Modes            []wlrMode
	CurrentModeIndex int
}

// wlrMode mirrors zwlr_output_mode_v1 state. Refresh is in millihertz, as
// reported by the protocol; the interpreter converts to Hz.
type wlrMode struct {
	Width      int
	Height     int
	RefreshMHz int
}

// interpretWlrSnapshot turns a snapshot into the Monitor list the rest of
// the daemon consumes. This function is the test surface for everything
// that used to be inlined in Detect:
//
//   - finished heads are dropped (the wayland output went away mid-snapshot)
//   - empty names get an "Unknown-N" fallback so downstream code can key off
//     monitor.Name without fearing collisions on a single empty string
//   - a stray trailing space in EDID-derived names is trimmed
//   - the current mode is resolved via CurrentModeIndex; -1 leaves the
//     resolution-related fields at their zero values (matches what the
//     daemon expects for a disabled head)
//   - millihertz refresh is converted to Hz with sub-Hz precision retained
func interpretWlrSnapshot(s wlrSnapshot) []Monitor {
	monitors := make([]Monitor, 0, len(s.Heads))
	for i, h := range s.Heads {
		if h.Finished {
			continue
		}

		name := strings.TrimSpace(h.Name)
		if name == "" {
			name = fmt.Sprintf("Unknown-%d", i)
		}

		mon := Monitor{
			Name:           name,
			Description:    h.Description,
			Make:           h.Make,
			Model:          h.Model,
			Serial:         h.Serial,
			PhysicalWidth:  h.PhysicalWidth,
			PhysicalHeight: h.PhysicalHeight,
			X:              h.X,
			Y:              h.Y,
			Scale:          h.Scale,
			Transform:      h.Transform,
			Enabled:        h.Enabled,
			AdaptiveSync:   h.AdaptiveSync,
		}

		if h.CurrentModeIndex >= 0 && h.CurrentModeIndex < len(h.Modes) {
			m := h.Modes[h.CurrentModeIndex]
			mon.Width = m.Width
			mon.Height = m.Height
			mon.RefreshRate = float64(m.RefreshMHz) / 1000.0
		}

		monitors = append(monitors, mon)
	}
	return monitors
}
