package image

import (
	"math"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestRgbToLab_Black(t *testing.T) {
	lab := rgbToLab(rgbPixel{0, 0, 0})
	assert.InDelta(t, 0, lab.l, 0.5)
}

func TestRgbToLab_White(t *testing.T) {
	lab := rgbToLab(rgbPixel{255, 255, 255})
	assert.InDelta(t, 100, lab.l, 0.5)
}

func TestLabToRGB_Roundtrip(t *testing.T) {
	colors := []rgbPixel{
		{255, 0, 0},
		{0, 255, 0},
		{0, 0, 255},
		{128, 128, 128},
		{200, 100, 50},
	}

	for _, c := range colors {
		lab := rgbToLab(c)
		r, g, b := labToRGB(lab)
		assert.InDelta(t, float64(c.r), float64(r), 2, "red channel for %v", c)
		assert.InDelta(t, float64(c.g), float64(g), 2, "green channel for %v", c)
		assert.InDelta(t, float64(c.b), float64(b), 2, "blue channel for %v", c)
	}
}

func TestLabDistance_Identical(t *testing.T) {
	lab := rgbToLab(rgbPixel{100, 150, 200})
	assert.Equal(t, 0.0, labDistance(lab, lab))
}

func TestLabDistance_Different(t *testing.T) {
	black := rgbToLab(rgbPixel{0, 0, 0})
	white := rgbToLab(rgbPixel{255, 255, 255})
	d := labDistance(black, white)
	assert.Greater(t, d, 0.0)
}

func TestKmeansLab_ClusterCount(t *testing.T) {
	points := make([]labColor, 100)
	for i := range points {
		points[i] = labColor{
			l: float64(i),
			a: math.Sin(float64(i)) * 50,
			b: math.Cos(float64(i)) * 50,
		}
	}

	centroids := kmeansLab(points, 3, 20, 1.0)
	require.Len(t, centroids, 3)
}
