package shadowtest_test

import (
	"testing"

	"github.com/stretchr/testify/require"

	"waypaper-engine/daemon/internal/backend"
	"waypaper-engine/daemon/internal/backend/shadowtest"
	"waypaper-engine/daemon/internal/monitor"
)

// TestFeh_Apply_SingleMonitor verifies Apply produces the expected --bg-fill argv.
func TestFeh_Apply_SingleMonitor(t *testing.T) {
	captor := shadowtest.NewFehCaptor(t)

	mon := monitor.Monitor{Name: "HDMI-1"}
	snap := backend.Snapshot{
		Outputs: []backend.Output{
			{Monitor: mon, Content: backend.StaticImage{Path_: "/tmp/img.png"}},
		},
	}

	_ = captor.CaptureApply(t, snap)
	argv := captor.LastArgv()

	require.Equal(t, []string{"--bg-fill", "/tmp/img.png"}, argv)
}

// TestFeh_Apply_CloneTwoMonitors verifies feh receives the same path per
// Xinerama head when the snapshot repeats one image across outputs (clone mode).
func TestFeh_Apply_CloneTwoMonitors(t *testing.T) {
	captor := shadowtest.NewFehCaptor(t)
	captor.SetXineramaOrder(map[string]int{"HDMI-1": 1, "DP-1": 0})

	snap := backend.Snapshot{
		Outputs: []backend.Output{
			{Monitor: monitor.Monitor{Name: "HDMI-1", X: 0, Y: 0}, Content: backend.StaticImage{Path_: "/tmp/img.png"}},
			{Monitor: monitor.Monitor{Name: "DP-1", X: 1920, Y: 0}, Content: backend.StaticImage{Path_: "/tmp/img.png"}},
		},
	}

	_ = captor.CaptureApply(t, snap)
	argv := captor.LastArgv()

	require.Equal(t, []string{"--bg-fill", "/tmp/img.png", "/tmp/img.png"}, argv)
}

// TestFeh_Apply_ReordersByXineramaIndex verifies that outputs are reordered to
// match the Xinerama head ordering reported by xrandr. The fixture mimics the
// real-world case where the primary monitor is the rightmost one, so Xinerama
// head 0 is the geometrically-right monitor (DP-0).
func TestFeh_Apply_ReordersByXineramaIndex(t *testing.T) {
	captor := shadowtest.NewFehCaptor(t)
	captor.SetXineramaOrder(map[string]int{
		"DP-0":     0, // primary, geometrically right
		"HDMI-A-0": 1, // geometrically left
	})

	// Snapshot provides outputs in geometry order (left, then right).
	snap := backend.Snapshot{
		Outputs: []backend.Output{
			{Monitor: monitor.Monitor{Name: "HDMI-A-0", X: 0, Y: 0}, Content: backend.StaticImage{Path_: "/tmp/left.png"}},
			{Monitor: monitor.Monitor{Name: "DP-0", X: 1920, Y: 0}, Content: backend.StaticImage{Path_: "/tmp/right.png"}},
		},
	}

	_ = captor.CaptureApply(t, snap)
	argv := captor.LastArgv()

	// feh expects head-0 path first → /tmp/right.png (DP-0), then /tmp/left.png (HDMI-A-0).
	require.Equal(t, []string{"--bg-fill", "/tmp/right.png", "/tmp/left.png"}, argv)
}

// TestFeh_Apply_LeftPrimaryStillCorrect verifies the non-pathological case
// where Xinerama head 0 corresponds to the geometrically-left monitor — the
// argv comes out in geometry order without contortion.
func TestFeh_Apply_LeftPrimaryStillCorrect(t *testing.T) {
	captor := shadowtest.NewFehCaptor(t)
	captor.SetXineramaOrder(map[string]int{
		"HDMI-A-0": 0,
		"DP-0":     1,
	})

	snap := backend.Snapshot{
		Outputs: []backend.Output{
			{Monitor: monitor.Monitor{Name: "HDMI-A-0", X: 0, Y: 0}, Content: backend.StaticImage{Path_: "/tmp/left.png"}},
			{Monitor: monitor.Monitor{Name: "DP-0", X: 1920, Y: 0}, Content: backend.StaticImage{Path_: "/tmp/right.png"}},
		},
	}

	_ = captor.CaptureApply(t, snap)
	argv := captor.LastArgv()

	require.Equal(t, []string{"--bg-fill", "/tmp/left.png", "/tmp/right.png"}, argv)
}

// TestFeh_Apply_FallsBackOnEmptyXineramaOrder verifies that when the Xinerama
// lookup returns an empty map (parse miss / unknown names), Apply emits outputs
// in snapshot order rather than crashing or failing.
func TestFeh_Apply_FallsBackOnEmptyXineramaOrder(t *testing.T) {
	captor := shadowtest.NewFehCaptor(t)
	// Default seam from NewFehCaptor already returns an empty map.

	snap := backend.Snapshot{
		Outputs: []backend.Output{
			{Monitor: monitor.Monitor{Name: "A", X: 0, Y: 0}, Content: backend.StaticImage{Path_: "/tmp/a.png"}},
			{Monitor: monitor.Monitor{Name: "B", X: 1920, Y: 0}, Content: backend.StaticImage{Path_: "/tmp/b.png"}},
		},
	}

	_ = captor.CaptureApply(t, snap)
	argv := captor.LastArgv()

	// With both monitors mapping to the sentinel index, stable sort preserves
	// input order.
	require.Equal(t, []string{"--bg-fill", "/tmp/a.png", "/tmp/b.png"}, argv)
}
