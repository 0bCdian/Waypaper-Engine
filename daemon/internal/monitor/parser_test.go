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

func TestParseWlrOutputName(t *testing.T) {
	name := parseWlrOutputName(`HDMI-A-1 "Monitor Brand"`)
	assert.Equal(t, "HDMI-A-1", name)
}

func TestParseWlrPosition(t *testing.T) {
	x, y := parseWlrPosition("0,1080")
	assert.Equal(t, 0, x)
	assert.Equal(t, 1080, y)
}

func TestParseWlrMode(t *testing.T) {
	w, h, hz := parseWlrMode("2560x1440 px, 143.912 Hz (preferred, current)")
	assert.Equal(t, 2560, w)
	assert.Equal(t, 1440, h)
	assert.InDelta(t, 143.912, hz, 0.001)
}

func TestParseWlrRandr_SingleMonitor(t *testing.T) {
	output := `HDMI-A-1 "Monitor Brand Model (HDMI-A-1)"
  Enabled: yes
  Modes:
    2560x1440 px, 143.912 Hz (current, preferred)
    1920x1080 px, 60.000 Hz
  Position: 0,0
  Transform: normal
  Scale: 1.000000`

	monitors, err := parseWlrRandr(output)
	require.NoError(t, err)
	require.Len(t, monitors, 1)

	mon := monitors[0]
	assert.Equal(t, "HDMI-A-1", mon.Name)
	assert.Equal(t, 2560, mon.Width)
	assert.Equal(t, 1440, mon.Height)
	assert.Equal(t, 0, mon.X)
	assert.Equal(t, 0, mon.Y)
	assert.Equal(t, 0, mon.Transform)
	assert.Equal(t, 1.0, mon.Scale)
	assert.InDelta(t, 143.912, mon.RefreshRate, 0.001)
}

func TestParseWlrRandr_MultiMonitor(t *testing.T) {
	output := `HDMI-A-1 "Monitor Brand Model (HDMI-A-1)"
  Enabled: yes
  Modes:
    2560x1440 px, 143.912 Hz (current, preferred)
    1920x1080 px, 60.000 Hz
  Position: 0,0
  Transform: normal
  Scale: 1.000000
eDP-1 "Internal Display (eDP-1)"
  Enabled: yes
  Modes:
    1920x1080 px, 60.000 Hz (current, preferred)
  Position: 2560,0
  Transform: normal
  Scale: 1.500000`

	monitors, err := parseWlrRandr(output)
	require.NoError(t, err)
	require.Len(t, monitors, 2)

	assert.Equal(t, "HDMI-A-1", monitors[0].Name)
	assert.Equal(t, 2560, monitors[0].Width)
	assert.Equal(t, 1440, monitors[0].Height)
	assert.Equal(t, 1.0, monitors[0].Scale)

	assert.Equal(t, "eDP-1", monitors[1].Name)
	assert.Equal(t, 1920, monitors[1].Width)
	assert.Equal(t, 1080, monitors[1].Height)
	assert.Equal(t, 2560, monitors[1].X)
	assert.Equal(t, 0, monitors[1].Y)
	assert.Equal(t, 1.5, monitors[1].Scale)
}

func TestParseWlrRandr_DisabledMonitor(t *testing.T) {
	output := `HDMI-A-1 "Monitor Brand Model (HDMI-A-1)"
  Enabled: yes
  Modes:
    1920x1080 px, 60.000 Hz (current)
  Position: 0,0
  Transform: normal
  Scale: 1.000000
DP-1 "Disabled Monitor (DP-1)"
  Enabled: no`

	monitors, err := parseWlrRandr(output)
	require.NoError(t, err)
	require.Len(t, monitors, 1)
	assert.Equal(t, "HDMI-A-1", monitors[0].Name)
}

func TestParseWlrRandr_Empty(t *testing.T) {
	monitors, err := parseWlrRandr("")
	require.NoError(t, err)
	assert.Empty(t, monitors)
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
