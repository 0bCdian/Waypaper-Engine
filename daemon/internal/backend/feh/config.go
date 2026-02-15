// Package feh defines the configuration types for the feh wallpaper backend.
//
// feh is a lightweight X11 image viewer that can set the root wallpaper.
// It is fire-and-forget (no daemon process) and does not support transitions
// or per-monitor targeting.
// See: https://feh.finalrewind.org/
package feh

// Config holds all feh-specific configuration.
type Config struct {
	// Mode controls how the image is fitted to the screen.
	// Maps to feh's --bg-* flags.
	Mode FehMode `mapstructure:"mode" json:"mode"`
}

// FehMode defines how feh fits the image to the screen.
type FehMode string

const (
	// ModeFill scales the image to fill the screen, cropping if necessary (--bg-fill).
	ModeFill FehMode = "fill"

	// ModeScale scales the image to fit inside the screen, preserving aspect ratio (--bg-scale).
	// May leave empty space (letterboxing).
	ModeScale FehMode = "scale"

	// ModeTile repeats the image to fill the screen without scaling (--bg-tile).
	ModeTile FehMode = "tile"

	// ModeCenter places the image at the center without scaling (--bg-center).
	// If the image is smaller than the screen, the background color fills the rest.
	ModeCenter FehMode = "center"

	// ModeMax scales the image to the maximum size that fits within the screen,
	// then fills the rest with the background color (--bg-max).
	ModeMax FehMode = "max"
)
