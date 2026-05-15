package swaybg

// FitMode controls how swaybg scales the wallpaper image. The values map
// directly to swaybg's `-m / --mode` argument.
type FitMode string

const (
	FitStretch FitMode = "stretch"
	FitFit     FitMode = "fit"
	FitFill    FitMode = "fill"
	FitCenter  FitMode = "center"
	FitTile    FitMode = "tile"
)

// Config holds all swaybg-specific configuration.
type Config struct {
	FitMode FitMode `mapstructure:"fit_mode" json:"fit_mode"`
}
