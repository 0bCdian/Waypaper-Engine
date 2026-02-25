package monitor

import (
	"context"
	"encoding/json"
	"fmt"
	"os/exec"
)

// hyprctlProvider detects monitors via `hyprctl monitors -j`, which outputs
// structured JSON. This is the preferred provider for Hyprland.
type hyprctlProvider struct{}

// NewHyprctlProvider returns a MonitorProvider that queries Hyprland's hyprctl.
func NewHyprctlProvider() MonitorProvider {
	return &hyprctlProvider{}
}

func (p *hyprctlProvider) Name() string {
	return "hyprctl"
}

func (p *hyprctlProvider) IsAvailable() bool {
	_, err := exec.LookPath("hyprctl")
	return err == nil
}

func (p *hyprctlProvider) Compositor() CompositorType {
	return CompositorWayland
}

func (p *hyprctlProvider) Priority() int {
	return 20
}

// hyprctlMonitor is the JSON shape returned by `hyprctl monitors -j`.
type hyprctlMonitor struct {
	Name            string  `json:"name"`
	Width           int     `json:"width"`
	Height          int     `json:"height"`
	X               int     `json:"x"`
	Y               int     `json:"y"`
	Scale           float64 `json:"scale"`
	RefreshRate     float64 `json:"refreshRate"`
	Transform       int     `json:"transform"`
	Disabled        bool    `json:"disabled"`
	ActivelyTearing bool    `json:"activelyTearing"`
}

func (p *hyprctlProvider) Detect(ctx context.Context) ([]Monitor, error) {
	cmd := exec.CommandContext(ctx, "hyprctl", "monitors", "-j")
	output, err := cmd.Output()
	if err != nil {
		return nil, fmt.Errorf("hyprctl monitors -j: %w", err)
	}

	var raw []hyprctlMonitor
	if err := json.Unmarshal(output, &raw); err != nil {
		return nil, fmt.Errorf("parse hyprctl output: %w", err)
	}

	monitors := make([]Monitor, 0, len(raw))
	for _, m := range raw {
		if m.Disabled {
			continue
		}
		monitors = append(monitors, Monitor{
			Name:        m.Name,
			Width:       m.Width,
			Height:      m.Height,
			X:           m.X,
			Y:           m.Y,
			Scale:       m.Scale,
			RefreshRate: m.RefreshRate,
			Transform:   m.Transform,
		})
	}

	return monitors, nil
}
