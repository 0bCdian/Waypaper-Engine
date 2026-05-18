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

// TestFeh_Apply_ExtendMode_PassesPerMonitorPaths verifies feh receives one path
// per output in Xinerama geometry order (sorted by Y then X).
func TestFeh_Apply_ExtendMode_PassesPerMonitorPaths(t *testing.T) {
	captor := shadowtest.NewFehCaptor(t)

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

// TestFeh_Apply_ExtendMode_SortsByGeometry verifies that outputs provided in
// non-Xinerama order are reordered by (Y, X) before paths are emitted.
func TestFeh_Apply_ExtendMode_SortsByGeometry(t *testing.T) {
	captor := shadowtest.NewFehCaptor(t)

	// Inputs are deliberately reversed (right monitor first, left second).
	snap := backend.Snapshot{
		Outputs: []backend.Output{
			{Monitor: monitor.Monitor{Name: "DP-0", X: 1920, Y: 0}, Content: backend.StaticImage{Path_: "/tmp/right.png"}},
			{Monitor: monitor.Monitor{Name: "HDMI-A-0", X: 0, Y: 0}, Content: backend.StaticImage{Path_: "/tmp/left.png"}},
		},
	}

	_ = captor.CaptureApply(t, snap)
	argv := captor.LastArgv()

	require.Equal(t, []string{"--bg-fill", "/tmp/left.png", "/tmp/right.png"}, argv)
}

// TestFeh_Apply_VerticalStack verifies (Y, X) ordering for a top/bottom layout.
func TestFeh_Apply_VerticalStack(t *testing.T) {
	captor := shadowtest.NewFehCaptor(t)

	snap := backend.Snapshot{
		Outputs: []backend.Output{
			{Monitor: monitor.Monitor{Name: "BOT", X: 0, Y: 1080}, Content: backend.StaticImage{Path_: "/tmp/bot.png"}},
			{Monitor: monitor.Monitor{Name: "TOP", X: 0, Y: 0}, Content: backend.StaticImage{Path_: "/tmp/top.png"}},
		},
	}

	_ = captor.CaptureApply(t, snap)
	argv := captor.LastArgv()

	require.Equal(t, []string{"--bg-fill", "/tmp/top.png", "/tmp/bot.png"}, argv)
}
