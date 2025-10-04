package backend

import (
	"context"
	"fmt"
	"log/slog"
	"strings"

	"waypaper-engine/daemon-go/internal/models"
)

// WallutilsBackend implements the Backend interface for wallutils
type WallutilsBackend struct {
	runner CommandRunner
}

// NewWallutilsBackend creates a new wallutils backend
func NewWallutilsBackend(runner CommandRunner, logger *slog.Logger) *WallutilsBackend {
	return &WallutilsBackend{
		runner: runner,
	}
}

// GetType returns the backend type
func (w *WallutilsBackend) GetType() BackendType {
	return BackendWallutils
}

// Initialize checks if wallutils is available
func (w *WallutilsBackend) Initialize(ctx context.Context) error {
	_, _, err := w.runner.Run("wallpaper --version")
	if err != nil {
		return fmt.Errorf("wallutils not found: %w", err)
	}
	return nil
}

// SetWallpaper sets wallpaper on a specific monitor
func (w *WallutilsBackend) SetWallpaper(ctx context.Context, imagePath, monitorName string, config *BackendConfig) error {
	args := []string{"--output", monitorName, imagePath}

	// Add configuration options
	args = w.addConfigArgs(args, config)

	command := "wallpaper " + strings.Join(args, " ")
	_, stderr, err := w.runner.Run(command)
	if err != nil {
		return fmt.Errorf("failed to set wallpaper: %w, output: %s", err, stderr)
	}

	return nil
}

// SetWallpaperAll sets wallpaper on all monitors
func (w *WallutilsBackend) SetWallpaperAll(ctx context.Context, imagePath string, config *BackendConfig) error {
	args := []string{imagePath}

	// Add configuration options
	args = w.addConfigArgs(args, config)

	command := "wallpaper " + strings.Join(args, " ")
	_, stderr, err := w.runner.Run(command)
	if err != nil {
		return fmt.Errorf("failed to set wallpaper: %w, output: %s", err, stderr)
	}

	return nil
}

// GetCapabilities returns wallutils capabilities
func (w *WallutilsBackend) GetCapabilities() BackendCapabilities {
	return BackendCapabilities{
		MultiMonitor:   true,
		Transitions:    false, // wallutils doesn't support transitions
		ResizeOptions:  true,
		Positioning:    true,
		Filters:        false, // wallutils doesn't support filters
		RealTimeQuery:  false, // wallutils doesn't have real-time monitor query
		BackgroundMode: true,
	}
}

// GetDefaultConfig returns default wallutils configuration
func (w *WallutilsBackend) GetDefaultConfig() *BackendConfig {
	return &BackendConfig{
		BackendType: BackendWallutils,
		ResizeType:  "fit",
		CustomOptions: map[string]interface{}{
			"mode": "fit",
		},
	}
}

// addConfigArgs adds configuration arguments to the wallutils command
func (w *WallutilsBackend) addConfigArgs(args []string, config *BackendConfig) []string {
	if config == nil {
		return args
	}

	// Add resize type
	switch config.ResizeType {
	case "fit":
		args = append(args, "--mode", "fit")
	case "fill":
		args = append(args, "--mode", "fill")
	case "stretch":
		args = append(args, "--mode", "stretch")
	case "crop":
		args = append(args, "--mode", "crop")
	}

	// Add custom options
	if customOpts, ok := config.CustomOptions["mode"].(string); ok {
		args = append(args, "--mode", customOpts)
	}

	return args
}

// parseXrandrOutput parses xrandr output to extract monitor information
func (w *WallutilsBackend) parseXrandrOutput(output string) []models.Monitor {
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

// StartDaemon implementation for wallutils backend (no-op)
func (w *WallutilsBackend) StartDaemon(ctx context.Context) error {
	return nil
}

// StopDaemon implementation for wallutils backend (no-op)
func (w *WallutilsBackend) StopDaemon(ctx context.Context) error {
	return nil
}

// IsDaemonRunning implementation for wallutils backend
func (w *WallutilsBackend) IsDaemonRunning() bool {
	return false
}
