package store

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"sync"
)

// SequentialIDManager manages sequential integer IDs for images
type SequentialIDManager struct {
	mu     sync.Mutex
	nextID int64
	store  *Store
	idFile string
}

// NewSequentialIDManager creates a new sequential ID manager
func NewSequentialIDManager(store *Store) *SequentialIDManager {
	return &SequentialIDManager{
		store:  store,
		idFile: filepath.Join(store.basePath, "next_image_id.json"),
	}
}

// GetNextID returns the next available sequential ID
func (sim *SequentialIDManager) GetNextID() (int64, error) {
	sim.mu.Lock()
	defer sim.mu.Unlock()

	// Load current next ID
	if err := sim.loadNextID(); err != nil {
		return 0, fmt.Errorf("failed to load next ID: %w", err)
	}

	// Increment and save
	sim.nextID++
	if err := sim.saveNextID(); err != nil {
		return 0, fmt.Errorf("failed to save next ID: %w", err)
	}

	return sim.nextID, nil
}

// InitializeFromRegistry sets the next ID based on existing images
func (sim *SequentialIDManager) InitializeFromRegistry() error {
	sim.mu.Lock()
	defer sim.mu.Unlock()

	registry, err := sim.store.LoadImageRegistry()
	if err != nil {
		return fmt.Errorf("failed to load image registry: %w", err)
	}

	maxID := int64(0)
	for _, img := range registry.Images {
		if img.ID > maxID {
			maxID = img.ID
		}
	}

	sim.nextID = maxID
	return sim.saveNextID()
}

// loadNextID loads the next ID from file
func (sim *SequentialIDManager) loadNextID() error {
	if _, err := os.Stat(sim.idFile); os.IsNotExist(err) {
		// File doesn't exist, start from 1
		sim.nextID = 0
		return nil
	}

	data, err := os.ReadFile(sim.idFile)
	if err != nil {
		return err
	}

	var idData struct {
		NextID int64 `json:"next_id"`
	}

	if err := json.Unmarshal(data, &idData); err != nil {
		return err
	}

	sim.nextID = idData.NextID
	return nil
}

// saveNextID saves the next ID to file
func (sim *SequentialIDManager) saveNextID() error {
	idData := struct {
		NextID int64 `json:"next_id"`
	}{
		NextID: sim.nextID,
	}

	data, err := json.Marshal(idData)
	if err != nil {
		return err
	}

	return os.WriteFile(sim.idFile, data, 0644)
}
