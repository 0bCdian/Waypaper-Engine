package awww

type Config struct {
	TransitionType     TransitionType     `mapstructure:"transition_type" json:"transition_type"`
	TransitionStep     int                `mapstructure:"transition_step" json:"transition_step"`
	TransitionDuration float64            `mapstructure:"transition_duration" json:"transition_duration"`
	TransitionFPS      int                `mapstructure:"transition_fps" json:"transition_fps"`
	TransitionAngle    int                `mapstructure:"transition_angle" json:"transition_angle"`
	TransitionPos      TransitionPosition `mapstructure:"transition_pos" json:"transition_pos"`
	TransitionBezier   string             `mapstructure:"transition_bezier" json:"transition_bezier"`
	TransitionWave     string             `mapstructure:"transition_wave" json:"transition_wave"`
	Resize             ResizeType         `mapstructure:"resize" json:"resize"`
	FillColor          string             `mapstructure:"fill_color" json:"fill_color"`
	FilterType         FilterType         `mapstructure:"filter_type" json:"filter_type"`
	InvertY            bool               `mapstructure:"invert_y" json:"invert_y"`
}

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

type ResizeType string

const (
	ResizeCrop    ResizeType = "crop"
	ResizeFit     ResizeType = "fit"
	ResizeNone    ResizeType = "no"
	ResizeStretch ResizeType = "stretch"
)

type FilterType string

const (
	FilterLanczos3   FilterType = "Lanczos3"
	FilterBilinear   FilterType = "Bilinear"
	FilterCatmullRom FilterType = "CatmullRom"
	FilterMitchell   FilterType = "Mitchell"
	FilterNearest    FilterType = "Nearest"
)
