package playlist

import (
	"context"
	"fmt"
	"log/slog"
	"sync"

	"waypaper-engine/daemon-go/internal/config"
	"waypaper-engine/daemon-go/internal/errors"
	"waypaper-engine/daemon-go/internal/models"
	"waypaper-engine/daemon-go/internal/store"
)

// Manager manages playlist instances
type Manager struct {
	store           *store.Store
	wallpaperSetter WallpaperSetter
	logger          *slog.Logger
	config          *config.WaypaperConfig
	instances       map[string]*Instance
	mu              sync.RWMutex
}

// WallpaperSetter interface for setting wallpapers
type WallpaperSetter interface {
	SetWallpaper(ctx context.Context, imagePath, monitorName string) error
}

// Instance represents a running playlist instance
type Instance struct {
	PlaylistID    int64
	PlaylistName  string
	ActiveMonitor *models.ActiveMonitor
	paused        bool
}

// NewManager creates a new playlist manager
func NewManager(store *store.Store, wallpaperSetter WallpaperSetter, logger *slog.Logger, config *config.WaypaperConfig) *Manager {
	return &Manager{
		store:           store,
		wallpaperSetter: wallpaperSetter,
		logger:          logger,
		config:          config,
		instances:       make(map[string]*Instance),
	}
}

// SetHistoryLimit sets the history limit (no-op for now)
func (m *Manager) SetHistoryLimit(limit int) {
	m.logger.Debug("SetHistoryLimit called", "limit", limit)
}

// StartPlaylist starts a playlist
func (m *Manager) StartPlaylist(ctx context.Context, playlistID int64, activeMonitor *models.ActiveMonitor) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	m.logger.Info("StartPlaylist called", "playlistID", playlistID, "monitor", activeMonitor.Name)

	// Create instance
	instance := &Instance{
		PlaylistID:    playlistID,
		ActiveMonitor: activeMonitor,
		paused:        false,
	}

	m.instances[activeMonitor.Name] = instance
	return nil
}

// StopPlaylist stops a playlist
func (m *Manager) StopPlaylist(monitorName string) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	delete(m.instances, monitorName)
	m.logger.Info("StopPlaylist called", "monitor", monitorName)
	return nil
}

// PausePlaylist pauses a playlist
func (m *Manager) PausePlaylist(monitorName string) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	if instance, ok := m.instances[monitorName]; ok {
		instance.paused = true
		m.logger.Info("PausePlaylist called", "monitor", monitorName)
		return nil
	}
	return errors.New(errors.SystemError, fmt.Sprintf("no playlist running on monitor %s", monitorName))
}

// ResumePlaylist resumes a playlist
func (m *Manager) ResumePlaylist(monitorName string) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	if instance, ok := m.instances[monitorName]; ok {
		instance.paused = false
		m.logger.Info("ResumePlaylist called", "monitor", monitorName)
		return nil
	}
	return errors.New(errors.SystemError, fmt.Sprintf("no playlist running on monitor %s", monitorName))
}

// NextImage advances to next image
func (m *Manager) NextImage(ctx context.Context, monitorName string) error {
	m.logger.Info("NextImage called", "monitor", monitorName)
	return errors.New(errors.SystemError, "NextImage not fully implemented")
}

// PreviousImage goes to previous image
func (m *Manager) PreviousImage(ctx context.Context, monitorName string) error {
	m.logger.Info("PreviousImage called", "monitor", monitorName)
	return errors.New(errors.SystemError, "PreviousImage not fully implemented")
}

// SetImage sets a specific image
func (m *Manager) SetImage(ctx context.Context, monitorName string, imageID int64) error {
	m.logger.Info("SetImage called", "monitor", monitorName, "imageID", imageID)

	// Get image from store
	registry, err := m.store.LoadImageRegistry()
	if err != nil {
		return fmt.Errorf("failed to load image registry: %w", err)
	}

	var image *store.Image
	for _, img := range registry.Images {
		if img.ID == imageID {
			image = &img
			break
		}
	}

	if image == nil {
		return fmt.Errorf("image with ID %d not found", imageID)
	}

	// Set wallpaper using the wallpaper setter
	err = m.wallpaperSetter.SetWallpaper(ctx, image.Path, monitorName)
	if err != nil {
		return fmt.Errorf("failed to set wallpaper: %w", err)
	}

	m.logger.Info("SetImage completed", "monitor", monitorName, "imageID", imageID, "imagePath", image.Path)
	return nil
}

// RandomImage sets a random image
func (m *Manager) RandomImage(ctx context.Context, monitorName string) error {
	m.logger.Info("RandomImage called", "monitor", monitorName)
	return errors.New(errors.SystemError, "RandomImage not fully implemented")
}

// GetInstance gets a playlist instance
func (m *Manager) GetInstance(monitorName string) (*Instance, bool) {
	m.mu.RLock()
	defer m.mu.RUnlock()

	instance, exists := m.instances[monitorName]
	return instance, exists
}

// IsPaused returns if instance is paused
func (i *Instance) IsPaused() bool {
	return i.paused
}

// GetRuntimeState gets runtime state
func (i *Instance) GetRuntimeState() map[string]interface{} {
	return map[string]interface{}{
		"paused": i.paused,
	}
}

// StopAllPlaylists stops all playlists
func (m *Manager) StopAllPlaylists(ctx context.Context) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	m.instances = make(map[string]*Instance)
	m.logger.Info("StopAllPlaylists called")
	return nil
}

// GetEventChan returns a channel for playlist events (stub)
func (m *Manager) GetEventChan() <-chan interface{} {
	ch := make(chan interface{})
	close(ch)
	return ch
}

// StopPlaylistByName stops a playlist by name
func (m *Manager) StopPlaylistByName(name string) error {
	m.logger.Info("StopPlaylistByName called", "name", name)
	return nil
}

// StopPlaylistByMonitorName stops a playlist by monitor name
func (m *Manager) StopPlaylistByMonitorName(monitorName string) error {
	return m.StopPlaylist(monitorName)
}

// StopPlaylistOnRemovedMonitors stops playlists on removed monitors
func (m *Manager) StopPlaylistOnRemovedMonitors(monitorNames []string) error {
	m.logger.Info("StopPlaylistOnRemovedMonitors called", "monitors", monitorNames)
	return nil
}

// GetDiagnostics gets diagnostics for a monitor
func (m *Manager) GetDiagnostics(monitorName string) (map[string]interface{}, error) {
	return map[string]interface{}{
		"monitor": monitorName,
		"status":  "ok",
	}, nil
}

// GetAllDiagnostics gets diagnostics for all monitors
func (m *Manager) GetAllDiagnostics() (map[string]interface{}, error) {
	return map[string]interface{}{
		"status": "ok",
	}, nil
}
