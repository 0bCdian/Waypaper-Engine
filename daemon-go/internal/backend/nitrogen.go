package backend

import (
	"context"
	"fmt"
	"log/slog"
	"strings"

	"waypaper-engine/daemon-go/internal/models"
)

// NitrogenBackend implements the Backend interface for nitrogen
type NitrogenBackend struct {
	runner CommandRunner
}

// NewNitrogenBackend creates a new nitrogen backend
func NewNitrogenBackend(runner CommandRunner, logger *slog.Logger) *NitrogenBackend {
	return &NitrogenBackend{
		runner: runner,
	}
}

// GetType returns the backend type
func (n *NitrogenBackend) GetType() BackendType {
	return BackendNitrogen
}

// Initialize checks if nitrogen is available
func (n *NitrogenBackend) Initialize(ctx context.Context) error {
	_, _, err := n.runner.Run("nitrogen --version")
	if err != nil {
		return fmt.Errorf("nitrogen not found: %w", err)
	}
	return nil
}

// SetWallpaper sets wallpaper on a specific monitor
func (n *NitrogenBackend) SetWallpaper(ctx context.Context, imagePath, monitorName string, config *BackendConfig) error {
	args := []string{"--set-zoom-fill", imagePath}

	// Add configuration options
	args = n.addConfigArgs(args, config)

	// nitrogen doesn't support monitor-specific wallpaper setting directly
	// We'll set it globally
	command := "nitrogen " + strings.Join(args, " ")
	_, stderr, err := n.runner.Run(command)
	if err != nil {
		return fmt.Errorf("failed to set wallpaper: %w, output: %s", err, stderr)
	}

	return nil
}

// SetWallpaperAll sets wallpaper on all monitors
func (n *NitrogenBackend) SetWallpaperAll(ctx context.Context, imagePath string, config *BackendConfig) error {
	args := []string{"--set-zoom-fill", imagePath}

	// Add configuration options
	args = n.addConfigArgs(args, config)

	command := "nitrogen " + strings.Join(args, " ")
	_, stderr, err := n.runner.Run(command)
	if err != nil {
		return fmt.Errorf("failed to set wallpaper: %w, output: %s", err, stderr)
	}

	return nil
}

// GetCapabilities returns nitrogen capabilities
func (n *NitrogenBackend) GetCapabilities() BackendCapabilities {
	return BackendCapabilities{
		MultiMonitor:   false, // nitrogen doesn't support per-monitor wallpapers
		Transitions:    false, // nitrogen doesn't support transitions
		ResizeOptions:  true,
		Positioning:    true,
		Filters:        false, // nitrogen doesn't support filters
		RealTimeQuery:  false, // nitrogen doesn't have real-time monitor query
		BackgroundMode: true,
	}
}

// GetDefaultConfig returns default nitrogen configuration
func (n *NitrogenBackend) GetDefaultConfig() *BackendConfig {
	return &BackendConfig{
		BackendType: BackendNitrogen,
		ResizeType:  "fill",
		CustomOptions: map[string]interface{}{
			"head": 0, // Use first monitor
		},
	}
}

// addConfigArgs adds configuration arguments to the nitrogen command
func (n *NitrogenBackend) addConfigArgs(args []string, config *BackendConfig) []string {
	if config == nil {
		return args
	}

	// Add resize type
	switch config.ResizeType {
	case "fit":
		args = append(args, "--set-zoom")
	case "fill":
		args = append(args, "--set-zoom-fill")
	case "stretch":
		args = append(args, "--set-zoom-fill")
	case "crop":
		args = append(args, "--set-zoom-fill")
	}

	// Add head option if specified
	if customOpts, ok := config.CustomOptions["head"].(int); ok {
		args = append(args, "--head", fmt.Sprintf("%d", customOpts))
	}

	return args
}

// parseXrandrOutput parses xrandr output to extract monitor information
func (n *NitrogenBackend) parseXrandrOutput(output string) []models.Monitor {
	var monitors []models.Monitor
	lines := strings.Split(output, "\n")

	for _, line := range lines {
		line = strings.TrimSpace(line)
		if strings.Contains(line, " connected") && strings.Contains(line, "+") {
			// Parse monitor line like: "DP-1 connected 1920x1080+0+0 (normal left inverted right x axis y axis) 510mm x 287mm"
			parts := strings.Fields(line)
			if len(parts) >= 3 {
				name := parts[0]
				resolution := parts[2]

				// Parse resolution like "1920x1080+0+0"
				resParts := strings.Split(resolution, "+")
				if len(resParts) >= 3 {
					sizeParts := strings.Split(resParts[0], "x")
					if len(sizeParts) == 2 {
						var width, height int
						fmt.Sscanf(sizeParts[0], "%d", &width)
						fmt.Sscanf(sizeParts[1], "%d", &height)

						var x, y int
						fmt.Sscanf(resParts[1], "%d", &x)
						fmt.Sscanf(resParts[2], "%d", &y)

						monitors = append(monitors, models.Monitor{
							Name:   name,
							Width:  width,
							Height: height,
							Position: models.Position{
								X: x,
								Y: y,
							},
						})
					}
				}
			}
		}
	}

	return monitors
}

// StartDaemon implementation for nitrogen backend (no-op)
func (n *NitrogenBackend) StartDaemon(ctx context.Context) error {
	return nil
}

// StopDaemon implementation for nitrogen backend (no-op)
func (n *NitrogenBackend) StopDaemon(ctx context.Context) error {
	return nil
}

// IsDaemonRunning implementation for nitrogen backend
func (n *NitrogenBackend) IsDaemonRunning() bool {
	return false
}
