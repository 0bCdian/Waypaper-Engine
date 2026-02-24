package image

import (
	"testing"

	"github.com/stretchr/testify/assert"

	"waypaper-engine/daemon/internal/monitor"
)

func TestToLogical_NoScale(t *testing.T) {
	mon := monitor.Monitor{
		Name:   "HDMI-A-1",
		Width:  1920,
		Height: 1080,
		X:      0,
		Y:      0,
		Scale:  1.0,
	}

	lm := toLogical(mon)
	assert.Equal(t, "HDMI-A-1", lm.Name)
	assert.Equal(t, 1920, lm.LogicalWidth)
	assert.Equal(t, 1080, lm.LogicalHeight)
	assert.Equal(t, 0, lm.X)
	assert.Equal(t, 0, lm.Y)
}

func TestToLogical_HiDPI(t *testing.T) {
	mon := monitor.Monitor{
		Name:   "eDP-1",
		Width:  3840,
		Height: 2160,
		X:      0,
		Y:      0,
		Scale:  2.0,
	}

	lm := toLogical(mon)
	assert.Equal(t, 1920, lm.LogicalWidth)
	assert.Equal(t, 1080, lm.LogicalHeight)
}

func TestComputeBoundingBox(t *testing.T) {
	mons := []logicalMonitor{
		{Name: "A", LogicalWidth: 1920, LogicalHeight: 1080, X: 0, Y: 0},
		{Name: "B", LogicalWidth: 2560, LogicalHeight: 1440, X: 1920, Y: 0},
	}

	bbox := computeBoundingBox(mons)
	assert.Equal(t, 0, bbox.X)
	assert.Equal(t, 0, bbox.Y)
	assert.Equal(t, 4480, bbox.Width)
	assert.Equal(t, 1440, bbox.Height)
}

func TestToLogical_ZeroScale(t *testing.T) {
	mon := monitor.Monitor{
		Name:   "DP-1",
		Width:  2560,
		Height: 1440,
		X:      0,
		Y:      0,
		Scale:  0,
	}

	lm := toLogical(mon)
	assert.Equal(t, 2560, lm.LogicalWidth)
	assert.Equal(t, 1440, lm.LogicalHeight)
}
