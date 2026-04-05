package waylandutauri

import (
	"context"
	"log/slog"
	"sync"

	"waypaper-engine/daemon/internal/parallaxdriver"
)

type topologySnapshotProvider func(ctx context.Context) ([]topologyEntry, error)

// monitorResolverCache caches a topology snapshot per tick context so multi-monitor
// resolution does one /wallpaper/status fetch per tick instead of per monitor entry.
type monitorResolverCache struct {
	mu       sync.Mutex
	lastDone <-chan struct{}
	valid    bool
	topo     []topologyEntry
	fetch    topologySnapshotProvider
	log      *slog.Logger
}

func newMonitorResolverCache(fetch topologySnapshotProvider, log *slog.Logger) *monitorResolverCache {
	if log == nil {
		log = slog.Default()
	}
	return &monitorResolverCache{fetch: fetch, log: log}
}

func (r *monitorResolverCache) resolve(ctx context.Context, e parallaxdriver.MonitorWorkspaceEntry) (uint32, bool) {
	topo, ok := r.topologyForContext(ctx)
	if !ok {
		return 0, false
	}
	return ResolveParallaxMonitor(
		topo,
		e.Bounds.X, e.Bounds.Y, e.Bounds.Width, e.Bounds.Height,
		e.CompositorMonID,
	)
}

func (r *monitorResolverCache) topologyForContext(ctx context.Context) ([]topologyEntry, bool) {
	done := ctx.Done()

	r.mu.Lock()
	defer r.mu.Unlock()

	if done == r.lastDone {
		return r.topo, r.valid
	}

	topo, err := r.fetch(ctx)
	r.lastDone = done
	if err != nil {
		r.valid = false
		r.topo = nil
		r.log.Debug("parallax compositor driver: status for monitor resolve", "error", err)
		return nil, false
	}
	r.valid = true
	r.topo = topo
	return r.topo, true
}
