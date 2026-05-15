// Package shadowtest provides a comparison helper that runs both the legacy
// SetWallpaper path and the new Apply path against a fixture, then asserts
// the setter-visible side effects are byte-identical.
//
// Each backend exposes its capture seam through a separate adapter in
// shadowtest_<backend>.go (hyprpaper supported in this initial release).
package shadowtest

import (
	"testing"

	"waypaper-engine/daemon/internal/backend"
)

// Fixture describes one comparison scenario.
type Fixture struct {
	Name     string
	Snapshot backend.Snapshot
	// LegacyRequest is what the caller would have passed to SetWallpaper
	// for the same logical state. The harness runs both paths and asserts
	// they produce the same setter-visible output.
	LegacyRequest backend.WallpaperRequest
}

// Captor abstracts "run the backend path and return the captured setter output."
// Each backend has a concrete Captor that knows how to capture its specific
// side effects (e.g., for hyprpaper, the rendered conf file contents).
type Captor interface {
	// CaptureSetWallpaper runs SetWallpaper(req) and returns the captured output.
	CaptureSetWallpaper(t *testing.T, req backend.WallpaperRequest) []byte
	// CaptureApply runs Apply(snap) and returns the captured output.
	CaptureApply(t *testing.T, snap backend.Snapshot) []byte
}

// CompareFixture runs both paths through the captor and asserts the captured
// output is byte-identical. Reports diff context on failure.
func CompareFixture(t *testing.T, captor Captor, f Fixture) {
	t.Helper()
	t.Run(f.Name, func(t *testing.T) {
		legacy := captor.CaptureSetWallpaper(t, f.LegacyRequest)
		applied := captor.CaptureApply(t, f.Snapshot)
		if !bytesEqual(legacy, applied) {
			t.Fatalf("setter output differs:\n--- SetWallpaper ---\n%s\n--- Apply ---\n%s",
				string(legacy), string(applied))
		}
	})
}

func bytesEqual(a, b []byte) bool {
	if len(a) != len(b) {
		return false
	}
	for i := range a {
		if a[i] != b[i] {
			return false
		}
	}
	return true
}
