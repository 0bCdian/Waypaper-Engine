package image

import (
	"encoding/json"
	"fmt"
	"image"
	"image/jpeg"
	"image/png"
	"os"
	"path/filepath"
	"time"

	"waypaper-engine/daemon-go/internal/monitor"
)

// SplitImageForMonitors processes image for monitors with caching
func SplitImageForMonitors(imagePath string, monitors []monitor.Monitor, mode string, cacheDir string) (*MultiMonitorResult, error) {
	// 1. Generate cache key
	cacheKey := GenerateCacheKey(imagePath, monitors, mode)
	cacheInfoPath := filepath.Join(cacheDir, cacheKey, "info.json")

	// 2. Check if cache exists and is valid
	if cachedResult := loadCachedResult(cacheInfoPath, monitors); cachedResult != nil {
		return cachedResult, nil
	}

	// 3. Process image based on mode
	switch mode {
	case "extend":
		return createSplitImages(imagePath, monitors, cacheKey, cacheDir)
	case "clone":
		// For clone mode, just copy the same image for all monitors
		result := &MultiMonitorResult{
			MonitorImages: make(map[string]string),
			CacheKey:      cacheKey,
			CachedAt:      time.Now(),
		}

		for i, mon := range monitors {
			outputPath := filepath.Join(cacheDir, cacheKey, fmt.Sprintf("%s_%d.png", mon.Name, i))
			if err := copyFile(imagePath, outputPath); err != nil {
				return nil, err
			}
			result.MonitorImages[mon.Name] = outputPath
		}

		// Save cache info
		saveCacheInfo(cacheDir, cacheKey, imagePath, monitors, result.MonitorImages)
		return result, nil
	case "individual":
		if len(monitors) != 1 {
			return nil, fmt.Errorf("individual mode requires exactly 1 monitor")
		}
		return copyImageForMonitor(imagePath, monitors[0], cacheKey, cacheDir)
	default:
		return nil, fmt.Errorf("unknown mode: %s", mode)
	}
}

// createSplitImages splits image across monitors based on their positions
func createSplitImages(imagePath string, monitors []monitor.Monitor, cacheKey, cacheDir string) (*MultiMonitorResult, error) {
	// 1. Calculate total canvas size
	desiredDimensions := getDesiredDimensions(monitors)

	// 2. Resize image to fit canvas
	resizedPath := filepath.Join(cacheDir, cacheKey, "resized.png")
	if err := resizeImageToCanvas(imagePath, desiredDimensions, resizedPath); err != nil {
		return nil, err
	}

	// 3. Extract piece for each monitor
	result := &MultiMonitorResult{
		MonitorImages: make(map[string]string),
		CacheKey:      cacheKey,
		CachedAt:      time.Now(),
	}

	for i, mon := range monitors {
		outputPath := filepath.Join(cacheDir, cacheKey, fmt.Sprintf("%s_%d.png", mon.Name, i))
		if err := extractMonitorPiece(resizedPath, mon, outputPath); err != nil {
			return nil, err
		}
		result.MonitorImages[mon.Name] = outputPath
	}

	// 4. Save cache info
	saveCacheInfo(cacheDir, cacheKey, imagePath, monitors, result.MonitorImages)

	return result, nil
}

// copyImageForMonitor creates a single copy for individual mode
func copyImageForMonitor(imagePath string, mon monitor.Monitor, cacheKey, cacheDir string) (*MultiMonitorResult, error) {
	outputPath := filepath.Join(cacheDir, cacheKey, fmt.Sprintf("%s_0.png", mon.Name))
	if err := copyFile(imagePath, outputPath); err != nil {
		return nil, err
	}

	result := &MultiMonitorResult{
		MonitorImages: map[string]string{mon.Name: outputPath},
		CacheKey:      cacheKey,
		CachedAt:      time.Now(),
	}

	// Save cache info
	saveCacheInfo(cacheDir, cacheKey, imagePath, []monitor.Monitor{mon}, result.MonitorImages)

	return result, nil
}

// getDesiredDimensions calculates the total canvas size needed for all monitors
func getDesiredDimensions(monitors []monitor.Monitor) Dimensions {
	maxX, maxY := 0, 0

	for _, mon := range monitors {
		monitorMaxX := mon.Position.X + mon.Width
		monitorMaxY := mon.Position.Y + mon.Height

		if monitorMaxX > maxX {
			maxX = monitorMaxX
		}
		if monitorMaxY > maxY {
			maxY = monitorMaxY
		}
	}

	return Dimensions{Width: maxX, Height: maxY}
}

// resizeImageToCanvas resizes the image to fit the desired canvas dimensions
func resizeImageToCanvas(imagePath string, desiredDimensions Dimensions, outputPath string) error {
	// Create output directory
	if err := os.MkdirAll(filepath.Dir(outputPath), 0755); err != nil {
		return err
	}

	// Open source image
	srcFile, err := os.Open(imagePath)
	if err != nil {
		return err
	}
	defer srcFile.Close()

	// Decode image
	srcImg, format, err := image.Decode(srcFile)
	if err != nil {
		return err
	}

	// Get source dimensions
	srcBounds := srcImg.Bounds()
	srcWidth := srcBounds.Dx()
	srcHeight := srcBounds.Dy()

	// Calculate scaling factors
	scaleX := float64(desiredDimensions.Width) / float64(srcWidth)
	scaleY := float64(desiredDimensions.Height) / float64(srcHeight)

	// Use the larger scale to ensure the image covers the entire canvas
	scale := scaleX
	if scaleY > scaleX {
		scale = scaleY
	}

	// Calculate new dimensions (not used in simple scaling)
	// newWidth := int(float64(srcWidth) * scale)
	// newHeight := int(float64(srcHeight) * scale)

	// Create new image with desired dimensions
	dstImg := image.NewRGBA(image.Rect(0, 0, desiredDimensions.Width, desiredDimensions.Height))

	// Simple nearest neighbor scaling (can be improved with better algorithms)
	for y := 0; y < desiredDimensions.Height; y++ {
		for x := 0; x < desiredDimensions.Width; x++ {
			// Calculate source coordinates
			srcX := int(float64(x) / scale)
			srcY := int(float64(y) / scale)

			// Clamp to source bounds
			if srcX >= srcWidth {
				srcX = srcWidth - 1
			}
			if srcY >= srcHeight {
				srcY = srcHeight - 1
			}

			// Copy pixel
			dstImg.Set(x, y, srcImg.At(srcBounds.Min.X+srcX, srcBounds.Min.Y+srcY))
		}
	}

	// Save resized image
	dstFile, err := os.Create(outputPath)
	if err != nil {
		return err
	}
	defer dstFile.Close()

	// Encode based on original format
	switch format {
	case "png":
		return png.Encode(dstFile, dstImg)
	case "jpeg":
		return jpeg.Encode(dstFile, dstImg, &jpeg.Options{Quality: 90})
	default:
		// Default to PNG
		return png.Encode(dstFile, dstImg)
	}
}

// extractMonitorPiece extracts a portion of the image for a specific monitor
func extractMonitorPiece(imagePath string, mon monitor.Monitor, outputPath string) error {
	// Create output directory
	if err := os.MkdirAll(filepath.Dir(outputPath), 0755); err != nil {
		return err
	}

	// Open source image
	srcFile, err := os.Open(imagePath)
	if err != nil {
		return err
	}
	defer srcFile.Close()

	// Decode image
	srcImg, format, err := image.Decode(srcFile)
	if err != nil {
		return err
	}

	// Calculate extraction bounds
	srcBounds := srcImg.Bounds()
	extractX := mon.Position.X
	extractY := mon.Position.Y
	extractWidth := mon.Width
	extractHeight := mon.Height

	// Clamp to source bounds
	if extractX < srcBounds.Min.X {
		extractX = srcBounds.Min.X
	}
	if extractY < srcBounds.Min.Y {
		extractY = srcBounds.Min.Y
	}
	if extractX+extractWidth > srcBounds.Max.X {
		extractWidth = srcBounds.Max.X - extractX
	}
	if extractY+extractHeight > srcBounds.Max.Y {
		extractHeight = srcBounds.Max.Y - extractY
	}

	// Create new image for the monitor
	dstImg := image.NewRGBA(image.Rect(0, 0, extractWidth, extractHeight))

	// Copy pixels
	for y := 0; y < extractHeight; y++ {
		for x := 0; x < extractWidth; x++ {
			srcX := extractX + x
			srcY := extractY + y
			dstImg.Set(x, y, srcImg.At(srcX, srcY))
		}
	}

	// Save extracted image
	dstFile, err := os.Create(outputPath)
	if err != nil {
		return err
	}
	defer dstFile.Close()

	// Encode based on original format
	switch format {
	case "png":
		return png.Encode(dstFile, dstImg)
	case "jpeg":
		return jpeg.Encode(dstFile, dstImg, &jpeg.Options{Quality: 90})
	default:
		// Default to PNG
		return png.Encode(dstFile, dstImg)
	}
}

// loadCachedResult checks if cached split is still valid
func loadCachedResult(cacheInfoPath string, monitors []monitor.Monitor) *MultiMonitorResult {
	if !fileExists(cacheInfoPath) {
		return nil
	}

	var cacheInfo CacheInfo
	data, err := os.ReadFile(cacheInfoPath)
	if err != nil {
		return nil
	}

	if err := json.Unmarshal(data, &cacheInfo); err != nil {
		return nil
	}

	// Validate monitors match (name, width, height, position)
	if !monitorsMatch(cacheInfo.Monitors, monitors) {
		return nil
	}

	// Validate all files exist
	for _, path := range cacheInfo.MonitorImages {
		if !fileExists(path) {
			return nil
		}
	}

	return &MultiMonitorResult{
		MonitorImages: cacheInfo.MonitorImages,
		CacheKey:      filepath.Base(filepath.Dir(cacheInfoPath)),
		CachedAt:      time.Now(),
	}
}

// saveCacheInfo saves cache information to disk
func saveCacheInfo(cacheDir, cacheKey, imagePath string, monitors []monitor.Monitor, monitorImages map[string]string) {
	cacheInfo := CacheInfo{
		ImagePath:     imagePath,
		Monitors:      monitors,
		MonitorImages: monitorImages,
		CachedAt:      time.Now(),
	}

	infoPath := filepath.Join(cacheDir, cacheKey, "info.json")
	if err := os.MkdirAll(filepath.Dir(infoPath), 0755); err != nil {
		return
	}

	data, err := json.MarshalIndent(cacheInfo, "", "  ")
	if err != nil {
		return
	}

	os.WriteFile(infoPath, data, 0644)
}

// fileExists checks if a file exists
func fileExists(path string) bool {
	_, err := os.Stat(path)
	return !os.IsNotExist(err)
}

// monitorsMatch checks if two monitor configurations match
func monitorsMatch(cached, current []monitor.Monitor) bool {
	if len(cached) != len(current) {
		return false
	}

	for i, cachedMon := range cached {
		currentMon := current[i]
		if cachedMon.Name != currentMon.Name ||
			cachedMon.Width != currentMon.Width ||
			cachedMon.Height != currentMon.Height ||
			cachedMon.Position.X != currentMon.Position.X ||
			cachedMon.Position.Y != currentMon.Position.Y {
			return false
		}
	}

	return true
}

// Dimensions represents image dimensions
type Dimensions struct {
	Width  int
	Height int
}

// CacheInfo represents cached image information
type CacheInfo struct {
	ImagePath     string            `json:"imagePath"`
	Monitors      []monitor.Monitor `json:"monitors"`
	MonitorImages map[string]string `json:"monitorImages"`
	CachedAt      time.Time         `json:"cachedAt"`
}
