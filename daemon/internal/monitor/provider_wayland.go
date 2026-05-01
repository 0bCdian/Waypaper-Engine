package monitor

import (
	"context"
	"fmt"
	"os"
	"strings"

	waylandclient "github.com/rajveermalviya/go-wayland/wayland/client"
	xdgoutput "github.com/rajveermalviya/go-wayland/wayland/unstable/xdg-output-v1"
)

// waylandProvider detects monitors natively via the Wayland protocol.
// It uses wl_output (geometry/mode/scale) and zxdg_output_manager_v1 (name/logical position/size).
// No external binaries required.
type waylandProvider struct{}

// NewWaylandProvider returns a MonitorProvider that queries the Wayland compositor directly.
func NewWaylandProvider() MonitorProvider {
	return &waylandProvider{}
}

func (p *waylandProvider) Name() string      { return "wayland-native" }
func (p *waylandProvider) Compositor() CompositorType { return CompositorWayland }
func (p *waylandProvider) Priority() int     { return 20 }

func (p *waylandProvider) IsAvailable() bool {
	// Available when WAYLAND_DISPLAY or XDG_RUNTIME_DIR+wayland-0 is reachable.
	if os.Getenv("WAYLAND_DISPLAY") != "" {
		return true
	}
	rtDir := os.Getenv("XDG_RUNTIME_DIR")
	if rtDir == "" {
		return false
	}
	sock := rtDir + "/wayland-0"
	_, err := os.Stat(sock)
	return err == nil
}

// outputState accumulates per-output data from Wayland events.
type outputState struct {
	name        string
	width       int
	height      int
	refreshHz   float64
	scale       float64
	transform   int
	logicalX    int
	logicalY    int
	hasMode     bool
	hasLogical  bool
}

func (p *waylandProvider) Detect(ctx context.Context) ([]Monitor, error) {
	display, err := waylandclient.Connect("")
	if err != nil {
		return nil, fmt.Errorf("wayland-native: connect: %w", err)
	}
	defer display.Context().Close()

	registry, err := display.GetRegistry()
	if err != nil {
		return nil, fmt.Errorf("wayland-native: get registry: %w", err)
	}

	var (
		outputs    []*waylandclient.Output
		xdgManager *xdgoutput.OutputManager
		states     = map[*waylandclient.Output]*outputState{}
	)

	registry.SetGlobalHandler(func(e waylandclient.RegistryGlobalEvent) {
		switch e.Interface {
		case "wl_output":
			output := waylandclient.NewOutput(display.Context())
			if err2 := registry.Bind(e.Name, e.Interface, min(e.Version, 4), output); err2 != nil {
				return
			}
			st := &outputState{scale: 1.0}
			states[output] = st

			output.SetGeometryHandler(func(ev waylandclient.OutputGeometryEvent) {
				st.transform = int(ev.Transform)
			})
			output.SetModeHandler(func(ev waylandclient.OutputModeEvent) {
				if ev.Flags&uint32(waylandclient.OutputModeCurrent) != 0 {
					st.width = int(ev.Width)
					st.height = int(ev.Height)
					if ev.Refresh > 0 {
						st.refreshHz = float64(ev.Refresh) / 1000.0
					}
					st.hasMode = true
				}
			})
			output.SetScaleHandler(func(ev waylandclient.OutputScaleEvent) {
				st.scale = float64(ev.Factor)
			})
			outputs = append(outputs, output)

		case "zxdg_output_manager_v1":
			mgr := xdgoutput.NewOutputManager(display.Context())
			if err2 := registry.Bind(e.Name, e.Interface, min(e.Version, 3), mgr); err2 != nil {
				return
			}
			xdgManager = mgr
		}
	})

	// Roundtrip 1: enumerate globals; wl_output geometry/mode/scale events fire here.
	if err = roundtrip(display); err != nil {
		return nil, fmt.Errorf("wayland-native: roundtrip 1: %w", err)
	}

	if xdgManager == nil {
		return nil, fmt.Errorf("wayland-native: compositor does not support zxdg_output_manager_v1")
	}

	// Create xdg_output for each wl_output to get the output name and logical geometry.
	for _, output := range outputs {
		st := states[output]
		xo, err2 := xdgManager.GetXdgOutput(output)
		if err2 != nil {
			continue
		}
		xo.SetNameHandler(func(ev xdgoutput.OutputNameEvent) {
			st.name = strings.TrimSpace(ev.Name)
		})
		xo.SetLogicalPositionHandler(func(ev xdgoutput.OutputLogicalPositionEvent) {
			st.logicalX = int(ev.X)
			st.logicalY = int(ev.Y)
		})
		xo.SetLogicalSizeHandler(func(ev xdgoutput.OutputLogicalSizeEvent) {
			st.hasLogical = true
		})
	}

	// Roundtrip 2: collect xdg_output name/position/size events.
	if err = roundtrip(display); err != nil {
		return nil, fmt.Errorf("wayland-native: roundtrip 2: %w", err)
	}
	// Roundtrip 3: catch trailing done events.
	if err = roundtrip(display); err != nil {
		return nil, fmt.Errorf("wayland-native: roundtrip 3: %w", err)
	}

	monitors := make([]Monitor, 0, len(outputs))
	for _, output := range outputs {
		st := states[output]
		if !st.hasMode || st.width <= 0 || st.height <= 0 {
			continue
		}
		monitors = append(monitors, Monitor{
			Name:        st.name,
			Width:       st.width,
			Height:      st.height,
			X:           st.logicalX,
			Y:           st.logicalY,
			Scale:       st.scale,
			Transform:   st.transform,
			RefreshRate: st.refreshHz,
		})
	}
	return monitors, nil
}

// roundtrip performs a synchronous Wayland roundtrip by issuing a wl_display.sync
// and dispatching events until the done callback fires.
func roundtrip(display *waylandclient.Display) error {
	done := false
	cb, err := display.Sync()
	if err != nil {
		return err
	}
	cb.SetDoneHandler(func(waylandclient.CallbackDoneEvent) {
		done = true
	})
	for !done {
		if err = display.Context().Dispatch(); err != nil {
			return err
		}
	}
	return nil
}

func min(a, b uint32) uint32 {
	if a < b {
		return a
	}
	return b
}
