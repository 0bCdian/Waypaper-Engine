package hyprpaper

// FitMode controls how hyprpaper scales the wallpaper image.
type FitMode string

const (
	FitCover   FitMode = "cover"
	FitContain FitMode = "contain"
	FitTile    FitMode = "tile"
	FitFill    FitMode = "fill"
)

// Config holds all hyprpaper-specific configuration.
type Config struct {
	FitMode    FitMode `mapstructure:"fit_mode"    json:"fit_mode"`
	UseIPC     bool    `mapstructure:"use_ipc"     json:"use_ipc"`
	ConfigPath string  `mapstructure:"config_path" json:"config_path"`
}
