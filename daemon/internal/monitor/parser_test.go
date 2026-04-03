package monitor

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
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
func TestParseWlrRandrJSON_SingleMonitor(t *testing.T) {
	output := `[
  {
    "name": "HDMI-A-1",
    "enabled": true,
    "modes": [
      { "width": 1920, "height": 1080, "refresh": 60.0, "current": true }
    ],
    "position": { "x": 0, "y": 0 },
    "transform": "normal",
    "scale": 1.0
  }
]`

	monitors, err := parseWlrRandrJSON([]byte(output))
	require.NoError(t, err)
	require.Len(t, monitors, 1)

	mon := monitors[0]
	assert.Equal(t, "HDMI-A-1", mon.Name)
	assert.Equal(t, 1920, mon.Width)
	assert.Equal(t, 1080, mon.Height)
	assert.Equal(t, 0, mon.X)
	assert.Equal(t, 0, mon.Y)
	assert.Equal(t, 0, mon.Transform)
	assert.Equal(t, 1.0, mon.Scale)
	assert.InDelta(t, 60.0, mon.RefreshRate, 0.001)
}

func TestParseWlrRandrJSON_MultiMonitor(t *testing.T) {
	output := `[
  {
    "name": "DP-1",
    "enabled": true,
    "modes": [
      { "width": 2560, "height": 1440, "refresh": 143.912, "current": true }
    ],
    "position": { "x": 0, "y": 0 },
    "transform": "normal",
    "scale": 1.0
  },
  {
    "name": "HDMI-A-1",
    "enabled": true,
    "modes": [
      { "width": 1920, "height": 1080, "refresh": 60.0, "current": true }
    ],
    "position": { "x": 2560, "y": 0 },
    "transform": "90",
    "scale": 1.25
  }
]`

	monitors, err := parseWlrRandrJSON([]byte(output))
	require.NoError(t, err)
	require.Len(t, monitors, 2)

	assert.Equal(t, "DP-1", monitors[0].Name)
	assert.Equal(t, 2560, monitors[0].Width)
	assert.Equal(t, 1440, monitors[0].Height)
	assert.InDelta(t, 143.912, monitors[0].RefreshRate, 0.001)

	assert.Equal(t, "HDMI-A-1", monitors[1].Name)
	assert.Equal(t, 1920, monitors[1].Width)
	assert.Equal(t, 1080, monitors[1].Height)
	assert.Equal(t, 2560, monitors[1].X)
	assert.Equal(t, 0, monitors[1].Y)
	assert.Equal(t, 1, monitors[1].Transform)
	assert.Equal(t, 1.25, monitors[1].Scale)
}

func TestParseWlrRandrJSON_DisabledMonitorFiltered(t *testing.T) {
	output := `[
  {
    "name": "DP-1",
    "enabled": true,
    "modes": [
      { "width": 2560, "height": 1440, "refresh": 120.0, "current": true }
    ],
    "position": { "x": 0, "y": 0 },
    "transform": "normal",
    "scale": 1.0
  },
  {
    "name": "HDMI-A-1",
    "enabled": false,
    "modes": [
      { "width": 1920, "height": 1080, "refresh": 60.0, "current": true }
    ],
    "position": { "x": 2560, "y": 0 },
    "transform": "normal",
    "scale": 1.0
  }
]`

	monitors, err := parseWlrRandrJSON([]byte(output))
	require.NoError(t, err)
	require.Len(t, monitors, 1)
	assert.Equal(t, "DP-1", monitors[0].Name)
}

func TestParseWlrRandrJSON_MissingCurrentModeSafety(t *testing.T) {
	output := `[
  {
    "name": "DP-1",
    "enabled": true,
    "modes": [
      { "width": 2560, "height": 1440, "refresh": 120.0, "current": false }
    ],
    "position": { "x": 0, "y": 0 },
    "transform": "flipped-90",
    "scale": 1.0
  }
]`

	monitors, err := parseWlrRandrJSON([]byte(output))
	require.NoError(t, err)
	require.Len(t, monitors, 1)

	mon := monitors[0]
	assert.Equal(t, "DP-1", mon.Name)
	assert.Equal(t, 0, mon.Width)
	assert.Equal(t, 0, mon.Height)
	assert.InDelta(t, 0.0, mon.RefreshRate, 0.001)
	assert.Equal(t, 5, mon.Transform)
}
