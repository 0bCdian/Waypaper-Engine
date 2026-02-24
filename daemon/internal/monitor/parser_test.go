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
