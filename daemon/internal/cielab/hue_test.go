package cielab

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestHueGroupFromPalette(t *testing.T) {
	tests := []struct {
		name     string
		swatches []string
		want     int
	}{
		{"pure red", []string{"#ff0000"}, 0},
		{"red wraps high hue (350deg)", []string{"#ff002b"}, 0}, // hue ≈ 350
		{"orange (30deg)", []string{"#ff8000"}, 1},              // hue ≈ 30
		{"yellow (60deg)", []string{"#ffff00"}, 2},              // hue = 60
		{"green (120deg)", []string{"#00ff00"}, 4},              // hue = 120
		{"cyan (180deg)", []string{"#00ffff"}, 6},               // hue = 180
		{"blue (240deg)", []string{"#0000ff"}, 8},               // hue = 240
		{"magenta (300deg)", []string{"#ff00ff"}, 10},           // hue = 300
		{"pink (330deg)", []string{"#ff0080"}, 11},              // hue = 330
		{"dominance order wins: first chromatic swatch", []string{"#0000ff", "#ff0000"}, 8},
		{"skips achromatic dominant swatch", []string{"#808080", "#ff0000"}, 0},
		{"skips near-black swatch", []string{"#160505", "#00ff00"}, 4}, // lightness < 0.12
		{"skips near-white swatch", []string{"#fdf3f2", "#00ff00"}, 4}, // lightness > 0.92
		{"all gray is neutral", []string{"#111111", "#808080", "#eeeeee"}, NeutralHueGroup},
		{"empty palette is neutral", nil, NeutralHueGroup},
		{"invalid hex skipped", []string{"nope", "#00ff00"}, 4},
		{"only invalid hex is neutral", []string{"zzz"}, NeutralHueGroup},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			assert.Equal(t, tt.want, HueGroupFromPalette(tt.swatches))
		})
	}
}

func TestHueSortKey(t *testing.T) {
	g, s := HueSortKey([]string{"#ff0000"})
	assert.Equal(t, 0, g)
	assert.InDelta(t, 1.0, s, 0.001) // pure red: HSL saturation 1

	g, s = HueSortKey([]string{"#808080"})
	assert.Equal(t, NeutralHueGroup, g)
	assert.Equal(t, 0.0, s)

	// Muted but chromatic red (#b06060: sat ≈ 0.34) still lands in group 0 with its own saturation.
	g, s = HueSortKey([]string{"#b06060"})
	assert.Equal(t, 0, g)
	assert.Greater(t, s, 0.18)
	assert.Less(t, s, 0.6)
}
