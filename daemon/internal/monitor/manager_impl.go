package monitor

import (
	"context"
	"fmt"
	"sort"
	"sync"
)

// monitorManager is the concrete MonitorManager implementation.
//
// It selects the highest-priority available provider for the detected compositor,
// caches the monitor list, and supports forced refresh via Refresh().
type monitorManager struct {
	compositor CompositorType
	provider   MonitorProvider

	mu       sync.RWMutex
	monitors []Monitor
}

// NewMonitorManager creates a MonitorManager that auto-selects the best available
// provider for the given compositor.
//
// Providers are filtered to match the given compositor type, then sorted by
// descending priority. The first provider that reports IsAvailable() is selected.
//
// If compositor is empty, DetectCompositor() is called automatically.
// Returns an error if no suitable provider is available.
func NewMonitorManager(providers []MonitorProvider, compositor CompositorType) (MonitorManager, error) {
	if compositor == "" {
		compositor = DetectCompositor()
	}

	provider, err := selectProvider(providers, compositor)
	if err != nil {
		return nil, err
	}

	return &monitorManager{
		compositor: compositor,
		provider:   provider,
	}, nil
}

// selectProvider filters providers by compositor, sorts by descending priority,
// and returns the first available one.
func selectProvider(providers []MonitorProvider, compositor CompositorType) (MonitorProvider, error) {
	// Filter by compositor type.
	var candidates []MonitorProvider
	for _, p := range providers {
		if p.Compositor() == compositor {
			candidates = append(candidates, p)
		}
	}

	if len(candidates) == 0 {
		return nil, fmt.Errorf("no monitor providers registered for compositor %q", compositor)
	}

	// Sort by descending priority.
	sort.Slice(candidates, func(i, j int) bool {
		return candidates[i].Priority() > candidates[j].Priority()
	})

	// Pick the first available provider.
	for _, p := range candidates {
		if p.IsAvailable() {
			return p, nil
		}
	}

	// Build a descriptive error with the names of tried providers.
	names := make([]string, len(candidates))
	for i, p := range candidates {
		names[i] = p.Name()
	}
	return nil, fmt.Errorf("no available monitor provider for compositor %q (tried: %v)", compositor, names)
}

func (m *monitorManager) GetMonitors(ctx context.Context) ([]Monitor, error) {
	m.mu.RLock()
	cached := m.monitors
	m.mu.RUnlock()

	if cached != nil {
		return cached, nil
	}

	// No cache yet — perform initial detection.
	return m.refresh(ctx)
}

func (m *monitorManager) GetMonitorByName(ctx context.Context, name string) (Monitor, error) {
	monitors, err := m.GetMonitors(ctx)
	if err != nil {
		return Monitor{}, err
	}

	for _, mon := range monitors {
		if mon.Name == name {
			return mon, nil
		}
	}

	return Monitor{}, fmt.Errorf("monitor %q not found", name)
}

func (m *monitorManager) Refresh(ctx context.Context) error {
	_, err := m.refresh(ctx)
	return err
}

func (m *monitorManager) Compositor() CompositorType {
	return m.compositor
}

// refresh queries the underlying provider and updates the cache.
func (m *monitorManager) refresh(ctx context.Context) ([]Monitor, error) {
	monitors, err := m.provider.Detect(ctx)
	if err != nil {
		return nil, fmt.Errorf("detect monitors via %s: %w", m.provider.Name(), err)
	}

	m.mu.Lock()
	m.monitors = monitors
	m.mu.Unlock()

	return monitors, nil
}
