package backend

import (
	"context"
	"encoding/json"
	"sync"
	"sync/atomic"
	"testing"

	"github.com/spf13/viper"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// trackingBackend records how many times it is concurrently "live" between
// Initialize and Shutdown, so an interleaved switch shows up as >1.
type trackingBackend struct {
	name    string
	live    atomic.Int32
	maxLive atomic.Int32
}

func (b *trackingBackend) Name() string      { return b.name }
func (b *trackingBackend) IsAvailable() bool { return true }
func (b *trackingBackend) Capabilities() Capabilities {
	return Capabilities{ContentKinds: []ContentKind{KindStaticImage}}
}
func (b *trackingBackend) Initialize(_ context.Context) error {
	n := b.live.Add(1)
	for {
		m := b.maxLive.Load()
		if n <= m || b.maxLive.CompareAndSwap(m, n) {
			break
		}
	}
	return nil
}
func (b *trackingBackend) Shutdown(_ context.Context) error          { b.live.Add(-1); return nil }
func (b *trackingBackend) RegisterDefaults(_ *viper.Viper)           {}
func (b *trackingBackend) ValidateConfig(_ json.RawMessage) error    { return nil }
func (b *trackingBackend) Apply(_ context.Context, _ Snapshot) error { return nil }

type noopPersister struct{}

func (noopPersister) SetActiveBackendType(string) error { return nil }

// Regression: Shutdown -> SetActive -> Initialize was unguarded, so two callers
// could interleave and one would initialize the other's backend while the
// registry pointed at a third. Auto-mode ticks race manual sets through here.
func TestSwitchActiveBackend_ConcurrentSwitchesStayConsistent(t *testing.T) {
	reg := NewRegistry()
	a := &trackingBackend{name: "alpha"}
	b := &trackingBackend{name: "beta"}
	require.NoError(t, reg.Register(a))
	require.NoError(t, reg.Register(b))
	require.NoError(t, reg.SetActive("alpha"))

	var wg sync.WaitGroup
	for i := range 50 {
		wg.Add(1)
		go func(n int) {
			defer wg.Done()
			target := "alpha"
			if n%2 == 0 {
				target = "beta"
			}
			got, err := SwitchActiveBackend(context.Background(), reg, target, noopPersister{}, SwitchOpts{})
			if err == nil {
				require.NotNil(t, got)
				assert.Equal(t, target, got.Name(),
					"SwitchActiveBackend must return the backend it activated")
			}
		}(i)
	}
	wg.Wait()

	assert.LessOrEqual(t, a.maxLive.Load(), int32(1), "alpha was initialized while already live")
	assert.LessOrEqual(t, b.maxLive.Load(), int32(1), "beta was initialized while already live")
	assert.True(t, reg.HasActive())
}
