package backend

import (
	"context"
	"fmt"
	"log/slog"
)

// HyprpaperBackend implements the Backend interface for hyprpaper
type HyprpaperBackend struct {
	runner CommandRunner
}

// NewHyprpaperBackend creates a new hyprpaper backend
func NewHyprpaperBackend(runner CommandRunner, logger *slog.Logger) *HyprpaperBackend {
	return &HyprpaperBackend{
		runner: runner,
	}
}

// GetType returns the backend type
func (h *HyprpaperBackend) GetType() BackendType {
	return BackendHyprpaper
}

// Initialize checks if hyprpaper is available
func (h *HyprpaperBackend) Initialize(ctx context.Context) error {
	_, _, err := h.runner.Run("hyprpaper --version")
	if err != nil {
		return fmt.Errorf("hyprpaper not found: %w", err)
	}
	return nil
}

// SetWallpaper sets wallpaper on a specific monitor
func (h *HyprpaperBackend) SetWallpaper(ctx context.Context, imagePath, monitorName string, config *BackendConfig) error {
	// hyprpaper uses a different command format
	command := fmt.Sprintf("hyprpaper preload %s", imagePath)
	_, stderr, err := h.runner.Run(command)
	if err != nil {
		return fmt.Errorf("failed to preload image: %w, output: %s", err, stderr)
	}

	// Set wallpaper on specific monitor
	command = fmt.Sprintf("hyprpaper wallpaper %s:%s", monitorName, imagePath)
	_, stderr, err = h.runner.Run(command)
	if err != nil {
		return fmt.Errorf("failed to set wallpaper: %w, output: %s", err, stderr)
	}

	return nil
}

// SetWallpaperAll sets wallpaper on all monitors
func (h *HyprpaperBackend) SetWallpaperAll(ctx context.Context, imagePath string, config *BackendConfig) error {
	// Preload the image
	command := fmt.Sprintf("hyprpaper preload %s", imagePath)
	_, stderr, err := h.runner.Run(command)
	if err != nil {
		return fmt.Errorf("failed to preload image: %w, output: %s", err, stderr)
	}

	// Set wallpaper on all monitors using hyprpaper's global setting
	// hyprpaper will automatically apply to all available monitors
	wallpaperCommand := fmt.Sprintf("hyprpaper wallpaper %s", imagePath)
	_, wallpaperStderr, err := h.runner.Run(wallpaperCommand)
	if err != nil {
		return fmt.Errorf("failed to set wallpaper on all monitors: %w, output: %s", err, wallpaperStderr)
	}

	return nil
}

// GetCapabilities returns hyprpaper capabilities
func (h *HyprpaperBackend) GetCapabilities() BackendCapabilities {
	return BackendCapabilities{
		MultiMonitor:   true,
		Transitions:    false, // hyprpaper doesn't support transitions
		ResizeOptions:  true,
		Positioning:    true,
		Filters:        false, // hyprpaper doesn't support filters
		RealTimeQuery:  true,
		BackgroundMode: true,
	}
}

// GetDefaultConfig returns default hyprpaper configuration
func (h *HyprpaperBackend) GetDefaultConfig() *BackendConfig {
	return &BackendConfig{
		BackendType: BackendHyprpaper,
		ResizeType:  "fit",
		FillColor:   "#000000",
		CustomOptions: map[string]any{
			"preload": true, // hyprpaper benefits from preloading
		},
	}
}

// hyprMonitor represents the structure from hyprctl monitors output
// StartDaemon implementation for hyprpaper backend (no-op as hyprpaper doesn't use separate daemons)
func (h *HyprpaperBackend) StartDaemon(ctx context.Context) error {
	return nil
}

// StopDaemon implementation for hyprpaper backend (no-op)
func (h *HyprpaperBackend) StopDaemon(ctx context.Context) error {
	return nil
}

// IsDaemonRunning implementation for hyprpaper backend
func (h *HyprpaperBackend) IsDaemonRunning() bool {
	return false
}
