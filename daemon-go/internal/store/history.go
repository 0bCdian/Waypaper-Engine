package store

import (
	"fmt"
	"log/slog"
	"time"
)

// HistoryManager handles image history operations
type HistoryManager struct {
	stateManager *StateManager
	logger       *slog.Logger
	maxEntries   int
}

// NewHistoryManager creates a new history manager
func NewHistoryManager(stateManager *StateManager, logger *slog.Logger, maxEntries int) *HistoryManager {
	return &HistoryManager{
		stateManager: stateManager,
		logger:       logger,
		maxEntries:   maxEntries,
	}
}

// LoadImageHistory loads image history with the configured limit
func (hm *HistoryManager) LoadImageHistory() ([]ImageHistoryEntry, error) {
	history, err := hm.stateManager.LoadImageHistory()
	if err != nil {
		return nil, fmt.Errorf("failed to load image history: %w", err)
	}

	// Limit to max entries
	if len(history) > hm.maxEntries {
		history = history[:hm.maxEntries]
	}

	hm.logger.Debug("loaded image history", "count", len(history), "maxEntries", hm.maxEntries)
	return history, nil
}

// AddImageHistoryEntry adds an entry to the image history
func (hm *HistoryManager) AddImageHistoryEntry(entry ImageHistoryEntry) error {
	// Generate ID if not provided
	if entry.ID == "" {
		entry.ID = generateHistoryEntryID(entry)
	}

	// Set timestamp if not provided
	if entry.SetAt.IsZero() {
		entry.SetAt = time.Now()
	}

	// Add entry with automatic trimming
	if err := hm.stateManager.AddImageHistoryEntry(entry, hm.maxEntries); err != nil {
		return fmt.Errorf("failed to add image history entry: %w", err)
	}

	hm.logger.Debug("added image history entry", "imageID", entry.ImageID, "monitors", entry.Monitors)
	return nil
}

// ClearImageHistory clears all image history
func (hm *HistoryManager) ClearImageHistory() error {
	if err := hm.stateManager.SaveImageHistory([]ImageHistoryEntry{}); err != nil {
		return fmt.Errorf("failed to clear image history: %w", err)
	}

	hm.logger.Info("cleared image history")
	return nil
}

// GetImageHistoryByImageID gets all history entries for a specific image
func (hm *HistoryManager) GetImageHistoryByImageID(imageID string) ([]ImageHistoryEntry, error) {
	history, err := hm.LoadImageHistory()
	if err != nil {
		return nil, err
	}

	var filtered []ImageHistoryEntry
	for _, entry := range history {
		if entry.ImageID == imageID {
			filtered = append(filtered, entry)
		}
	}

	return filtered, nil
}

// GetImageHistoryByMonitor gets all history entries for a specific monitor
func (hm *HistoryManager) GetImageHistoryByMonitor(monitorName string) ([]ImageHistoryEntry, error) {
	history, err := hm.LoadImageHistory()
	if err != nil {
		return nil, err
	}

	var filtered []ImageHistoryEntry
	for _, entry := range history {
		for _, monitor := range entry.Monitors {
			if monitor == monitorName {
				filtered = append(filtered, entry)
				break
			}
		}
	}

	return filtered, nil
}

// GetRecentImageHistory gets the most recent history entries
func (hm *HistoryManager) GetRecentImageHistory(limit int) ([]ImageHistoryEntry, error) {
	history, err := hm.LoadImageHistory()
	if err != nil {
		return nil, err
	}

	// History is already sorted by most recent first
	if limit > 0 && len(history) > limit {
		history = history[:limit]
	}

	return history, nil
}

// generateHistoryEntryID generates a unique ID for a history entry
func generateHistoryEntryID(entry ImageHistoryEntry) string {
	// Create a simple ID based on timestamp and image ID
	timestamp := entry.SetAt.Unix()
	return fmt.Sprintf("%d_%s", timestamp, entry.ImageID)
}

// ValidateHistoryEntry validates a history entry
func ValidateHistoryEntry(entry ImageHistoryEntry) error {
	if entry.ImageID == "" {
		return fmt.Errorf("image ID is required")
	}

	if entry.ImagePath == "" {
		return fmt.Errorf("image path is required")
	}

	if len(entry.Monitors) == 0 {
		return fmt.Errorf("at least one monitor is required")
	}

	if entry.Mode == "" {
		return fmt.Errorf("mode is required")
	}

	// Validate mode
	validModes := map[string]bool{
		"individual": true,
		"extend":     true,
		"clone":      true,
	}

	if !validModes[entry.Mode] {
		return fmt.Errorf("invalid mode: %s", entry.Mode)
	}

	// Validate individual mode has exactly one monitor
	if entry.Mode == "individual" && len(entry.Monitors) != 1 {
		return fmt.Errorf("individual mode requires exactly one monitor, got %d", len(entry.Monitors))
	}

	return nil
}
