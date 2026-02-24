package monitor

import (
	"context"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// stubProvider is a minimal MonitorProvider for manager tests.
// Defined locally to avoid a circular import with the testutil package.
type stubProvider struct {
	name       string
	avail      bool
	compositor CompositorType
	priority   int
	detectFn   func(context.Context) ([]Monitor, error)
}

func (s *stubProvider) Name() string              { return s.name }
func (s *stubProvider) IsAvailable() bool          { return s.avail }
func (s *stubProvider) Compositor() CompositorType { return s.compositor }
func (s *stubProvider) Priority() int              { return s.priority }

func (s *stubProvider) Detect(ctx context.Context) ([]Monitor, error) {
	if s.detectFn != nil {
		return s.detectFn(ctx)
	}
	return nil, nil
}

func newTestManager(t *testing.T, detectFn func(context.Context) ([]Monitor, error)) (MonitorManager, *int) {
	t.Helper()
	detectCount := new(int)
	provider := &stubProvider{
		name:       "test-provider",
		avail:      true,
		compositor: CompositorWayland,
		priority:   20,
		detectFn: func(ctx context.Context) ([]Monitor, error) {
			*detectCount++
			return detectFn(ctx)
		},
	}
	mgr, err := NewMonitorManager([]MonitorProvider{provider}, CompositorWayland)
	require.NoError(t, err)
	return mgr, detectCount
}

func TestMonitorManager_GetMonitors_CachesResult(t *testing.T) {
	mgr, detectCount := newTestManager(t, func(_ context.Context) ([]Monitor, error) {
		return []Monitor{{Name: "HDMI-A-1", Width: 1920, Height: 1080}}, nil
	})

	mons1, err := mgr.GetMonitors(context.Background())
	require.NoError(t, err)
	assert.Len(t, mons1, 1)

	mons2, err := mgr.GetMonitors(context.Background())
	require.NoError(t, err)
	assert.Len(t, mons2, 1)

	assert.Equal(t, 1, *detectCount, "Detect should be called only once due to caching")
}

func TestMonitorManager_Refresh_UpdatesCache(t *testing.T) {
	mgr, detectCount := newTestManager(t, func(_ context.Context) ([]Monitor, error) {
		return []Monitor{{Name: "HDMI-A-1", Width: 1920, Height: 1080}}, nil
	})

	_, err := mgr.GetMonitors(context.Background())
	require.NoError(t, err)
	assert.Equal(t, 1, *detectCount)

	require.NoError(t, mgr.Refresh(context.Background()))
	assert.Equal(t, 2, *detectCount, "Refresh should trigger a new Detect call")
}

func TestMonitorManager_GetMonitorByName_Found(t *testing.T) {
	mgr, _ := newTestManager(t, func(_ context.Context) ([]Monitor, error) {
		return []Monitor{
			{Name: "HDMI-A-1", Width: 1920, Height: 1080},
			{Name: "eDP-1", Width: 2560, Height: 1440},
		}, nil
	})

	mon, err := mgr.GetMonitorByName(context.Background(), "eDP-1")
	require.NoError(t, err)
	assert.Equal(t, "eDP-1", mon.Name)
	assert.Equal(t, 2560, mon.Width)
}

func TestMonitorManager_GetMonitorByName_NotFound(t *testing.T) {
	mgr, _ := newTestManager(t, func(_ context.Context) ([]Monitor, error) {
		return []Monitor{{Name: "HDMI-A-1", Width: 1920, Height: 1080}}, nil
	})

	_, err := mgr.GetMonitorByName(context.Background(), "DP-99")
	require.Error(t, err)
	assert.Contains(t, err.Error(), "not found")
}

func TestMonitorManager_Compositor(t *testing.T) {
	mgr, _ := newTestManager(t, func(_ context.Context) ([]Monitor, error) {
		return nil, nil
	})

	assert.Equal(t, CompositorWayland, mgr.Compositor())
}
