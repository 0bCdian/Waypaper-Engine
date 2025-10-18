package backend

import (
	"context"
	"fmt"
	"log/slog"
	"strings"
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
		CustomOptions: map[string]any{
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
