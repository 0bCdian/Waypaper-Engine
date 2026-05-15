package shadowtest_test

import (
	"testing"

	"github.com/stretchr/testify/require"

	"waypaper-engine/daemon/internal/backend"
	"waypaper-engine/daemon/internal/backend/shadowtest"
	"waypaper-engine/daemon/internal/media"
	"waypaper-engine/daemon/internal/monitor"
)

// TestFeh_ShadowEquivalence_SingleMonitor verifies that Apply and SetWallpaper
// produce identical argv for a single monitor with a single image.
func TestFeh_ShadowEquivalence_SingleMonitor(t *testing.T) {
	captor := shadowtest.NewFehCaptor(t)

	mon := monitor.Monitor{Name: "HDMI-1"}
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

// TestFeh_ShadowEquivalence_TwoMonitorsSameImage verifies that Apply and
// SetWallpaper produce identical argv when the same image is cloned across
// two monitors. feh targets the X11 root window globally, so both paths
// produce the same single-image argv regardless of monitor count.
func TestFeh_ShadowEquivalence_TwoMonitorsSameImage(t *testing.T) {
	captor := shadowtest.NewFehCaptor(t)

	mon1 := monitor.Monitor{Name: "HDMI-1"}
	mon2 := monitor.Monitor{Name: "DP-1"}
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

// TestFeh_MultiMonitorDifferentImages_NotApplicable documents that feh's CLI
// has no per-monitor image targeting. `feh --bg-fill PATH` sets the X11 root
// pixmap globally — there is no flag to address individual monitors. A snapshot
// with two monitors and two different images cannot be expressed in feh's argv;
// the orchestrator must not send such a snapshot to feh. Apply uses the first
// output's image path, matching the behavior of SetWallpaper.
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
