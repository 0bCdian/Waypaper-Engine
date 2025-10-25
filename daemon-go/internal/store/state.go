package store

import (
	"encoding/json"
	"fmt"
	"log/slog"
	"os"
	"path/filepath"
	"time"
)

// StateManager handles state persistence operations
type StateManager struct {
	store  *Store
	logger *slog.Logger
}

// NewStateManager creates a new state manager
func NewStateManager(store *Store, logger *slog.Logger) *StateManager {
	return &StateManager{
		store:  store,
		logger: logger,
	}
}

// SaveImageSetState saves the current image set state to disk
func (sm *StateManager) SaveImageSetState(state *ImageSetState) error {
	statePath := filepath.Join(sm.store.basePath, "image_set_state.json")

	// Ensure directory exists
	if err := os.MkdirAll(filepath.Dir(statePath), 0755); err != nil {
		return fmt.Errorf("failed to create state directory: %w", err)
	}

	// Marshal to JSON
	data, err := json.MarshalIndent(state, "", "  ")
	if err != nil {
		return fmt.Errorf("failed to marshal image set state: %w", err)
	}

	// Write to file atomically
	tempPath := statePath + ".tmp"
	if err := os.WriteFile(tempPath, data, 0644); err != nil {
		return fmt.Errorf("failed to write temporary state file: %w", err)
	}

	if err := os.Rename(tempPath, statePath); err != nil {
		os.Remove(tempPath) // Cleanup temp file
		return fmt.Errorf("failed to rename temporary state file: %w", err)
	}

	sm.logger.Debug("saved image set state", "path", statePath, "imageID", state.ImageID)
	return nil
}

// LoadImageSetState loads the current image set state from disk
func (sm *StateManager) LoadImageSetState() (*ImageSetState, error) {
	statePath := filepath.Join(sm.store.basePath, "image_set_state.json")

	// Check if file exists
	if _, err := os.Stat(statePath); os.IsNotExist(err) {
		// Return default state if file doesn't exist
		return &ImageSetState{
			ImageID:   "",
			ImagePath: "",
			SetType:   "individual",
			Monitors:  make(map[string]Monitor),
			LastSet:   time.Now(),
		}, nil
	}

	// Read file
	data, err := os.ReadFile(statePath)
	if err != nil {
		return nil, fmt.Errorf("failed to read image set state file: %w", err)
	}

	// Unmarshal JSON
	var state ImageSetState
	if err := json.Unmarshal(data, &state); err != nil {
		return nil, fmt.Errorf("failed to unmarshal image set state: %w", err)
	}

	sm.logger.Debug("loaded image set state", "path", statePath, "imageID", state.ImageID)
	return &state, nil
}

// SaveActivePlaylistState saves the active playlist state to disk
func (sm *StateManager) SaveActivePlaylistState(state *ManagerActivePlaylistState) error {
	statePath := filepath.Join(sm.store.basePath, "active_playlist_state.json")

	// Ensure directory exists
	if err := os.MkdirAll(filepath.Dir(statePath), 0755); err != nil {
		return fmt.Errorf("failed to create state directory: %w", err)
	}

	// Update last updated timestamp
	state.LastUpdated = time.Now()

	// Marshal to JSON
	data, err := json.MarshalIndent(state, "", "  ")
	if err != nil {
		return fmt.Errorf("failed to marshal active playlist state: %w", err)
	}

	// Write to file atomically
	tempPath := statePath + ".tmp"
	if err := os.WriteFile(tempPath, data, 0644); err != nil {
		return fmt.Errorf("failed to write temporary state file: %w", err)
	}

	if err := os.Rename(tempPath, statePath); err != nil {
		os.Remove(tempPath) // Cleanup temp file
		return fmt.Errorf("failed to rename temporary state file: %w", err)
	}

	sm.logger.Debug("saved active playlist state", "path", statePath, "playlistCount", len(state.ActivePlaylists))
	return nil
}

// LoadActivePlaylistState loads the active playlist state from disk
func (sm *StateManager) LoadActivePlaylistState() (*ManagerActivePlaylistState, error) {
	statePath := filepath.Join(sm.store.basePath, "active_playlist_state.json")

	// Check if file exists
	if _, err := os.Stat(statePath); os.IsNotExist(err) {
		// Return default state if file doesn't exist
		return &ManagerActivePlaylistState{
			ActivePlaylists: make(map[string]*PlaylistInstance),
			LastUpdated:     time.Now(),
		}, nil
	}

	// Read file
	data, err := os.ReadFile(statePath)
	if err != nil {
		return nil, fmt.Errorf("failed to read active playlist state file: %w", err)
	}

	// Unmarshal JSON
	var state ManagerActivePlaylistState
	if err := json.Unmarshal(data, &state); err != nil {
		return nil, fmt.Errorf("failed to unmarshal active playlist state: %w", err)
	}

	sm.logger.Debug("loaded active playlist state", "path", statePath, "playlistCount", len(state.ActivePlaylists))
	return &state, nil
}

// SaveImageHistory saves the image history to disk
func (sm *StateManager) SaveImageHistory(history []ImageHistoryEntry) error {
	historyPath := filepath.Join(sm.store.basePath, "image_history.json")

	// Ensure directory exists
	if err := os.MkdirAll(filepath.Dir(historyPath), 0755); err != nil {
		return fmt.Errorf("failed to create history directory: %w", err)
	}

	// Marshal to JSON
	data, err := json.MarshalIndent(history, "", "  ")
	if err != nil {
		return fmt.Errorf("failed to marshal image history: %w", err)
	}

	// Write to file atomically
	tempPath := historyPath + ".tmp"
	if err := os.WriteFile(tempPath, data, 0644); err != nil {
		return fmt.Errorf("failed to write temporary history file: %w", err)
	}

	if err := os.Rename(tempPath, historyPath); err != nil {
		os.Remove(tempPath) // Cleanup temp file
		return fmt.Errorf("failed to rename temporary history file: %w", err)
	}

	sm.logger.Debug("saved image history", "path", historyPath, "entryCount", len(history))
	return nil
}

// LoadImageHistory loads the image history from disk
func (sm *StateManager) LoadImageHistory() ([]ImageHistoryEntry, error) {
	historyPath := filepath.Join(sm.store.basePath, "image_history.json")

	// Check if file exists
	if _, err := os.Stat(historyPath); os.IsNotExist(err) {
		// Return empty history if file doesn't exist
		return []ImageHistoryEntry{}, nil
	}

	// Read file
	data, err := os.ReadFile(historyPath)
	if err != nil {
		return nil, fmt.Errorf("failed to read image history file: %w", err)
	}

	// Unmarshal JSON
	var history []ImageHistoryEntry
	if err := json.Unmarshal(data, &history); err != nil {
		return nil, fmt.Errorf("failed to unmarshal image history: %w", err)
	}

	sm.logger.Debug("loaded image history", "path", historyPath, "entryCount", len(history))
	return history, nil
}

// AddImageHistoryEntry adds an entry to the image history and trims if necessary
func (sm *StateManager) AddImageHistoryEntry(entry ImageHistoryEntry, maxEntries int) error {
	// Load existing history
	history, err := sm.LoadImageHistory()
	if err != nil {
		return fmt.Errorf("failed to load image history: %w", err)
	}

	// Add new entry at the beginning
	newHistory := make([]ImageHistoryEntry, 0, len(history)+1)
	newHistory = append(newHistory, entry)
	newHistory = append(newHistory, history...)

	// Trim to max entries if necessary
	if len(newHistory) > maxEntries {
		newHistory = newHistory[:maxEntries]
	}

	// Save updated history
	return sm.SaveImageHistory(newHistory)
}
