package monitor

// SwwwConfig holds the configuration for the swww daemon.
type SwwwConfig struct {
	ResizeType             string  `json:"resizeType"`
	FillColor              string  `json:"fillColor"`
	FilterType             string  `json:"filterType"`
	TransitionType         string  `json:"transitionType"`
	TransitionStep         int     `json:"transitionStep"`
	TransitionDuration     float64 `json:"transitionDuration"`
	TransitionFPS          int     `json:"transitionFPS"`
	TransitionAngle        float64 `json:"transitionAngle"`
	TransitionPositionType string  `json:"transitionPositionType"`
	TransitionPosition     string  `json:"transitionPosition"`
	TransitionPositionIntX int     `json:"transitionPositionIntX"`
	TransitionPositionIntY int     `json:"transitionPositionIntY"`
	TransitionPositionFloatX float64 `json:"transitionPositionFloatX"`
	TransitionPositionFloatY float64 `json:"transitionPositionFloatY"`
	InvertY                bool    `json:"invertY"`
	TransitionBezier       string  `json:"transitionBezier"`
	TransitionWaveX        int     `json:"transitionWaveX"`
	TransitionWaveY        int     `json:"transitionWaveY"`
}
