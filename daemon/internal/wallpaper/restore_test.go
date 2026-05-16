package wallpaper_test

import (
	"context"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"waypaper-engine/daemon/internal/backend"
	"waypaper-engine/daemon/internal/monitor"
	"waypaper-engine/daemon/internal/store"
	"waypaper-engine/daemon/internal/testutil"
	"waypaper-engine/daemon/internal/wallpaper"
)

// TestRestore_ExtendGroup_VideoUsesClone verifies that a video image persisted
// in extend mode is restored using clone semantics (same path on both monitors)
// since the Apply flow degrades non-image extend to clone.
func TestRestore_ExtendGroup_VideoUsesClone(t *testing.T) {
	var gotSnap backend.Snapshot
	mockBe := &testutil.MockBackend{
		CapabilitiesFn: func() backend.Capabilities {
			return backend.Capabilities{
				ContentKinds: []backend.ContentKind{backend.KindVideo},
			}
		},
		ApplyFn: func(_ context.Context, snap backend.Snapshot) error {
			gotSnap = snap
			return nil
		},
	}
	reg := &testutil.MockRegistry{
		ActiveFn: func() backend.Backend { return mockBe },
	}
	mss := &testutil.MockMonitorStateStore{
		GetAllFn: func(context.Context) ([]store.MonitorState, error) {
			return []store.MonitorState{
				{MonitorName: "A", ImageID: 1, ImagePath: "/x.mp4", Mode: "extend"},
				{MonitorName: "B", ImageID: 1, ImagePath: "/x.mp4", Mode: "extend"},
			}, nil
		},
	}
	mm := &testutil.MockMonitorManager{
		GetMonitorsFn: func(context.Context) ([]monitor.Monitor, error) {
			return []monitor.Monitor{{Name: "A"}, {Name: "B"}}, nil
		},
	}
	imgStore := &testutil.MockImageStore{
		GetByIDFn: func(_ context.Context, id int) (*store.Image, error) {
			// Return a video image with a real path so os.Stat doesn't trigger cascade.
			// Use /dev/null as a stand-in for a file that exists.
			return &store.Image{ID: id, MediaType: "video", Path: "/dev/null"}, nil
		},
	}

	wallpaper.Restore(context.Background(), mss, &testutil.MockStateStore{}, reg, &testutil.MockConfigManager{}, mm, imgStore, nil, nil)

	// Both monitors should be in the snapshot with video content at the same path.
	require.Len(t, gotSnap.Outputs, 2)
	assert.Equal(t, gotSnap.Outputs[0].Content.Path(), gotSnap.Outputs[1].Content.Path())
	_, isVideo := gotSnap.Outputs[0].Content.(backend.Video)
	assert.True(t, isVideo, "content should be Video")
}

// TestRestore_TwoIndividualImageRows verifies two monitors with different images
// are both included in a single Apply call.
func TestRestore_TwoIndividualImageRows(t *testing.T) {
	var gotSnap backend.Snapshot
	mockBe := &testutil.MockBackend{
		CapabilitiesFn: func() backend.Capabilities {
			return backend.Capabilities{
				ContentKinds: []backend.ContentKind{backend.KindStaticImage},
			}
		},
		ApplyFn: func(_ context.Context, snap backend.Snapshot) error {
			gotSnap = snap
			return nil
		},
	}
	reg := &testutil.MockRegistry{ActiveFn: func() backend.Backend { return mockBe }}
	mss := &testutil.MockMonitorStateStore{
		GetAllFn: func(context.Context) ([]store.MonitorState, error) {
			return []store.MonitorState{
				{MonitorName: "A", ImageID: 1, ImagePath: "/a.png", Mode: string(monitor.ModeIndividual)},
				{MonitorName: "B", ImageID: 2, ImagePath: "/b.png", Mode: string(monitor.ModeIndividual)},
			}, nil
		},
	}
	mm := &testutil.MockMonitorManager{
		GetMonitorsFn: func(context.Context) ([]monitor.Monitor, error) {
			return []monitor.Monitor{{Name: "A"}, {Name: "B"}}, nil
		},
	}
	imgStore := &testutil.MockImageStore{
		GetByIDFn: func(_ context.Context, id int) (*store.Image, error) {
			path := "/a.png"
			if id == 2 {
				path = "/b.png"
			}
			// Use /dev/null for stat to succeed.
			_ = path
			return &store.Image{ID: id, MediaType: "image", Path: "/dev/null"}, nil
		},
	}

	wallpaper.Restore(context.Background(), mss, &testutil.MockStateStore{}, reg, &testutil.MockConfigManager{}, mm, imgStore, nil, nil)

	// Both monitors should be included in one Apply call.
	assert.Len(t, gotSnap.Outputs, 2)
}

// TestRestore_SkipsDisconnectedMonitors verifies that persisted state for monitors
// not in the connected set is excluded from the snapshot.
func TestRestore_SkipsDisconnectedMonitors(t *testing.T) {
	var gotSnap backend.Snapshot
	mockBe := &testutil.MockBackend{
		CapabilitiesFn: func() backend.Capabilities {
			return backend.Capabilities{
				ContentKinds: []backend.ContentKind{backend.KindStaticImage},
			}
		},
		ApplyFn: func(_ context.Context, snap backend.Snapshot) error {
			gotSnap = snap
			return nil
		},
	}
	reg := &testutil.MockRegistry{ActiveFn: func() backend.Backend { return mockBe }}
	mss := &testutil.MockMonitorStateStore{
		GetAllFn: func(context.Context) ([]store.MonitorState, error) {
			return []store.MonitorState{
				{MonitorName: "A", ImageID: 1, ImagePath: "/a.png", Mode: string(monitor.ModeIndividual)},
				{MonitorName: "B", ImageID: 2, ImagePath: "/b.png", Mode: string(monitor.ModeIndividual)},
			}, nil
		},
	}
	mm := &testutil.MockMonitorManager{
		// Only monitor A is connected.
		GetMonitorsFn: func(context.Context) ([]monitor.Monitor, error) {
			return []monitor.Monitor{{Name: "A"}}, nil
		},
	}
	imgStore := &testutil.MockImageStore{
		GetByIDFn: func(_ context.Context, id int) (*store.Image, error) {
			return &store.Image{ID: id, MediaType: "image", Path: "/dev/null"}, nil
		},
	}

	wallpaper.Restore(context.Background(), mss, &testutil.MockStateStore{}, reg, &testutil.MockConfigManager{}, mm, imgStore, nil, nil)

	require.Len(t, gotSnap.Outputs, 1)
	assert.Equal(t, "A", gotSnap.Outputs[0].Monitor.Name)
}
