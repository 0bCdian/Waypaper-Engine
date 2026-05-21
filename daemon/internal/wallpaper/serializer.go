package wallpaper

import (
	"context"
	"errors"
	"sync"
	"sync/atomic"
)

// ErrSuperseded is returned by Apply when a newer Apply call for the same backend
// preempted this one. The user/playlist has already moved on, so callers should
// treat this as a benign outcome rather than a failure.
var ErrSuperseded = errors.New("wallpaper apply superseded by newer request")

type applyTicket struct {
	cancel    context.CancelFunc
	done      chan struct{}
	preempted atomic.Bool
}

// applyGate serializes Apply calls per backend with latest-wins semantics:
// when a new call arrives while one is in-flight, the in-flight one's ctx is
// cancelled and the new call waits for it to unwind before starting. This
// prevents rapid set_wallpaper clicks from stacking concurrent backend.Apply
// invocations, which on wal-qt would otherwise produce a retry storm against
// its own latest-wins server-side semantics.
type applyGate struct {
	mu       sync.Mutex
	inFlight map[string]*applyTicket
}

func newApplyGate() *applyGate {
	return &applyGate{inFlight: make(map[string]*applyTicket)}
}

func (g *applyGate) acquire(parent context.Context, key string) (context.Context, *applyTicket) {
	ctx, cancel := context.WithCancel(parent)
	t := &applyTicket{cancel: cancel, done: make(chan struct{})}

	g.mu.Lock()
	prev := g.inFlight[key]
	g.inFlight[key] = t
	g.mu.Unlock()

	if prev != nil {
		prev.preempted.Store(true)
		prev.cancel()
		<-prev.done
	}

	return ctx, t
}

func (g *applyGate) release(key string, t *applyTicket) {
	t.cancel()
	close(t.done)
	g.mu.Lock()
	if g.inFlight[key] == t {
		delete(g.inFlight, key)
	}
	g.mu.Unlock()
}

var defaultApplyGate = newApplyGate()
