package waylandutauri

import (
	"os"
	"path/filepath"
)

const (
	defaultExpectedService = "wayland-utauri"
	defaultAPIVersion      = "1"
)

// Config holds wayland-utauri specific backend settings.
type Config struct {
	SocketPath         string `mapstructure:"socket_path" json:"socket_path"`
	ExpectedService    string `mapstructure:"expected_service" json:"expected_service"`
	ExpectedAPIVersion string `mapstructure:"expected_api_version" json:"expected_api_version"`
	ConnectTimeoutMS   int    `mapstructure:"connect_timeout_ms" json:"connect_timeout_ms"`
	RequestTimeoutMS   int    `mapstructure:"request_timeout_ms" json:"request_timeout_ms"`
	ShowOnInitialize   bool   `mapstructure:"show_on_initialize" json:"show_on_initialize"`
	HideOnShutdown     bool   `mapstructure:"hide_on_shutdown" json:"hide_on_shutdown"`
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
	ParallaxStepPct                int     `mapstructure:"parallax_step_percent" json:"parallax_step_percent"`
	ParallaxAnimMS                 int     `mapstructure:"parallax_animation_ms" json:"parallax_animation_ms"`
	ParallaxEasing                 string  `mapstructure:"parallax_easing" json:"parallax_easing"`
	VideoAudioDefault              bool    `mapstructure:"video_audio_default" json:"video_audio_default"`
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
		ShowOnInitialize:               false,
		HideOnShutdown:                 true,
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
		ParallaxStepPct:                8,
		ParallaxAnimMS:                 600,
		ParallaxEasing:                 "0.215,0.610,0.355,1.000",
		VideoAudioDefault:              false,
	}
}
