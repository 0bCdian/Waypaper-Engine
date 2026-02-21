package monitor

import (
	"context"
	"encoding/json"
	"fmt"
	"os/exec"
)

// swaymsgProvider detects monitors via `swaymsg -t get_outputs`, which outputs
// structured JSON. This is the preferred provider for Sway.
type swaymsgProvider struct{}

// NewSwaymsgProvider returns a MonitorProvider that queries Sway's swaymsg.
func NewSwaymsgProvider() MonitorProvider {
	return &swaymsgProvider{}
}

func (p *swaymsgProvider) Name() string {
	return "swaymsg"
}

func (p *swaymsgProvider) IsAvailable() bool {
	_, err := exec.LookPath("swaymsg")
	return err == nil
}

func (p *swaymsgProvider) Compositor() CompositorType {
	return CompositorWayland
}

func (p *swaymsgProvider) Priority() int {
	return 20
}

// swaymsgOutput is the JSON shape returned by `swaymsg -t get_outputs`.
type swaymsgOutput struct {
	Name   string `json:"name"`
	Active bool   `json:"active"`
	Rect   struct {
		X      int `json:"x"`
		Y      int `json:"y"`
		Width  int `json:"width"`
		Height int `json:"height"`
	} `json:"rect"`
	Scale       float64 `json:"scale"`
	Transform   string  `json:"transform"`
	CurrentMode *struct {
		Width   int `json:"width"`
		Height  int `json:"height"`
		Refresh int `json:"refresh"`
	} `json:"current_mode"`
}

func (p *swaymsgProvider) Detect(ctx context.Context) ([]Monitor, error) {
	cmd := exec.CommandContext(ctx, "swaymsg", "-t", "get_outputs")
	output, err := cmd.Output()
	if err != nil {
		return nil, fmt.Errorf("swaymsg -t get_outputs: %w", err)
	}

	var raw []swaymsgOutput
	if err := json.Unmarshal(output, &raw); err != nil {
		return nil, fmt.Errorf("parse swaymsg output: %w", err)
	}

	monitors := make([]Monitor, 0, len(raw))
	for _, m := range raw {
		if !m.Active {
			continue
		}

		width := m.Rect.Width
		height := m.Rect.Height
		var refreshRate float64

		// Prefer current_mode for actual resolution (rect may be scaled).
		if m.CurrentMode != nil {
			width = m.CurrentMode.Width
			height = m.CurrentMode.Height
			// Sway reports refresh in millihertz (e.g. 60000 = 60 Hz).
			refreshRate = float64(m.CurrentMode.Refresh) / 1000.0
		}

		monitors = append(monitors, Monitor{
			Name:        m.Name,
			Width:       width,
			Height:      height,
			X:           m.Rect.X,
			Y:           m.Rect.Y,
			Scale:       m.Scale,
			RefreshRate: refreshRate,
			Transform:   parseTransform(m.Transform),
		})
	}

	return monitors, nil
}
