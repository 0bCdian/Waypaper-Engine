package backend

import (
	"context"
	"fmt"
	"log/slog"
	"strings"

	"waypaper-engine/daemon-go/internal/models"
)

// FehBackend implements the Backend interface for feh
type FehBackend struct {
	runner CommandRunner
}

// NewFehBackend creates a new feh backend
func NewFehBackend(runner CommandRunner, logger *slog.Logger) *FehBackend {
	return &FehBackend{
		runner: runner,
	}
}

// GetType returns the backend type
func (f *FehBackend) GetType() BackendType {
	return BackendFeh
}

// Initialize checks if feh is available
func (f *FehBackend) Initialize(ctx context.Context) error {
	_, _, err := f.runner.Run("feh --version")
	if err != nil {
		return fmt.Errorf("feh not found: %w", err)
	}
	return nil
}

// SetWallpaper sets wallpaper on a specific monitor
func (f *FehBackend) SetWallpaper(ctx context.Context, imagePath, monitorName string, config *BackendConfig) error {
	args := []string{"--bg-fill", imagePath}

	// Add configuration options
	args = f.addConfigArgs(args, config)

	// feh doesn't support monitor-specific wallpaper setting directly
	// We'll set it globally and let the user handle multi-monitor setup
	command := "feh " + strings.Join(args, " ")
	_, stderr, err := f.runner.Run(command)
	if err != nil {
		return fmt.Errorf("failed to set wallpaper: %w, output: %s", err, stderr)
	}

	return nil
}

// SetWallpaperAll sets wallpaper on all monitors
func (f *FehBackend) SetWallpaperAll(ctx context.Context, imagePath string, config *BackendConfig) error {
	args := []string{"--bg-fill", imagePath}

	// Add configuration options
	args = f.addConfigArgs(args, config)

	command := "feh " + strings.Join(args, " ")
	_, stderr, err := f.runner.Run(command)
	if err != nil {
		return fmt.Errorf("failed to set wallpaper: %w, output: %s", err, stderr)
	}

	return nil
}

// GetCapabilities returns feh capabilities
func (f *FehBackend) GetCapabilities() BackendCapabilities {
	return BackendCapabilities{
		Compositor: CompositorSupport{
			X11:     true, // feh is X11-only
			Wayland: false,
		},
		MediaTypes: MediaTypeSupport{
			Images: true,
			Videos: false, // feh only does static images
			HTML:   false,
			D3D:    false,
			GIFs:   false, // Only first frame of GIFs
		},
		MultiMonitor:    false, // feh doesn't support per-monitor wallpapers
		Transitions:     false, // feh doesn't support transitions
		ResizeOptions:   true,
		Positioning:     true,
		Filters:         false, // feh doesn't support filters
		RealTimeQuery:   false, // feh doesn't have real-time monitor query
		BackgroundMode:  true,
		DaemonMode:      false, // feh doesn't run as daemon
		MaxImageSize:    25,    // feh handles images reasonably well
		FastSwitching:   false, // feh is slower due to X11 limitations
		MemoryEfficient: false, // feh loads images into X11
	}
}

// GetDefaultConfig returns default feh configuration
func (f *FehBackend) GetDefaultConfig() *BackendConfig {
	return &BackendConfig{
		BackendType: BackendFeh,
		ResizeType:  "fill",
		CustomOptions: map[string]interface{}{
			"no-fehbg": true, // Don't create .fehbg file
		},
	}
}

// addConfigArgs adds configuration arguments to the feh command
// StartDaemon implementation for feh backend (no-op as feh doesn't use daemons)
func (f *FehBackend) StartDaemon(ctx context.Context) error {
	return nil
}

// StopDaemon implementation for feh backend (no-op)
func (f *FehBackend) StopDaemon(ctx context.Context) error {
	return nil
}

// IsDaemonRunning implementation for feh backend
func (f *FehBackend) IsDaemonRunning() bool {
	return false
}

func (f *FehBackend) addConfigArgs(args []string, config *BackendConfig) []string {
	if config == nil {
		return args
	}

	// Add resize type
	switch config.ResizeType {
	case "fit":
		args = append(args, "--bg-center")
	case "fill":
		args = append(args, "--bg-fill")
	case "stretch":
		args = append(args, "--bg-scale")
	case "crop":
		args = append(args, "--bg-max")
	}

	// Add custom options
	if customOpts, ok := config.CustomOptions["no-fehbg"].(bool); ok && customOpts {
		args = append(args, "--no-fehbg")
	}

	return args
}

// parseXrandrOutput parses xrandr output to extract monitor information
func (f *FehBackend) parseXrandrOutput(output string) []models.Monitor {
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
