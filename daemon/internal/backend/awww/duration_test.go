package awww

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestTransitionDurationSecondsForCLI(t *testing.T) {
	assert.InDelta(t, 0.0, transitionDurationSecondsForCLI(0), 1e-9)
	assert.InDelta(t, 3.0, transitionDurationSecondsForCLI(3), 1e-9)
	assert.InDelta(t, 60.0, transitionDurationSecondsForCLI(60), 1e-9)
	assert.InDelta(t, 0.5, transitionDurationSecondsForCLI(0.5), 1e-9)
	assert.InDelta(t, 3.0, transitionDurationSecondsForCLI(3000), 1e-9)
	assert.InDelta(t, 1.0, transitionDurationSecondsForCLI(500), 1e-9)
	assert.InDelta(t, 5.0, transitionDurationSecondsForCLI(5000), 1e-9)
}

func TestFormatAwwwTransitionDurationCLI(t *testing.T) {
	assert.Equal(t, "", formatAwwwTransitionDurationCLI(0))
	assert.Equal(t, "0.5", formatAwwwTransitionDurationCLI(0.5))
	assert.Equal(t, "3", formatAwwwTransitionDurationCLI(3))
}
