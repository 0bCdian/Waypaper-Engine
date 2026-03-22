// Package awww defines the configuration types for the awww wallpaper backend.
//
// awww is a Wayland-only wallpaper daemon that supports animated transitions.
package awww

// Config holds all awww-specific configuration.
// Tags: `mapstructure` for Viper unmarshaling from TOML, `json` for API serialization.
type Config struct {
	// TransitionType is the animation used when changing wallpapers.
	TransitionType TransitionType `mapstructure:"transition_type" json:"transition_type"`

	// TransitionStep controls the speed of the transition (higher = faster).
	// Range: 1-255. Only applies to non-fade transitions.
	TransitionStep int `mapstructure:"transition_step" json:"transition_step"`

	// TransitionDuration is how long the transition takes in seconds (awww CLI --transition-duration).
	// Fractional values are supported when passed through from the universal backend setting.
	TransitionDuration float64 `mapstructure:"transition_duration" json:"transition_duration"`

	// TransitionFPS is the target frames per second for the transition animation.
	TransitionFPS int `mapstructure:"transition_fps" json:"transition_fps"`

	// TransitionAngle is the angle in degrees for directional transitions (e.g. wipe).
	TransitionAngle int `mapstructure:"transition_angle" json:"transition_angle"`

	// TransitionPos is the starting position for position-based transitions (e.g. grow, outer).
	TransitionPos TransitionPosition `mapstructure:"transition_pos" json:"transition_pos"`

	// TransitionBezier is the bezier curve for transition easing (e.g. "0.25,0.1,0.25,1.0").
	TransitionBezier string `mapstructure:"transition_bezier" json:"transition_bezier"`

	// TransitionWave is the wave geometry for the wave transition (e.g. "20,20").
	TransitionWave string `mapstructure:"transition_wave" json:"transition_wave"`

	// Resize controls how the image is fitted to the monitor.
	Resize ResizeType `mapstructure:"resize" json:"resize"`

	// FillColor is the color used to fill empty space when Resize is "fit" (e.g. "#000000").
	FillColor string `mapstructure:"fill_color" json:"fill_color"`

	// FilterType is the resampling filter used when resizing images.
	FilterType FilterType `mapstructure:"filter_type" json:"filter_type"`

	// InvertY inverts the y-axis for transition animations.
	InvertY bool `mapstructure:"invert_y" json:"invert_y"`
}

// --- Type enums ---

// TransitionType defines the animation style when awww transitions between wallpapers.
type TransitionType string

const (
	TransitionNone   TransitionType = "none"
	TransitionSimple TransitionType = "simple"
	TransitionFade   TransitionType = "fade"
	TransitionLeft   TransitionType = "left"
	TransitionRight  TransitionType = "right"
	TransitionTop    TransitionType = "top"
	TransitionBottom TransitionType = "bottom"
	TransitionWipe   TransitionType = "wipe"
	TransitionWave   TransitionType = "wave"
	TransitionGrow   TransitionType = "grow"
	TransitionCenter TransitionType = "center"
	TransitionAny    TransitionType = "any"
	TransitionOuter  TransitionType = "outer"
	TransitionRandom TransitionType = "random"
)

// TransitionPosition defines where a position-based transition starts from.
type TransitionPosition string

const (
	PosCenter      TransitionPosition = "center"
	PosTop         TransitionPosition = "top"
	PosBottom      TransitionPosition = "bottom"
	PosLeft        TransitionPosition = "left"
	PosRight       TransitionPosition = "right"
	PosTopLeft     TransitionPosition = "top-left"
	PosTopRight    TransitionPosition = "top-right"
	PosBottomLeft  TransitionPosition = "bottom-left"
	PosBottomRight TransitionPosition = "bottom-right"
)

// ResizeType defines how awww fits the image to the monitor dimensions.
type ResizeType string

const (
	ResizeCrop    ResizeType = "crop"
	ResizeFit     ResizeType = "fit"
	ResizeNone    ResizeType = "no"
	ResizeStretch ResizeType = "stretch"
)

// FilterType defines the resampling filter used when awww resizes images.
type FilterType string

const (
	FilterLanczos3   FilterType = "Lanczos3"
	FilterBilinear   FilterType = "Bilinear"
	FilterCatmullRom FilterType = "CatmullRom"
	FilterMitchell   FilterType = "Mitchell"
	FilterNearest    FilterType = "Nearest"
)
