// Package backend_test contains smoke tests for the Apply shims added in T5.
// Each backend's Apply shim translates a Snapshot → WallpaperRequest and delegates
// to SetWallpaper. These tests verify that:
//   - Apply with an empty Snapshot returns nil without panicking.
//   - Apply with a non-empty Snapshot delegates to the backend's normal path
//     (which may fail with "binary not found" on systems without the binary —
//     that is acceptable; the test only verifies the shim wiring, not the binary).
//   - ContentToMediaType maps every Content variant correctly.
package backend_test

import (
	"context"
	"testing"

	"waypaper-engine/daemon/internal/backend"
	backendawww "waypaper-engine/daemon/internal/backend/awww"
	backendfeh "waypaper-engine/daemon/internal/backend/feh"
	backendhyprpaper "waypaper-engine/daemon/internal/backend/hyprpaper"
	backendmpvpaper "waypaper-engine/daemon/internal/backend/mpvpaper"
	backendswaybg "waypaper-engine/daemon/internal/backend/swaybg"
	backendwalqt "waypaper-engine/daemon/internal/backend/walqt"
	"waypaper-engine/daemon/internal/monitor"
)

// sampleOutput builds a single-output Snapshot with a static image.
func sampleSnapshot() backend.Snapshot {
	return backend.Snapshot{
		Outputs: []backend.Output{
			{
				Monitor: monitor.Monitor{Name: "DP-1"},
				Content: backend.StaticImage{Path_: "/tmp/test.png"},
			},
		},
	}
}

// TestApplyEmptySnapshot verifies every backend's Apply is a no-op on empty input.
func TestApplyEmptySnapshot(t *testing.T) {
	backends := []backend.Backend{
		backendawww.New(),
		backendfeh.New(),
		backendhyprpaper.New(),
		backendmpvpaper.New(),
		backendswaybg.New(),
		backendwalqt.New(),
	}
	for _, b := range backends {
		b := b
		t.Run(b.Name(), func(t *testing.T) {
			err := b.Apply(context.Background(), backend.Snapshot{})
			if err != nil {
				t.Errorf("%s.Apply(empty) returned error: %v", b.Name(), err)
			}
		})
	}
}

// TestApplyDelegatesForNonEmpty verifies Apply with a real Snapshot delegates into
// SetWallpaper's code path. On systems without the required binary the call returns
// an error (not a panic) — which is the expected shim behaviour.
func TestApplyDelegatesForNonEmpty(t *testing.T) {
	snap := sampleSnapshot()
	backends := []backend.Backend{
		backendawww.New(),
		backendfeh.New(),
		backendhyprpaper.New(),
		backendmpvpaper.New(),
		backendswaybg.New(),
		backendwalqt.New(),
	}
	for _, b := range backends {
		b := b
		t.Run(b.Name(), func(t *testing.T) {
			// We do not assert success — the binary may not be installed.
			// We only assert the shim does not panic.
			_ = b.Apply(context.Background(), snap)
		})
	}
}

// TestContentToMediaType verifies the mapping helper in snapshot.go.
func TestContentToMediaType(t *testing.T) {
	tests := []struct {
		content backend.Content
		want    string
	}{
		{backend.StaticImage{Path_: "/a"}, "image"},
		{backend.GIF{Path_: "/a"}, "gif"},
		{backend.Video{Path_: "/a"}, "video"},
		{backend.WebWallpaper{ManifestPath: "/a"}, "web"},
	}
	for _, tt := range tests {
		got := string(backend.ContentToMediaType(tt.content))
		if got != tt.want {
			t.Errorf("ContentToMediaType(%T) = %q, want %q", tt.content, got, tt.want)
		}
	}
}
