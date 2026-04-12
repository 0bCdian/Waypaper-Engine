package handler

import (
	"encoding/json"
	"testing"
	"time"

	"waypaper-engine/daemon/internal/store"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestBuildWallpaperCurrentResponse_empty(t *testing.T) {
	got := buildWallpaperCurrentResponse("awww", nil, nil)
	assert.Equal(t, "awww", got.Backend)
	assert.Empty(t, got.Monitors)
	assert.NotNil(t, got.Monitors, "empty slice, not nil — JSON must be [] not null")
	assert.True(t, got.SetAt.IsZero())

	got2 := buildWallpaperCurrentResponse("awww", []store.MonitorState{}, nil)
	assert.Empty(t, got2.Monitors)
	assert.NotNil(t, got2.Monitors)

	raw, err := json.Marshal(buildWallpaperCurrentResponse("wayland-utauri", nil, nil))
	require.NoError(t, err)
	assert.Contains(t, string(raw), `"monitors":[]`)
}

func TestBuildWallpaperCurrentResponse_filtersOtherBackend(t *testing.T) {
	t1 := time.Date(2026, 4, 12, 12, 0, 0, 0, time.UTC)
	t2 := time.Date(2026, 4, 1, 12, 0, 0, 0, time.UTC)
	states := []store.MonitorState{
		{MonitorName: "DP-1", ImageID: 1, ImageName: "a", ImagePath: "/a", Mode: "clone", Backend: "awww", SetAt: t1},
		{MonitorName: "old", ImageID: 2, ImageName: "b", ImagePath: "/b", Mode: "extend", Backend: "wayland-utauri", SetAt: t2},
	}
	got := buildWallpaperCurrentResponse("awww", states, nil)
	assert.Len(t, got.Monitors, 1)
	assert.Equal(t, "DP-1", got.Monitors[0].MonitorName)
	assert.Equal(t, 1, got.ImageID)
	assert.Equal(t, "clone", got.Mode)
	assert.Equal(t, t1, got.SetAt)
}

func TestBuildWallpaperCurrentResponse_multiMonitor_sorted(t *testing.T) {
	ts := time.Date(2026, 4, 12, 12, 0, 0, 0, time.UTC)
	states := []store.MonitorState{
		{MonitorName: "Z-1", ImageID: 9, ImageName: "z", ImagePath: "/z", Mode: "clone", Backend: "feh", SetAt: ts},
		{MonitorName: "A-1", ImageID: 9, ImageName: "z", ImagePath: "/z", Mode: "clone", Backend: "feh", SetAt: ts},
	}
	got := buildWallpaperCurrentResponse("feh", states, nil)
	assert.Equal(t, []string{"A-1", "Z-1"}, []string{got.Monitors[0].MonitorName, got.Monitors[1].MonitorName})
	assert.Equal(t, 9, got.ImageID)
}

func TestBuildWallpaperCurrentResponse_primaryNewestSetAt(t *testing.T) {
	old := time.Date(2026, 4, 1, 12, 0, 0, 0, time.UTC)
	newer := time.Date(2026, 4, 12, 12, 0, 0, 0, time.UTC)
	states := []store.MonitorState{
		{MonitorName: "M-A", ImageID: 1, ImageName: "old", ImagePath: "/1", Mode: "individual", Backend: "awww", SetAt: old},
		{MonitorName: "M-B", ImageID: 2, ImageName: "new", ImagePath: "/2", Mode: "individual", Backend: "awww", SetAt: newer},
	}
	got := buildWallpaperCurrentResponse("awww", states, nil)
	assert.Equal(t, 2, got.ImageID)
	assert.Equal(t, "new", got.ImageName)
	assert.Equal(t, newer, got.SetAt)
}

func TestBuildWallpaperCurrentResponse_connectedNamesFilter(t *testing.T) {
	ts := time.Date(2026, 4, 12, 12, 0, 0, 0, time.UTC)
	states := []store.MonitorState{
		{MonitorName: "DP-1", ImageID: 501, ImageName: "cur", ImagePath: "/c", Mode: "clone", Backend: "wayland-utauri", SetAt: ts},
		{MonitorName: "Monitor 0", ImageID: 69, ImageName: "old", ImagePath: "/o", Mode: "clone", Backend: "wayland-utauri", SetAt: ts.Add(-time.Hour)},
	}
	connected := map[string]struct{}{"DP-1": {}, "HDMI-A-1": {}}
	got := buildWallpaperCurrentResponse("wayland-utauri", states, connected)
	assert.Len(t, got.Monitors, 1)
	assert.Equal(t, "DP-1", got.Monitors[0].MonitorName)
	assert.Equal(t, 501, got.ImageID)
}
