package image

import (
	"fmt"
	"path/filepath"
	"strings"
)

// ResolutionConfig defines thumbnail resolution configurations
type ResolutionConfig struct {
	Name   string
	Width  int
	Height int
	Quality int
}

// GetResolutionConfigs returns predefined resolution configurations
func GetResolutionConfigs() []ResolutionConfig {
	return []ResolutionConfig{
		{
			Name:    "720p",
			Width:   300,
			Height:  200,
			Quality: 60,
		},
		{
			Name:    "1080p", 
			Width:   400,
			Height:  300,
			Quality: 70,
		},
		{
			Name:    "1440p",
			Width:   500,
			Height:  400,
			Quality: 75,
		},
		{
			Name:    "4k",
			Width:   600,
			Height:  500,
			Quality: 80,
		},
		{
			Name:    "fallback",
			Width:   300,
			Height:  200,
			Quality: 60,
		},
	}
}

// CreateMultiResolutionThumbnails creates thumbnails for all resolutions
func CreateMultiResolutionThumbnails(inputPath, baseThumbnailsDir, fileName string) (map[string]string, error) {
	thumbnailPaths := make(map[string]string)
	configs := GetResolutionConfigs()
	
	// Extract base name without extension
	baseName := strings.TrimSuffix(fileName, filepath.Ext(fileName))
	
	for _, config := range configs {
		// Create resolution-specific directory
		resolutionDir := filepath.Join(baseThumbnailsDir, config.Name)
		
		// Create thumbnail filename
		thumbnailName := baseName + ".webp"
		thumbnailPath := filepath.Join(resolutionDir, thumbnailName)
		
		// Create thumbnail with resolution-specific options
		opts := ThumbnailOptions{
			Width:   config.Width,
			Height:  config.Height,
			Quality: config.Quality,
			Format:  "webp",
		}
		
		_, err := CreateThumbnail(inputPath, thumbnailPath, opts)
		if err != nil {
			return nil, fmt.Errorf("failed to create %s thumbnail: %w", config.Name, err)
		}
		
		thumbnailPaths[config.Name] = thumbnailPath
	}
	
	return thumbnailPaths, nil
}

// GetThumbnailPathForResolution returns the appropriate thumbnail path for a given resolution
func GetThumbnailPathForResolution(baseThumbnailsDir, fileName, resolution string) string {
	baseName := strings.TrimSuffix(fileName, filepath.Ext(fileName))
	thumbnailName := baseName + ".webp"
	return filepath.Join(baseThumbnailsDir, resolution, thumbnailName)
}

// GetAvailableResolutions returns all available resolution names
func GetAvailableResolutions() []string {
	configs := GetResolutionConfigs()
	resolutions := make([]string, len(configs))
	for i, config := range configs {
		resolutions[i] = config.Name
	}
	return resolutions
}
