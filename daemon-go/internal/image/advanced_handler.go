package image

import (
	"bytes"
	"fmt"
	"image"
	"image/jpeg"
	"image/png"
)

// AdvancedImageHandler provides advanced image processing capabilities through IPC.
type AdvancedImageHandler struct {
	optimizer      *OptimizationEngine
	webpConverter  *WebPConverter
	batchProcessor *BatchProcessor
	logger         func(string, ...interface{})
}

// OptimizationEngine wraps image optimization functionality.
type OptimizationEngine struct {
	logger func(string, ...any)
}

// WebPConverter wraps WebP conversion functionality.
type WebPConverter struct {
	logger func(string, ...any)
}

// NewAdvancedImageHandler creates a new advanced image handler.
func NewAdvancedImageHandler(logger func(string, ...interface{})) *AdvancedImageHandler {
	batchProcessor := NewBatchProcessor(logger) // No cache needed

	return &AdvancedImageHandler{
		optimizer:      &OptimizationEngine{logger: logger},
		webpConverter:  &WebPConverter{logger: logger},
		batchProcessor: batchProcessor,
		logger:         logger,
	}
}

// HandleProgressiveJPEGOptimization handles progressive JPEG optimization.
func (h *AdvancedImageHandler) HandleProgressiveJPEGOptimization(data []byte, quality int) ([]byte, error) {
	h.logger("Starting progressive JPEG optimization")

	opts := OptimizationOptions{
		Format:               "jpeg",
		Quality:              quality,
		Progressive:          true,
		EncodeOptimizations:  true,
		SmartResize:          false,
		StripMetadata:        true,
		HardwareAcceleration: false,
	}

	optimizedData, err := OptimizeImage(data, opts)
	if err != nil {
		h.logger("Progressive JPEG optimization failed: %v", err)
		return nil, fmt.Errorf("progressive JPEG optimization failed: %w", err)
	}

	h.logger("Progressive JPEG optimization completed")
	return optimizedData, nil
}

// HandleWebPConversion handles WebP conversion with best-fit algorithms.
func (h *AdvancedImageHandler) HandleWebPConversion(data []byte, targetSizeKB int, lossless bool) ([]byte, error) {
	h.logger("Starting WebP conversion")

	var opts WebPConversionOptions
	if !lossless && targetSizeKB > 0 {
		opts = BestFitWebPConversion(data, targetSizeKB)
	} else {
		opts = DefaultWebPConversionOptions()
		opts.Lossless = lossless
	}

	webpData, err := ConvertToWebP(data, opts)
	if err != nil {
		h.logger("WebP conversion failed: %v", err)
		return nil, fmt.Errorf("WebP conversion failed: %w", err)
	}

	h.logger("WebP conversion completed, original: %d bytes, WebP: %d bytes", len(data), len(webpData))
	return webpData, nil
}

// HandleSimpleThumbnailGeneration handles simple thumbnail generation.
func (h *AdvancedImageHandler) HandleSimpleThumbnailGeneration(data []byte, width, height int) ([]byte, error) {
	h.logger("Generating thumbnail (%dx%d)", width, height)

	img, _, err := image.Decode(bytes.NewReader(data))
	if err != nil {
		h.logger("Thumbnail generation failed: %v", err)
		return nil, fmt.Errorf("failed to decode image: %w", err)
	}

	// Simple resize to thumbnail size
	// Use basic bilinear resizing - good enough for thumbnails
	bounds := img.Bounds()
	srcW := bounds.Dx()
	srcH := bounds.Dy()

	// Keep aspect ratio
	aspectRatio := float64(srcW) / float64(srcH)
	newW, newH := width, height
	if aspectRatio > 1 {
		newH = int(float64(width) / aspectRatio)
	} else {
		newW = int(float64(height) * aspectRatio)
	}

	// Create thumbnail - simple implementation
	thumb := image.NewRGBA(image.Rect(0, 0, newW, newH))
	for y := 0; y < newH; y++ {
		for x := 0; x < newW; x++ {
			srcX := x * srcW / newW
			srcY := y * srcH / newH
			thumb.Set(x, y, img.At(srcX, srcY))
		}
	}

	// Encode as JPEG
	var buf bytes.Buffer
	err = jpeg.Encode(&buf, thumb, &jpeg.Options{Quality: 80})
	if err != nil {
		h.logger("Thumbnail encoding failed: %v", err)
		return nil, fmt.Errorf("failed to encode thumbnail: %w", err)
	}

	h.logger("Thumbnail generation completed")
	return buf.Bytes(), nil
}

// Note: Deduplication and metadata privacy features removed as they don't apply to our wallpaper daemon use case

// HandleBatchImageProcessing handles batch image processing operations.
func (h *AdvancedImageHandler) HandleBatchImageProcessing(images []BatchImageData, operations []BatchOperation, opts BatchProcessingOptions) (*BatchProcessingJob, error) {
	h.logger("Starting batch image processing with %d images", len(images))

	h.batchProcessor.SetLogger(h.logger)
	job, err := h.batchProcessor.ProcessBatch(images, operations, opts)
	if err != nil {
		h.logger("Batch image processing failed: %v", err)
		return nil, fmt.Errorf("batch image processing failed: %w", err)
	}

	h.logger("Batch image processing job started with ID: %s", job.ID)
	return job, nil
}

// HandleImageFormatRepair handles automatic image format detection and repair.
func (h *AdvancedImageHandler) HandleImageFormatRepair(data []byte, inputFormat string) ([]byte, string, error) {
	h.logger("Starting image format repair for format: %s", inputFormat)

	// Detect actual format
	actualFormat := h.detectImageFormat(data)
	if actualFormat != inputFormat {
		h.logger("Format mismatch detected: expected %s, actual %s", inputFormat, actualFormat)
	}

	// Attempt to repair the image by re-encoding
	img, detectedFormat, err := image.Decode(bytes.NewReader(data))
	if err != nil {
		h.logger("Image format repair failed at decode: %v", err)
		return nil, "", fmt.Errorf("failed to decode image for repair: %w", err)
	}

	// Re-encode to ensure clean format
	var repairedData bytes.Buffer
	switch detectedFormat {
	case "jpeg":
		err = jpeg.Encode(&repairedData, img, nil)
	case "png":
		err = png.Encode(&repairedData, img)
	default:
		return data, detectedFormat, nil // Format is supported, return as-is
	}

	if err != nil {
		h.logger("Image format repair failed at encode: %v", err)
		return nil, "", fmt.Errorf("failed to re-encode image: %w", err)
	}

	h.logger("Image format repair completed: %s -> %s", inputFormat, detectedFormat)
	return repairedData.Bytes(), detectedFormat, nil
}

// HandleGPUAcceleratedResize handles GPU-accelerated image resizing.
func (h *AdvancedImageHandler) HandleGPUAcceleratedResize(data []byte, width, height int, opts ResizeOptions) ([]byte, error) {
	h.logger("Starting GPU-accelerated resize to %dx%d", width, height)

	// For now, fallback to CPU-based resize
	// TODO: Implement actual GPU acceleration
	opts.Width = width
	opts.Height = height

	resizedData, err := Resize(data, opts)
	if err != nil {
		h.logger("GPU-accelerated resize failed: %v", err)
		return nil, fmt.Errorf("GPU-accelerated resize failed: %w", err)
	}

	h.logger("GPU-accelerated resize completed (CPU fallback)")
	return resizedData, nil
}

// Note: Watermarking feature removed as it doesn't apply to our wallpaper daemon use case
func removed_watermarking_method(data []byte, watermarkPath string, opacity float64, position string) ([]byte, error) {
	return nil, fmt.Errorf("watermarking feature has been removed")
}

// GetImageQualityAnalysis performs comprehensive image quality analysis.
func (h *AdvancedImageHandler) GetImageQualityAnalysis(data []byte) (map[string]interface{}, error) {
	h.logger("Starting image quality analysis")

	img, format, err := image.Decode(bytes.NewReader(data))
	if err != nil {
		return nil, fmt.Errorf("failed to decode image for quality analysis: %w", err)
	}

	bounds := img.Bounds()
	width := bounds.Dx()
	height := bounds.Dy()

	// Basic quality metrics
	analysis := map[string]interface{}{
		"format":           format,
		"width":            width,
		"height":           height,
		"file_size_bytes":  len(data),
		"aspect_ratio":     float64(width) / float64(height),
		"total_pixels":     width * height,
		"memory_footprint": fmt.Sprintf("%.2f MB", float64(len(data))/1024/1024),
	}

	// Compression analysis
	if format == "jpeg" {
		analysis["estimated_quality"] = h.estimateJPEGQuality(data)
	}
	if format == "png" {
		analysis["compression_type"] = "lossless"
	}

	// Add resolution classification
	resolution := h.classifyResolution(width, height)
	analysis["resolution_class"] = resolution

	h.logger("Image quality analysis completed")
	return analysis, nil
}

// Helper methods

func (h *AdvancedImageHandler) detectImageFormat(data []byte) string {
	_, format, err := image.DecodeConfig(bytes.NewReader(data))
	if err != nil {
		h.logger("Failed to detect image format: %v", err)
		return "unknown"
	}
	return format
}

func (h *AdvancedImageHandler) estimateJPEGQuality(data []byte) int {
	// Simplified JPEG quality estimation
	sizeKB := len(data) / 1024
	switch {
	case sizeKB < 50:
		return 60
	case sizeKB < 100:
		return 70
	case sizeKB < 200:
		return 80
	case sizeKB < 500:
		return 85
	default:
		return 90
	}
}

func (h *AdvancedImageHandler) classifyResolution(width, height int) string {
	totalPixels := width * height
	switch {
	case totalPixels >= 8294400: // 4K+
		return "4k_ultra_hd"
	case totalPixels >= 2073600: // 1080p+
		return "1080p_full_hd"
	case totalPixels >= 921600: // 720p+
		return "720p_hd"
	case totalPixels >= 230400: // 480p+
		return "480p_sd"
	default:
		return "standard_definition"
	}
}

// SetAdvancedLogger sets a logger function for all components.
func (h *AdvancedImageHandler) SetAdvancedLogger(logger func(string, ...interface{})) {
	h.logger = logger
	h.optimizer.logger = logger
	h.webpConverter.logger = logger
	h.batchProcessor.SetLogger(logger)
}

// GetComponentStats returns statistics from all components.
func (h *AdvancedImageHandler) GetComponentStats() map[string]interface{} {
	return map[string]interface{}{
		"optimizer": "active",
		"webp":      "active",
		"batch":     "active",
	}
}
