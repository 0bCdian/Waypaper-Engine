package config

// SwwwConfig holds the configuration for the swww daemon.
type SwwwConfig struct {
	// Image display options
	ResizeType string `toml:"resize_type" json:"resizeType"`
	FillColor  string `toml:"fill_color" json:"fillColor"`
	FilterType string `toml:"filter_type" json:"filterType"`

	// Transition configuration
	TransitionType     string `toml:"transition_type" json:"transitionType"`
	TransitionStep     int    `toml:"transition_step" json:"transitionStep"`
	TransitionDuration int    `toml:"transition_duration" json:"transitionDuration"`
	TransitionFPS      int    `toml:"transition_fps" json:"transitionFPS"`
	TransitionAngle    int    `toml:"transition_angle" json:"transitionAngle"`
	TransitionPos      string `toml:"transition_pos" json:"transitionPos"`
	TransitionBezier   string `toml:"transition_bezier" json:"transitionBezier"`
	TransitionWave     string `toml:"transition_wave" json:"transitionWave"`
	InvertY            bool   `toml:"invert_y" json:"invertY"`

	// Position configuration (for transitions)
	PositionX float64 `toml:"position_x" json:"positionX"`
	PositionY float64 `toml:"position_y" json:"positionY"`
}
