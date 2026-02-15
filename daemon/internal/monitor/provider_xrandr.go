package monitor

import (
	"bufio"
	"context"
	"fmt"
	"os/exec"
	"strconv"
	"strings"
)

// xrandrProvider detects monitors via `xrandr --query` for X11 sessions.
//
// xrandr output format (relevant lines):
//
//	HDMI-1 connected primary 2560x1440+0+0 (normal left inverted right x axis y axis) 597mm x 336mm
//	   2560x1440     59.95*+  143.91
//	   1920x1080     60.00    50.00
//	DP-1 connected 1920x1080+2560+0 (normal left inverted right x axis y axis) 530mm x 300mm
//	   1920x1080     60.00*+
//	VGA-1 disconnected (normal left inverted right x axis y axis)
type xrandrProvider struct{}

// NewXrandrProvider returns a MonitorProvider that queries xrandr.
func NewXrandrProvider() MonitorProvider {
	return &xrandrProvider{}
}

func (p *xrandrProvider) Name() string {
	return "xrandr"
}

func (p *xrandrProvider) IsAvailable() bool {
	_, err := exec.LookPath("xrandr")
	return err == nil
}

func (p *xrandrProvider) Compositor() CompositorType {
	return CompositorX11
}

func (p *xrandrProvider) Priority() int {
	return 10
}

func (p *xrandrProvider) Detect(ctx context.Context) ([]Monitor, error) {
	cmd := exec.CommandContext(ctx, "xrandr", "--query")
	output, err := cmd.Output()
	if err != nil {
		return nil, fmt.Errorf("xrandr --query: %w", err)
	}

	return parseXrandr(string(output))
}

// parseXrandr parses the text output of `xrandr --query` into Monitor structs.
func parseXrandr(output string) ([]Monitor, error) {
	var monitors []Monitor
	var current *Monitor

	scanner := bufio.NewScanner(strings.NewReader(output))
	for scanner.Scan() {
		line := scanner.Text()

		// Output header line: "HDMI-1 connected primary 2560x1440+0+0 ..."
		// or "HDMI-1 connected 2560x1440+0+0 ..."
		if strings.Contains(line, " connected") && !strings.HasPrefix(line, " ") {
			// Save the previous monitor.
			if current != nil {
				monitors = append(monitors, *current)
			}

			m, ok := parseXrandrOutputLine(line)
			if ok {
				current = &m
			} else {
				current = nil
			}
			continue
		}

		// "HDMI-1 disconnected ..." — skip disconnected outputs.
		if strings.Contains(line, " disconnected") && !strings.HasPrefix(line, " ") {
			if current != nil {
				monitors = append(monitors, *current)
				current = nil
			}
			continue
		}

		// Mode line (indented): "   2560x1440     59.95*+  143.91"
		// The active mode has a '*' suffix on its refresh rate.
		if current != nil && strings.HasPrefix(line, " ") && strings.Contains(line, "*") {
			hz := parseXrandrActiveMode(line)
			if hz > 0 {
				current.RefreshRate = hz
			}
			continue
		}
	}

	// Don't forget the last monitor.
	if current != nil {
		monitors = append(monitors, *current)
	}

	return monitors, scanner.Err()
}

// parseXrandrOutputLine parses a connected output header line.
// Example: "HDMI-1 connected primary 2560x1440+0+0 (normal ...) 597mm x 336mm"
// Example: "DP-1 connected 1920x1080+2560+360 (normal ...)"
func parseXrandrOutputLine(line string) (Monitor, bool) {
	fields := strings.Fields(line)
	if len(fields) < 3 {
		return Monitor{}, false
	}

	name := fields[0]

	// Find the geometry token "WxH+X+Y".
	var geom string
	for _, f := range fields[2:] {
		if strings.Contains(f, "x") && strings.Contains(f, "+") {
			geom = f
			break
		}
	}

	if geom == "" {
		// Connected but no active mode (output disabled).
		return Monitor{}, false
	}

	w, h, x, y, ok := parseXrandrGeometry(geom)
	if !ok {
		return Monitor{}, false
	}

	return Monitor{
		Name:   name,
		Width:  w,
		Height: h,
		X:      x,
		Y:      y,
		Scale:  1.0, // xrandr doesn't expose scale in --query output
	}, true
}

// parseXrandrGeometry parses "2560x1440+0+0" into width, height, x, y.
func parseXrandrGeometry(s string) (w, h, x, y int, ok bool) {
	// Split on 'x' first: "2560" and "1440+0+0"
	xIdx := strings.IndexByte(s, 'x')
	if xIdx == -1 {
		return 0, 0, 0, 0, false
	}

	wStr := s[:xIdx]
	rest := s[xIdx+1:]

	// Split rest on '+': "1440", "0", "0"
	parts := strings.SplitN(rest, "+", 3)
	if len(parts) != 3 {
		return 0, 0, 0, 0, false
	}

	w, err1 := strconv.Atoi(wStr)
	h, err2 := strconv.Atoi(parts[0])
	x, err3 := strconv.Atoi(parts[1])
	y, err4 := strconv.Atoi(parts[2])

	if err1 != nil || err2 != nil || err3 != nil || err4 != nil {
		return 0, 0, 0, 0, false
	}

	return w, h, x, y, true
}

// parseXrandrActiveMode extracts the refresh rate from a mode line with '*'.
// Example: "   2560x1440     59.95*+  143.91" → 59.95
func parseXrandrActiveMode(line string) float64 {
	fields := strings.Fields(line)
	for _, f := range fields {
		if strings.Contains(f, "*") {
			// Remove '*' and optional '+' suffix.
			cleaned := strings.TrimRight(f, "*+")
			if hz, err := strconv.ParseFloat(cleaned, 64); err == nil {
				return hz
			}
		}
	}
	return 0
}
