package shadowtest

import (
	"sync"
	"testing"

	"github.com/spf13/viper"

	"waypaper-engine/daemon/internal/backend"
	"waypaper-engine/daemon/internal/backend/swaybg"
)

// SwaybgCaptor records the argv passed to startProcess, in order.
type SwaybgCaptor struct {
	backend *swaybg.Swaybg
	mu      sync.Mutex
	last    []string
}

// NewSwaybgCaptor builds a Swaybg with its startProcess seam swapped to
// record argv. killProcess is still called but is a no-op without an
// actual process (its pkill+wait sequence on a non-existent process is harmless).
func NewSwaybgCaptor(t *testing.T) *SwaybgCaptor {
	t.Helper()
	v := viper.New()
	v.Set("backend.swaybg.fit_mode", "fill")

	b := swaybg.New().(*swaybg.Swaybg)
	b.RegisterDefaults(v)

	c := &SwaybgCaptor{backend: b}
	b.SetStartProcessForTest(func(args []string) error {
		c.mu.Lock()
		defer c.mu.Unlock()
		// Copy to avoid aliasing.
		c.last = append([]string(nil), args...)
		return nil
	})
	return c
}

// LastArgv returns a copy of the most recently captured argv under lock.
func (c *SwaybgCaptor) LastArgv() []string {
	c.mu.Lock()
	defer c.mu.Unlock()
	return append([]string(nil), c.last...)
}

func (c *SwaybgCaptor) CaptureSetWallpaper(t *testing.T, req backend.WallpaperRequest) []byte {
	t.Helper()
	_ = c.backend.SetWallpaper(t.Context(), req)
	return c.argvBytes()
}

func (c *SwaybgCaptor) CaptureApply(t *testing.T, snap backend.Snapshot) []byte {
	t.Helper()
	_ = c.backend.Apply(t.Context(), snap)
	return c.argvBytes()
}

func (c *SwaybgCaptor) argvBytes() []byte {
	c.mu.Lock()
	defer c.mu.Unlock()
	// Render argv as one byte buffer with NUL separators so comparison is
	// unambiguous (no joining-string ambiguity).
	var out []byte
	for i, a := range c.last {
		if i > 0 {
			out = append(out, 0)
		}
		out = append(out, []byte(a)...)
	}
	return out
}
