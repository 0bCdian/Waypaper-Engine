package cielab

import (
	"math"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestMinDeltaE76ToSwatches_exactMatch(t *testing.T) {
	d, ok := MinDeltaE76ToSwatches("#ff0000", []string{"#00ff00", "#ff0000"})
	require.True(t, ok)
	assert.InDelta(t, 0, d, 1e-6)
}

func TestMinDeltaE76ToSwatches_invalidTarget(t *testing.T) {
	_, ok := MinDeltaE76ToSwatches("not-a-color", []string{"#ff0000"})
	assert.False(t, ok)
}

func TestWithinDeltaE_nearRed(t *testing.T) {
	assert.True(t, WithinDeltaE("#ff0000", 50, []string{"#fe0101"}))
	assert.False(t, WithinDeltaE("#ff0000", 0.001, []string{"#00ff00"}))
}

func TestHexToRGB_threeDigit(t *testing.T) {
	r, g, b, ok := hexToRGB("#f0a")
	require.True(t, ok)
	assert.Equal(t, uint8(255), r)
	assert.Equal(t, uint8(0), g)
	assert.Equal(t, uint8(170), b)
}

func TestMinDeltaE76ToSwatches_emptySwatches(t *testing.T) {
	_, ok := MinDeltaE76ToSwatches("#ffffff", nil)
	assert.False(t, ok)
}

func TestWithinDeltaE_nanMax(t *testing.T) {
	assert.False(t, WithinDeltaE("#fff", math.NaN(), []string{"#ffffff"}))
}

func TestMinDeltaEBetweenPalettes_nearPair(t *testing.T) {
	d, ok := MinDeltaEBetweenPalettes([]string{"#ff0000"}, []string{"#fe0101"})
	require.True(t, ok)
	assert.Less(t, d, 5.0)
}

func TestMinDeltaEBetweenPalettes_farPair(t *testing.T) {
	d, ok := MinDeltaEBetweenPalettes([]string{"#ff0000"}, []string{"#00ff00"})
	require.True(t, ok)
	assert.Greater(t, d, 50.0)
}

func TestMinDeltaEBetweenPalettes_noValidPair(t *testing.T) {
	_, ok := MinDeltaEBetweenPalettes([]string{"bogus"}, []string{"#fff"})
	assert.False(t, ok)
}
