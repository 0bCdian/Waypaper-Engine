package monitor

import (
	"fmt"
	"os/exec"
	"regexp"
	"strconv"
	"strings"
)

// X11MonitorManager implements MonitorManager for X11 via xrandr
type X11MonitorManager struct{}

// NewX11MonitorManager creates a new X11 monitor manager
func NewX11MonitorManager() (*X11MonitorManager, error) {
	// Verify xrandr is available
	if _, err := exec.LookPath("xrandr"); err != nil {
		return nil, fmt.Errorf("xrandr not found in PATH: %w", err)
	}

	return &X11MonitorManager{}, nil
}

// Start begins monitoring (no-op for external tool approach)
func (m *X11MonitorManager) Start() error {
	// Verify xrandr is still available
	if _, err := exec.LookPath("xrandr"); err != nil {
		return fmt.Errorf("xrandr not found in PATH: %w", err)
	}
	return nil
}

// Stop stops the monitor manager (no-op for external tool approach)
func (m *X11MonitorManager) Stop() {
	// Nothing to clean up
}

// GetMonitors returns a snapshot of current monitors
func (m *X11MonitorManager) GetMonitors() Monitors {
	monitors := make(Monitors)

	output, err := m.executeXrandr()
	if err != nil {
		return monitors
	}

	parsed := m.parseXrandrOutput(output)
	for _, mon := range parsed {
		monitors[mon.Name] = mon
	}

	return monitors
}

// GetMonitorByName returns a monitor by name
func (m *X11MonitorManager) GetMonitorByName(name string) (Monitor, bool) {
	monitors := m.GetMonitors()
	mon, ok := monitors[name]
	return mon, ok
}

// executeXrandr runs xrandr --query and returns its output
func (m *X11MonitorManager) executeXrandr() (string, error) {
	cmd := exec.Command("xrandr", "--query")
	output, err := cmd.Output()
	if err != nil {
		return "", fmt.Errorf("failed to execute xrandr: %w", err)
	}
	return string(output), nil
}

// parseXrandrOutput parses xrandr --query output into Monitor structs
func (m *X11MonitorManager) parseXrandrOutput(output string) []Monitor {
	var monitors []Monitor

	// xrandr output format example:
	// Screen 0: minimum 320 x 200, current 3840 x 1080, maximum 8192 x 8192
	// eDP-1 connected primary 1920x1080+0+0 (normal left inverted right x axis y axis) 309mm x 174mm
	//    1920x1080     60.00*+  60.00
	//    1680x1050     59.95
	// DP-1 connected 1920x1080+1920+0 (normal left inverted right x axis y axis) 510mm x 287mm
	//    1920x1080     60.00*+  60.00

	lines := strings.Split(output, "\n")
	var currentOutput string
	var currentMonitor *Monitor

	for _, line := range lines {
		line = strings.TrimSpace(line)
		if line == "" {
			continue
		}

		// Skip screen summary line
		if strings.HasPrefix(line, "Screen ") {
			continue
		}

		// Check if this is an output line (contains "connected")
		// Format: OUTPUT_NAME connected [primary] [MODE] [+X+Y] [transform info]
		if strings.Contains(line, " connected ") {
			// Save previous monitor if exists
			if currentMonitor != nil {
				monitors = append(monitors, *currentMonitor)
			}

			// Parse output name (first word)
			parts := strings.Fields(line)
			if len(parts) == 0 {
				continue
			}

			currentOutput = parts[0]
			currentMonitor = &Monitor{
				Name:     currentOutput,
				Scale:    1, // Default scale for X11
				Transform: 0, // Default transform (normal)
			}

			// Parse geometry: MODE+X+Y (e.g., 1920x1080+1920+0)
			geometryMatch := regexp.MustCompile(`(\d+)x(\d+)\+(\d+)\+(\d+)`).FindStringSubmatch(line)
			if geometryMatch != nil {
				if width, err := strconv.Atoi(geometryMatch[1]); err == nil {
					currentMonitor.Width = width
				}
				if height, err := strconv.Atoi(geometryMatch[2]); err == nil {
					currentMonitor.Height = height
				}
				if x, err := strconv.Atoi(geometryMatch[3]); err == nil {
					currentMonitor.Position.X = x
				}
				if y, err := strconv.Atoi(geometryMatch[4]); err == nil {
					currentMonitor.Position.Y = y
				}
			}

			// Parse rotation/transform from parenthetical info
			// Format: (normal left inverted right x axis y axis)
			// or: (left inverted right x axis y axis) for 90 degree rotation
			if transformMatch := regexp.MustCompile(`\(([^)]+)\)`).FindStringSubmatch(line); transformMatch != nil {
				transformStr := transformMatch[1]
				currentMonitor.Transform = m.parseXrandrTransform(transformStr)
			}
		} else if currentMonitor != nil && strings.HasPrefix(line, "   ") {
			// This is a mode line, check if it's the current mode (marked with *)
			// Format:    1920x1080     60.00*+  60.00
			if strings.Contains(line, "*") {
				modeMatch := regexp.MustCompile(`(\d+)x(\d+)`).FindStringSubmatch(line)
				if modeMatch != nil {
					// Update width/height if not already set from geometry
					if currentMonitor.Width == 0 {
						if width, err := strconv.Atoi(modeMatch[1]); err == nil {
							currentMonitor.Width = width
						}
					}
					if currentMonitor.Height == 0 {
						if height, err := strconv.Atoi(modeMatch[2]); err == nil {
							currentMonitor.Height = height
						}
					}
				}
			}
		}
	}

	// Add last monitor if exists
	if currentMonitor != nil {
		monitors = append(monitors, *currentMonitor)
	}

	return monitors
}

// parseXrandrTransform converts xrandr transform string to integer representation
// X11 rotations: normal=0, left (90° counter-clockwise)=1, inverted (180°)=2, right (90° clockwise)=3
func (m *X11MonitorManager) parseXrandrTransform(transform string) int {
	transform = strings.ToLower(transform)

	// Check for rotation keywords
	if strings.Contains(transform, "left") && !strings.Contains(transform, "inverted") {
		return 1 // 90° counter-clockwise
	}
	if strings.Contains(transform, "inverted") {
		return 2 // 180°
	}
	if strings.Contains(transform, "right") && !strings.Contains(transform, "inverted") {
		return 3 // 90° clockwise
	}

	// Default to normal
	return 0
}
