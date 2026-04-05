package parallaxdriver

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestEffectiveWorkspaceParallaxVertical(t *testing.T) {
	assert.False(t, EffectiveWorkspaceParallaxVertical("horizontal", ""))
	assert.True(t, EffectiveWorkspaceParallaxVertical("vertical", ""))
	assert.True(t, EffectiveWorkspaceParallaxVertical("horizontal", "vertical"))
	assert.False(t, EffectiveWorkspaceParallaxVertical("vertical", "horizontal"))
}

func TestParseParallaxPanAxis(t *testing.T) {
	assert.True(t, ParseParallaxPanAxis("VERTICAL"))
	assert.False(t, ParseParallaxPanAxis("horizontal"))
}
