package backend

import (
	"context"
	"fmt"
	"log/slog"
)

// BackendFactory creates backends
type BackendFactory struct {
	runner CommandRunner
	logger *slog.Logger
}

// NewBackendFactory creates a new backend factory
func NewBackendFactory(runner CommandRunner, logger *slog.Logger) *BackendFactory {
	return &BackendFactory{
		runner: runner,
		logger: logger,
	}
}

// CreateBackend creates a backend of the specified type
func (f *BackendFactory) CreateBackend(backendType BackendType) (Backend, error) {
	switch backendType {
	case BackendSwww:
		return NewSwwwBackend(f.runner, f.logger), nil
	case BackendHyprpaper:
		return NewHyprpaperBackend(f.runner, f.logger), nil
	case BackendFeh:
		return NewFehBackend(f.runner, f.logger), nil
	case BackendNitrogen:
		return NewNitrogenBackend(f.runner, f.logger), nil
	case BackendWallutils:
		return NewWallutilsBackend(f.runner, f.logger), nil
	default:
		return nil, fmt.Errorf("unsupported backend type: %s", backendType)
	}
}

// CreateAllBackends creates all available backends
func (f *BackendFactory) CreateAllBackends() map[BackendType]Backend {
	backends := make(map[BackendType]Backend)

	backendTypes := []BackendType{
		BackendSwww,
		BackendHyprpaper,
		BackendFeh,
		BackendNitrogen,
		BackendWallutils,
	}

	for _, backendType := range backendTypes {
		backend, err := f.CreateBackend(backendType)
		if err != nil {
			f.logger.Warn("failed to create backend", "type", backendType, "error", err)
			continue
		}
		backends[backendType] = backend
	}

	return backends
}

// DetectAvailableBackends detects which backends are available on the system
func (f *BackendFactory) DetectAvailableBackends(ctx context.Context) []BackendType {
	var available []BackendType

	backendTypes := []BackendType{
		BackendSwww,
		BackendHyprpaper,
		BackendFeh,
		BackendNitrogen,
		BackendWallutils,
	}

	for _, backendType := range backendTypes {
		backend, err := f.CreateBackend(backendType)
		if err != nil {
			continue
		}

		if err := backend.Initialize(ctx); err != nil {
			f.logger.Debug("backend not available", "type", backendType, "error", err)
			continue
		}

		available = append(available, backendType)
		f.logger.Info("backend available", "type", backendType)
	}

	return available
}

// GetRecommendedBackend returns the recommended backend based on system detection
func (f *BackendFactory) GetRecommendedBackend(ctx context.Context) BackendType {
	available := f.DetectAvailableBackends(ctx)

	// Priority order for backend selection
	priority := []BackendType{
		BackendSwww,      // Best for Wayland with transitions
		BackendHyprpaper, // Good for Hyprland
		BackendWallutils, // Good for X11 with multi-monitor
		BackendNitrogen,  // Good for X11
		BackendFeh,       // Fallback for X11
	}

	for _, backendType := range priority {
		for _, availableType := range available {
			if backendType == availableType {
				return backendType
			}
		}
	}

	// If no backend is available, return swww as default (will fail gracefully)
	return BackendSwww
}
