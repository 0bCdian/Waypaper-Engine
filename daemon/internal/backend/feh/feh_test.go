package feh

import (
	"errors"
	"testing"

	"github.com/spf13/viper"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"waypaper-engine/daemon/internal/backend"
	"waypaper-engine/daemon/internal/monitor"
)

func TestParseXrandrListMonitors_PrimaryFirst(t *testing.T) {
	// Real-world sample from a user with DisplayPort-0 as primary on the right.
	out := `Monitors: 2
 0: +*DisplayPort-0 2560/597x1440/336+1920+0  DisplayPort-0
 1: +HDMI-A-0 1920/477x1080/268+0+0  HDMI-A-0
`
	got := parseXrandrListMonitors(out)
	assert.Equal(t, map[string]int{
		"DisplayPort-0": 0,
		"HDMI-A-0":      1,
	}, got)
}

func TestParseXrandrListMonitors_Single(t *testing.T) {
	out := `Monitors: 1
 0: +*eDP-1 1920/344x1080/194+0+0  eDP-1
`
	got := parseXrandrListMonitors(out)
	assert.Equal(t, map[string]int{"eDP-1": 0}, got)
}

func TestParseXrandrListMonitors_Empty(t *testing.T) {
	got := parseXrandrListMonitors("Monitors: 0\n")
	assert.Empty(t, got)
}

func TestParseXrandrListMonitors_Garbage(t *testing.T) {
	// Malformed lines are skipped without crashing.
	out := `Monitors: 2
not-a-line
 0: +HDMI-A-0 1920x1080+0+0  HDMI-A-0
zzz: bogus
`
	got := parseXrandrListMonitors(out)
	assert.Equal(t, map[string]int{"HDMI-A-0": 0}, got)
}

// TestApply_XineramaLookupError_FallsBack verifies that when the Xinerama
// query fails, Apply still emits an argv (in snapshot order) rather than
// returning an error.
func TestApply_XineramaLookupError_FallsBack(t *testing.T) {
	f := New().(*Feh)
	v := viper.New()
	v.Set("backend.feh.mode", "fill")
	f.RegisterDefaults(v)

	var gotArgs []string
	f.SetExecForTest(func(args []string) error {
		gotArgs = append([]string(nil), args...)
		return nil
	})
	f.SetXineramaOrderForTest(func() (map[string]int, error) {
		return nil, errors.New("simulated xrandr failure")
	})

	snap := backend.Snapshot{
		Outputs: []backend.Output{
			{Monitor: monitor.Monitor{Name: "A"}, Content: backend.StaticImage{Path_: "/tmp/a.png"}},
			{Monitor: monitor.Monitor{Name: "B"}, Content: backend.StaticImage{Path_: "/tmp/b.png"}},
		},
	}
	require.NoError(t, f.Apply(t.Context(), snap))
	require.Equal(t, []string{"--bg-fill", "/tmp/a.png", "/tmp/b.png"}, gotArgs)
}

func TestXineramaIndex_KnownAndUnknown(t *testing.T) {
	order := map[string]int{"A": 0, "B": 1}
	assert.Equal(t, 0, xineramaIndex(order, "A"))
	assert.Equal(t, 1, xineramaIndex(order, "B"))
	// Unknown names sort after known ones.
	assert.Greater(t, xineramaIndex(order, "C"), 1)
}
