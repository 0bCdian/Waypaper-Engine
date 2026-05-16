package walqt

import (
	"testing"
)

func TestTopologyMonitorMatch(t *testing.T) {
	t.Parallel()
	topo := []topologyEntry{
		{Name: "DP-1", X: 0, Y: 0, Width: 1920, Height: 1080},
		{Name: "DP-2", X: 1920, Y: 0, Width: 1920, Height: 1080},
	}
	name, ok := TopologyMonitorMatch(topo, 1920, 0, 1920, 1080)
	if !ok || name != "DP-2" {
		t.Fatalf("match right monitor: ok=%v name=%q", ok, name)
	}
	name, ok = TopologyMonitorMatch(topo, 1920.5, 0.5, 1920, 1080)
	if !ok || name != "DP-2" {
		t.Fatalf("match with epsilon: ok=%v name=%q", ok, name)
	}
	_, ok = TopologyMonitorMatch(topo, 9999, 0, 1920, 1080)
	if ok {
		t.Fatal("expected no match")
	}
}

func TestTopologyMonitorContainingCenter(t *testing.T) {
	t.Parallel()
	topo := []topologyEntry{
		{Name: "DP-1", X: 0, Y: 0, Width: 1920, Height: 1080},
		{Name: "DP-2", X: 1920, Y: 0, Width: 1920, Height: 1080},
	}
	name, ok := TopologyMonitorContainingCenter(topo, 1920, 0, 2500, 1200)
	if !ok || name != "DP-2" {
		t.Fatalf("center fallback: ok=%v name=%q", ok, name)
	}
}

func TestTopologyMonitorMatchByPosition(t *testing.T) {
	t.Parallel()
	topo := []topologyEntry{
		{Name: "DP-1", X: 0, Y: 0, Width: 1920, Height: 1080},
		{Name: "DP-2", X: 1920, Y: 0, Width: 2560, Height: 1440},
	}
	name, ok := TopologyMonitorMatchByPosition(topo, 1920, 0)
	if !ok || name != "DP-2" {
		t.Fatalf("position match: ok=%v name=%q", ok, name)
	}
	name, ok = TopologyMonitorMatchByPosition(topo, 0.5, 0.5)
	if !ok || name != "DP-1" {
		t.Fatalf("position match with epsilon: ok=%v name=%q", ok, name)
	}
	_, ok = TopologyMonitorMatchByPosition(topo, 5000, 0)
	if ok {
		t.Fatal("expected no match for out-of-range position")
	}
}

func TestResolveParallaxMonitor_geometryMatch(t *testing.T) {
	t.Parallel()
	topo := []topologyEntry{
		{Name: "DP-1", X: 0, Y: 0, Width: 1920, Height: 1080},
		{Name: "DP-2", X: 1920, Y: 0, Width: 2560, Height: 1440},
	}

	name, ok := ResolveParallaxMonitor(topo, 1920, 0, 2560, 1440)
	if !ok || name != "DP-2" {
		t.Fatalf("geometry match: ok=%v name=%q, want DP-2", ok, name)
	}
}

func TestResolveParallaxMonitor_positionFallbackOnScalingMismatch(t *testing.T) {
	t.Parallel()
	// GDK reports scaled dimensions, Hyprland reports physical.
	topo := []topologyEntry{
		{Name: "DP-1", X: 0, Y: 0, Width: 1707, Height: 960},
		{Name: "DP-2", X: 1707, Y: 0, Width: 1920, Height: 1080},
	}

	// Hyprland reports physical 2560x1440 at position (0,0) -- exact match fails
	// due to width/height mismatch, but position (0, 0) matches first output.
	name, ok := ResolveParallaxMonitor(topo, 0, 0, 2560, 1440)
	if !ok || name != "DP-1" {
		t.Fatalf("position fallback on scaling mismatch: ok=%v name=%q, want DP-1", ok, name)
	}
}

func TestResolveParallaxMonitor_positionWithZeroSizeBounds(t *testing.T) {
	t.Parallel()
	topo := []topologyEntry{
		{Name: "DP-1", X: 0, Y: 0, Width: 1920, Height: 1080},
		{Name: "DP-2", X: 1920, Y: 0, Width: 1920, Height: 1080},
	}
	name, ok := ResolveParallaxMonitor(topo, 0, 0, 0, 0)
	if !ok || name != "DP-1" {
		t.Fatalf("zero-size bounds with position: ok=%v name=%q, want DP-1", ok, name)
	}
}

func TestResolveParallaxMonitor_noGeometryMatch(t *testing.T) {
	t.Parallel()
	topo := []topologyEntry{
		{Name: "DP-1", X: 0, Y: 0, Width: 1920, Height: 1080},
		{Name: "DP-2", X: 1920, Y: 0, Width: 1920, Height: 1080},
	}
	_, ok := ResolveParallaxMonitor(topo, 9999, 9999, 0, 0)
	if ok {
		t.Fatal("expected no geometry match")
	}
}
