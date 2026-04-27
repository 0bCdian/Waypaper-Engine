package handler

import (
	"context"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"waypaper-engine/daemon/internal/backend"
	"waypaper-engine/daemon/internal/media"
	"waypaper-engine/daemon/internal/monitor"
	"waypaper-engine/daemon/internal/store"
	"waypaper-engine/daemon/internal/testutil"
)

func TestRestoreWallpapers_ExtendGroup_VideoUsesClone(t *testing.T) {
	var saw *backend.WallpaperRequest
	mockBe := &testutil.MockBackend{
		SetWallpaperFn: func(_ context.Context, req backend.WallpaperRequest) error {
			cp := req
			saw = &cp
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
			return &store.Image{ID: id, MediaType: "video"}, nil
		},
	}

	RestoreWallpapers(context.Background(), mss, &testutil.MockStateStore{}, reg, &testutil.MockConfigManager{}, mm, imgStore, nil, nil)

	require.NotNil(t, saw)
	assert.Equal(t, monitor.ModeClone, saw.Mode)
	assert.Equal(t, media.MediaTypeVideo, saw.MediaType)
	assert.Len(t, saw.Monitors, 2)
}

func TestRestoreWallpapers_WaylandUtauriBatchesIndividualImageRows(t *testing.T) {
	var calls int
	var last backend.WallpaperRequest
	mockBe := &testutil.MockBackend{
		NameFn: func() string { return backend.WaylandUtauriBackendName },
		SetWallpaperFn: func(_ context.Context, req backend.WallpaperRequest) error {
			calls++
			last = req
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
			return &store.Image{ID: id, MediaType: "image"}, nil
		},
	}

	RestoreWallpapers(context.Background(), mss, &testutil.MockStateStore{}, reg, &testutil.MockConfigManager{}, mm, imgStore, nil, nil)

	assert.Equal(t, 1, calls, "wayland-utauri should receive one batched SetWallpaper")
	require.Len(t, last.IndividualTargets, 2)
	assert.Equal(t, "/a.png", last.IndividualTargets[0].Path)
	assert.Equal(t, "/b.png", last.IndividualTargets[1].Path)
	assert.True(t, last.WaitForCompletion)
}

func TestRestoreWallpapers_NonUtauriDoesNotBatchIndividualRows(t *testing.T) {
	var calls int
	mockBe := &testutil.MockBackend{
		NameFn: func() string { return "awww" },
		SetWallpaperFn: func(_ context.Context, _ backend.WallpaperRequest) error {
			calls++
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
			return &store.Image{ID: id, MediaType: "image"}, nil
		},
	}

	RestoreWallpapers(context.Background(), mss, &testutil.MockStateStore{}, reg, &testutil.MockConfigManager{}, mm, imgStore, nil, nil)

	assert.Equal(t, 2, calls)
}
