package waylandutauri

import (
	"encoding/json"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"waypaper-engine/daemon/internal/backend"
	"waypaper-engine/daemon/internal/media"
	"waypaper-engine/daemon/internal/monitor"
)

func TestBuildLoadRequest_IndividualModeUsesTargets(t *testing.T) {
	cfg := defaultConfig()
	req := backend.WallpaperRequest{
		MediaType: media.MediaTypeImage,
		ImagePath: "/tmp/wall.jpg",
		Mode:      monitor.ModeIndividual,
		Monitors:  []monitor.Monitor{{Name: "DP-1"}},
	}
	monitorMap := map[string]uint32{"DP-1": 7}

	got, err := buildLoadRequest(req, cfg, monitorMap)
	require.NoError(t, err)
	assert.Equal(t, "image", got.Kind)
	assert.Empty(t, got.Target)
	require.Len(t, got.Targets, 1)
	assert.Equal(t, uint32(7), got.Targets[0].Monitor)
	assert.Equal(t, "/tmp/wall.jpg", got.Targets[0].Target)
	assert.False(t, got.WaitForCompletion)
}

func TestBuildLoadRequest_CloneModeUsesSingleTarget(t *testing.T) {
	cfg := defaultConfig()
	req := backend.WallpaperRequest{
		MediaType: media.MediaTypeImage,
		ImagePath: "/tmp/wall.jpg",
		Mode:      monitor.ModeClone,
	}

	got, err := buildLoadRequest(req, cfg, nil)
	require.NoError(t, err)
	assert.Equal(t, "/tmp/wall.jpg", got.Target)
	assert.Empty(t, got.Targets)
	assert.False(t, got.WaitForCompletion)
}

func TestBuildLoadRequest_UnknownMonitorFails(t *testing.T) {
	cfg := defaultConfig()
	req := backend.WallpaperRequest{
		MediaType: media.MediaTypeImage,
		ImagePath: "/tmp/wall.jpg",
		Mode:      monitor.ModeIndividual,
		Monitors:  []monitor.Monitor{{Name: "DP-1"}},
	}

	_, err := buildLoadRequest(req, cfg, map[string]uint32{"HDMI-A-1": 1})
	require.Error(t, err)
	assert.Contains(t, err.Error(), "unknown monitor")
}

func TestBuildMonitorMap_MatchesByGeometry(t *testing.T) {
	topology := []topologyEntry{
		{Monitor: 0, StableID: "monitor:0:1920:0:2560:1440", Width: 2560, Height: 1440, X: 1920, Y: 0},
		{Monitor: 1, StableID: "monitor:1:0:0:1920:1080", Width: 1920, Height: 1080, X: 0, Y: 0},
	}
	engines := []monitor.Monitor{
		{Name: "DP-1", Width: 2560, Height: 1440, X: 1920, Y: 0},
		{Name: "HDMI-A-1", Width: 1920, Height: 1080, X: 0, Y: 0},
	}
	got := buildMonitorMap(topology, engines)

	assert.Equal(t, uint32(0), got["DP-1"])
	assert.Equal(t, uint32(1), got["HDMI-A-1"])
}

func TestBuildMonitorMap_FallsBackToStableID(t *testing.T) {
	topology := []topologyEntry{
		{Monitor: 1, StableID: "DP-1"},
		{Monitor: 2, StableID: ""},
	}
	got := buildMonitorMap(topology, nil)

	assert.Equal(t, uint32(1), got["DP-1"])
	assert.Equal(t, uint32(2), got["WAYLAND-OUTPUT-2"])
}

func TestBuildLoadRequest_VideoKind(t *testing.T) {
	cfg := defaultConfig()
	req := backend.WallpaperRequest{
		MediaType:    media.MediaTypeVideo,
		ImagePath:    "/tmp/clip.mp4",
		AudioEnabled: true,
		Mode:         monitor.ModeClone,
	}

	got, err := buildLoadRequest(req, cfg, nil)
	require.NoError(t, err)
	assert.Equal(t, "video", got.Kind)
	assert.Equal(t, "/tmp/clip.mp4", got.Target)
	assert.True(t, got.AudioEnabled)
}

func TestBuildLoadRequest_WebKind(t *testing.T) {
	cfg := defaultConfig()
	req := backend.WallpaperRequest{
		MediaType: media.MediaTypeWeb,
		ImagePath: "/tmp/pkg/index.html",
		Mode:      monitor.ModeClone,
	}

	got, err := buildLoadRequest(req, cfg, nil)
	require.NoError(t, err)
	assert.Equal(t, "web", got.Kind)
	assert.Equal(t, "/tmp/pkg/index.html", got.Target)
}

func TestBuildLoadRequest_EmbedsParallaxWhenEnabled(t *testing.T) {
	cfg := defaultConfig()
	cfg.ParallaxEnabled = true
	cfg.ParallaxZoom = 110
	req := backend.WallpaperRequest{
		MediaType: media.MediaTypeImage,
		ImagePath: "/tmp/wall.jpg",
		Mode:      monitor.ModeClone,
	}

	got, err := buildLoadRequest(req, cfg, nil)
	require.NoError(t, err)
	require.NotNil(t, got.Parallax)
	assert.Equal(t, true, got.Parallax["enabled"])
	raw, err := json.Marshal(got)
	require.NoError(t, err)
	assert.Contains(t, string(raw), `"parallax"`)
}

func TestBuildLoadRequest_OmitsParallaxWhenDisabled(t *testing.T) {
	cfg := defaultConfig()
	cfg.ParallaxEnabled = false
	req := backend.WallpaperRequest{
		MediaType: media.MediaTypeImage,
		ImagePath: "/tmp/wall.jpg",
		Mode:      monitor.ModeClone,
	}

	got, err := buildLoadRequest(req, cfg, nil)
	require.NoError(t, err)
	assert.Nil(t, got.Parallax)
}
