package cielab

import "math"

// NeutralHueGroup is the hue group for palettes with no chromatic swatch
// (grayscale / near-black / near-white images).
const NeutralHueGroup = 99

// Chromatic swatch thresholds (HSL). A swatch below the saturation floor or
// outside the lightness band reads as neutral to the eye and is skipped when
// picking the palette's representative hue.
const (
	minChromaticSaturation = 0.18
	minChromaticLightness  = 0.12
	maxChromaticLightness  = 0.92
)

// HueGroupFromPalette returns the 30°-bucket hue group (0-11, red-centered:
// hue >= 345° or < 15° → 0) of the first chromatic swatch in dominance order,
// or NeutralHueGroup when no swatch qualifies. Invalid hexes are skipped.
func HueGroupFromPalette(swatches []string) int {
	group, _ := HueSortKey(swatches)
	return group
}

// HueSortKey returns the hue group plus the winning swatch's HSL saturation,
// for rainbow ordering (group asc, saturation desc). Neutral → (99, 0).
func HueSortKey(swatches []string) (int, float64) {
	for _, hex := range swatches {
		r, g, b, ok := hexToRGB(hex)
		if !ok {
			continue
		}
		h, s, l := rgbToHSL(r, g, b)
		if s < minChromaticSaturation || l < minChromaticLightness || l > maxChromaticLightness {
			continue
		}
		return hueBucket(h), s
	}
	return NeutralHueGroup, 0
}

// hueBucket maps a hue in [0, 360) to a red-centered 30° bucket: shifting by
// +15° makes [345, 360)∪[0, 15) land in bucket 0.
func hueBucket(h float64) int {
	shifted := math.Mod(h+15, 360)
	return int(shifted/30) % 12
}

func rgbToHSL(r, g, b uint8) (h, s, l float64) {
	rf := float64(r) / 255
	gf := float64(g) / 255
	bf := float64(b) / 255
	max := math.Max(rf, math.Max(gf, bf))
	min := math.Min(rf, math.Min(gf, bf))
	l = (max + min) / 2
	d := max - min
	if d == 0 {
		return 0, 0, l
	}
	if l > 0.5 {
		s = d / (2 - max - min)
	} else {
		s = d / (max + min)
	}
	switch max {
	case rf:
		h = math.Mod((gf-bf)/d, 6)
	case gf:
		h = (bf-rf)/d + 2
	default:
		h = (rf-gf)/d + 4
	}
	h *= 60
	if h < 0 {
		h += 360
	}
	return h, s, l
}
