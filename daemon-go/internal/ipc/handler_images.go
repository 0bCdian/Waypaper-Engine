package ipc

import (
	"context"
	"errors"
	"fmt"
	"os"
	"path/filepath"

	"waypaper-engine/daemon-go/internal/events"
	"waypaper-engine/daemon-go/internal/image"
)

// Image handlers

func (h *Handler) handleGetImages(msg *Message) *Response {
	// JSON-only mode: Get images from JSON store only
	h.logger.Info("handleGetImages: starting to get images")

	// Try to get images from JSON store
	registry, err := h.jsonDBManager.LoadImageGallery()
	if err == nil && registry != nil && len(registry) > 0 {
		// Return JSON images directly - frontend should align with JSON store schema
		h.logger.Info("handleGetImages: returning images from JSON store", "count", len(registry))
		return &Response{Action: msg.Action, Data: registry}
	}
	h.logger.Info("handleGetImages: no images found in JSON store")
	return &Response{Action: msg.Action, Data: []any{}}
}

func (h *Handler) handleProcessImages(msg *Message) *Response {
	// Process images asynchronously to avoid blocking other IPC calls
	h.logger.Info("handleProcessImages called with batch processing", "imagePaths", msg.ImagePaths, "fileNames", msg.FileNames)

	if len(msg.ImagePaths) == 0 || len(msg.FileNames) == 0 {
		h.logger.Error("image paths or file names are empty", "imagePaths", msg.ImagePaths, "fileNames", msg.FileNames)
		return &Response{Action: msg.Action, Error: errors.New("image paths and file names are required").Error()}
	}

	// Start async processing in background goroutine
	go h.processImagesAsync(msg)

	// Return immediately - processing happens in background
	return &Response{
		Action: msg.Action,
		Data: map[string]any{
			"status":      "processing",
			"totalImages": len(msg.ImagePaths),
			"message":     "image processing started in background",
		},
	}
}

// processImagesAsync processes images in the background
func (h *Handler) processImagesAsync(msg *Message) {
	totalImages := len(msg.ImagePaths)

	h.logger.Info("starting async image processing", "totalImages", totalImages)

	// Emit processing started event
	if h.server != nil {
		h.server.BroadcastEvent(&events.Event{
			Type: events.EventProcessingStarted,
			Payload: map[string]any{
				"totalImages": totalImages,
			},
		})
	}

	// Get cache directory paths from configuration
	config, err := h.configManager.GetConfig()
	if err != nil {
		h.logger.Error("failed to get configuration for async processing", "error", err)
		if h.server != nil {
			h.server.BroadcastEvent(&events.Event{
				Type: events.EventProcessingComplete,
				Payload: map[string]any{
					"success":      false,
					"error":        "failed to get configuration",
					"totalRequested": totalImages,
					"totalProcessed": 0,
				},
			})
		}
		return
	}

	cacheDir := config.Daemon.ImagesDir
	thumbnailsDir := config.Daemon.ThumbnailsDir

	// Get existing files in the cache directory to avoid conflicts
	existingFiles := make(map[string]bool)
	if entries, err := os.ReadDir(cacheDir); err == nil {
		for _, entry := range entries {
			if !entry.IsDir() {
				existingFiles[entry.Name()] = true
			}
		}
	}

	// Generate unique filenames to avoid conflicts
	uniqueFileNames := image.GetUniqueFileNames(existingFiles, msg.FileNames)
	h.logger.Info("generated unique filenames", "original", msg.FileNames, "unique", uniqueFileNames)

	// Process images using simplified batch processing
	h.logger.Info("starting batch image processing", "totalImages", len(msg.ImagePaths))

	// Map unique filenames to their paths for processing
	var imagePaths []string
	var fileNames []string
	for i := range msg.ImagePaths {
		imagePaths = append(imagePaths, msg.ImagePaths[i])
		fileNames = append(fileNames, uniqueFileNames[i])
	}

	// Process images - copy to cache and create default thumbnails
	metadataList, err := image.ProcessImagesFromPaths(imagePaths, fileNames, cacheDir, thumbnailsDir)
	if err != nil {
		h.logger.Error("batch image processing failed", "error", err)
		if h.server != nil {
			h.server.BroadcastEvent(&events.Event{
				Type: events.EventImageError,
				Payload: map[string]any{
					"error":         err.Error(),
					"totalRequested": totalImages,
				},
			})
			h.server.BroadcastEvent(&events.Event{
				Type: events.EventProcessingComplete,
				Payload: map[string]any{
					"success":       false,
					"error":         err.Error(),
					"totalRequested": totalImages,
					"totalProcessed": 0,
				},
			})
		}
		return
	}

	// Collect thumbnail paths for each image
	allThumbnailPaths := make([]map[string]string, len(fileNames))

	// First, get default thumbnail paths from ProcessImagesFromPaths
	// (ProcessImagesFromPaths creates a default thumbnail via CopyImageToCache)
	for i, fileName := range fileNames {
		thumbnailMap := make(map[string]string)
		
		// Default thumbnail path (created by CopyImageToCache)
		defaultThumbnailName := image.GetThumbnailName(fileName)
		defaultThumbnailPath := filepath.Join(thumbnailsDir, defaultThumbnailName)
		// Check if default thumbnail exists, if so add it as fallback
		if _, err := os.Stat(defaultThumbnailPath); err == nil {
			thumbnailMap["fallback"] = defaultThumbnailPath
		}
		
		allThumbnailPaths[i] = thumbnailMap
	}

	// Create smart resolution thumbnails if monitor manager available
	if h.monitorManager != nil {
		monitors := h.monitorManager.GetMonitors()
		var monitorResolutions []image.MonitorResolution
		for _, monitor := range monitors {
			monitorResolutions = append(monitorResolutions, image.MonitorResolution{
				Width:  monitor.Width,
				Height: monitor.Height,
				Name:   monitor.Name,
			})
		}
		requiredResolutions := image.GetRequiredResolutions(monitorResolutions)
		h.logger.Debug("Creating smart resolution thumbnails", "resolutions", requiredResolutions)

		// Create smart thumbnails for each processed image and capture paths
		for i, fileName := range fileNames {
			imagePath := filepath.Join(cacheDir, fileName)
			smartThumbnails, err := image.CreateSmartMultiResolutionThumbnails(imagePath, thumbnailsDir, fileName, requiredResolutions)
			if err != nil {
				h.logger.Warn("failed to create smart thumbnails", "fileName", fileName, "error", err)
				// Continue with other images
			} else {
				// Merge smart thumbnails into the map
				for resolution, path := range smartThumbnails {
					allThumbnailPaths[i][resolution] = path
				}
			}
		}
	}

	// Add images to JSON gallery
	// Prepare data for AddProcessedImages
	var fullImagePaths []string
	var widths []int
	var heights []int
	var formats []string

	for i, metadata := range metadataList {
		fullImagePaths = append(fullImagePaths, filepath.Join(cacheDir, fileNames[i]))
		widths = append(widths, metadata.Width)
		heights = append(heights, metadata.Height)
		formats = append(formats, metadata.Format)
	}

	addedImages, err := h.jsonDBManager.AddProcessedImages(fileNames, fullImagePaths, widths, heights, formats, allThumbnailPaths)
	if err != nil {
		h.logger.Error("failed to add images to gallery", "error", err)
		if h.server != nil {
			h.server.BroadcastEvent(&events.Event{
				Type: events.EventImageError,
				Payload: map[string]any{
					"error":         fmt.Sprintf("images processed but failed to add to gallery: %v", err),
					"totalRequested": totalImages,
					"totalProcessed": len(metadataList),
				},
			})
			h.server.BroadcastEvent(&events.Event{
				Type: events.EventProcessingComplete,
				Payload: map[string]any{
					"success":       false,
					"error":         err.Error(),
					"totalRequested": totalImages,
					"totalProcessed": len(metadataList),
				},
			})
		}
		return
	}

	h.logger.Info("successfully added images to gallery", "count", len(addedImages))

	// Emit success events for processed images with IDs
	successCount := len(addedImages)
	for i, img := range addedImages {
		if h.server != nil {
			h.server.BroadcastEvent(&events.Event{
				Type: events.EventImageProcessed,
				Payload: map[string]any{
					"id":               img.ID,
					"originalFileName": msg.FileNames[i],
					"uniqueFileName":   fileNames[i],
					"width":            img.Dimensions.Width,
					"height":           img.Dimensions.Height,
					"format":           img.Metadata.Format,
				},
			})
		}

		h.logger.Info("successfully processed image",
			"id", img.ID,
			"originalFileName", msg.FileNames[i],
			"uniqueFileName", fileNames[i])
	}

	// Emit completion event
	if h.server != nil {
		h.server.BroadcastEvent(&events.Event{
			Type: events.EventProcessingComplete,
			Payload: map[string]any{
				"success":       true,
				"totalProcessed": successCount,
				"totalRequested": totalImages,
			},
		})

		// Emit images updated event if any images were processed
		if len(addedImages) > 0 {
			h.server.BroadcastEvent(&events.Event{
				Type: "images_updated",
				Payload: map[string]any{
					"totalAdded": len(addedImages),
				},
			})
		}
	}

	h.logger.Info("batch image processing completed",
		"totalProcessed", successCount,
		"totalRequested", totalImages)
}

func (h *Handler) handleDeleteImages(msg *Message) *Response {
	// Delete images from database and storage (merged from delete_images and delete_image_from_gallery)
	ctx := context.Background()
	imageIDs := msg.ImageIDs
	h.logger.Info("handleDeleteImages called", "imageIDs", imageIDs, "action", msg.Action)

	if len(imageIDs) == 0 {
		h.logger.Error("no image IDs provided for deletion")
		return &Response{Action: msg.Action, Error: errors.New("image IDs are required").Error()}
	}

	// Get image names before deleting from database
	var imageNames []string
	for _, id := range imageIDs {
		image, err := h.jsonDBManager.GetImageByID(ctx, id)
		if err != nil {
			h.logger.Warn("failed to get image name for deletion", "imageID", id, "error", err)
			continue
		}
		imageNames = append(imageNames, image.Name)
	}

	// Delete from JSON store
	for _, id := range imageIDs {
		err := h.jsonDBManager.DeleteImage(ctx, id)
		if err != nil {
			h.logger.Error("failed to delete image from JSON store", "imageID", id, "error", err)
			// Continue with other images even if one fails
		}
	}

	// Delete files from storage
	config, err := h.configManager.GetConfig()
	if err != nil {
		h.logger.Error("failed to get config for file deletion", "error", err)
		// Don't fail the whole operation if we can't get config
	} else {
		for _, fileName := range imageNames {
			cachePath := filepath.Join(config.Daemon.ImagesDir, fileName)
			thumbnailName := image.GetThumbnailName(fileName)
			thumbnailPath := filepath.Join(config.Daemon.ThumbnailsDir, thumbnailName)
			err := image.DeleteImageFromCache(cachePath, thumbnailPath)
			if err != nil {
				h.logger.Warn("failed to delete image file", "fileName", fileName, "error", err)
				// Continue with other files
			}
		}
	}

	// Emit images updated event
	if h.server != nil && len(imageIDs) > 0 {
		h.server.BroadcastEvent(&events.Event{
			Type: "images_updated",
			Payload: map[string]any{
				"totalDeleted": len(imageIDs),
			},
		})
	}

	return &Response{Action: msg.Action, Data: "images deleted"}
}

func (h *Handler) handleUpsertImage(msg *Message) *Response {
	ctx := context.Background()

	if msg.Image == nil || msg.Image.ID == 0 {
		return &Response{Action: msg.Action, Error: errors.New("image ID is required").Error()}
	}

	// Get existing image
	existingImage, err := h.jsonDBManager.GetImageByID(ctx, msg.Image.ID)
	if err != nil {
		return &Response{Action: msg.Action, Error: fmt.Errorf("image not found: %v", err).Error()}
	}

	// Update name if provided
	if msg.Image.Name != "" {
		existingImage.Name = msg.Image.Name
	}

	// Note: ImageInfo in the protocol only has ID and Name.
	// For tag/metadata updates, the protocol would need to be extended
	// to include those fields in ImageInfo or use a different message structure.
	// For now, we update what's available (name).

	// Save updated image back to gallery
	images, err := h.jsonDBManager.LoadImageGallery()
	if err != nil {
		return &Response{Action: msg.Action, Error: fmt.Errorf("failed to load image gallery: %v", err).Error()}
	}

	// Find and update the image
	found := false
	for i := range images {
		if images[i].ID == existingImage.ID {
			images[i] = *existingImage
			found = true
			break
		}
	}

	if !found {
		return &Response{Action: msg.Action, Error: "image not found in gallery"}
	}

	// Save updated gallery
	if err := h.jsonDBManager.SaveImageGallery(images); err != nil {
		return &Response{Action: msg.Action, Error: fmt.Errorf("failed to save image gallery: %v", err).Error()}
	}

	h.logger.Info("upsert image completed", "imageID", msg.Image.ID, "imageName", existingImage.Name)

	return &Response{Action: msg.Action, Data: "image updated"}
}

func (h *Handler) handleGetImageHistory(msg *Message) *Response {
	// Get the history limit from config
	config, err := h.configManager.GetConfig()
	if err != nil {
		h.logger.Error("failed to get config for image history", "error", err)
		return &Response{Action: msg.Action, Error: err.Error()}
	}

	historyLimit := config.App.ImageHistoryLimit
	if historyLimit <= 0 {
		historyLimit = 50 // Default fallback
	}

	// Get image history with the configured limit
	history, err := h.jsonDBManager.LoadImageHistory(historyLimit)
	if err != nil {
		h.logger.Error("failed to get image history", "error", err)
		return &Response{Action: msg.Action, Error: err.Error()}
	}

	return &Response{Action: msg.Action, Data: history}
}

