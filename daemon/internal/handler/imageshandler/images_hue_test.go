package imageshandler

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestParseHueGroupParam(t *testing.T) {
	tests := []struct {
		raw    string
		want   int
		wantOK bool
	}{
		{"0", 0, true},
		{"11", 11, true},
		{"99", 99, true},
		{" 5 ", 5, true},
		{"12", 0, false},
		{"-1", 0, false},
		{"98", 0, false},
		{"abc", 0, false},
		{"", 0, false},
	}
	for _, tt := range tests {
		t.Run(tt.raw, func(t *testing.T) {
			got, ok := parseHueGroupParam(tt.raw)
			assert.Equal(t, tt.wantOK, ok)
			if tt.wantOK {
				assert.Equal(t, tt.want, got)
			}
		})
	}
}
