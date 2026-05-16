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

// TestFeh_Apply_TwoMonitorsSameImage verifies feh produces the same single-image argv
// regardless of monitor count (feh targets the X11 root window globally).
func TestFeh_Apply_TwoMonitorsSameImage(t *testing.T) {
	captor := shadowtest.NewFehCaptor(t)

	mon1 := monitor.Monitor{Name: "HDMI-1"}
	mon2 := monitor.Monitor{Name: "DP-1"}
	snap := backend.Snapshot{
		Outputs: []backend.Output{
			{Monitor: mon1, Content: backend.StaticImage{Path_: "/tmp/img.png"}},
			{Monitor: mon2, Content: backend.StaticImage{Path_: "/tmp/img.png"}},
		},
	}

	_ = captor.CaptureApply(t, snap)
	argv := captor.LastArgv()

	require.Equal(t, []string{"--bg-fill", "/tmp/img.png"}, argv)
}

// TestFeh_MultiMonitorDifferentImages_NotApplicable documents that feh's CLI
// has no per-monitor image targeting.
func TestFeh_MultiMonitorDifferentImages_NotApplicable(t *testing.T) {
	t.Skip("feh has no per-monitor CLI targeting: --bg-fill sets the X11 root " +
		"pixmap globally. Different images per monitor cannot be expressed. " +
		"The orchestrator is responsible for not sending such snapshots to feh.")
}

// TestFeh_Apply_UsesFirstOutputPath verifies that Apply selects the first
// output's image path and produces the expected argv shape.
func TestFeh_Apply_UsesFirstOutputPath(t *testing.T) {
	captor := shadowtest.NewFehCaptor(t)

	snap := backend.Snapshot{
		Outputs: []backend.Output{
			{Monitor: monitor.Monitor{Name: "HDMI-1"}, Content: backend.StaticImage{Path_: "/tmp/first.png"}},
			{Monitor: monitor.Monitor{Name: "DP-1"}, Content: backend.StaticImage{Path_: "/tmp/second.png"}},
		},
	}

	_ = captor.CaptureApply(t, snap)
	argv := captor.LastArgv()

	require.Equal(t, []string{"--bg-fill", "/tmp/first.png"}, argv)
}
