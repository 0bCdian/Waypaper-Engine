package monitor

import (
	"context"
	"encoding/json"
	"fmt"
	"os/exec"
	"strings"
)

// wlrRandrProvider detects monitors via `wlr-randr`, a generic wlroots utility.
// It is the fallback when wayland-utauri's control socket is unavailable.
type wlrRandrProvider struct{}

// NewWlrRandrProvider returns a MonitorProvider that queries wlr-randr.
func NewWlrRandrProvider() MonitorProvider {
	return &wlrRandrProvider{}
}

func (p *wlrRandrProvider) Name() string {
	return "wlr-randr"
}

func (p *wlrRandrProvider) IsAvailable() bool {
	_, err := exec.LookPath("wlr-randr")
	return err == nil
}

func (p *wlrRandrProvider) Compositor() CompositorType {
	return CompositorWayland
}

func (p *wlrRandrProvider) Priority() int {
	return 10
}

func (p *wlrRandrProvider) Detect(ctx context.Context) ([]Monitor, error) {
	jsonCmd := exec.CommandContext(ctx, "wlr-randr", "--json")
	jsonOutput, jsonErr := jsonCmd.Output()
	if jsonErr != nil {
		return nil, fmt.Errorf("wlr-randr --json: %w", jsonErr)
	}
	monitors, parseErr := parseWlrRandrJSON(jsonOutput)
	if parseErr != nil {
		return nil, fmt.Errorf("parse wlr-randr json: %w", parseErr)
	}
	return monitors, nil
}

type wlrRandrJSONMode struct {
	Width   int     `json:"width"`
	Height  int     `json:"height"`
	Refresh float64 `json:"refresh"`
	Current bool    `json:"current"`
}

type wlrRandrJSONPosition struct {
	X int `json:"x"`
	Y int `json:"y"`
}

type wlrRandrJSONOutput struct {
	Name      string               `json:"name"`
	Enabled   bool                 `json:"enabled"`
	Modes     []wlrRandrJSONMode   `json:"modes"`
	Position  wlrRandrJSONPosition `json:"position"`
	Transform string               `json:"transform"`
	Scale     float64              `json:"scale"`
}

func parseWlrRandrJSON(output []byte) ([]Monitor, error) {
	if len(strings.TrimSpace(string(output))) == 0 {
		return []Monitor{}, nil
	}

	var parsed []wlrRandrJSONOutput
	if err := json.Unmarshal(output, &parsed); err != nil {
		return nil, fmt.Errorf("parse wlr-randr json: %w", err)
	}

	monitors := make([]Monitor, 0, len(parsed))
	for _, display := range parsed {
		if !display.Enabled {
			continue
		}

		monitor := Monitor{
			Name:      display.Name,
			X:         display.Position.X,
			Y:         display.Position.Y,
			Scale:     1.0,
			Transform: parseTransform(display.Transform),
		}
		if display.Scale > 0 {
			monitor.Scale = display.Scale
		}

		for _, mode := range display.Modes {
			if !mode.Current {
				continue
			}
			monitor.Width = mode.Width
			monitor.Height = mode.Height
			monitor.RefreshRate = mode.Refresh
			break
		}

		monitors = append(monitors, monitor)
	}

	return monitors, nil
}
