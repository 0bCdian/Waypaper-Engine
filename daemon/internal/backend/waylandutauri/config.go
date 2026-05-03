package waylandutauri

import (
	"os"
	"path/filepath"
)

const (
	defaultExpectedService = "wayland-utauri"
	defaultAPIVersion      = "0" // matches wal-utauri ZeroVer control-plane `api_version` / X-API-Version
)

// Config holds wayland-utauri specific backend settings.
type Config struct {
	SocketPath         string `mapstructure:"socket_path" json:"socket_path"`
	ExpectedService    string `mapstructure:"expected_service" json:"expected_service"`
	ExpectedAPIVersion string `mapstructure:"expected_api_version" json:"expected_api_version"`
	ConnectTimeoutMS   int    `mapstructure:"connect_timeout_ms" json:"connect_timeout_ms"`
	RequestTimeoutMS   int    `mapstructure:"request_timeout_ms" json:"request_timeout_ms"`
	// LoadTimeoutMS bounds the POST /wallpaper/load call. Web wallpaper navigation
	// can run several seconds end-to-end, so this is much larger than the generic
	// per-request timeout that fits health/status/parallax calls.
	LoadTimeoutMS int `mapstructure:"load_timeout_ms" json:"load_timeout_ms"`
	Transition         string `mapstructure:"transition" json:"transition"`
	DurationMS         int    `mapstructure:"duration_ms" json:"duration_ms"`
	TransitionBezier   string `mapstructure:"transition_bezier" json:"transition_bezier"`
	// Wipe angle (degrees, 0–359) and grow/outer origin; directional presets ignore angle on the renderer.
	TransitionAngleDeg             int     `mapstructure:"transition_angle_deg" json:"transition_angle_deg"`
	TransitionOriginXPct           int     `mapstructure:"transition_origin_x_percent" json:"transition_origin_x_percent"`
	TransitionOriginYPct           int     `mapstructure:"transition_origin_y_percent" json:"transition_origin_y_percent"`
	TransitionWaveAmplitudePercent float32 `mapstructure:"transition_wave_amplitude_percent" json:"transition_wave_amplitude_percent"`
	TransitionWaveFrequency        float32 `mapstructure:"transition_wave_frequency" json:"transition_wave_frequency"`
	ParallaxEnabled                bool    `mapstructure:"parallax_enabled" json:"parallax_enabled"`
	ParallaxZoom                   int     `mapstructure:"parallax_zoom" json:"parallax_zoom"`
	// ParallaxStepPct is sent to wayland-utauri as ParallaxConfig.step_percent (host API requires > 0).
	// Parallax-move uses this amount; Hyprland/Sway driver posts direction-only HTTP moves.
	ParallaxStepPct int `mapstructure:"parallax_step_percent" json:"parallax_step_percent"`
	// ParallaxWorkspaceChunkSize: ring period for resolveDirection (Hyprland/Sway) — shortest path on the workspace ID circle.
	ParallaxWorkspaceChunkSize int    `mapstructure:"parallax_workspace_chunk_size" json:"parallax_workspace_chunk_size"`
	ParallaxAnimMS             int    `mapstructure:"parallax_animation_ms" json:"parallax_animation_ms"`
	ParallaxResetMS            int    `mapstructure:"parallax_reset_ms" json:"parallax_reset_ms"`
	ParallaxEasing             string `mapstructure:"parallax_easing" json:"parallax_easing"`
	// ParallaxCompositorDriver: auto | off | hyprland | sway — workspace → POST /wallpaper/parallax-move (Hyprland/Sway only).
	ParallaxCompositorDriver string `mapstructure:"parallax_compositor_driver" json:"parallax_compositor_driver"`
	// ParallaxDirection: horizontal | vertical — workspace parallax axis when waypaper.json does not override.
	ParallaxDirection      string `mapstructure:"parallax_direction" json:"parallax_direction"`
	ImageFitMode           string `mapstructure:"image_fit_mode" json:"image_fit_mode"`
	ImageRendering         string `mapstructure:"image_rendering" json:"image_rendering"`
	VideoAudioDefault      bool   `mapstructure:"video_audio_default" json:"video_audio_default"`
	AllowNetworkWallpapers bool   `mapstructure:"allow_network_wallpapers" json:"allow_network_wallpapers"`
}

func defaultSocketPath() string {
	runtimeDir := os.Getenv("XDG_RUNTIME_DIR")
	if runtimeDir == "" {
		return ""
	}
	return filepath.Join(runtimeDir, "wayland-utauri.sock")
}

func defaultConfig() *Config {
	return &Config{
		SocketPath:                     defaultSocketPath(),
		ExpectedService:                defaultExpectedService,
		ExpectedAPIVersion:             defaultAPIVersion,
		ConnectTimeoutMS:               500,
		RequestTimeoutMS:               1500,
		LoadTimeoutMS:                  15000,
		Transition:                     "none",
		DurationMS:                     300,
		TransitionBezier:               "0.54,0,0.34,0.99",
		TransitionAngleDeg:             0,
		TransitionOriginXPct:           50,
		TransitionOriginYPct:           50,
		TransitionWaveAmplitudePercent: 5,
		TransitionWaveFrequency:        3,
		ParallaxEnabled:                false,
		ParallaxZoom:                   120,
		ParallaxStepPct:                5,
		ParallaxWorkspaceChunkSize:     10,
		ParallaxAnimMS:                 600,
		ParallaxResetMS:                400,
		ParallaxEasing:                 "0.215,0.610,0.355,1.000",
		ParallaxCompositorDriver:       "auto",
		ParallaxDirection:              "horizontal",
		ImageFitMode:                   "cover",
		ImageRendering:                 "auto",
		VideoAudioDefault:              false,
		AllowNetworkWallpapers:         false,
	}
}
