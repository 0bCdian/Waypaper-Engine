package mpvpaper

import (
	"context"
	"encoding/json"
	"strings"
	"testing"

	"waypaper-engine/daemon/internal/backend"
	"waypaper-engine/daemon/internal/media"
	"waypaper-engine/daemon/internal/monitor"

	"github.com/stretchr/testify/require"
)

func TestMergeMpvAudio(t *testing.T) {
	t.Parallel()
	cases := []struct {
		opts   string
		audio  bool
		expect string
	}{
		{"loop", false, "no-audio loop"},
		{"loop", true, "loop"},
		{"", false, "no-audio"},
		{"", true, ""},
		{"  gap  ", false, "no-audio gap"},
	}
	for _, tc := range cases {
		got := mergeMpvAudio(tc.opts, tc.audio)
		require.Equal(t, tc.expect, got, "opts=%q audio=%v", tc.opts, tc.audio)
	}
}

func TestBuildMpvpaperArgs(t *testing.T) {
	t.Parallel()
	cfg := &Config{
		MpvOptions:    "loop",
		Verbose:       2,
		AutoPause:     true,
		AutoStop:      true,
		Layer:         "top",
		SlideshowSecs: 30,
	}
	args := buildMpvpaperArgs("DP-2", "/tmp/v.mp4", cfg, false)
	require.Equal(t, []string{
		"-vv", "-p", "-s", "-n", "30", "-l", "top",
		"-o", "no-audio loop",
		"DP-2", "/tmp/v.mp4",
	}, args)

	argsAudio := buildMpvpaperArgs("OUT", "/v.webm", &Config{MpvOptions: "loop"}, true)
	require.Equal(t, []string{"-o", "loop", "OUT", "/v.webm"}, argsAudio)

	argsMinimal := buildMpvpaperArgs("A", "/x", nil, true)
	require.Equal(t, []string{"-o", "loop", "A", "/x"}, argsMinimal)
}

func TestMpvpaper_SetWallpaper_unsupportedMedia(t *testing.T) {
	t.Parallel()
	m := New().(*Mpvpaper)
	ctx := context.Background()
	base := backend.WallpaperRequest{
		ImagePath: "/x.mp4",
		Monitors:  []monitor.Monitor{{Name: "DP-1"}},
	}
	for _, mt := range []media.MediaType{
		media.MediaTypeImage,
		media.MediaTypeGIF,
		media.MediaTypeWeb,
	} {
		req := base
		req.MediaType = mt
		err := m.SetWallpaper(ctx, req)
		require.Error(t, err)
		require.Contains(t, err.Error(), "unsupported media type")
	}
}

func TestMpvpaper_SetWallpaper_validation(t *testing.T) {
	t.Parallel()
	m := New().(*Mpvpaper)
	ctx := context.Background()
	err := m.SetWallpaper(ctx, backend.WallpaperRequest{
		MediaType: media.MediaTypeVideo,
		ImagePath: "/v.mp4",
		Monitors:  nil,
	})
	require.Error(t, err)
	require.Contains(t, err.Error(), "no monitors")

	err = m.SetWallpaper(ctx, backend.WallpaperRequest{
		MediaType: media.MediaTypeVideo,
		ImagePath: "  ",
		Monitors:  []monitor.Monitor{{Name: "DP-1"}},
	})
	require.Error(t, err)
	require.Contains(t, err.Error(), "empty image path")

	err = m.SetWallpaper(ctx, backend.WallpaperRequest{
		MediaType: media.MediaTypeVideo,
		ImagePath: "/v.mp4",
		Monitors:  []monitor.Monitor{{Name: ""}},
	})
	require.Error(t, err)
	require.Contains(t, err.Error(), "empty monitor name")
}

func TestMpvpaper_ValidateConfig_verbose(t *testing.T) {
	t.Parallel()
	m := New().(*Mpvpaper)
	err := m.ValidateConfig(json.RawMessage(`{"verbose": 3}`))
	require.Error(t, err)
	require.Contains(t, strings.ToLower(err.Error()), "verbose")

	require.NoError(t, m.ValidateConfig(json.RawMessage(`{"verbose": 1}`)))
}

func TestMpvpaper_ValidateConfig_slideshow(t *testing.T) {
	t.Parallel()
	m := New().(*Mpvpaper)
	err := m.ValidateConfig(json.RawMessage(`{"slideshow_secs": -1}`))
	require.Error(t, err)
	require.Contains(t, strings.ToLower(err.Error()), "slideshow")
}
