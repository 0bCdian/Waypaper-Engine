package waylandutauri

import (
	"context"
	"testing"

	"waypaper-engine/daemon/internal/parallaxdriver"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestMonitorResolverCache_ResolvesOncePerContext(t *testing.T) {
	callCount := 0
	cache := newMonitorResolverCache(func(context.Context) ([]topologyEntry, error) {
		callCount++
		return []topologyEntry{
			{Monitor: 1, X: 1920, Y: 0, Width: 1920, Height: 1080},
		}, nil
	}, nil)

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	entry := parallaxdriver.MonitorWorkspaceEntry{
		Bounds: parallaxdriver.Rect{X: 1920, Y: 0, Width: 1920, Height: 1080},
	}
	id, ok := cache.resolve(ctx, entry)
	require.True(t, ok)
	assert.Equal(t, uint32(1), id)

	id, ok = cache.resolve(ctx, entry)
	require.True(t, ok)
	assert.Equal(t, uint32(1), id)
	assert.Equal(t, 1, callCount, "expected one topology fetch for same tick context")
}

func TestMonitorResolverCache_RefetchesForNewContext(t *testing.T) {
	callCount := 0
	cache := newMonitorResolverCache(func(context.Context) ([]topologyEntry, error) {
		callCount++
		return []topologyEntry{
			{Monitor: 0, X: 0, Y: 0, Width: 1920, Height: 1080},
		}, nil
	}, nil)

	ctxA, cancelA := context.WithCancel(context.Background())
	defer cancelA()
	ctxB, cancelB := context.WithCancel(context.Background())
	defer cancelB()

	entry := parallaxdriver.MonitorWorkspaceEntry{
		Bounds: parallaxdriver.Rect{X: 0, Y: 0, Width: 1920, Height: 1080},
	}
	_, ok := cache.resolve(ctxA, entry)
	require.True(t, ok)
	_, ok = cache.resolve(ctxB, entry)
	require.True(t, ok)

	assert.Equal(t, 2, callCount, "expected one topology fetch per tick context")
}
