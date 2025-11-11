package playlist

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"math/rand"
	"sync"
	"time"

	"waypaper-engine/daemon-go/internal/backend"
	"waypaper-engine/daemon-go/internal/config"
	"waypaper-engine/daemon-go/internal/monitor"
	"waypaper-engine/daemon-go/internal/store"
)

// Manager manages playlist instances
type Manager struct {
	store           store.JSONDBManager
	wallpaperSetter WallpaperSetter
	logger          *slog.Logger
	config          *config.WaypaperConfig
	instances       map[string]*Instance
	mu              sync.RWMutex
	historyLimit    int
	eventChan       chan any
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
	ActiveMonitor *monitor.MonitorSelection
	Paused        bool
	CurrentIndex  int
	// Timer management for automatic rotation
	ticker        *time.Ticker
	timerDone     chan bool
	nextImageTime time.Time
	playlistType  string // "timer", "manual", "time_of_day", "day_of_week"
	interval      int    // seconds for timer-based playlists
}

// NewManager creates a new playlist manager
func NewManager(store store.JSONDBManager, wallpaperSetter WallpaperSetter, logger *slog.Logger, config *config.WaypaperConfig) *Manager {
	return &Manager{
		store:           store,
		wallpaperSetter: wallpaperSetter,
		logger:          logger,
		config:          config,
		instances:       make(map[string]*Instance),
		eventChan:       make(chan any, 100),
	}
}

// SetHistoryLimit sets the history limit
func (m *Manager) SetHistoryLimit(limit int) {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.historyLimit = limit
	m.logger.Debug("SetHistoryLimit called", "limit", limit)
}

// StartPlaylist starts a playlist, automatically stopping any conflicting playlists
func (m *Manager) StartPlaylist(ctx context.Context, playlistID int64, activeMonitor *monitor.MonitorSelection) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	m.logger.Info("StartPlaylist called", "playlistID", playlistID, "monitor", activeMonitor.ID)

	// Load playlist to get configuration
	playlists, err := m.store.LoadPlaylists()
	if err != nil {
		return fmt.Errorf("failed to load playlists: %w", err)
	}

	var playlist *store.Playlist
	playlistIDStr := fmt.Sprintf("%d", playlistID)
	for _, pl := range playlists {
		if pl.ID == playlistIDStr {
			playlist = &pl
			break
		}
	}

	if playlist == nil {
		return fmt.Errorf("playlist with ID %s not found", playlistIDStr)
	}

	if len(playlist.Images) == 0 {
		return fmt.Errorf("playlist %s is empty (no images)", playlist.Name)
	}

	// Check for conflicts: stop any playlists running on monitors that overlap with the new playlist
	conflictingMonitors := m.findConflictingMonitors(activeMonitor)

	for _, monitorName := range conflictingMonitors {
		if instance, exists := m.instances[monitorName]; exists {
			m.logger.Info("Stopping conflicting playlist",
				"conflictingMonitor", monitorName,
				"conflictingPlaylist", instance.PlaylistName,
				"newMonitor", activeMonitor.ID)

			// Stop the conflicting playlist (this will clean up timers)
			m.stopInstanceInternal(instance)
			delete(m.instances, monitorName)
		}
	}

	// Get playlist configuration
	playlistType := "manual" // default
	interval := 300          // default 5 minutes
	if playlist.Configuration.Type != "" {
		playlistType = playlist.Configuration.Type
	}
	if playlist.Configuration.Interval != nil && *playlist.Configuration.Interval > 0 {
		interval = *playlist.Configuration.Interval
	}

	// Create new instance
	instance := &Instance{
		PlaylistID:    playlistID,
		PlaylistName:  playlist.Name,
		ActiveMonitor: activeMonitor,
		Paused:        false,
		CurrentIndex:  0,
		timerDone:     make(chan bool),
		playlistType:  playlistType,
		interval:      interval,
	}

	m.instances[activeMonitor.ID] = instance

	// Emit event
	select {
	case m.eventChan <- map[string]any{
		"type":        "playlist_started",
		"playlistID":  playlistID,
		"monitorName": activeMonitor.ID,
	}:
	default:
		// Channel full, drop event
	}

	// Unlock before starting playlist execution to avoid deadlock
	m.mu.Unlock()

	// Start appropriate playlist execution based on type
	switch playlistType {
	case "timer":
		if interval > 0 {
			m.logger.Info("Starting timer-based playlist", "interval", interval, "seconds", interval)
			m.mu.Lock()
			instance.ticker = time.NewTicker(time.Duration(interval) * time.Second)
			m.mu.Unlock()
			go m.runPlaylistTimer(ctx, activeMonitor.ID)
		}
	case "time_of_day":
		m.logger.Info("Starting TIME_OF_DAY playlist", "playlist", playlist.Name)
		if err := m.runTimeOfDayPlaylist(ctx, activeMonitor.ID, playlist); err != nil {
			m.logger.Error("Failed to start TIME_OF_DAY playlist", "error", err)
			return err
		}
	case "day_of_week":
		m.logger.Info("Starting DAY_OF_WEEK playlist", "playlist", playlist.Name)
		if err := m.runDayOfWeekPlaylist(ctx, activeMonitor.ID, playlist); err != nil {
			m.logger.Error("Failed to start DAY_OF_WEEK playlist", "error", err)
			return err
		}
	case "manual", "never":
		m.logger.Info("Starting manual playlist (no automatic rotation)", "playlist", playlist.Name)
		// Set first image for manual/never playlists
		if err := m.setImageAtIndex(ctx, activeMonitor.ID, 0); err != nil {
			m.logger.Error("Failed to set initial image", "error", err)
			return err
		}
	default:
		m.logger.Warn("Unknown playlist type, treating as manual", "type", playlistType)
	}

	// Re-lock before returning (since defer unlock is at the top)
	m.mu.Lock()

	return nil
}

// findConflictingMonitors finds monitors that would conflict with the new playlist
func (m *Manager) findConflictingMonitors(newMonitor *monitor.MonitorSelection) []string {
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

	return fmt.Errorf("no playlist running on monitor %s", monitorName)
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
			CurrentIndex:  instance.CurrentIndex,
		}
		result[monitorName] = instanceCopy
	}

	return result
}

// StopPlaylist stops a playlist
func (m *Manager) StopPlaylist(monitorName string) error {
	m.mu.Lock()
	instance, exists := m.instances[monitorName]
	if exists {
		// Stop the instance and clean up resources
		m.stopInstanceInternal(instance)
		delete(m.instances, monitorName)
	}
	m.mu.Unlock()

	if exists {
		m.logger.Info("StopPlaylist called", "monitor", monitorName)
		// Emit event
		select {
		case m.eventChan <- map[string]any{
			"type":        "playlist_stopped",
			"monitorName": monitorName,
			"playlistID":  instance.PlaylistID,
		}:
		default:
			// Channel full, drop event
		}
	}
	return nil
}

// PausePlaylist pauses a playlist
func (m *Manager) PausePlaylist(monitorName string) error {
	m.mu.Lock()
	instance, ok := m.instances[monitorName]
	if ok {
		instance.Paused = true
		// Stop the ticker if it's running
		if instance.ticker != nil {
			instance.ticker.Stop()
			instance.ticker = nil
		}
	}
	m.mu.Unlock()

	if !ok {
		return fmt.Errorf("no playlist running on monitor %s", monitorName)
	}

	m.logger.Info("PausePlaylist called", "monitor", monitorName)
	// Emit event
	select {
	case m.eventChan <- map[string]any{
		"type":        "playlist_paused",
		"monitorName": monitorName,
		"playlistID":  instance.PlaylistID,
	}:
	default:
		// Channel full, drop event
	}
	return nil
}

// ResumePlaylist resumes a playlist
func (m *Manager) ResumePlaylist(monitorName string) error {
	m.mu.Lock()
	instance, ok := m.instances[monitorName]
	if ok {
		instance.Paused = false
		// Restart the ticker if it's a timer playlist
		if instance.playlistType == "timer" && instance.interval > 0 && instance.ticker == nil {
			instance.ticker = time.NewTicker(time.Duration(instance.interval) * time.Second)
			// The goroutine is still running, it will pick up the new ticker
			m.logger.Info("Restarting timer for playlist", "monitorName", monitorName, "interval", instance.interval)
		}
	}
	m.mu.Unlock()

	if !ok {
		return fmt.Errorf("no playlist running on monitor %s", monitorName)
	}

	m.logger.Info("ResumePlaylist called", "monitor", monitorName)
	// Emit event
	select {
	case m.eventChan <- map[string]any{
		"type":        "playlist_resumed",
		"monitorName": monitorName,
		"playlistID":  instance.PlaylistID,
	}:
	default:
		// Channel full, drop event
	}
	return nil
}

// NextImage advances to next image
func (m *Manager) NextImage(ctx context.Context, monitorName string) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	instance, exists := m.instances[monitorName]
	if !exists {
		return fmt.Errorf("no playlist running on monitor %s", monitorName)
	}

	// Get playlist from store
	playlists, err := m.store.LoadPlaylists()
	if err != nil {
		return fmt.Errorf("failed to load playlists: %w", err)
	}

	var playlist *store.Playlist
	playlistIDStr := fmt.Sprintf("%d", instance.PlaylistID)
	for _, pl := range playlists {
		if pl.ID == playlistIDStr {
			playlist = &pl
			break
		}
	}

	if playlist == nil {
		return fmt.Errorf("playlist with ID %s not found", playlistIDStr)
	}
	if len(playlist.Images) == 0 {
		playlistName := playlist.Name
		if playlistName == "" {
			playlistName = playlistIDStr
		}
		return fmt.Errorf("playlist %s is empty (no images)", playlistName)
	}

	// Calculate next index using current index
	nextIndex := (instance.CurrentIndex + 1) % len(playlist.Images)
	instance.CurrentIndex = nextIndex
	nextImage := playlist.Images[nextIndex]

	// Set image via wallpaper setter
	// Use the monitor info from the instance if available, otherwise create a basic one
	activeMonitor := instance.ActiveMonitor
	if activeMonitor == nil {
		activeMonitor = &monitor.MonitorSelection{
			ID:       monitorName,
			Monitors: []monitor.Monitor{{Name: monitorName, Width: 1920, Height: 1080}},
			Mode:     monitor.MonitorModeExtend,
		}
	}

	err = m.setWallpaperWithBackend(ctx, nextImage.ImagePath, activeMonitor, backend.BackendType(playlist.Backend.BackendType))
	if err != nil {
		return err
	}

	// Emit event
	select {
	case m.eventChan <- map[string]any{
		"type":        "playlist_image_changed",
		"monitorName": monitorName,
		"playlistID":  instance.PlaylistID,
		"imageIndex":  nextIndex,
		"imageID":     nextImage.ImageID,
	}:
	default:
		// Channel full, drop event
	}

	return nil
}

// PreviousImage goes to previous image
func (m *Manager) PreviousImage(ctx context.Context, monitorName string) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	instance, exists := m.instances[monitorName]
	if !exists {
		return fmt.Errorf("no playlist running on monitor %s", monitorName)
	}

	// Get playlist from store
	playlists, err := m.store.LoadPlaylists()
	if err != nil {
		return fmt.Errorf("failed to load playlists: %w", err)
	}

	var playlist *store.Playlist
	playlistIDStr := fmt.Sprintf("%d", instance.PlaylistID)
	for _, pl := range playlists {
		if pl.ID == playlistIDStr {
			playlist = &pl
			break
		}
	}

	if playlist == nil {
		return fmt.Errorf("playlist with ID %s not found", playlistIDStr)
	}
	if len(playlist.Images) == 0 {
		playlistName := playlist.Name
		if playlistName == "" {
			playlistName = playlistIDStr
		}
		return fmt.Errorf("playlist %s is empty (no images)", playlistName)
	}

	// Calculate previous index using current index with wrap-around
	prevIndex := (instance.CurrentIndex - 1 + len(playlist.Images)) % len(playlist.Images)
	instance.CurrentIndex = prevIndex
	prevImage := playlist.Images[prevIndex]

	// Set image via wallpaper setter
	// Use the monitor info from the instance if available, otherwise create a basic one
	activeMonitor := instance.ActiveMonitor
	if activeMonitor == nil {
		activeMonitor = &monitor.MonitorSelection{
			ID:       monitorName,
			Monitors: []monitor.Monitor{{Name: monitorName, Width: 1920, Height: 1080}},
			Mode:     monitor.MonitorModeExtend,
		}
	}

	err = m.setWallpaperWithBackend(ctx, prevImage.ImagePath, activeMonitor, backend.BackendType(playlist.Backend.BackendType))
	if err != nil {
		return err
	}

	// Emit event
	select {
	case m.eventChan <- map[string]any{
		"type":        "playlist_image_changed",
		"monitorName": monitorName,
		"playlistID":  instance.PlaylistID,
		"imageIndex":  prevIndex,
		"imageID":     prevImage.ImageID,
	}:
	default:
		// Channel full, drop event
	}

	return nil
}

// SetImage sets a specific image with automatic backend selection
func (m *Manager) SetImage(ctx context.Context, imageID int64, activeMonitor *monitor.MonitorSelection, playlistBackend *backend.BackendConfig) error {
	m.logger.Info("SetImage called", "imageID", imageID, "monitor", activeMonitor.ID)

	// Get image from store
	images, err := m.store.LoadImageGallery()
	if err != nil {
		return fmt.Errorf("failed to load image gallery: %w", err)
	}

	var image *store.Image
	for _, img := range images {
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
func (m *Manager) selectBackendForImage(playlistBackend *backend.BackendConfig, image *store.Image) (backend.BackendType, error) {
	// Priority 1: Playlist-specific backend
	if playlistBackend != nil && playlistBackend.BackendType != "" {
		m.logger.Info("using playlist-specific backend", "backend", playlistBackend.BackendType)
		return playlistBackend.BackendType, nil
	}

	// Priority 2: Default backend from config
	defaultBackend := backend.BackendType(m.config.Backend.Type)
	m.logger.Info("using default backend from config", "backend", defaultBackend)
	return defaultBackend, nil
}

// setWallpaperWithBackend sets wallpaper using a specific backend
func (m *Manager) setWallpaperWithBackend(ctx context.Context, imagePath string, activeMonitor *monitor.MonitorSelection, backendType backend.BackendType) error {
	// Create backend config from TOML config
	backendConfig := &backend.BackendConfig{
		BackendType:        backendType,
		TransitionDuration: float64(m.config.Backend.Swww.TransitionDuration) / 1000, // Convert ms to seconds
		TransitionType:     string(m.config.Backend.Swww.TransitionType),
		PositionType:       "center", // Default
		ResizeType:         "fit",    // Default
		CustomOptions:      make(map[string]any),
	}

	// Handle multi-monitor vs single monitor
	if activeMonitor.Mode == monitor.MonitorModeExtend && len(activeMonitor.Monitors) > 1 {
		// Multi-monitor: set on all monitors
		return m.wallpaperSetter.SetWallpaperAll(ctx, imagePath, backendConfig)
	} else {
		// Single monitor: set on specific monitor
		if len(activeMonitor.Monitors) > 0 {
			return m.wallpaperSetter.SetWallpaper(ctx, imagePath, activeMonitor.Monitors[0].Name, backendConfig)
		}
		return errors.New("no monitors configured")
	}
}

// RandomImage sets a random image
func (m *Manager) RandomImage(ctx context.Context, monitorName string) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	instance, exists := m.instances[monitorName]
	if !exists {
		return fmt.Errorf("no playlist running on monitor %s", monitorName)
	}

	// Get playlist from store
	playlists, err := m.store.LoadPlaylists()
	if err != nil {
		return fmt.Errorf("failed to load playlists: %w", err)
	}

	var playlist *store.Playlist
	playlistIDStr := fmt.Sprintf("%d", instance.PlaylistID)
	for _, pl := range playlists {
		if pl.ID == playlistIDStr {
			playlist = &pl
			break
		}
	}

	if playlist == nil {
		return fmt.Errorf("playlist with ID %s not found", playlistIDStr)
	}
	if len(playlist.Images) == 0 {
		playlistName := playlist.Name
		if playlistName == "" {
			playlistName = playlistIDStr
		}
		return fmt.Errorf("playlist %s is empty (no images)", playlistName)
	}

	// Select random image
	randomIndex := rand.Intn(len(playlist.Images))
	randomImage := playlist.Images[randomIndex]

	// Set image via wallpaper setter
	// Use the monitor info from the instance if available, otherwise create a basic one
	activeMonitor := instance.ActiveMonitor
	if activeMonitor == nil {
		activeMonitor = &monitor.MonitorSelection{
			ID:       monitorName,
			Monitors: []monitor.Monitor{{Name: monitorName, Width: 1920, Height: 1080}},
			Mode:     monitor.MonitorModeExtend,
		}
	}

	return m.setWallpaperWithBackend(ctx, randomImage.ImagePath, activeMonitor, backend.BackendType(playlist.Backend.BackendType))
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

// GetEventChan returns a channel for playlist events
func (m *Manager) GetEventChan() <-chan any {
	return m.eventChan
}

// StopPlaylistByName stops a playlist by name
func (m *Manager) StopPlaylistByName(name string) error {
	m.mu.RLock()
	var monitorName string
	for mn, instance := range m.instances {
		if instance.PlaylistName == name {
			monitorName = mn
			break
		}
	}
	m.mu.RUnlock()

	if monitorName == "" {
		return fmt.Errorf("playlist with name %s not found", name)
	}

	return m.StopPlaylist(monitorName)
}

// StopPlaylistByMonitorName stops a playlist by monitor name
func (m *Manager) StopPlaylistByMonitorName(monitorName string) error {
	return m.StopPlaylist(monitorName)
}

// StopPlaylistOnRemovedMonitors stops playlists on removed monitors
func (m *Manager) StopPlaylistOnRemovedMonitors(monitorNames []string) error {
	var firstErr error
	for _, monitorName := range monitorNames {
		if instance, exists := m.instances[monitorName]; exists {
			if err := m.StopPlaylist(monitorName); err != nil && firstErr == nil {
				firstErr = err
			}
			_ = instance // Use instance to avoid unused variable
		}
	}
	return firstErr
}

// GetDiagnostics gets diagnostics for a monitor
func (m *Manager) GetDiagnostics(monitorName string) (map[string]any, error) {
	m.mu.RLock()
	instance, exists := m.instances[monitorName]
	m.mu.RUnlock()

	if !exists {
		return nil, fmt.Errorf("no playlist running on monitor %s", monitorName)
	}

	// Get playlist to get total images
	playlists, err := m.store.LoadPlaylists()
	if err != nil {
		return map[string]any{
			"monitor":    monitorName,
			"status":     "error",
			"error":      err.Error(),
			"playlistId": instance.PlaylistID,
		}, nil
	}

	var playlist *store.Playlist
	playlistIDStr := fmt.Sprintf("%d", instance.PlaylistID)
	for _, pl := range playlists {
		if pl.ID == playlistIDStr {
			playlist = &pl
			break
		}
	}

	totalImages := 0
	if playlist != nil {
		totalImages = len(playlist.Images)
	}

	return map[string]any{
		"monitor":     monitorName,
		"playlistId":  instance.PlaylistID,
		"playlistName": instance.PlaylistName,
		"currentIndex": instance.CurrentIndex,
		"paused":      instance.Paused,
		"totalImages": totalImages,
		"status":      "ok",
	}, nil
}

// GetAllDiagnostics gets diagnostics for all monitors
func (m *Manager) GetAllDiagnostics() (map[string]any, error) {
	m.mu.RLock()
	monitorNames := make([]string, 0, len(m.instances))
	for monitorName := range m.instances {
		monitorNames = append(monitorNames, monitorName)
	}
	m.mu.RUnlock()

	result := make(map[string]any)
	for _, monitorName := range monitorNames {
		diagnostics, err := m.GetDiagnostics(monitorName)
		if err != nil {
			result[monitorName] = map[string]any{
				"status": "error",
				"error":  err.Error(),
			}
		} else {
			result[monitorName] = diagnostics
		}
	}

	return result, nil
}

// findImageIndex finds the index of an image in a playlist by ID
func (m *Manager) findImageIndex(images []store.PlaylistImage, imageID int64) int {
	for i, img := range images {
		if img.ImageID == fmt.Sprintf("%d", imageID) {
			return i
		}
	}
	return 0 // Default to first image if not found
}

// runPlaylistTimer runs the automatic rotation timer for a playlist
func (m *Manager) runPlaylistTimer(ctx context.Context, monitorName string) {
	m.logger.Info("Starting playlist timer goroutine", "monitor", monitorName)

	for {
		// Get instance and check if we should continue
		m.mu.RLock()
		instance, exists := m.instances[monitorName]
		if !exists {
			m.mu.RUnlock()
			m.logger.Info("Playlist instance no longer exists, stopping timer", "monitor", monitorName)
			return
		}

		ticker := instance.ticker
		timerDone := instance.timerDone
		paused := instance.Paused
		m.mu.RUnlock()

		if ticker == nil {
			m.logger.Info("Ticker is nil, stopping timer goroutine", "monitor", monitorName)
			return
		}

		select {
		case <-ticker.C:
			// Only advance if not paused
			if !paused {
				m.logger.Debug("Timer tick - advancing to next image", "monitor", monitorName)
				if err := m.NextImage(ctx, monitorName); err != nil {
					m.logger.Error("Failed to advance to next image", "monitor", monitorName, "error", err)
				}
			}
		case <-timerDone:
			m.logger.Info("Received stop signal, stopping timer", "monitor", monitorName)
			return
		case <-ctx.Done():
			m.logger.Info("Context cancelled, stopping timer", "monitor", monitorName)
			return
		}
	}
}

// stopInstanceInternal stops an instance and cleans up resources (must be called with lock held)
func (m *Manager) stopInstanceInternal(instance *Instance) {
	if instance == nil {
		return
	}

	// Stop ticker if running
	if instance.ticker != nil {
		instance.ticker.Stop()
		instance.ticker = nil
	}

	// Signal goroutine to stop
	if instance.timerDone != nil {
		close(instance.timerDone)
		instance.timerDone = nil
	}

	m.logger.Debug("Stopped playlist instance", "playlistID", instance.PlaylistID)
}
