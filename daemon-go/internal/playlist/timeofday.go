package playlist

import (
	"context"
	"time"

	"waypaper-engine/daemon-go/internal/db"
)

// findClosestImageIndex finds the index of the image with the most recent time that has passed.
// Uses binary search for efficiency.
// Returns -1 if no valid times are found, or the index to wrap to last image.
func findClosestImageIndex(playlist *db.PlaylistWithImages, currentTimeMinutes int) int {
	images := playlist.Images

	if len(images) == 0 {
		return -1
	}

	// Filter out images with invalid times and build a valid time slice
	var validIndices []int
	for i, img := range images {
		if img.Time.Valid {
			validIndices = append(validIndices, i)
		}
	}

	if len(validIndices) == 0 {
		return -1
	}

	// If only one valid image, return it
	if len(validIndices) == 1 {
		return validIndices[0]
	}

	// Binary search to find the closest image time that has passed
	low := 0
	high := len(validIndices) - 1
	closestIndex := -1

	for low <= high {
		mid := (low + high) / 2
		midIdx := validIndices[mid]
		midTime := int(images[midIdx].Time.Int64)

		if midTime == currentTimeMinutes {
			// Exact match
			return midIdx
		} else if midTime < currentTimeMinutes {
			// This time has passed, it's a candidate
			closestIndex = midIdx
			low = mid + 1
		} else {
			// This time hasn't happened yet
			high = mid - 1
		}
	}

	// If no image found before current time, wrap to last valid image (from previous day)
	if closestIndex == -1 {
		return validIndices[len(validIndices)-1]
	}

	return closestIndex
}

// getCurrentTimeInMinutes returns the current time in minutes since midnight
func getCurrentTimeInMinutes() int {
	now := time.Now()
	return now.Hour()*60 + now.Minute()
}

// calculateDurationUntilNextImage calculates how long to wait until the next image should be displayed
func calculateDurationUntilNextImage(playlist *db.PlaylistWithImages, currentImageIndex int) time.Duration {
	images := playlist.Images

	if len(images) == 0 {
		return time.Hour * 24 // If no images, wait a day
	}

	// Find next valid image index
	nextIndex := (currentImageIndex + 1) % len(images)

	// Handle wrap-around to find next valid time
	for attempts := 0; attempts < len(images); attempts++ {
		if images[nextIndex].Time.Valid {
			break
		}
		nextIndex = (nextIndex + 1) % len(images)
	}

	if !images[nextIndex].Time.Valid {
		return time.Hour * 24 // No valid times
	}

	nextTime := int(images[nextIndex].Time.Int64)
	now := time.Now()
	currentTimeMinutes := now.Hour()*60 + now.Minute()

	// Calculate minutes until next image
	var minutesUntilNext int
	if nextTime > currentTimeMinutes {
		// Next image is today
		minutesUntilNext = nextTime - currentTimeMinutes
	} else {
		// Next image is tomorrow (wrap around)
		minutesUntilNext = (1440 - currentTimeMinutes) + nextTime // 1440 = minutes in a day
	}

	// Convert to duration and subtract current seconds for precision
	duration := time.Duration(minutesUntilNext) * time.Minute
	duration -= time.Duration(now.Second()) * time.Second

	// Ensure minimum of 1 second to avoid immediate re-trigger
	if duration < time.Second {
		duration = time.Second
	}

	return duration
}

// runTimeOfDayPlaylist manages a time-of-day based playlist with sleep detection
func (m *Manager) runTimeOfDayPlaylist(ctx context.Context, instance *Instance) {
	currentTime := getCurrentTimeInMinutes()
	// Use 30-second check interval as default (balanced between efficiency and responsiveness)
	m.runTimeOfDayPlaylistWithSleepDetection(ctx, instance, currentTime, 30*time.Second)
}

// runTimeOfDayPlaylistWithSleepDetection implements time-of-day playlist with system sleep detection
// checkInterval: how often to verify timer hasn't been missed (e.g., 30*time.Second)
func (m *Manager) runTimeOfDayPlaylistWithSleepDetection(ctx context.Context, instance *Instance, currentTimeMinutes int, checkInterval time.Duration) {
	if len(instance.Playlist.Images) == 0 {
		m.logger.Warn("time-of-day playlist has no images", "playlist", instance.Playlist.Playlist.Name)
		<-instance.Done
		return
	}

	// Find the closest image that should be displayed now
	closestIndex := findClosestImageIndex(instance.Playlist, currentTimeMinutes)
	if closestIndex < 0 {
		m.logger.Error("no valid image times in time-of-day playlist", "playlist", instance.Playlist.Playlist.Name)
		<-instance.Done
		return
	}

	// Set the initial image
	m.logger.Info("setting initial time-of-day image",
		"playlist", instance.Playlist.Playlist.Name,
		"index", closestIndex,
		"image", instance.Playlist.Images[closestIndex].Name,
		"currentTime", currentTimeMinutes)

	m.setImage(ctx, instance, int64(closestIndex))

	// Calculate duration until next image
	duration := calculateDurationUntilNextImage(instance.Playlist, closestIndex)
	m.logger.Debug("scheduled next time-of-day image change",
		"playlist", instance.Playlist.Playlist.Name,
		"duration", duration)

	instance.Timer = time.NewTimer(duration)

	// Store when timer SHOULD fire (real wall-clock time)
	// This is used to detect if system was suspended
	expectedFireTime := time.Now().Add(duration)

	// Create sanity checker to detect missed events (system sleep, clock changes)
	sanityChecker := time.NewTicker(checkInterval)
	defer sanityChecker.Stop()

	// Main loop
	for {
		select {
		case <-instance.Timer.C:
			// Timer fired normally - advance to next image
			currentTime := getCurrentTimeInMinutes()
			nextIndex := findClosestImageIndex(instance.Playlist, currentTime)

			// If we're at the same index, advance to next
			if nextIndex == int(instance.Playlist.Playlist.Currentimageindex) {
				nextIndex = (nextIndex + 1) % len(instance.Playlist.Images)
			}

			m.logger.Info("time-of-day image change",
				"playlist", instance.Playlist.Playlist.Name,
				"newIndex", nextIndex)

			m.setImage(ctx, instance, int64(nextIndex))

			// Schedule next change
			duration = calculateDurationUntilNextImage(instance.Playlist, nextIndex)
			instance.Timer.Reset(duration)
			expectedFireTime = time.Now().Add(duration)

		case <-sanityChecker.C:
			// Periodic sanity check: verify timer hasn't been missed
			now := time.Now()

			// If current time is past when timer should have fired, we missed an event
			// This happens during system suspend/resume or clock adjustments
			if now.After(expectedFireTime) {
				delay := now.Sub(expectedFireTime)

				// Only trigger if delay is significant (> 10 seconds)
				// Small delays are expected due to scheduling
				if delay > 10*time.Second {
					m.logger.Warn("detected missed timer event (system suspend or clock change)",
						"playlist", instance.Playlist.Playlist.Name,
						"expectedFireTime", expectedFireTime,
						"actualTime", now,
						"delay", delay)

					// Stop stale timer
					if instance.Timer != nil {
						instance.Timer.Stop()
					}

					// Re-evaluate playlist from current time
					currentTime := getCurrentTimeInMinutes()
					nextIndex := findClosestImageIndex(instance.Playlist, currentTime)

					m.logger.Info("re-evaluating playlist after missed event",
						"playlist", instance.Playlist.Playlist.Name,
						"newIndex", nextIndex,
						"image", instance.Playlist.Images[nextIndex].Name)

					m.setImage(ctx, instance, int64(nextIndex))

					// Reschedule timer
					duration = calculateDurationUntilNextImage(instance.Playlist, nextIndex)
					instance.Timer = time.NewTimer(duration)
					expectedFireTime = time.Now().Add(duration)
				}
			}

		case <-instance.Done:
			if instance.Timer != nil {
				instance.Timer.Stop()
			}
			return

		case <-ctx.Done():
			if instance.Timer != nil {
				instance.Timer.Stop()
			}
			return
		}
	}
}

// runTimeOfDayPlaylistWithTime is a testable version that accepts current time as parameter
// Deprecated: Use runTimeOfDayPlaylistWithSleepDetection for production code
func (m *Manager) runTimeOfDayPlaylistWithTime(ctx context.Context, instance *Instance, currentTimeMinutes int) {
	if len(instance.Playlist.Images) == 0 {
		m.logger.Warn("time-of-day playlist has no images", "playlist", instance.Playlist.Playlist.Name)
		<-instance.Done
		return
	}

	// Find the closest image that should be displayed now
	closestIndex := findClosestImageIndex(instance.Playlist, currentTimeMinutes)
	if closestIndex < 0 {
		m.logger.Error("no valid image times in time-of-day playlist", "playlist", instance.Playlist.Playlist.Name)
		<-instance.Done
		return
	}

	// Set the initial image
	m.logger.Info("setting initial time-of-day image",
		"playlist", instance.Playlist.Playlist.Name,
		"index", closestIndex,
		"image", instance.Playlist.Images[closestIndex].Name,
		"currentTime", currentTimeMinutes)

	m.setImage(ctx, instance, int64(closestIndex))

	// Calculate duration until next image
	duration := calculateDurationUntilNextImage(instance.Playlist, closestIndex)
	m.logger.Debug("scheduled next time-of-day image change",
		"playlist", instance.Playlist.Playlist.Name,
		"duration", duration)

	instance.Timer = time.NewTimer(duration)

	// Main loop
	for {
		select {
		case <-instance.Timer.C:
			// Time for next image
			currentTime := getCurrentTimeInMinutes()
			nextIndex := findClosestImageIndex(instance.Playlist, currentTime)

			// If we're at the same index, advance to next
			if nextIndex == int(instance.Playlist.Playlist.Currentimageindex) {
				nextIndex = (nextIndex + 1) % len(instance.Playlist.Images)
			}

			m.logger.Info("time-of-day image change",
				"playlist", instance.Playlist.Playlist.Name,
				"newIndex", nextIndex)

			m.setImage(ctx, instance, int64(nextIndex))

			// Schedule next change
			duration = calculateDurationUntilNextImage(instance.Playlist, nextIndex)
			instance.Timer.Reset(duration)

		case <-instance.Done:
			if instance.Timer != nil {
				instance.Timer.Stop()
			}
			return

		case <-ctx.Done():
			if instance.Timer != nil {
				instance.Timer.Stop()
			}
			return
		}
	}
}
