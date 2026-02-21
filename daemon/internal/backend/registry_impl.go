package backend

import (
	"fmt"
	"slices"
	"sync"

	"waypaper-engine/daemon/internal/monitor"
)

// registry is the concrete implementation of Registry.
type registry struct {
	mu         sync.RWMutex
	backends   map[string]Backend
	activeName string
}

// NewRegistry creates an empty Registry. Backends are added via Register().
func NewRegistry() Registry {
	return &registry{
		backends: make(map[string]Backend),
	}
}

func (r *registry) Register(b Backend) error {
	r.mu.Lock()
	defer r.mu.Unlock()

	name := b.Name()
	if _, exists := r.backends[name]; exists {
		return fmt.Errorf("backend %q is already registered", name)
	}
	r.backends[name] = b
	return nil
}

func (r *registry) Get(name string) (Backend, bool) {
	r.mu.RLock()
	defer r.mu.RUnlock()

	b, ok := r.backends[name]
	return b, ok
}

func (r *registry) Active() Backend {
	r.mu.RLock()
	defer r.mu.RUnlock()

	if r.activeName == "" {
		panic("backend: Active() called but no backend has been activated")
	}
	return r.backends[r.activeName]
}

func (r *registry) SetActive(name string) error {
	r.mu.Lock()
	defer r.mu.Unlock()

	b, ok := r.backends[name]
	if !ok {
		return fmt.Errorf("backend %q is not registered", name)
	}
	if !b.IsAvailable() {
		return fmt.Errorf("backend %q is not available on this system", name)
	}
	r.activeName = name
	return nil
}

func (r *registry) Available() []BackendInfo {
	r.mu.RLock()
	defer r.mu.RUnlock()

	infos := make([]BackendInfo, 0, len(r.backends))
	for _, b := range r.backends {
		infos = append(infos, BackendInfo{
			Name:         b.Name(),
			Available:    b.IsAvailable(),
			Active:       b.Name() == r.activeName,
			Capabilities: b.Capabilities(),
		})
	}
	slices.SortFunc(infos, func(a, b BackendInfo) int {
		if a.Name < b.Name {
			return -1
		}
		if a.Name > b.Name {
			return 1
		}
		return 0
	})
	return infos
}

func (r *registry) Compatible(compositor monitor.CompositorType) []BackendInfo {
	r.mu.RLock()
	defer r.mu.RUnlock()

	var infos []BackendInfo
	for _, b := range r.backends {
		caps := b.Capabilities()
		for _, c := range caps.Compositors {
			if c == compositor {
				infos = append(infos, BackendInfo{
					Name:         b.Name(),
					Available:    b.IsAvailable(),
					Active:       b.Name() == r.activeName,
					Capabilities: caps,
				})
				break
			}
		}
	}
	slices.SortFunc(infos, func(a, b BackendInfo) int {
		if a.Name < b.Name {
			return -1
		}
		if a.Name > b.Name {
			return 1
		}
		return 0
	})
	return infos
}
