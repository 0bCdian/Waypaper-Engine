package mpvpaper

type Config struct {
	MpvOptions    string `mapstructure:"mpv_options" json:"mpv_options"`
	Verbose       int    `mapstructure:"verbose" json:"verbose"`
	AutoPause     bool   `mapstructure:"auto_pause" json:"auto_pause"`
	AutoStop      bool   `mapstructure:"auto_stop" json:"auto_stop"`
	Layer         string `mapstructure:"layer" json:"layer"`
	SlideshowSecs int    `mapstructure:"slideshow_secs" json:"slideshow_secs"`
}
