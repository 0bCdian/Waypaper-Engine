package parallaxdriver

import "testing"

func TestResolveDirection(t *testing.T) {
	t.Parallel()
	tests := []struct {
		name              string
		last, next, chunk int
		vertical          bool
		want              string
	}{
		// First-tick sentinel: lastID==0 → no direction.
		{"first tick", 0, 1, 10, false, ""},
		// No movement.
		{"same ws", 3, 3, 10, false, ""},
		// Forward (increasing id within chunk).
		{"1→2 horizontal", 1, 2, 10, false, "right"},
		{"3→5 horizontal", 3, 5, 10, false, "right"},
		// Backward.
		{"5→3 horizontal", 5, 3, 10, false, "left"},
		// Vertical axis.
		{"1→2 vertical", 1, 2, 10, true, "down"},
		{"5→3 vertical", 5, 3, 10, true, "up"},
		// Chunk-wrap: chunk=10, delta=9 > half=5 → wrapped forward = right.
		{"10→1 wrap right", 10, 1, 10, false, "right"},
		// Chunk-wrap: chunk=10, 1→10 delta=9 > half=5, delta>0 → wrap → forward=false → left.
		{"1→10 wrap left", 1, 10, 10, false, "left"},
		// chunk=4, 4→1 delta=-3, abs=3 > half=2 → delta<0 → forward → right.
		{"4→1 wrap right chunk4", 4, 1, 4, false, "right"},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := resolveDirection(tt.last, tt.next, tt.chunk, tt.vertical)
			if got != tt.want {
				t.Errorf("resolveDirection(%d,%d,%d,%v) = %q, want %q",
					tt.last, tt.next, tt.chunk, tt.vertical, got, tt.want)
			}
		})
	}
}
