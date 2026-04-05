package parallaxdriver

import "testing"

func TestRectCenter(t *testing.T) {
	r := Rect{X: 0, Y: 0, Width: 1920, Height: 1080}
	cx, cy := r.Center()
	if cx != 960 || cy != 540 {
		t.Errorf("Center() = (%v, %v), want (960, 540)", cx, cy)
	}
}
