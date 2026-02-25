package monitor

import (
	"bufio"
	"context"
	"encoding/json"
	"fmt"
	"os/exec"
	"strconv"
	"strings"
)

// wlrRandrProvider detects monitors via `wlr-randr`, a generic wlroots utility.
// It serves as a fallback for any wlroots-based Wayland compositor that doesn't
// have a compositor-specific tool (hyprctl, swaymsg).
//
// wlr-randr output format (example):
//
//	HDMI-A-1 "Monitor Brand Model (HDMI-A-1)"
//	  Enabled: yes
//	  Modes:
//	    2560x1440 px, 143.912 Hz (preferred, current)
//	    1920x1080 px, 60.000 Hz
//	  Position: 0,0
//	  Transform: normal
//	  Scale: 1.000000
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
	if jsonErr == nil {
		monitors, parseErr := parseWlrRandrJSON(jsonOutput)
		if parseErr == nil {
			return monitors, nil
		}
	}

	cmd := exec.CommandContext(ctx, "wlr-randr")
	output, err := cmd.Output()
	if err != nil {
		if jsonErr != nil {
			return nil, fmt.Errorf("wlr-randr --json: %v; wlr-randr: %w", jsonErr, err)
		}
		return nil, fmt.Errorf("wlr-randr: %w", err)
	}

	return parseWlrRandr(string(output))
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

// parseWlrRandr parses the text output of wlr-randr into Monitor structs.
func parseWlrRandr(output string) ([]Monitor, error) {
	var monitors []Monitor
	var current *Monitor
	var enabled bool

	scanner := bufio.NewScanner(strings.NewReader(output))
	for scanner.Scan() {
		line := scanner.Text()

		// Top-level line: output name (no leading whitespace).
		if len(line) > 0 && line[0] != ' ' && line[0] != '\t' {
			// Save the previous monitor if it was enabled.
			if current != nil && enabled {
				monitors = append(monitors, *current)
			}
			name := parseWlrOutputName(line)
			current = &Monitor{Name: name, Scale: 1.0}
			enabled = true
			continue
		}

		if current == nil {
			continue
		}

		trimmed := strings.TrimSpace(line)

		if strings.HasPrefix(trimmed, "Enabled:") {
			enabled = strings.TrimSpace(strings.TrimPrefix(trimmed, "Enabled:")) == "yes"
			continue
		}

		if strings.HasPrefix(trimmed, "Position:") {
			x, y := parseWlrPosition(strings.TrimPrefix(trimmed, "Position:"))
			current.X = x
			current.Y = y
			continue
		}

		if strings.HasPrefix(trimmed, "Transform:") {
			current.Transform = parseTransform(strings.TrimSpace(strings.TrimPrefix(trimmed, "Transform:")))
			continue
		}

		if strings.HasPrefix(trimmed, "Scale:") {
			if s, err := strconv.ParseFloat(strings.TrimSpace(strings.TrimPrefix(trimmed, "Scale:")), 64); err == nil {
				current.Scale = s
			}
			continue
		}

		// Mode line: "2560x1440 px, 143.912 Hz (preferred, current)"
		if strings.Contains(trimmed, " px,") && strings.Contains(trimmed, "(current") {
			w, h, hz := parseWlrMode(trimmed)
			current.Width = w
			current.Height = h
			current.RefreshRate = hz
			continue
		}
	}

	// Don't forget the last monitor.
	if current != nil && enabled {
		monitors = append(monitors, *current)
	}

	return monitors, scanner.Err()
}

// parseWlrOutputName extracts the output name from a top-level line.
// Example input: `HDMI-A-1 "Monitor Brand Model (HDMI-A-1)"`
// Returns: "HDMI-A-1"
func parseWlrOutputName(line string) string {
	if idx := strings.IndexByte(line, ' '); idx != -1 {
		return line[:idx]
	}
	return strings.TrimSpace(line)
}

// parseWlrPosition parses "0,0" or " 0,0" into x, y.
func parseWlrPosition(s string) (int, int) {
	s = strings.TrimSpace(s)
	parts := strings.SplitN(s, ",", 2)
	if len(parts) != 2 {
		return 0, 0
	}
	x, _ := strconv.Atoi(strings.TrimSpace(parts[0]))
	y, _ := strconv.Atoi(strings.TrimSpace(parts[1]))
	return x, y
}

// parseWlrMode extracts width, height, and refresh rate from a mode line.
// Example: "2560x1440 px, 143.912 Hz (preferred, current)"
func parseWlrMode(line string) (width, height int, hz float64) {
	line = strings.TrimSpace(line)

	// Split "2560x1440 px, 143.912 Hz ..."
	pxIdx := strings.Index(line, " px,")
	if pxIdx == -1 {
		return 0, 0, 0
	}
	resPart := line[:pxIdx]
	rest := line[pxIdx+4:] // skip " px,"

	// Parse resolution "2560x1440"
	parts := strings.SplitN(resPart, "x", 2)
	if len(parts) == 2 {
		width, _ = strconv.Atoi(strings.TrimSpace(parts[0]))
		height, _ = strconv.Atoi(strings.TrimSpace(parts[1]))
	}

	// Parse refresh rate "143.912 Hz ..."
	rest = strings.TrimSpace(rest)
	hzIdx := strings.Index(rest, " Hz")
	if hzIdx != -1 {
		hz, _ = strconv.ParseFloat(strings.TrimSpace(rest[:hzIdx]), 64)
	}

	return width, height, hz
}
