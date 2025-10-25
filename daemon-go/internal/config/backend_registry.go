package config

import (
	"fmt"
	"sync"
	"waypaper-engine/daemon-go/internal/backend"
)

// BackendConfigRegistry manages backend-specific configurations
type BackendConfigRegistry struct {
	configs map[string]any
	mu      sync.RWMutex
}

// NewBackendConfigRegistry creates a new backend config registry
func NewBackendConfigRegistry() *BackendConfigRegistry {
	return &BackendConfigRegistry{
		configs: make(map[string]any),
	}
}

// RegisterBackendConfig registers a backend configuration
func (r *BackendConfigRegistry) RegisterBackendConfig(backendType string, config any) {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.configs[backendType] = config
}

// GetBackendConfig retrieves a backend configuration
func (r *BackendConfigRegistry) GetBackendConfig(backendType string) (any, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()

	config, exists := r.configs[backendType]
	if !exists {
		return nil, fmt.Errorf("no config registered for backend type: %s", backendType)
	}
	return config, nil
}

// GetDefaultBackendConfig returns the default configuration for a backend type
func (r *BackendConfigRegistry) GetDefaultBackendConfig(backendType string) (any, error) {
	switch backendType {
	case "swww":
		return backend.SwwwConfig{
			TransitionType:     "simple",
			TransitionStep:     90,
			TransitionDuration: 200,
			TransitionAngle:    45,
			TransitionPos:      "center",
			TransitionBezier:   "0.4,0.0,0.2,1",
			TransitionWave:     "0,0,0,0",
		}, nil
	case "hyprpaper":
		// TODO: Add hyprpaper default config when implemented
		return map[string]any{}, nil
	default:
		return nil, fmt.Errorf("unknown backend type: %s", backendType)
	}
}

// GetAllBackendTypes returns all registered backend types
func (r *BackendConfigRegistry) GetAllBackendTypes() []string {
	r.mu.RLock()
	defer r.mu.RUnlock()

	types := make([]string, 0, len(r.configs))
	for backendType := range r.configs {
		types = append(types, backendType)
	}
	return types
}

// HasBackendConfig checks if a backend config is registered
func (r *BackendConfigRegistry) HasBackendConfig(backendType string) bool {
	r.mu.RLock()
	defer r.mu.RUnlock()

	_, exists := r.configs[backendType]
	return exists
}
