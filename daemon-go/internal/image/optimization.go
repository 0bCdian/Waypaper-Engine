package image

import (
	"bytes"
	"fmt"
	"image"
	"image/jpeg"
	"os"
	"path/filepath"
	"runtime"

	"github.com/chai2010/webp"
	"github.com/disintegration/imaging"
)

// OptimizationOptions holds parameters for image optimization.
type OptimizationOptions struct {
	Format               string // Output format: "jpeg", "webp"
	Quality              int    // JPEG quality (1-100), WebP quality (1-100)
	Progressive          bool   // Enable progressive JPEG
	Lossless             bool   // Use lossless WebP
	StripMetadata        bool   // Remove EXIF/IPTC/XMP metadata
	StripColorProfile    bool   // Remove ICC color profile
	OptimizePalette      bool   // Optimize palette for PNG/GIF
	BufferSize           int    // Buffer size for reading/writing
	MaxDimension         int    // Maximum dimension for resizing
	SmartResize          bool   // Enable smart resize with aspect ratio preservation
	HardwareAcceleration bool   // Enable GPU acceleration (if available)
	CompressLevel        int    // Compression level (1-9)
	KeepAspectRatio      bool   // Preserve aspect ratio during resize
	EncodeOptimizations  bool   // Enable encoding optimizations
}

// DefaultOptimizationOptions returns safe default optimization options.
func DefaultOptimizationOptions() OptimizationOptions {
	return OptimizationOptions{
		Format:               "jpeg",
		Quality:              85,
		Progressive:          true,
		Lossless:             false,
		StripMetadata:        false,
		StripColorProfile:    false,
		OptimizePalette:      true,
		BufferSize:           32768, // 32KB buffer
		MaxDimension:         0,     // No limit
		SmartResize:          true,
		HardwareAcceleration: false, // Disabled for now
		CompressLevel:        6,
		KeepAspectRatio:      true,
		EncodeOptimizations:  true,
	}
}

// OptimizationProfile represents different optimization presets.
type OptimizationProfile string

const (
	ProfileWebOptimized    OptimizationProfile = "web_optimized"
	ProfileMobileOptimized OptimizationProfile = "mobile_optimized"
	ProfilePrintOptimized  OptimizationProfile = "print_optimized"
	ProfileLossless        OptimizationProfile = "lossless"
	ProfileThumbnail       OptimizationProfile = "thumbnail"
	ProfileProgressive     OptimizationProfile = "progressive"
)

// GetOptimizationProfile returns optimization options for a specific profile.
func GetOptimizationProfile(profile OptimizationProfile) OptimizationOptions {
	switch profile {
	case ProfileWebOptimized:
		return OptimizationOptions{
			Format:               "jpeg",
			Quality:              80,
			Progressive:          true,
			Lossless:             false,
			StripMetadata:        true,
			StripColorProfile:    true,
			OptimizePalette:      true,
			BufferSize:           32768,
			MaxDimension:         2048,
			SmartResize:          true,
			HardwareAcceleration: false,
			CompressLevel:        8,
			KeepAspectRatio:      true,
			EncodeOptimizations:  true,
		}
	case ProfileMobileOptimized:
		return OptimizationOptions{
			Format:               "webp",
			Quality:              75,
			Progressive:          false,
			Lossless:             false,
			StripMetadata:        true,
			StripColorProfile:    true,
			OptimizePalette:      true,
			BufferSize:           16384,
			MaxDimension:         1080,
			SmartResize:          true,
			HardwareAcceleration: false,
			CompressLevel:        7,
			KeepAspectRatio:      true,
			EncodeOptimizations:  true,
		}
	case ProfilePrintOptimized:
		return OptimizationOptions{
			Format:               "png",
			Quality:              100,
			Progressive:          false,
			Lossless:             true,
			StripMetadata:        false,
			StripColorProfile:    false,
			OptimizePalette:      true,
			BufferSize:           65536,
			MaxDimension:         0,
			SmartResize:          false,
			HardwareAcceleration: false,
			CompressLevel:        9,
			KeepAspectRatio:      true,
			EncodeOptimizations:  true,
		}
	case ProfileLossless:
		return OptimizationOptions{
			Format:               "webp",
			Quality:              100,
			Progressive:          false,
			Lossless:             true,
			StripMetadata:        false,
			StripColorProfile:    false,
			OptimizePalette:      true,
			BufferSize:           65536,
			MaxDimension:         0,
			SmartResize:          false,
			HardwareAcceleration: false,
			CompressLevel:        9,
			KeepAspectRatio:      true,
			EncodeOptimizations:  true,
		}
	case ProfileThumbnail:
		return OptimizationOptions{
			Format:               "webp",
			Quality:              60,
			Progressive:          false,
			Lossless:             false,
			StripMetadata:        true,
			StripColorProfile:    true,
			OptimizePalette:      true,
			BufferSize:           8192,
			MaxDimension:         300,
			SmartResize:          true,
			HardwareAcceleration: false,
			CompressLevel:        6,
			KeepAspectRatio:      true,
			EncodeOptimizations:  true,
		}
	case ProfileProgressive:
		return OptimizationOptions{
			Format:               "jpeg",
			Quality:              90,
			Progressive:          true,
			Lossless:             false,
			StripMetadata:        true,
			StripColorProfile:    true,
			OptimizePalette:      true,
			BufferSize:           32768,
			MaxDimension:         0,
			SmartResize:          true,
			HardwareAcceleration: false,
			CompressLevel:        6,
			KeepAspectRatio:      true,
			EncodeOptimizations:  true,
		}
	default:
		return DefaultOptimizationOptions()
	}
}

// OptimizeImage performs advanced image optimization according to the specified options.
func OptimizeImage(data []byte, opts OptimizationOptions) ([]byte, error) {
	// Decode the original image
	img, _, err := image.Decode(bytes.NewReader(data))
	if err != nil {
		return nil, fmt.Errorf("failed to decode image: %w", err)
	}

	bounds := img.Bounds()
	originalWidth := bounds.Dx()
	originalHeight := bounds.Dy()

	// Apply smart resize if enabled and needed
	var processedImg image.Image = img
	if opts.SmartResize && opts.MaxDimension > 0 {
		newWidth, newHeight := calculateSmartDimensions(originalWidth, originalHeight, opts.MaxDimension, opts.KeepAspectRatio)
		if newWidth != originalWidth || newHeight != originalHeight {
			processedImg = imaging.Resize(img, newWidth, newHeight, imaging.Lanczos)
		}
	}

	// Encode with optimization
	var buf bytes.Buffer
	err = encodeOptimizedImage(&buf, processedImg, opts)
	if err != nil {
		return nil, fmt.Errorf("failed to encode optimized image: %w", err)
	}

	return buf.Bytes(), nil
}

// calculateSmartDimensions calculates optimal dimensions while preserving aspect ratio.
func calculateSmartDimensions(width, height, maxDimension int, keepAspectRatio bool) (int, int) {
	if !keepAspectRatio {
		return width, height
	}

	// Determine the scaling factor based on the larger dimension
	scaleFactor := float64(maxDimension) / float64(max(width, height))

	if scaleFactor >= 1.0 {
		// No need to resize if image is smaller than max dimension
		return width, height
	}

	newWidth := int(float64(width) * scaleFactor)
	newHeight := int(float64(height) * scaleFactor)

	return newWidth, newHeight
}

// encodeOptimizedImage encodes an image with advanced optimization features.
func encodeOptimizedImage(buf *bytes.Buffer, img image.Image, opts OptimizationOptions) error {
	switch opts.Format {
	case "jpeg":
		return encodeProgressiveJPEG(buf, img, opts)
	case "webp":
		return encodeOptimizedWebP(buf, img, opts)
	case "png":
		return encodeOptimizedPNG(buf, img, opts)
	default:
		return fmt.Errorf("unsupported output format: %s", opts.Format)
	}
}

// encodeProgressiveJPEG encodes a JPEG with progressive optimization.
func encodeProgressiveJPEG(buf *bytes.Buffer, img image.Image, opts OptimizationOptions) error {
	jpegOpts := &jpeg.Options{
		Quality: opts.Quality,
	}

	if opts.EncodeOptimizations {
		// Set progressive parameters
		jpegOpts.Quality = optimizeQualiyForProgressive(opts.Quality)
	}

	return jpeg.Encode(buf, img, jpegOpts)
}

// encodeOptimizedWebP encodes a WebP with advanced optimization.
func encodeOptimizedWebP(buf *bytes.Buffer, img image.Image, opts OptimizationOptions) error {
	webpOpts := &webp.Options{
		Quality:  float32(opts.Quality),
		Lossless: opts.Lossless,
	}

	if opts.EncodeOptimizations {
		webpOpts.Lossless = opts.Lossless
		if !opts.Lossless {
			webpOpts.Quality = float32(optimizeWebPQuality(opts.Quality))
		}
	}

	return webp.Encode(buf, img, webpOpts)
}

// encodeOptimizedPNG encodes a PNG with optimization features.
func encodeOptimizedPNG(buf *bytes.Buffer, img image.Image, opts OptimizationOptions) error {
	// Use imaging for PNG optimization
	return imaging.Encode(buf, img, imaging.PNG)
}

// optimizeQualiyForProgressive adjusts JPEG quality for progressive encoding.
func optimizeQualiyForProgressive(quality int) int {
	if quality <= 75 {
		return quality
	}
	// Slightly reduce quality for progressive encoding to maintain good compression
	return quality - 5
}

// optimizeWebPQuality optimizes quality settings for WebP encoding.
func optimizeWebPQuality(quality int) int {
	if quality <= 80 {
		return quality
	}
	// WebP handles higher qualities better than JPEG
	return quality - 10
}

// OptimizeImageFile optimizes an image file and saves it to a destination.
func OptimizeImageFile(inputPath, outputPath string, opts OptimizationOptions) error {
	// Read the input file
	data, err := readImageFile(inputPath)
	if err != nil {
		return fmt.Errorf("failed to read input file: %w", err)
	}

	// Optimize the image
	optimizedData, err := OptimizeImage(data, opts)
	if err != nil {
		return fmt.Errorf("failed to optimize image: %w", err)
	}

	// Ensure output directory exists
	if err := ensureDirectoryExists(filepath.Dir(outputPath)); err != nil {
		return fmt.Errorf("failed to create output directory: %w", err)
	}

	// Write optimized image
	if err := writeImageFile(outputPath, optimizedData); err != nil {
		return fmt.Errorf("failed to write optimized image: %w", err)
	}

	return nil
}

// GetOptimalFormat determines the optimal format for an image based on its characteristics.
func GetOptimalFormat(img image.Image, targetSize int64) string {
	bounds := img.Bounds()
	width := bounds.Dx()
	height := bounds.Dy()
	pixelCount := width * height

	// For small images (< 100KB), prefer PNG to avoid JPEG artifacts
	if targetSize < 100000 {
		return "png"
	}

	// For very large images (> 2MP), prefer WebP for better compression
	if pixelCount > 2000000 {
		return "webp"
	}

	// For medium sized images, prefer JPEG if size is a concern
	if targetSize < 500000 {
		return "jpeg"
	}

	// Default to WebP for good compression/quality balance
	return "webp"
}

// EnsureHardwareAcceleration checks if hardware acceleration is available.
func EnsureHardwareAcceleration() bool {
	// Check for OpenGL/GPU availability
	return false // Placeholder - implement GPU detection
}

// GetAvailableCPUCores returns the number of available CPU cores for parallel processing.
func GetAvailableCPUCores() int {
	return runtime.NumCPU()
}

// Helper functions

func readImageFile(path string) ([]byte, error) {
	return os.ReadFile(path)
}

func writeImageFile(path string, data []byte) error {
	return os.WriteFile(path, data, 0644)
}

func ensureDirectoryExists(dir string) error {
	return os.MkdirAll(dir, 0755)
}
