package monitor

import (
	"context"
	"encoding/json"
	"errors"
	"os"
	"os/exec"
	"sort"
	"strconv"
	"strings"

	"waypaper-engine/daemon-go/internal/models"
)

var (
	ErrNoCompositorDetected = errors.New("no compositor detected")
)

// CompositorType represents the type of compositor
type CompositorType string

const (
	CompositorWayland CompositorType = "wayland"
	CompositorX11     CompositorType = "x11"
)

// CompositorInfo contains information about the current compositor
type CompositorInfo struct {
	Type    CompositorType `json:"type"`
	Version string         `json:"version,omitempty"`
	Name    string         `json:"name,omitempty"`
}

// CompositorDetector detects the current compositor
type CompositorDetector struct{}

// NewCompositorDetector creates a new compositor detector
func NewCompositorDetector() *CompositorDetector {
	return &CompositorDetector{}
}

// DetectCompositor detects the current compositor type
func (cd *CompositorDetector) DetectCompositor() (*CompositorInfo, error) {
	// Check for Wayland
	if waylandDisplay := getEnv("WAYLAND_DISPLAY"); waylandDisplay != "" {
		return &CompositorInfo{
			Type: CompositorWayland,
			Name: detectWaylandCompositor(),
		}, nil
	}

	// Check for X11
	if x11Display := getEnv("DISPLAY"); x11Display != "" {
		return &CompositorInfo{
			Type: CompositorX11,
			Name: detectX11Compositor(),
		}, nil
	}

	return nil, ErrNoCompositorDetected
}

// detectWaylandCompositor detects the specific Wayland compositor
func detectWaylandCompositor() string {
	// Check for common Wayland compositors
	if getEnv("HYPRLAND_INSTANCE_SIGNATURE") != "" {
		return "hyprland"
	}
	if getEnv("SWAYSOCK") != "" {
		return "sway"
	}
	if getEnv("GNOME_SHELL_SESSION_MODE") != "" {
		return "gnome"
	}
	if getEnv("KDE_SESSION_VERSION") != "" {
		return "kde"
	}
	return "unknown"
}

// detectX11Compositor detects the X11 compositor
func detectX11Compositor() string {
	// This is more complex for X11, would need to query X server
	// For now, return a generic value
	return "x11"
}

// getEnv gets an environment variable
func getEnv(key string) string {
	return os.Getenv(key)
}

// WaylandMonitorProvider provides monitor information for Wayland compositors
type WaylandMonitorProvider struct {
	compositor string
}

// NewWaylandMonitorProvider creates a new Wayland monitor provider
func NewWaylandMonitorProvider(compositor string) *WaylandMonitorProvider {
	return &WaylandMonitorProvider{
		compositor: compositor,
	}
}

// GetMonitors gets monitor information from Wayland compositor
func (wmp *WaylandMonitorProvider) GetMonitors(ctx context.Context) ([]models.Monitor, error) {
	switch wmp.compositor {
	case "hyprland":
		return wmp.getHyprlandMonitors(ctx)
	case "sway":
		return wmp.getSwayMonitors(ctx)
	case "gnome":
		return wmp.getGnomeMonitors(ctx)
	case "kde":
		return wmp.getKdeMonitors(ctx)
	default:
		return wmp.getGenericWaylandMonitors(ctx)
	}
}

// getHyprlandMonitors gets monitors from Hyprland
func (wmp *WaylandMonitorProvider) getHyprlandMonitors(ctx context.Context) ([]models.Monitor, error) {
	cmd := exec.CommandContext(ctx, "hyprctl", "monitors", "-j")
	output, err := cmd.Output()
	if err != nil {
		return nil, err
	}

	var hyprMonitors []struct {
		ID       int    `json:"id"`
		Name     string `json:"name"`
		Width    int    `json:"width"`
		Height   int    `json:"height"`
		X        int    `json:"x"`
		Y        int    `json:"y"`
		Active   bool   `json:"active"`
		Disabled bool   `json:"disabled"`
	}

	if err := json.Unmarshal(output, &hyprMonitors); err != nil {
		return nil, err
	}

	var monitors []models.Monitor
	for _, hm := range hyprMonitors {
		if hm.Disabled {
			continue
		}

		monitors = append(monitors, models.Monitor{
			Name:     hm.Name,
			Width:    hm.Width,
			Height:   hm.Height,
			Position: models.Position{X: hm.X, Y: hm.Y},
		})
	}

	// Sort monitors by position (left to right, top to bottom)
	sort.Slice(monitors, func(i, j int) bool {
		if monitors[i].Position.Y != monitors[j].Position.Y {
			return monitors[i].Position.Y < monitors[j].Position.Y
		}
		return monitors[i].Position.X < monitors[j].Position.X
	})

	return monitors, nil
}

// getSwayMonitors gets monitors from Sway
func (wmp *WaylandMonitorProvider) getSwayMonitors(ctx context.Context) ([]models.Monitor, error) {
	cmd := exec.CommandContext(ctx, "swaymsg", "-t", "get_outputs")
	output, err := cmd.Output()
	if err != nil {
		return nil, err
	}

	var swayOutputs []struct {
		Name        string `json:"name"`
		Make        string `json:"make"`
		Model       string `json:"model"`
		Serial      string `json:"serial"`
		Active      bool   `json:"active"`
		CurrentMode struct {
			Width  int `json:"width"`
			Height int `json:"height"`
		} `json:"current_mode"`
		Rect struct {
			X int `json:"x"`
			Y int `json:"y"`
			W int `json:"width"`
			H int `json:"height"`
		} `json:"rect"`
	}

	if err := json.Unmarshal(output, &swayOutputs); err != nil {
		return nil, err
	}

	var monitors []models.Monitor
	for _, so := range swayOutputs {
		if !so.Active {
			continue
		}

		monitors = append(monitors, models.Monitor{
			Name:     so.Name,
			Width:    so.CurrentMode.Width,
			Height:   so.CurrentMode.Height,
			Position: models.Position{X: so.Rect.X, Y: so.Rect.Y},
		})
	}

	return monitors, nil
}

// getGnomeMonitors gets monitors from GNOME
func (wmp *WaylandMonitorProvider) getGnomeMonitors(ctx context.Context) ([]models.Monitor, error) {
	// GNOME uses gsettings and gdbus for monitor information
	// This would need to be implemented using gdbus calls
	// For now, return empty list
	return []models.Monitor{}, nil
}

// getKdeMonitors gets monitors from KDE
func (wmp *WaylandMonitorProvider) getKdeMonitors(ctx context.Context) ([]models.Monitor, error) {
	// KDE uses qdbus for monitor information
	// This would need to be implemented using qdbus calls
	// For now, return empty list
	return []models.Monitor{}, nil
}

// getGenericWaylandMonitors gets monitors using generic Wayland methods
func (wmp *WaylandMonitorProvider) getGenericWaylandMonitors(ctx context.Context) ([]models.Monitor, error) {
	// This would use wlr-randr or similar tools
	// For now, return empty list
	return []models.Monitor{}, nil
}

// X11MonitorProvider provides monitor information for X11
type X11MonitorProvider struct{}

// NewX11MonitorProvider creates a new X11 monitor provider
func NewX11MonitorProvider() *X11MonitorProvider {
	return &X11MonitorProvider{}
}

// GetMonitors gets monitor information from X11
func (xmp *X11MonitorProvider) GetMonitors(ctx context.Context) ([]models.Monitor, error) {
	// Use xrandr to get monitor information
	cmd := exec.CommandContext(ctx, "xrandr", "--query")
	output, err := cmd.Output()
	if err != nil {
		return nil, err
	}

	return xmp.parseXrandrOutput(string(output))
}

// parseXrandrOutput parses xrandr output to extract monitor information
func (xmp *X11MonitorProvider) parseXrandrOutput(output string) ([]models.Monitor, error) {
	var monitors []models.Monitor
	lines := strings.Split(output, "\n")

	var currentMonitor *models.Monitor
	for _, line := range lines {
		line = strings.TrimSpace(line)

		// Check if this is a connected monitor
		if strings.Contains(line, " connected") {
			parts := strings.Fields(line)
			if len(parts) < 2 {
				continue
			}

			name := parts[0]
			status := parts[1]

			if status == "connected" {
				currentMonitor = &models.Monitor{
					Name: name,
				}
			}
		} else if currentMonitor != nil && strings.Contains(line, "x") {
			// Parse resolution and position
			parts := strings.Fields(line)
			for _, part := range parts {
				if strings.Contains(part, "x") && strings.Contains(part, "+") {
					// Format: 1920x1080+0+0
					resolutionAndPos := strings.Split(part, "+")
					if len(resolutionAndPos) >= 3 {
						resolution := strings.Split(resolutionAndPos[0], "x")
						if len(resolution) == 2 {
							if width, err := strconv.Atoi(resolution[0]); err == nil {
								currentMonitor.Width = width
							}
							if height, err := strconv.Atoi(resolution[1]); err == nil {
								currentMonitor.Height = height
							}
						}

						if x, err := strconv.Atoi(resolutionAndPos[1]); err == nil {
							currentMonitor.Position.X = x
						}
						if y, err := strconv.Atoi(resolutionAndPos[2]); err == nil {
							currentMonitor.Position.Y = y
						}
					}

					// Add the monitor and reset
					monitors = append(monitors, *currentMonitor)
					currentMonitor = nil
					break
				}
			}
		}
	}

	return monitors, nil
}
