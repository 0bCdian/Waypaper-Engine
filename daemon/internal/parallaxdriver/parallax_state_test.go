package parallaxdriver

import (
	"context"
	"math"
	"sync"
	"testing"
)

func TestWorkspaceTargetPercent(t *testing.T) {
	t.Parallel()
	tests := []struct {
		id, chunk int
		want      float64
	}{
		{chunk: 10, id: 1, want: -40},
		{chunk: 10, id: 3, want: -20},
		{chunk: 10, id: 5, want: 0},
		{chunk: 10, id: 9, want: 40},
		{chunk: 10, id: 10, want: 50},
		{chunk: 10, id: 11, want: -40},
		{chunk: 10, id: 19, want: 40},
		{chunk: 10, id: 20, want: 50},
		{chunk: 4, id: 1, want: -25},
		{chunk: 4, id: 3, want: 25},
		{chunk: 4, id: 4, want: 50},
		{chunk: 4, id: 5, want: -25},
		{chunk: 1, id: 1, want: 50},
		{chunk: 1, id: 7, want: 50},
	}
	for _, tt := range tests {
		got := workspaceTargetPercent(tt.id, tt.chunk)
		if math.Abs(got-tt.want) > 1e-9 {
			t.Errorf("workspaceTargetPercent(%d,%d) = %v, want %v", tt.id, tt.chunk, got, tt.want)
		}
	}
}

func TestWorkspaceTargetPercent_invalidInputs(t *testing.T) {
	t.Parallel()
	cases := []struct {
		name      string
		id, chunk int
	}{
		{"chunk 0", 5, 0},
		{"chunk -1", 5, -1},
		{"id 0", 0, 10},
		{"id -1 (scratchpad)", -1, 10},
		{"id -99 (special)", -99, 10},
	}
	for _, tc := range cases {
		if g := workspaceTargetPercent(tc.id, tc.chunk); g != 0 {
			t.Errorf("%s: workspaceTargetPercent(%d,%d) = %v, want 0", tc.name, tc.id, tc.chunk, g)
		}
	}
}

func TestTick_multiMonitor(t *testing.T) {
	t.Parallel()

	var mu sync.Mutex
	type moveCall struct {
		dir    string
		amount float64
		mon    uint32
	}
	var moves []moveCall

	move := func(_ context.Context, dir string, amount float64, mon uint32) error {
		mu.Lock()
		moves = append(moves, moveCall{dir, amount, mon})
		mu.Unlock()
		return nil
	}
	resolve := func(_ context.Context, e MonitorWorkspaceEntry) (uint32, bool) {
		if e.CompositorMonID != nil {
			return uint32(*e.CompositorMonID), true
		}
		return 0, false
	}

	st := &workspaceParallaxAbsoluteState{}
	ctx := context.Background()

	mon0 := 0
	mon1 := 1

	// ws 1 -> target -40% (delta from 0 = -40 -> left, amount 40)
	// ws 3 -> target -20% (delta from 0 = -20 -> left, amount 20)
	entries := []MonitorWorkspaceEntry{
		{WorkspaceID: 1, Bounds: Rect{X: 0, Y: 0, Width: 1920, Height: 1080}, CompositorMonID: &mon0},
		{WorkspaceID: 3, Bounds: Rect{X: 1920, Y: 0, Width: 1920, Height: 1080}, CompositorMonID: &mon1},
	}

	st.tick(ctx, entries, move, resolve, false, 10, nil)

	mu.Lock()
	got := append([]moveCall{}, moves...)
	mu.Unlock()

	if len(got) != 2 {
		t.Fatalf("expected 2 move calls, got %d: %+v", len(got), got)
	}
	if got[0].dir != "left" || math.Abs(got[0].amount-40) > 0.1 || got[0].mon != 0 {
		t.Errorf("move[0] = %+v, want {left, 40, 0}", got[0])
	}
	if got[1].dir != "left" || math.Abs(got[1].amount-20) > 0.1 || got[1].mon != 1 {
		t.Errorf("move[1] = %+v, want {left, 20, 1}", got[1])
	}

	// Second tick with same entries: no moves (dedup by lastActiveWSPerMon)
	moves = nil
	st.tick(ctx, entries, move, resolve, false, 10, nil)
	mu.Lock()
	got2 := append([]moveCall{}, moves...)
	mu.Unlock()
	if len(got2) != 0 {
		t.Errorf("expected 0 repeat moves, got %d: %+v", len(got2), got2)
	}
}

func TestTick_skipsSpecialWorkspaces(t *testing.T) {
	t.Parallel()

	var called bool
	move := func(_ context.Context, _ string, _ float64, _ uint32) error {
		called = true
		return nil
	}
	resolve := func(_ context.Context, _ MonitorWorkspaceEntry) (uint32, bool) {
		return 0, true
	}

	st := &workspaceParallaxAbsoluteState{}
	ctx := context.Background()
	mon0 := 0

	entries := []MonitorWorkspaceEntry{
		{WorkspaceID: -1, CompositorMonID: &mon0},
		{WorkspaceID: -99, CompositorMonID: &mon0},
		{WorkspaceID: 0, CompositorMonID: &mon0},
	}
	st.tick(ctx, entries, move, resolve, false, 10, nil)
	if called {
		t.Error("move was called for special/zero workspace IDs")
	}
}

func TestDirectionForDelta(t *testing.T) {
	t.Parallel()
	tests := []struct {
		delta    float64
		vertical bool
		want     string
	}{
		{10, false, "right"},
		{-10, false, "left"},
		{0, false, ""},
		{10, true, "down"},
		{-10, true, "up"},
		{0, true, ""},
	}
	for _, tt := range tests {
		got := directionForDelta(tt.delta, tt.vertical)
		if got != tt.want {
			t.Errorf("directionForDelta(%v, %v) = %q, want %q", tt.delta, tt.vertical, got, tt.want)
		}
	}
}
