package image

import (
	"context"
	"fmt"
	"log/slog"
	"time"

	"waypaper-engine/daemon-go/internal/backend"
	"waypaper-engine/daemon-go/internal/config"
	"waypaper-engine/daemon-go/internal/events"
	"waypaper-engine/daemon-go/internal/monitor"
)

// ImageManager handles image processing and caching
type ImageManager struct {
	configManager  *config.ConfigManager
	backendManager backend.BackendManager
	logger         *slog.Logger
	cache          *CacheManager
	eventBus       *events.EventBus
}

// SetImageRequest represents a request to set an image
type SetImageRequest struct {
	ImageID   string
	ImagePath string
	Monitors  []monitor.Monitor
	Mode      string // "extend", "clone", "individual"
	Source    string // "manual" or "playlist"
}

// MultiMonitorResult represents the result of processing an image for multiple monitors
type MultiMonitorResult struct {
	MonitorImages map[string]string // monitor name -> processed image path
	CacheKey      string
	CachedAt      time.Time
}

// NewImageManager creates a new image manager
func NewImageManager(configManager *config.ConfigManager, backendManager backend.BackendManager, logger *slog.Logger, eventBus *events.EventBus) (*ImageManager, error) {
	cacheDir, err := configManager.GetCacheDir()
	if err != nil {
		return nil, fmt.Errorf("failed to get cache directory: %w", err)
	}

	cacheManager := NewCacheManager(cacheDir, 24*time.Hour) // 24 hour TTL

	return &ImageManager{
		configManager:  configManager,
		backendManager: backendManager,
		logger:         logger,
		cache:          cacheManager,
		eventBus:       eventBus,
	}, nil
}

// SetImage is the unified method for all image setting operations
func (im *ImageManager) SetImage(ctx context.Context, req *SetImageRequest) error {
	// 1. Process image for monitors (with caching)
	result, err := im.ProcessImageForMonitors(req.ImagePath, req.Monitors, req.Mode)
	if err != nil {
		return fmt.Errorf("failed to process image: %w", err)
	}

	// 2. Set wallpaper for each monitor
	for monitorName, imagePath := range result.MonitorImages {
		if err := im.backendManager.SetWallpaper(ctx, imagePath, monitorName); err != nil {
			im.logger.Error("failed to set wallpaper for monitor", "monitor", monitorName, "error", err)
			// Continue with other monitors even if one fails
		}
	}

	// 3. Emit EventImageSet
	if im.eventBus != nil {
		monitorNames := make([]string, 0, len(req.Monitors))
		for _, monitor := range req.Monitors {
			monitorNames = append(monitorNames, monitor.Name)
		}

		event := events.NewImageSetEvent(req.ImageID, req.ImagePath, monitorNames, req.Mode, req.Source)
		if err := im.eventBus.Publish(event); err != nil {
			im.logger.Error("failed to publish image set event", "error", err)
		}
	}

	return nil
}

// SetImageManually sets an image manually (separate from playlist logic)
func (im *ImageManager) SetImageManually(ctx context.Context, imageID, imagePath string, monitors []monitor.Monitor, mode string) error {
	req := &SetImageRequest{
		ImageID:   imageID,
		ImagePath: imagePath,
		Monitors:  monitors,
		Mode:      mode,
		Source:    "manual",
	}

	return im.SetImage(ctx, req)
}

// SetImageFromPlaylist sets an image from playlist logic
func (im *ImageManager) SetImageFromPlaylist(ctx context.Context, imageID, imagePath string, monitors []monitor.Monitor, mode string) error {
	req := &SetImageRequest{
		ImageID:   imageID,
		ImagePath: imagePath,
		Monitors:  monitors,
		Mode:      mode,
		Source:    "playlist",
	}

	return im.SetImage(ctx, req)
}
func (im *ImageManager) ProcessImageForMonitors(imagePath string, monitors []monitor.Monitor, mode string) (*MultiMonitorResult, error) {
	// Generate cache key
	cacheKey := GenerateCacheKey(imagePath, monitors, mode)

	// Check cache first
	if cached, exists := im.cache.GetCachedSplit(imagePath, monitors, mode); exists {
		im.logger.Debug("using cached image split", "cacheKey", cacheKey)
		return cached, nil
	}

	// Process image based on mode
	var result *MultiMonitorResult
	var err error

	switch mode {
	case "extend":
		result, err = im.splitImageForMonitors(imagePath, monitors)
	case "clone":
		result, err = im.duplicateImageForMonitors(imagePath, monitors)
	case "individual":
		if len(monitors) != 1 {
			return nil, fmt.Errorf("individual mode requires exactly one monitor, got %d", len(monitors))
		}
		result, err = im.processIndividualImage(imagePath, monitors[0])
	default:
		return nil, fmt.Errorf("unknown mode: %s", mode)
	}

	if err != nil {
		return nil, fmt.Errorf("failed to process image: %w", err)
	}

	// Cache the result
	result.CacheKey = cacheKey
	result.CachedAt = time.Now()
	im.cache.SaveCachedSplit(imagePath, monitors, mode, result)

	im.logger.Debug("processed and cached image", "cacheKey", cacheKey, "mode", mode)
	return result, nil
}

// splitImageForMonitors splits an image across multiple monitors.
// This is a wrapper around SplitImageForMonitors that handles cache directory retrieval.
// Use this method when working through the ImageManager interface.
func (im *ImageManager) splitImageForMonitors(imagePath string, monitors []monitor.Monitor) (*MultiMonitorResult, error) {
	cacheDir, err := im.configManager.GetCacheDir()
	if err != nil {
		return nil, fmt.Errorf("failed to get cache directory: %w", err)
	}

	return SplitImageForMonitors(imagePath, monitors, "extend", cacheDir)
}

// duplicateImageForMonitors duplicates an image across multiple monitors
func (im *ImageManager) duplicateImageForMonitors(imagePath string, monitors []monitor.Monitor) (*MultiMonitorResult, error) {
	result := &MultiMonitorResult{
		MonitorImages: make(map[string]string),
	}

	for _, monitor := range monitors {
		result.MonitorImages[monitor.Name] = imagePath
	}

	return result, nil
}

// processIndividualImage processes an image for a single monitor
func (im *ImageManager) processIndividualImage(imagePath string, monitor monitor.Monitor) (*MultiMonitorResult, error) {
	result := &MultiMonitorResult{
		MonitorImages: make(map[string]string),
	}

	result.MonitorImages[monitor.Name] = imagePath
	return result, nil
}

// GenerateMultiResolutionThumbnails generates thumbnails at multiple resolutions
func (im *ImageManager) GenerateMultiResolutionThumbnails(imagePath, cacheDir string) error {
	sizes := []int{150, 300, 600}
	_, err := im.cache.GenerateMultiResolutionThumbnails(imagePath, sizes)
	return err
}

// ClearExpiredCache clears expired cache entries
func (im *ImageManager) ClearExpiredCache() error {
	return im.cache.ClearExpiredCache()
}

// GetCachedSplit retrieves a cached split image result
func (im *ImageManager) GetCachedSplit(imagePath string, monitors []monitor.Monitor, mode string) (*MultiMonitorResult, bool) {
	return im.cache.GetCachedSplit(imagePath, monitors, mode)
}

// SetWallpaper sets wallpaper on a specific monitor (implements WallpaperSetter interface)
func (im *ImageManager) SetWallpaper(ctx context.Context, imagePath, monitorName string, config *backend.BackendConfig) error {
	return im.backendManager.SetWallpaper(ctx, imagePath, monitorName)
}

// SetWallpaperAll sets wallpaper on all monitors (implements WallpaperSetter interface)
func (im *ImageManager) SetWallpaperAll(ctx context.Context, imagePath string, config *backend.BackendConfig) error {
	return im.backendManager.SetWallpaperAll(ctx, imagePath)
}
