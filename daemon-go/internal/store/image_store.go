package store

import (
	"fmt"
	"os"
	"time"

	"waypaper-engine/daemon-go/internal/media"
)

// ImageStore handles image registry operations
type ImageStore struct {
	store *Store
}

// NewImageStore creates a new image store
func NewImageStore(store *Store) *ImageStore {
	return &ImageStore{
		store: store,
	}
}

// LoadImageRegistry loads the image registry from the JSON file
func (is *ImageStore) LoadImageRegistry() (*ImageRegistry, error) {
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
				return nil, fmt.Errorf("failed to create new image registry: %w", err)
			}
		} else {
			return nil, fmt.Errorf("failed to load image registry: %w", err)
		}
	}

	return &registry, nil
}

// SaveImageRegistry saves the image registry to the JSON file
func (is *ImageStore) SaveImageRegistry(registry *ImageRegistry) error {
	registryPath := is.store.getFilePath("images.json")
	return is.store.saveJSON(registryPath, registry)
}

// AddImage adds an image to the registry
func (is *ImageStore) AddImage(image Image) error {
	registry, err := is.LoadImageRegistry()
	if err != nil {
		return fmt.Errorf("failed to load image registry: %w", err)
	}

	// Check if image already exists
	for _, existingImg := range registry.Images {
		if existingImg.ID == image.ID {
			return fmt.Errorf("image with ID %d already exists", image.ID)
		}
	}

	// Add image
	registry.Images = append(registry.Images, image)
	registry.Metadata.TotalImages = len(registry.Images)
	registry.Metadata.LastUpdated = time.Now()

	// Update indices
	is.updateIndices(registry, image)

	return is.SaveImageRegistry(registry)
}

// RemoveImage removes an image from the registry
func (is *ImageStore) RemoveImage(imageID int64) error {
	registry, err := is.LoadImageRegistry()
	if err != nil {
		return fmt.Errorf("failed to load image registry: %w", err)
	}

	// Find and remove image
	for i, img := range registry.Images {
		if img.ID == imageID {
			registry.Images = append(registry.Images[:i], registry.Images[i+1:]...)
			registry.Metadata.TotalImages = len(registry.Images)
			registry.Metadata.LastUpdated = time.Now()

			// Rebuild indices
			is.rebuildIndices(registry)

			return is.SaveImageRegistry(registry)
		}
	}

	return fmt.Errorf("image with ID %d not found", imageID)
}

// GetImageByID retrieves an image by its ID
func (is *ImageStore) GetImageByID(imageID int64) (*Image, error) {
	registry, err := is.LoadImageRegistry()
	if err != nil {
		return nil, fmt.Errorf("failed to load image registry: %w", err)
	}

	for _, img := range registry.Images {
		if img.ID == imageID {
			return &img, nil
		}
	}

	return nil, fmt.Errorf("image with ID %d not found", imageID)
}

// GetImagesByFormat retrieves images by format
func (is *ImageStore) GetImagesByFormat(format string) ([]Image, error) {
	registry, err := is.LoadImageRegistry()
	if err != nil {
		return nil, fmt.Errorf("failed to load image registry: %w", err)
	}

	var images []Image
	for _, img := range registry.Images {
		if img.Metadata.Format == format {
			images = append(images, img)
		}
	}

	return images, nil
}

// GetImagesByMediaType retrieves images by media type
func (is *ImageStore) GetImagesByMediaType(mediaType media.MediaType) ([]Image, error) {
	registry, err := is.LoadImageRegistry()
	if err != nil {
		return nil, fmt.Errorf("failed to load image registry: %w", err)
	}

	var images []Image
	for _, img := range registry.Images {
		if img.MediaType == mediaType {
			images = append(images, img)
		}
	}

	return images, nil
}

// GetSelectedImages retrieves all selected images
func (is *ImageStore) GetSelectedImages() ([]Image, error) {
	registry, err := is.LoadImageRegistry()
	if err != nil {
		return nil, fmt.Errorf("failed to load image registry: %w", err)
	}

	var images []Image
	for _, img := range registry.Images {
		if img.Selection.IsSelected {
			images = append(images, img)
		}
	}

	return images, nil
}

// UpdateImageSelection updates the selection status of an image
func (is *ImageStore) UpdateImageSelection(imageID int64, isChecked, isSelected bool) error {
	registry, err := is.LoadImageRegistry()
	if err != nil {
		return fmt.Errorf("failed to load image registry: %w", err)
	}

	for i, img := range registry.Images {
		if img.ID == imageID {
			registry.Images[i].Selection.IsChecked = isChecked
			registry.Images[i].Selection.IsSelected = isSelected
			if isSelected {
				now := time.Now()
				registry.Images[i].Selection.SelectedAt = &now
			}
			registry.Metadata.LastUpdated = time.Now()

			// Rebuild indices
			is.rebuildIndices(registry)

			return is.SaveImageRegistry(registry)
		}
	}

	return fmt.Errorf("image with ID %d not found", imageID)
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

// ValidateRegistry validates the integrity of the image registry
func (is *ImageStore) ValidateRegistry() error {
	registry, err := is.LoadImageRegistry()
	if err != nil {
		return fmt.Errorf("failed to load image registry: %w", err)
	}

	// Check for duplicate IDs
	idMap := make(map[int64]bool)
	for _, img := range registry.Images {
		if idMap[img.ID] {
			return fmt.Errorf("duplicate image ID found: %d", img.ID)
		}
		idMap[img.ID] = true
	}

	// Check for duplicate names
	nameMap := make(map[string]bool)
	for _, img := range registry.Images {
		if nameMap[img.Name] {
			return fmt.Errorf("duplicate image name found: %s", img.Name)
		}
		nameMap[img.Name] = true
	}

	// Validate metadata consistency
	if registry.Metadata.TotalImages != len(registry.Images) {
		return fmt.Errorf("metadata total images (%d) doesn't match actual count (%d)",
			registry.Metadata.TotalImages, len(registry.Images))
	}

	return nil
}

// GetRegistryStats returns statistics about the image registry
func (is *ImageStore) GetRegistryStats() (map[string]interface{}, error) {
	registry, err := is.LoadImageRegistry()
	if err != nil {
		return nil, fmt.Errorf("failed to load image registry: %w", err)
	}

	stats := map[string]interface{}{
		"totalImages":   len(registry.Images),
		"lastUpdated":   registry.Metadata.LastUpdated,
		"version":       registry.Metadata.Version,
		"formats":       make(map[string]int),
		"mediaTypes":    make(map[string]int),
		"selectedCount": 0,
		"checkedCount":  0,
	}

	// Count formats
	for _, img := range registry.Images {
		formatCount := stats["formats"].(map[string]int)
		formatCount[img.Metadata.Format]++
	}

	// Count media types
	for _, img := range registry.Images {
		mediaTypeCount := stats["mediaTypes"].(map[string]int)
		mediaTypeCount[string(img.MediaType)]++
	}

	// Count selections
	for _, img := range registry.Images {
		if img.Selection.IsSelected {
			stats["selectedCount"] = stats["selectedCount"].(int) + 1
		}
		if img.Selection.IsChecked {
			stats["checkedCount"] = stats["checkedCount"].(int) + 1
		}
	}

	return stats, nil
}
