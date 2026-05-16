package shadowtest_test

import (
	"testing"

	"github.com/stretchr/testify/require"

	"waypaper-engine/daemon/internal/backend"
	"waypaper-engine/daemon/internal/backend/shadowtest"
	"waypaper-engine/daemon/internal/monitor"
)

// TestSwaybg_Apply_SingleMonitor verifies Apply produces the expected -o NAME -i PATH -m MODE argv.
func TestSwaybg_Apply_SingleMonitor(t *testing.T) {
	captor := shadowtest.NewSwaybgCaptor(t)

	mon := monitor.Monitor{Name: "DP-1"}
	snap := backend.Snapshot{
		Outputs: []backend.Output{
			{Monitor: mon, Content: backend.StaticImage{Path_: "/tmp/img.png"}},
		},
	}

	_ = captor.CaptureApply(t, snap)
	argv := captor.LastArgv()

	require.Equal(t, []string{"-o", "DP-1", "-i", "/tmp/img.png", "-m", "fill"}, argv)
}

// TestSwaybg_Apply_TwoMonitorsSameImage verifies Apply generates correct argv
// when cloning the same image across two monitors.
func TestSwaybg_Apply_TwoMonitorsSameImage(t *testing.T) {
	captor := shadowtest.NewSwaybgCaptor(t)

	mon1 := monitor.Monitor{Name: "DP-1"}
	mon2 := monitor.Monitor{Name: "DP-2"}
	snap := backend.Snapshot{
		Outputs: []backend.Output{
			{Monitor: mon1, Content: backend.StaticImage{Path_: "/tmp/img.png"}},
			{Monitor: mon2, Content: backend.StaticImage{Path_: "/tmp/img.png"}},
		},
	}

	_ = captor.CaptureApply(t, snap)
	argv := captor.LastArgv()

	require.Contains(t, argv, "-o")
	require.Contains(t, argv, "DP-1")
	require.Contains(t, argv, "DP-2")
	require.Contains(t, argv, "/tmp/img.png")
}

// TestSwaybg_MultiMonitorDifferentImages_RegressionApply is the regression test
// for per-monitor path differentiation. Apply must produce argv containing both
// -o NAME -i PATH segments with the correct per-monitor paths.
func TestSwaybg_MultiMonitorDifferentImages_RegressionApply(t *testing.T) {
	captor := shadowtest.NewSwaybgCaptor(t)

	snap := backend.Snapshot{
		Outputs: []backend.Output{
			{Monitor: monitor.Monitor{Name: "DP-1"}, Content: backend.StaticImage{Path_: "/tmp/a.png"}},
			{Monitor: monitor.Monitor{Name: "DP-2"}, Content: backend.StaticImage{Path_: "/tmp/b.png"}},
		},
	}

	_ = captor.CaptureApply(t, snap)
	argv := captor.LastArgv()

	require.Contains(t, argv, "-o", "expected -o flag in argv")
	require.Contains(t, argv, "DP-1", "expected DP-1 in argv")
	require.Contains(t, argv, "/tmp/a.png", "expected /tmp/a.png in argv")
	require.Contains(t, argv, "DP-2", "expected DP-2 in argv")
	require.Contains(t, argv, "/tmp/b.png", "expected /tmp/b.png in argv")
}
