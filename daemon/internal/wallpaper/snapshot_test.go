package wallpaper

import (
	"context"
	"encoding/json"
	"errors"
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
// Local mocks (import cycle: testutil → playlist → wallpaper)
// ---------------------------------------------------------------------------

type snapshotMockBackend struct {
	caps backend.Capabilities
}

func (m *snapshotMockBackend) Name() string                                  { return "mock" }
func (m *snapshotMockBackend) IsAvailable() bool                             { return true }
func (m *snapshotMockBackend) Capabilities() backend.Capabilities            { return m.caps }
func (m *snapshotMockBackend) Initialize(context.Context) error              { return nil }
func (m *snapshotMockBackend) Shutdown(context.Context) error                { return nil }
func (m *snapshotMockBackend) RegisterDefaults(*viper.Viper)                 {}
func (m *snapshotMockBackend) ValidateConfig(json.RawMessage) error          { return nil }
func (m *snapshotMockBackend) Apply(context.Context, backend.Snapshot) error { return nil }

// snapshotMockImageStore implements store.ImageStore for snapshot tests.
type snapshotMockImageStore struct {
	images map[int]*store.Image
}

func newMockImageStore(imgs ...*store.Image) *snapshotMockImageStore {
	m := &snapshotMockImageStore{images: make(map[int]*store.Image)}
	for _, img := range imgs {
		m.images[img.ID] = img
	}
	return m
}

func (m *snapshotMockImageStore) GetByID(_ context.Context, id int) (*store.Image, error) {
	if img, ok := m.images[id]; ok {
		return img, nil
	}
	return nil, store.ErrNotFound
}
func (m *snapshotMockImageStore) GetAll(context.Context, store.ImageQueryOpts) (*store.PaginatedResult[store.Image], error) {
	return nil, nil
}
func (m *snapshotMockImageStore) Create(context.Context, []store.Image) ([]store.Image, error) {
	return nil, nil
}
func (m *snapshotMockImageStore) Update(context.Context, int, map[string]any) (*store.Image, error) {
	return nil, nil
}
func (m *snapshotMockImageStore) Delete(context.Context, []int) (int, error) { return 0, nil }
func (m *snapshotMockImageStore) UpdateAll(context.Context, map[string]any) (int, error) {
	return 0, nil
}
func (m *snapshotMockImageStore) GetAllTags(context.Context) ([]string, error) { return nil, nil }
func (m *snapshotMockImageStore) Count(context.Context) (int, error)           { return 0, nil }
func (m *snapshotMockImageStore) IsNameTaken(context.Context, string, int) (bool, error) {
	return false, nil
}

// snapshotMockMonitorStateStore tracks Remove calls.
type snapshotMockMonitorStateStore struct {
	removed []string
}

func (m *snapshotMockMonitorStateStore) Get(context.Context, string) (*store.MonitorState, error) {
	return nil, nil
}
func (m *snapshotMockMonitorStateStore) GetAll(context.Context) ([]store.MonitorState, error) {
	return nil, nil
}
func (m *snapshotMockMonitorStateStore) Set(context.Context, store.MonitorState) error { return nil }
func (m *snapshotMockMonitorStateStore) Remove(_ context.Context, name string) error {
	m.removed = append(m.removed, name)
	return nil
}

// snapshotMockHistoryStore counts DeleteByImageID calls.
type snapshotMockHistoryStore struct {
	deletedByImageID []int
}

func (m *snapshotMockHistoryStore) Append(context.Context, store.ImageHistoryEntry) (*store.ImageHistoryEntry, error) {
	return nil, nil
}
func (m *snapshotMockHistoryStore) GetRecent(context.Context, store.HistoryQueryOpts) ([]store.ImageHistoryEntry, error) {
	return nil, nil
}
func (m *snapshotMockHistoryStore) Count(context.Context) (int, error) { return 0, nil }
func (m *snapshotMockHistoryStore) Clear(context.Context) error        { return nil }
func (m *snapshotMockHistoryStore) DeleteByImageID(_ context.Context, id int) (int, error) {
	m.deletedByImageID = append(m.deletedByImageID, id)
	return 0, nil
}

// snapshotMockPlaylistStore does nothing.
type snapshotMockPlaylistStore struct{}

func (m *snapshotMockPlaylistStore) GetAll(context.Context) ([]store.Playlist, error) {
	return nil, nil
}
func (m *snapshotMockPlaylistStore) GetByID(context.Context, int) (*store.Playlist, error) {
	return nil, nil
}
func (m *snapshotMockPlaylistStore) Create(context.Context, store.Playlist) (*store.Playlist, error) {
	return nil, nil
}
func (m *snapshotMockPlaylistStore) Update(context.Context, int, map[string]any) (*store.Playlist, error) {
	return nil, nil
}
func (m *snapshotMockPlaylistStore) SavePlaybackState(context.Context, int, *store.PlaylistPlayback) error {
	return nil
}
func (m *snapshotMockPlaylistStore) Delete(context.Context, int) error  { return nil }
func (m *snapshotMockPlaylistStore) Count(context.Context) (int, error) { return 0, nil }

// snapshotMockBus records published events.
type snapshotMockBus struct {
	events []events.Event
}

func (m *snapshotMockBus) Publish(ev events.Event)                           { m.events = append(m.events, ev) }
func (m *snapshotMockBus) Subscribe(...events.EventType) <-chan events.Event { return nil }
func (m *snapshotMockBus) Unsubscribe(<-chan events.Event)                   {}
func (m *snapshotMockBus) Close()                                            {}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

func writeTempPNG(t *testing.T, dir string, name string) string {
	t.Helper()
	path := filepath.Join(dir, name)
	f, err := os.Create(path)
	require.NoError(t, err)
	img := image.NewNRGBA(image.Rect(0, 0, 100, 100))
	img.Set(0, 0, color.RGBA{255, 0, 0, 255})
	require.NoError(t, png.Encode(f, img))
	require.NoError(t, f.Close())
	return path
}

func makeConnected(mons ...monitor.Monitor) map[string]monitor.Monitor {
	m := make(map[string]monitor.Monitor, len(mons))
	for _, mon := range mons {
		m[mon.Name] = mon
	}
	return m
}

func staticOnlyCaps() backend.Capabilities {
	return backend.Capabilities{ContentKinds: []backend.ContentKind{backend.KindStaticImage}}
}

func allKindsCaps() backend.Capabilities {
	return backend.Capabilities{ContentKinds: []backend.ContentKind{
		backend.KindStaticImage,
		backend.KindGIF,
		backend.KindVideo,
		backend.KindWebWallpaper,
	}}
}

func callBuildSnapshot(
	ctx context.Context,
	states []store.MonitorState,
	connected map[string]monitor.Monitor,
	imageStore store.ImageStore,
	splitter *imgpkg.Splitter,
	ab backend.Backend,
	monStateStore store.MonitorStateStore,
	histStore store.HistoryStore,
	playlistStore store.PlaylistStore,
	bus events.Bus,
	videoAudioDefault bool,
) (backend.Snapshot, []SkipReason, error) {
	return BuildSnapshot(ctx, states, connected, imageStore, splitter, ab,
		monStateStore, histStore, playlistStore, bus, videoAudioDefault)
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

func TestBuildSnapshot_SingleStaticClone1Monitor(t *testing.T) {
	dir := t.TempDir()
	imgPath := writeTempPNG(t, dir, "img.png")

	img := &store.Image{ID: 1, Path: imgPath, MediaType: "image"}
	mon1 := monitor.Monitor{Name: "DP-1", Width: 1920, Height: 1080}
	states := []store.MonitorState{
		{MonitorName: "DP-1", ImageID: 1, Mode: "clone"},
	}

	snap, skips, err := callBuildSnapshot(
		context.Background(), states, makeConnected(mon1),
		newMockImageStore(img), nil,
		&snapshotMockBackend{caps: staticOnlyCaps()},
		&snapshotMockMonitorStateStore{}, &snapshotMockHistoryStore{}, &snapshotMockPlaylistStore{},
		nil, false,
	)

	require.NoError(t, err)
	assert.Empty(t, skips)
	require.Len(t, snap.Outputs, 1)
	assert.Equal(t, "DP-1", snap.Outputs[0].Monitor.Name)
	si, ok := snap.Outputs[0].Content.(backend.StaticImage)
	require.True(t, ok)
	assert.Equal(t, imgPath, si.Path_)
}

func TestBuildSnapshot_CloneWith2Monitors(t *testing.T) {
	dir := t.TempDir()
	imgPath := writeTempPNG(t, dir, "img.png")

	img := &store.Image{ID: 1, Path: imgPath, MediaType: "image"}
	mon1 := monitor.Monitor{Name: "DP-1", Width: 1920, Height: 1080}
	mon2 := monitor.Monitor{Name: "DP-2", Width: 1920, Height: 1080, X: 1920}
	states := []store.MonitorState{
		{MonitorName: "DP-1", ImageID: 1, Mode: "clone"},
		{MonitorName: "DP-2", ImageID: 1, Mode: "clone"},
	}

	snap, skips, err := callBuildSnapshot(
		context.Background(), states, makeConnected(mon1, mon2),
		newMockImageStore(img), nil,
		&snapshotMockBackend{caps: staticOnlyCaps()},
		&snapshotMockMonitorStateStore{}, &snapshotMockHistoryStore{}, &snapshotMockPlaylistStore{},
		nil, false,
	)

	require.NoError(t, err)
	assert.Empty(t, skips)
	require.Len(t, snap.Outputs, 2)
	for _, out := range snap.Outputs {
		si, ok := out.Content.(backend.StaticImage)
		require.True(t, ok)
		assert.Equal(t, imgPath, si.Path_)
	}
}

func TestBuildSnapshot_ExtendStaticImage2Monitors(t *testing.T) {
	dir := t.TempDir()
	imgPath := writeTempPNG(t, dir, "img.png")

	img := &store.Image{ID: 2, Path: imgPath, MediaType: "image"}
	mon1 := monitor.Monitor{Name: "DP-1", Width: 1920, Height: 1080, X: 0, Scale: 1}
	mon2 := monitor.Monitor{Name: "DP-2", Width: 1920, Height: 1080, X: 1920, Scale: 1}
	states := []store.MonitorState{
		{MonitorName: "DP-1", ImageID: 2, Mode: "extend"},
		{MonitorName: "DP-2", ImageID: 2, Mode: "extend"},
	}

	splitter := imgpkg.NewSplitter(dir)

	snap, skips, err := callBuildSnapshot(
		context.Background(), states, makeConnected(mon1, mon2),
		newMockImageStore(img), splitter,
		&snapshotMockBackend{caps: staticOnlyCaps()},
		&snapshotMockMonitorStateStore{}, &snapshotMockHistoryStore{}, &snapshotMockPlaylistStore{},
		nil, false,
	)

	require.NoError(t, err)
	assert.Empty(t, skips)
	require.Len(t, snap.Outputs, 2)

	paths := make(map[string]string)
	for _, out := range snap.Outputs {
		si, ok := out.Content.(backend.StaticImage)
		require.True(t, ok, "expected StaticImage for %s", out.Monitor.Name)
		paths[out.Monitor.Name] = si.Path_
	}
	// Each monitor should have a different (cropped) path.
	assert.NotEqual(t, paths["DP-1"], paths["DP-2"])
	// Neither should be the original.
	assert.NotEqual(t, imgPath, paths["DP-1"])
	assert.NotEqual(t, imgPath, paths["DP-2"])
}

func TestBuildSnapshot_VideoAudioEnabled(t *testing.T) {
	dir := t.TempDir()
	// Video files don't need to be valid PNGs for the stat check.
	videoPath := filepath.Join(dir, "video.mp4")
	require.NoError(t, os.WriteFile(videoPath, []byte("fake"), 0o644))

	img := &store.Image{ID: 3, Path: videoPath, MediaType: "video", AudioEnabled: true}
	mon1 := monitor.Monitor{Name: "DP-1", Width: 1920, Height: 1080}
	states := []store.MonitorState{
		{MonitorName: "DP-1", ImageID: 3, Mode: "clone"},
	}

	snap, skips, err := callBuildSnapshot(
		context.Background(), states, makeConnected(mon1),
		newMockImageStore(img), nil,
		&snapshotMockBackend{caps: allKindsCaps()},
		&snapshotMockMonitorStateStore{}, &snapshotMockHistoryStore{}, &snapshotMockPlaylistStore{},
		nil, true, // videoAudioDefault = true
	)

	require.NoError(t, err)
	assert.Empty(t, skips)
	require.Len(t, snap.Outputs, 1)
	vid, ok := snap.Outputs[0].Content.(backend.Video)
	require.True(t, ok)
	assert.True(t, vid.AudioEnabled)
}

func TestBuildSnapshot_VideoAudioDisabledByDefault(t *testing.T) {
	dir := t.TempDir()
	videoPath := filepath.Join(dir, "video.mp4")
	require.NoError(t, os.WriteFile(videoPath, []byte("fake"), 0o644))

	img := &store.Image{ID: 4, Path: videoPath, MediaType: "video", AudioEnabled: true}
	mon1 := monitor.Monitor{Name: "DP-1", Width: 1920, Height: 1080}
	states := []store.MonitorState{
		{MonitorName: "DP-1", ImageID: 4, Mode: "clone"},
	}

	snap, skips, err := callBuildSnapshot(
		context.Background(), states, makeConnected(mon1),
		newMockImageStore(img), nil,
		&snapshotMockBackend{caps: allKindsCaps()},
		&snapshotMockMonitorStateStore{}, &snapshotMockHistoryStore{}, &snapshotMockPlaylistStore{},
		nil, false, // videoAudioDefault = false
	)

	require.NoError(t, err)
	assert.Empty(t, skips)
	require.Len(t, snap.Outputs, 1)
	vid, ok := snap.Outputs[0].Content.(backend.Video)
	require.True(t, ok)
	assert.False(t, vid.AudioEnabled)
}

func TestBuildSnapshot_WebWallpaperWithOverrides(t *testing.T) {
	dir := t.TempDir()

	// Write a manifest file with a parallax_direction field.
	manifestPath := filepath.Join(dir, "waypaper.json")
	manifestContent := `{"parallax_direction": "vertical"}`
	require.NoError(t, os.WriteFile(manifestPath, []byte(manifestContent), 0o644))

	// Write a fake package entry file so the path exists.
	entryPath := filepath.Join(dir, "index.html")
	require.NoError(t, os.WriteFile(entryPath, []byte("<html>"), 0o644))

	schemaJSON := json.RawMessage(`{"speed":{"default":1.0,"type":"number"}}`)
	overridesJSON := json.RawMessage(`{"speed":2.5}`)

	img := &store.Image{
		ID:        5,
		Path:      manifestPath, // Path must exist for Stat
		MediaType: "web",
		WebMeta: &store.WebMeta{
			ManifestPath:    manifestPath,
			PackageRoot:     dir,
			WallpaperConfig: schemaJSON,
		},
		WallpaperConfigOverrides: overridesJSON,
	}
	mon1 := monitor.Monitor{Name: "DP-1", Width: 1920, Height: 1080}
	states := []store.MonitorState{
		{MonitorName: "DP-1", ImageID: 5, Mode: "clone"},
	}

	snap, skips, err := callBuildSnapshot(
		context.Background(), states, makeConnected(mon1),
		newMockImageStore(img), nil,
		&snapshotMockBackend{caps: allKindsCaps()},
		&snapshotMockMonitorStateStore{}, &snapshotMockHistoryStore{}, &snapshotMockPlaylistStore{},
		nil, false,
	)

	require.NoError(t, err)
	assert.Empty(t, skips)
	require.Len(t, snap.Outputs, 1)

	ww, ok := snap.Outputs[0].Content.(backend.WebWallpaper)
	require.True(t, ok)
	assert.Equal(t, manifestPath, ww.ManifestPath)
	assert.Equal(t, dir, ww.PackageRoot)
	assert.Equal(t, "vertical", ww.ParallaxDirection)

	// Verify merged config: override value 2.5 should be present.
	var cfg map[string]any
	require.NoError(t, json.Unmarshal(ww.Config, &cfg))
	assert.Equal(t, 2.5, cfg["speed"])
}

func TestBuildSnapshot_DisconnectedMonitor(t *testing.T) {
	dir := t.TempDir()
	imgPath := writeTempPNG(t, dir, "img.png")

	img := &store.Image{ID: 6, Path: imgPath, MediaType: "image"}
	// Only DP-1 is connected; DP-2 is not.
	mon1 := monitor.Monitor{Name: "DP-1", Width: 1920, Height: 1080}
	states := []store.MonitorState{
		{MonitorName: "DP-1", ImageID: 6, Mode: "clone"},
		{MonitorName: "DP-2", ImageID: 6, Mode: "clone"},
	}

	snap, skips, err := callBuildSnapshot(
		context.Background(), states, makeConnected(mon1),
		newMockImageStore(img), nil,
		&snapshotMockBackend{caps: staticOnlyCaps()},
		&snapshotMockMonitorStateStore{}, &snapshotMockHistoryStore{}, &snapshotMockPlaylistStore{},
		nil, false,
	)

	require.NoError(t, err)
	require.Len(t, snap.Outputs, 1)
	assert.Equal(t, "DP-1", snap.Outputs[0].Monitor.Name)

	require.Len(t, skips, 1)
	assert.Equal(t, SkipMonitorDisconnected, skips[0].Kind)
	assert.Equal(t, "DP-2", skips[0].MonitorName)
}

func TestBuildSnapshot_AllDisconnected(t *testing.T) {
	img := &store.Image{ID: 7, Path: "/nonexistent/img.png", MediaType: "image"}
	states := []store.MonitorState{
		{MonitorName: "DP-1", ImageID: 7, Mode: "clone"},
	}

	snap, skips, err := callBuildSnapshot(
		context.Background(), states, makeConnected(), // empty connected
		newMockImageStore(img), nil,
		&snapshotMockBackend{caps: staticOnlyCaps()},
		&snapshotMockMonitorStateStore{}, &snapshotMockHistoryStore{}, &snapshotMockPlaylistStore{},
		nil, false,
	)

	require.NoError(t, err)
	assert.Empty(t, snap.Outputs)
	require.Len(t, skips, 1)
	assert.Equal(t, SkipMonitorDisconnected, skips[0].Kind)
}

func TestBuildSnapshot_OrphanImageNotInStore(t *testing.T) {
	// Image 99 is not in the store.
	mon1 := monitor.Monitor{Name: "DP-1", Width: 1920, Height: 1080}
	states := []store.MonitorState{
		{MonitorName: "DP-1", ImageID: 99, Mode: "clone"},
	}

	monStateStore := &snapshotMockMonitorStateStore{}
	histStore := &snapshotMockHistoryStore{}
	bus := &snapshotMockBus{}

	snap, skips, err := callBuildSnapshot(
		context.Background(), states, makeConnected(mon1),
		newMockImageStore(), // empty — GetByID returns ErrNotFound
		nil,
		&snapshotMockBackend{caps: staticOnlyCaps()},
		monStateStore, histStore, &snapshotMockPlaylistStore{},
		bus, false,
	)

	require.NoError(t, err)
	assert.Empty(t, snap.Outputs)
	require.Len(t, skips, 1)
	assert.Equal(t, SkipImageMissing, skips[0].Kind)
	assert.Equal(t, 99, skips[0].ImageID)

	// Cascade triggered exactly once.
	require.Len(t, histStore.deletedByImageID, 1)
	assert.Equal(t, 99, histStore.deletedByImageID[0])

	// Bus event published.
	require.Len(t, bus.events, 1)
	assert.Equal(t, events.ImageOrphanPurged, bus.events[0].Type)
	data := bus.events[0].Data.(map[string]any)
	assert.Equal(t, 99, data["image_id"])
	assert.Equal(t, "row_missing", data["reason"])
}

func TestBuildSnapshot_OrphanImageCascadeOncePerID(t *testing.T) {
	// Two monitors with the same orphan image_id — cascade should fire exactly once.
	mon1 := monitor.Monitor{Name: "DP-1", Width: 1920, Height: 1080}
	mon2 := monitor.Monitor{Name: "DP-2", Width: 1920, Height: 1080, X: 1920}
	states := []store.MonitorState{
		{MonitorName: "DP-1", ImageID: 99, Mode: "clone"},
		{MonitorName: "DP-2", ImageID: 99, Mode: "clone"},
	}

	histStore := &snapshotMockHistoryStore{}
	bus := &snapshotMockBus{}

	snap, skips, err := callBuildSnapshot(
		context.Background(), states, makeConnected(mon1, mon2),
		newMockImageStore(),
		nil,
		&snapshotMockBackend{caps: staticOnlyCaps()},
		&snapshotMockMonitorStateStore{}, histStore, &snapshotMockPlaylistStore{},
		bus, false,
	)

	require.NoError(t, err)
	assert.Empty(t, snap.Outputs)
	assert.Len(t, skips, 2)

	// Cascade called exactly once for image 99.
	assert.Equal(t, []int{99}, histStore.deletedByImageID)
	assert.Len(t, bus.events, 1)
}

func TestBuildSnapshot_FileMissing(t *testing.T) {
	img := &store.Image{ID: 8, Path: "/nonexistent/path/img.png", MediaType: "image"}
	mon1 := monitor.Monitor{Name: "DP-1", Width: 1920, Height: 1080}
	states := []store.MonitorState{
		{MonitorName: "DP-1", ImageID: 8, Mode: "clone"},
	}

	histStore := &snapshotMockHistoryStore{}
	bus := &snapshotMockBus{}

	snap, skips, err := callBuildSnapshot(
		context.Background(), states, makeConnected(mon1),
		newMockImageStore(img), nil,
		&snapshotMockBackend{caps: staticOnlyCaps()},
		&snapshotMockMonitorStateStore{}, histStore, &snapshotMockPlaylistStore{},
		bus, false,
	)

	require.NoError(t, err)
	assert.Empty(t, snap.Outputs)
	require.Len(t, skips, 1)
	assert.Equal(t, SkipImageMissing, skips[0].Kind)

	// Cascade fired.
	assert.Equal(t, []int{8}, histStore.deletedByImageID)

	// Event published with file_missing reason.
	require.Len(t, bus.events, 1)
	assert.Equal(t, events.ImageOrphanPurged, bus.events[0].Type)
	data := bus.events[0].Data.(map[string]any)
	assert.Equal(t, "file_missing", data["reason"])
}

func TestBuildSnapshot_KindUnsupportedByBackend(t *testing.T) {
	dir := t.TempDir()
	videoPath := filepath.Join(dir, "video.mp4")
	require.NoError(t, os.WriteFile(videoPath, []byte("fake"), 0o644))

	img := &store.Image{ID: 9, Path: videoPath, MediaType: "video"}
	mon1 := monitor.Monitor{Name: "DP-1", Width: 1920, Height: 1080}
	states := []store.MonitorState{
		{MonitorName: "DP-1", ImageID: 9, Mode: "clone"},
	}

	// Backend only supports StaticImage, not Video.
	snap, skips, err := callBuildSnapshot(
		context.Background(), states, makeConnected(mon1),
		newMockImageStore(img), nil,
		&snapshotMockBackend{caps: staticOnlyCaps()},
		&snapshotMockMonitorStateStore{}, &snapshotMockHistoryStore{}, &snapshotMockPlaylistStore{},
		nil, false,
	)

	require.NoError(t, err)
	assert.Empty(t, snap.Outputs)
	require.Len(t, skips, 1)
	assert.Equal(t, SkipKindUnsupported, skips[0].Kind)
}

func TestBuildSnapshot_ExtendNonImageDegradesToClone(t *testing.T) {
	dir := t.TempDir()
	gifPath := filepath.Join(dir, "anim.gif")
	require.NoError(t, os.WriteFile(gifPath, []byte("GIF89a"), 0o644))

	// GIF with extend mode: should degrade to clone (each monitor gets same path).
	img := &store.Image{ID: 10, Path: gifPath, MediaType: "gif"}
	mon1 := monitor.Monitor{Name: "DP-1", Width: 1920, Height: 1080}
	mon2 := monitor.Monitor{Name: "DP-2", Width: 1920, Height: 1080, X: 1920}
	states := []store.MonitorState{
		{MonitorName: "DP-1", ImageID: 10, Mode: "extend"},
		{MonitorName: "DP-2", ImageID: 10, Mode: "extend"},
	}

	caps := backend.Capabilities{ContentKinds: []backend.ContentKind{backend.KindGIF}}
	snap, skips, err := callBuildSnapshot(
		context.Background(), states, makeConnected(mon1, mon2),
		newMockImageStore(img), nil,
		&snapshotMockBackend{caps: caps},
		&snapshotMockMonitorStateStore{}, &snapshotMockHistoryStore{}, &snapshotMockPlaylistStore{},
		nil, false,
	)

	require.NoError(t, err)
	assert.Empty(t, skips)
	require.Len(t, snap.Outputs, 2)
	for _, out := range snap.Outputs {
		g, ok := out.Content.(backend.GIF)
		require.True(t, ok)
		assert.Equal(t, gifPath, g.Path_)
	}
}

func TestBuildSnapshot_SplitFailedEmitsSkipSplitFailed(t *testing.T) {
	// Use a path that exists on disk but is not a valid PNG — Split will fail.
	dir := t.TempDir()
	badPath := filepath.Join(dir, "notanimage.png")
	require.NoError(t, os.WriteFile(badPath, []byte("not a png"), 0o644))

	img := &store.Image{ID: 11, Path: badPath, MediaType: "image"}
	mon1 := monitor.Monitor{Name: "DP-1", Width: 1920, Height: 1080, Scale: 1}
	mon2 := monitor.Monitor{Name: "DP-2", Width: 1920, Height: 1080, X: 1920, Scale: 1}
	states := []store.MonitorState{
		{MonitorName: "DP-1", ImageID: 11, Mode: "extend"},
		{MonitorName: "DP-2", ImageID: 11, Mode: "extend"},
	}

	splitter := imgpkg.NewSplitter(dir)

	snap, skips, err := callBuildSnapshot(
		context.Background(), states, makeConnected(mon1, mon2),
		newMockImageStore(img), splitter,
		&snapshotMockBackend{caps: staticOnlyCaps()},
		&snapshotMockMonitorStateStore{}, &snapshotMockHistoryStore{}, &snapshotMockPlaylistStore{},
		nil, false,
	)

	require.NoError(t, err)
	assert.Empty(t, snap.Outputs)
	require.Len(t, skips, 2)
	for _, s := range skips {
		assert.Equal(t, SkipSplitFailed, s.Kind)
	}
}

func TestBuildSnapshot_InfraErrorPropagated(t *testing.T) {
	// ImageStore returns a non-ErrNotFound error — should bubble up.
	errInfra := errors.New("db connection lost")
	imgStore := &failingImageStore{err: errInfra}

	mon1 := monitor.Monitor{Name: "DP-1", Width: 1920, Height: 1080}
	states := []store.MonitorState{
		{MonitorName: "DP-1", ImageID: 1, Mode: "clone"},
	}

	_, _, err := callBuildSnapshot(
		context.Background(), states, makeConnected(mon1),
		imgStore, nil,
		&snapshotMockBackend{caps: staticOnlyCaps()},
		&snapshotMockMonitorStateStore{}, &snapshotMockHistoryStore{}, &snapshotMockPlaylistStore{},
		nil, false,
	)

	require.Error(t, err)
	assert.True(t, errors.Is(err, errInfra))
}

// failingImageStore always returns the given error from GetByID.
type failingImageStore struct{ err error }

func (f *failingImageStore) GetByID(context.Context, int) (*store.Image, error) {
	return nil, f.err
}
func (f *failingImageStore) GetAll(context.Context, store.ImageQueryOpts) (*store.PaginatedResult[store.Image], error) {
	return nil, nil
}
func (f *failingImageStore) Create(context.Context, []store.Image) ([]store.Image, error) {
	return nil, nil
}
func (f *failingImageStore) Update(context.Context, int, map[string]any) (*store.Image, error) {
	return nil, nil
}
func (f *failingImageStore) Delete(context.Context, []int) (int, error) { return 0, nil }
func (f *failingImageStore) UpdateAll(context.Context, map[string]any) (int, error) {
	return 0, nil
}
func (f *failingImageStore) GetAllTags(context.Context) ([]string, error) { return nil, nil }
func (f *failingImageStore) Count(context.Context) (int, error)           { return 0, nil }
func (f *failingImageStore) IsNameTaken(context.Context, string, int) (bool, error) {
	return false, nil
}
