package backend

import (
	"context"
	"fmt"
	"strings"
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

	// Initialize checks if the backend is available and initializes it
	Initialize(ctx context.Context) error

	// SetWallpaper sets wallpaper on a specific monitor
	SetWallpaper(ctx context.Context, imagePath, monitorName string, config *BackendConfig) error

	// SetWallpaperAll sets wallpaper on all monitors
	SetWallpaperAll(ctx context.Context, imagePath string, config *BackendConfig) error

	// GetCapabilities returns what this backend supports
	GetCapabilities() BackendCapabilities

	// GetDefaultConfig returns default configuration for this backend
	GetDefaultConfig() *BackendConfig

	// StartDaemon starts the backend daemon if required
	StartDaemon(ctx context.Context) error

	// StopDaemon stops the backend daemon if it was started by this backend
	StopDaemon(ctx context.Context) error

	// IsDaemonRunning checks if the backend daemon is running
	IsDaemonRunning() bool
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

	// Monitor capabilities
	MultiMonitor bool `json:"multiMonitor"` // Can handle multiple monitors

	// Visual capabilities
	Transitions   bool `json:"transitions"`   // Supports transitions/animations
	ResizeOptions bool `json:"resizeOptions"` // Supports different resize modes
	Positioning   bool `json:"positioning"`   // Supports custom positioning
	Filters       bool `json:"filters"`       // Supports image filters

	// Runtime capabilities
	RealTimeQuery  bool `json:"realTimeQuery"`  // Can query monitors in real-time
	BackgroundMode bool `json:"backgroundMode"` // Can run in background
	DaemonMode     bool `json:"daemonMode"`     // Supports daemon mode

	// Performance characteristics
	MaxImageSize    int  `json:"maxImageSize"`    // Maximum supported image size (megapixels)
	FastSwitching   bool `json:"fastSwitching"`   // Optimized for rapid wallpaper changes
	MemoryEfficient bool `json:"memoryEfficient"` // Low memory usage
}

// BackendConfig holds configuration for a backend
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

// BackendManager manages multiple backends
type BackendManager struct {
	backends map[BackendType]Backend
	active   BackendType
	config   *BackendConfig
}

// NewBackendManager creates a new backend manager
func NewBackendManager() *BackendManager {
	return &BackendManager{
		backends: make(map[BackendType]Backend),
		config:   &BackendConfig{},
	}
}

// RegisterBackend registers a backend
func (bm *BackendManager) RegisterBackend(backend Backend) {
	bm.backends[backend.GetType()] = backend
}

// SetActiveBackend sets the active backend
func (bm *BackendManager) SetActiveBackend(backendType BackendType) error {
	if _, exists := bm.backends[backendType]; !exists {
		return ErrBackendNotRegistered
	}
	bm.active = backendType
	return nil
}

// GetActiveBackend returns the active backend
func (bm *BackendManager) GetActiveBackend() Backend {
	return bm.backends[bm.active]
}

// GetAvailableBackends returns all registered backends
func (bm *BackendManager) GetAvailableBackends() []BackendType {
	var types []BackendType
	for backendType := range bm.backends {
		types = append(types, backendType)
	}
	return types
}

// InitializeBackend initializes the active backend and starts its daemon if needed
func (bm *BackendManager) InitializeBackend(ctx context.Context) error {
	backend := bm.GetActiveBackend()
	if backend == nil {
		return ErrNoActiveBackend
	}

	// Initialize the backend
	if err := backend.Initialize(ctx); err != nil {
		return err
	}

	// Start daemon if needed (for backends that require it)
	if err := backend.StartDaemon(ctx); err != nil {
		return fmt.Errorf("failed to start backend daemon: %w", err)
	}

	return nil
}

// SetWallpaper sets wallpaper using the active backend
func (bm *BackendManager) SetWallpaper(ctx context.Context, imagePath, monitorName string, config *BackendConfig) error {
	backend := bm.GetActiveBackend()
	if backend == nil {
		return ErrNoActiveBackend
	}
	// Use provided config or fall back to manager's config
	if config == nil {
		config = bm.config
	}
	return backend.SetWallpaper(ctx, imagePath, monitorName, config)
}

// SetWallpaperAll sets wallpaper on all monitors using the active backend
func (bm *BackendManager) SetWallpaperAll(ctx context.Context, imagePath string, config *BackendConfig) error {
	backend := bm.GetActiveBackend()
	if backend == nil {
		return ErrNoActiveBackend
	}
	// Use provided config or fall back to manager's config
	if config == nil {
		config = bm.config
	}
	return backend.SetWallpaperAll(ctx, imagePath, config)
}

// UpdateConfig updates the backend configuration
func (bm *BackendManager) UpdateConfig(config *BackendConfig) {
	bm.config = config
}

// GetConfig returns the current configuration
func (bm *BackendManager) GetConfig() *BackendConfig {
	return bm.config
}

// GetBackendCapabilities returns capabilities of the active backend
func (bm *BackendManager) GetBackendCapabilities() *BackendCapabilities {
	backend := bm.GetActiveBackend()
	if backend == nil {
		return nil
	}
	capabilities := backend.GetCapabilities()
	return &capabilities
}

// ValidateBackendCompatibility checks if a backend is compatible with the current compositor
func (bm *BackendManager) ValidateBackendCompatibility(backendType BackendType, currentCompositor string) error {
	backend, exists := bm.backends[backendType]
	if !exists {
		return fmt.Errorf("backend '%s' is not registered", backendType)
	}

	capabilities := backend.GetCapabilities()

	// Normalize compositor names
	var compositorCompat bool
	switch strings.ToLower(currentCompositor) {
	case "wayland":
		compositorCompat = capabilities.Compositor.Wayland
	case "x11":
		compositorCompat = capabilities.Compositor.X11
	default:
		return fmt.Errorf("unknown compositor type: %s", currentCompositor)
	}

	if !compositorCompat {
		return fmt.Errorf("backend '%s' does not support %s compositor", backendType, currentCompositor)
	}

	return nil
}

// GetCompatibleBackends returns backends compatible with the current compositor
func (bm *BackendManager) GetCompatibleBackends(currentCompositor string) []BackendType {
	var compatible []BackendType

	for backendType, backend := range bm.backends {
		capabilities := backend.GetCapabilities()

		var isCompatible bool
		switch strings.ToLower(currentCompositor) {
		case "wayland":
			isCompatible = capabilities.Compositor.Wayland
		case "x11":
			isCompatible = capabilities.Compositor.X11
		}

		if isCompatible {
			compatible = append(compatible, backendType)
		}
	}

	return compatible
}

// GetBestBackend returns the best backend for the given media type and compositor
func (bm *BackendManager) GetBestBackend(mediaType string, currentCompositor string) (BackendType, error) {
	compatibleBackends := bm.GetCompatibleBackends(currentCompositor)

	if len(compatibleBackends) == 0 {
		return "", fmt.Errorf("no backends compatible with %s compositor", currentCompositor)
	}

	// Score backends based on capabilities
	type scoredBackend struct {
		backend BackendType
		score   int
	}

	var scores []scoredBackend

	for _, backendType := range compatibleBackends {
		backend := bm.backends[backendType]
		capabilities := backend.GetCapabilities()

		score := 0

		// Media type compatibility
		switch strings.ToLower(mediaType) {
		case "image":
			if capabilities.MediaTypes.Images {
				score += 10
			}
		case "video":
			if capabilities.MediaTypes.Videos {
				score += 10
			}
		case "html":
			if capabilities.MediaTypes.HTML {
				score += 10
			}
		case "3d":
			if capabilities.MediaTypes.D3D {
				score += 10
			}
		}

		// Additional scoring based on capabilities
		if capabilities.FastSwitching {
			score += 5
		}
		if capabilities.MemoryEfficient {
			score += 3
		}
		if capabilities.BackgroundMode {
			score += 2
		}

		scores = append(scores, scoredBackend{
			backend: backendType,
			score:   score,
		})
	}

	// Sort by score (highest first)
	for i := 0; i < len(scores)-1; i++ {
		for j := i + 1; j < len(scores); j++ {
			if scores[i].score < scores[j].score {
				scores[i], scores[j] = scores[j], scores[i]
			}
		}
	}

	if len(scores) > 0 {
		return scores[0].backend, nil
	}

	return "", fmt.Errorf("no suitable backend found for %s on %s", mediaType, currentCompositor)
}

// CleanupChildProcesses cleans up child processes (daemons, etc.) from managed backends
func (bm *BackendManager) CleanupChildProcesses(ctx context.Context) error {
	for backendType, backend := range bm.backends {
		if err := backend.StopDaemon(ctx); err != nil {
			return fmt.Errorf("failed to cleanup %s backend processes: %w", backendType, err)
		}
	}
	return nil
}
