package parallaxdriver

import "testing"

func TestSwayParallaxKey(t *testing.T) {
	t.Parallel()
	minus1 := -1
	n2 := 2
	n5 := 5
	tests := []struct {
		name string
		id   int
		num  *int
		want int
	}{
		{"numbered uses num", 99, &n5, 5},
		{"num -1 falls back to id", 42, &minus1, 42},
		{"nil num uses id", 7, nil, 7},
		{"small id large num", 69, &n2, 2},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := swayParallaxKey(tt.id, tt.num)
			if got != tt.want {
				t.Fatalf("swayParallaxKey(%d, %v) = %d, want %d", tt.id, tt.num, got, tt.want)
			}
		})
	}
}
