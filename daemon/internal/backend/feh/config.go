package feh

type Config struct {
	Mode FehMode `mapstructure:"mode" json:"mode"`
}

type FehMode string

const (
	ModeFill   FehMode = "fill"
	ModeScale  FehMode = "scale"
	ModeTile   FehMode = "tile"
	ModeCenter FehMode = "center"
	ModeMax    FehMode = "max"
)
