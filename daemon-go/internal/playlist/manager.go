package playlist

import (
	"context"
	"fmt"
	"log/slog"
	"sync"

	"waypaper-engine/daemon-go/internal/backend"
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
	SetWallpaper(ctx context.Context, imagePath, monitorName string, config *backend.BackendConfig) error
	SetWallpaperAll(ctx context.Context, imagePath string, config *backend.BackendConfig) error
}

// Instance represents a running playlist instance
type Instance struct {
	PlaylistID    int64
	PlaylistName  string
	ActiveMonitor *models.ActiveMonitor
	Paused        bool
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

// StartPlaylist starts a playlist, automatically stopping any conflicting playlists
func (m *Manager) StartPlaylist(ctx context.Context, playlistID int64, activeMonitor *models.ActiveMonitor) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	m.logger.Info("StartPlaylist called", "playlistID", playlistID, "monitor", activeMonitor.Name)

	// Check for conflicts: stop any playlists running on monitors that overlap with the new playlist
	conflictingMonitors := m.findConflictingMonitors(activeMonitor)

	for _, monitorName := range conflictingMonitors {
		if instance, exists := m.instances[monitorName]; exists {
			m.logger.Info("Stopping conflicting playlist",
				"conflictingMonitor", monitorName,
				"conflictingPlaylist", instance.PlaylistName,
				"newMonitor", activeMonitor.Name)

			// Stop the conflicting playlist
			delete(m.instances, monitorName)
		}
	}

	// Create new instance
	instance := &Instance{
		PlaylistID:    playlistID,
		PlaylistName:  "", // Will be set when we get the playlist name from store
		ActiveMonitor: activeMonitor,
		Paused:        false,
	}

	m.instances[activeMonitor.Name] = instance
	return nil
}

// findConflictingMonitors finds monitors that would conflict with the new playlist
func (m *Manager) findConflictingMonitors(newMonitor *models.ActiveMonitor) []string {
	var conflictingMonitors []string

	// Get all monitor names from the new playlist's monitor configuration
	newMonitorNames := make(map[string]bool)
	for _, monitor := range newMonitor.Monitors {
		newMonitorNames[monitor.Name] = true
	}

	// Check all currently running instances
	for monitorName, instance := range m.instances {
		// Get monitor names from the running instance
		runningMonitorNames := make(map[string]bool)
		for _, monitor := range instance.ActiveMonitor.Monitors {
			runningMonitorNames[monitor.Name] = true
		}

		// Check for overlap
		hasOverlap := false
		for newMonitorName := range newMonitorNames {
			if runningMonitorNames[newMonitorName] {
				hasOverlap = true
				break
			}
		}

		if hasOverlap {
			conflictingMonitors = append(conflictingMonitors, monitorName)
		}
	}

	return conflictingMonitors
}

// SetPlaylistName sets the playlist name for an instance (called after playlist is loaded)
func (m *Manager) SetPlaylistName(monitorName string, playlistName string) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	if instance, exists := m.instances[monitorName]; exists {
		instance.PlaylistName = playlistName
		m.logger.Info("SetPlaylistName", "monitor", monitorName, "playlist", playlistName)
		return nil
	}

	return errors.New(errors.SystemError, fmt.Sprintf("no playlist running on monitor %s", monitorName))
}

// GetRunningPlaylists returns information about all currently running playlists
func (m *Manager) GetRunningPlaylists() map[string]*Instance {
	m.mu.RLock()
	defer m.mu.RUnlock()

	// Return a copy to avoid race conditions
	result := make(map[string]*Instance)
	for monitorName, instance := range m.instances {
		// Create a copy of the instance
		instanceCopy := &Instance{
			PlaylistID:    instance.PlaylistID,
			PlaylistName:  instance.PlaylistName,
			ActiveMonitor: instance.ActiveMonitor,
			Paused:        instance.Paused,
		}
		result[monitorName] = instanceCopy
	}

	return result
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
		instance.Paused = true
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
		instance.Paused = false
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

// SetImage sets a specific image with automatic backend selection
func (m *Manager) SetImage(ctx context.Context, imageID int64, activeMonitor *models.ActiveMonitor, playlistBackend *store.BackendConfiguration) error {
	m.logger.Info("SetImage called", "imageID", imageID, "monitor", activeMonitor.Name)

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

	// Determine which backend to use
	backendType, err := m.selectBackendForImage(playlistBackend, image)
	if err != nil {
		return fmt.Errorf("failed to select backend: %w", err)
	}

	// Set wallpaper using the selected backend
	err = m.setWallpaperWithBackend(ctx, image.Path, activeMonitor, backendType)
	if err != nil {
		return fmt.Errorf("failed to set wallpaper: %w", err)
	}

	m.logger.Info("SetImage completed", "imageID", imageID, "imagePath", image.Path, "backend", backendType)
	return nil
}

// selectBackendForImage determines which backend to use for setting an image
func (m *Manager) selectBackendForImage(playlistBackend *store.BackendConfiguration, image *store.Image) (backend.BackendType, error) {
	// Priority 1: Playlist-specific backend
	if playlistBackend != nil && playlistBackend.Type != "" {
		m.logger.Info("using playlist-specific backend", "backend", playlistBackend.Type)
		return backend.BackendType(playlistBackend.Type), nil
	}

	// Priority 2: Default backend from config
	defaultBackend := backend.BackendType(m.config.Backend.Type)
	m.logger.Info("using default backend from config", "backend", defaultBackend)
	return defaultBackend, nil
}

// setWallpaperWithBackend sets wallpaper using a specific backend
func (m *Manager) setWallpaperWithBackend(ctx context.Context, imagePath string, activeMonitor *models.ActiveMonitor, backendType backend.BackendType) error {
	// Create backend config from TOML config
	backendConfig := &backend.BackendConfig{
		BackendType:        backendType,
		TransitionDuration: float64(m.config.Backend.Swww.TransitionDuration) / 1000, // Convert ms to seconds
		TransitionType:     m.config.Backend.Swww.TransitionType,
		PositionType:       "center", // Default
		ResizeType:         "fit",    // Default
		CustomOptions:      make(map[string]any),
	}

	// Handle multi-monitor vs single monitor
	if activeMonitor.ImageSetType == "extend" && len(activeMonitor.Monitors) > 1 {
		// Multi-monitor: set on all monitors
		return m.wallpaperSetter.SetWallpaperAll(ctx, imagePath, backendConfig)
	} else {
		// Single monitor: set on specific monitor
		return m.wallpaperSetter.SetWallpaper(ctx, imagePath, activeMonitor.Name, backendConfig)
	}
}

// SetImage sets a specific image (legacy method - now calls unified method)

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
	return i.Paused
}

// GetRuntimeState gets runtime state
func (i *Instance) GetRuntimeState() map[string]any {
	return map[string]any{
		"paused": i.Paused,
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
func (m *Manager) GetEventChan() <-chan any {
	ch := make(chan any)
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
func (m *Manager) GetDiagnostics(monitorName string) (map[string]any, error) {
	return map[string]any{
		"monitor": monitorName,
		"status":  "ok",
	}, nil
}

// GetAllDiagnostics gets diagnostics for all monitors
func (m *Manager) GetAllDiagnostics() (map[string]any, error) {
	return map[string]any{
		"status": "ok",
	}, nil
}
