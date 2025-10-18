package backend

import (
	"context"
	"fmt"
	"log/slog"
	"strings"
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
		CustomOptions: map[string]any{
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
