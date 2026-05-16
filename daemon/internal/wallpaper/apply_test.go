package wallpaper

import (
	"context"
	"encoding/json"
	"image"
	"image/color"
	"image/png"
	"os"
	"path/filepath"
	"testing"

	"github.com/spf13/viper"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"waypaper-engine/daemon/internal/backend"
	"waypaper-engine/daemon/internal/events"
	imgpkg "waypaper-engine/daemon/internal/image"
	"waypaper-engine/daemon/internal/monitor"
	"waypaper-engine/daemon/internal/store"
)

// ---------------------------------------------------------------------------
// Local mocks — testutil cannot be imported here because
// testutil → playlist → wallpaper would form an import cycle.
// ---------------------------------------------------------------------------

type mockBackend struct {
	nameFn         func() string
	capabilitiesFn func() backend.Capabilities
	applyFn        func(context.Context, backend.Snapshot) error
}

func (m *mockBackend) Name() string {
	if m.nameFn != nil {
		return m.nameFn()
	}
	return ""
}
func (m *mockBackend) IsAvailable() bool { return true }
func (m *mockBackend) Capabilities() backend.Capabilities {
	if m.capabilitiesFn != nil {
		return m.capabilitiesFn()
	}
	return backend.Capabilities{}
}
func (m *mockBackend) Initialize(context.Context) error { return nil }
func (m *mockBackend) Shutdown(context.Context) error   { return nil }
func (m *mockBackend) Apply(ctx context.Context, snap backend.Snapshot) error {
	if m.applyFn != nil {
		return m.applyFn(ctx, snap)
	}
	return nil
}
func (m *mockBackend) RegisterDefaults(*viper.Viper)          {}
func (m *mockBackend) ValidateConfig(_ json.RawMessage) error { return nil }

// applyAllKindsCaps returns a Capabilities that supports every content kind.
func applyAllKindsCaps() backend.Capabilities {
	return backend.Capabilities{
		ContentKinds: []backend.ContentKind{
			backend.KindStaticImage,
			backend.KindGIF,
			backend.KindVideo,
			backend.KindWebWallpaper,
		},
	}
}

type mockHistoryStore struct {
	appendFn func(context.Context, store.ImageHistoryEntry) (*store.ImageHistoryEntry, error)
}

func (m *mockHistoryStore) Append(ctx context.Context, e store.ImageHistoryEntry) (*store.ImageHistoryEntry, error) {
	if m.appendFn != nil {
		return m.appendFn(ctx, e)
	}
	return nil, nil
}
func (m *mockHistoryStore) GetRecent(context.Context, store.HistoryQueryOpts) ([]store.ImageHistoryEntry, error) {
	return nil, nil
}
func (m *mockHistoryStore) Count(context.Context) (int, error)                { return 0, nil }
func (m *mockHistoryStore) Clear(context.Context) error                       { return nil }
func (m *mockHistoryStore) DeleteByImageID(context.Context, int) (int, error) { return 0, nil }

type mockMonitorStateStore struct {
	setFn func(context.Context, store.MonitorState) error
}

func (m *mockMonitorStateStore) Get(context.Context, string) (*store.MonitorState, error) {
	return nil, nil
}
func (m *mockMonitorStateStore) GetAll(context.Context) ([]store.MonitorState, error) {
	return nil, nil
}
func (m *mockMonitorStateStore) Set(ctx context.Context, s store.MonitorState) error {
	if m.setFn != nil {
		return m.setFn(ctx, s)
	}
	return nil
}
func (m *mockMonitorStateStore) Remove(context.Context, string) error { return nil }

type mockStateStore struct {
	setCurrentWallpaperFn func(string, store.ImageHistoryEntry)
}

func (m *mockStateStore) GetActivePlaylists() map[int]store.ActivePlaylistInstance { return nil }
func (m *mockStateStore) GetActivePlaylistByID(int) *store.ActivePlaylistInstance  { return nil }
func (m *mockStateStore) GetActivePlaylistForMonitor(string) *store.ActivePlaylistInstance {
	return nil
}
func (m *mockStateStore) SetActivePlaylist(store.ActivePlaylistInstance) {}
func (m *mockStateStore) UpdateActivePlaylist(int, func(*store.ActivePlaylistInstance)) bool {
	return false
}
func (m *mockStateStore) RemoveActivePlaylist(int)                            {}
func (m *mockStateStore) RemoveAllActivePlaylists()                           {}
func (m *mockStateStore) GetCurrentWallpaper(string) *store.ImageHistoryEntry { return nil }
func (m *mockStateStore) SetCurrentWallpaper(mon string, entry store.ImageHistoryEntry) {
	if m.setCurrentWallpaperFn != nil {
		m.setCurrentWallpaperFn(mon, entry)
	}
}

type mockBus struct {
	publishFn func(events.Event)
}

func (m *mockBus) Publish(e events.Event) {
	if m.publishFn != nil {
		m.publishFn(e)
	}
}
func (m *mockBus) Subscribe(...events.EventType) <-chan events.Event { return nil }
func (m *mockBus) Unsubscribe(<-chan events.Event)                   {}
func (m *mockBus) Close()                                            {}

func writeTestPNG(t *testing.T, path string, w, h int) {
	t.Helper()
	rect := image.Rect(0, 0, w, h)
	img := image.NewRGBA(rect)
	for y := 0; y < h; y++ {
		for x := 0; x < w; x++ {
			img.Set(x, y, color.RGBA{R: uint8(x % 256), G: uint8(y % 256), B: 0, A: 255})
		}
	}
	f, err := os.Create(path)
	require.NoError(t, err)
	require.NoError(t, png.Encode(f, img))
	require.NoError(t, f.Close())
}

// ---------------------------------------------------------------------------
// Test fixture
// ---------------------------------------------------------------------------

type applyFixture struct {
	backend  *mockBackend
	history  *mockHistoryStore
	monState *mockMonitorStateStore
	state    *mockStateStore
	bus      *mockBus
	img      *store.Image
}

func newApplyFixture() *applyFixture {
	return &applyFixture{
		backend: &mockBackend{
			nameFn:         func() string { return "test" },
			capabilitiesFn: func() backend.Capabilities { return applyAllKindsCaps() },
			applyFn:        func(_ context.Context, _ backend.Snapshot) error { return nil },
		},
		history: &mockHistoryStore{
			appendFn: func(_ context.Context, e store.ImageHistoryEntry) (*store.ImageHistoryEntry, error) {
				e.ID = 1
				return &e, nil
			},
		},
		monState: &mockMonitorStateStore{
			setFn: func(_ context.Context, _ store.MonitorState) error { return nil },
		},
		state: &mockStateStore{
			setCurrentWallpaperFn: func(_ string, _ store.ImageHistoryEntry) {},
		},
		bus: &mockBus{},
		img: &store.Image{ID: 1, Name: "test.jpg", Path: "/tmp/test.jpg"},
	}
}

func (f *applyFixture) opts(mons []monitor.Monitor, mode monitor.MonitorMode) ApplyOpts {
	return ApplyOpts{
		Image:    f.img,
		Monitors: mons,
		Mode:     mode,
		Source:   store.HistorySource{Type: "manual"},
		Backend:  f.backend,
		History:  f.history,
		MonState: f.monState,
		State:    f.state,
		Bus:      f.bus,
	}
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

func TestApply_IndividualMode(t *testing.T) {
	f := newApplyFixture()
	var gotSnap backend.Snapshot
	f.backend.applyFn = func(_ context.Context, snap backend.Snapshot) error {
		gotSnap = snap
		return nil
	}

	mons := []monitor.Monitor{{Name: "HDMI-A-1", Width: 1920, Height: 1080}}
	err := Apply(context.Background(), f.opts(mons, monitor.ModeIndividual))
	require.NoError(t, err)
	require.Len(t, gotSnap.Outputs, 1)
	assert.Equal(t, "HDMI-A-1", gotSnap.Outputs[0].Monitor.Name)
	assert.Equal(t, "/tmp/test.jpg", gotSnap.Outputs[0].Content.Path())
}

func TestApply_CloneMode(t *testing.T) {
	f := newApplyFixture()
	var gotSnap backend.Snapshot
	f.backend.applyFn = func(_ context.Context, snap backend.Snapshot) error {
		gotSnap = snap
		return nil
	}

	mons := []monitor.Monitor{
		{Name: "HDMI-A-1", Width: 1920, Height: 1080},
		{Name: "eDP-1", Width: 1920, Height: 1080},
	}
	err := Apply(context.Background(), f.opts(mons, monitor.ModeClone))
	require.NoError(t, err)
	require.Len(t, gotSnap.Outputs, 2)
	// Same path on both monitors (clone).
	assert.Equal(t, "/tmp/test.jpg", gotSnap.Outputs[0].Content.Path())
	assert.Equal(t, "/tmp/test.jpg", gotSnap.Outputs[1].Content.Path())
}

func TestApply_ExtendMode_SingleMonitor_UsesExtend(t *testing.T) {
	f := newApplyFixture()
	var gotSnap backend.Snapshot
	f.backend.applyFn = func(_ context.Context, snap backend.Snapshot) error {
		gotSnap = snap
		return nil
	}

	mons := []monitor.Monitor{{Name: "HDMI-A-1", Width: 1920, Height: 1080}}
	opts := f.opts(mons, monitor.ModeExtend)
	opts.Splitter = imgpkg.NewSplitter(t.TempDir())
	err := Apply(context.Background(), opts)
	require.NoError(t, err)
	// Single monitor extend: no split, same path.
	require.Len(t, gotSnap.Outputs, 1)
	assert.Equal(t, "HDMI-A-1", gotSnap.Outputs[0].Monitor.Name)
}

func TestApply_ExtendMode_MultiImage_WithSplitter_UsesIndividualPerMonitor(t *testing.T) {
	f := newApplyFixture()
	dir := t.TempDir()
	src := filepath.Join(dir, "src.png")
	writeTestPNG(t, src, 400, 200)
	f.img.Path = src
	f.img.ID = 99
	f.img.MediaType = "image"

	splitter := imgpkg.NewSplitter(dir)
	mons := []monitor.Monitor{
		{Name: "m1", X: 0, Y: 0, Width: 200, Height: 100, Scale: 1},
		{Name: "m2", X: 200, Y: 0, Width: 200, Height: 100, Scale: 1},
	}
	var gotSnap backend.Snapshot
	f.backend.applyFn = func(_ context.Context, snap backend.Snapshot) error {
		gotSnap = snap
		return nil
	}
	opts := f.opts(mons, monitor.ModeExtend)
	opts.Splitter = splitter
	err := Apply(context.Background(), opts)
	require.NoError(t, err)
	require.Len(t, gotSnap.Outputs, 2)
	// Split images: paths must differ from the source.
	assert.NotEqual(t, src, gotSnap.Outputs[0].Content.Path())
	assert.NotEqual(t, src, gotSnap.Outputs[1].Content.Path())
}

func testExtendInteractiveUsesClone(t *testing.T, mediaType string) {
	t.Helper()
	f := newApplyFixture()
	f.img.MediaType = mediaType
	var gotSnap backend.Snapshot
	f.backend.applyFn = func(_ context.Context, snap backend.Snapshot) error {
		gotSnap = snap
		return nil
	}
	mons := []monitor.Monitor{
		{Name: "HDMI-A-1", Width: 1920, Height: 1080},
		{Name: "eDP-1", Width: 1920, Height: 1080},
	}
	err := Apply(context.Background(), f.opts(mons, monitor.ModeExtend))
	require.NoError(t, err)
	// Non-image extend degrades to clone: same path on both monitors.
	require.Len(t, gotSnap.Outputs, 2)
	assert.Equal(t, gotSnap.Outputs[0].Content.Path(), gotSnap.Outputs[1].Content.Path())
}

func TestApply_ExtendMode_VideoUsesClone(t *testing.T) {
	testExtendInteractiveUsesClone(t, "video")
}

func TestApply_ExtendMode_WebUsesClone(t *testing.T) {
	// Web wallpapers need WebMeta to build content.
	f := newApplyFixture()
	f.img.MediaType = "web"
	f.img.WebMeta = &store.WebMeta{ManifestPath: "/w.json", PackageRoot: "/w"}
	var gotSnap backend.Snapshot
	f.backend.applyFn = func(_ context.Context, snap backend.Snapshot) error {
		gotSnap = snap
		return nil
	}
	mons := []monitor.Monitor{
		{Name: "HDMI-A-1", Width: 1920, Height: 1080},
		{Name: "eDP-1", Width: 1920, Height: 1080},
	}
	err := Apply(context.Background(), f.opts(mons, monitor.ModeExtend))
	require.NoError(t, err)
	require.Len(t, gotSnap.Outputs, 2)
}

func TestApply_ExtendMode_GIFUsesClone(t *testing.T) {
	testExtendInteractiveUsesClone(t, "gif")
}

func TestApply_ExtendMode_VideoClone_StillRecordsExtendInHistoryAndState(t *testing.T) {
	f := newApplyFixture()
	f.img.MediaType = "video"
	var hist store.ImageHistoryEntry
	f.history.appendFn = func(_ context.Context, e store.ImageHistoryEntry) (*store.ImageHistoryEntry, error) {
		hist = e
		e.ID = 1
		return &e, nil
	}
	var states []store.MonitorState
	f.monState.setFn = func(_ context.Context, s store.MonitorState) error {
		states = append(states, s)
		return nil
	}
	mons := []monitor.Monitor{
		{Name: "HDMI-A-1", Width: 1920, Height: 1080},
		{Name: "eDP-1", Width: 1920, Height: 1080},
	}
	err := Apply(context.Background(), f.opts(mons, monitor.ModeExtend))
	require.NoError(t, err)
	assert.Equal(t, "extend", hist.Mode)
	require.Len(t, states, 2)
	for _, s := range states {
		assert.Equal(t, "extend", s.Mode)
	}
}

func TestApply_ExtendMode_NilSplitter(t *testing.T) {
	f := newApplyFixture()
	var gotSnap backend.Snapshot
	f.backend.applyFn = func(_ context.Context, snap backend.Snapshot) error {
		gotSnap = snap
		return nil
	}

	mons := []monitor.Monitor{
		{Name: "HDMI-A-1", Width: 1920, Height: 1080},
		{Name: "eDP-1", Width: 1920, Height: 1080},
	}
	opts := f.opts(mons, monitor.ModeExtend)
	opts.Splitter = nil
	err := Apply(context.Background(), opts)
	require.NoError(t, err)
	// No splitter → no split → both monitors get same path.
	require.Len(t, gotSnap.Outputs, 2)
}

func TestApply_RecordsHistory(t *testing.T) {
	f := newApplyFixture()
	var recorded bool
	f.history.appendFn = func(_ context.Context, e store.ImageHistoryEntry) (*store.ImageHistoryEntry, error) {
		recorded = true
		assert.Equal(t, 1, e.ImageID)
		assert.Equal(t, "test.jpg", e.ImageName)
		assert.Equal(t, []string{"HDMI-A-1"}, e.Monitors)
		assert.Equal(t, "individual", e.Mode)
		assert.Equal(t, "test", e.Backend)
		e.ID = 1
		return &e, nil
	}

	mons := []monitor.Monitor{{Name: "HDMI-A-1", Width: 1920, Height: 1080}}
	err := Apply(context.Background(), f.opts(mons, monitor.ModeIndividual))
	require.NoError(t, err)
	assert.True(t, recorded, "History.Append should have been called")
}

func TestApply_PersistsMonitorState(t *testing.T) {
	f := newApplyFixture()
	var setCalls []string
	f.monState.setFn = func(_ context.Context, s store.MonitorState) error {
		setCalls = append(setCalls, s.MonitorName)
		assert.Equal(t, 1, s.ImageID)
		assert.Equal(t, "test", s.Backend)
		return nil
	}

	mons := []monitor.Monitor{
		{Name: "HDMI-A-1", Width: 1920, Height: 1080},
		{Name: "eDP-1", Width: 1920, Height: 1080},
	}
	err := Apply(context.Background(), f.opts(mons, monitor.ModeClone))
	require.NoError(t, err)
	assert.ElementsMatch(t, []string{"HDMI-A-1", "eDP-1"}, setCalls)
}

func TestApply_PublishesEvent(t *testing.T) {
	f := newApplyFixture()
	var published bool
	f.bus.publishFn = func(e events.Event) {
		if e.Type != events.WallpaperChanged {
			return
		}
		published = true
		data, ok := e.Data.(map[string]any)
		require.True(t, ok)
		assert.Equal(t, 1, data["image_id"])
		assert.Equal(t, "image", data["media_type"])
		assert.Equal(t, "/tmp/test.jpg", data["path"])
		tags, ok := data["tags"].([]string)
		require.True(t, ok)
		assert.Empty(t, tags)
		assert.Equal(t, "test", data["backend"])
		_, hasColors := data["colors"]
		assert.False(t, hasColors)
	}

	mons := []monitor.Monitor{{Name: "HDMI-A-1", Width: 1920, Height: 1080}}
	err := Apply(context.Background(), f.opts(mons, monitor.ModeIndividual))
	require.NoError(t, err)
	assert.True(t, published, "Bus.Publish should have been called")
}

func TestApply_PublishesEvent_ColorsAndWebMediaType(t *testing.T) {
	f := newApplyFixture()
	f.img.Colors = []string{"#aabbcc", "#112233"}
	f.img.MediaType = "web"
	f.img.WebMeta = &store.WebMeta{ManifestPath: "/w.json", PackageRoot: "/w"}
	var saw map[string]any
	f.bus.publishFn = func(e events.Event) {
		if e.Type != events.WallpaperChanged {
			return
		}
		data, ok := e.Data.(map[string]any)
		require.True(t, ok)
		saw = data
	}
	mons := []monitor.Monitor{{Name: "HDMI-A-1", Width: 1920, Height: 1080}}
	err := Apply(context.Background(), f.opts(mons, monitor.ModeIndividual))
	require.NoError(t, err)
	require.NotNil(t, saw)
	assert.Equal(t, "web", saw["media_type"])
	colors, ok := saw["colors"].([]string)
	require.True(t, ok)
	assert.Equal(t, []string{"#aabbcc", "#112233"}, colors)
}

func TestApply_PublishesEvent_Tags(t *testing.T) {
	f := newApplyFixture()
	f.img.Tags = []string{"nature", "blue"}
	f.bus.publishFn = func(e events.Event) {
		if e.Type != events.WallpaperChanged {
			return
		}
		data, ok := e.Data.(map[string]any)
		require.True(t, ok)
		tags, ok := data["tags"].([]string)
		require.True(t, ok)
		assert.Equal(t, []string{"nature", "blue"}, tags)
	}
	mons := []monitor.Monitor{{Name: "HDMI-A-1", Width: 1920, Height: 1080}}
	err := Apply(context.Background(), f.opts(mons, monitor.ModeIndividual))
	require.NoError(t, err)
}

func TestApply_NilBus(t *testing.T) {
	f := newApplyFixture()
	mons := []monitor.Monitor{{Name: "HDMI-A-1", Width: 1920, Height: 1080}}
	opts := f.opts(mons, monitor.ModeIndividual)
	opts.Bus = nil

	require.NotPanics(t, func() {
		err := Apply(context.Background(), opts)
		require.NoError(t, err)
	})
}
