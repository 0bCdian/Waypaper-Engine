package store

import (
	"fmt"
	"sort"
	"time"

	"waypaper-engine/daemon-go/internal/media"
)

// HistoryStore handles image history storage operations
type HistoryStore struct {
	store *Store
}

// NewHistoryStore creates a new history store
func NewHistoryStore(store *Store) *HistoryStore {
	return &HistoryStore{
		store: store,
	}
}

// LoadImageHistory loads the image history
func (hs *HistoryStore) LoadImageHistory() (*ImageHistory, error) {
	cacheKey := "image_history"
	filePath := hs.store.getFilePath("history.json")

	var history ImageHistory
	if err := hs.store.cachedLoad(cacheKey, filePath, &history); err != nil {
		// If file doesn't exist, return empty history
		if containsString(err.Error(), "not found") {
			return hs.getDefaultImageHistory(), nil
		}
		return nil, fmt.Errorf("failed to load image history: %w", err)
	}

	return &history, nil
}

// SaveImageHistory saves the image history
func (hs *HistoryStore) SaveImageHistory(history *ImageHistory) error {
	// Update metadata
	history.Metadata.TotalEntries = int64(len(history.Entries))
	history.Metadata.NewestEntry = time.Now()

	// Find oldest entry
	if len(history.Entries) > 0 {
		oldest := history.Entries[0].SetAt
		for _, entry := range history.Entries {
			if entry.SetAt.Before(oldest) {
				oldest = entry.SetAt
			}
		}
		history.Metadata.OldestEntry = oldest
	}

	filePath := hs.store.getFilePath("history.json")
	return hs.store.saveJSON(filePath, history)
}

// AddImageToHistory adds an image to the history
func (hs *HistoryStore) AddImageToHistory(imageID, imagePath, monitorName string, mediaType media.MediaType, duration *int64, playlistName, backendUsed string) error {
	history, err := hs.LoadImageHistory()
	if err != nil {
		return err
	}

	// Check if this image is already in history for this monitor
	existingIndex := -1
	for i, entry := range history.Entries {
		if entry.ImageID == imageID && entry.MonitorName == monitorName {
			existingIndex = i
			break
		}
	}

	now := time.Now()
	if existingIndex >= 0 {
		// Update existing entry
		history.Entries[existingIndex].SetAt = now
		if duration != nil {
			history.Entries[existingIndex].Duration = duration
		}
		if playlistName != "" {
			history.Entries[existingIndex].PlaylistName = &playlistName
		}
		if backendUsed != "" {
			history.Entries[existingIndex].BackendUsed = &backendUsed
		}
		success := true
		history.Entries[existingIndex].Success = &success
	} else {
		// Add new entry
		success := true
		entry := ImageHistoryEntry{
			ImageID:      imageID,
			ImagePath:    imagePath,
			MediaType:    mediaType,
			MonitorName:  monitorName,
			SetAt:        now,
			Duration:     duration,
			PlaylistName: &playlistName,
			BackendUsed:  &backendUsed,
			Success:      &success,
		}
		history.Entries = append(history.Entries, entry)

		// Update by-monitor index
		if history.ByMonitor == nil {
			history.ByMonitor = make(map[string][]string)
		}
		history.ByMonitor[monitorName] = append(history.ByMonitor[monitorName], imageID)
	}

	// Cleanup old entries if needed
	if len(history.Entries) > history.Metadata.Limit {
		err := hs.cleanupHistory(history)
		if err != nil {
			return fmt.Errorf("failed to cleanup history: %w", err)
		}
	}

	return hs.SaveImageHistory(history)
}

// GetHistoryByMonitor returns history for a specific monitor
func (hs *HistoryStore) GetHistoryByMonitor(monitorName string, limit int) ([]ImageHistoryEntry, error) {
	history, err := hs.LoadImageHistory()
	if err != nil {
		return nil, err
	}

	var monitorHistory []ImageHistoryEntry
	for _, entry := range history.Entries {
		if entry.MonitorName == monitorName {
			monitorHistory = append(monitorHistory, entry)
		}
	}

	// Sort by most recent first
	sort.Slice(monitorHistory, func(i, j int) bool {
		return monitorHistory[i].SetAt.After(monitorHistory[j].SetAt)
	})

	if limit > 0 && len(monitorHistory) > limit {
		monitorHistory = monitorHistory[:limit]
	}

	return monitorHistory, nil
}

// GetRecentHistory returns recent history across all monitors
func (hs *HistoryStore) GetRecentHistory(limit int) ([]ImageHistoryEntry, error) {
	history, err := hs.LoadImageHistory()
	if err != nil {
		return nil, err
	}

	// Sort by most recent first
	sort.Slice(history.Entries, func(i, j int) bool {
		return history.Entries[i].SetAt.After(history.Entries[j].SetAt)
	})

	if limit > 0 && len(history.Entries) > limit {
		return history.Entries[:limit], nil
	}

	return history.Entries, nil
}

// ClearHistory clears all image history
func (hs *HistoryStore) ClearHistory() error {
	history := hs.getDefaultImageHistory()
	return hs.SaveImageHistory(history)
}

// ClearHistoryByMonitor clears history for a specific monitor
func (hs *HistoryStore) ClearHistoryByMonitor(monitorName string) error {
	history, err := hs.LoadImageHistory()
	if err != nil {
		return err
	}

	// Filter entries for other monitors
	var newEntries []ImageHistoryEntry
	for _, entry := range history.Entries {
		if entry.MonitorName != monitorName {
			newEntries = append(newEntries, entry)
		}
	}

	history.Entries = newEntries

	// Remove from by-monitor index
	if history.ByMonitor != nil {
		delete(history.ByMonitor, monitorName)
	}

	return hs.SaveImageHistory(history)
}

// UpdateHistoryLimit updates the history limit
func (hs *HistoryStore) UpdateHistoryLimit(limit int) error {
	history, err := hs.LoadImageHistory()
	if err != nil {
		return err
	}

	history.Metadata.Limit = limit

	// Cleanup if new limit is smaller
	if len(history.Entries) > limit {
		err := hs.cleanupHistory(history)
		if err != nil {
			return fmt.Errorf("failed to cleanup history: %w", err)
		}
	}

	return hs.SaveImageHistory(history)
}

// CalculateHistoryStatistics calculates history statistics
func (hs *HistoryStore) CalculateHistoryStatistics() (*ImageHistoryStats, error) {
	history, err := hs.LoadImageHistory()
	if err != nil {
		return nil, err
	}

	stats := &ImageHistoryStats{
		TotalDisplays:   int64(len(history.Entries)),
		WeeklyDisplays:  make(map[string]int64),
		MostUsedImages:  []string{},
		PopularMonitors: make(map[string]int64),
		MostActiveHours: []int{},
	}

	// Count displays per week
	for _, entry := range history.Entries {
		week := entry.SetAt.Format("2006-W01") // ISO week format
		stats.WeeklyDisplays[week]++
	}

	// Count images by usage
	imageUsage := make(map[string]int64)
	hourlyUsage := make(map[int]int64)

	for _, entry := range history.Entries {
		imageUsage[entry.ImageID]++
		hour := entry.SetAt.Hour()
		hourlyUsage[hour]++

		// Count monitor usage
		stats.PopularMonitors[entry.MonitorName]++
	}

	// Find most used images
	for imageID, count := range imageUsage {
		if len(stats.MostUsedImages) < 10 || count > int64(len(stats.MostUsedImages)) {
			// Simple heuristic for top images - in production, use proper sorting
			stats.MostUsedImages = append(stats.MostUsedImages, imageID)
		}
	}

	// Find most active hours
	for hour, count := range hourlyUsage {
		if len(stats.MostActiveHours) < 5 || count > int64(len(stats.MostActiveHours)) {
			stats.MostActiveHours = append(stats.MostActiveHours, hour)
		}
	}
	sort.Ints(stats.MostActiveHours)

	// Calculate average display time
	totalDuration := int64(0)
	validDurations := 0
	for _, entry := range history.Entries {
		if entry.Duration != nil {
			totalDuration += *entry.Duration
			validDurations++
		}
	}

	if validDurations > 0 {
		avgDuration := totalDuration / int64(validDurations)
		stats.AverageDisplayTime = &avgDuration
	}

	// Calculate error rate
	errors := 0
	for _, entry := range history.Entries {
		if entry.Success != nil && !*entry.Success {
			errors++
		}
	}

	if len(history.Entries) > 0 {
		errorRate := float64(errors) / float64(len(history.Entries))
		stats.ErrorRate = &errorRate
	}

	return stats, nil
}

// Helper functions

// cleanupHistory removes old entries beyond the limit
func (hs *HistoryStore) cleanupHistory(history *ImageHistory) error {
	if len(history.Entries) <= history.Metadata.Limit {
		return nil
	}

	// Sort by mostRecent first
	sort.Slice(history.Entries, func(i, j int) bool {
		return history.Entries[i].SetAt.After(history.Entries[j].SetAt)
	})

	// Keep only the most recent entries
	keepCount := history.Metadata.Limit
	history.Entries = history.Entries[:keepCount]

	// Rebuild ByMonitor index
	history.ByMonitor = make(map[string][]string)
	for _, entry := range history.Entries {
		history.ByMonitor[entry.MonitorName] = append(history.ByMonitor[entry.MonitorName], entry.ImageID)
	}

	history.Metadata.LastCleanup = time.Now()
	return nil
}

// getDefaultImageHistory returns a default image history
func (hs *HistoryStore) getDefaultImageHistory() *ImageHistory {
	now := time.Now()
	return &ImageHistory{
		Metadata: ImageHistoryMetadata{
			Version:      "1.0",
			Limit:        50,
			LastCleanup:  now,
			TotalEntries: 0,
			OldestEntry:  now,
			NewestEntry:  now,
		},
		Entries:    []ImageHistoryEntry{},
		ByMonitor:  make(map[string][]string),
		Statistics: ImageHistoryStats{},
	}
}
