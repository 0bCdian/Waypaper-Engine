package shadowtest_test

import (
	"encoding/json"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"waypaper-engine/daemon/internal/backend"
	"waypaper-engine/daemon/internal/backend/shadowtest"
	"waypaper-engine/daemon/internal/monitor"
)

// TestWalQt_Apply_SingleStaticImage verifies Apply posts a correct /wallpaper/load body
// for one static image on one monitor.
func TestWalQt_Apply_SingleStaticImage(t *testing.T) {
	captor := shadowtest.NewWalQtCaptor(t)

	mon := monitor.Monitor{Name: "DP-1", Width: 1920, Height: 1080}
	snap := backend.Snapshot{
		Outputs: []backend.Output{
			{Monitor: mon, Content: backend.StaticImage{Path_: "/tmp/wall.jpg"}},
		},
	}

	raw := captor.CaptureApply(t, snap)
	require.NotEmpty(t, raw)

	var body map[string]any
	require.NoError(t, json.Unmarshal(raw, &body))

	assert.Equal(t, "image", body["kind"])
	targets, ok := body["targets"].([]any)
	require.True(t, ok)
	require.Len(t, targets, 1)
	tgt := targets[0].(map[string]any)
	assert.Equal(t, "DP-1", tgt["name"])
	assert.Equal(t, "/tmp/wall.jpg", tgt["target"])
}

// TestWalQt_Apply_TwoMonitors_CloneSameImage verifies Apply posts a body with two
// targets both pointing at the same path.
func TestWalQt_Apply_TwoMonitors_CloneSameImage(t *testing.T) {
	captor := shadowtest.NewWalQtCaptor(t)

	mon1 := monitor.Monitor{Name: "DP-1", Width: 1920, Height: 1080}
	mon2 := monitor.Monitor{Name: "DP-2", Width: 1920, Height: 1080}
	snap := backend.Snapshot{
		Outputs: []backend.Output{
			{Monitor: mon1, Content: backend.StaticImage{Path_: "/images/shared.png"}},
			{Monitor: mon2, Content: backend.StaticImage{Path_: "/images/shared.png"}},
		},
	}

	raw := captor.CaptureApply(t, snap)
	require.NotEmpty(t, raw)

	var body map[string]any
	require.NoError(t, json.Unmarshal(raw, &body))

	targets, ok := body["targets"].([]any)
	require.True(t, ok)
	require.Len(t, targets, 2)
}

// TestWalQt_Apply_TwoMonitors_DifferentStaticImages verifies Apply posts a body with
// two targets, each with its own path.
func TestWalQt_Apply_TwoMonitors_DifferentStaticImages(t *testing.T) {
	captor := shadowtest.NewWalQtCaptor(t)

	mon1 := monitor.Monitor{Name: "DP-1", Width: 1920, Height: 1080}
	mon2 := monitor.Monitor{Name: "DP-2", Width: 2560, Height: 1440}
	snap := backend.Snapshot{
		Outputs: []backend.Output{
			{Monitor: mon1, Content: backend.StaticImage{Path_: "/images/a.png"}},
			{Monitor: mon2, Content: backend.StaticImage{Path_: "/images/b.png"}},
		},
	}

	raw := captor.CaptureApply(t, snap)
	require.NotEmpty(t, raw)

	var body map[string]any
	require.NoError(t, json.Unmarshal(raw, &body))

	targets, ok := body["targets"].([]any)
	require.True(t, ok)
	require.Len(t, targets, 2)

	paths := map[string]bool{}
	for _, t := range targets {
		tgt := t.(map[string]any)
		paths[tgt["target"].(string)] = true
	}
	assert.True(t, paths["/images/a.png"])
	assert.True(t, paths["/images/b.png"])
}

// TestWalQt_Apply_Video_AudioEnabled verifies Apply posts a body with kind=video
// and audio_enabled=true.
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

// TestWalQt_Apply_WebWallpaper verifies Apply posts a body with kind=web and
// root-level wallpaper_config_values.
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

// TestWalQt_Apply_WireShape_TargetHasExactlyThreeKeys asserts that targets[0] has
// EXACTLY {name, kind, target} — no extra fields invented beyond the wal-qt wire spec.
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

	keys := make([]string, 0, len(tgt))
	for k := range tgt {
		keys = append(keys, k)
	}

	assert.ElementsMatch(t, []string{"name", "kind", "target"}, keys,
		"LoadTargetBody must have exactly {name, kind, target} — no extra fields. Got: %v", keys)

	assert.Equal(t, "DP-1", tgt["name"])
	assert.Equal(t, "/img/test.png", tgt["target"])
	assert.Equal(t, "image", tgt["kind"])
}
