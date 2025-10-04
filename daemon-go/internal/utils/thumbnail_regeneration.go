package utils

import (
	"fmt"
	"log/slog"
	"os"
	"path/filepath"
	"strings"

	"waypaper-engine/daemon-go/internal/config"
	"waypaper-engine/daemon-go/internal/image"
	"waypaper-engine/daemon-go/internal/store"
)

// RegenerateThumbnails regenerates thumbnails for all images in the JSON store
func RegenerateThumbnails(jsonPath, tomlPath string, logger *slog.Logger) error {
	logger.Info("Starting thumbnail regeneration", "json_path", jsonPath, "toml_path", tomlPath)

	// Load configuration
	configManager := config.NewConfigManager(tomlPath)
	cfg, err := configManager.GetConfig()
	if err != nil {
		return fmt.Errorf("failed to load configuration: %w", err)
	}

	// Initialize JSON store
	storeConfig := store.DefaultStoreConfig()
	storeConfig.BasePath = jsonPath
	jsonStore, err := store.NewStore(storeConfig, logger)
	if err != nil {
		return fmt.Errorf("failed to initialize JSON store: %w", err)
	}

	// Load image registry
	imageStore := store.NewImageStore(jsonStore)
	registry, err := imageStore.LoadImageRegistry()
	if err != nil {
		return fmt.Errorf("failed to load image registry: %w", err)
	}

	if registry == nil || len(registry.Images) == 0 {
		logger.Info("No images found in registry")
		return nil
	}

	logger.Info("Found images in registry", "count", len(registry.Images))

	// Ensure thumbnails directory exists
	if err := os.MkdirAll(cfg.Daemon.ThumbnailsDir, 0755); err != nil {
		return fmt.Errorf("failed to create thumbnails directory: %w", err)
	}

	// Regenerate thumbnails
	successCount := 0
	errorCount := 0

	for _, img := range registry.Images {
		// Check if image file exists
		if _, err := os.Stat(img.Path); os.IsNotExist(err) {
			logger.Warn("Image file not found, skipping", "image", img.Name, "path", img.Path)
			errorCount++
			continue
		}

		// Generate thumbnail path
		thumbnailName := strings.TrimSuffix(filepath.Base(img.Path), filepath.Ext(img.Path)) + ".webp"
		thumbnailPath := filepath.Join(cfg.Daemon.ThumbnailsDir, thumbnailName)

		// Skip if thumbnail already exists
		if _, err := os.Stat(thumbnailPath); err == nil {
			logger.Debug("Thumbnail already exists, skipping", "image", img.Name, "thumbnail", thumbnailPath)
			continue
		}

		// Create thumbnail
		opts := image.DefaultThumbnailOptions()
		_, err := image.CreateThumbnail(img.Path, thumbnailPath, opts)
		if err != nil {
			logger.Error("Failed to create thumbnail", "image", img.Name, "error", err)
			errorCount++
		} else {
			logger.Debug("Created thumbnail", "image", img.Name, "thumbnail", thumbnailPath)
			successCount++
		}
	}

	logger.Info("Thumbnail regeneration completed",
		"success_count", successCount,
		"error_count", errorCount,
		"total_images", len(registry.Images))

	return nil
}
