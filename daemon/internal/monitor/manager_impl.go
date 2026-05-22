package monitor

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"sort"
	"sync"
)

// monitorManager is the concrete MonitorManager implementation.
//
// At construction it filters providers by compositor type and sorts them by
// descending priority. Provider selection happens lazily on the first
// Detect: candidates are tried in order; a candidate that returns
// ErrProviderNotApplicable is skipped, any other error is surfaced
// immediately, and the first successful candidate is pinned for the
// lifetime of the manager.
type monitorManager struct {
	compositor CompositorType
	candidates []MonitorProvider

	mu       sync.RWMutex
	chosen   MonitorProvider
	monitors []Monitor
}

// NewMonitorManager creates a MonitorManager for the given compositor.
//
// If compositor is empty, DetectCompositor() is called automatically.
//
// Providers are filtered to those matching the compositor, then sorted by
// descending priority. The first call to GetMonitors/Refresh walks them in
// order and pins the first that doesn't return ErrProviderNotApplicable.
//
// If providers is nil or empty, a no-op provider is used so the daemon can
// start in test/headless environments. Returns an error only if no providers
// match the requested compositor.
func NewMonitorManager(providers []MonitorProvider, compositor CompositorType) (MonitorManager, error) {
	if compositor == "" {
		compositor = DetectCompositor()
	}

	if len(providers) == 0 {
		noop := &noopProvider{compositor: compositor}
		return &monitorManager{
			compositor: compositor,
			candidates: []MonitorProvider{noop},
			chosen:     noop,
		}, nil
	}

	candidates := filterAndSort(providers, compositor)
	if len(candidates) == 0 {
		return nil, fmt.Errorf("no monitor providers registered for compositor %q", compositor)
	}

	return &monitorManager{
		compositor: compositor,
		candidates: candidates,
	}, nil
}

// noopProvider is a MonitorProvider that always returns an empty monitor list.
// Used when no real providers are registered (tests / headless).
type noopProvider struct {
	compositor CompositorType
}

func (n *noopProvider) Name() string                                { return "noop" }
func (n *noopProvider) Compositor() CompositorType                  { return n.compositor }
func (n *noopProvider) Priority() int                               { return 0 }
func (n *noopProvider) Detect(_ context.Context) ([]Monitor, error) { return nil, nil }

// filterAndSort returns providers matching compositor, sorted by descending priority.
func filterAndSort(providers []MonitorProvider, compositor CompositorType) []MonitorProvider {
	out := make([]MonitorProvider, 0, len(providers))
	for _, p := range providers {
		if p.Compositor() == compositor {
			out = append(out, p)
		}
	}
	sort.SliceStable(out, func(i, j int) bool {
		return out[i].Priority() > out[j].Priority()
	})
	return out
}

func (m *monitorManager) GetMonitors(ctx context.Context) ([]Monitor, error) {
	m.mu.RLock()
	cached := m.monitors
	chosen := m.chosen
	m.mu.RUnlock()

	if cached != nil && chosen != nil {
		return cached, nil
	}

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

// refresh runs Detect against the chosen provider, or — if none is pinned yet
// — walks candidates in priority order until one succeeds.
func (m *monitorManager) refresh(ctx context.Context) ([]Monitor, error) {
	m.mu.RLock()
	chosen := m.chosen
	m.mu.RUnlock()

	if chosen != nil {
		monitors, err := chosen.Detect(ctx)
		if err != nil {
			return nil, fmt.Errorf("detect monitors via %s: %w", chosen.Name(), err)
		}
		m.cache(monitors)
		return monitors, nil
	}

	return m.pickAndDetect(ctx)
}

// pickAndDetect walks the candidates in priority order. ErrProviderNotApplicable
// causes the candidate to be skipped; any other error is surfaced immediately
// (no fall-through), since the provider has claimed it is applicable but
// something went wrong — masking that behind a fallback would hide a broken
// environment. The first candidate that returns a result is pinned.
func (m *monitorManager) pickAndDetect(ctx context.Context) ([]Monitor, error) {
	tried := make([]string, 0, len(m.candidates))
	for _, p := range m.candidates {
		monitors, err := p.Detect(ctx)
		if errors.Is(err, ErrProviderNotApplicable) {
			slog.Debug("monitor provider not applicable, trying next", "provider", p.Name(), "err", err)
			tried = append(tried, p.Name())
			continue
		}
		if err != nil {
			return nil, fmt.Errorf("detect monitors via %s: %w", p.Name(), err)
		}

		m.mu.Lock()
		m.chosen = p
		m.monitors = monitors
		m.mu.Unlock()
		slog.Debug("monitor provider selected", "provider", p.Name(), "compositor", m.compositor)
		return monitors, nil
	}

	return nil, fmt.Errorf("no applicable monitor provider for compositor %q (tried: %v): %w",
		m.compositor, tried, ErrProviderNotApplicable)
}

func (m *monitorManager) cache(monitors []Monitor) {
	m.mu.Lock()
	m.monitors = monitors
	m.mu.Unlock()
}
