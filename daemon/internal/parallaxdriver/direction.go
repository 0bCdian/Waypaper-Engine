package parallaxdriver

// Rect is workspace geometry in compositor-global coordinates.
type Rect struct {
	X, Y, Width, Height float64
}

// Center returns the center point of r.
func (r Rect) Center() (float64, float64) {
	return r.X + r.Width*0.5, r.Y + r.Height*0.5
}
