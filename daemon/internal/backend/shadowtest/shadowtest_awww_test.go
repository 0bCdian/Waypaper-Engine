package shadowtest_test

import (
	"context"
	"testing"

	"github.com/spf13/viper"
	"github.com/stretchr/testify/require"

	"waypaper-engine/daemon/internal/backend"
	"waypaper-engine/daemon/internal/backend/shadowtest"
	"waypaper-engine/daemon/internal/monitor"
)

// TestAwww_Apply_SingleMonitor verifies that Apply emits one "awww img" invocation
// with --outputs for a single monitor.
func TestAwww_Apply_SingleMonitor(t *testing.T) {
	captor := shadowtest.NewAwwwCaptor(t)

	mon := monitor.Monitor{Name: "DP-1"}
	snap := backend.Snapshot{
		Outputs: []backend.Output{
			{Monitor: mon, Content: backend.StaticImage{Path_: "/tmp/wall.png"}},
		},
	}

	_ = captor.CaptureApply(t, snap)
	invs := captor.LastInvocations()

	require.Len(t, invs, 1, "single monitor must produce one invocation")
	require.Equal(t, "img", invs[0][0])
	require.Equal(t, "/tmp/wall.png", invs[0][1])
	require.Contains(t, invs[0], "--outputs")
}

// TestAwww_Apply_TwoMonitorsSameImage verifies that Apply produces ONE "awww img"
// invocation with --outputs DP-1,DP-2 when both monitors share the same image.
func TestAwww_Apply_TwoMonitorsSameImage(t *testing.T) {
	captor := shadowtest.NewAwwwCaptor(t)

	mon1 := monitor.Monitor{Name: "DP-1"}
	mon2 := monitor.Monitor{Name: "DP-2"}
	snap := backend.Snapshot{
		Outputs: []backend.Output{
			{Monitor: mon1, Content: backend.StaticImage{Path_: "/tmp/wall.png"}},
			{Monitor: mon2, Content: backend.StaticImage{Path_: "/tmp/wall.png"}},
		},
	}

	_ = captor.CaptureApply(t, snap)
	invs := captor.LastInvocations()

	require.Len(t, invs, 1, "same-path outputs must collapse into one invocation")
	require.Equal(t, "img", invs[0][0])
	require.Equal(t, "/tmp/wall.png", invs[0][1])

	// Find --outputs flag and verify both monitors are listed.
	outputsIdx := -1
	for i, arg := range invs[0] {
		if arg == "--outputs" {
			outputsIdx = i
			break
		}
	}
	require.NotEqual(t, -1, outputsIdx, "argv must contain --outputs flag")
	outputs := invs[0][outputsIdx+1]
	require.Contains(t, outputs, "DP-1")
	require.Contains(t, outputs, "DP-2")
}

// TestAwww_Apply_TwoMonitorsDifferentImages verifies that Apply produces TWO
// "awww img" invocations when the two monitors have different image paths.
func TestAwww_Apply_TwoMonitorsDifferentImages(t *testing.T) {
	captor := shadowtest.NewAwwwCaptor(t)

	mon1 := monitor.Monitor{Name: "DP-1"}
	mon2 := monitor.Monitor{Name: "DP-2"}
	snap := backend.Snapshot{
		Outputs: []backend.Output{
			{Monitor: mon1, Content: backend.StaticImage{Path_: "/tmp/a.png"}},
			{Monitor: mon2, Content: backend.StaticImage{Path_: "/tmp/b.png"}},
		},
	}

	err := captor.Backend().Apply(context.Background(), snap)
	require.NoError(t, err)
	invs := captor.LastInvocations()

	require.Len(t, invs, 2, "different-path outputs must produce separate invocations")

	// Each invocation must reference one of the two paths.
	paths := map[string]bool{}
	for _, inv := range invs {
		require.Equal(t, "img", inv[0])
		paths[inv[1]] = true
	}
	require.True(t, paths["/tmp/a.png"], "invocations must include /tmp/a.png")
	require.True(t, paths["/tmp/b.png"], "invocations must include /tmp/b.png")
}

// TestAwww_Apply_TransitionViperConfig verifies that transition config set in viper
// is propagated into the argv produced by Apply.
func TestAwww_Apply_TransitionViperConfig(t *testing.T) {
	captor := shadowtest.NewAwwwCaptor(t)
	v := viper.New()
	v.Set("backend.awww.transition_type", "fade")
	captor.Backend().RegisterDefaults(v)

	mon := monitor.Monitor{Name: "DP-1"}
	snap := backend.Snapshot{
		Outputs: []backend.Output{
			{Monitor: mon, Content: backend.StaticImage{Path_: "/tmp/wall.png"}},
		},
	}

	_ = captor.CaptureApply(t, snap)
	invs := captor.LastInvocations()
	require.Len(t, invs, 1)

	// Find --transition-type flag and assert its value is "fade".
	found := false
	for i, arg := range invs[0] {
		if arg == "--transition-type" && i+1 < len(invs[0]) {
			require.Equal(t, "fade", invs[0][i+1], "--transition-type must reflect viper config")
			found = true
			break
		}
	}
	require.True(t, found, "argv must contain --transition-type flag from viper config")
}
