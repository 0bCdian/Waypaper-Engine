package backend

import (
	"context"
	"fmt"
	"log/slog"
	"strings"
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
		CustomOptions: map[string]any{
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
