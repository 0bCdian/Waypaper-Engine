package walqt

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestParallaxZoomFromPercent(t *testing.T) {
	assert.InDelta(t, 1.2, parallaxZoomFromPercent(120), 1e-5)
	assert.InDelta(t, 1.0, parallaxZoomFromPercent(100), 1e-5)
	assert.InDelta(t, 1.5, parallaxZoomFromPercent(150), 1e-5)
	assert.InDelta(t, 1.0, parallaxZoomFromPercent(50), 1e-5) // below 100% clamps to 1.0
	assert.InDelta(t, 1.2, parallaxZoomFromPercent(0), 1e-5)
	assert.InDelta(t, 1.2, parallaxZoomFromPercent(-5), 1e-5)
}

func TestParseParallaxEasingOrDefault(t *testing.T) {
	got := parseParallaxEasingOrDefault("0.1, 0.2 ,0.3,1")
	assert.Equal(t, [4]float32{0.1, 0.2, 0.3, 1}, got)

	got = parseParallaxEasingOrDefault("")
	assert.Equal(t, defaultParallaxEasing, got)

	got = parseParallaxEasingOrDefault("not,numbers")
	assert.Equal(t, defaultParallaxEasing, got)

	got = parseParallaxEasingOrDefault("1,2,3")
	assert.Equal(t, defaultParallaxEasing, got)
}

func TestBuildParallaxRequestBody(t *testing.T) {
	cfg := &Config{
		ParallaxEnabled: true,
		ParallaxZoom:    120,
		ParallaxStepPct: 10,
		ParallaxAnimMS:  500,
		ParallaxEasing:  "0,0,1,1",
	}
	body := buildParallaxRequestBody(cfg)
	require.Equal(t, true, body["enabled"])
	require.InDelta(t, float32(1.2), body["zoom"], 1e-5)
	require.InDelta(t, float32(10), body["step_percent"], 1e-5)
	require.Equal(t, uint64(500), body["animation_ms"])
	require.Equal(t, uint64(400), body["reset_ms"]) // default when ParallaxResetMS unset in cfg test
	e, ok := body["easing"].([]float32)
	require.True(t, ok)
	assert.Equal(t, []float32{0, 0, 1, 1}, e)
}

func TestBuildParallaxRequestBody_StepAndAnimFallbacks(t *testing.T) {
	cfg := &Config{
		ParallaxEnabled: false,
		ParallaxZoom:    100,
		ParallaxStepPct: 0,
		ParallaxAnimMS:  0,
	}
	body := buildParallaxRequestBody(cfg)
	assert.Equal(t, float32(5), body["step_percent"])
	assert.Equal(t, uint64(600), body["animation_ms"])
}

func TestBuildParallaxRequestBody_customResetMS(t *testing.T) {
	cfg := &Config{
		ParallaxEnabled: true,
		ParallaxZoom:    100,
		ParallaxStepPct: 5,
		ParallaxAnimMS:  300,
		ParallaxResetMS: 800,
		ParallaxEasing:  "",
	}
	body := buildParallaxRequestBody(cfg)
	require.Equal(t, uint64(800), body["reset_ms"])
}
