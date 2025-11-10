package store

import (
	"fmt"
	"os"
	"sync"
	"time"

	"waypaper-engine/daemon-go/internal/media"
)

// ImageStore handles image registry operations
type ImageStore struct {
	store         *Store
	registry      *ImageRegistry
	registryMutex sync.RWMutex
	imagesMap     map[int64]*Image // Fast O(1) lookup by ID
	initialized   bool
}

// NewImageStore creates a new image store
func NewImageStore(store *Store) *ImageStore {
	return &ImageStore{
		store:     store,
		imagesMap: make(map[int64]*Image),
	}
}

// ensureInitialized ensures the in-memory registry is loaded
func (is *ImageStore) ensureInitialized() error {
	is.registryMutex.RLock()
	initialized := is.initialized
	is.registryMutex.RUnlock()

	if initialized {
		return nil
	}

	// Upgrade to write lock for initialization
	is.registryMutex.Lock()
	defer is.registryMutex.Unlock()

	// Double-check after acquiring write lock
	if is.initialized {
		return nil
	}

	registryPath := is.store.getFilePath("images.json")

	var registry ImageRegistry
	if err := is.store.loadJSON(registryPath, &registry); err != nil {
		if os.IsNotExist(err) {
			// Create new registry if file doesn't exist
			registry = ImageRegistry{
				Metadata: ImageRegistryMetadata{
					Version:     "1.0",
					LastUpdated: time.Now(),
					TotalImages: 0,
				},
				Images: []Image{},
				Indices: ImageRegistryIndices{
					ByName:       make(map[string]string),
					ByMediaType:  make(map[media.MediaType][]string),
					ByFormat:     make(map[string][]string),
					ByDimensions: make(map[string][]string),
					ByTags:       make(map[string][]string),
					BySelected:   make(map[string][]string),
				},
			}

			// Save the new registry
			if err := is.store.saveJSON(registryPath, registry); err != nil {
				return fmt.Errorf("failed to create new image registry: %w", err)
			}
		} else {
			return fmt.Errorf("failed to load image registry: %w", err)
		}
	}

	// Populate in-memory map
	is.imagesMap = make(map[int64]*Image, len(registry.Images))
	for i := range registry.Images {
		is.imagesMap[registry.Images[i].ID] = &registry.Images[i]
	}

	is.registry = &registry
	is.initialized = true

	return nil
}

// LoadImageRegistry loads the image registry from the JSON file and populates in-memory map
func (is *ImageStore) LoadImageRegistry() (*ImageRegistry, error) {
	if err := is.ensureInitialized(); err != nil {
		return nil, err
	}

	is.registryMutex.RLock()
	defer is.registryMutex.RUnlock()

	return is.registry, nil
}

// SaveImageRegistry saves the in-memory registry to the JSON file
func (is *ImageStore) SaveImageRegistry(registry *ImageRegistry) error {
	if err := is.ensureInitialized(); err != nil {
		return err
	}

	is.registryMutex.Lock()
	defer is.registryMutex.Unlock()

	// Update the in-memory registry reference
	is.registry = registry

	// Sync imagesMap with registry.Images
	is.imagesMap = make(map[int64]*Image, len(registry.Images))
	for i := range registry.Images {
		is.imagesMap[registry.Images[i].ID] = &registry.Images[i]
	}

	registryPath := is.store.getFilePath("images.json")
	return is.store.saveJSON(registryPath, registry)
}

// AddImage adds an image to the registry using O(1) duplicate check and insert
func (is *ImageStore) AddImage(image Image) error {
	if err := is.ensureInitialized(); err != nil {
		return fmt.Errorf("failed to load image registry: %w", err)
	}

	is.registryMutex.Lock()
	defer is.registryMutex.Unlock()

	// O(1) check if image already exists
	if _, exists := is.imagesMap[image.ID]; exists {
		return fmt.Errorf("image with ID %d already exists", image.ID)
	}

	// Add image to slice
	is.registry.Images = append(is.registry.Images, image)
	is.registry.Metadata.TotalImages = len(is.registry.Images)
	is.registry.Metadata.LastUpdated = time.Now()

	// Add to map for O(1) lookup
	is.imagesMap[image.ID] = &is.registry.Images[len(is.registry.Images)-1]

	// Update indices
	is.updateIndices(is.registry, image)

	// Save to disk
	registryPath := is.store.getFilePath("images.json")
	return is.store.saveJSON(registryPath, is.registry)
}

// AddImages adds multiple images to the registry in a single batch operation
// This is optimized for bulk image imports where many images are added at once
func (is *ImageStore) AddImages(images []Image) error {
	if len(images) == 0 {
		return nil
	}

	if err := is.ensureInitialized(); err != nil {
		return fmt.Errorf("failed to load image registry: %w", err)
	}

	is.registryMutex.Lock()
	defer is.registryMutex.Unlock()

	// Check for duplicates first (O(1) per image)
	for _, image := range images {
		if _, exists := is.imagesMap[image.ID]; exists {
			return fmt.Errorf("image with ID %d already exists", image.ID)
		}
	}

	// Add all images to slice
	startIdx := len(is.registry.Images)
	is.registry.Images = append(is.registry.Images, images...)
	is.registry.Metadata.TotalImages = len(is.registry.Images)
	is.registry.Metadata.LastUpdated = time.Now()

	// Add all images to map and update indices
	for i := range images {
		imageIdx := startIdx + i
		is.imagesMap[images[i].ID] = &is.registry.Images[imageIdx]
		is.updateIndices(is.registry, images[i])
	}

	// Single save operation for all images
	registryPath := is.store.getFilePath("images.json")
	return is.store.saveJSON(registryPath, is.registry)
}

// RemoveImage removes an image from the registry using O(1) lookup
func (is *ImageStore) RemoveImage(imageID int64) error {
	if err := is.ensureInitialized(); err != nil {
		return fmt.Errorf("failed to load image registry: %w", err)
	}

	is.registryMutex.Lock()
	defer is.registryMutex.Unlock()

	// O(1) check if image exists
	if _, exists := is.imagesMap[imageID]; !exists {
		return fmt.Errorf("image with ID %d not found", imageID)
	}

	// Find index in slice (we still need to search slice for removal)
	// But we know it exists from the map check
	var foundIdx int = -1
	for i, img := range is.registry.Images {
		if img.ID == imageID {
			foundIdx = i
			break
		}
	}

	if foundIdx == -1 {
		// Should not happen if map is in sync, but handle it
		return fmt.Errorf("image with ID %d not found in slice", imageID)
	}

	// Remove from slice
	is.registry.Images = append(is.registry.Images[:foundIdx], is.registry.Images[foundIdx+1:]...)
	is.registry.Metadata.TotalImages = len(is.registry.Images)
	is.registry.Metadata.LastUpdated = time.Now()

	// Remove from map
	delete(is.imagesMap, imageID)

	// Rebuild indices (needed because we removed an image)
	is.rebuildIndices(is.registry)

	// Save to disk
	registryPath := is.store.getFilePath("images.json")
	return is.store.saveJSON(registryPath, is.registry)
}

// GetImageByID retrieves an image by its ID using O(1) map lookup
func (is *ImageStore) GetImageByID(imageID int64) (*Image, error) {
	if err := is.ensureInitialized(); err != nil {
		return nil, fmt.Errorf("failed to load image registry: %w", err)
	}

	is.registryMutex.RLock()
	defer is.registryMutex.RUnlock()

	if img, exists := is.imagesMap[imageID]; exists {
		// Return a copy to avoid race conditions
		imgCopy := *img
		return &imgCopy, nil
	}

	return nil, fmt.Errorf("image with ID %d not found", imageID)
}

// GetImagesByFormat retrieves images by format using in-memory registry
func (is *ImageStore) GetImagesByFormat(format string) ([]Image, error) {
	if err := is.ensureInitialized(); err != nil {
		return nil, fmt.Errorf("failed to load image registry: %w", err)
	}

	is.registryMutex.RLock()
	defer is.registryMutex.RUnlock()

	var images []Image
	for _, img := range is.registry.Images {
		if img.Metadata.Format == format {
			images = append(images, img)
		}
	}

	return images, nil
}

// GetImagesByMediaType retrieves images by media type using in-memory registry
func (is *ImageStore) GetImagesByMediaType(mediaType media.MediaType) ([]Image, error) {
	if err := is.ensureInitialized(); err != nil {
		return nil, fmt.Errorf("failed to load image registry: %w", err)
	}

	is.registryMutex.RLock()
	defer is.registryMutex.RUnlock()

	var images []Image
	for _, img := range is.registry.Images {
		if img.MediaType == mediaType {
			images = append(images, img)
		}
	}

	return images, nil
}

// GetSelectedImages retrieves all selected images using in-memory registry
func (is *ImageStore) GetSelectedImages() ([]Image, error) {
	if err := is.ensureInitialized(); err != nil {
		return nil, fmt.Errorf("failed to load image registry: %w", err)
	}

	is.registryMutex.RLock()
	defer is.registryMutex.RUnlock()

	var images []Image
	for _, img := range is.registry.Images {
		if img.Selection.IsSelected {
			images = append(images, img)
		}
	}

	return images, nil
}

// UpdateImageSelection updates the selection status of an image using in-memory registry
func (is *ImageStore) UpdateImageSelection(imageID int64, isChecked, isSelected bool) error {
	if err := is.ensureInitialized(); err != nil {
		return fmt.Errorf("failed to load image registry: %w", err)
	}

	is.registryMutex.Lock()
	defer is.registryMutex.Unlock()

	// O(1) lookup using map
	img, exists := is.imagesMap[imageID]
	if !exists {
		return fmt.Errorf("image with ID %d not found", imageID)
	}

	// Update selection status
	img.Selection.IsChecked = isChecked
	img.Selection.IsSelected = isSelected
	if isSelected {
		now := time.Now()
		img.Selection.SelectedAt = &now
	}
	is.registry.Metadata.LastUpdated = time.Now()

	// Rebuild indices (selection changed)
	is.rebuildIndices(is.registry)

	// Save to disk
	registryPath := is.store.getFilePath("images.json")
	return is.store.saveJSON(registryPath, is.registry)
}

// updateIndices updates the registry indices for a new image
func (is *ImageStore) updateIndices(registry *ImageRegistry, image Image) {
	imageIDStr := fmt.Sprintf("%d", image.ID)

	// By name
	registry.Indices.ByName[image.Name] = imageIDStr

	// By media type
	if registry.Indices.ByMediaType[image.MediaType] == nil {
		registry.Indices.ByMediaType[image.MediaType] = []string{}
	}
	registry.Indices.ByMediaType[image.MediaType] = append(registry.Indices.ByMediaType[image.MediaType], imageIDStr)

	// By format
	if registry.Indices.ByFormat[image.Metadata.Format] == nil {
		registry.Indices.ByFormat[image.Metadata.Format] = []string{}
	}
	registry.Indices.ByFormat[image.Metadata.Format] = append(registry.Indices.ByFormat[image.Metadata.Format], imageIDStr)

	// By dimensions
	dimKey := fmt.Sprintf("%dx%d", image.Dimensions.Width, image.Dimensions.Height)
	if registry.Indices.ByDimensions[dimKey] == nil {
		registry.Indices.ByDimensions[dimKey] = []string{}
	}
	registry.Indices.ByDimensions[dimKey] = append(registry.Indices.ByDimensions[dimKey], imageIDStr)

	// By tags
	for _, tag := range image.Metadata.Tags {
		if registry.Indices.ByTags[tag] == nil {
			registry.Indices.ByTags[tag] = []string{}
		}
		registry.Indices.ByTags[tag] = append(registry.Indices.ByTags[tag], imageIDStr)
	}

	// By selection
	if image.Selection.IsChecked {
		if registry.Indices.BySelected["checked"] == nil {
			registry.Indices.BySelected["checked"] = []string{}
		}
		registry.Indices.BySelected["checked"] = append(registry.Indices.BySelected["checked"], imageIDStr)
	}
	if image.Selection.IsSelected {
		if registry.Indices.BySelected["selected"] == nil {
			registry.Indices.BySelected["selected"] = []string{}
		}
		registry.Indices.BySelected["selected"] = append(registry.Indices.BySelected["selected"], imageIDStr)
	}
}

// rebuildIndices rebuilds all indices from scratch
func (is *ImageStore) rebuildIndices(registry *ImageRegistry) {
	registry.Indices = ImageRegistryIndices{
		ByName:       make(map[string]string),
		ByMediaType:  make(map[media.MediaType][]string),
		ByFormat:     make(map[string][]string),
		ByDimensions: make(map[string][]string),
		ByTags:       make(map[string][]string),
		BySelected:   make(map[string][]string),
	}

	for _, image := range registry.Images {
		is.updateIndices(registry, image)
	}
}

// ValidateRegistry validates the integrity of the image registry using in-memory registry
func (is *ImageStore) ValidateRegistry() error {
	if err := is.ensureInitialized(); err != nil {
		return fmt.Errorf("failed to load image registry: %w", err)
	}

	is.registryMutex.RLock()
	defer is.registryMutex.RUnlock()

	// Check for duplicate IDs (using map should already prevent this, but validate)
	if len(is.imagesMap) != len(is.registry.Images) {
		return fmt.Errorf("imagesMap size (%d) doesn't match Images slice size (%d)",
			len(is.imagesMap), len(is.registry.Images))
	}

	// Check for duplicate names
	nameMap := make(map[string]bool)
	for _, img := range is.registry.Images {
		if nameMap[img.Name] {
			return fmt.Errorf("duplicate image name found: %s", img.Name)
		}
		nameMap[img.Name] = true
	}

	// Validate metadata consistency
	if is.registry.Metadata.TotalImages != len(is.registry.Images) {
		return fmt.Errorf("metadata total images (%d) doesn't match actual count (%d)",
			is.registry.Metadata.TotalImages, len(is.registry.Images))
	}

	return nil
}

// GetRegistryStats returns statistics about the image registry using in-memory registry
func (is *ImageStore) GetRegistryStats() (map[string]any, error) {
	if err := is.ensureInitialized(); err != nil {
		return nil, fmt.Errorf("failed to load image registry: %w", err)
	}

	is.registryMutex.RLock()
	defer is.registryMutex.RUnlock()

	stats := map[string]any{
		"totalImages":   len(is.registry.Images),
		"lastUpdated":   is.registry.Metadata.LastUpdated,
		"version":       is.registry.Metadata.Version,
		"formats":       make(map[string]int),
		"mediaTypes":    make(map[string]int),
		"selectedCount": 0,
		"checkedCount":  0,
	}

	// Count formats
	for _, img := range is.registry.Images {
		formatCount := stats["formats"].(map[string]int)
		formatCount[img.Metadata.Format]++
	}

	// Count media types
	for _, img := range is.registry.Images {
		mediaTypeCount := stats["mediaTypes"].(map[string]int)
		mediaTypeCount[string(img.MediaType)]++
	}

	// Count selections
	for _, img := range is.registry.Images {
		if img.Selection.IsSelected {
			stats["selectedCount"] = stats["selectedCount"].(int) + 1
		}
		if img.Selection.IsChecked {
			stats["checkedCount"] = stats["checkedCount"].(int) + 1
		}
	}

	return stats, nil
}
