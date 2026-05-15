package hyprpaper

import (
	"context"
	"encoding/json"
	"testing"

	"waypaper-engine/daemon/internal/media"
	"waypaper-engine/daemon/internal/monitor"
	"waypaper-engine/daemon/internal/store"
	"waypaper-engine/daemon/internal/testutil"
)

func TestHyprpaperTryBatchRestore_requiresTwoOrMore(t *testing.T) {
	h := New().(*Hyprpaper)
	ctx := context.Background()
	s1 := store.MonitorState{MonitorName: "A", Mode: string(monitor.ModeIndividual), ImagePath: "/a.jpg"}
	connected := map[string]monitor.Monitor{"A": {Name: "A"}}

	req, statesOut, mts, ok := h.TryBatchRestore(ctx, []store.MonitorState{s1}, connected, &testutil.MockImageStore{})
	if ok || req != nil || statesOut != nil || mts != nil {
		t.Fatalf("expected false batch for single state, got ok=%v req=%v", ok, req)
	}
}

func TestHyprpaperTryBatchRestore_mergesTwoIndividuals(t *testing.T) {
	h := New().(*Hyprpaper)
	ctx := context.Background()
	stateA := store.MonitorState{
		MonitorName: "DP-1", Mode: string(monitor.ModeIndividual), ImagePath: "/x/a.jpg", ImageID: 1,
	}
	stateB := store.MonitorState{
		MonitorName: "DP-2", Mode: string(monitor.ModeIndividual), ImagePath: "/x/b.jpg", ImageID: 2,
	}
	connected := map[string]monitor.Monitor{
		"DP-1": {Name: "DP-1"},
		"DP-2": {Name: "DP-2"},
	}
	imgStore := &testutil.MockImageStore{
		GetByIDFn: func(ctx context.Context, id int) (*store.Image, error) {
			return &store.Image{ID: id, Path: stateA.ImagePath, MediaType: string(media.MediaTypeImage)}, nil
		},
	}

	req, statesOut, mediaTypes, ok := h.TryBatchRestore(ctx, []store.MonitorState{stateA, stateB}, connected, imgStore)
	if !ok || req == nil {
		t.Fatalf("expected batch ok, ok=%v req=%v", ok, req)
	}
	if len(req.IndividualTargets) != 2 {
		t.Fatalf("targets: %d", len(req.IndividualTargets))
	}
	if req.IndividualTargets[0].Path != "/x/a.jpg" || req.IndividualTargets[0].Monitor.Name != "DP-1" {
		t.Fatalf("target0: %+v", req.IndividualTargets[0])
	}
	if req.IndividualTargets[1].Path != "/x/b.jpg" || req.IndividualTargets[1].Monitor.Name != "DP-2" {
		t.Fatalf("target1: %+v", req.IndividualTargets[1])
	}
	if len(statesOut) != 2 || len(mediaTypes) != 2 {
		t.Fatalf("out lens states=%d mt=%d", len(statesOut), len(mediaTypes))
	}
}

// Regression: monitors with different per-image configs must still batch into one
// SetWallpaper call. Before the fix, the parallax/config equality check caused
// TryBatchRestore to return false, making restore.go issue per-monitor calls that
// each overwrote hyprpaper.conf — leaving only the last monitor set.
func TestHyprpaperTryBatchRestore_mergesDifferentImageConfigs(t *testing.T) {
	h := New().(*Hyprpaper)
	ctx := context.Background()
	stateA := store.MonitorState{
		MonitorName: "DP-1", Mode: string(monitor.ModeIndividual), ImagePath: "/x/a.jpg", ImageID: 1,
	}
	stateB := store.MonitorState{
		MonitorName: "DP-2", Mode: string(monitor.ModeIndividual), ImagePath: "/x/b.jpg", ImageID: 2,
	}
	connected := map[string]monitor.Monitor{
		"DP-1": {Name: "DP-1"},
		"DP-2": {Name: "DP-2"},
	}

	webMetaA := &store.WebMeta{WallpaperConfig: json.RawMessage(`{"fit":"cover"}`)}
	webMetaB := &store.WebMeta{WallpaperConfig: json.RawMessage(`{"fit":"contain"}`)}
	imgStore := &testutil.MockImageStore{
		GetByIDFn: func(ctx context.Context, id int) (*store.Image, error) {
			if id == 1 {
				return &store.Image{ID: 1, MediaType: string(media.MediaTypeImage), WebMeta: webMetaA}, nil
			}
			return &store.Image{ID: 2, MediaType: string(media.MediaTypeImage), WebMeta: webMetaB}, nil
		},
	}

	req, _, _, ok := h.TryBatchRestore(ctx, []store.MonitorState{stateA, stateB}, connected, imgStore)
	if !ok || req == nil {
		t.Fatal("expected batch ok even when image configs differ; hyprpaper does not use per-image config")
	}
	if len(req.IndividualTargets) != 2 {
		t.Fatalf("targets: %d", len(req.IndividualTargets))
	}
}

func TestHyprpaperTryBatchRestore_rejectsExtendMode(t *testing.T) {
	h := New().(*Hyprpaper)
	ctx := context.Background()
	s1 := store.MonitorState{MonitorName: "A", Mode: string(monitor.ModeExtend), ImagePath: "/a.jpg"}
	s2 := store.MonitorState{MonitorName: "B", Mode: string(monitor.ModeExtend), ImagePath: "/b.jpg"}
	connected := map[string]monitor.Monitor{"A": {Name: "A"}, "B": {Name: "B"}}

	_, _, _, ok := h.TryBatchRestore(ctx, []store.MonitorState{s1, s2}, connected, &testutil.MockImageStore{})
	if ok {
		t.Fatal("expected no batch for extend mode rows")
	}
}
