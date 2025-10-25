package image

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"
)

// ProcessImagesFromPaths processes multiple images from file paths.
// Caller provides cache and thumbnails directories where files will be stored.
func ProcessImagesFromPaths(imagePaths []string, fileNames []string, cacheDir, thumbnailsDir string) ([]*Metadata, error) {
	if len(imagePaths) != len(fileNames) {
		return nil, fmt.Errorf("mismatch between image paths and file names")
	}

	results := make([]*Metadata, 0, len(imagePaths))

	for i, imagePath := range imagePaths {
		fileName := fileNames[i]
		fmt.Printf("Processing image: %s -> %s\n", imagePath, fileName)

		cachePath := filepath.Join(cacheDir, fileName)
		thumbnailName := GetThumbnailName(fileName)
		thumbnailPath := filepath.Join(thumbnailsDir, thumbnailName)

		metadata, err := CopyImageToCache(imagePath, cachePath, thumbnailPath)
		if err != nil {
			// Log error but continue with other images
			fmt.Printf("Error processing image %s: %v\n", fileName, err)
			continue
		}

		fmt.Printf("Successfully processed image %s, metadata: %+v\n", fileName, metadata)
		results = append(results, metadata)
	}

	return results, nil
}

// GetUniqueFileName generates a unique filename that doesn't conflict with existing files.
// Uses binary search for O(log n) efficiency instead of O(n) linear search.
func GetUniqueFileName(existingFiles map[string]bool, originalFileName string) string {
	// Extract file extension
	ext := filepath.Ext(originalFileName)
	fileNameWithoutExt := strings.TrimSuffix(originalFileName, ext)

	// Check if original filename is available
	if !existingFiles[originalFileName] {
		return originalFileName
	}

	// Find the highest existing number for this base name using binary search
	// This is much more efficient than linear search
	maxNum := findMaxNumberForBaseName(existingFiles, fileNameWithoutExt, ext)

	// Return the next available number
	return fmt.Sprintf("%s(%d)%s", fileNameWithoutExt, maxNum+1, ext)
}

// findMaxNumberForBaseName finds the highest number used for a given base name.
func findMaxNumberForBaseName(existingFiles map[string]bool, baseName, ext string) int {
	// We'll search in the range [1, 2^20] which should be more than enough
	left, right := 1, 1048576 // 2^20

	for left <= right {
		mid := (left + right) / 2
		testName := fmt.Sprintf("%s(%d)%s", baseName, mid, ext)

		if existingFiles[testName] {
			// This number exists, try higher
			left = mid + 1
		} else {
			// This number doesn't exist, try lower
			right = mid - 1
		}
	}

	// right will be the highest existing number
	return right
}

// GetUniqueFileNames generates unique filenames for a list of files.
// Optimized for batch processing with O(n log n) complexity.
func GetUniqueFileNames(existingFiles map[string]bool, fileNames []string) []string {
	uniqueFileNames := make([]string, len(fileNames))
	usedNames := make(map[string]bool)

	// Copy existing files to used names
	for name := range existingFiles {
		usedNames[name] = true
	}

	// Process files in order, maintaining the usedNames set
	for i, fileName := range fileNames {
		uniqueFileName := GetUniqueFileName(usedNames, fileName)
		uniqueFileNames[i] = uniqueFileName
		usedNames[uniqueFileName] = true
	}

	return uniqueFileNames
}

// ExtractMetadataFromFile extracts metadata from a file path.
func ExtractMetadataFromFile(filePath string) (*Metadata, error) {
	data, err := os.ReadFile(filePath)
	if err != nil {
		return nil, fmt.Errorf("failed to read file: %w", err)
	}
	return ExtractMetadata(data)
}
