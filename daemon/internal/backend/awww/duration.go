package awww

import (
	"math"
	"strconv"
)

// transitionDurationSecondsForCLI maps stored config to awww's --transition-duration (seconds).
//
// The app settings UI historically labeled this field as milliseconds and used the range 50–5000.
// awww expects seconds; whole-number values in 500–5000 are treated as legacy milliseconds
// (0.5s–5s typical). Other positive values are passed through as seconds (including fractions).
func transitionDurationSecondsForCLI(d float64) float64 {
	if d <= 0 {
		return 0
	}
	// Legacy mistaken-ms band: only when the stored value is a whole number in [500,5000].
	if d == math.Trunc(d) && d >= 500 && d <= 5000 {
		di := int(d)
		s := (di + 500) / 1000
		if s < 1 {
			s = 1
		}
		return float64(s)
	}
	return d
}

// formatAwwwTransitionDurationCLI returns a CLI argument value or "" when duration should be omitted.
func formatAwwwTransitionDurationCLI(d float64) string {
	s := transitionDurationSecondsForCLI(d)
	if s <= 0 {
		return ""
	}
	return strconv.FormatFloat(s, 'f', -1, 64)
}
