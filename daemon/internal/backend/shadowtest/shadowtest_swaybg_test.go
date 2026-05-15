package shadowtest_test

import (
	"testing"

	"github.com/stretchr/testify/require"

	"waypaper-engine/daemon/internal/backend"
	"waypaper-engine/daemon/internal/backend/shadowtest"
	"waypaper-engine/daemon/internal/media"
	"waypaper-engine/daemon/internal/monitor"
)

// TestSwaybg_ShadowEquivalence_SingleMonitor verifies that Apply and SetWallpaper
// produce identical argv for a single monitor with a single image.
func TestSwaybg_ShadowEquivalence_SingleMonitor(t *testing.T) {
	captor := shadowtest.NewSwaybgCaptor(t)

	mon := monitor.Monitor{Name: "DP-1"}
	snap := backend.Snapshot{
		Outputs: []backend.Output{
			{Monitor: mon, Content: backend.StaticImage{Path_: "/tmp/img.png"}},
		},
	}
	legacy := backend.WallpaperRequest{
		MediaType: media.MediaTypeImage,
		ImagePath: "/tmp/img.png",
		Monitors:  []monitor.Monitor{mon},
		Mode:      monitor.ModeClone,
	}

	shadowtest.CompareFixture(t, captor, shadowtest.Fixture{
		Name:          "single_monitor_single_image",
		Snapshot:      snap,
		LegacyRequest: legacy,
	})
}

// TestSwaybg_ShadowEquivalence_TwoMonitorsSameImage verifies that Apply and
// SetWallpaper produce identical argv when cloning the same image across two monitors.
func TestSwaybg_ShadowEquivalence_TwoMonitorsSameImage(t *testing.T) {
	captor := shadowtest.NewSwaybgCaptor(t)

	mon1 := monitor.Monitor{Name: "DP-1"}
	mon2 := monitor.Monitor{Name: "DP-2"}
	snap := backend.Snapshot{
		Outputs: []backend.Output{
			{Monitor: mon1, Content: backend.StaticImage{Path_: "/tmp/img.png"}},
			{Monitor: mon2, Content: backend.StaticImage{Path_: "/tmp/img.png"}},
		},
	}
	legacy := backend.WallpaperRequest{
		MediaType: media.MediaTypeImage,
		ImagePath: "/tmp/img.png",
		Monitors:  []monitor.Monitor{mon1, mon2},
		Mode:      monitor.ModeClone,
	}

	shadowtest.CompareFixture(t, captor, shadowtest.Fixture{
		Name:          "two_monitors_same_image",
		Snapshot:      snap,
		LegacyRequest: legacy,
	})
}

// TestSwaybg_MultiMonitorDifferentImages_RegressionApply is the regression test
// for per-monitor path differentiation. SetWallpaper's WallpaperRequest cannot
// express different paths per monitor; only Apply can. The Apply path must
// produce argv containing both -o NAME -i PATH segments with the correct
// per-monitor paths.
func TestSwaybg_MultiMonitorDifferentImages_RegressionApply(t *testing.T) {
	// SetWallpaper's WallpaperRequest cannot express different paths per monitor;
	// only Apply can. Skip the SetWallpaper comparison for this case and assert
	// directly on Apply's captured argv.
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
