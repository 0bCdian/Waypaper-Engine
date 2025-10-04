package playlist

import (
	"time"
)

// PlaylistDiagnostics contains diagnostic information about a running playlist
type PlaylistDiagnostics struct {
	PlaylistName    string            `json:"playlistName"`
	PlaylistType    string            `json:"playlistType"`
	MonitorName     string            `json:"monitorName"`
	CurrentImage    *ImageDiagnostics `json:"currentImage,omitempty"`
	PreviousImage   *ImageDiagnostics `json:"previousImage,omitempty"`
	NextImage       *ImageDiagnostics `json:"nextImage,omitempty"`
	TimeUntilNext   *string           `json:"timeUntilNext,omitempty"`   // Human-readable duration
	TimeUntilNextMS *int64            `json:"timeUntilNextMs,omitempty"` // Milliseconds until next change
	IsPaused        bool              `json:"isPaused"`
	ImageCount      int               `json:"imageCount"`
	CurrentIndex    int64             `json:"currentIndex"`
}

// ImageDiagnostics contains information about a specific image in diagnostics
type ImageDiagnostics struct {
	ID          int64   `json:"id"`
	Name        string  `json:"name"`
	Index       int64   `json:"index"`
	ScheduledAt *string `json:"scheduledAt,omitempty"` // For time-of-day playlists (HH:MM format)
}

// GetDiagnostics returns diagnostic information for a running playlist
func (m *Manager) GetDiagnostics(monitorName string) (*PlaylistDiagnostics, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()

	instance, ok := m.instances[monitorName]
	if !ok {
		return nil, nil // No playlist running on this monitor
	}

	diag := &PlaylistDiagnostics{
		PlaylistName: instance.Playlist.Playlist.Name,
		PlaylistType: instance.Playlist.Playlist.Type,
		MonitorName:  instance.ActiveMonitor.Name,
		IsPaused:     instance.paused,
		ImageCount:   len(instance.Playlist.Images),
		CurrentIndex: instance.Playlist.Playlist.Currentimageindex,
	}

	// Get current image info
	if diag.CurrentIndex >= 0 && diag.CurrentIndex < int64(len(instance.Playlist.Images)) {
		currentImg := instance.Playlist.Images[diag.CurrentIndex]
		diag.CurrentImage = &ImageDiagnostics{
			ID:    currentImg.ID,
			Name:  currentImg.Name,
			Index: diag.CurrentIndex,
		}

		// Add scheduled time for time-of-day playlists
		if instance.Playlist.Playlist.Type == TimeOfDay && currentImg.Time.Valid {
			scheduledAt := formatMinutesToTime(int(currentImg.Time.Int64))
			diag.CurrentImage.ScheduledAt = &scheduledAt
		}
	}

	// Get previous image info
	if len(instance.Playlist.Images) > 0 {
		prevIndex := diag.CurrentIndex - 1
		if prevIndex < 0 {
			prevIndex = int64(len(instance.Playlist.Images)) - 1
		}
		prevImg := instance.Playlist.Images[prevIndex]
		diag.PreviousImage = &ImageDiagnostics{
			ID:    prevImg.ID,
			Name:  prevImg.Name,
			Index: prevIndex,
		}

		if instance.Playlist.Playlist.Type == TimeOfDay && prevImg.Time.Valid {
			scheduledAt := formatMinutesToTime(int(prevImg.Time.Int64))
			diag.PreviousImage.ScheduledAt = &scheduledAt
		}
	}

	// Get next image info and time until next change (type-specific)
	switch instance.Playlist.Playlist.Type {
	case Timer:
		m.addTimerDiagnostics(diag, instance)
	case TimeOfDay:
		m.addTimeOfDayDiagnostics(diag, instance)
	case DayOfWeek:
		m.addDayOfWeekDiagnostics(diag, instance)
	case Never:
		// Never playlist doesn't auto-change, so no next image/time
		diag.NextImage = nil
		diag.TimeUntilNext = nil
		diag.TimeUntilNextMS = nil
	}

	return diag, nil
}

// GetAllDiagnostics returns diagnostics for all running playlists
func (m *Manager) GetAllDiagnostics() ([]*PlaylistDiagnostics, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()

	diagnostics := make([]*PlaylistDiagnostics, 0, len(m.instances))

	for monitorName := range m.instances {
		// Temporarily unlock to call GetDiagnostics (which needs RLock)
		m.mu.RUnlock()
		diag, err := m.GetDiagnostics(monitorName)
		m.mu.RLock()

		if err != nil {
			return nil, err
		}
		if diag != nil {
			diagnostics = append(diagnostics, diag)
		}
	}

	return diagnostics, nil
}

// addTimerDiagnostics adds timer-specific diagnostic information
func (m *Manager) addTimerDiagnostics(diag *PlaylistDiagnostics, instance *Instance) {
	if len(instance.Playlist.Images) == 0 {
		return
	}

	// Calculate next image
	nextIndex := diag.CurrentIndex + 1
	if nextIndex >= int64(len(instance.Playlist.Images)) {
		nextIndex = 0
	}

	nextImg := instance.Playlist.Images[nextIndex]
	diag.NextImage = &ImageDiagnostics{
		ID:    nextImg.ID,
		Name:  nextImg.Name,
		Index: nextIndex,
	}

	// Calculate time until next change
	if instance.timerInterval > 0 && !instance.paused {
		// We don't have exact time remaining on the timer, but we can provide the interval
		durationStr := formatDuration(instance.timerInterval)
		diag.TimeUntilNext = &durationStr
		ms := instance.timerInterval.Milliseconds()
		diag.TimeUntilNextMS = &ms
	}
}

// addTimeOfDayDiagnostics adds time-of-day-specific diagnostic information
func (m *Manager) addTimeOfDayDiagnostics(diag *PlaylistDiagnostics, instance *Instance) {
	if len(instance.Playlist.Images) == 0 {
		return
	}

	// Find next valid image with time
	currentIndex := int(diag.CurrentIndex)
	nextIndex := (currentIndex + 1) % len(instance.Playlist.Images)

	for attempts := 0; attempts < len(instance.Playlist.Images); attempts++ {
		if instance.Playlist.Images[nextIndex].Time.Valid {
			nextImg := instance.Playlist.Images[nextIndex]
			scheduledAt := formatMinutesToTime(int(nextImg.Time.Int64))

			diag.NextImage = &ImageDiagnostics{
				ID:          nextImg.ID,
				Name:        nextImg.Name,
				Index:       int64(nextIndex),
				ScheduledAt: &scheduledAt,
			}

			// Calculate time until next
			duration := calculateDurationUntilNextImage(instance.Playlist, currentIndex)
			durationStr := formatDuration(duration)
			diag.TimeUntilNext = &durationStr
			ms := duration.Milliseconds()
			diag.TimeUntilNextMS = &ms

			break
		}
		nextIndex = (nextIndex + 1) % len(instance.Playlist.Images)
	}
}

// addDayOfWeekDiagnostics adds day-of-week-specific diagnostic information
func (m *Manager) addDayOfWeekDiagnostics(diag *PlaylistDiagnostics, instance *Instance) {
	if len(instance.Playlist.Images) == 0 {
		return
	}

	// Next image is for the next day
	now := time.Now()
	tomorrow := now.Add(24 * time.Hour)
	tomorrowDay := int(tomorrow.Weekday())

	var nextIndex int
	if tomorrowDay < len(instance.Playlist.Images) {
		nextIndex = tomorrowDay
	} else {
		nextIndex = len(instance.Playlist.Images) - 1
	}

	nextImg := instance.Playlist.Images[nextIndex]
	diag.NextImage = &ImageDiagnostics{
		ID:    nextImg.ID,
		Name:  nextImg.Name,
		Index: int64(nextIndex),
	}

	// Calculate time until midnight
	duration := calculateDurationUntilMidnight(now)
	durationStr := formatDuration(duration)
	diag.TimeUntilNext = &durationStr
	ms := duration.Milliseconds()
	diag.TimeUntilNextMS = &ms
}

// formatDuration formats a duration in a human-readable way
func formatDuration(d time.Duration) string {
	if d < time.Minute {
		return d.Round(time.Second).String()
	}
	if d < time.Hour {
		return d.Round(time.Minute).String()
	}
	if d < 24*time.Hour {
		return d.Round(time.Minute).String()
	}
	return d.Round(time.Hour).String()
}

// formatMinutesToTime converts minutes since midnight to HH:MM format
func formatMinutesToTime(minutes int) string {
	hours := minutes / 60
	mins := minutes % 60
	return time.Date(0, 1, 1, hours, mins, 0, 0, time.UTC).Format("15:04")
}
