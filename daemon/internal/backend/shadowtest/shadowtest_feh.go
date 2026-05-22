package shadowtest

import (
	"sync"
	"testing"

	"github.com/spf13/viper"

	"waypaper-engine/daemon/internal/backend"
	"waypaper-engine/daemon/internal/backend/feh"
)

// FehCaptor records the argv passed to execFn, in order.
type FehCaptor struct {
	backend *feh.Feh
	mu      sync.Mutex
	last    []string
}

// NewFehCaptor builds a Feh with its exec seam swapped to record argv.
// feh is fire-and-forget; no process is spawned.
func NewFehCaptor(t *testing.T) *FehCaptor {
	t.Helper()
	v := viper.New()
	v.Set("backend.feh.mode", "fill")

	b := feh.New().(*feh.Feh)
	b.RegisterDefaults(v)

	c := &FehCaptor{backend: b}
	b.SetExecForTest(func(args []string) error {
		c.mu.Lock()
		defer c.mu.Unlock()
		c.last = append([]string(nil), args...)
		return nil
	})
	// Default: no Xinerama reorder — emit outputs in snap order so tests that
	// don't care about head ordering stay deterministic without shelling out
	// to xrandr.
	b.SetXineramaOrderForTest(func() (map[string]int, error) {
		return map[string]int{}, nil
	})
	return c
}

// SetXineramaOrder overrides the Xinerama head-index map for this captor.
// Pass nil to restore the default (empty map → no reordering).
func (c *FehCaptor) SetXineramaOrder(order map[string]int) {
	if order == nil {
		c.backend.SetXineramaOrderForTest(func() (map[string]int, error) {
			return map[string]int{}, nil
		})
		return
	}
	c.backend.SetXineramaOrderForTest(func() (map[string]int, error) {
		return order, nil
	})
}

// LastArgv returns a copy of the most recently captured argv under lock.
func (c *FehCaptor) LastArgv() []string {
	c.mu.Lock()
	defer c.mu.Unlock()
	return append([]string(nil), c.last...)
}

func (c *FehCaptor) CaptureApply(t *testing.T, snap backend.Snapshot) []byte {
	t.Helper()
	_ = c.backend.Apply(t.Context(), snap)
	return c.argvBytes()
}

func (c *FehCaptor) argvBytes() []byte {
	c.mu.Lock()
	defer c.mu.Unlock()
	var out []byte
	for i, a := range c.last {
		if i > 0 {
			out = append(out, 0)
		}
		out = append(out, []byte(a)...)
	}
	return out
}
