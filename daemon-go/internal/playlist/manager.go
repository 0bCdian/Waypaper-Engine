package playlist

import (
	"context"
	"fmt"
	"log/slog"
	"math/rand"
	"sync"
	"time"

	"waypaper-engine/daemon-go/internal/db"
	"waypaper-engine/daemon-go/internal/errors"
	"waypaper-engine/daemon-go/internal/models"
	"waypaper-engine/daemon-go/internal/types"
)

// WallpaperSetter is an interface for setting wallpapers (allows mocking in tests)
type WallpaperSetter interface {
	SetWallpaper(ctx context.Context, imagePath, monitorName string) error
}

// Manager manages all active playlist instances.
type Manager struct {
	dbOps           *db.DatabaseOperations
	instances       map[string]*Instance // Map monitor name to playlist instance
	mu              sync.RWMutex
	eventChan       chan Event
	logger          *slog.Logger
	wallpaperSetter WallpaperSetter // Interface allows mocking in tests
	historyLimit    int             // Configurable history limit
}

// NewManager creates a new playlist manager.
func NewManager(dbOps *db.DatabaseOperations, wallpaperSetter WallpaperSetter, logger *slog.Logger) *Manager {
	return &Manager{
		dbOps:           dbOps,
		instances:       make(map[string]*Instance),
		eventChan:       make(chan Event, 10),
		logger:          logger,
		wallpaperSetter: wallpaperSetter,
		historyLimit:    50, // Default history limit
	}
}

// SetHistoryLimit sets the configurable history limit
func (m *Manager) SetHistoryLimit(limit int) {
	m.historyLimit = limit
}

// GetEventChan returns the event channel for external listeners
func (m *Manager) GetEventChan() <-chan Event {
	return m.eventChan
}

// Event represents a playlist event with rich metadata
type Event = types.Event

// createPlaylistEvent creates a playlist event with rich metadata
func (m *Manager) createPlaylistEvent(eventType types.EventType, instance *Instance, payload interface{}) Event {
	return Event{
		Type:    eventType,
		Payload: payload,
		Metadata: types.EventMetadata{
			Timestamp: time.Now().Format(time.RFC3339),
			Playlist: &types.PlaylistEventMetadata{
				ID:          instance.Playlist.Playlist.ID,
				Name:        instance.Playlist.Playlist.Name,
				Type:        instance.Playlist.Playlist.Type,
				ImageIndex:  instance.Playlist.Playlist.Currentimageindex,
				TotalImages: len(instance.Playlist.Images),
				IsActive:    true,
				IsPaused:    instance.paused,
			},
			Monitor: &types.MonitorEventMetadata{
				Name: instance.ActiveMonitor.Name,
			},
		},
	}
}

// createWallpaperEvent creates a wallpaper change event with rich metadata
func (m *Manager) createWallpaperEvent(instance *Instance, image *db.Image) Event {
	return Event{
		Type:    types.EventWallpaperChanged,
		Payload: image.Name,
		Metadata: types.EventMetadata{
			Timestamp: time.Now().Format(time.RFC3339),
			Image: &types.ImageEventMetadata{
				ID:     image.ID,
				Name:   image.Name,
				Width:  int(image.Width),
				Height: int(image.Height),
				Format: image.Format,
			},
			Playlist: &types.PlaylistEventMetadata{
				ID:          instance.Playlist.Playlist.ID,
				Name:        instance.Playlist.Playlist.Name,
				Type:        instance.Playlist.Playlist.Type,
				ImageIndex:  instance.Playlist.Playlist.Currentimageindex,
				TotalImages: len(instance.Playlist.Images),
				IsActive:    true,
				IsPaused:    instance.paused,
			},
			Monitor: &types.MonitorEventMetadata{
				Name: instance.ActiveMonitor.Name,
			},
		},
	}
}

// createDirectImageEvent creates a direct image change event without playlist context
func (m *Manager) createDirectImageEvent(image *db.Image, monitorName string) Event {
	return Event{
		Type:    types.EventImageChanged,
		Payload: image.Name,
		Metadata: types.EventMetadata{
			Timestamp: time.Now().Format(time.RFC3339),
			Image: &types.ImageEventMetadata{
				ID:     image.ID,
				Name:   image.Name,
				Width:  int(image.Width),
				Height: int(image.Height),
				Format: image.Format,
			},
			Monitor: &types.MonitorEventMetadata{
				Name: monitorName,
			},
		},
	}
}

// Instance represents a running playlist instance.
type Instance struct {
	Playlist      *db.PlaylistWithImages
	ActiveMonitor *models.ActiveMonitor
	Done          chan bool
	Timer         *time.Timer
	paused        bool
	timerInterval time.Duration // Stores the current timer interval (for timer playlists)
}

// PlaylistType constants
const (
	Timer     = "timer"
	Never     = "never"
	TimeOfDay = "timeofday"
	DayOfWeek = "dayofweek"
)

// StartPlaylist starts a new playlist instance.
func (m *Manager) StartPlaylist(ctx context.Context, playlistID int64, activeMonitor *models.ActiveMonitor) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	if _, ok := m.instances[activeMonitor.Name]; ok {
		return errors.New(errors.SystemError, fmt.Sprintf("playlist already running on monitor %s", activeMonitor.Name))
	}

	// First get the playlist name by ID
	playlistInfo, err := m.dbOps.GetPlaylistByID(ctx, playlistID)
	if err != nil {
		m.logger.Error("failed to get playlist info", "error", err)
		return errors.New(errors.DatabaseError, "failed to get playlist info").WithDetails(map[string]interface{}{"error": err.Error()})
	}

	playlist, err := m.dbOps.GetPlaylistWithImages(ctx, playlistInfo.Name)
	if err != nil {
		m.logger.Error("failed to get playlist", "error", err)
		return errors.New(errors.DatabaseError, "failed to get playlist").WithDetails(map[string]interface{}{"error": err.Error()})
	}

	// Create a new instance
	instance := &Instance{
		Playlist:      playlist,
		ActiveMonitor: activeMonitor,
		Done:          make(chan bool),
		paused:        false,
	}

	m.instances[activeMonitor.Name] = instance
	m.logger.Info("starting playlist", "playlist", playlist.Playlist.Name, "monitor", activeMonitor.Name)
	go m.runPlaylist(ctx, instance)

	m.eventChan <- m.createPlaylistEvent(types.EventPlaylistStarted, instance, instance.Playlist.Playlist.Name)

	return nil
}

// StopPlaylist stops a running playlist instance.
func (m *Manager) StopPlaylist(monitorName string) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	instance, ok := m.instances[monitorName]
	if !ok {
		return errors.New(errors.SystemError, fmt.Sprintf("no playlist running on monitor %s", monitorName))
	}

	if instance.Timer != nil {
		instance.Timer.Stop()
	}
	close(instance.Done)
	delete(m.instances, monitorName)

	m.logger.Info("stopped playlist", "playlist", instance.Playlist.Playlist.Name, "monitor", monitorName)
	m.eventChan <- m.createPlaylistEvent(types.EventPlaylistStopped, instance, instance.Playlist.Playlist.Name)

	return nil
}

// PausePlaylist pauses a running playlist instance.
func (m *Manager) PausePlaylist(monitorName string) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	instance, ok := m.instances[monitorName]
	if !ok {
		return errors.New(errors.SystemError, fmt.Sprintf("no playlist running on monitor %s", monitorName))
	}

	if instance.Playlist.Playlist.Type != Timer {
		return errors.New(errors.SystemError, "playlist type is not timer, cannot pause")
	}

	if !instance.paused {
		instance.paused = true
		if instance.Timer != nil {
			instance.Timer.Stop()
		}
		m.logger.Info("paused playlist", "playlist", instance.Playlist.Playlist.Name, "monitor", monitorName)
		m.eventChan <- m.createPlaylistEvent(types.EventPlaylistPaused, instance, instance.Playlist.Playlist.Name)
	}

	return nil
}

// ResumePlaylist resumes a paused playlist instance.
func (m *Manager) ResumePlaylist(monitorName string) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	instance, ok := m.instances[monitorName]
	if !ok {
		return errors.New(errors.SystemError, fmt.Sprintf("no playlist running on monitor %s", monitorName))
	}

	if instance.Playlist.Playlist.Type != Timer {
		return errors.New(errors.SystemError, "playlist type is not timer, cannot resume")
	}

	if instance.paused {
		instance.paused = false
		duration := time.Duration(instance.Playlist.Playlist.Interval.Int64) * time.Minute
		instance.Timer = time.NewTimer(duration)
		m.logger.Info("resumed playlist", "playlist", instance.Playlist.Playlist.Name, "monitor", monitorName)
		m.eventChan <- m.createPlaylistEvent(types.EventPlaylistResumed, instance, instance.Playlist.Playlist.Name)
	}

	return nil
}

// runPlaylist is the main loop for a playlist instance.
func (m *Manager) runPlaylist(ctx context.Context, instance *Instance) {
	m.logger.Info("running playlist", "playlist", instance.Playlist.Playlist.Name, "type", instance.Playlist.Playlist.Type)
	switch instance.Playlist.Playlist.Type {
	case Timer:
		m.runTimerPlaylist(ctx, instance)
	case Never:
		m.runNeverPlaylist(ctx, instance)
	case TimeOfDay:
		m.runTimeOfDayPlaylist(ctx, instance)
	case DayOfWeek:
		m.runDayOfWeekPlaylist(ctx, instance)
	}
}

// runNeverPlaylist sets the image once and never changes it
func (m *Manager) runNeverPlaylist(ctx context.Context, instance *Instance) {
	// Set initial image if there are images in the playlist
	if len(instance.Playlist.Images) == 0 {
		m.logger.Warn("never playlist has no images", "playlist", instance.Playlist.Playlist.Name)
		return
	}

	// Set the current image from the playlist's currentImageIndex
	currentIndex := instance.Playlist.Playlist.Currentimageindex
	if currentIndex < 0 || currentIndex >= int64(len(instance.Playlist.Images)) {
		m.logger.Warn("invalid currentImageIndex in never playlist, using 0",
			"playlist", instance.Playlist.Playlist.Name,
			"index", currentIndex,
			"imageCount", len(instance.Playlist.Images))
		currentIndex = 0
	}

	m.setImage(ctx, instance, currentIndex)

	// Never playlist doesn't auto-change, so we just wait for stop signal
	<-instance.Done
}

func (m *Manager) runTimerPlaylist(ctx context.Context, instance *Instance) {
	duration := time.Duration(instance.Playlist.Playlist.Interval.Int64) * time.Minute
	instance.timerInterval = duration // Store the interval for timer resets
	instance.Timer = time.NewTimer(duration)

	for {
		select {
		case <-instance.Timer.C:
			if !instance.paused {
				m.nextImage(ctx, instance)
				instance.Timer.Reset(duration)
			}
		case <-instance.Done:
			return
		case <-ctx.Done():
			return
		}
	}
}

// runTimeOfDayPlaylist is now implemented in timeofday.go with proper initial image selection

// runDayOfWeekPlaylist manages a day-of-week based playlist with sleep detection and precise scheduling
// Deprecated: Old implementation, now using runDayOfWeekPlaylistImproved in dayofweek.go
func (m *Manager) runDayOfWeekPlaylist(ctx context.Context, instance *Instance) {
	// Use 30-second check interval as default (balanced between efficiency and responsiveness)
	m.runDayOfWeekPlaylistImproved(ctx, instance, 30*time.Second)
}

func (m *Manager) nextImage(ctx context.Context, instance *Instance) {
	if len(instance.Playlist.Images) == 0 {
		return
	}

	newIndex := instance.Playlist.Playlist.Currentimageindex + 1
	if newIndex >= int64(len(instance.Playlist.Images)) {
		newIndex = 0
	}

	m.setImage(ctx, instance, newIndex)
}

func (m *Manager) previousImage(ctx context.Context, instance *Instance) {
	if len(instance.Playlist.Images) == 0 {
		return
	}

	newIndex := instance.Playlist.Playlist.Currentimageindex - 1
	if newIndex < 0 {
		newIndex = int64(len(instance.Playlist.Images)) - 1
	}

	m.setImage(ctx, instance, newIndex)
}

func (m *Manager) NextImage(ctx context.Context, monitorName string) error {
	m.mu.Lock() // Use write lock since we may modify timer
	defer m.mu.Unlock()

	instance, ok := m.instances[monitorName]
	if !ok {
		return errors.New(errors.SystemError, fmt.Sprintf("no playlist running on monitor %s", monitorName))
	}

	// Time-based playlists don't allow manual navigation
	if instance.Playlist.Playlist.Type == TimeOfDay {
		return errors.New(errors.SystemError, "cannot manually navigate time-of-day playlists - images change automatically based on time")
	}
	if instance.Playlist.Playlist.Type == DayOfWeek {
		return errors.New(errors.SystemError, "cannot manually navigate day-of-week playlists - images change automatically based on day")
	}

	m.nextImage(ctx, instance)

	// Reset timer for timer playlists (restart interval from now)
	if instance.Playlist.Playlist.Type == Timer && instance.Timer != nil && !instance.paused && instance.timerInterval > 0 {
		if !instance.Timer.Stop() {
			// Drain the channel if timer already fired
			select {
			case <-instance.Timer.C:
			default:
			}
		}
		instance.Timer.Reset(instance.timerInterval)
		m.logger.Debug("timer reset after manual next", "playlist", instance.Playlist.Playlist.Name, "interval", instance.timerInterval)
	}

	return nil
}

func (m *Manager) PreviousImage(ctx context.Context, monitorName string) error {
	m.mu.Lock() // Use write lock since we may modify timer
	defer m.mu.Unlock()

	instance, ok := m.instances[monitorName]
	if !ok {
		return errors.New(errors.SystemError, fmt.Sprintf("no playlist running on monitor %s", monitorName))
	}

	// Time-based playlists don't allow manual navigation
	if instance.Playlist.Playlist.Type == TimeOfDay {
		return errors.New(errors.SystemError, "cannot manually navigate time-of-day playlists - images change automatically based on time")
	}
	if instance.Playlist.Playlist.Type == DayOfWeek {
		return errors.New(errors.SystemError, "cannot manually navigate day-of-week playlists - images change automatically based on day")
	}

	m.previousImage(ctx, instance)

	// Reset timer for timer playlists (restart interval from now)
	if instance.Playlist.Playlist.Type == Timer && instance.Timer != nil && !instance.paused && instance.timerInterval > 0 {
		if !instance.Timer.Stop() {
			// Drain the channel if timer already fired
			select {
			case <-instance.Timer.C:
			default:
			}
		}
		instance.Timer.Reset(instance.timerInterval)
		m.logger.Debug("timer reset after manual previous", "playlist", instance.Playlist.Playlist.Name, "interval", instance.timerInterval)
	}

	return nil
}

func (m *Manager) SetImage(ctx context.Context, monitorName string, imageID int64) error {
	m.mu.RLock()
	defer m.mu.RUnlock()

	// First, try to set image if there's a playlist running on the monitor
	instance, ok := m.instances[monitorName]
	if ok {
		for i, img := range instance.Playlist.Images {
			if img.ID == imageID {
				m.setImage(ctx, instance, int64(i))
				return nil
			}
		}
		// If playlist exists but image not in playlist, fall through to direct setting
	}

	// If no playlist running or image not in playlist, set image directly
	return m.setImageDirectly(ctx, monitorName, imageID)
}

// setImageDirectly sets an image directly without requiring a playlist
func (m *Manager) setImageDirectly(ctx context.Context, monitorName string, imageID int64) error {
	// Get image from database
	image, err := m.dbOps.GetImage(ctx, imageID)
	if err != nil {
		m.logger.Error("failed to get image from database", "error", err, "imageID", imageID)
		return errors.New(errors.SystemError, fmt.Sprintf("image with ID %d not found", imageID))
	}

	// Construct the full image path
	imagePath := fmt.Sprintf("/home/obsy/.waypaper-engine/images/%s", image.Name)

	m.logger.Info("setting image directly", "image", image.Name, "monitor", monitorName, "path", imagePath)

	// Set wallpaper using the wallpaper setter
	err = m.wallpaperSetter.SetWallpaper(ctx, imagePath, monitorName)
	if err != nil {
		m.logger.Error("failed to set wallpaper directly", "error", err, "image", image.Name, "monitor", monitorName)
		return errors.New(errors.SystemError, fmt.Sprintf("failed to set wallpaper: %v", err))
	}

	m.logger.Debug("wallpaper set directly successfully", "image", image.Name, "monitor", monitorName)

	// Emit image changed event
	m.eventChan <- m.createDirectImageEvent(&image, monitorName)

	// Add to image history with configurable limit
	if err := m.dbOps.AddImageToHistoryWithCheck(ctx, imageID, monitorName, m.historyLimit); err != nil {
		m.logger.Error("failed to add image to history", "error", err)
		// Don't fail the operation if history update fails
	}

	// Send event notification
	m.eventChan <- m.createDirectImageEvent(&image, monitorName)

	return nil
}

// setRandomImageDirectly sets a random image directly without requiring a playlist
func (m *Manager) setRandomImageDirectly(ctx context.Context, monitorName string) error {
	// Get all images from database
	images, err := m.dbOps.GetAllImages(ctx)
	if err != nil {
		m.logger.Error("failed to get images from database", "error", err)
		return errors.New(errors.SystemError, "failed to get images from database")
	}

	if len(images) == 0 {
		m.logger.Warn("no images available for random selection", "monitor", monitorName)
		return errors.New(errors.SystemError, "no images available")
	}

	// Select a random image
	randomIndex := rand.Intn(len(images))
	selectedImage := images[randomIndex]

	m.logger.Info("setting random image directly", "image", selectedImage.Name, "monitor", monitorName)

	// Construct the full image path
	imagePath := fmt.Sprintf("/home/obsy/.waypaper-engine/images/%s", selectedImage.Name)

	// Set wallpaper using the wallpaper setter
	err = m.wallpaperSetter.SetWallpaper(ctx, imagePath, monitorName)
	if err != nil {
		m.logger.Error("failed to set random wallpaper directly", "error", err, "image", selectedImage.Name, "monitor", monitorName)
		return errors.New(errors.SystemError, fmt.Sprintf("failed to set wallpaper: %v", err))
	}

	m.logger.Debug("random wallpaper set directly successfully", "image", selectedImage.Name, "monitor", monitorName)

	// Add to image history with configurable limit
	if err := m.dbOps.AddImageToHistoryWithCheck(ctx, selectedImage.ID, monitorName, m.historyLimit); err != nil {
		m.logger.Error("failed to add random image to history", "error", err)
		// Don't fail the operation if history update fails
	}

	// Send event notification
	m.eventChan <- m.createDirectImageEvent(&selectedImage, monitorName)

	return nil
}

func (m *Manager) RandomImage(ctx context.Context, monitorName string) error {
	m.mu.RLock()
	defer m.mu.RUnlock()

	// First, try to set random image if there's a playlist running on the monitor
	instance, ok := m.instances[monitorName]
	if ok {
		if len(instance.Playlist.Images) == 0 {
			return nil
		}
		newIndex := rand.Int63n(int64(len(instance.Playlist.Images)))
		m.setImage(ctx, instance, newIndex)
		return nil
	}

	// If no playlist running, set a random image directly from all available images
	return m.setRandomImageDirectly(ctx, monitorName)
}

func (m *Manager) setImage(ctx context.Context, instance *Instance, index int64) {
	if index < 0 || index >= int64(len(instance.Playlist.Images)) {
		return
	}

	instance.Playlist.Playlist.Currentimageindex = index
	nextImage := instance.Playlist.Images[instance.Playlist.Playlist.Currentimageindex]

	m.logger.Info("setting image", "image", nextImage.Name, "monitor", instance.ActiveMonitor.Name)

	// Set wallpaper using the wallpaper setter
	err := m.wallpaperSetter.SetWallpaper(ctx, nextImage.Name, instance.ActiveMonitor.Name)
	if err != nil {
		m.logger.Error("failed to set wallpaper", "error", err, "image", nextImage.Name, "monitor", instance.ActiveMonitor.Name)
		// Continue execution even if wallpaper setting fails
	} else {
		m.logger.Debug("wallpaper set successfully", "image", nextImage.Name, "monitor", instance.ActiveMonitor.Name)
	}

	// Convert playlist image to db.Image format for event
	dbImage := db.Image{
		ID:     nextImage.ID,
		Name:   nextImage.Name,
		Width:  nextImage.Width,
		Height: nextImage.Height,
		Format: nextImage.Format,
	}
	m.eventChan <- m.createWallpaperEvent(instance, &dbImage)

	// Update DB (skip if dbOps is nil, e.g., in tests)
	if m.dbOps != nil {
		if err := m.dbOps.UpdatePlaylistCurrentIndex(ctx, db.UpdatePlaylistCurrentIndexParams{
			Name:              instance.Playlist.Playlist.Name,
			Currentimageindex: instance.Playlist.Playlist.Currentimageindex,
		}); err != nil {
			m.logger.Error("failed to update playlist index", "error", err)
		}
	}
}

// GetEventChannel returns the event channel.
func (m *Manager) GetEventChannel() <-chan Event {
	return m.eventChan
}

// GetInstance returns a playlist instance by monitor name (for testing)
func (m *Manager) GetInstance(monitorName string) (*Instance, bool) {
	m.mu.RLock()
	defer m.mu.RUnlock()
	instance, exists := m.instances[monitorName]
	return instance, exists
}

// IsPaused returns whether the playlist instance is paused (for testing)
func (i *Instance) IsPaused() bool {
	return i.paused
}

// StopPlaylistByName stops all instances of a playlist by name
func (m *Manager) StopPlaylistByName(playlistName string) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	var stoppedCount int
	for monitorName, instance := range m.instances {
		if instance.Playlist.Playlist.Name == playlistName {
			m.logger.Info("stopping playlist by name", "playlist", playlistName, "monitor", monitorName)

			// Stop timer if it exists
			if instance.Timer != nil {
				instance.Timer.Stop()
			}
			close(instance.Done)
			delete(m.instances, monitorName)
			stoppedCount++

			// Emit event
			m.eventChan <- m.createPlaylistEvent(types.EventPlaylistStopped, instance, instance.Playlist.Playlist.Name)
		}
	}

	if stoppedCount == 0 {
		m.logger.Warn("no active playlists found with name", "playlist", playlistName)
		return errors.New(errors.SystemError, fmt.Sprintf("no active playlists found with name: %s", playlistName))
	}

	m.logger.Info("stopped playlists by name", "playlist", playlistName, "count", stoppedCount)
	return nil
}

// StopPlaylistByMonitorName stops playlists running on specific monitors
func (m *Manager) StopPlaylistByMonitorName(monitors []string) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	var stoppedCount int
	for _, monitorName := range monitors {
		if instance, exists := m.instances[monitorName]; exists {
			m.logger.Info("stopping playlist by monitor name", "playlist", instance.Playlist.Playlist.Name, "monitor", monitorName)

			// Stop timer if it exists
			if instance.Timer != nil {
				instance.Timer.Stop()
			}
			close(instance.Done)
			delete(m.instances, monitorName)
			stoppedCount++

			// Emit event
			m.eventChan <- m.createPlaylistEvent(types.EventPlaylistStopped, instance, instance.Playlist.Playlist.Name)
		}
	}

	m.logger.Info("stopped playlists by monitor name", "monitors", monitors, "count", stoppedCount)
	return nil
}

// StopPlaylistOnRemovedMonitors stops playlists on monitors that are no longer available
func (m *Manager) StopPlaylistOnRemovedMonitors() error {
	m.mu.Lock()
	defer m.mu.Unlock()

	// For now, this is a placeholder implementation
	// In a real implementation, you would check which monitors are still available
	// and stop playlists on monitors that are no longer connected

	m.logger.Info("stopping playlists on removed monitors")
	// This would typically involve checking monitor availability
	// and stopping playlists on disconnected monitors

	return nil
}

// StopAllPlaylists stops all running playlist instances gracefully
func (m *Manager) StopAllPlaylists(ctx context.Context) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	if len(m.instances) == 0 {
		m.logger.Info("no active playlists to stop")
		return nil
	}

	m.logger.Info("stopping all active playlists", "count", len(m.instances))

	var errs []error
	for monitorName, instance := range m.instances {
		m.logger.Info("stopping playlist", "playlist", instance.Playlist.Playlist.Name, "monitor", monitorName)

		// Stop timer if it exists
		if instance.Timer != nil {
			instance.Timer.Stop()
		}

		// Signal the instance to stop by closing the Done channel
		select {
		case <-ctx.Done():
			m.logger.Warn("context cancelled during playlist stop", "playlist", instance.Playlist.Playlist.Name)
			return ctx.Err()
		default:
			close(instance.Done)
		}

		// Emit event
		m.eventChan <- m.createPlaylistEvent(types.EventPlaylistStopped, instance, instance.Playlist.Playlist.Name)
	}

	// Clear all instances
	m.instances = make(map[string]*Instance)

	m.logger.Info("all playlists stopped successfully")
	if len(errs) > 0 {
		return fmt.Errorf("errors occurred stopping playlists: %v", errs)
	}
	return nil
}

// GetActivePlaylists returns a copy of currently active playlists
func (m *Manager) GetActivePlaylists() map[string]*Instance {
	m.mu.RLock()
	defer m.mu.RUnlock()

	// Return a shallow copy
	copy := make(map[string]*Instance)
	for k, v := range m.instances {
		copy[k] = v
	}
	return copy
}
