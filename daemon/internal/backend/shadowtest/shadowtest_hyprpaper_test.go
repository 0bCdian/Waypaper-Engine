package shadowtest_test

import (
	"bytes"
	"strings"
	"testing"

	"waypaper-engine/daemon/internal/backend"
	"waypaper-engine/daemon/internal/backend/shadowtest"
	"waypaper-engine/daemon/internal/media"
	"waypaper-engine/daemon/internal/monitor"
)

func TestHyprpaper_ShadowEquivalence_SingleStaticImage(t *testing.T) {
	captor := shadowtest.NewHyprpaperCaptor(t)

	mon := monitor.Monitor{Name: "DP-1", Width: 1920, Height: 1080}
	snap := backend.Snapshot{
		Outputs: []backend.Output{
			{Monitor: mon, Content: backend.StaticImage{Path_: "/tmp/img.png"}},
		},
	}
	legacy := backend.WallpaperRequest{
		MediaType: media.MediaTypeImage,
		Mode:      monitor.ModeIndividual,
		IndividualTargets: []backend.IndividualLoadTarget{
			{Monitor: mon, Path: "/tmp/img.png", MediaType: media.MediaTypeImage},
		},
	}

	shadowtest.CompareFixture(t, captor, shadowtest.Fixture{
		Name:          "single_static_dp1",
		Snapshot:      snap,
		LegacyRequest: legacy,
	})
}

func TestHyprpaper_ShadowEquivalence_TwoStaticImagesDifferentPaths(t *testing.T) {
	captor := shadowtest.NewHyprpaperCaptor(t)

	mon1 := monitor.Monitor{Name: "DP-1", Width: 1920, Height: 1080}
	mon2 := monitor.Monitor{Name: "DP-2", Width: 1920, Height: 1080}
	snap := backend.Snapshot{
		Outputs: []backend.Output{
			{Monitor: mon1, Content: backend.StaticImage{Path_: "/tmp/a.png"}},
			{Monitor: mon2, Content: backend.StaticImage{Path_: "/tmp/b.png"}},
		},
	}
	legacy := backend.WallpaperRequest{
		MediaType: media.MediaTypeImage,
		Mode:      monitor.ModeIndividual,
		IndividualTargets: []backend.IndividualLoadTarget{
			{Monitor: mon1, Path: "/tmp/a.png", MediaType: media.MediaTypeImage},
			{Monitor: mon2, Path: "/tmp/b.png", MediaType: media.MediaTypeImage},
		},
	}

	shadowtest.CompareFixture(t, captor, shadowtest.Fixture{
		Name:          "two_static_different_paths",
		Snapshot:      snap,
		LegacyRequest: legacy,
	})
}

// Regression: prior setWallpaperConfig called per-monitor overwrote the conf on
// each call, leaving only the last monitor. Apply with a full Snapshot writes ALL
// monitors in one shot. This test asserts both monitors appear in the rendered conf.
func TestHyprpaper_Apply_MultiMonitorRegression(t *testing.T) {
	captor := shadowtest.NewHyprpaperCaptor(t)

	mon1 := monitor.Monitor{Name: "DP-1", Width: 1920, Height: 1080}
	mon2 := monitor.Monitor{Name: "DP-2", Width: 2560, Height: 1440}
	snap := backend.Snapshot{
		Outputs: []backend.Output{
			{Monitor: mon1, Content: backend.StaticImage{Path_: "/images/mountain.png"}},
			{Monitor: mon2, Content: backend.StaticImage{Path_: "/images/ocean.jpg"}},
		},
	}

	conf := captor.CaptureApply(t, snap)

	// Count wallpaper blocks — must be exactly two.
	blockCount := bytes.Count(conf, []byte("wallpaper {"))
	if blockCount != 2 {
		t.Fatalf("expected 2 wallpaper blocks in conf, got %d:\n%s", blockCount, string(conf))
	}

	// Both monitors must be present.
	if !strings.Contains(string(conf), "monitor = DP-1") {
		t.Fatalf("conf missing DP-1 block:\n%s", string(conf))
	}
	if !strings.Contains(string(conf), "monitor = DP-2") {
		t.Fatalf("conf missing DP-2 block:\n%s", string(conf))
	}

	// Each image path must be present.
	if !strings.Contains(string(conf), "/images/mountain.png") {
		t.Fatalf("conf missing mountain.png path:\n%s", string(conf))
	}
	if !strings.Contains(string(conf), "/images/ocean.jpg") {
		t.Fatalf("conf missing ocean.jpg path:\n%s", string(conf))
	}
}

// Regression: clone case — two monitors, same path. Conf must have TWO blocks.
func TestHyprpaper_Apply_CloneRegression(t *testing.T) {
	captor := shadowtest.NewHyprpaperCaptor(t)

	mon1 := monitor.Monitor{Name: "HDMI-1", Width: 1920, Height: 1080}
	mon2 := monitor.Monitor{Name: "HDMI-2", Width: 1920, Height: 1080}
	snap := backend.Snapshot{
		Outputs: []backend.Output{
			{Monitor: mon1, Content: backend.StaticImage{Path_: "/images/shared.png"}},
			{Monitor: mon2, Content: backend.StaticImage{Path_: "/images/shared.png"}},
		},
	}

	conf := captor.CaptureApply(t, snap)

	blockCount := bytes.Count(conf, []byte("wallpaper {"))
	if blockCount != 2 {
		t.Fatalf("expected 2 wallpaper blocks for clone, got %d:\n%s", blockCount, string(conf))
	}

	if !strings.Contains(string(conf), "monitor = HDMI-1") {
		t.Fatalf("conf missing HDMI-1 block:\n%s", string(conf))
	}
	if !strings.Contains(string(conf), "monitor = HDMI-2") {
		t.Fatalf("conf missing HDMI-2 block:\n%s", string(conf))
	}
}
