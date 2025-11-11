package image

import (
	"crypto/md5"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"time"

	"github.com/disintegration/imaging"
	"waypaper-engine/daemon-go/internal/monitor"
)

// CacheEntry represents a cached image entry
type CacheEntry struct {
	ImagePath     string            `json:"imagePath"`
	MonitorImages map[string]string `json:"monitorImages"`
	CachedAt      time.Time         `json:"cachedAt"`
	ExpiresAt     time.Time         `json:"expiresAt"`
}

// CacheManager manages image caching
type CacheManager struct {
	cacheDir string
	ttl      time.Duration
}

// NewCacheManager creates a new cache manager
func NewCacheManager(cacheDir string, ttl time.Duration) *CacheManager {
	return &CacheManager{
		cacheDir: cacheDir,
		ttl:      ttl,
	}
}

// GetCachedSplit retrieves cached split images if available and valid
func (cm *CacheManager) GetCachedSplit(imagePath string, monitors []monitor.Monitor, mode string) (*MultiMonitorResult, bool) {
	cacheKey := GenerateCacheKey(imagePath, monitors, mode)
	cachePath := filepath.Join(cm.cacheDir, cacheKey, "info.json")

	// Check if cache file exists
	if _, err := os.Stat(cachePath); os.IsNotExist(err) {
		return nil, false
	}

	// Read cache info
	data, err := os.ReadFile(cachePath)
	if err != nil {
		return nil, false
	}

	var cacheInfo CacheInfo
	if err := json.Unmarshal(data, &cacheInfo); err != nil {
		return nil, false
	}

	// Check if cache is expired
	if time.Now().After(cacheInfo.CachedAt.Add(cm.ttl)) {
		return nil, false
	}

	// Validate monitors match
	if !monitorsMatch(cacheInfo.Monitors, monitors) {
		return nil, false
	}

	// Validate all cached files exist
	for _, path := range cacheInfo.MonitorImages {
		if _, err := os.Stat(path); os.IsNotExist(err) {
			return nil, false
		}
	}

	return &MultiMonitorResult{
		MonitorImages: cacheInfo.MonitorImages,
		CacheKey:      cacheKey,
		CachedAt:      cacheInfo.CachedAt,
	}, true
}

// SaveCachedSplit saves split images to cache
func (cm *CacheManager) SaveCachedSplit(imagePath string, monitors []monitor.Monitor, mode string, result *MultiMonitorResult) error {
	cacheKey := result.CacheKey
	cacheDir := filepath.Join(cm.cacheDir, cacheKey)

	// Create cache directory
	if err := os.MkdirAll(cacheDir, 0755); err != nil {
		return err
	}

	// Save cache info
	cacheInfo := CacheInfo{
		ImagePath:     imagePath,
		Monitors:      monitors,
		MonitorImages: result.MonitorImages,
		CachedAt:      result.CachedAt,
	}

	infoPath := filepath.Join(cacheDir, "info.json")
	data, err := json.MarshalIndent(cacheInfo, "", "  ")
	if err != nil {
		return err
	}

	return os.WriteFile(infoPath, data, 0644)
}

// ClearExpiredCache removes expired cache entries
func (cm *CacheManager) ClearExpiredCache() error {
	entries, err := os.ReadDir(cm.cacheDir)
	if err != nil {
		return err
	}

	for _, entry := range entries {
		if !entry.IsDir() {
			continue
		}

		cachePath := filepath.Join(cm.cacheDir, entry.Name(), "info.json")
		if _, err := os.Stat(cachePath); os.IsNotExist(err) {
			continue
		}

		// Read cache info
		data, err := os.ReadFile(cachePath)
		if err != nil {
			continue
		}

		var cacheInfo CacheInfo
		if err := json.Unmarshal(data, &cacheInfo); err != nil {
			continue
		}

		// Check if expired
		if time.Now().After(cacheInfo.CachedAt.Add(cm.ttl)) {
			// Remove entire cache directory
			cacheDir := filepath.Join(cm.cacheDir, entry.Name())
			os.RemoveAll(cacheDir)
		}
	}

	return nil
}

// GenerateMultiResolutionThumbnails generates thumbnails at different resolutions
func (cm *CacheManager) GenerateMultiResolutionThumbnails(imagePath string, sizes []int) (map[int]string, error) {
	thumbnails := make(map[int]string)

	// Open source image
	img, err := imaging.Open(imagePath)
	if err != nil {
		return nil, fmt.Errorf("failed to open image: %w", err)
	}

	for _, size := range sizes {
		// Generate thumbnail path
		hash := fmt.Sprintf("%x", md5.Sum([]byte(imagePath)))
		thumbnailPath := filepath.Join(cm.cacheDir, "thumbnails", fmt.Sprintf("%s_%dx%d.jpg", hash, size, size))

		// Create directory if needed
		if err := os.MkdirAll(filepath.Dir(thumbnailPath), 0755); err != nil {
			return nil, fmt.Errorf("failed to create thumbnail directory: %w", err)
		}

		// Resize image to thumbnail size
		thumbnail := imaging.Resize(img, size, size, imaging.Lanczos)

		// Save thumbnail
		if err := imaging.Save(thumbnail, thumbnailPath, imaging.JPEGQuality(85)); err != nil {
			return nil, fmt.Errorf("failed to save thumbnail: %w", err)
		}

		thumbnails[size] = thumbnailPath
	}

	return thumbnails, nil
}

// GenerateCacheKey generates a unique cache key for the given parameters
func GenerateCacheKey(imagePath string, monitors []monitor.Monitor, mode string) string {
	// Create a hash of the image path, monitor configuration, and mode
	hash := md5.New()
	hash.Write([]byte(imagePath))
	hash.Write([]byte(mode))

	// Include monitor configuration in hash
	for _, monitor := range monitors {
		hash.Write([]byte(fmt.Sprintf("%s:%d:%d:%d:%d",
			monitor.Name, monitor.Width, monitor.Height,
			monitor.Position.X, monitor.Position.Y)))
	}

	return fmt.Sprintf("%x", hash.Sum(nil))
}
