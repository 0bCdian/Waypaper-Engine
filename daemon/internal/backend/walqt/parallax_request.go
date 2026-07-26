package walqt

import (
	"math"
	"strconv"
	"strings"
)

var defaultParallaxEasing = [4]float32{0.215, 0.610, 0.355, 1.000}

func parallaxZoomFromPercent(pct int) float32 {
	if pct <= 0 {
		return 1.2 // match tauri default when unset
	}
	z := float32(pct) / 100.0
	if z < 1.0 {
		return 1.0
	}
	return z
}

func parseParallaxEasingOrDefault(s string) [4]float32 {
	s = strings.TrimSpace(s)
	if s == "" {
		return defaultParallaxEasing
	}
	parts := strings.Split(s, ",")
	if len(parts) != 4 {
		return defaultParallaxEasing
	}
	var out [4]float32
	for i := range 4 {
		v, err := strconv.ParseFloat(strings.TrimSpace(parts[i]), 32)
		if err != nil {
			return defaultParallaxEasing
		}
		f := float32(v)
		if !isFiniteFloat32(f) {
			return defaultParallaxEasing
		}
		out[i] = f
	}
	return out
}

func isFiniteFloat32(f float32) bool {
	x := float64(f)
	return !math.IsNaN(x) && !math.IsInf(x, 0)
}

func buildParallaxRequestBody(cfg *Config) map[string]any {
	if cfg == nil {
		cfg = defaultConfig()
	}
	step := float32(cfg.ParallaxStepPct)
	if step <= 0 {
		step = 5
	}
	anim := uint64(cfg.ParallaxAnimMS)
	if anim == 0 {
		anim = 600
	}
	reset := uint64(cfg.ParallaxResetMS)
	if reset == 0 {
		reset = 400
	}
	e := parseParallaxEasingOrDefault(cfg.ParallaxEasing)
	return map[string]any{
		"enabled":      cfg.ParallaxEnabled,
		"zoom":         parallaxZoomFromPercent(cfg.ParallaxZoom),
		"step_percent": step,
		"animation_ms": anim,
		"easing":       []float32{e[0], e[1], e[2], e[3]},
		"reset_ms":     reset,
	}
}
