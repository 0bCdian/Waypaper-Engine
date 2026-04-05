package waylandutauri

import (
	"testing"

	"waypaper-engine/daemon/internal/monitor"

	"github.com/stretchr/testify/assert"
)

func TestTopologyToEngineMonitors_usesMonitorIndexLabels(t *testing.T) {
	got := topologyToEngineMonitors([]topologyEntry{
		{Monitor: 1, StableID: "HDMI-A-1", Width: 1920, Height: 1080, X: 0, Y: 0},
		{Monitor: 2, StableID: "", Width: 1920, Height: 1080, X: 1920, Y: 0},
	})
	assert.Equal(t, []monitor.Monitor{
		{Name: "Monitor 1", Width: 1920, Height: 1080, X: 0, Y: 0, Scale: 1},
		{Name: "Monitor 2", Width: 1920, Height: 1080, X: 1920, Y: 0, Scale: 1},
	}, got)
}
