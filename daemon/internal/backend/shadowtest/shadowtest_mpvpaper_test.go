package shadowtest_test

import (
	"context"
	"strings"
	"testing"

	"github.com/stretchr/testify/require"

	"waypaper-engine/daemon/internal/backend"
	"waypaper-engine/daemon/internal/backend/shadowtest"
	"waypaper-engine/daemon/internal/media"
	"waypaper-engine/daemon/internal/monitor"
)

// TestMpvpaper_ShadowEquivalence_OneMonitor verifies that Apply and SetWallpaper
// produce identical action sets for a single video on one monitor (fresh state).
func TestMpvpaper_ShadowEquivalence_OneMonitor(t *testing.T) {
	captor := shadowtest.NewMpvpaperCaptor(t)

	mon := monitor.Monitor{Name: "DP-1"}
	snap := backend.Snapshot{
		Outputs: []backend.Output{
			{Monitor: mon, Content: backend.Video{Path_: "/tmp/video.mp4", AudioEnabled: false}},
		},
	}
	legacy := backend.WallpaperRequest{
		MediaType:    media.MediaTypeVideo,
		ImagePath:    "/tmp/video.mp4",
		Monitors:     []monitor.Monitor{mon},
		Mode:         monitor.ModeClone,
		AudioEnabled: false,
	}

	shadowtest.CompareFixture(t, captor, shadowtest.Fixture{
		Name:          "one_monitor_one_video",
		Snapshot:      snap,
		LegacyRequest: legacy,
	})
}

// TestMpvpaper_ShadowEquivalence_TwoMonitors verifies that Apply and SetWallpaper
// produce identical action sets for two monitors playing the same video (fresh state).
func TestMpvpaper_ShadowEquivalence_TwoMonitors(t *testing.T) {
	captor := shadowtest.NewMpvpaperCaptor(t)

	mon1 := monitor.Monitor{Name: "DP-1"}
	mon2 := monitor.Monitor{Name: "DP-2"}
	snap := backend.Snapshot{
		Outputs: []backend.Output{
			{Monitor: mon1, Content: backend.Video{Path_: "/tmp/video.mp4", AudioEnabled: false}},
			{Monitor: mon2, Content: backend.Video{Path_: "/tmp/video.mp4", AudioEnabled: false}},
		},
	}
	legacy := backend.WallpaperRequest{
		MediaType:    media.MediaTypeVideo,
		ImagePath:    "/tmp/video.mp4",
		Monitors:     []monitor.Monitor{mon1, mon2},
		Mode:         monitor.ModeClone,
		AudioEnabled: false,
	}

	shadowtest.CompareFixture(t, captor, shadowtest.Fixture{
		Name:          "two_monitors_same_video",
		Snapshot:      snap,
		LegacyRequest: legacy,
	})
}

// TestMpvpaper_Reconcile_ChangeVideo verifies that Apply correctly stops the old
// process and starts a new one when the video path changes on a monitor.
// State persists between Apply calls to test per-output reconciliation.
func TestMpvpaper_Reconcile_ChangeVideo(t *testing.T) {
	captor := shadowtest.NewMpvpaperCaptor(t)
	ctx := context.Background()

	mon := monitor.Monitor{Name: "DP-1"}

	// First Apply: establish initial state (clean procs).
	captor.Backend().ResetProcsForTest()
	captor.ResetActions()
	snap1 := backend.Snapshot{
		Outputs: []backend.Output{
			{Monitor: mon, Content: backend.Video{Path_: "/tmp/old.mp4", AudioEnabled: false}},
		},
	}
	require.NoError(t, captor.Backend().Apply(ctx, snap1))
	acts1 := captor.Actions()
	require.Len(t, acts1, 1, "first Apply: one start, no kill")
	require.Equal(t, "start", acts1[0].Kind)
	require.Equal(t, "DP-1", acts1[0].Monitor)

	// Second Apply: different path → kill old, start new.
	// Do NOT reset procs — we want state from the first Apply to persist.
	captor.ResetActions()
	snap2 := backend.Snapshot{
		Outputs: []backend.Output{
			{Monitor: mon, Content: backend.Video{Path_: "/tmp/new.mp4", AudioEnabled: false}},
		},
	}
	require.NoError(t, captor.Backend().Apply(ctx, snap2))
	acts2 := captor.Actions()

	var kills, starts []shadowtest.MpvAction
	for _, a := range acts2 {
		switch a.Kind {
		case "kill":
			kills = append(kills, a)
		case "start":
			starts = append(starts, a)
		}
	}
	require.Len(t, kills, 1, "second Apply: must kill old process for DP-1")
	require.Equal(t, "DP-1", kills[0].Monitor)
	require.Len(t, starts, 1, "second Apply: must start new process for DP-1")
	require.Equal(t, "DP-1", starts[0].Monitor)

	// argv must contain the new path.
	require.Contains(t, starts[0].Argv, "/tmp/new.mp4")
}

// TestMpvpaper_Reconcile_RemoveMonitor verifies that a snapshot no longer listing
// a monitor causes Apply to kill that monitor's process.
// This is Apply-only: SetWallpaper cannot express "stop this monitor."
func TestMpvpaper_Reconcile_RemoveMonitor(t *testing.T) {
	captor := shadowtest.NewMpvpaperCaptor(t)
	ctx := context.Background()

	mon1 := monitor.Monitor{Name: "DP-1"}
	mon2 := monitor.Monitor{Name: "DP-2"}

	// First Apply: two monitors (clean start).
	captor.Backend().ResetProcsForTest()
	captor.ResetActions()
	snap1 := backend.Snapshot{
		Outputs: []backend.Output{
			{Monitor: mon1, Content: backend.Video{Path_: "/tmp/v.mp4", AudioEnabled: false}},
			{Monitor: mon2, Content: backend.Video{Path_: "/tmp/v.mp4", AudioEnabled: false}},
		},
	}
	require.NoError(t, captor.Backend().Apply(ctx, snap1))

	// Second Apply: only DP-1 → DP-2 must be killed.
	captor.ResetActions()
	snap2 := backend.Snapshot{
		Outputs: []backend.Output{
			{Monitor: mon1, Content: backend.Video{Path_: "/tmp/v.mp4", AudioEnabled: false}},
		},
	}
	require.NoError(t, captor.Backend().Apply(ctx, snap2))
	acts := captor.Actions()

	var kills []shadowtest.MpvAction
	for _, a := range acts {
		if a.Kind == "kill" {
			kills = append(kills, a)
		}
	}
	require.Len(t, kills, 1, "second Apply must kill exactly one monitor (DP-2)")
	require.Equal(t, "DP-2", kills[0].Monitor)
}

// TestMpvpaper_AudioFlag verifies that the audio flag is correctly reflected in argv.
// audio=false → argv contains "no-audio" in -o value; audio=true → it does not.
func TestMpvpaper_AudioFlag(t *testing.T) {
	t.Run("no_audio", func(t *testing.T) {
		captor := shadowtest.NewMpvpaperCaptor(t)
		snap := backend.Snapshot{
			Outputs: []backend.Output{
				{Monitor: monitor.Monitor{Name: "DP-1"}, Content: backend.Video{Path_: "/v.mp4", AudioEnabled: false}},
			},
		}
		_ = captor.CaptureApply(t, snap)
		acts := captor.Actions()
		require.Len(t, acts, 1)
		require.Equal(t, "start", acts[0].Kind)
		argv := acts[0].Argv
		found := false
		for i, arg := range argv {
			if arg == "-o" && i+1 < len(argv) {
				if strings.Contains(argv[i+1], "no-audio") {
					found = true
				}
			}
		}
		require.True(t, found, "argv must have -o no-audio... when AudioEnabled=false; got %v", argv)
	})

	t.Run("audio_enabled", func(t *testing.T) {
		captor := shadowtest.NewMpvpaperCaptor(t)
		snap := backend.Snapshot{
			Outputs: []backend.Output{
				{Monitor: monitor.Monitor{Name: "DP-1"}, Content: backend.Video{Path_: "/v.mp4", AudioEnabled: true}},
			},
		}
		_ = captor.CaptureApply(t, snap)
		acts := captor.Actions()
		require.Len(t, acts, 1)
		require.Equal(t, "start", acts[0].Kind)
		argv := acts[0].Argv
		for i, arg := range argv {
			if arg == "-o" && i+1 < len(argv) {
				require.False(t, strings.Contains(argv[i+1], "no-audio"),
					"argv must not contain no-audio when AudioEnabled=true; got %v", argv)
			}
		}
	})
}
