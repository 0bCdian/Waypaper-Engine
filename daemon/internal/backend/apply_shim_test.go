package backend_test

import (
	"context"
	"testing"
	"waypaper-engine/daemon/internal/backend"
	"waypaper-engine/daemon/internal/monitor"

	backendawww "waypaper-engine/daemon/internal/backend/awww"
	backendfeh "waypaper-engine/daemon/internal/backend/feh"
	backendhyprpaper "waypaper-engine/daemon/internal/backend/hyprpaper"
	backendmpvpaper "waypaper-engine/daemon/internal/backend/mpvpaper"
	backendswaybg "waypaper-engine/daemon/internal/backend/swaybg"
	backendwalqt "waypaper-engine/daemon/internal/backend/walqt"
)

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
			_ = b.Apply(context.Background(), snap)
		})
	}
}
