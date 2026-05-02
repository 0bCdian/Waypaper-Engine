package monitor

import (
	"context"
	"fmt"
	"log/slog"
	"os"
	"strings"

	waylandclient "github.com/rajveermalviya/go-wayland/wayland/client"
	xdgoutput "github.com/rajveermalviya/go-wayland/wayland/unstable/xdg-output-v1"
)

// waylandProvider detects monitors natively via the Wayland protocol.
//
// Primary data (roundtrip 1): wl_output v4 — geometry, mode, scale, name.
// Enrichment (roundtrip 2, best-effort): zxdg_output_manager_v1 — logical
// position and size. If the enrichment roundtrip fails, the provider returns
// the wl_output data as-is rather than propagating the error.
type waylandProvider struct{}

// NewWaylandProvider returns a MonitorProvider that queries the Wayland compositor directly.
func NewWaylandProvider() MonitorProvider {
	return &waylandProvider{}
}

func (p *waylandProvider) Name() string            { return "wayland-native" }
func (p *waylandProvider) Compositor() CompositorType { return CompositorWayland }
func (p *waylandProvider) Priority() int           { return 20 }

func (p *waylandProvider) IsAvailable() bool {
	if os.Getenv("WAYLAND_DISPLAY") != "" {
		return true
	}
	rtDir := os.Getenv("XDG_RUNTIME_DIR")
	if rtDir == "" {
		return false
	}
	_, err := os.Stat(rtDir + "/wayland-0")
	return err == nil
}

// outputState accumulates per-output data from Wayland events.
type outputState struct {
	name      string
	width     int
	height    int
	refreshHz float64
	scale     float64
	transform int
	logicalX  int
	logicalY  int
	hasMode   bool
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
				// geometry x/y are compositor-space coords; used as fallback when
				// xdg_output logical position is unavailable.
				if st.logicalX == 0 && st.logicalY == 0 {
					st.logicalX = int(ev.X)
					st.logicalY = int(ev.Y)
				}
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
			// wl_output v4: name event gives the connector name (e.g. "DP-1").
			output.SetNameHandler(func(ev waylandclient.OutputNameEvent) {
				if st.name == "" {
					st.name = strings.TrimSpace(ev.Name)
				}
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

	// Roundtrip 1: enumerate globals; wl_output events (geometry/mode/scale/name) fire here.
	// After this roundtrip we have enough data to build a monitor list.
	if err = roundtrip(display); err != nil {
		return nil, fmt.Errorf("wayland-native: roundtrip 1: %w", err)
	}

	// Roundtrip 2 (best-effort): enrich with xdg_output logical position/name.
	// If xdg_output_manager is not available or the roundtrip fails, we fall
	// back to the wl_output data already collected in roundtrip 1.
	if xdgManager != nil {
		xdgOutputs := make([]*xdgoutput.Output, 0, len(outputs))
		allOK := true
		for _, output := range outputs {
			st := states[output]
			xo, err2 := xdgManager.GetXdgOutput(output)
			if err2 != nil {
				slog.Debug("wayland-native: GetXdgOutput failed", "err", err2)
				allOK = false
				break
			}
			xo.SetNameHandler(func(ev xdgoutput.OutputNameEvent) {
				st.name = strings.TrimSpace(ev.Name)
			})
			xo.SetLogicalPositionHandler(func(ev xdgoutput.OutputLogicalPositionEvent) {
				st.logicalX = int(ev.X)
				st.logicalY = int(ev.Y)
			})
			xdgOutputs = append(xdgOutputs, xo)
		}

		if allOK {
			if err2 := roundtrip(display); err2 != nil {
				// Not fatal: log and continue with roundtrip-1 data.
				slog.Debug("wayland-native: xdg_output roundtrip failed, using wl_output data", "err", err2)
			}
		}

		// Unused but keeps xdgOutputs alive until here (handlers reference states).
		_ = xdgOutputs
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

// roundtrip performs a synchronous Wayland roundtrip by issuing wl_display.sync
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
