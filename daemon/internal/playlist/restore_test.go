package playlist

import (
	"context"
	"encoding/json"
	"sync"
	"testing"

	"github.com/spf13/viper"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"waypaper-engine/daemon/internal/backend"
	"waypaper-engine/daemon/internal/config"
	"waypaper-engine/daemon/internal/events"
	"waypaper-engine/daemon/internal/monitor"
	"waypaper-engine/daemon/internal/store"
)

// ---------------------------------------------------------------------------
// Minimal fakes only for this test file
// ---------------------------------------------------------------------------

// recordingBackend captures every SetWallpaper call for assertions.
type recordingBackend struct {
	mu    sync.Mutex
	calls []backend.WallpaperRequest
}

func (b *recordingBackend) Name() string      { return "recording" }
func (b *recordingBackend) IsAvailable() bool { return true }
func (b *recordingBackend) Capabilities() backend.Capabilities {
	return backend.Capabilities{
		ContentKinds: []backend.ContentKind{backend.KindStaticImage, backend.KindGIF},
	}
}
func (b *recordingBackend) Initialize(_ context.Context) error         { return nil }
func (b *recordingBackend) Shutdown(_ context.Context) error           { return nil }
func (b *recordingBackend) RegisterDefaults(_ *viper.Viper)            {}
func (b *recordingBackend) ValidateConfig(_ json.RawMessage) error     { return nil }
func (b *recordingBackend) ParseConfig(_ json.RawMessage) (any, error) { return nil, nil }
func (b *recordingBackend) OnConfigChanged(_ context.Context, _ json.RawMessage) error {
	return nil
}
func (b *recordingBackend) SetWallpaper(_ context.Context, req backend.WallpaperRequest) error {
	b.mu.Lock()
	defer b.mu.Unlock()
	b.calls = append(b.calls, req)
	return nil
}

// simpleRegistry wraps a single backend.
type simpleRegistry struct {
	active backend.Backend
}

func (r *simpleRegistry) Register(_ backend.Backend) error { return nil }
func (r *simpleRegistry) Get(_ string) (backend.Backend, bool) {
	return r.active, r.active != nil
}
func (r *simpleRegistry) HasActive() bool                                           { return r.active != nil }
func (r *simpleRegistry) Active() backend.Backend                                   { return r.active }
func (r *simpleRegistry) SetActive(_ string) error                                  { return nil }
func (r *simpleRegistry) Available() []backend.BackendInfo                          { return nil }
func (r *simpleRegistry) Compatible(_ monitor.CompositorType) []backend.BackendInfo { return nil }

// inMemPlaylistStore holds playlists in memory (thread-safe).
type inMemPlaylistStore struct {
	mu        sync.RWMutex
	playlists map[int]*store.Playlist
	playbacks map[int]*store.PlaylistPlayback // saved via SavePlaybackState
}

func newInMemPlaylistStore(pls ...*store.Playlist) *inMemPlaylistStore {
	s := &inMemPlaylistStore{
		playlists: make(map[int]*store.Playlist),
		playbacks: make(map[int]*store.PlaylistPlayback),
	}
	for _, pl := range pls {
		copy := *pl
		s.playlists[pl.ID] = &copy
	}
	return s
}

func (s *inMemPlaylistStore) GetAll(_ context.Context) ([]store.Playlist, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	out := make([]store.Playlist, 0, len(s.playlists))
	for _, pl := range s.playlists {
		out = append(out, *pl)
	}
	return out, nil
}

func (s *inMemPlaylistStore) GetByID(_ context.Context, id int) (*store.Playlist, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	pl, ok := s.playlists[id]
	if !ok {
		return nil, nil
	}
	copy := *pl
	return &copy, nil
}

func (s *inMemPlaylistStore) Create(_ context.Context, pl store.Playlist) (*store.Playlist, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.playlists[pl.ID] = &pl
	return &pl, nil
}

func (s *inMemPlaylistStore) Update(_ context.Context, _ int, _ map[string]any) (*store.Playlist, error) {
	return nil, nil
}

func (s *inMemPlaylistStore) SavePlaybackState(_ context.Context, id int, pb *store.PlaylistPlayback) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	copy := *pb
	s.playbacks[id] = &copy
	// Also update the in-memory playlist so GetByID returns updated playback.
	if pl, ok := s.playlists[id]; ok {
		pl.Playback = &copy
	}
	return nil
}

func (s *inMemPlaylistStore) Delete(_ context.Context, _ int) error { return nil }
func (s *inMemPlaylistStore) Count(_ context.Context) (int, error)  { return len(s.playlists), nil }

// inMemStateStore is a simple thread-safe in-memory StateStore.
type inMemStateStore struct {
	mu              sync.RWMutex
	activePlaylists map[int]store.ActivePlaylistInstance
	wallpapers      map[string]store.ImageHistoryEntry
}

func newInMemStateStore() *inMemStateStore {
	return &inMemStateStore{
		activePlaylists: make(map[int]store.ActivePlaylistInstance),
		wallpapers:      make(map[string]store.ImageHistoryEntry),
	}
}

func (s *inMemStateStore) GetActivePlaylists() map[int]store.ActivePlaylistInstance {
	s.mu.RLock()
	defer s.mu.RUnlock()
	out := make(map[int]store.ActivePlaylistInstance, len(s.activePlaylists))
	for k, v := range s.activePlaylists {
		out[k] = v
	}
	return out
}

func (s *inMemStateStore) GetActivePlaylistByID(id int) *store.ActivePlaylistInstance {
	s.mu.RLock()
	defer s.mu.RUnlock()
	if inst, ok := s.activePlaylists[id]; ok {
		copy := inst
		return &copy
	}
	return nil
}

func (s *inMemStateStore) GetActivePlaylistForMonitor(name string) *store.ActivePlaylistInstance {
	s.mu.RLock()
	defer s.mu.RUnlock()
	for _, inst := range s.activePlaylists {
		for _, m := range inst.Monitors {
			if m == name {
				copy := inst
				return &copy
			}
		}
	}
	return nil
}

func (s *inMemStateStore) SetActivePlaylist(inst store.ActivePlaylistInstance) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.activePlaylists[inst.PlaylistID] = inst
}

func (s *inMemStateStore) UpdateActivePlaylist(id int, fn func(*store.ActivePlaylistInstance)) bool {
	s.mu.Lock()
	defer s.mu.Unlock()
	if inst, ok := s.activePlaylists[id]; ok {
		fn(&inst)
		s.activePlaylists[id] = inst
		return true
	}
	return false
}

func (s *inMemStateStore) RemoveActivePlaylist(id int) {
	s.mu.Lock()
	defer s.mu.Unlock()
	delete(s.activePlaylists, id)
}

func (s *inMemStateStore) RemoveAllActivePlaylists() {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.activePlaylists = make(map[int]store.ActivePlaylistInstance)
}

func (s *inMemStateStore) GetCurrentWallpaper(mon string) *store.ImageHistoryEntry {
	s.mu.RLock()
	defer s.mu.RUnlock()
	if e, ok := s.wallpapers[mon]; ok {
		copy := e
		return &copy
	}
	return nil
}

func (s *inMemStateStore) SetCurrentWallpaper(mon string, e store.ImageHistoryEntry) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.wallpapers[mon] = e
}

// noopHistoryStore discards all history writes.
type noopHistoryStore struct{}

func (n *noopHistoryStore) Append(_ context.Context, _ store.ImageHistoryEntry) (*store.ImageHistoryEntry, error) {
	return nil, nil
}
func (n *noopHistoryStore) GetRecent(_ context.Context, _ store.HistoryQueryOpts) ([]store.ImageHistoryEntry, error) {
	return nil, nil
}
func (n *noopHistoryStore) Count(_ context.Context) (int, error)                  { return 0, nil }
func (n *noopHistoryStore) Clear(_ context.Context) error                         { return nil }
func (n *noopHistoryStore) DeleteByImageID(_ context.Context, _ int) (int, error) { return 0, nil }

// noopMonitorStateStore discards monitor state writes.
type noopMonitorStateStore struct{}

func (n *noopMonitorStateStore) Get(_ context.Context, _ string) (*store.MonitorState, error) {
	return nil, nil
}
func (n *noopMonitorStateStore) GetAll(_ context.Context) ([]store.MonitorState, error) {
	return nil, nil
}
func (n *noopMonitorStateStore) Set(_ context.Context, _ store.MonitorState) error { return nil }
func (n *noopMonitorStateStore) Remove(_ context.Context, _ string) error          { return nil }

// staticMonitorManager returns a fixed list of monitors.
type staticMonitorManager struct {
	monitors []monitor.Monitor
}

func (m *staticMonitorManager) GetMonitors(_ context.Context) ([]monitor.Monitor, error) {
	return m.monitors, nil
}

func (m *staticMonitorManager) GetMonitorByName(_ context.Context, name string) (monitor.Monitor, error) {
	for _, mon := range m.monitors {
		if mon.Name == name {
			return mon, nil
		}
	}
	return monitor.Monitor{}, nil
}

func (m *staticMonitorManager) Refresh(_ context.Context) error    { return nil }
func (m *staticMonitorManager) Compositor() monitor.CompositorType { return "" }

// noopBus discards all events.
type noopBus struct{}

func (b *noopBus) Publish(_ events.Event)                              {}
func (b *noopBus) Subscribe(_ ...events.EventType) <-chan events.Event { return nil }
func (b *noopBus) Unsubscribe(_ <-chan events.Event)                   {}
func (b *noopBus) Close()                                              {}

// noopConfig returns sensible defaults.
type noopConfig struct{}

func (c *noopConfig) GetSelectionMode() string                           { return "fixed" }
func (c *noopConfig) GetAutoPriorities() config.AutoPriorities           { return config.AutoPriorities{} }
func (c *noopConfig) GetConfig() (*config.Config, error)                 { return nil, nil }
func (c *noopConfig) UpdateConfig(_ string, _ map[string]any) error      { return nil }
func (c *noopConfig) GetSection(_ string) (map[string]any, error)        { return nil, nil }
func (c *noopConfig) GetBackendConfig(_ string) (json.RawMessage, error) { return nil, nil }
func (c *noopConfig) SetBackendConfig(_ string, _ json.RawMessage) error { return nil }
func (c *noopConfig) GetActiveBackendType() string                       { return "recording" }
func (c *noopConfig) SetActiveBackendType(_ string) error                { return nil }
func (c *noopConfig) OnConfigChange(_ func(string))                      {}
func (c *noopConfig) GetSocketPath() string                              { return "" }
func (c *noopConfig) GetImagesDir() string                               { return "" }
func (c *noopConfig) GetThumbnailsDir() string                           { return "" }
func (c *noopConfig) GetDatabaseDir() string                             { return "" }
func (c *noopConfig) GetLogFile() string                                 { return "" }
func (c *noopConfig) ResetToFactoryDefaults(func(*viper.Viper)) error    { return nil }
func (c *noopConfig) ReplaceBackendNamedConfig(_ string, _ map[string]any) error {
	return nil
}

// ---------------------------------------------------------------------------
// Test
// ---------------------------------------------------------------------------

// TestRestorePersistedRuns_DoesNotReapplyWallpaper verifies that
// RestorePersistedRuns does NOT call SetWallpaper on the backend.
// wallpaper.Restore (a separate code path) is responsible for the initial
// wallpaper application on daemon restart; calling SetWallpaper a second time
// from startPlaylist races the first call and can cause one monitor to stay
// blank (see: wal-qt retry-loop collision).
func TestRestorePersistedRuns_DoesNotReapplyWallpaper(t *testing.T) {
	ctx := context.Background()

	// Two playlists, one monitor each, both were running.
	pl1 := &store.Playlist{
		ID:   1,
		Name: "playlist-1",
		Images: []store.PlaylistImage{
			{ImageID: 10, MediaType: "image"},
		},
		Configuration: store.PlaylistConfiguration{
			Type:     "timer",
			Interval: 60,
			Order:    "sequential",
		},
		Playback: &store.PlaylistPlayback{
			WasRunning:   true,
			CurrentIndex: 0,
			Mode:         string(monitor.ModeIndividual),
			Monitors:     []string{"DP-1"},
		},
	}
	pl2 := &store.Playlist{
		ID:   2,
		Name: "playlist-2",
		Images: []store.PlaylistImage{
			{ImageID: 20, MediaType: "image"},
		},
		Configuration: store.PlaylistConfiguration{
			Type:     "timer",
			Interval: 60,
			Order:    "sequential",
		},
		Playback: &store.PlaylistPlayback{
			WasRunning:   true,
			CurrentIndex: 0,
			Mode:         string(monitor.ModeIndividual),
			Monitors:     []string{"DP-2"},
		},
	}

	rec := &recordingBackend{}

	imageStore := &stubImageStore{images: map[int]*store.Image{
		10: {ID: 10, Path: "/wallpapers/a.jpg", MediaType: "image"},
		20: {ID: 20, Path: "/wallpapers/b.jpg", MediaType: "image"},
	}}

	playlistStore := newInMemPlaylistStore(pl1, pl2)
	stateStore := newInMemStateStore()

	monMgr := &staticMonitorManager{
		monitors: []monitor.Monitor{
			{Name: "DP-1"},
			{Name: "DP-2"},
		},
	}

	mgr := NewManager(
		playlistStore,
		stateStore,
		&noopHistoryStore{},
		imageStore,
		&noopMonitorStateStore{},
		&simpleRegistry{active: rec},
		monMgr,
		&noopBus{},
		nil, // splitter — not needed for individual mode with no split
		&noopConfig{},
	)

	err := mgr.RestorePersistedRuns(ctx)
	require.NoError(t, err)

	// --- Assert 1: zero SetWallpaper calls ---
	rec.mu.Lock()
	callCount := len(rec.calls)
	rec.mu.Unlock()
	assert.Equal(t, 0, callCount,
		"RestorePersistedRuns must not call SetWallpaper; wallpaper.Restore owns that path")

	// --- Assert 2: both playlists are active in the state store ---
	inst1 := stateStore.GetActivePlaylistByID(1)
	require.NotNil(t, inst1, "playlist 1 should be active after restore")
	assert.Equal(t, []string{"DP-1"}, inst1.Monitors)

	inst2 := stateStore.GetActivePlaylistByID(2)
	require.NotNil(t, inst2, "playlist 2 should be active after restore")
	assert.Equal(t, []string{"DP-2"}, inst2.Monitors)

	// --- Assert 3: playback was re-persisted with was_running=true ---
	playlistStore.mu.RLock()
	pb1 := playlistStore.playbacks[1]
	pb2 := playlistStore.playbacks[2]
	playlistStore.mu.RUnlock()

	require.NotNil(t, pb1, "playback for playlist 1 should be saved")
	assert.True(t, pb1.WasRunning, "playlist 1 playback.was_running must be true")

	require.NotNil(t, pb2, "playback for playlist 2 should be saved")
	assert.True(t, pb2.WasRunning, "playlist 2 playback.was_running must be true")
}
