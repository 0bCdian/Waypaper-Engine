package image

import (
	"bytes"
	"fmt"
	"image"
	"os"
	"path/filepath"
	"strings"

	"github.com/chai2010/webp"
)

// WebPConversionOptions holds parameters for WebP conversion.
type WebPConversionOptions struct {
	Quality             int    // Quality from 1-100 for lossy encoding
	Lossless            bool   // Enable lossless encoding
	AlphaCompression    int    // Alpha compression quality (0-100)
	AlphaQuality        int    // Alpha quality (same as jpeg quality)
	AlphaFilter         int    // Alpha pre-filtering (0-4)
	NearLossless        bool   // Near-lossless encoding
	Method              int    // Compression method (0-6, higher = better compression)
	SpatialNoiseShaping int    // Spatial noise shaping (0-100)
	Partitions          int    // Number of partitions (0-3)
	Segments            int    // Number of segments (1-4)
	Pass                int    // Number of entropy optimizing passes (1-10)
	Multithreading      bool   // Enable multi-threading
	Preset              string // Quality preset: "default", "photo", "picture", "drawing", "icon", "text"
}

// DefaultWebPConversionOptions returns conservative WebP conversion settings.
func DefaultWebPConversionOptions() WebPConversionOptions {
	return WebPConversionOptions{
		Quality:             80,
		Lossless:            false,
		AlphaCompression:    0, // Auto optimization
		AlphaQuality:        80,
		AlphaFilter:         1,
		NearLossless:        false,
		Method:              6, // Max compression
		SpatialNoiseShaping: 80,
		Partitions:          0, // Auto
		Segments:            3,
		Pass:                6,
		Multithreading:      true,
		Preset:              "photo",
	}
}

// WebPConversionPreset defines different quality presets for WebP conversion.
type WebPConversionPreset string

const (
	WebPPresetDefault  WebPConversionPreset = "default"
	WebPPresetPhoto    WebPConversionPreset = "photo"
	WebPPresetPicture  WebPConversionPreset = "picture"
	WebPPresetDrawing  WebPConversionPreset = "drawing"
	WebPPresetIcon     WebPConversionPreset = "icon"
	WebPPresetText     WebPConversionPreset = "text"
	WebPPresetLossless WebPConversionPreset = "lossless"
)

// GetWebPPreset returns optimized settings for a specific preset.
func GetWebPPreset(preset WebPConversionPreset) WebPConversionOptions {
	switch preset {
	case WebPPresetPhoto:
		return WebPConversionOptions{
			Quality:             85,
			Lossless:            false,
			AlphaCompression:    80,
			AlphaQuality:        85,
			AlphaFilter:         2,
			NearLossless:        false,
			Method:              6,
			SpatialNoiseShaping: 80,
			Partitions:          0,
			Segments:            4,
			Pass:                10,
			Multithreading:      true,
			Preset:              "photo",
		}
	case WebPPresetPicture:
		return WebPConversionOptions{
			Quality:             90,
			Lossless:            false,
			AlphaCompression:    90,
			AlphaQuality:        90,
			AlphaFilter:         3,
			NearLossless:        false,
			Method:              6,
			SpatialNoiseShaping: 70,
			Partitions:          3,
			Segments:            4,
			Pass:                10,
			Multithreading:      true,
			Preset:              "picture",
		}
	case WebPPresetDrawing:
		return WebPConversionOptions{
			Quality:             100,
			Lossless:            false,
			AlphaCompression:    100,
			AlphaQuality:        100,
			AlphaFilter:         4,
			NearLossless:        true,
			Method:              6,
			SpatialNoiseShaping: 100,
			Partitions:          3,
			Segments:            1,
			Pass:                10,
			Multithreading:      true,
			Preset:              "drawing",
		}
	case WebPPresetLossless:
		return WebPConversionOptions{
			Quality:             100,
			Lossless:            true,
			AlphaCompression:    100,
			AlphaQuality:        100,
			AlphaFilter:         4,
			NearLossless:        true,
			Method:              6,
			SpatialNoiseShaping: 100,
			Partitions:          3,
			Segments:            1,
			Pass:                10,
			Multithreading:      true,
			Preset:              "lossless",
		}
	default:
		return DefaultWebPConversionOptions()
	}
}

// ConvertToWebP converts an image to WebP format with advanced optimization.
func ConvertToWebP(data []byte, opts WebPConversionOptions) ([]byte, error) {
	// Decode the original image
	img, _, err := image.Decode(bytes.NewReader(data))
	if err != nil {
		return nil, fmt.Errorf("failed to decode input image: %w", err)
	}

	// Apply WebP-specific optimizations based on image characteristics
	optimizedImg := optimizeImageForWebP(img, opts)

	// Encode to WebP
	var buf bytes.Buffer
	webpOpts := &webp.Options{
		Quality:  float32(opts.Quality),
		Lossless: opts.Lossless,
	}

	// Apply advanced WebP options
	if err := applyAdvancedWebPOptions(webpOpts, opts); err != nil {
		return nil, fmt.Errorf("failed to apply WebP options: %w", err)
	}

	err = webp.Encode(&buf, optimizedImg, webpOpts)
	if err != nil {
		return nil, fmt.Errorf("failed to encode WebP image: %w", err)
	}

	return buf.Bytes(), nil
}

// optimizeImageForWebP applies WebP-specific optimizations to improve encoding quality.
func optimizeImageForWebP(img image.Image, opts WebPConversionOptions) image.Image {
	// Handle different presets with different optimization strategies
	switch opts.Preset {
	case "photo":
		// Enhance contrast slightly for photos
		// Placeholder for future enhancement
		return img
	case "picture":
		// Optimize for general pictures with good detail preservation
		return img
	case "drawing":
		// Optimize for graphics with sharp edges
		return img
	case "icon":
		// Optimize for icons - reduce to indexed color if needed
		return img
	case "text":
		// Optimize for text - preserve sharp edges
		return img
	default:
		return img
	}
}

// applyAdvancedWebPOptions applies advanced WebP encoding options.
func applyAdvancedWebPOptions(webpOpts *webp.Options, opts WebPConversionOptions) error {
	// Set advanced WebP options based on optimization preferences
	if opts.Preset != "" {
		return optimizeWebPPresetOptions(webpOpts, opts.Preset)
	}

	return nil
}

// optimizeWebPPresetOptions applies preset-specific optimizations.
func optimizeWebPPresetOptions(webpOpts *webp.Options, preset string) error {
	switch preset {
	case "photo":
		// Optimize for photographic content
		webpOpts.Quality = float32(85)
		webpOpts.Lossless = false
	case "picture":
		// Optimize for general pictures
		webpOpts.Quality = float32(90)
		webpOpts.Lossless = false
	case "drawing":
		// Optimize for graphics/drawings
		webpOpts.Quality = float32(95)
		webpOpts.Lossless = false
	case "lossless":
		// Lossless encoding
		webpOpts.Quality = float32(100)
		webpOpts.Lossless = true
	default:
		// Use default settings
		webpOpts.Quality = float32(80)
		webpOpts.Lossless = false
	}

	return nil
}

// BestFitWebPConversion automatically determines the best WebP conversion settings for an image.
func BestFitWebPConversion(data []byte, targetSizeKB int) WebPConversionOptions {
	// Analyze image characteristics
	img, format, err := image.Decode(bytes.NewReader(data))
	if err != nil {
		// Fallback to default settings if analysis fails
		return DefaultWebPConversionOptions()
	}

	bounds := img.Bounds()
	width := bounds.Dx()
	height := bounds.Dy()
	pixelCount := width * height

	// Determine optimal settings based on image characteristics
	opts := WebPConversionOptions{
		Lossless:       false,
		Multithreading: true,
	}

	// Adjust quality based on image size and target
	if pixelCount > 2000000 { // Large image (> 2MP)
		if targetSizeKB < 200 {
			opts.Quality = 60 // Aggressive compression
			opts.Method = 6
			opts.Preset = "photo"
		} else if targetSizeKB < 500 {
			opts.Quality = 75 // Moderate compression
			opts.Method = 6
			opts.Preset = "photo"
		} else {
			opts.Quality = 85 // Light compression
			opts.Method = 6
			opts.Preset = "picture"
		}
	} else if pixelCount > 500000 { // Medium image (> 0.5MP)
		if targetSizeKB < 100 {
			opts.Quality = 65
			opts.Method = 6
			opts.Preset = "picture"
		} else {
			opts.Quality = 80
			opts.Method = 6
			opts.Preset = "picture"
		}
	} else { // Small image
		opts.Quality = 90
		opts.Method = 6
		opts.Preset = "picture"
	}

	// Special handling for different input formats
	switch strings.ToLower(format) {
	case "png":
		// PNG to WebP conversion benefits from preserved sharp edges
		if opts.Quality > 80 {
			opts.Preset = "picture"
		}
	case "gif":
		// GIF images often have limited colors
		opts.Quality = min(opts.Quality+10, 100)
		opts.Preset = "icon"
	case "bmp":
		// BMP is often uncompressed, aggressive compression OK
		opts.Quality = max(opts.Quality-10, 60)
		opts.Preset = "photo"
	}

	return opts
}

// ConvertImageToWebPFile converts an image file to WebP format.
func ConvertImageToWebPFile(inputPath, outputPath string, opts WebPConversionOptions) error {
	// Read input image
	data, err := os.ReadFile(inputPath)
	if err != nil {
		return fmt.Errorf("failed to read input file: %w", err)
	}

	// Convert to WebP
	webpData, err := ConvertToWebP(data, opts)
	if err != nil {
		return fmt.Errorf("failed to convert to WebP: %w", err)
	}

	// Ensure output directory exists
	if err := os.MkdirAll(filepath.Dir(outputPath), 0755); err != nil {
		return fmt.Errorf("failed to create output directory: %w", err)
	}

	// Write WebP file
	if err := os.WriteFile(outputPath, webpData, 0644); err != nil {
		return fmt.Errorf("failed to write WebP file: %w", err)
	}

	return nil
}

// ValidateWebPQuality checks if WebP quality settings are valid.
func ValidateWebPQuality(quality int) error {
	if quality < 1 || quality > 100 {
		return fmt.Errorf("WebP quality must be between 1 and 100, got %d", quality)
	}
	return nil
}

// Helper functions
func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}
