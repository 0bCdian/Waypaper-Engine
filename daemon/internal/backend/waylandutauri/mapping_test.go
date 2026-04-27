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

	loadReq, err := buildLoadRequest(req, cfg)
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

	loadReq, err := buildLoadRequest(req, cfg)
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

func TestBuildLoadRequest_individualUsesCompositorNames(t *testing.T) {
	t.Parallel()
	cfg := defaultConfig()
	req := backend.WallpaperRequest{
		MediaType: media.MediaTypeImage,
		ImagePath: "/tmp/wall.png",
		Mode:      monitor.ModeIndividual,
		Monitors: []monitor.Monitor{
			{Name: "HDMI-A-1", Width: 1920, Height: 1080},
			{Name: "  eDP-1  ", Width: 1920, Height: 1080},
		},
	}
	loadReq, err := buildLoadRequest(req, cfg)
	if err != nil {
		t.Fatal(err)
	}
	if len(loadReq.Targets) != 2 {
		t.Fatalf("targets: got %d", len(loadReq.Targets))
	}
	if loadReq.Targets[0].Name != "HDMI-A-1" || loadReq.Targets[0].Target != "/tmp/wall.png" {
		t.Fatalf("target[0]: %+v", loadReq.Targets[0])
	}
	if loadReq.Targets[1].Name != "eDP-1" || loadReq.Targets[1].Target != "/tmp/wall.png" {
		t.Fatalf("target[1]: %+v", loadReq.Targets[1])
	}
	if loadReq.Targets[0].Kind != "image" || loadReq.Targets[1].Kind != "image" {
		t.Fatalf("expected per-target kind image for image wallpaper, got %#v, %#v", loadReq.Targets[0].Kind, loadReq.Targets[1].Kind)
	}
}

func TestBuildLoadRequest_individualVideoSetsKindPerTarget(t *testing.T) {
	t.Parallel()
	cfg := defaultConfig()
	req := backend.WallpaperRequest{
		MediaType: media.MediaTypeVideo,
		ImagePath: "/tmp/wall.mp4",
		Mode:      monitor.ModeIndividual,
		Monitors: []monitor.Monitor{
			{Name: "HDMI-A-1", Width: 1920, Height: 1080},
		},
	}
	loadReq, err := buildLoadRequest(req, cfg)
	if err != nil {
		t.Fatal(err)
	}
	if len(loadReq.Targets) != 1 {
		t.Fatalf("targets: got %d", len(loadReq.Targets))
	}
	if loadReq.Targets[0].Kind != "video" {
		t.Fatalf("expected per-target kind video, got %q", loadReq.Targets[0].Kind)
	}
}

func TestBuildLoadRequest_waitForCompletionPassesThrough(t *testing.T) {
	t.Parallel()
	cfg := defaultConfig()
	req := backend.WallpaperRequest{
		MediaType:         media.MediaTypeImage,
		ImagePath:         "/tmp/wall.png",
		Mode:              monitor.ModeIndividual,
		WaitForCompletion: true,
		Monitors: []monitor.Monitor{
			{Name: "HDMI-A-1"},
		},
	}
	loadReq, err := buildLoadRequest(req, cfg)
	if err != nil {
		t.Fatal(err)
	}
	if !loadReq.WaitForCompletion {
		t.Fatal("expected WaitForCompletion true on load request")
	}
}
