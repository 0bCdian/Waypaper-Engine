package parallaxdriver

import "strings"

// ParseParallaxPanAxis returns true when global config selects vertical workspace parallax.
func ParseParallaxPanAxis(s string) bool {
	switch strings.ToLower(strings.TrimSpace(s)) {
	case "vertical", "v", "y":
		return true
	default:
		return false
	}
}

// EffectiveWorkspaceParallaxVertical resolves manifest override vs global default.
// manifestValue must be "", "horizontal", or "vertical" (normalized). Empty manifest uses globalDefault only.
func EffectiveWorkspaceParallaxVertical(globalDefault, manifestValue string) bool {
	switch strings.ToLower(strings.TrimSpace(manifestValue)) {
	case "vertical":
		return true
	case "horizontal":
		return false
	default:
		return ParseParallaxPanAxis(globalDefault)
	}
}
