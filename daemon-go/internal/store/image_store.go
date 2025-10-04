package store

import (
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"time"

	"waypaper-engine/daemon-go/internal/media"
)

// ImageStore handles image-specific storage operations
type ImageStore struct {
	store  *Store
	logger interface{} // Avoiding circular dependencies
}

// NewImageStore creates a new image store
func NewImageStore(store *Store) *ImageStore {
	return &ImageStore{
		store: store,
	}
}

// LoadImageRegistry loads the master image registry
func (is *ImageStore) LoadImageRegistry() (*ImageRegistry, error) {
	cacheKey := "image_registry"
	filePath := is.store.getFilePath("images.json")

	var registry ImageRegistry
	if err := is.store.cachedLoad(cacheKey, filePath, &registry); err != nil {
		// If file doesn't exist, return empty registry
		if strings.Contains(err.Error(), "not found") {
			return &ImageRegistry{
				Metadata: ImageRegistryMetadata{
					Version:     "1.0",
					LastUpdated: time.Now(),
					TotalImages: 0,
				},
				Images: []Image{},
				Indices: ImageRegistryIndices{
					ByName:       map[string]string{},
					ByMediaType:  map[media.MediaType][]string{},
					ByFormat:     map[string][]string{},
					ByDimensions: map[string][]string{},
					ByTags:       map[string][]string{},
					BySelected:   map[string][]string{},
				},
			}, nil
		}
		return nil, fmt.Errorf("failed to load image registry: %w", err)
	}

	return &registry, nil
}

// SaveImageRegistry saves the image registry
func (is *ImageStore) SaveImageRegistry(registry *ImageRegistry) error {
	registry.Metadata.LastUpdated = time.Now()
	registry.Metadata.TotalImages = len(registry.Images)

	// Rebuild indices
	is.rebuildIndices(registry)

	filePath := is.store.getFilePath("images.json")
	return is.store.saveJSON(filePath, registry)
}

// AddImage adds a new image to the registry
func (is *ImageStore) AddImage(image *Image) error {
	if image.ID == "" {
		// Use sequential ID instead of UUID for consistency with SQLite
		nextID, err := is.store.sequentialIDManager.GetNextID()
		if err != nil {
			return fmt.Errorf("failed to get next ID: %w", err)
		}
		image.ID = fmt.Sprintf("%d", nextID)
	}
	if image.ImportInfo.ImportedAt.IsZero() {
		image.ImportInfo.ImportedAt = time.Now()
	}
	if image.ImportInfo.Importer == "" {
		image.ImportInfo.Importer = "manual"
	}

	// Detect media type if not set
	if image.MediaType == "" {
		image.MediaType = is.store.mediaDetector.DetectMediaType(image.Path)
	}

	// Calculate checksum if not set
	if image.Metadata.Checksum == "" && image.Path != "" {
		checksum, err := is.calculateFileChecksum(image.Path)
		if err == nil {
			image.Metadata.Checksum = checksum
		}
	}

	// Create multi-resolution thumbnails if not already set
	if image.Thumbnails.Resolution720p == "" && image.Path != "" {
		thumbnailsDir := is.store.config.ThumbnailsDir
		if thumbnailsDir != "" {
			thumbnailPaths, err := is.createMultiResolutionThumbnails(image.Path, thumbnailsDir, image.Name)
			if err == nil {
				image.Thumbnails = thumbnailPaths
			} else {
				// Log warning but don't fail the operation
				// Note: Can't use logger directly due to type assertion, but we won't crash
			}
		}
	}

	registry, err := is.LoadImageRegistry()
	if err != nil {
		return err
	}

	// Check for duplicates
	for _, existing := range registry.Images {
		if existing.Path == image.Path {
			return fmt.Errorf("image already exists: %s", image.Path)
		}
	}

	registry.Images = append(registry.Images, *image)
	is.updateIndicesFromImage(registry, image)

	return is.SaveImageRegistry(registry)
}

// UpdateImage updates an existing image
func (is *ImageStore) UpdateImage(id string, updates func(*Image)) error {
	registry, err := is.LoadImageRegistry()
	if err != nil {
		return err
	}

	for i := range registry.Images {
		if registry.Images[i].ID == id {
			image := &registry.Images[i]
			updates(image)

			// Rebuild indices after update
			is.rebuildIndices(registry)
			return is.SaveImageRegistry(registry)
		}
	}

	return fmt.Errorf("image not found: %s", id)
}

// GetImageByID retrieves an image by its ID
func (is *ImageStore) GetImageByID(id string) (*Image, error) {
	registry, err := is.LoadImageRegistry()
	if err != nil {
		return nil, err
	}

	for _, img := range registry.Images {
		if img.ID == id {
			return &img, nil
		}
	}

	return nil, fmt.Errorf("image not found: %s", id)
}

// GetImageByName retrieves an image by its name
func (is *ImageStore) GetImageByName(name string) (*Image, error) {
	registry, err := is.LoadImageRegistry()
	if err != nil {
		return nil, err
	}

	if imageID, exists := registry.Indices.ByName[name]; exists {
		return is.GetImageByID(imageID)
	}

	return nil, fmt.Errorf("image not found: %s", name)
}

// GetImagesByMediaType returns all images of a specific media type
func (is *ImageStore) GetImagesByMediaType(mediaType media.MediaType) ([]*Image, error) {
	registry, err := is.LoadImageRegistry()
	if err != nil {
		return nil, err
	}

	var images []*Image
	for _, imageID := range registry.Indices.ByMediaType[mediaType] {
		if img, err := is.GetImageByID(imageID); err == nil {
			images = append(images, img)
		}
	}

	return images, nil
}

// GetImagesByFormat returns all images of a specific format
func (is *ImageStore) GetImagesByFormat(format string) ([]*Image, error) {
	registry, err := is.LoadImageRegistry()
	if err != nil {
		return nil, err
	}

	var images []*Image
	for _, imageID := range registry.Indices.ByFormat[format] {
		if img, err := is.GetImageByID(imageID); err == nil {
			images = append(images, img)
		}
	}

	return images, nil
}

// GetImagesByTags returns images that have specific tags
func (is *ImageStore) GetImagesByTags(tags []string, requireAll bool) ([]*Image, error) {
	registry, err := is.LoadImageRegistry()
	if err != nil {
		return nil, err
	}

	var images []*Image
	for _, img := range registry.Images {
		hasTag := false

		if requireAll {
			hasTag = true
			for _, tag := range tags {
				if !is.imageHasTag(img, tag) {
					hasTag = false
					break
				}
			}
		} else {
			for _, tag := range tags {
				if is.imageHasTag(img, tag) {
					hasTag = true
					break
				}
			}
		}

		if hasTag {
			imageCopy := img // Copy to avoid reference issues
			images = append(images, &imageCopy)
		}
	}

	return images, nil
}

// DeleteImages removes images from the registry
func (is *ImageStore) DeleteImages(imageIDs []string) error {
	registry, err := is.LoadImageRegistry()
	if err != nil {
		return err
	}

	// Filter out images to delete
	var newImages []Image
	deletedCount := 0

	for _, img := range registry.Images {
		shouldDelete := false
		for _, id := range imageIDs {
			if img.ID == id {
				shouldDelete = true
				break
			}
		}

		if !shouldDelete {
			newImages = append(newImages, img)
		} else {
			deletedCount++
		}
	}

	registry.Images = newImages
	is.rebuildIndices(registry)

	return is.SaveImageRegistry(registry)
}

// UpdateImageSelection updates selection status for images
func (is *ImageStore) UpdateImageSelection(imageIDs []string, isSelected, isChecked bool) error {
	for _, id := range imageIDs {
		err := is.UpdateImage(id, func(img *Image) {
			img.Selection.IsSelected = isSelected
			img.Selection.IsChecked = isChecked

			if isSelected {
				now := time.Now()
				img.Selection.SelectedAt = &now
			} else {
				img.Selection.SelectedAt = nil
			}
		})

		if err != nil {
			return fmt.Errorf("failed to update image %s: %w", id, err)
		}
	}

	return nil
}

// SearchImages performs a text search across images
func (is *ImageStore) SearchImages(query string) ([]*Image, error) {
	registry, err := is.LoadImageRegistry()
	if err != nil {
		return nil, err
	}

	var results []*Image
	query = strings.ToLower(query)

	for _, img := range registry.Images {
		// Search in name, tags, and description
		if strings.Contains(strings.ToLower(img.Name), query) ||
			strings.Contains(strings.ToLower(img.Path), query) ||
			is.imageHasAnyTagMatching(img, query) {
			imageCopy := img
			results = append(results, &imageCopy)
		}
	}

	return results, nil
}

// GetImageStatistics returns statistics about the image registry
func (is *ImageStore) GetImageStatistics() (*ImageStatistics, error) {
	registry, err := is.LoadImageRegistry()
	if err != nil {
		return nil, err
	}

	stats := &ImageStatistics{
		TotalImages:    len(registry.Images),
		MediaTypes:     map[media.MediaType]int{},
		Formats:        map[string]int{},
		Dimensions:     map[string]int{},
		SelectedImages: 0,
		CheckedImages:  0,
		LastImport:     nil,
		RegistrySize:   0,
	}

	for _, img := range registry.Images {
		// Count media types
		stats.MediaTypes[img.MediaType]++

		// Count formats
		stats.Formats[img.Metadata.Format]++

		// Count dimensions
		dimensionKey := fmt.Sprintf("%dx%d", img.Dimensions.Width, img.Dimensions.Height)
		stats.Dimensions[dimensionKey]++

		// Count selection status
		if img.Selection.IsSelected {
			stats.SelectedImages++
		}
		if img.Selection.IsChecked {
			stats.CheckedImages++
		}

		// Track last import
		if stats.LastImport == nil || img.ImportInfo.ImportedAt.After(*stats.LastImport) {
			stats.LastImport = &img.ImportInfo.ImportedAt
		}

		// Estimate registry size (rough calculation)
		stats.RegistrySize += len(img.Path) + len(img.Name) + len(img.ID)
	}

	return stats, nil
}

// Helper functions

// rebuildIndices rebuilds all indices from the images array
func (is *ImageStore) rebuildIndices(registry *ImageRegistry) {
	registry.Indices = ImageRegistryIndices{
		ByName:       map[string]string{},
		ByMediaType:  map[media.MediaType][]string{},
		ByFormat:     map[string][]string{},
		ByDimensions: map[string][]string{},
		ByTags:       map[string][]string{},
		BySelected:   map[string][]string{},
	}

	for _, img := range registry.Images {
		is.updateIndicesFromImage(registry, &img)
	}
}

// updateIndicesFromImage updates indices with a single image
func (is *ImageStore) updateIndicesFromImage(registry *ImageRegistry, image *Image) {
	// By name
	registry.Indices.ByName[image.Name] = image.ID

	// By media type
	registry.Indices.ByMediaType[image.MediaType] = append(registry.Indices.ByMediaType[image.MediaType], image.ID)

	// By format
	registry.Indices.ByFormat[image.Metadata.Format] = append(registry.Indices.ByFormat[image.Metadata.Format], image.ID)

	// By dimensions
	dimensionKey := fmt.Sprintf("%dx%d", image.Dimensions.Width, image.Dimensions.Height)
	registry.Indices.ByDimensions[dimensionKey] = append(registry.Indices.ByDimensions[dimensionKey], image.ID)

	// By tags
	for _, tag := range image.Metadata.Tags {
		registry.Indices.ByTags[tag] = append(registry.Indices.ByTags[tag], image.ID)
	}

	// By selection status
	if image.Selection.IsSelected {
		registry.Indices.BySelected["selected"] = append(registry.Indices.BySelected["selected"], image.ID)
	}
	if image.Selection.IsChecked {
		registry.Indices.BySelected["checked"] = append(registry.Indices.BySelected["checked"], image.ID)
	}
}

// calculateFileChecksum calculates SHA256 checksum of a file
func (is *ImageStore) calculateFileChecksum(filePath string) (string, error) {
	data, err := os.ReadFile(filePath)
	if err != nil {
		return "", err
	}

	hash := sha256.Sum256(data)
	return hex.EncodeToString(hash[:]), nil
}

// imageHasTag checks if an image has a specific tag
func (is *ImageStore) imageHasTag(image Image, tag string) bool {
	for _, imgTag := range image.Metadata.Tags {
		if strings.EqualFold(imgTag, tag) {
			return true
		}
	}
	return false
}

// imageHasAnyTagMatching checks if an image has any tag matching the query
func (is *ImageStore) imageHasAnyTagMatching(image Image, query string) bool {
	for _, tag := range image.Metadata.Tags {
		if strings.Contains(strings.ToLower(tag), query) {
			return true
		}
	}
	return false
}

// createMultiResolutionThumbnails creates thumbnails for all resolutions
func (is *ImageStore) createMultiResolutionThumbnails(inputPath, thumbnailsDir, fileName string) (ImageThumbnails, error) {
	// Note: Actual thumbnail creation is handled by the IPC handler
	// This method just sets up the expected paths for thumbnails that will be created
	// This avoids circular import issues between store and image packages
	
	baseName := strings.TrimSuffix(fileName, filepath.Ext(fileName))
	if !strings.Contains(baseName, ".") {
		// If no extension, extract just the base name
		parts := strings.Split(fileName, ".")
		if len(parts) > 0 {
			baseName = parts[0]
		}
	}
	
	thumbnailPaths := ImageThumbnails{
		Resolution720p:  fmt.Sprintf("%s/720p/%s.webp", thumbnailsDir, baseName),
		Resolution1080p: fmt.Sprintf("%s/1080p/%s.webp", thumbnailsDir, baseName),
		Resolution1440p: fmt.Sprintf("%s/1440p/%s.webp", thumbnailsDir, baseName),
		Resolution4k:    fmt.Sprintf("%s/4k/%s.webp", thumbnailsDir, baseName),
		Fallback:        fmt.Sprintf("%s/fallback/%s.webp", thumbnailsDir, baseName),
	}
	
	return thumbnailPaths, nil
}

// ImageStatistics contains statistics about the image registry
type ImageStatistics struct {
	TotalImages    int                     `json:"totalImages"`
	MediaTypes     map[media.MediaType]int `json:"mediaTypes"`
	Formats        map[string]int          `json:"formats"`
	Dimensions     map[string]int          `json:"dimensions"`
	SelectedImages int                     `json:"selectedImages"`
	CheckedImages  int                     `json:"checkedImages"`
	LastImport     *time.Time              `json:"lastImport,omitempty"`
	RegistrySize   int                     `json:"registrySize"`
}
