package hyprpaper

type FitMode string

const (
	FitCover   FitMode = "cover"
	FitContain FitMode = "contain"
	FitTile    FitMode = "tile"
	FitFill    FitMode = "fill"
)

type Config struct {
	FitMode    FitMode `mapstructure:"fit_mode"      json:"fit_mode"`
	ConfigPath string  `mapstructure:"config_path" json:"config_path"`
}
