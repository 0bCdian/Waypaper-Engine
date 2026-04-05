package waylandutauri

import "testing"

func TestTopologyMonitorMatch(t *testing.T) {
	t.Parallel()
	topo := []topologyEntry{
		{Monitor: 0, X: 0, Y: 0, Width: 1920, Height: 1080},
		{Monitor: 1, X: 1920, Y: 0, Width: 1920, Height: 1080},
	}
	id, ok := TopologyMonitorMatch(topo, 1920, 0, 1920, 1080)
	if !ok || id != 1 {
		t.Fatalf("match right monitor: ok=%v id=%d", ok, id)
	}
	id, ok = TopologyMonitorMatch(topo, 1920.5, 0.5, 1920, 1080)
	if !ok || id != 1 {
		t.Fatalf("match with epsilon: ok=%v id=%d", ok, id)
	}
	_, ok = TopologyMonitorMatch(topo, 9999, 0, 1920, 1080)
	if ok {
		t.Fatal("expected no match")
	}
}

func TestTopologyMonitorContainingCenter(t *testing.T) {
	t.Parallel()
	topo := []topologyEntry{
		{Monitor: 0, X: 0, Y: 0, Width: 1920, Height: 1080},
		{Monitor: 1, X: 1920, Y: 0, Width: 1920, Height: 1080},
	}
	id, ok := TopologyMonitorContainingCenter(topo, 1920, 0, 2500, 1200)
	if !ok || id != 1 {
		t.Fatalf("center fallback: ok=%v id=%d", ok, id)
	}
}

func TestTopologyMonitorMatchByPosition(t *testing.T) {
	t.Parallel()
	topo := []topologyEntry{
		{Monitor: 0, X: 0, Y: 0, Width: 1920, Height: 1080},
		{Monitor: 1, X: 1920, Y: 0, Width: 2560, Height: 1440},
	}
	id, ok := TopologyMonitorMatchByPosition(topo, 1920, 0)
	if !ok || id != 1 {
		t.Fatalf("position match: ok=%v id=%d", ok, id)
	}
	id, ok = TopologyMonitorMatchByPosition(topo, 0.5, 0.5)
	if !ok || id != 0 {
		t.Fatalf("position match with epsilon: ok=%v id=%d", ok, id)
	}
	_, ok = TopologyMonitorMatchByPosition(topo, 5000, 0)
	if ok {
		t.Fatal("expected no match for out-of-range position")
	}
}

func TestResolveParallaxMonitor_geometryBeforeCompositorID(t *testing.T) {
	t.Parallel()
	// GDK order: HDMI-A-1 is monitor 0 at (0,0), DP-1 is monitor 1 at (1920,0).
	// Hyprland order: DP-1 is id 0, HDMI-A-1 is id 1 (swapped).
	topo := []topologyEntry{
		{Monitor: 0, X: 0, Y: 0, Width: 1920, Height: 1080},
		{Monitor: 1, X: 1920, Y: 0, Width: 2560, Height: 1440},
	}

	// DP-1 in Hyprland: compositor id=0, position (1920, 0), size 2560x1440.
	// Without geometry priority, compositor id=0 would match topology monitor 0
	// (HDMI-A-1) -- wrong display. With geometry, it correctly maps to monitor 1.
	dp1Hint := 0
	id, ok := ResolveParallaxMonitor(topo, 1920, 0, 2560, 1440, &dp1Hint)
	if !ok || id != 1 {
		t.Fatalf("DP-1 with swapped compositor id: ok=%v id=%d, want 1", ok, id)
	}

	// HDMI-A-1 in Hyprland: compositor id=1, position (0, 0), size 1920x1080.
	// Without geometry priority, compositor id=1 would match topology monitor 1
	// (DP-1) -- wrong display. With geometry, it correctly maps to monitor 0.
	hdmiHint := 1
	id, ok = ResolveParallaxMonitor(topo, 0, 0, 1920, 1080, &hdmiHint)
	if !ok || id != 0 {
		t.Fatalf("HDMI-A-1 with swapped compositor id: ok=%v id=%d, want 0", ok, id)
	}
}

func TestResolveParallaxMonitor_positionFallbackOnScalingMismatch(t *testing.T) {
	t.Parallel()
	// GDK reports scaled dimensions, Hyprland reports physical.
	topo := []topologyEntry{
		{Monitor: 0, X: 0, Y: 0, Width: 1707, Height: 960},
		{Monitor: 1, X: 1707, Y: 0, Width: 1920, Height: 1080},
	}

	// Hyprland reports physical 2560x1440 at position (0,0) -- exact match fails
	// due to width/height mismatch, but position (0, 0) matches monitor 0.
	id, ok := ResolveParallaxMonitor(topo, 0, 0, 2560, 1440, nil)
	if !ok || id != 0 {
		t.Fatalf("position fallback on scaling mismatch: ok=%v id=%d, want 0", ok, id)
	}
}

func TestResolveParallaxMonitor_compositorIDLastResort(t *testing.T) {
	t.Parallel()
	// No geometry available (zeros) -- compositor ID is the only option.
	topo := []topologyEntry{
		{Monitor: 0, X: 0, Y: 0, Width: 1920, Height: 1080},
		{Monitor: 1, X: 1920, Y: 0, Width: 1920, Height: 1080},
	}
	hint := 1
	id, ok := ResolveParallaxMonitor(topo, 0, 0, 0, 0, &hint)
	// Position (0,0) matches monitor 0 -- geometry still wins over compositor ID
	// even when bounds have zero width/height, because position matches.
	if !ok || id != 0 {
		t.Fatalf("zero-size bounds with position: ok=%v id=%d, want 0", ok, id)
	}
}

func TestResolveParallaxMonitor_compositorIDWhenNoGeometry(t *testing.T) {
	t.Parallel()
	// Position doesn't match anything -- compositor ID is the only fallback.
	topo := []topologyEntry{
		{Monitor: 0, X: 0, Y: 0, Width: 1920, Height: 1080},
		{Monitor: 1, X: 1920, Y: 0, Width: 1920, Height: 1080},
	}
	hint := 1
	id, ok := ResolveParallaxMonitor(topo, 9999, 9999, 0, 0, &hint)
	if !ok || id != 1 {
		t.Fatalf("compositor id fallback: ok=%v id=%d, want 1", ok, id)
	}
}
