package parallaxdriver

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestParseDriverMode(t *testing.T) {
	assert.Equal(t, ModeAuto, ParseDriverMode(""))
	assert.Equal(t, ModeAuto, ParseDriverMode("auto"))
	assert.Equal(t, ModeOff, ParseDriverMode("off"))
	assert.Equal(t, ModeHyprland, ParseDriverMode("hyprland"))
	assert.Equal(t, ModeSway, ParseDriverMode("SWAY"))
}
