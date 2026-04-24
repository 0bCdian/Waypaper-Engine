package parallaxdriver

import (
	"context"
	"sync"
	"testing"
)

func TestTick_multiMonitor_directions(t *testing.T) {
	t.Parallel()

	var mu sync.Mutex
	type moveCall struct {
		out, dir string
	}
	var moves []moveCall

	move := func(_ context.Context, out, dir string) error {
		mu.Lock()
		moves = append(moves, moveCall{out, dir})
		mu.Unlock()
		return nil
	}
	resolve := func(_ context.Context, e MonitorWorkspaceEntry) (string, bool) {
		if e.Bounds.X >= 1920 {
			return "DP-2", true
		}
		return "DP-1", true
	}

	st := &workspaceParallaxAbsoluteState{}
	ctx := context.Background()

	// First tick: both outputs see ws 1 / ws 3 — first-tick sentinel, no moves.
	entries := []MonitorWorkspaceEntry{
		{WorkspaceID: 1, Bounds: Rect{X: 0, Y: 0, Width: 1920, Height: 1080}},
		{WorkspaceID: 3, Bounds: Rect{X: 1920, Y: 0, Width: 1920, Height: 1080}},
	}
	st.tick(ctx, entries, move, resolve, false, 10, nil)
	mu.Lock()
	got0 := append([]moveCall{}, moves...)
	mu.Unlock()
	if len(got0) != 0 {
		t.Fatalf("first tick: expected 0 move calls, got %d: %+v", len(got0), got0)
	}

	// Second tick: DP-1 moves to ws 2 (right), DP-2 stays at ws 3 (no move).
	entries2 := []MonitorWorkspaceEntry{
		{WorkspaceID: 2, Bounds: Rect{X: 0, Y: 0, Width: 1920, Height: 1080}},
		{WorkspaceID: 3, Bounds: Rect{X: 1920, Y: 0, Width: 1920, Height: 1080}},
	}
	st.tick(ctx, entries2, move, resolve, false, 10, nil)
	mu.Lock()
	got1 := append([]moveCall{}, moves...)
	mu.Unlock()
	if len(got1) != 1 || got1[0].out != "DP-1" || got1[0].dir != "right" {
		t.Fatalf("second tick: expected [{DP-1 right}], got %+v", got1)
	}

	// Third tick: same state — no moves.
	mu.Lock()
	moves = nil
	mu.Unlock()
	st.tick(ctx, entries2, move, resolve, false, 10, nil)
	mu.Lock()
	got2 := append([]moveCall{}, moves...)
	mu.Unlock()
	if len(got2) != 0 {
		t.Errorf("repeat tick: expected 0 move calls, got %d: %+v", len(got2), got2)
	}
}

func TestTick_prefersOutputNameOverGeometryResolve(t *testing.T) {
	t.Parallel()

	var mu sync.Mutex
	var outs []string
	move := func(_ context.Context, out, _ string) error {
		mu.Lock()
		outs = append(outs, out)
		mu.Unlock()
		return nil
	}
	resolve := func(_ context.Context, _ MonitorWorkspaceEntry) (string, bool) {
		t.Fatal("resolve should not run when OutputName is set")
		return "", false
	}

	st := &workspaceParallaxAbsoluteState{}
	ctx := context.Background()

	// Seed last ws to 1 so next tick triggers a move.
	st.updateOutput("HDMI-A-1", monitorParallaxState{lastActiveWSID: 1})

	entries := []MonitorWorkspaceEntry{
		{WorkspaceID: 2, OutputName: "HDMI-A-1", Bounds: Rect{X: 99999, Y: 99999, Width: 1, Height: 1}},
	}
	st.tick(ctx, entries, move, resolve, false, 10, nil)
	mu.Lock()
	got := append([]string{}, outs...)
	mu.Unlock()
	if len(got) != 1 || got[0] != "HDMI-A-1" {
		t.Fatalf("expected one move to HDMI-A-1, got %v", got)
	}
}

func TestTick_skipsSpecialWorkspaces(t *testing.T) {
	t.Parallel()

	var called bool
	move := func(_ context.Context, _, _ string) error {
		called = true
		return nil
	}
	resolve := func(_ context.Context, _ MonitorWorkspaceEntry) (string, bool) {
		return "DP-1", true
	}

	st := &workspaceParallaxAbsoluteState{}
	ctx := context.Background()
	entries := []MonitorWorkspaceEntry{
		{WorkspaceID: -1},
		{WorkspaceID: -99},
		{WorkspaceID: 0},
	}
	st.tick(ctx, entries, move, resolve, false, 10, nil)
	if called {
		t.Error("move was called for special/zero workspace IDs")
	}
}
