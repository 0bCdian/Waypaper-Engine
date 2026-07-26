package swaybg

type FitMode string

const (
	FitStretch FitMode = "stretch"
	FitFit     FitMode = "fit"
	FitFill    FitMode = "fill"
	FitCenter  FitMode = "center"
	FitTile    FitMode = "tile"
)

type Config struct {
	FitMode FitMode `mapstructure:"fit_mode" json:"fit_mode"`
}
