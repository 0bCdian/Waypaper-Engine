package shadowtest

// awww equivalence definition:
//
// awww runs a single "awww img PATH --outputs MON1,MON2 [flags...]" invocation
// per unique content path. Equivalence is defined as the sorted set of argv
// invocations (each rendered as NUL-joined bytes, then sorted, then newline-joined).
// Sorting is required because Apply groups by path in map-iteration order, which
// is not guaranteed to be stable.

import (
	"bytes"
	"context"
	"sort"
	"sync"
	"testing"

	"github.com/spf13/viper"

	"waypaper-engine/daemon/internal/backend"
	backendawww "waypaper-engine/daemon/internal/backend/awww"
)

// AwwwCaptor records the argv of each "awww img" invocation during Apply or SetWallpaper.
type AwwwCaptor struct {
	backend     *backendawww.Awww
	mu          sync.Mutex
	invocations [][]string
}

// NewAwwwCaptor builds an Awww with its exec seam replaced to record calls.
func NewAwwwCaptor(t *testing.T) *AwwwCaptor {
	t.Helper()
	v := viper.New()

	b := backendawww.New().(*backendawww.Awww)
	b.RegisterDefaults(v)

	c := &AwwwCaptor{backend: b}
	b.SetExecForTest(func(_ context.Context, args []string) error {
		c.mu.Lock()
		defer c.mu.Unlock()
		c.invocations = append(c.invocations, append([]string(nil), args...))
		return nil
	})
	return c
}

// Backend returns the underlying Awww for direct calls when needed.
func (c *AwwwCaptor) Backend() *backendawww.Awww {
	return c.backend
}

// LastInvocations returns a copy of the captured invocations under lock.
func (c *AwwwCaptor) LastInvocations() [][]string {
	c.mu.Lock()
	defer c.mu.Unlock()
	out := make([][]string, len(c.invocations))
	for i, inv := range c.invocations {
		out[i] = append([]string(nil), inv...)
	}
	return out
}

func (c *AwwwCaptor) reset() {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.invocations = nil
}

// invocationBytes serialises captured invocations to a deterministic byte slice.
// Each invocation is rendered as NUL-joined args; invocations are sorted and
// newline-joined so comparison is order-independent.
func (c *AwwwCaptor) invocationBytes() []byte {
	c.mu.Lock()
	invs := make([][]string, len(c.invocations))
	for i, inv := range c.invocations {
		invs[i] = append([]string(nil), inv...)
	}
	c.mu.Unlock()

	// Render each invocation as NUL-separated string.
	rendered := make([][]byte, len(invs))
	for i, inv := range invs {
		rendered[i] = []byte(joinNul(inv))
	}
	// Sort for determinism.
	sort.Slice(rendered, func(i, j int) bool {
		return bytes.Compare(rendered[i], rendered[j]) < 0
	})
	return bytes.Join(rendered, []byte{'\n'})
}

func joinNul(args []string) string {
	if len(args) == 0 {
		return ""
	}
	var buf []byte
	for i, a := range args {
		if i > 0 {
			buf = append(buf, 0)
		}
		buf = append(buf, []byte(a)...)
	}
	return string(buf)
}

// CaptureSetWallpaper resets captured invocations, runs SetWallpaper, and returns
// the serialised invocation bytes.
func (c *AwwwCaptor) CaptureSetWallpaper(t *testing.T, req backend.WallpaperRequest) []byte {
	t.Helper()
	c.reset()
	_ = c.backend.SetWallpaper(t.Context(), req)
	return c.invocationBytes()
}

// CaptureApply resets captured invocations, runs Apply, and returns the serialised
// invocation bytes.
func (c *AwwwCaptor) CaptureApply(t *testing.T, snap backend.Snapshot) []byte {
	t.Helper()
	c.reset()
	_ = c.backend.Apply(t.Context(), snap)
	return c.invocationBytes()
}
