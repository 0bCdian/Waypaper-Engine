package walqt

import (
	"fmt"
	"strconv"
	"strings"
)

// defaultTransitionBezier matches waypaper-tauri resolveTransitionIntent default
// (src/renderer/transition/intent.ts).
var defaultTransitionBezier = [4]float32{0.54, 0, 0.34, 0.99}

// parseTransitionBezierOrDefault parses "x1,y1,x2,y2" for load requests; empty or
// invalid input yields defaultTransitionBezier.
func parseTransitionBezierOrDefault(s string) [4]float32 {
	s = strings.TrimSpace(s)
	if s == "" {
		return defaultTransitionBezier
	}
	out, err := parseTransitionBezierStrict(s)
	if err != nil {
		return defaultTransitionBezier
	}
	return out
}

// parseTransitionBezierStrict requires exactly four comma-separated finite floats.
func parseTransitionBezierStrict(s string) ([4]float32, error) {
	var zero [4]float32
	s = strings.TrimSpace(s)
	if s == "" {
		return zero, fmt.Errorf("empty transition_bezier")
	}
	parts := strings.Split(s, ",")
	if len(parts) != 4 {
		return zero, fmt.Errorf("want four comma-separated numbers, got %d parts", len(parts))
	}
	var out [4]float32
	for i := range 4 {
		v, err := strconv.ParseFloat(strings.TrimSpace(parts[i]), 32)
		if err != nil {
			return zero, fmt.Errorf("component %d: %w", i+1, err)
		}
		f := float32(v)
		if !isFiniteFloat32(f) {
			return zero, fmt.Errorf("component %d is not a finite number", i+1)
		}
		out[i] = f
	}
	return out, nil
}
