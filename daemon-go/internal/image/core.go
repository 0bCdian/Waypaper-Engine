package image

import (
	"bytes"
	"fmt"
	"image"
	_ "image/gif"
	_ "image/jpeg"
	_ "image/png"
	"io"
	"os"
	"path/filepath"
	"strings"

	"github.com/chai2010/webp"
	"github.com/disintegration/imaging"
	"golang.org/x/image/bmp"
	_ "golang.org/x/image/webp"
)

// Metadata holds information about an image.
type Metadata struct {
	Format      string
	Width       int
	Height      int
	Orientation int
}

// ThumbnailOptions holds parameters for creating thumbnails.
type ThumbnailOptions struct {
	Width   int
	Height  int
	Quality int
	Format  string
}

// ExtractMetadata reads an image from a byte slice and extracts its metadata.
func ExtractMetadata(data []byte) (*Metadata, error) {
	img, format, err := image.Decode(bytes.NewReader(data))
	if err != nil {
		// Try to decode as BMP separately, as it's not always registered.
		img, err = bmp.Decode(bytes.NewReader(data))
		if err != nil {
			return nil, fmt.Errorf("unsupported image format: %w", err)
		}
		format = "bmp"
	}

	bounds := img.Bounds()
	meta := &Metadata{
		Format: format,
		Width:  bounds.Dx(),
		Height: bounds.Dy(),
	}

	return meta, nil
}

// IsSupportedFormat checks if the given format is supported.
func IsSupportedFormat(format string) bool {
	switch format {
	case "jpeg", "png", "gif", "bmp", "webp":
		return true
	default:
		return false
	}
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

// CreateThumbnail creates a thumbnail from an image file.
// Caller provides both input and output paths.
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
		err = imaging.Encode(&buf, resizedImg, imaging.JPEG, imaging.JPEGQuality(opts.Quality))
	case "png":
		err = imaging.Encode(&buf, resizedImg, imaging.PNG)
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
// Caller provides all paths: input, cache destination, and thumbnail destination.
func CopyImageToCache(inputPath, cachePath, thumbnailPath string) (*Metadata, error) {
	// Ensure cache directory exists
	cacheDir := filepath.Dir(cachePath)
	if err := os.MkdirAll(cacheDir, 0755); err != nil {
		return nil, fmt.Errorf("failed to create cache directory: %w", err)
	}

	// Ensure thumbnails directory exists
	thumbnailDir := filepath.Dir(thumbnailPath)
	if err := os.MkdirAll(thumbnailDir, 0755); err != nil {
		return nil, fmt.Errorf("failed to create thumbnails directory: %w", err)
	}

	// Copy the original image to cache
	if err := copyFile(inputPath, cachePath); err != nil {
		return nil, fmt.Errorf("failed to copy image to cache: %w", err)
	}

	// Create thumbnail
	opts := DefaultThumbnailOptions()
	metadata, err := CreateThumbnail(inputPath, thumbnailPath, opts)
	if err != nil {
		// If thumbnail creation fails, still return the metadata
		// but log the error
		fmt.Printf("Warning: failed to create thumbnail for %s: %v\n", filepath.Base(cachePath), err)
		// Try to get metadata from the copied file
		data, readErr := os.ReadFile(cachePath)
		if readErr == nil {
			metadata, _ = ExtractMetadata(data)
		}
	}

	return metadata, nil
}

// DeleteImageFromCache deletes an image and its thumbnail from cache.
// Caller provides both the cache path and thumbnail path.
func DeleteImageFromCache(cachePath, thumbnailPath string) error {
	// Delete original image
	if err := os.Remove(cachePath); err != nil && !os.IsNotExist(err) {
		return fmt.Errorf("failed to delete image from cache: %w", err)
	}

	// Delete thumbnail
	if err := os.Remove(thumbnailPath); err != nil && !os.IsNotExist(err) {
		return fmt.Errorf("failed to delete thumbnail: %w", err)
	}

	return nil
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

// GetThumbnailName returns the thumbnail filename for a given image filename.
func GetThumbnailName(fileName string) string {
	return strings.TrimSuffix(fileName, filepath.Ext(fileName)) + ".webp"
}
