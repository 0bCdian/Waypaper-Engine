package monitor

import (
	"fmt"
	"os/exec"
	"regexp"
	"strconv"
	"strings"
)

// WaylandMonitorManager handles Wayland monitor detection via wlr-randr
type WaylandMonitorManager struct{}

// NewWaylandMonitorManager creates a new Wayland monitor manager
func NewWaylandMonitorManager() (*WaylandMonitorManager, error) {
	// Verify wlr-randr is available
	if _, err := exec.LookPath("wlr-randr"); err != nil {
		return nil, fmt.Errorf("wlr-randr not found in PATH: %w", err)
	}

	return &WaylandMonitorManager{}, nil
}

// Start begins monitoring (no-op for external tool approach)
func (mm *WaylandMonitorManager) Start() error {
	// Verify wlr-randr is still available
	if _, err := exec.LookPath("wlr-randr"); err != nil {
		return fmt.Errorf("wlr-randr not found in PATH: %w", err)
	}
	return nil
}

// Stop stops the monitor manager (no-op for external tool approach)
func (mm *WaylandMonitorManager) Stop() {
	// Nothing to clean up
}

// GetMonitors returns a snapshot of current monitors
func (mm *WaylandMonitorManager) GetMonitors() Monitors {
	monitors := make(Monitors)

	output, err := mm.executeWlrRandr()
	if err != nil {
		return monitors
	}

	parsed := mm.parseWlrRandrOutput(output)
	for _, m := range parsed {
		monitors[m.Name] = m
	}

	return monitors
}

// GetMonitorByName returns a monitor by name
func (mm *WaylandMonitorManager) GetMonitorByName(name string) (Monitor, bool) {
	monitors := mm.GetMonitors()
	monitor, ok := monitors[name]
	return monitor, ok
}

// executeWlrRandr runs wlr-randr and returns its output
func (mm *WaylandMonitorManager) executeWlrRandr() (string, error) {
	cmd := exec.Command("wlr-randr")
	output, err := cmd.Output()
	if err != nil {
		return "", fmt.Errorf("failed to execute wlr-randr: %w", err)
	}
	return string(output), nil
}

// parseWlrRandrOutput parses wlr-randr output into Monitor structs
func (mm *WaylandMonitorManager) parseWlrRandrOutput(output string) []Monitor {
	var monitors []Monitor

	// wlr-randr output format:
	// OUTPUT_NAME "Description"
	//   Make: ...
	//   Model: ...
	//   Enabled: yes/no
	//   Modes:
	//     WIDTHxHEIGHT px, FREQ Hz (current)
	//   Position: X,Y
	//   Transform: normal|90|180|270|flipped|flipped-90|flipped-180|flipped-270
	//   Scale: 1.000000

	lines := strings.Split(output, "\n")
	var currentMonitor *Monitor
	var inModesSection bool

	for _, rawLine := range lines {
		line := strings.TrimSpace(rawLine)
		if line == "" {
			inModesSection = false
			continue
		}

		// Check if this is a new output line (starts with output name, no leading space)
		// Format: OUTPUT_NAME "Description"
		if !strings.HasPrefix(rawLine, " ") && !strings.HasPrefix(rawLine, "\t") {
			// Save previous monitor if exists and enabled
			if currentMonitor != nil {
				monitors = append(monitors, *currentMonitor)
			}

			// Start new monitor
			outputMatch := regexp.MustCompile(`^([^\s"]+)\s+"([^"]*)"`).FindStringSubmatch(line)
			if outputMatch != nil {
				currentMonitor = &Monitor{
					Name: outputMatch[1],
				}
				inModesSection = false
			}
			continue
		}

		if currentMonitor == nil {
			continue
		}

		// Parse Enabled: yes/no
		if enabledMatch := regexp.MustCompile(`Enabled:\s*(yes|no)`).FindStringSubmatch(line); enabledMatch != nil {
			if enabledMatch[1] == "no" {
				// Skip disabled monitors
				currentMonitor = nil
				continue
			}
		}

		// Check if we're entering the Modes section
		if strings.HasPrefix(line, "Modes:") {
			inModesSection = true
			continue
		}

		// Parse current mode from Modes section
		// Format:    WIDTHxHEIGHT px, FREQ Hz (current)
		if inModesSection && strings.Contains(line, "(current)") {
			modeMatch := regexp.MustCompile(`(\d+)x(\d+)\s+px`).FindStringSubmatch(line)
			if modeMatch != nil {
				if width, err := strconv.Atoi(modeMatch[1]); err == nil {
					currentMonitor.Width = width
				}
				if height, err := strconv.Atoi(modeMatch[2]); err == nil {
					currentMonitor.Height = height
				}
			}
		}

		// Parse Position: X,Y
		if posMatch := regexp.MustCompile(`Position:\s*(\d+),(\d+)`).FindStringSubmatch(line); posMatch != nil {
			if x, err := strconv.Atoi(posMatch[1]); err == nil {
				currentMonitor.Position.X = x
			}
			if y, err := strconv.Atoi(posMatch[2]); err == nil {
				currentMonitor.Position.Y = y
			}
		}

		// Parse Transform: normal|90|180|270|flipped|flipped-90|flipped-180|flipped-270
		if transformMatch := regexp.MustCompile(`Transform:\s*(\S+)`).FindStringSubmatch(line); transformMatch != nil {
			currentMonitor.Transform = mm.parseTransform(transformMatch[1])
		}

		// Parse Scale: 1.000000
		if scaleMatch := regexp.MustCompile(`Scale:\s*([\d.]+)`).FindStringSubmatch(line); scaleMatch != nil {
			if scale, err := strconv.ParseFloat(scaleMatch[1], 64); err == nil {
				currentMonitor.Scale = int(scale)
			}
		}
	}

	// Add last monitor if exists and enabled
	if currentMonitor != nil {
		monitors = append(monitors, *currentMonitor)
	}

	return monitors
}

// parseTransform converts transform string to integer representation
// Wayland transforms: normal=0, 90=1, 180=2, 270=3, flipped=4, flipped-90=5, flipped-180=6, flipped-270=7
func (mm *WaylandMonitorManager) parseTransform(transform string) int {
	switch transform {
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
