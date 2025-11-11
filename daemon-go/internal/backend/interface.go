package backend

import (
	"context"
	"fmt"
)

// BackendType represents the type of wallpaper backend
type BackendType string

const (
	BackendSwww      BackendType = "swww"
	BackendHyprpaper BackendType = "hyprpaper"
	BackendFeh       BackendType = "feh"
	BackendNitrogen  BackendType = "nitrogen"
	BackendWallutils BackendType = "wallutils"
)

// Backend represents a wallpaper backend interface
type Backend interface {
	// GetType returns the backend type
	GetType() BackendType

	// SetWallpaper sets wallpaper on a specific monitor
	SetWallpaper(ctx context.Context, imagePath, monitorName string, config any) error

	// SetWallpaperAll sets wallpaper on all monitors
	SetWallpaperAll(ctx context.Context, imagePath string, config any) error

	// GetCapabilities returns what this backend supports
	GetCapabilities() BackendCapabilities

	// GetDefaultConfig returns default configuration for this backend
	GetDefaultConfig() any
}

// CompositorSupport represents supported compositors
type CompositorSupport struct {
	X11     bool `json:"x11"`     // Supports X11 compositor
	Wayland bool `json:"wayland"` // Supports Wayland compositor
}

// MediaTypeSupport represents supported media types
type MediaTypeSupport struct {
	Images bool `json:"images"` // Supports static images
	Videos bool `json:"videos"` // Supports video files
	HTML   bool `json:"html"`   // Supports HTML content
	D3D    bool `json:"3d"`     // Supports 3D content
	GIFs   bool `json:"gifs"`   // Supports animated GIFs
}

// BackendCapabilities describes what a backend can do
type BackendCapabilities struct {
	// Compositor support
	Compositor CompositorSupport `json:"compositor"`

	// Media type support
	MediaTypes MediaTypeSupport `json:"mediaTypes"`
}

// This is backend specific, each backend will have its own config, we cannot use a generic config for all backends
type BackendConfig struct {
	BackendType BackendType `json:"backendType"`

	// Common options
	ResizeType string `json:"resizeType,omitempty"` // "fit", "crop", "fill", "stretch"
	FillColor  string `json:"fillColor,omitempty"`  // Background color for letterboxing

	// Transition options (if supported)
	TransitionType     string  `json:"transitionType,omitempty"`     // "none", "fade", "slide", etc.
	TransitionDuration float64 `json:"transitionDuration,omitempty"` // Duration in seconds
	TransitionStep     int     `json:"transitionStep,omitempty"`     // Steps for animation
	TransitionFPS      int     `json:"transitionFPS,omitempty"`      // Frames per second
	TransitionAngle    float64 `json:"transitionAngle,omitempty"`    // Angle for slide transitions

	// Positioning options (if supported)
	PositionX    float64 `json:"positionX,omitempty"`    // X position (0.0-1.0)
	PositionY    float64 `json:"positionY,omitempty"`    // Y position (0.0-1.0)
	PositionType string  `json:"positionType,omitempty"` // "center", "top", "left", etc.

	// Filter options (if supported)
	FilterType string `json:"filterType,omitempty"` // "lanczos", "bilinear", "nearest", etc.

	// Backend-specific options
	CustomOptions map[string]any `json:"customOptions,omitempty"`
}

// BackendManager interface for managing backends
type BackendManager interface {
	GetAvailableBackends() []BackendType
	SetActiveBackend(backendType BackendType) error
	GetActiveBackend() Backend
	GetCapabilities() BackendCapabilities
	SetWallpaper(ctx context.Context, imagePath, monitorName string) error
	SetWallpaperAll(ctx context.Context, imagePath string) error
	CleanupChildProcesses(ctx context.Context) error
}

// backendManager implements BackendManager interface
type backendManager struct {
	backends      map[BackendType]Backend
	active        BackendType
	configManager ConfigManager // Interface to get backend config
}

// ConfigManager interface for getting backend configuration
type ConfigManager interface {
	GetActiveBackendType() string
	GetBackendConfigForType(backendType string) (any, error)
}

// NewBackendManager creates a new backend manager with hardcoded backends
func NewBackendManager(configManager ConfigManager) BackendManager {
	bm := &backendManager{
		backends:      make(map[BackendType]Backend),
		configManager: configManager,
	}

	// Hardcode available backends
	bm.backends[BackendSwww] = NewSwwwBackend()
	// TODO: Add other backends as they are implemented
	// bm.backends[BackendHyprpaper] = NewHyprpaperBackend()

	// Set default active backend
	bm.active = BackendSwww

	return bm
}

// GetAvailableBackends returns all available backends
func (bm *backendManager) GetAvailableBackends() []BackendType {
	var types []BackendType
	for backendType := range bm.backends {
		types = append(types, backendType)
	}
	return types
}

// SetActiveBackend sets the active backend
func (bm *backendManager) SetActiveBackend(backendType BackendType) error {
	if _, exists := bm.backends[backendType]; !exists {
		return fmt.Errorf("backend '%s' is not available", backendType)
	}
	bm.active = backendType
	return nil
}

// GetActiveBackend returns the active backend
func (bm *backendManager) GetActiveBackend() Backend {
	return bm.backends[bm.active]
}

// GetCapabilities returns capabilities of the active backend
func (bm *backendManager) GetCapabilities() BackendCapabilities {
	backend := bm.GetActiveBackend()
	if backend == nil {
		return BackendCapabilities{}
	}
	return backend.GetCapabilities()
}

// SetWallpaper sets wallpaper using the active backend
func (bm *backendManager) SetWallpaper(ctx context.Context, imagePath, monitorName string) error {
	backend := bm.GetActiveBackend()
	if backend == nil {
		return fmt.Errorf("no active backend")
	}

	// Get backend config from config manager
	config, err := bm.configManager.GetBackendConfigForType(string(bm.active))
	if err != nil {
		return fmt.Errorf("failed to get backend config: %w", err)
	}

	return backend.SetWallpaper(ctx, imagePath, monitorName, config)
}

// SetWallpaperAll sets wallpaper on all monitors using the active backend
func (bm *backendManager) SetWallpaperAll(ctx context.Context, imagePath string) error {
	backend := bm.GetActiveBackend()
	if backend == nil {
		return fmt.Errorf("no active backend")
	}

	// Get backend config from config manager
	config, err := bm.configManager.GetBackendConfigForType(string(bm.active))
	if err != nil {
		return fmt.Errorf("failed to get backend config: %w", err)
	}

	return backend.SetWallpaperAll(ctx, imagePath, config)
}

// CleanupChildProcesses cleans up any child processes started by backends
// This is intentionally a no-op: each backend (e.g., swww) manages its own
// daemon process lifecycle. Backends are responsible for starting/stopping
// their own processes and cleaning up on shutdown.
func (bm *backendManager) CleanupChildProcesses(ctx context.Context) error {
	// No-op: backends handle their own process lifecycle
	return nil
}
