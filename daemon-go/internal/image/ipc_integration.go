package image

import (
	"fmt"
)

// Note: AdvancedImageHandler type is defined in advanced_handler.go

// IPCImageProcessingAction represents an action for advanced image processing.
type IPCImageProcessingAction struct {
	Action     string                 `json:"action"`
	ImagePaths []string               `json:"imagePaths,omitempty"`
	ImageData  []byte                 `json:"imageData,omitempty"`
	Parameters map[string]interface{} `json:"parameters,omitempty"`
	Options    map[string]interface{} `json:"options,omitempty"`
}

// IPCImageProcessingResponse represents the response from advanced image processing.
type IPCImageProcessingResponse struct {
	Action    string      `json:"action"`
	Success   bool        `json:"success"`
	Data      interface{} `json:"data,omitempty"`
	Error     string      `json:"error,omitempty"`
	Timestamp string      `json:"timestamp"`
}

// HandleAdvancedImageAction handles advanced image processing actions via IPC.
func HandleAdvancedImageAction(action IPCImageProcessingAction, imgData []byte) (*IPCImageProcessingResponse, error) {
	handler := NewAdvancedImageHandler(func(msg string, args ...interface{}) {
		// Default logger - can be customized
		fmt.Printf(msg+"\n", args...)
	})

	switch action.Action {
	case "optimize_jpeg_progressive":
		return handler.handleProgressiveOptimization(action, imgData)
	case "convert_webp":
		return handler.handleWebPConversion(action, imgData)
	case "generate_simple_thumbnail":
		return handler.handleSimpleThumbnailGeneration(action, imgData)
	// Note: Deduplication and metadata privacy features removed
	case "batch_process":
		return handler.handleBatchProcessing(action, imgData)
	case "repair_image_format":
		return handler.handleImageFormatRepair(action, imgData)
	case "resize_gpu_accelerated":
		return handler.handleGPUAcceleratedResize(action, imgData)
	// Note: Watermarking feature removed
	case "analyze_image_quality":
		return handler.handleImageQualityAnalysis(action, imgData)
	default:
		return &IPCImageProcessingResponse{
			Action:  action.Action,
			Success: false,
			Error:   fmt.Sprintf("unknown action: %s", action.Action),
		}, nil
	}
}

// handleProgressiveOptimization handles progressive JPEG optimization requests.
func (h *AdvancedImageHandler) handleProgressiveOptimization(action IPCImageProcessingAction, imgData []byte) (*IPCImageProcessingResponse, error) {
	quality := 85 // Default quality
	if q, ok := action.Parameters["quality"].(float64); ok {
		quality = int(q)
	}

	optimizedData, err := h.HandleProgressiveJPEGOptimization(imgData, quality)
	if err != nil {
		return &IPCImageProcessingResponse{
			Action:  action.Action,
			Success: false,
			Error:   err.Error(),
		}, nil
	}

	return &IPCImageProcessingResponse{
		Action:  action.Action,
		Success: true,
		Data: map[string]interface{}{
			"optimizedData":    optimizedData,
			"originalSize":     len(imgData),
			"optimizedSize":    len(optimizedData),
			"quality":          quality,
			"compressionRatio": float64(len(optimizedData)) / float64(len(imgData)),
		},
	}, nil
}

// handleWebPConversion handles WebP conversion requests.
func (h *AdvancedImageHandler) handleWebPConversion(action IPCImageProcessingAction, imgData []byte) (*IPCImageProcessingResponse, error) {
	targetSizeKB := 0
	lossless := false

	if size, ok := action.Parameters["targetSizeKB"].(float64); ok {
		targetSizeKB = int(size)
	}
	if ls, ok := action.Parameters["lossless"].(bool); ok {
		lossless = ls
	}

	webpData, err := h.HandleWebPConversion(imgData, targetSizeKB, lossless)
	if err != nil {
		return &IPCImageProcessingResponse{
			Action:  action.Action,
			Success: false,
			Error:   err.Error(),
		}, nil
	}

	return &IPCImageProcessingResponse{
		Action:  action.Action,
		Success: true,
		Data: map[string]interface{}{
			"webpData":         webpData,
			"originalSize":     len(imgData),
			"webpSize":         len(webpData),
			"targetSizeKB":     targetSizeKB,
			"lossless":         lossless,
			"compressionRatio": float64(len(webpData)) / float64(len(imgData)),
		},
	}, nil
}

// handleSimpleThumbnailGeneration handles simple thumbnail generation requests.
func (h *AdvancedImageHandler) handleSimpleThumbnailGeneration(action IPCImageProcessingAction, imgData []byte) (*IPCImageProcessingResponse, error) {
	width := 300  // Default width
	height := 200 // Default height

	if w, ok := action.Parameters["width"].(float64); ok {
		width = int(w)
	}
	if h, ok := action.Parameters["height"].(float64); ok {
		height = int(h)
	}

	thumbnailData, err := h.HandleSimpleThumbnailGeneration(imgData, width, height)
	if err != nil {
		return &IPCImageProcessingResponse{
			Action:  action.Action,
			Success: false,
			Error:   err.Error(),
		}, nil
	}

	return &IPCImageProcessingResponse{
		Action:  action.Action,
		Success: true,
		Data: map[string]interface{}{
			"thumbnailData": thumbnailData,
			"originalSize":  len(imgData),
			"thumbnailSize": len(thumbnailData),
			"width":         width,
			"height":        height,
		},
	}, nil
}

// Note: Image deduplication removed as not applicable to wallpaper daemon use case
func removed_deduplication_handler(action IPCImageProcessingAction, imgData []byte) (*IPCImageProcessingResponse, error) {
	return &IPCImageProcessingResponse{
		Action:  action.Action,
		Success: false,
		Error:   "deduplication feature has been removed",
	}, nil
}

// Note: Metadata privacy analysis removed as not applicable to wallpaper daemon use case
func removed_metadata_privacy_handler(action IPCImageProcessingAction, imgData []byte) (*IPCImageProcessingResponse, error) {
	stripOptions := map[string]bool{
		"location":     false,
		"personal":     false,
		"manufacturer": false,
		"camera":       false,
		"software":     false,
		"timestamp":    false,
		"dimensions":   false,
		"format":       false,
	}

	// Update strip options based on parameters
	if opts, ok := action.Parameters["stripOptions"].(map[string]interface{}); ok {
		for key, value := range opts {
			if boolValue, ok := value.(bool); ok {
				stripOptions[key] = boolValue
			}
		}
	}

	// Metadata privacy feature removed
	return &IPCImageProcessingResponse{
		Action:  action.Action,
		Success: false,
		Error:   "metadata privacy feature has been removed",
	}, nil
}

// handleBatchProcessing handles batch processing requests.
func (h *AdvancedImageHandler) handleBatchProcessing(action IPCImageProcessingAction, imgData []byte) (*IPCImageProcessingResponse, error) {
	if len(action.ImagePaths) == 0 {
		return &IPCImageProcessingResponse{
			Action:  action.Action,
			Success: false,
			Error:   "no image paths provided for batch processing",
		}, nil
	}

	// Parse batch parameters
	batchSize := 20
	workerCount := 4
	if bs, ok := action.Parameters["batchSize"].(float64); ok {
		batchSize = int(bs)
	}
	if wc, ok := action.Parameters["workerCount"].(float64); ok {
		workerCount = int(wc)
	}

	// Convert image paths to BatchImageData
	var images []BatchImageData
	for i, path := range action.ImagePaths {
		images = append(images, BatchImageData{
			ID:     fmt.Sprintf("image_%d", i),
			Path:   path,
			Format: "jpeg", // Default format
		})
	}

	// Parse operations
	var operations []BatchOperation
	if ops, ok := action.Parameters["operations"].([]interface{}); ok {
		for _, opData := range ops {
			if opMap, ok := opData.(map[string]interface{}); ok {
				operations = append(operations, BatchOperation{
					Type:       opMap["type"].(string),
					Parameters: opMap["parameters"],
				})
			}
		}
	}

	// Default operation if none specified
	if len(operations) == 0 {
		operations = []BatchOperation{
			{
				Type: "optimize",
				Parameters: map[string]interface{}{
					"format":  "jpeg",
					"quality": 85,
				},
			},
		}
	}

	opts := DefaultBatchProcessingOptions()
	opts.BatchSize = batchSize
	opts.WorkerCount = workerCount

	job, err := h.HandleBatchImageProcessing(images, operations, opts)
	if err != nil {
		return &IPCImageProcessingResponse{
			Action:  action.Action,
			Success: false,
			Error:   err.Error(),
		}, nil
	}

	return &IPCImageProcessingResponse{
		Action:  action.Action,
		Success: true,
		Data: map[string]interface{}{
			"jobID":    job.ID,
			"status":   job.Status,
			"progress": job.Progress,
		},
	}, nil
}

// handleImageFormatRepair handles image format repair requests.
func (h *AdvancedImageHandler) handleImageFormatRepair(action IPCImageProcessingAction, imgData []byte) (*IPCImageProcessingResponse, error) {
	inputFormat := "jpeg" // Default format
	if fmt, ok := action.Parameters["inputFormat"].(string); ok {
		inputFormat = fmt
	}

	repairedData, detectedFormat, err := h.HandleImageFormatRepair(imgData, inputFormat)
	if err != nil {
		return &IPCImageProcessingResponse{
			Action:  action.Action,
			Success: false,
			Error:   err.Error(),
		}, nil
	}

	return &IPCImageProcessingResponse{
		Action:  action.Action,
		Success: true,
		Data: map[string]interface{}{
			"repairedData":   repairedData,
			"inputFormat":    inputFormat,
			"detectedFormat": detectedFormat,
			"originalSize":   len(imgData),
			"repairedSize":   len(repairedData),
			"formatMismatch": inputFormat != detectedFormat,
		},
	}, nil
}

// handleGPUAcceleratedResize handles GPU-accelerated resize requests.
func (h *AdvancedImageHandler) handleGPUAcceleratedResize(action IPCImageProcessingAction, imgData []byte) (*IPCImageProcessingResponse, error) {
	width := 1920  // Default width
	height := 1080 // Default height

	if w, ok := action.Parameters["width"].(float64); ok {
		width = int(w)
	}
	if h, ok := action.Parameters["height"].(float64); ok {
		height = int(h)
	}

	opts := DefaultResizeOptions()
	resizedData, err := h.HandleGPUAcceleratedResize(imgData, width, height, opts)
	if err != nil {
		return &IPCImageProcessingResponse{
			Action:  action.Action,
			Success: false,
			Error:   err.Error(),
		}, nil
	}

	return &IPCImageProcessingResponse{
		Action:  action.Action,
		Success: true,
		Data: map[string]interface{}{
			"resizedData":  resizedData,
			"originalSize": len(imgData),
			"resizedSize":  len(resizedData),
			"width":        width,
			"height":       height,
		},
	}, nil
}

// handleImageQualityAnalysis handles image quality analysis requests.
func (h *AdvancedImageHandler) handleImageQualityAnalysis(action IPCImageProcessingAction, imgData []byte) (*IPCImageProcessingResponse, error) {
	analysis, err := h.GetImageQualityAnalysis(imgData)
	if err != nil {
		return &IPCImageProcessingResponse{
			Action:  action.Action,
			Success: false,
			Error:   err.Error(),
		}, nil
	}

	return &IPCImageProcessingResponse{
		Action:  action.Action,
		Success: true,
		Data: map[string]interface{}{
			"analysis": analysis,
		},
	}, nil
}
