package monitor

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestParseTransform(t *testing.T) {
	tests := []struct {
		input string
		want  int
	}{
		{"normal", 0},
		{"90", 1},
		{"180", 2},
		{"270", 3},
		{"flipped", 4},
		{"flipped-90", 5},
		{"flipped-180", 6},
		{"flipped-270", 7},
		{"unknown", 0},
	}

	for _, tt := range tests {
		t.Run(tt.input, func(t *testing.T) {
			assert.Equal(t, tt.want, parseTransform(tt.input))
		})
	}
}
