package shadowtest_test

import (
	"encoding/json"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"waypaper-engine/daemon/internal/backend"
	"waypaper-engine/daemon/internal/backend/shadowtest"
	"waypaper-engine/daemon/internal/media"
	"waypaper-engine/daemon/internal/monitor"
)

// Test 1 — single static image, single monitor.
// Apply and SetWallpaper must produce byte-identical JSON.
func TestWalQt_Shadow_SingleStaticImage(t *testing.T) {
	captor := shadowtest.NewWalQtCaptor(t)

	mon := monitor.Monitor{Name: "DP-1", Width: 1920, Height: 1080}
	snap := backend.Snapshot{
		Outputs: []backend.Output{
			{Monitor: mon, Content: backend.StaticImage{Path_: "/tmp/wall.jpg"}},
		},
	}
	legacy := backend.WallpaperRequest{
		MediaType:         media.MediaTypeImage,
		Mode:              monitor.ModeIndividual,
		WaitForCompletion: true,
		IndividualTargets: []backend.IndividualLoadTarget{
			{Monitor: mon, Path: "/tmp/wall.jpg", MediaType: media.MediaTypeImage},
		},
	}

	shadowtest.CompareFixture(t, captor, shadowtest.Fixture{
		Name:          "single_static_dp1",
		Snapshot:      snap,
		LegacyRequest: legacy,
	})
}

// Test 2 — two monitors, same static image (clone).
// Apply posts one LoadBody with two targets pointing at the same path.
func TestWalQt_Shadow_TwoMonitors_CloneSameImage(t *testing.T) {
	captor := shadowtest.NewWalQtCaptor(t)

	mon1 := monitor.Monitor{Name: "DP-1", Width: 1920, Height: 1080}
	mon2 := monitor.Monitor{Name: "DP-2", Width: 1920, Height: 1080}
	snap := backend.Snapshot{
		Outputs: []backend.Output{
			{Monitor: mon1, Content: backend.StaticImage{Path_: "/images/shared.png"}},
			{Monitor: mon2, Content: backend.StaticImage{Path_: "/images/shared.png"}},
		},
	}
	legacy := backend.WallpaperRequest{
		MediaType:         media.MediaTypeImage,
		Mode:              monitor.ModeIndividual,
		WaitForCompletion: true,
		IndividualTargets: []backend.IndividualLoadTarget{
			{Monitor: mon1, Path: "/images/shared.png", MediaType: media.MediaTypeImage},
			{Monitor: mon2, Path: "/images/shared.png", MediaType: media.MediaTypeImage},
		},
	}

	shadowtest.CompareFixture(t, captor, shadowtest.Fixture{
		Name:          "two_monitors_clone_same_image",
		Snapshot:      snap,
		LegacyRequest: legacy,
	})
}

// Test 3 — two monitors, DIFFERENT static images.
// Apply posts one LoadBody with two targets, each with its own path.
// Both targets have ONLY {name, kind, target}.
func TestWalQt_Shadow_TwoMonitors_DifferentStaticImages(t *testing.T) {
	captor := shadowtest.NewWalQtCaptor(t)

	mon1 := monitor.Monitor{Name: "DP-1", Width: 1920, Height: 1080}
	mon2 := monitor.Monitor{Name: "DP-2", Width: 2560, Height: 1440}
	snap := backend.Snapshot{
		Outputs: []backend.Output{
			{Monitor: mon1, Content: backend.StaticImage{Path_: "/images/a.png"}},
			{Monitor: mon2, Content: backend.StaticImage{Path_: "/images/b.png"}},
		},
	}
	legacy := backend.WallpaperRequest{
		MediaType:         media.MediaTypeImage,
		Mode:              monitor.ModeIndividual,
		WaitForCompletion: true,
		IndividualTargets: []backend.IndividualLoadTarget{
			{Monitor: mon1, Path: "/images/a.png", MediaType: media.MediaTypeImage},
			{Monitor: mon2, Path: "/images/b.png", MediaType: media.MediaTypeImage},
		},
	}

	shadowtest.CompareFixture(t, captor, shadowtest.Fixture{
		Name:          "two_monitors_different_static_images",
		Snapshot:      snap,
		LegacyRequest: legacy,
	})
}

// Test 4 — video on one monitor with audio_enabled=true.
// Apply posts a LoadBody with kind=video.
// Note: legacy SetWallpaper goes through buildIndividualTargetsLoadRequest which does not
// propagate AudioEnabled from IndividualLoadTarget; Apply reads it from Video.AudioEnabled.
// The two paths diverge on audio_enabled, so we assert directly on Apply's output.
func TestWalQt_Apply_Video_AudioEnabled(t *testing.T) {
	captor := shadowtest.NewWalQtCaptor(t)

	mon := monitor.Monitor{Name: "DP-1", Width: 1920, Height: 1080}
	snap := backend.Snapshot{
		Outputs: []backend.Output{
			{Monitor: mon, Content: backend.Video{Path_: "/videos/clip.mp4", AudioEnabled: true}},
		},
	}

	raw := captor.CaptureApply(t, snap)
	require.NotEmpty(t, raw, "expected load body to be captured")

	var body map[string]any
	require.NoError(t, json.Unmarshal(raw, &body))

	assert.Equal(t, "video", body["kind"], "root kind must be video")
	assert.Equal(t, true, body["audio_enabled"], "audio_enabled must be true")

	targets, ok := body["targets"].([]any)
	require.True(t, ok, "targets must be a JSON array")
	require.Len(t, targets, 1)

	tgt := targets[0].(map[string]any)
	assert.Equal(t, "DP-1", tgt["name"])
	assert.Equal(t, "/videos/clip.mp4", tgt["target"])
	assert.Equal(t, "video", tgt["kind"])
}

// Test 5 — web wallpaper on one monitor.
// Apply posts a LoadBody with kind=web and root-level wallpaper_config_values.
// Note: SetWallpaper reads ParallaxDirection for noteWallpaperParallaxDirection but
// does not express it per-target. Both paths set the root Parallax block from viper config.
// We assert directly on Apply's output.
func TestWalQt_Apply_WebWallpaper(t *testing.T) {
	captor := shadowtest.NewWalQtCaptor(t)

	mon := monitor.Monitor{Name: "eDP-1", Width: 2560, Height: 1440}
	config := json.RawMessage(`{"color":"#ff0000","speed":2}`)
	snap := backend.Snapshot{
		Outputs: []backend.Output{
			{Monitor: mon, Content: backend.WebWallpaper{
				ManifestPath:      "/wallpapers/fire/waypaper.json",
				PackageRoot:       "/wallpapers/fire",
				Config:            config,
				ParallaxDirection: "horizontal",
			}},
		},
	}

	raw := captor.CaptureApply(t, snap)
	require.NotEmpty(t, raw, "expected load body to be captured")

	var body map[string]any
	require.NoError(t, json.Unmarshal(raw, &body))

	assert.Equal(t, "web", body["kind"], "root kind must be web")

	// wallpaper_config_values must be present and match the web content Config.
	cfgVals, ok := body["wallpaper_config_values"]
	require.True(t, ok, "wallpaper_config_values must be present for web wallpaper")
	cfgJSON, err := json.Marshal(cfgVals)
	require.NoError(t, err)
	assert.JSONEq(t, string(config), string(cfgJSON))

	targets, ok := body["targets"].([]any)
	require.True(t, ok, "targets must be a JSON array")
	require.Len(t, targets, 1)

	tgt := targets[0].(map[string]any)
	assert.Equal(t, "eDP-1", tgt["name"])
	assert.Equal(t, "/wallpapers/fire/waypaper.json", tgt["target"])
	assert.Equal(t, "web", tgt["kind"])
}

// Test 6 — wire-shape strictness.
// For a snapshot with one static image, assert that the JSON payload's targets[0]
// has EXACTLY three keys: name, kind, target.
// This is the regression test that catches "LLM added a field that doesn't exist in the spec."
func TestWalQt_Apply_WireShape_TargetHasExactlyThreeKeys(t *testing.T) {
	captor := shadowtest.NewWalQtCaptor(t)

	mon := monitor.Monitor{Name: "DP-1", Width: 1920, Height: 1080}
	snap := backend.Snapshot{
		Outputs: []backend.Output{
			{Monitor: mon, Content: backend.StaticImage{Path_: "/img/test.png"}},
		},
	}

	raw := captor.CaptureApply(t, snap)
	require.NotEmpty(t, raw, "expected load body to be captured")

	var body map[string]any
	require.NoError(t, json.Unmarshal(raw, &body))

	targets, ok := body["targets"].([]any)
	require.True(t, ok, "targets must be a JSON array")
	require.Len(t, targets, 1)

	tgt := targets[0].(map[string]any)

	// Enumerate the actual keys.
	keys := make([]string, 0, len(tgt))
	for k := range tgt {
		keys = append(keys, k)
	}

	// LoadTargetBody per the wal-qt openapi spec has EXACTLY three fields:
	//   name (required), kind (optional), target (required).
	// If this fails, a field was invented that doesn't exist in the wire spec.
	assert.ElementsMatch(t, []string{"name", "kind", "target"}, keys,
		"LoadTargetBody must have exactly {name, kind, target} — no extra fields. Got: %v", keys)

	assert.Equal(t, "DP-1", tgt["name"])
	assert.Equal(t, "/img/test.png", tgt["target"])
	assert.Equal(t, "image", tgt["kind"])
}
