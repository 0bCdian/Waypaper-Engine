package mpvpaper

import (
	"encoding/json"
	"strings"
	"testing"

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
