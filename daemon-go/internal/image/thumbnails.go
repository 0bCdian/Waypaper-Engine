package image

import (
	"fmt"
	"path/filepath"
	"sort"
	"strings"
)

// ResolutionConfig defines thumbnail resolution configurations
type ResolutionConfig struct {
	Name    string
	Width   int
	Height  int
	Quality int
}

// MonitorResolution represents a monitor's resolution
type MonitorResolution struct {
	Width  int
	Height int
	Name   string
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

// CreateMultiResolutionThumbnails creates thumbnails for all resolutions.
// Caller provides the base thumbnails directory where resolution subdirectories will be created.
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

// GetThumbnailPathForResolution returns the appropriate thumbnail path for a given resolution.
// Caller provides the base thumbnails directory.
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

// GetRequiredResolutions determines which thumbnail resolutions to create based on connected monitors.
// This is a pure function - it only analyzes monitor specs and returns resolution names.
func GetRequiredResolutions(monitors []MonitorResolution) []string {
	if len(monitors) == 0 {
		// Default to 1080p if no monitors detected
		return []string{"1080p", "fallback"}
	}

	// Extract unique resolutions from monitors
	resolutionMap := make(map[string]bool)
	var resolutions []string

	for _, monitor := range monitors {
		resolution := determineResolutionFromDimensions(monitor.Width, monitor.Height)
		if resolution != "" && !resolutionMap[resolution] {
			resolutionMap[resolution] = true
			resolutions = append(resolutions, resolution)
		}
	}

	// Always include fallback
	if !resolutionMap["fallback"] {
		resolutions = append(resolutions, "fallback")
	}

	// Sort resolutions by priority (higher resolutions first)
	sort.Slice(resolutions, func(i, j int) bool {
		return getResolutionPriority(resolutions[i]) > getResolutionPriority(resolutions[j])
	})

	return resolutions
}

// determineResolutionFromDimensions maps monitor dimensions to resolution names
func determineResolutionFromDimensions(width, height int) string {
	// Common resolution mappings
	switch {
	case width >= 3840 && height >= 2160:
		return "4k"
	case width >= 2560 && height >= 1440:
		return "1440p"
	case width >= 1920 && height >= 1080:
		return "1080p"
	case width >= 1280 && height >= 720:
		return "720p"
	default:
		// For unusual resolutions, map to closest standard resolution
		if width >= 1920 || height >= 1080 {
			return "1080p"
		} else if width >= 1280 || height >= 720 {
			return "720p"
		} else {
			return "fallback"
		}
	}
}

// getResolutionPriority returns priority for sorting (higher = more important)
func getResolutionPriority(resolution string) int {
	switch resolution {
	case "4k":
		return 4
	case "1440p":
		return 3
	case "1080p":
		return 2
	case "720p":
		return 1
	case "fallback":
		return 0
	default:
		return -1
	}
}

// CreateSmartMultiResolutionThumbnails creates thumbnails only for required resolutions.
// Caller provides base thumbnails directory and the specific resolutions to create.
func CreateSmartMultiResolutionThumbnails(inputPath, baseThumbnailsDir, fileName string, requiredResolutions []string) (map[string]string, error) {
	thumbnailPaths := make(map[string]string)
	configs := GetResolutionConfigs()

	// Create a map of resolution configs for quick lookup
	configMap := make(map[string]ResolutionConfig)
	for _, config := range configs {
		configMap[config.Name] = config
	}

	// Extract base name without extension
	baseName := strings.TrimSuffix(fileName, filepath.Ext(fileName))

	for _, resolution := range requiredResolutions {
		config, exists := configMap[resolution]
		if !exists {
			continue // Skip unknown resolutions
		}

		// Create resolution-specific directory
		resolutionDir := filepath.Join(baseThumbnailsDir, resolution)

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
			return nil, fmt.Errorf("failed to create %s thumbnail: %w", resolution, err)
		}

		thumbnailPaths[resolution] = thumbnailPath
	}

	return thumbnailPaths, nil
}
