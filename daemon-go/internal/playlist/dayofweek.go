package playlist

import (
	"context"
	"time"
)

// calculateDurationUntilMidnight calculates the duration from now until the next midnight
func calculateDurationUntilMidnight(now time.Time) time.Duration {
	// Calculate time until midnight
	year, month, day := now.Date()
	nextMidnight := time.Date(year, month, day+1, 0, 0, 0, 0, now.Location())

	duration := nextMidnight.Sub(now)

	// Ensure minimum of 1 second to avoid immediate re-trigger at exactly midnight
	if duration < time.Second {
		duration = time.Second
	}

	return duration
}

// runDayOfWeekPlaylistImproved implements day-of-week playlist with precise scheduling and sleep detection
func (m *Manager) runDayOfWeekPlaylistImproved(ctx context.Context, instance *Instance, checkInterval time.Duration) {
	if len(instance.Playlist.Images) == 0 {
		m.logger.Warn("day-of-week playlist has no images", "playlist", instance.Playlist.Playlist.Name)
		<-instance.Done
		return
	}

	// Get current day of week (0 = Sunday, 1 = Monday, ..., 6 = Saturday)
	now := time.Now()
	currentDay := now.Weekday()
	dayIndex := int(currentDay)

	// If playlist has fewer than 7 images, use the last available image
	if dayIndex >= len(instance.Playlist.Images) {
		dayIndex = len(instance.Playlist.Images) - 1
	}

	// Set initial image immediately
	m.logger.Info("setting initial day-of-week image",
		"playlist", instance.Playlist.Playlist.Name,
		"day", currentDay.String(),
		"index", dayIndex,
		"image", instance.Playlist.Images[dayIndex].Name)

	m.setImage(ctx, instance, int64(dayIndex))

	// Calculate precise duration until midnight
	duration := calculateDurationUntilMidnight(now)
	m.logger.Debug("scheduled next day-of-week image change at midnight",
		"playlist", instance.Playlist.Playlist.Name,
		"duration", duration)

	instance.Timer = time.NewTimer(duration)

	// Store when timer SHOULD fire (for sleep detection)
	expectedFireTime := time.Now().Add(duration)

	// Create sanity checker to detect missed events
	sanityChecker := time.NewTicker(checkInterval)
	defer sanityChecker.Stop()

	// Main loop
	for {
		select {
		case <-instance.Timer.C:
			// Midnight reached - advance to next day's image
			now := time.Now()
			nextDay := now.Weekday()
			nextDayIndex := int(nextDay)

			// If playlist has fewer images, wrap to last available
			if nextDayIndex >= len(instance.Playlist.Images) {
				nextDayIndex = len(instance.Playlist.Images) - 1
			}

			m.logger.Info("day-of-week midnight transition",
				"playlist", instance.Playlist.Playlist.Name,
				"newDay", nextDay.String(),
				"newIndex", nextDayIndex)

			m.setImage(ctx, instance, int64(nextDayIndex))

			// Schedule next midnight
			duration = calculateDurationUntilMidnight(now)
			instance.Timer.Reset(duration)
			expectedFireTime = time.Now().Add(duration)

		case <-sanityChecker.C:
			// Periodic sanity check: verify timer hasn't been missed
			now := time.Now()

			// If current time is past when timer should have fired, we missed an event
			if now.After(expectedFireTime) {
				delay := now.Sub(expectedFireTime)

				// Only trigger if delay is significant (> 10 seconds)
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

					// Re-evaluate playlist from current day
					currentDay := now.Weekday()
					currentDayIndex := int(currentDay)

					if currentDayIndex >= len(instance.Playlist.Images) {
						currentDayIndex = len(instance.Playlist.Images) - 1
					}

					m.logger.Info("re-evaluating day-of-week playlist after missed event",
						"playlist", instance.Playlist.Playlist.Name,
						"day", currentDay.String(),
						"index", currentDayIndex,
						"image", instance.Playlist.Images[currentDayIndex].Name)

					m.setImage(ctx, instance, int64(currentDayIndex))

					// Reschedule timer for next midnight
					duration = calculateDurationUntilMidnight(now)
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
