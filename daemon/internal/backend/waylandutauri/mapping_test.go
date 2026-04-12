package waylandutauri

import (
	"testing"

	"waypaper-engine/daemon/internal/backend"
	"waypaper-engine/daemon/internal/media"
	"waypaper-engine/daemon/internal/monitor"
)

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

func TestResolveParallaxMonitor_geometryMatch(t *testing.T) {
	t.Parallel()
	topo := []topologyEntry{
		{Monitor: 0, X: 0, Y: 0, Width: 1920, Height: 1080},
		{Monitor: 1, X: 1920, Y: 0, Width: 2560, Height: 1440},
	}

	id, ok := ResolveParallaxMonitor(topo, 1920, 0, 2560, 1440)
	if !ok || id != 1 {
		t.Fatalf("geometry match: ok=%v id=%d, want 1", ok, id)
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
	id, ok := ResolveParallaxMonitor(topo, 0, 0, 2560, 1440)
	if !ok || id != 0 {
		t.Fatalf("position fallback on scaling mismatch: ok=%v id=%d, want 0", ok, id)
	}
}

func TestResolveParallaxMonitor_positionWithZeroSizeBounds(t *testing.T) {
	t.Parallel()
	topo := []topologyEntry{
		{Monitor: 0, X: 0, Y: 0, Width: 1920, Height: 1080},
		{Monitor: 1, X: 1920, Y: 0, Width: 1920, Height: 1080},
	}
	id, ok := ResolveParallaxMonitor(topo, 0, 0, 0, 0)
	if !ok || id != 0 {
		t.Fatalf("zero-size bounds with position: ok=%v id=%d, want 0", ok, id)
	}
}

func TestResolveParallaxMonitor_noGeometryMatch(t *testing.T) {
	t.Parallel()
	topo := []topologyEntry{
		{Monitor: 0, X: 0, Y: 0, Width: 1920, Height: 1080},
		{Monitor: 1, X: 1920, Y: 0, Width: 1920, Height: 1080},
	}
	_, ok := ResolveParallaxMonitor(topo, 9999, 9999, 0, 0)
	if ok {
		t.Fatal("expected no geometry match")
	}
}

func TestBuildLoadRequest_UsesImageDisplayModesForImages(t *testing.T) {
	t.Parallel()
	cfg := defaultConfig()
	cfg.ImageFitMode = "scale-down"
	cfg.ImageRendering = "pixelated"
	req := backend.WallpaperRequest{
		MediaType: media.MediaTypeImage,
		ImagePath: "/tmp/wall.png",
		Mode:      monitor.ModeClone,
	}

	loadReq, err := buildLoadRequest(req, cfg, nil)
	if err != nil {
		t.Fatalf("buildLoadRequest image: %v", err)
	}
	if loadReq.ImageFitMode != "scale-down" {
		t.Fatalf("image fit mode mismatch: got %q", loadReq.ImageFitMode)
	}
	if loadReq.ImageRendering != "pixelated" {
		t.Fatalf("image rendering mismatch: got %q", loadReq.ImageRendering)
	}
}

func TestBuildLoadRequest_DoesNotSetImageDisplayModesForVideo(t *testing.T) {
	t.Parallel()
	cfg := defaultConfig()
	cfg.ImageFitMode = "contain"
	cfg.ImageRendering = "high-quality"
	req := backend.WallpaperRequest{
		MediaType: media.MediaTypeVideo,
		ImagePath: "/tmp/wall.mp4",
		Mode:      monitor.ModeClone,
	}

	loadReq, err := buildLoadRequest(req, cfg, nil)
	if err != nil {
		t.Fatalf("buildLoadRequest video: %v", err)
	}
	if loadReq.ImageFitMode != "" {
		t.Fatalf("video should not set image fit mode, got %q", loadReq.ImageFitMode)
	}
	if loadReq.ImageRendering != "" {
		t.Fatalf("video should not set image rendering, got %q", loadReq.ImageRendering)
	}
}
