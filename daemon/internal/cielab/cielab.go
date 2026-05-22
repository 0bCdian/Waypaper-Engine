// Package cielab provides CIELAB conversions and CIE76 ΔE for sRGB hex strings.
// It is dependency-free so store and image layers can share it without import cycles.
package cielab

import (
	"math"
	"strconv"
	"strings"
)

// Lab is a point in CIELAB space (D65 illuminant, same as image palette extraction).
type Lab struct {
	L, A, B float64
}

type rgb struct {
	r, g, b uint8
}

// FromHex parses #rgb or #rrggbb (case-insensitive) into Lab. ok is false if invalid.
func FromHex(hex string) (Lab, bool) {
	r, g, b, ok := hexToRGB(hex)
	if !ok {
		return Lab{}, false
	}
	return rgbToLab(rgb{r: r, g: g, b: b}), true
}

// DeltaE76 returns Euclidean distance in Lab (CIE76).
func DeltaE76(a, b Lab) float64 {
	dl := a.L - b.L
	da := a.A - b.A
	db := a.B - b.B
	return math.Sqrt(dl*dl + da*da + db*db)
}

// MinDeltaEBetweenPalettes returns the smallest CIE76 ΔE between any parseable swatch in a
// and any parseable swatch in b. ok is false when no valid pair exists.
func MinDeltaEBetweenPalettes(a, b []string) (minDE float64, ok bool) {
	best := math.MaxFloat64
	found := false
	for _, ha := range a {
		la, okA := FromHex(ha)
		if !okA {
			continue
		}
		for _, hb := range b {
			lb, okB := FromHex(hb)
			if !okB {
				continue
			}
			found = true
			d := DeltaE76(la, lb)
			if d < best {
				best = d
			}
		}
	}
	if !found {
		return 0, false
	}
	return best, true
}

// MinDeltaE76ToSwatches returns the smallest CIE76 ΔE between targetHex and any parseable swatch.
func MinDeltaE76ToSwatches(targetHex string, swatches []string) (minDE float64, ok bool) {
	target, tok := FromHex(targetHex)
	if !tok {
		return 0, false
	}
	best := math.MaxFloat64
	found := false
	for _, s := range swatches {
		lab, sok := FromHex(s)
		if !sok {
			continue
		}
		found = true
		d := DeltaE76(target, lab)
		if d < best {
			best = d
		}
	}
	if !found {
		return 0, false
	}
	return best, true
}

// WithinDeltaE reports whether some swatch is within maxDeltaE (inclusive) of targetHex.
func WithinDeltaE(targetHex string, maxDeltaE float64, swatches []string) bool {
	if maxDeltaE < 0 || math.IsNaN(maxDeltaE) {
		return false
	}
	d, ok := MinDeltaE76ToSwatches(targetHex, swatches)
	if !ok {
		return false
	}
	return d <= maxDeltaE+1e-9
}

func hexToRGB(hex string) (r, g, b uint8, ok bool) {
	s := strings.TrimSpace(strings.ToLower(hex))
	if s == "" {
		return 0, 0, 0, false
	}
	if !strings.HasPrefix(s, "#") {
		s = "#" + s
	}
	switch len(s) {
	case 4:
		rv, err1 := strconv.ParseUint(s[1:2], 16, 4)
		gv, err2 := strconv.ParseUint(s[2:3], 16, 4)
		bv, err3 := strconv.ParseUint(s[3:4], 16, 4)
		if err1 != nil || err2 != nil || err3 != nil {
			return 0, 0, 0, false
		}
		return uint8(rv * 17), uint8(gv * 17), uint8(bv * 17), true
	case 7:
		rv, err1 := strconv.ParseUint(s[1:3], 16, 8)
		gv, err2 := strconv.ParseUint(s[3:5], 16, 8)
		bv, err3 := strconv.ParseUint(s[5:7], 16, 8)
		if err1 != nil || err2 != nil || err3 != nil {
			return 0, 0, 0, false
		}
		return uint8(rv), uint8(gv), uint8(bv), true
	default:
		return 0, 0, 0, false
	}
}

func rgbToLab(p rgb) Lab {
	x, y, z := rgbToXYZ(p)
	return xyzToLab(x, y, z)
}

func rgbToXYZ(p rgb) (float64, float64, float64) {
	r := linearize(float64(p.r) / 255.0)
	g := linearize(float64(p.g) / 255.0)
	b := linearize(float64(p.b) / 255.0)

	x := r*0.4124564 + g*0.3575761 + b*0.1804375
	y := r*0.2126729 + g*0.7151522 + b*0.0721750
	z := r*0.0193339 + g*0.1191920 + b*0.9503041
	return x, y, z
}

func xyzToLab(x, y, z float64) Lab {
	const (
		xn = 0.950470
		yn = 1.0
		zn = 1.088830
	)
	fx := labF(x / xn)
	fy := labF(y / yn)
	fz := labF(z / zn)

	return Lab{
		L: 116.0*fy - 16.0,
		A: 500.0 * (fx - fy),
		B: 200.0 * (fy - fz),
	}
}

func linearize(v float64) float64 {
	if v <= 0.04045 {
		return v / 12.92
	}
	return math.Pow((v+0.055)/1.055, 2.4)
}

func labF(t float64) float64 {
	const delta = 6.0 / 29.0
	if t > delta*delta*delta {
		return math.Cbrt(t)
	}
	return t/(3*delta*delta) + 4.0/29.0
}
