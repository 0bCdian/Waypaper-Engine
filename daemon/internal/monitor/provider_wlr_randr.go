package monitor

import (
	"bufio"
	"context"
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
	cmd := exec.CommandContext(ctx, "wlr-randr")
	output, err := cmd.Output()
	if err != nil {
		return nil, fmt.Errorf("wlr-randr: %w", err)
	}

	return parseWlrRandr(string(output))
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
			current.Transform = parseWlrTransform(strings.TrimSpace(strings.TrimPrefix(trimmed, "Transform:")))
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

// parseWlrTransform converts wlr-randr's transform string to the integer code.
func parseWlrTransform(s string) int {
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
