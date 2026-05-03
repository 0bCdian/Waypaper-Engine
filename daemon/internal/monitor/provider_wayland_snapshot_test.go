package monitor

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestInterpretWlrSnapshot_DisabledHead_NoCurrentMode(t *testing.T) {
	snap := wlrSnapshot{
		Heads: []wlrHead{{
			Name:             "DP-1",
			Enabled:          false,
			CurrentModeIndex: -1,
			Modes:            []wlrMode{{Width: 2560, Height: 1440, RefreshMHz: 60000}},
		}},
	}

	mons := interpretWlrSnapshot(snap)
	assert.Len(t, mons, 1)
	assert.Equal(t, "DP-1", mons[0].Name)
	assert.False(t, mons[0].Enabled)
	// width/height/refresh stay at zero when no current mode is resolved.
	assert.Zero(t, mons[0].Width)
	assert.Zero(t, mons[0].Height)
	assert.Zero(t, mons[0].RefreshRate)
}

func TestInterpretWlrSnapshot_FinishedHead_Skipped(t *testing.T) {
	snap := wlrSnapshot{
		Heads: []wlrHead{
			{Name: "DP-1", Finished: true, Enabled: true, CurrentModeIndex: 0,
				Modes: []wlrMode{{Width: 2560, Height: 1440, RefreshMHz: 60000}}},
			{Name: "HDMI-A-1", Enabled: true, CurrentModeIndex: 0,
				Modes: []wlrMode{{Width: 1920, Height: 1080, RefreshMHz: 60000}}},
		},
	}

	mons := interpretWlrSnapshot(snap)
	assert.Len(t, mons, 1)
	assert.Equal(t, "HDMI-A-1", mons[0].Name)
}

func TestInterpretWlrSnapshot_EmptyName_GetsUnknownFallback(t *testing.T) {
	snap := wlrSnapshot{
		Heads: []wlrHead{
			{Name: "DP-1", Enabled: true, CurrentModeIndex: -1},
			{Name: "", Enabled: true, CurrentModeIndex: -1},
		},
	}

	mons := interpretWlrSnapshot(snap)
	assert.Equal(t, "DP-1", mons[0].Name)
	assert.Equal(t, "Unknown-1", mons[1].Name)
}

func TestInterpretWlrSnapshot_NameTrimmed(t *testing.T) {
	snap := wlrSnapshot{
		Heads: []wlrHead{{Name: "  DP-1  ", Enabled: true, CurrentModeIndex: -1}},
	}
	mons := interpretWlrSnapshot(snap)
	assert.Equal(t, "DP-1", mons[0].Name)
}

func TestInterpretWlrSnapshot_RefreshMHzToHz(t *testing.T) {
	snap := wlrSnapshot{
		Heads: []wlrHead{{
			Name: "DP-1", Enabled: true, CurrentModeIndex: 0,
			Modes: []wlrMode{{Width: 2560, Height: 1440, RefreshMHz: 240000}},
		}},
	}
	mons := interpretWlrSnapshot(snap)
	assert.InDelta(t, 240.0, mons[0].RefreshRate, 0.0001)

	// Sub-Hz precision retained (e.g. EDID 59.951 Hz reports as 59951 mHz).
	snap.Heads[0].Modes[0].RefreshMHz = 59951
	mons = interpretWlrSnapshot(snap)
	assert.InDelta(t, 59.951, mons[0].RefreshRate, 0.0001)
}

func TestInterpretWlrSnapshot_AdaptiveSync_BothStates(t *testing.T) {
	snap := wlrSnapshot{
		Heads: []wlrHead{
			{Name: "DP-1", Enabled: true, AdaptiveSync: false, CurrentModeIndex: -1},
			{Name: "HDMI-A-1", Enabled: true, AdaptiveSync: true, CurrentModeIndex: -1},
		},
	}
	mons := interpretWlrSnapshot(snap)
	assert.False(t, mons[0].AdaptiveSync)
	assert.True(t, mons[1].AdaptiveSync)
}

func TestInterpretWlrSnapshot_OutOfRangeIndex_FallsBackToZeroValues(t *testing.T) {
	// Defensive: a CurrentModeIndex outside the modes slice (would only happen
	// if the C side resolved against a stale pointer or our index drifted)
	// must not panic — the head just has no current mode.
	snap := wlrSnapshot{
		Heads: []wlrHead{{
			Name: "DP-1", Enabled: true, CurrentModeIndex: 5,
			Modes: []wlrMode{{Width: 2560, Height: 1440, RefreshMHz: 60000}},
		}},
	}
	mons := interpretWlrSnapshot(snap)
	assert.Zero(t, mons[0].Width)
	assert.Zero(t, mons[0].RefreshRate)
}

// TestInterpretWlrSnapshot_RealHyprlandFixture pins the real-world output the
// daemon previously printed wrong (x=0,y=0 for both monitors). The values
// match what wlr-randr reports on the maintainer's machine; the test
// regression-locks the root-cause fix without needing a wayland session.
func TestInterpretWlrSnapshot_RealHyprlandFixture(t *testing.T) {
	snap := wlrSnapshot{
		Heads: []wlrHead{
			{
				Name:           "DP-1",
				Description:    "GIGA-BYTE TECHNOLOGY CO. LTD. GS27QXA 24436B000275  (DP-1)",
				Make:           "GIGA-BYTE TECHNOLOGY CO., LTD.",
				Model:          "GS27QXA",
				Serial:         "24436B000275 ",
				PhysicalWidth:  600,
				PhysicalHeight: 340,
				Enabled:        true,
				X:              1920,
				Y:              0,
				Transform:      0,
				Scale:          1.0,
				AdaptiveSync:   false,
				Modes: []wlrMode{
					{Width: 2560, Height: 1440, RefreshMHz: 240000},
				},
				CurrentModeIndex: 0,
			},
			{
				Name:           "HDMI-A-1",
				Description:    "Samsung Electric Company S22D300 0x5A5A3848 (HDMI-A-1)",
				Make:           "Samsung Electric Company",
				Model:          "S22D300",
				Serial:         "0x5A5A3848",
				PhysicalWidth:  480,
				PhysicalHeight: 270,
				Enabled:        true,
				X:              0,
				Y:              0,
				Transform:      0,
				Scale:          1.0,
				AdaptiveSync:   true,
				Modes: []wlrMode{
					{Width: 1920, Height: 1080, RefreshMHz: 60000},
				},
				CurrentModeIndex: 0,
			},
		},
	}

	mons := interpretWlrSnapshot(snap)
	assert.Len(t, mons, 2)

	assert.Equal(t, "DP-1", mons[0].Name)
	assert.Equal(t, 1920, mons[0].X, "DP-1 must report logical x=1920, not the stale 0,0")
	assert.Equal(t, 0, mons[0].Y)
	assert.Equal(t, 2560, mons[0].Width)
	assert.Equal(t, 1440, mons[0].Height)
	assert.InDelta(t, 240.0, mons[0].RefreshRate, 0.0001)
	assert.False(t, mons[0].AdaptiveSync)

	assert.Equal(t, "HDMI-A-1", mons[1].Name)
	assert.Equal(t, 0, mons[1].X)
	assert.Equal(t, 0, mons[1].Y)
	assert.Equal(t, "Samsung Electric Company", mons[1].Make)
	assert.True(t, mons[1].AdaptiveSync)
}
