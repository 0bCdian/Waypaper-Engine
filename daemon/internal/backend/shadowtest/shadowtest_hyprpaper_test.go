package shadowtest_test

import (
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
