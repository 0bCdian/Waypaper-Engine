package testutil

import (
	"context"
	"encoding/json"
	"time"

	"waypaper-engine/daemon/internal/backend"
	"waypaper-engine/daemon/internal/config"
	"waypaper-engine/daemon/internal/events"
	"waypaper-engine/daemon/internal/media"
	"waypaper-engine/daemon/internal/monitor"
	"waypaper-engine/daemon/internal/playlist"
	"waypaper-engine/daemon/internal/store"

	"github.com/spf13/viper"
)

// Compile-time interface satisfaction checks.
var (
	_ store.ImageStore        = (*MockImageStore)(nil)
	_ store.FolderStore       = (*MockFolderStore)(nil)
	_ store.PlaylistStore     = (*MockPlaylistStore)(nil)
	_ store.HistoryStore      = (*MockHistoryStore)(nil)
	_ store.MonitorStateStore = (*MockMonitorStateStore)(nil)
	_ store.StateStore        = (*MockStateStore)(nil)
	_ store.DB                = (*MockDB)(nil)
	_ events.Bus              = (*MockBus)(nil)
	_ config.ConfigManager    = (*MockConfigManager)(nil)
	_ backend.Backend         = (*MockBackend)(nil)
	_ backend.Registry        = (*MockRegistry)(nil)
	_ monitor.MonitorManager  = (*MockMonitorManager)(nil)
	_ monitor.MonitorProvider = (*MockMonitorProvider)(nil)
	_ playlist.Scheduler      = (*MockScheduler)(nil)
)

// ---------------------------------------------------------------------------
// 1. MockImageStore
// ---------------------------------------------------------------------------

type MockImageStore struct {
	GetAllFn      func(ctx context.Context, opts store.ImageQueryOpts) (*store.PaginatedResult[store.Image], error)
	GetByIDFn     func(ctx context.Context, id int) (*store.Image, error)
	CreateFn      func(ctx context.Context, images []store.Image) ([]store.Image, error)
	UpdateFn      func(ctx context.Context, id int, updates map[string]any) (*store.Image, error)
	DeleteFn      func(ctx context.Context, ids []int) (int, error)
	UpdateAllFn   func(ctx context.Context, updates map[string]any) (int, error)
	GetAllTagsFn  func(ctx context.Context) ([]string, error)
	CountFn       func(ctx context.Context) (int, error)
	IsNameTakenFn func(ctx context.Context, name string, excludeID int) (bool, error)
}

func (m *MockImageStore) GetAll(ctx context.Context, opts store.ImageQueryOpts) (*store.PaginatedResult[store.Image], error) {
	if m.GetAllFn != nil {
		return m.GetAllFn(ctx, opts)
	}
	return nil, nil
}

func (m *MockImageStore) GetByID(ctx context.Context, id int) (*store.Image, error) {
	if m.GetByIDFn != nil {
		return m.GetByIDFn(ctx, id)
	}
	return nil, nil
}

func (m *MockImageStore) Create(ctx context.Context, images []store.Image) ([]store.Image, error) {
	if m.CreateFn != nil {
		return m.CreateFn(ctx, images)
	}
	return nil, nil
}

func (m *MockImageStore) Update(ctx context.Context, id int, updates map[string]any) (*store.Image, error) {
	if m.UpdateFn != nil {
		return m.UpdateFn(ctx, id, updates)
	}
	return nil, nil
}

func (m *MockImageStore) Delete(ctx context.Context, ids []int) (int, error) {
	if m.DeleteFn != nil {
		return m.DeleteFn(ctx, ids)
	}
	return 0, nil
}

func (m *MockImageStore) UpdateAll(ctx context.Context, updates map[string]any) (int, error) {
	if m.UpdateAllFn != nil {
		return m.UpdateAllFn(ctx, updates)
	}
	return 0, nil
}

func (m *MockImageStore) GetAllTags(ctx context.Context) ([]string, error) {
	if m.GetAllTagsFn != nil {
		return m.GetAllTagsFn(ctx)
	}
	return nil, nil
}

func (m *MockImageStore) Count(ctx context.Context) (int, error) {
	if m.CountFn != nil {
		return m.CountFn(ctx)
	}
	return 0, nil
}

func (m *MockImageStore) IsNameTaken(ctx context.Context, name string, excludeID int) (bool, error) {
	if m.IsNameTakenFn != nil {
		return m.IsNameTakenFn(ctx, name, excludeID)
	}
	return false, nil
}

// ---------------------------------------------------------------------------
// 2. MockFolderStore
// ---------------------------------------------------------------------------

type MockFolderStore struct {
	GetAllFn  func(ctx context.Context, parentID *int) ([]store.Folder, error)
	GetByIDFn func(ctx context.Context, id int) (*store.Folder, error)
	GetPathFn func(ctx context.Context, id int) ([]store.Folder, error)
	CreateFn  func(ctx context.Context, folder store.Folder) (*store.Folder, error)
	UpdateFn  func(ctx context.Context, id int, updates map[string]any) (*store.Folder, error)
	DeleteFn  func(ctx context.Context, id int) error
	SearchFn  func(ctx context.Context, query string) ([]store.Folder, error)
	CountFn   func(ctx context.Context) (int, error)
}

func (m *MockFolderStore) GetAll(ctx context.Context, parentID *int) ([]store.Folder, error) {
	if m.GetAllFn != nil {
		return m.GetAllFn(ctx, parentID)
	}
	return nil, nil
}

func (m *MockFolderStore) GetByID(ctx context.Context, id int) (*store.Folder, error) {
	if m.GetByIDFn != nil {
		return m.GetByIDFn(ctx, id)
	}
	return nil, nil
}

func (m *MockFolderStore) GetPath(ctx context.Context, id int) ([]store.Folder, error) {
	if m.GetPathFn != nil {
		return m.GetPathFn(ctx, id)
	}
	return nil, nil
}

func (m *MockFolderStore) Create(ctx context.Context, folder store.Folder) (*store.Folder, error) {
	if m.CreateFn != nil {
		return m.CreateFn(ctx, folder)
	}
	return nil, nil
}

func (m *MockFolderStore) Update(ctx context.Context, id int, updates map[string]any) (*store.Folder, error) {
	if m.UpdateFn != nil {
		return m.UpdateFn(ctx, id, updates)
	}
	return nil, nil
}

func (m *MockFolderStore) Delete(ctx context.Context, id int) error {
	if m.DeleteFn != nil {
		return m.DeleteFn(ctx, id)
	}
	return nil
}

func (m *MockFolderStore) Search(ctx context.Context, query string) ([]store.Folder, error) {
	if m.SearchFn != nil {
		return m.SearchFn(ctx, query)
	}
	return nil, nil
}

func (m *MockFolderStore) Count(ctx context.Context) (int, error) {
	if m.CountFn != nil {
		return m.CountFn(ctx)
	}
	return 0, nil
}

// ---------------------------------------------------------------------------
// 3. MockPlaylistStore
// ---------------------------------------------------------------------------

type MockPlaylistStore struct {
	GetAllFn            func(ctx context.Context) ([]store.Playlist, error)
	GetByIDFn           func(ctx context.Context, id int) (*store.Playlist, error)
	CreateFn            func(ctx context.Context, playlist store.Playlist) (*store.Playlist, error)
	UpdateFn            func(ctx context.Context, id int, updates map[string]any) (*store.Playlist, error)
	SavePlaybackStateFn func(ctx context.Context, id int, playback *store.PlaylistPlayback) error
	DeleteFn            func(ctx context.Context, id int) error
	CountFn             func(ctx context.Context) (int, error)
}

func (m *MockPlaylistStore) GetAll(ctx context.Context) ([]store.Playlist, error) {
	if m.GetAllFn != nil {
		return m.GetAllFn(ctx)
	}
	return nil, nil
}

func (m *MockPlaylistStore) GetByID(ctx context.Context, id int) (*store.Playlist, error) {
	if m.GetByIDFn != nil {
		return m.GetByIDFn(ctx, id)
	}
	return nil, nil
}

func (m *MockPlaylistStore) Create(ctx context.Context, playlist store.Playlist) (*store.Playlist, error) {
	if m.CreateFn != nil {
		return m.CreateFn(ctx, playlist)
	}
	return nil, nil
}

func (m *MockPlaylistStore) Update(ctx context.Context, id int, updates map[string]any) (*store.Playlist, error) {
	if m.UpdateFn != nil {
		return m.UpdateFn(ctx, id, updates)
	}
	return nil, nil
}

func (m *MockPlaylistStore) SavePlaybackState(ctx context.Context, id int, playback *store.PlaylistPlayback) error {
	if m.SavePlaybackStateFn != nil {
		return m.SavePlaybackStateFn(ctx, id, playback)
	}
	return nil
}

func (m *MockPlaylistStore) Delete(ctx context.Context, id int) error {
	if m.DeleteFn != nil {
		return m.DeleteFn(ctx, id)
	}
	return nil
}

func (m *MockPlaylistStore) Count(ctx context.Context) (int, error) {
	if m.CountFn != nil {
		return m.CountFn(ctx)
	}
	return 0, nil
}

// ---------------------------------------------------------------------------
// 4. MockHistoryStore
// ---------------------------------------------------------------------------

type MockHistoryStore struct {
	AppendFn    func(ctx context.Context, entry store.ImageHistoryEntry) (*store.ImageHistoryEntry, error)
	GetRecentFn func(ctx context.Context, opts store.HistoryQueryOpts) ([]store.ImageHistoryEntry, error)
	CountFn     func(ctx context.Context) (int, error)
	ClearFn     func(ctx context.Context) error
}

func (m *MockHistoryStore) Append(ctx context.Context, entry store.ImageHistoryEntry) (*store.ImageHistoryEntry, error) {
	if m.AppendFn != nil {
		return m.AppendFn(ctx, entry)
	}
	return nil, nil
}

func (m *MockHistoryStore) GetRecent(ctx context.Context, opts store.HistoryQueryOpts) ([]store.ImageHistoryEntry, error) {
	if m.GetRecentFn != nil {
		return m.GetRecentFn(ctx, opts)
	}
	return nil, nil
}

func (m *MockHistoryStore) Count(ctx context.Context) (int, error) {
	if m.CountFn != nil {
		return m.CountFn(ctx)
	}
	return 0, nil
}

func (m *MockHistoryStore) Clear(ctx context.Context) error {
	if m.ClearFn != nil {
		return m.ClearFn(ctx)
	}
	return nil
}

// ---------------------------------------------------------------------------
// 5. MockMonitorStateStore
// ---------------------------------------------------------------------------

type MockMonitorStateStore struct {
	GetFn    func(ctx context.Context, monitorName string) (*store.MonitorState, error)
	GetAllFn func(ctx context.Context) ([]store.MonitorState, error)
	SetFn    func(ctx context.Context, state store.MonitorState) error
	RemoveFn func(ctx context.Context, monitorName string) error
}

func (m *MockMonitorStateStore) Get(ctx context.Context, monitorName string) (*store.MonitorState, error) {
	if m.GetFn != nil {
		return m.GetFn(ctx, monitorName)
	}
	return nil, nil
}

func (m *MockMonitorStateStore) GetAll(ctx context.Context) ([]store.MonitorState, error) {
	if m.GetAllFn != nil {
		return m.GetAllFn(ctx)
	}
	return nil, nil
}

func (m *MockMonitorStateStore) Set(ctx context.Context, state store.MonitorState) error {
	if m.SetFn != nil {
		return m.SetFn(ctx, state)
	}
	return nil
}

func (m *MockMonitorStateStore) Remove(ctx context.Context, monitorName string) error {
	if m.RemoveFn != nil {
		return m.RemoveFn(ctx, monitorName)
	}
	return nil
}

// ---------------------------------------------------------------------------
// 6. MockStateStore
// ---------------------------------------------------------------------------

type MockStateStore struct {
	GetActivePlaylistsFn          func() map[int]store.ActivePlaylistInstance
	GetActivePlaylistByIDFn       func(playlistID int) *store.ActivePlaylistInstance
	GetActivePlaylistForMonitorFn func(monitor string) *store.ActivePlaylistInstance
	SetActivePlaylistFn           func(instance store.ActivePlaylistInstance)
	UpdateActivePlaylistFn        func(playlistID int, fn func(*store.ActivePlaylistInstance)) bool
	RemoveActivePlaylistFn        func(playlistID int)
	RemoveAllActivePlaylistsFn    func()
	GetCurrentWallpaperFn         func(monitor string) *store.ImageHistoryEntry
	SetCurrentWallpaperFn         func(monitor string, entry store.ImageHistoryEntry)
}

func (m *MockStateStore) GetActivePlaylists() map[int]store.ActivePlaylistInstance {
	if m.GetActivePlaylistsFn != nil {
		return m.GetActivePlaylistsFn()
	}
	return nil
}

func (m *MockStateStore) GetActivePlaylistByID(playlistID int) *store.ActivePlaylistInstance {
	if m.GetActivePlaylistByIDFn != nil {
		return m.GetActivePlaylistByIDFn(playlistID)
	}
	return nil
}

func (m *MockStateStore) GetActivePlaylistForMonitor(monitor string) *store.ActivePlaylistInstance {
	if m.GetActivePlaylistForMonitorFn != nil {
		return m.GetActivePlaylistForMonitorFn(monitor)
	}
	return nil
}

func (m *MockStateStore) SetActivePlaylist(instance store.ActivePlaylistInstance) {
	if m.SetActivePlaylistFn != nil {
		m.SetActivePlaylistFn(instance)
	}
}

func (m *MockStateStore) UpdateActivePlaylist(playlistID int, fn func(*store.ActivePlaylistInstance)) bool {
	if m.UpdateActivePlaylistFn != nil {
		return m.UpdateActivePlaylistFn(playlistID, fn)
	}
	return false
}

func (m *MockStateStore) RemoveActivePlaylist(playlistID int) {
	if m.RemoveActivePlaylistFn != nil {
		m.RemoveActivePlaylistFn(playlistID)
	}
}

func (m *MockStateStore) RemoveAllActivePlaylists() {
	if m.RemoveAllActivePlaylistsFn != nil {
		m.RemoveAllActivePlaylistsFn()
	}
}

func (m *MockStateStore) GetCurrentWallpaper(monitor string) *store.ImageHistoryEntry {
	if m.GetCurrentWallpaperFn != nil {
		return m.GetCurrentWallpaperFn(monitor)
	}
	return nil
}

func (m *MockStateStore) SetCurrentWallpaper(monitor string, entry store.ImageHistoryEntry) {
	if m.SetCurrentWallpaperFn != nil {
		m.SetCurrentWallpaperFn(monitor, entry)
	}
}

// ---------------------------------------------------------------------------
// 7. MockDB
// ---------------------------------------------------------------------------

type MockDB struct {
	CloseFn             func() error
	ImageStoreFn        func() store.ImageStore
	PlaylistStoreFn     func() store.PlaylistStore
	HistoryStoreFn      func() store.HistoryStore
	StateStoreFn        func() store.StateStore
	MonitorStateStoreFn func() store.MonitorStateStore
	FolderStoreFn       func() store.FolderStore
}

func (m *MockDB) Close() error {
	if m.CloseFn != nil {
		return m.CloseFn()
	}
	return nil
}

func (m *MockDB) ImageStore() store.ImageStore {
	if m.ImageStoreFn != nil {
		return m.ImageStoreFn()
	}
	return nil
}

func (m *MockDB) PlaylistStore() store.PlaylistStore {
	if m.PlaylistStoreFn != nil {
		return m.PlaylistStoreFn()
	}
	return nil
}

func (m *MockDB) HistoryStore() store.HistoryStore {
	if m.HistoryStoreFn != nil {
		return m.HistoryStoreFn()
	}
	return nil
}

func (m *MockDB) StateStore() store.StateStore {
	if m.StateStoreFn != nil {
		return m.StateStoreFn()
	}
	return nil
}

func (m *MockDB) MonitorStateStore() store.MonitorStateStore {
	if m.MonitorStateStoreFn != nil {
		return m.MonitorStateStoreFn()
	}
	return nil
}

func (m *MockDB) FolderStore() store.FolderStore {
	if m.FolderStoreFn != nil {
		return m.FolderStoreFn()
	}
	return nil
}

// ---------------------------------------------------------------------------
// 8. MockBus
// ---------------------------------------------------------------------------

type MockBus struct {
	PublishFn     func(event events.Event)
	SubscribeFn   func(types ...events.EventType) <-chan events.Event
	UnsubscribeFn func(ch <-chan events.Event)
	CloseFn       func()
}

func (m *MockBus) Publish(event events.Event) {
	if m.PublishFn != nil {
		m.PublishFn(event)
	}
}

func (m *MockBus) Subscribe(types ...events.EventType) <-chan events.Event {
	if m.SubscribeFn != nil {
		return m.SubscribeFn(types...)
	}
	return nil
}

func (m *MockBus) Unsubscribe(ch <-chan events.Event) {
	if m.UnsubscribeFn != nil {
		m.UnsubscribeFn(ch)
	}
}

func (m *MockBus) Close() {
	if m.CloseFn != nil {
		m.CloseFn()
	}
}

// ---------------------------------------------------------------------------
// 9. MockConfigManager
// ---------------------------------------------------------------------------

type MockConfigManager struct {
	GetConfigFn            func() (*config.Config, error)
	UpdateConfigFn         func(section string, values map[string]any) error
	GetSectionFn           func(section string) (map[string]any, error)
	GetBackendConfigFn     func(backendName string) (json.RawMessage, error)
	SetBackendConfigFn     func(backendName string, raw json.RawMessage) error
	GetActiveBackendTypeFn func() string
	SetActiveBackendTypeFn func(name string) error
	GetSelectionModeFn     func() string
	GetAutoPrioritiesFn    func() config.AutoPriorities
	OnConfigChangeFn       func(callback func(section string))
	GetSocketPathFn        func() string
	GetImagesDirFn         func() string
	GetThumbnailsDirFn     func() string
	GetDatabaseDirFn       func() string
	GetLogFileFn           func() string
}

func (m *MockConfigManager) GetConfig() (*config.Config, error) {
	if m.GetConfigFn != nil {
		return m.GetConfigFn()
	}
	return nil, nil
}

func (m *MockConfigManager) UpdateConfig(section string, values map[string]any) error {
	if m.UpdateConfigFn != nil {
		return m.UpdateConfigFn(section, values)
	}
	return nil
}

func (m *MockConfigManager) GetSection(section string) (map[string]any, error) {
	if m.GetSectionFn != nil {
		return m.GetSectionFn(section)
	}
	return nil, nil
}

func (m *MockConfigManager) GetBackendConfig(backendName string) (json.RawMessage, error) {
	if m.GetBackendConfigFn != nil {
		return m.GetBackendConfigFn(backendName)
	}
	return nil, nil
}

func (m *MockConfigManager) SetBackendConfig(backendName string, raw json.RawMessage) error {
	if m.SetBackendConfigFn != nil {
		return m.SetBackendConfigFn(backendName, raw)
	}
	return nil
}

func (m *MockConfigManager) GetActiveBackendType() string {
	if m.GetActiveBackendTypeFn != nil {
		return m.GetActiveBackendTypeFn()
	}
	return ""
}

func (m *MockConfigManager) SetActiveBackendType(name string) error {
	if m.SetActiveBackendTypeFn != nil {
		return m.SetActiveBackendTypeFn(name)
	}
	return nil
}

func (m *MockConfigManager) GetSelectionMode() string {
	if m.GetSelectionModeFn != nil {
		return m.GetSelectionModeFn()
	}
	return "fixed"
}

func (m *MockConfigManager) GetAutoPriorities() config.AutoPriorities {
	if m.GetAutoPrioritiesFn != nil {
		return m.GetAutoPrioritiesFn()
	}
	return config.AutoPriorities{}
}

func (m *MockConfigManager) OnConfigChange(callback func(section string)) {
	if m.OnConfigChangeFn != nil {
		m.OnConfigChangeFn(callback)
	}
}

func (m *MockConfigManager) GetSocketPath() string {
	if m.GetSocketPathFn != nil {
		return m.GetSocketPathFn()
	}
	return ""
}

func (m *MockConfigManager) GetImagesDir() string {
	if m.GetImagesDirFn != nil {
		return m.GetImagesDirFn()
	}
	return ""
}

func (m *MockConfigManager) GetThumbnailsDir() string {
	if m.GetThumbnailsDirFn != nil {
		return m.GetThumbnailsDirFn()
	}
	return ""
}

func (m *MockConfigManager) GetDatabaseDir() string {
	if m.GetDatabaseDirFn != nil {
		return m.GetDatabaseDirFn()
	}
	return ""
}

func (m *MockConfigManager) GetLogFile() string {
	if m.GetLogFileFn != nil {
		return m.GetLogFileFn()
	}
	return ""
}

// ---------------------------------------------------------------------------
// 10. MockBackend
// ---------------------------------------------------------------------------

type MockBackend struct {
	NameFn             func() string
	IsAvailableFn      func() bool
	CapabilitiesFn     func() backend.Capabilities
	InitializeFn       func(ctx context.Context) error
	ShutdownFn         func(ctx context.Context) error
	SetWallpaperFn     func(ctx context.Context, req backend.WallpaperRequest) error
	RegisterDefaultsFn func(v *viper.Viper)
	ValidateConfigFn   func(raw json.RawMessage) error
	ParseConfigFn      func(raw json.RawMessage) (any, error)
	// TryBatchRestoreFn, when non-nil, makes MockBackend satisfy the wallpaper.batchRestorer
	// optional interface so restore tests can exercise the batched code path.
	TryBatchRestoreFn func(ctx context.Context, states []store.MonitorState, connected map[string]monitor.Monitor, images store.ImageStore) (*backend.WallpaperRequest, []store.MonitorState, []media.MediaType, bool)
}

func (m *MockBackend) Name() string {
	if m.NameFn != nil {
		return m.NameFn()
	}
	return ""
}

func (m *MockBackend) IsAvailable() bool {
	if m.IsAvailableFn != nil {
		return m.IsAvailableFn()
	}
	return false
}

func (m *MockBackend) Capabilities() backend.Capabilities {
	if m.CapabilitiesFn != nil {
		return m.CapabilitiesFn()
	}
	return backend.Capabilities{}
}

func (m *MockBackend) Initialize(ctx context.Context) error {
	if m.InitializeFn != nil {
		return m.InitializeFn(ctx)
	}
	return nil
}

func (m *MockBackend) Shutdown(ctx context.Context) error {
	if m.ShutdownFn != nil {
		return m.ShutdownFn(ctx)
	}
	return nil
}

func (m *MockBackend) SetWallpaper(ctx context.Context, req backend.WallpaperRequest) error {
	if m.SetWallpaperFn != nil {
		return m.SetWallpaperFn(ctx, req)
	}
	return nil
}

func (m *MockBackend) RegisterDefaults(v *viper.Viper) {
	if m.RegisterDefaultsFn != nil {
		m.RegisterDefaultsFn(v)
	}
}

func (m *MockBackend) ValidateConfig(raw json.RawMessage) error {
	if m.ValidateConfigFn != nil {
		return m.ValidateConfigFn(raw)
	}
	return nil
}

func (m *MockBackend) ParseConfig(raw json.RawMessage) (any, error) {
	if m.ParseConfigFn != nil {
		return m.ParseConfigFn(raw)
	}
	return nil, nil
}

// TryBatchRestore satisfies the wallpaper.batchRestorer optional interface when
// TryBatchRestoreFn is set. If nil the method is absent from the type and the
// restore path falls back to per-monitor calls (same as non-utauri backends).
func (m *MockBackend) TryBatchRestore(ctx context.Context, states []store.MonitorState, connected map[string]monitor.Monitor, images store.ImageStore) (*backend.WallpaperRequest, []store.MonitorState, []media.MediaType, bool) {
	if m.TryBatchRestoreFn != nil {
		return m.TryBatchRestoreFn(ctx, states, connected, images)
	}
	return nil, nil, nil, false
}

func (m *MockBackend) OnConfigChanged(_ context.Context, _ json.RawMessage) error {
	return nil
}

// ---------------------------------------------------------------------------
// 11. MockRegistry
// ---------------------------------------------------------------------------

type MockRegistry struct {
	RegisterFn   func(b backend.Backend) error
	GetFn        func(name string) (backend.Backend, bool)
	ActiveFn     func() backend.Backend
	HasActiveFn  func() bool
	SetActiveFn  func(name string) error
	AvailableFn  func() []backend.BackendInfo
	CompatibleFn func(compositor monitor.CompositorType) []backend.BackendInfo
}

func (m *MockRegistry) Register(b backend.Backend) error {
	if m.RegisterFn != nil {
		return m.RegisterFn(b)
	}
	return nil
}

func (m *MockRegistry) Get(name string) (backend.Backend, bool) {
	if m.GetFn != nil {
		return m.GetFn(name)
	}
	return nil, false
}

func (m *MockRegistry) Active() backend.Backend {
	if m.ActiveFn != nil {
		return m.ActiveFn()
	}
	return nil
}

func (m *MockRegistry) HasActive() bool {
	if m.HasActiveFn != nil {
		return m.HasActiveFn()
	}
	return m.ActiveFn != nil
}

func (m *MockRegistry) SetActive(name string) error {
	if m.SetActiveFn != nil {
		return m.SetActiveFn(name)
	}
	return nil
}

func (m *MockRegistry) Available() []backend.BackendInfo {
	if m.AvailableFn != nil {
		return m.AvailableFn()
	}
	return nil
}

func (m *MockRegistry) Compatible(compositor monitor.CompositorType) []backend.BackendInfo {
	if m.CompatibleFn != nil {
		return m.CompatibleFn(compositor)
	}
	return nil
}

// ---------------------------------------------------------------------------
// 12. MockMonitorManager
// ---------------------------------------------------------------------------

type MockMonitorManager struct {
	GetMonitorsFn      func(ctx context.Context) ([]monitor.Monitor, error)
	GetMonitorByNameFn func(ctx context.Context, name string) (monitor.Monitor, error)
	RefreshFn          func(ctx context.Context) error
	CompositorFn       func() monitor.CompositorType
}

func (m *MockMonitorManager) GetMonitors(ctx context.Context) ([]monitor.Monitor, error) {
	if m.GetMonitorsFn != nil {
		return m.GetMonitorsFn(ctx)
	}
	return nil, nil
}

func (m *MockMonitorManager) GetMonitorByName(ctx context.Context, name string) (monitor.Monitor, error) {
	if m.GetMonitorByNameFn != nil {
		return m.GetMonitorByNameFn(ctx, name)
	}
	return monitor.Monitor{}, nil
}

func (m *MockMonitorManager) Refresh(ctx context.Context) error {
	if m.RefreshFn != nil {
		return m.RefreshFn(ctx)
	}
	return nil
}

func (m *MockMonitorManager) Compositor() monitor.CompositorType {
	if m.CompositorFn != nil {
		return m.CompositorFn()
	}
	return ""
}

// ---------------------------------------------------------------------------
// 13. MockMonitorProvider
// ---------------------------------------------------------------------------

type MockMonitorProvider struct {
	NameFn       func() string
	CompositorFn func() monitor.CompositorType
	PriorityFn   func() int
	DetectFn     func(ctx context.Context) ([]monitor.Monitor, error)
}

func (m *MockMonitorProvider) Name() string {
	if m.NameFn != nil {
		return m.NameFn()
	}
	return ""
}

func (m *MockMonitorProvider) Compositor() monitor.CompositorType {
	if m.CompositorFn != nil {
		return m.CompositorFn()
	}
	return ""
}

func (m *MockMonitorProvider) Priority() int {
	if m.PriorityFn != nil {
		return m.PriorityFn()
	}
	return 0
}

func (m *MockMonitorProvider) Detect(ctx context.Context) ([]monitor.Monitor, error) {
	if m.DetectFn != nil {
		return m.DetectFn(ctx)
	}
	return nil, nil
}

// ---------------------------------------------------------------------------
// 14. MockScheduler
// ---------------------------------------------------------------------------

type MockScheduler struct {
	StartFn                 func(callback func(index int) bool)
	StopFn                  func()
	PauseFn                 func()
	ResumeFn                func()
	NextChangeAtFn          func() *time.Time
	AfterManualNavigationFn func(playlistImageIndex int)
}

func (m *MockScheduler) Start(callback func(index int) bool) {
	if m.StartFn != nil {
		m.StartFn(callback)
	}
}

func (m *MockScheduler) Stop() {
	if m.StopFn != nil {
		m.StopFn()
	}
}

func (m *MockScheduler) Pause() {
	if m.PauseFn != nil {
		m.PauseFn()
	}
}

func (m *MockScheduler) Resume() {
	if m.ResumeFn != nil {
		m.ResumeFn()
	}
}

func (m *MockScheduler) NextChangeAt() *time.Time {
	if m.NextChangeAtFn != nil {
		return m.NextChangeAtFn()
	}
	return nil
}

func (m *MockScheduler) AfterManualNavigation(playlistImageIndex int) {
	if m.AfterManualNavigationFn != nil {
		m.AfterManualNavigationFn(playlistImageIndex)
	}
}
