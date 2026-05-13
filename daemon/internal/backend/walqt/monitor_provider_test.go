package walqt

import (
	"testing"

	"waypaper-engine/daemon/internal/monitor"

	"github.com/stretchr/testify/assert"
)

func TestTopologyToEngineMonitors_usesCompositorNames(t *testing.T) {
	got := topologyToEngineMonitors([]topologyEntry{
		{Name: "HDMI-A-1", Width: 1920, Height: 1080, X: 0, Y: 0},
		{Name: "DP-2", Width: 1920, Height: 1080, X: 1920, Y: 0},
	})
	assert.Equal(t, []monitor.Monitor{
		{Name: "HDMI-A-1", Width: 1920, Height: 1080, X: 0, Y: 0, Scale: 1},
		{Name: "DP-2", Width: 1920, Height: 1080, X: 1920, Y: 0, Scale: 1},
	}, got)
}
