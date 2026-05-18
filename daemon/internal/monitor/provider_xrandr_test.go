package monitor

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestParseXrandr_ConnectedOutputsEnabled(t *testing.T) {
	const sample = `Screen 0: minimum 320 x 200, current 4480 x 1440, maximum 16384 x 16384
DisplayPort-0 connected primary 2560x1440+1920+0 (normal left inverted right x axis y axis) 597mm x 336mm
   2560x1440     59.95*+ 240.00  
HDMI-A-0 connected 1920x1080+0+0 (normal left inverted right x axis y axis) 477mm x 268mm
   1920x1080     60.00*+  50.00  
`

	mons, err := parseXrandr(sample)
	require.NoError(t, err)
	require.Len(t, mons, 2)

	assert.Equal(t, "DisplayPort-0", mons[0].Name)
	assert.Equal(t, 2560, mons[0].Width)
	assert.Equal(t, 1440, mons[0].Height)
	assert.Equal(t, 1920, mons[0].X)
	assert.Equal(t, 0, mons[0].Y)
	assert.True(t, mons[0].Enabled)

	assert.Equal(t, "HDMI-A-0", mons[1].Name)
	assert.Equal(t, 1920, mons[1].Width)
	assert.Equal(t, 1080, mons[1].Height)
	assert.Equal(t, 0, mons[1].X)
	assert.Equal(t, 0, mons[1].Y)
	assert.True(t, mons[1].Enabled)
}
