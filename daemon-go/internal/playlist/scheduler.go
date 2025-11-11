package playlist

import (
	"context"
	"fmt"
	"time"

	"waypaper-engine/daemon-go/internal/backend"
	"waypaper-engine/daemon-go/internal/monitor"
	"waypaper-engine/daemon-go/internal/store"
)

// findClosestImageIndex finds the closest image index for the current time using binary search
// Returns the index of the image that should be displayed at the current time
func (m *Manager) findClosestImageIndex(images []store.PlaylistImage) (int, error) {
	now := time.Now()
	currentTime := now.Hour()*60 + now.Minute() // Minutes since midnight

	// Check if images have time values
	if len(images) == 0 {
		return -1, fmt.Errorf("no images in playlist")
	}

	// Binary search for closest time
	low := 0
	high := len(images) - 1
	closestIndex := -1

	for low <= high {
		mid := (low + high) / 2
		if images[mid].Time == nil {
			return -1, fmt.Errorf("image at index %d has no time value", mid)
		}

		midTime := *images[mid].Time
		if midTime == currentTime {
			return mid, nil
		} else if midTime < currentTime {
			closestIndex = mid
			low = mid + 1
		} else {
			high = mid - 1
		}
	}

	// If no exact match, return the closest one before current time
	// If no image before current time, wrap around to last image
	if closestIndex == -1 {
		closestIndex = len(images) - 1
	}

	return closestIndex, nil
}

// calculateMillisecondsUntilNextImage calculates time until the next scheduled image
func (m *Manager) calculateMillisecondsUntilNextImage(images []store.PlaylistImage, currentIndex int) (time.Duration, error) {
	if len(images) == 0 {
		return 0, fmt.Errorf("no images in playlist")
	}

	nextIndex := (currentIndex + 1) % len(images)
	if images[nextIndex].Time == nil {
		return 0, fmt.Errorf("next image has no time value")
	}

	now := time.Now()
	currentTimeMinutes := now.Hour()*60 + now.Minute()
	nextTimeMinutes := *images[nextIndex].Time

	// Calculate time difference
	timeDiff := nextTimeMinutes - currentTimeMinutes

	// If next time is earlier, it's tomorrow (wrap around midnight)
	if timeDiff < 0 {
		timeDiff += 1440 // Add 24 hours in minutes
	}

	// Convert to duration in seconds, then subtract current seconds
	durationSeconds := timeDiff*60 - now.Second()
	duration := time.Duration(durationSeconds) * time.Second

	return duration, nil
}

// runTimeOfDayPlaylist manages a TIME_OF_DAY playlist
func (m *Manager) runTimeOfDayPlaylist(ctx context.Context, monitorName string, playlist *store.Playlist) error {
	m.logger.Info("Starting TIME_OF_DAY playlist", "monitor", monitorName, "playlist", playlist.Name)

	// Find the closest image for the current time
	startingIndex, err := m.findClosestImageIndex(playlist.Images)
	if err != nil {
		return fmt.Errorf("failed to find starting image: %w", err)
	}

	// Update the instance with the starting index
	m.mu.Lock()
	instance, exists := m.instances[monitorName]
	if !exists {
		m.mu.Unlock()
		return fmt.Errorf("playlist instance not found")
	}
	instance.CurrentIndex = startingIndex
	m.mu.Unlock()

	// Set the initial image
	if err := m.setImageAtIndex(ctx, monitorName, startingIndex); err != nil {
		return fmt.Errorf("failed to set initial image: %w", err)
	}

	// Start the scheduling loop
	go m.runTimeOfDayScheduler(ctx, monitorName, playlist)

	// Start missed event checker
	go m.startMissedEventChecker(ctx, monitorName)

	return nil
}

// runTimeOfDayScheduler handles the scheduling loop for TIME_OF_DAY playlists
func (m *Manager) runTimeOfDayScheduler(ctx context.Context, monitorName string, playlist *store.Playlist) {
	m.logger.Info("Starting TIME_OF_DAY scheduler", "monitor", monitorName)

	for {
		// Get current instance state
		m.mu.RLock()
		instance, exists := m.instances[monitorName]
		if !exists {
			m.mu.RUnlock()
			m.logger.Info("Playlist instance no longer exists, stopping scheduler", "monitor", monitorName)
			return
		}

		currentIndex := instance.CurrentIndex
		timerDone := instance.timerDone
		paused := instance.Paused
		m.mu.RUnlock()

		// Calculate time until next image
		duration, err := m.calculateMillisecondsUntilNextImage(playlist.Images, currentIndex)
		if err != nil {
			m.logger.Error("Failed to calculate next image time", "error", err)
			return
		}

		// Update nextImageTime for missed event detection
		nextTime := time.Now().Add(duration)
		m.mu.Lock()
		if inst, exists := m.instances[monitorName]; exists {
			inst.nextImageTime = nextTime
		}
		m.mu.Unlock()

		m.logger.Debug("Waiting for next image", "duration", duration, "currentIndex", currentIndex, "nextTime", nextTime)

		// Wait for the scheduled time
		timer := time.NewTimer(duration)
		select {
		case <-timer.C:
			if !paused {
				m.logger.Debug("Time reached, advancing to next image", "monitor", monitorName)
				if err := m.NextImage(ctx, monitorName); err != nil {
					m.logger.Error("Failed to advance to next image", "error", err)
				}
			}
		case <-timerDone:
			timer.Stop()
			m.logger.Info("Received stop signal, stopping TIME_OF_DAY scheduler", "monitor", monitorName)
			return
		case <-ctx.Done():
			timer.Stop()
			m.logger.Info("Context cancelled, stopping TIME_OF_DAY scheduler", "monitor", monitorName)
			return
		}
	}
}

// runDayOfWeekPlaylist manages a DAY_OF_WEEK playlist
func (m *Manager) runDayOfWeekPlaylist(ctx context.Context, monitorName string, playlist *store.Playlist) error {
	m.logger.Info("Starting DAY_OF_WEEK playlist", "monitor", monitorName, "playlist", playlist.Name)

	// Get current day of week (0 = Sunday, 6 = Saturday)
	now := time.Now()
	weekday := int(now.Weekday())

	// If playlist has fewer images than days, cap at playlist length
	imageIndex := weekday
	if imageIndex >= len(playlist.Images) {
		imageIndex = len(playlist.Images) - 1
	}

	// Update the instance with the starting index
	m.mu.Lock()
	instance, exists := m.instances[monitorName]
	if !exists {
		m.mu.Unlock()
		return fmt.Errorf("playlist instance not found")
	}
	instance.CurrentIndex = imageIndex
	m.mu.Unlock()

	// Set the initial image
	if err := m.setImageAtIndex(ctx, monitorName, imageIndex); err != nil {
		return fmt.Errorf("failed to set initial image: %w", err)
	}

	// Start the daily scheduler
	go m.runDayOfWeekScheduler(ctx, monitorName, playlist)

	// Start missed event checker
	go m.startMissedEventChecker(ctx, monitorName)

	return nil
}

// runDayOfWeekScheduler handles the daily scheduling loop for DAY_OF_WEEK playlists
func (m *Manager) runDayOfWeekScheduler(ctx context.Context, monitorName string, playlist *store.Playlist) {
	m.logger.Info("Starting DAY_OF_WEEK scheduler", "monitor", monitorName)

	for {
		// Calculate time until midnight (next day)
		now := time.Now()
		tomorrow := now.AddDate(0, 0, 1)
		midnight := time.Date(tomorrow.Year(), tomorrow.Month(), tomorrow.Day(), 0, 0, 0, 0, now.Location())
		duration := midnight.Sub(now)

		// Update nextImageTime for missed event detection
		m.mu.Lock()
		if inst, exists := m.instances[monitorName]; exists {
			inst.nextImageTime = midnight
		}
		m.mu.Unlock()

		m.logger.Debug("Waiting until midnight for next day", "duration", duration, "midnight", midnight)

		// Get instance state
		m.mu.RLock()
		instance, exists := m.instances[monitorName]
		if !exists {
			m.mu.RUnlock()
			m.logger.Info("Playlist instance no longer exists, stopping DAY_OF_WEEK scheduler", "monitor", monitorName)
			return
		}
		timerDone := instance.timerDone
		paused := instance.Paused
		m.mu.RUnlock()

		// Wait until midnight
		timer := time.NewTimer(duration)
		select {
		case <-timer.C:
			if !paused {
				// Get new day of week and set corresponding image
				newWeekday := int(time.Now().Weekday())
				imageIndex := newWeekday
				if imageIndex >= len(playlist.Images) {
					imageIndex = len(playlist.Images) - 1
				}

				m.logger.Info("New day, setting image for weekday", "weekday", newWeekday, "imageIndex", imageIndex)
				if err := m.setImageAtIndex(ctx, monitorName, imageIndex); err != nil {
					m.logger.Error("Failed to set image for new day", "error", err)
				}
			}
		case <-timerDone:
			timer.Stop()
			m.logger.Info("Received stop signal, stopping DAY_OF_WEEK scheduler", "monitor", monitorName)
			return
		case <-ctx.Done():
			timer.Stop()
			m.logger.Info("Context cancelled, stopping DAY_OF_WEEK scheduler", "monitor", monitorName)
			return
		}
	}
}

// setImageAtIndex sets an image at a specific index in the playlist
func (m *Manager) setImageAtIndex(ctx context.Context, monitorName string, index int) error {
	m.mu.Lock()
	instance, exists := m.instances[monitorName]
	if !exists {
		m.mu.Unlock()
		return fmt.Errorf("no playlist running on monitor %s", monitorName)
	}
	instance.CurrentIndex = index
	m.mu.Unlock()

	// Get playlist to get the image
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
		return fmt.Errorf("playlist not found")
	}

	if index >= len(playlist.Images) {
		return fmt.Errorf("index out of range: %d >= %d", index, len(playlist.Images))
	}

	image := playlist.Images[index]

	// Set the image via the backend
	activeMonitor := instance.ActiveMonitor
	if activeMonitor == nil {
		return fmt.Errorf("no active monitor configured")
	}

	return m.setWallpaperWithBackendFromPlaylist(ctx, image.ImagePath, activeMonitor, playlist)
}

// setWallpaperWithBackendFromPlaylist is a helper that uses the playlist's backend config
func (m *Manager) setWallpaperWithBackendFromPlaylist(ctx context.Context, imagePath string, activeMonitor *monitor.MonitorSelection, playlist *store.Playlist) error {
	// Get backend type from playlist or default
	backendType := m.config.Backend.Type
	if playlist.Backend != nil && playlist.Backend.BackendType != "" {
		backendType = playlist.Backend.BackendType
	}

	return m.setWallpaperWithBackend(ctx, imagePath, activeMonitor, backend.BackendType(backendType))
}

// startMissedEventChecker starts a background checker for missed scheduled events
// This detects system sleep/wake scenarios where scheduled times were missed
func (m *Manager) startMissedEventChecker(ctx context.Context, monitorName string) {
	m.logger.Info("Starting missed event checker", "monitor", monitorName)

	ticker := time.NewTicker(10 * time.Second)
	defer ticker.Stop()

	for {
		select {
		case <-ticker.C:
			m.checkForMissedEvents(ctx, monitorName)
		case <-ctx.Done():
			m.logger.Info("Context cancelled, stopping missed event checker", "monitor", monitorName)
			return
		}
	}
}

// checkForMissedEvents checks if a scheduled event was missed (e.g., system sleep)
func (m *Manager) checkForMissedEvents(ctx context.Context, monitorName string) {
	m.mu.RLock()
	instance, exists := m.instances[monitorName]
	if !exists {
		m.mu.RUnlock()
		return
	}

	nextImageTime := instance.nextImageTime
	playlistType := instance.playlistType
	playlistID := instance.PlaylistID
	m.mu.RUnlock()

	// Only check for time-based playlists
	if playlistType != "time_of_day" && playlistType != "day_of_week" {
		return
	}

	// Check if we're past the expected execution time
	now := time.Now()
	if !nextImageTime.IsZero() && now.After(nextImageTime.Add(30*time.Second)) {
		m.logger.Warn("Detected missed event, re-triggering scheduler", 
			"monitor", monitorName, 
			"expectedTime", nextImageTime, 
			"currentTime", now,
			"playlistType", playlistType)

		// Reload playlist and restart appropriate scheduler
		playlists, err := m.store.LoadPlaylists()
		if err != nil {
			m.logger.Error("Failed to load playlists for missed event check", "error", err)
			return
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
			m.logger.Error("Playlist not found for missed event check", "playlistID", playlistID)
			return
		}

		// Re-trigger the appropriate playlist type
		switch playlistType {
		case "time_of_day":
			if err := m.runTimeOfDayPlaylist(ctx, monitorName, playlist); err != nil {
				m.logger.Error("Failed to restart TIME_OF_DAY playlist after missed event", "error", err)
			}
		case "day_of_week":
			if err := m.runDayOfWeekPlaylist(ctx, monitorName, playlist); err != nil {
				m.logger.Error("Failed to restart DAY_OF_WEEK playlist after missed event", "error", err)
			}
		}
	}
}

