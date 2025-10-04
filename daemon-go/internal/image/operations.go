package image

import (
	"bytes"
	"fmt"
	"image"
	"image/jpeg"
	"image/png"
	"io"
	"os"
	"path/filepath"
	"strings"

	"github.com/chai2010/webp"
	"github.com/disintegration/imaging"
)

// ThumbnailOptions holds parameters for creating thumbnails.
type ThumbnailOptions struct {
	Width   int
	Height  int
	Quality int
	Format  string
}

// DefaultThumbnailOptions returns default thumbnail options matching Sharp behavior.
func DefaultThumbnailOptions() ThumbnailOptions {
	return ThumbnailOptions{
		Width:   300,
		Height:  200,
		Quality: 60,
		Format:  "webp",
	}
}

// CreateThumbnail creates a thumbnail from an image file, matching Sharp's behavior.
func CreateThumbnail(inputPath, outputPath string, opts ThumbnailOptions) (*Metadata, error) {
	// Read the input image
	data, err := os.ReadFile(inputPath)
	if err != nil {
		return nil, fmt.Errorf("failed to read input file: %w", err)
	}

	// Extract metadata first
	metadata, err := ExtractMetadata(data)
	if err != nil {
		return nil, fmt.Errorf("failed to extract metadata: %w", err)
	}

	// Decode the image
	img, _, err := image.Decode(bytes.NewReader(data))
	if err != nil {
		return nil, fmt.Errorf("failed to decode image: %w", err)
	}

	// Resize with "cover" fit (crop to fill the dimensions)
	resizedImg := imaging.Fill(img, opts.Width, opts.Height, imaging.Center, imaging.Lanczos)

	// Create output directory if it doesn't exist
	outputDir := filepath.Dir(outputPath)
	if err := os.MkdirAll(outputDir, 0755); err != nil {
		return nil, fmt.Errorf("failed to create output directory: %w", err)
	}

	// Encode and save the thumbnail
	var buf bytes.Buffer
	switch opts.Format {
	case "webp":
		err = webp.Encode(&buf, resizedImg, &webp.Options{Quality: float32(opts.Quality)})
	case "jpeg":
		err = jpeg.Encode(&buf, resizedImg, &jpeg.Options{Quality: opts.Quality})
	case "png":
		err = png.Encode(&buf, resizedImg)
	default:
		return nil, fmt.Errorf("unsupported thumbnail format: %s", opts.Format)
	}

	if err != nil {
		return nil, fmt.Errorf("failed to encode thumbnail: %w", err)
	}

	// Write the thumbnail to file
	if err := os.WriteFile(outputPath, buf.Bytes(), 0644); err != nil {
		return nil, fmt.Errorf("failed to write thumbnail: %w", err)
	}

	return metadata, nil
}

// CopyImageToCache copies an image file to the cache directory and creates a thumbnail.
func CopyImageToCache(inputPath, cacheDir, thumbnailsDir, fileName string) (*Metadata, error) {
	// Ensure cache directory exists
	if err := os.MkdirAll(cacheDir, 0755); err != nil {
		return nil, fmt.Errorf("failed to create cache directory: %w", err)
	}

	// Ensure thumbnails directory exists
	if err := os.MkdirAll(thumbnailsDir, 0755); err != nil {
		return nil, fmt.Errorf("failed to create thumbnails directory: %w", err)
	}

	// Copy the original image to cache
	cachePath := filepath.Join(cacheDir, fileName)
	if err := copyFile(inputPath, cachePath); err != nil {
		return nil, fmt.Errorf("failed to copy image to cache: %w", err)
	}

	// Create thumbnail
	thumbnailName := strings.TrimSuffix(fileName, filepath.Ext(fileName)) + ".webp"
	thumbnailPath := filepath.Join(thumbnailsDir, thumbnailName)

	opts := DefaultThumbnailOptions()
	metadata, err := CreateThumbnail(inputPath, thumbnailPath, opts)
	if err != nil {
		// If thumbnail creation fails, still return the metadata
		// but log the error
		fmt.Printf("Warning: failed to create thumbnail for %s: %v\n", fileName, err)
		// Try to get metadata from the copied file
		data, readErr := os.ReadFile(cachePath)
		if readErr == nil {
			metadata, _ = ExtractMetadata(data)
		}
	}

	return metadata, nil
}

// copyFile copies a file from src to dst.
func copyFile(src, dst string) error {
	sourceFile, err := os.Open(src)
	if err != nil {
		return err
	}
	defer sourceFile.Close()

	destFile, err := os.Create(dst)
	if err != nil {
		return err
	}
	defer destFile.Close()

	_, err = io.Copy(destFile, sourceFile)
	return err
}

// ProcessImagesFromPaths processes multiple images from file paths.
func ProcessImagesFromPaths(imagePaths []string, fileNames []string, cacheDir, thumbnailsDir string) ([]*Metadata, error) {
	if len(imagePaths) != len(fileNames) {
		return nil, fmt.Errorf("mismatch between image paths and file names")
	}

	results := make([]*Metadata, 0, len(imagePaths))

	for i, imagePath := range imagePaths {
		fileName := fileNames[i]
		fmt.Printf("Processing image: %s -> %s\n", imagePath, fileName)
		fmt.Printf("Cache dir: %s, Thumbnails dir: %s\n", cacheDir, thumbnailsDir)
		metadata, err := CopyImageToCache(imagePath, cacheDir, thumbnailsDir, fileName)
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

// DeleteImageFromCache deletes an image and its thumbnail from cache.
func DeleteImageFromCache(fileName, cacheDir, thumbnailsDir string) error {
	// Delete original image
	cachePath := filepath.Join(cacheDir, fileName)
	if err := os.Remove(cachePath); err != nil && !os.IsNotExist(err) {
		return fmt.Errorf("failed to delete image from cache: %w", err)
	}

	// Delete thumbnail
	thumbnailName := strings.TrimSuffix(fileName, filepath.Ext(fileName)) + ".webp"
	thumbnailPath := filepath.Join(thumbnailsDir, thumbnailName)
	if err := os.Remove(thumbnailPath); err != nil && !os.IsNotExist(err) {
		return fmt.Errorf("failed to delete thumbnail: %w", err)
	}

	return nil
}

// GetUniqueFileName generates a unique filename that doesn't conflict with existing files
// Uses binary search for O(log n) efficiency instead of O(n) linear search
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

// findMaxNumberForBaseName finds the highest number used for a given base name
// Uses binary search for O(log n) efficiency
func findMaxNumberForBaseName(existingFiles map[string]bool, baseName, ext string) int {
	// Binary search for the highest existing number
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

// GetUniqueFileNames generates unique filenames for a list of files
// Optimized for batch processing with O(n log n) complexity
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
