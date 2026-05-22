package image

import (
	"math"
	"testing"
)

func TestClampVideoSeekSeconds(t *testing.T) {
	cases := []struct {
		name string
		seek float64
		dur  float64
		want float64
	}{
		{name: "zero", seek: 0, dur: 10, want: 0},
		{name: "negative", seek: -5, dur: 10, want: 0},
		{name: "mid", seek: 5, dur: 10, want: 5},
		{name: "at_end", seek: 10, dur: 10, want: 10 - 0.001},
		{name: "past_end", seek: 15, dur: 10, want: 10 - 0.001},
		{name: "unknown_duration", seek: 99, dur: 0, want: 99},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			got := clampVideoSeekSeconds(tc.seek, tc.dur)
			if math.Abs(got-tc.want) > 1e-9 {
				t.Fatalf("got %v want %v", got, tc.want)
			}
		})
	}
}
