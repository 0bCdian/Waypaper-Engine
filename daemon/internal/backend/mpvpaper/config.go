// Package mpvpaper implements the mpvpaper Wayland video wallpaper backend.
// See: https://github.com/GhostNaN/mpvpaper
package mpvpaper

// Config holds mpvpaper-specific settings (TOML [backend.mpvpaper] / JSON for PATCH /config/backend).
type Config struct {
	// MpvOptions is forwarded to mpvpaper -o (mpv option string). Default "loop".
	// When the image has audio disabled, "no-audio " is prepended automatically.
	MpvOptions string `mapstructure:"mpv_options" json:"mpv_options"`
	// Verbose is mpvpaper verbosity: 0 = none, 1 = -v, 2 = -vv.
	Verbose       int    `mapstructure:"verbose" json:"verbose"`
	AutoPause     bool   `mapstructure:"auto_pause" json:"auto_pause"`
	AutoStop      bool   `mapstructure:"auto_stop" json:"auto_stop"`
	Layer         string `mapstructure:"layer" json:"layer"`
	SlideshowSecs int    `mapstructure:"slideshow_secs" json:"slideshow_secs"`
}
