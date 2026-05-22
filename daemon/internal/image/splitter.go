package image

import (
	"encoding/json"
	"fmt"
	"image"
	"image/png"
	"log/slog"
	"math"
	"os"
	"path/filepath"
	"sort"

	"waypaper-engine/daemon/internal/monitor"
)

// Splitter handles splitting a single image across multiple monitors for extend mode.
type Splitter struct {
	outputDir string
}

// NewSplitter creates a Splitter that saves cropped images to the given directory.
func NewSplitter(outputDir string) *Splitter {
	return &Splitter{outputDir: outputDir}
}

// logicalMonitor holds a monitor's geometry normalized to logical (layout) pixels.
// Wayland compositors report X/Y in logical coordinates but Width/Height in
// physical pixels. This struct ensures all fields are in the same coordinate
// space so bounding box and crop math is correct, including for HiDPI displays.
type logicalMonitor struct {
	Name          string
	LogicalWidth  int
	LogicalHeight int
	X             int // already logical from the compositor
	Y             int // already logical from the compositor
}

// toLogical converts a monitor's physical Width/Height to logical pixels using
// its scale factor. X and Y are already in logical coordinates from the compositor.
func toLogical(mon monitor.Monitor) logicalMonitor {
	scale := mon.Scale
	if scale <= 0 {
		scale = 1.0
	}
	return logicalMonitor{
		Name:          mon.Name,
		LogicalWidth:  int(math.Round(float64(mon.Width) / scale)),
		LogicalHeight: int(math.Round(float64(mon.Height) / scale)),
		X:             mon.X,
		Y:             mon.Y,
	}
}

// Split takes a source image and a list of monitors, and produces one cropped
// image per monitor based on monitor geometry. Returns a map of monitor name to
// cropped image absolute path.
//
// All geometry is normalized to logical pixels before processing. Wayland
// compositors report positions in logical coordinates but resolutions in physical
// pixels; dividing by Scale brings everything into the same coordinate space.
// The resulting split images are at logical resolution -- awww handles upscaling
// to physical per-monitor via its resize mode.
//
// Results are cached per imageID in a subfolder with a cache.json that records
// source file metadata (path, size, modification time) and monitor geometry.
// The cache is only reused when BOTH the source file and monitor layout match,
// which prevents stale fragments after a DB wipe and re-import where IDs get
// reassigned to different images.
func (s *Splitter) Split(sourcePath string, imageID int, monitors []monitor.Monitor) (map[string]string, error) {
	imageDir := filepath.Join(s.outputDir, "processed", fmt.Sprintf("%d", imageID))

	// Check for a valid cache before doing any image processing.
	if cached, ok := s.loadCache(imageDir, sourcePath, monitors); ok {
		slog.Debug("splitter: using cached split images", "image_id", imageID)
		return cached, nil
	}

	src, err := openImage(sourcePath)
	if err != nil {
		return nil, fmt.Errorf("splitter: open source: %w", err)
	}

	// Create (or clear) the per-image output directory.
	if err := os.RemoveAll(imageDir); err != nil {
		return nil, fmt.Errorf("splitter: clean dir: %w", err)
	}
	if err := os.MkdirAll(imageDir, 0o755); err != nil {
		return nil, fmt.Errorf("splitter: create dir: %w", err)
	}

	// Normalize all monitors to logical pixels so X/Y and Width/Height
	// are in the same coordinate space.
	logical := make([]logicalMonitor, len(monitors))
	for i, mon := range monitors {
		logical[i] = toLogical(mon)
	}

	bbox := computeBoundingBox(logical)
	if bbox.Width == 0 || bbox.Height == 0 {
		return nil, fmt.Errorf("splitter: invalid bounding box %dx%d", bbox.Width, bbox.Height)
	}

	// Scale source image to cover the logical bounding box while preserving
	// aspect ratio. fillImage scales up to cover, then center-crops excess
	// (equivalent to Sharp's fit:"cover").
	scaled := fillImage(src, bbox.Width, bbox.Height)

	result := make(map[string]string, len(monitors))

	for _, lm := range logical {
		cropX := lm.X - bbox.X
		cropY := lm.Y - bbox.Y

		cropped := cropImage(scaled, image.Rect(cropX, cropY, cropX+lm.LogicalWidth, cropY+lm.LogicalHeight))

		outPath := filepath.Join(imageDir, fmt.Sprintf("%s.png", lm.Name))

		if err := writePNG(outPath, cropped); err != nil {
			return nil, fmt.Errorf("splitter: %s: %w", lm.Name, err)
		}

		result[lm.Name] = outPath
	}

	// Persist cache metadata so subsequent calls can skip processing.
	if err := s.saveCache(imageDir, sourcePath, monitors, result); err != nil {
		slog.Warn("splitter: failed to save cache", "image_id", imageID, "error", err)
	}

	return result, nil
}

// --- cache types ---

// splitCacheEntry records the geometry for a single monitor in the cache.
type splitCacheEntry struct {
	Name   string  `json:"name"`
	Width  int     `json:"width"`
	Height int     `json:"height"`
	X      int     `json:"x"`
	Y      int     `json:"y"`
	Scale  float64 `json:"scale"`
	Path   string  `json:"path"`
}

// splitCache is the JSON structure written to cache.json inside each image's
// processed directory. It includes source file metadata so the cache is
// invalidated when the source changes (e.g. after a DB wipe and re-import
// where IDs are reassigned to different images).
type splitCache struct {
	SourcePath    string            `json:"source_path"`
	SourceSize    int64             `json:"source_size"`
	SourceModTime int64             `json:"source_mod_time"`
	Monitors      []splitCacheEntry `json:"monitors"`
}

const cacheFileName = "cache.json"

// loadCache reads the cache.json from imageDir and checks if the cached source
// file and monitor geometry match the current request. Returns ok=false if the
// cache is missing, unreadable, or stale.
func (s *Splitter) loadCache(imageDir string, sourcePath string, monitors []monitor.Monitor) (map[string]string, bool) {
	data, err := os.ReadFile(filepath.Join(imageDir, cacheFileName))
	if err != nil {
		return nil, false
	}

	var cache splitCache
	if err := json.Unmarshal(data, &cache); err != nil {
		return nil, false
	}

	// Validate that the source image hasn't changed (guards against ID reuse
	// after a DB wipe, file replacement, etc.).
	srcInfo, err := os.Stat(sourcePath)
	if err != nil {
		return nil, false
	}
	if cache.SourcePath != sourcePath ||
		cache.SourceSize != srcInfo.Size() ||
		cache.SourceModTime != srcInfo.ModTime().UnixNano() {
		slog.Debug("splitter: cache stale (source changed)",
			"cached_path", cache.SourcePath, "current_path", sourcePath,
			"cached_size", cache.SourceSize, "current_size", srcInfo.Size())
		return nil, false
	}

	if len(cache.Monitors) != len(monitors) {
		return nil, false
	}

	// Sort both lists by name for stable comparison.
	sorted := make([]monitor.Monitor, len(monitors))
	copy(sorted, monitors)
	sort.Slice(sorted, func(i, j int) bool { return sorted[i].Name < sorted[j].Name })

	cachedSorted := make([]splitCacheEntry, len(cache.Monitors))
	copy(cachedSorted, cache.Monitors)
	sort.Slice(cachedSorted, func(i, j int) bool { return cachedSorted[i].Name < cachedSorted[j].Name })

	result := make(map[string]string, len(monitors))
	for i, mon := range sorted {
		ce := cachedSorted[i]
		if ce.Name != mon.Name || ce.Width != mon.Width || ce.Height != mon.Height ||
			ce.X != mon.X || ce.Y != mon.Y || ce.Scale != mon.Scale {
			return nil, false
		}
		// Verify the cached file still exists on disk.
		if _, err := os.Stat(ce.Path); err != nil {
			return nil, false
		}
		result[mon.Name] = ce.Path
	}

	return result, true
}

// saveCache writes a cache.json into imageDir recording the source file
// metadata, monitor geometry, and output paths so future Split calls can skip
// processing.
func (s *Splitter) saveCache(imageDir string, sourcePath string, monitors []monitor.Monitor, paths map[string]string) error {
	srcInfo, err := os.Stat(sourcePath)
	if err != nil {
		return fmt.Errorf("stat source for cache: %w", err)
	}

	cache := splitCache{
		SourcePath:    sourcePath,
		SourceSize:    srcInfo.Size(),
		SourceModTime: srcInfo.ModTime().UnixNano(),
		Monitors:      make([]splitCacheEntry, 0, len(monitors)),
	}
	for _, mon := range monitors {
		cache.Monitors = append(cache.Monitors, splitCacheEntry{
			Name:   mon.Name,
			Width:  mon.Width,
			Height: mon.Height,
			X:      mon.X,
			Y:      mon.Y,
			Scale:  mon.Scale,
			Path:   paths[mon.Name],
		})
	}

	data, err := json.MarshalIndent(cache, "", "  ")
	if err != nil {
		return fmt.Errorf("marshal cache: %w", err)
	}

	return os.WriteFile(filepath.Join(imageDir, cacheFileName), data, 0o644)
}

func writePNG(path string, img image.Image) (err error) {
	f, err := os.Create(path)
	if err != nil {
		return err
	}
	defer func() {
		if cerr := f.Close(); err == nil {
			err = cerr
		}
	}()
	return png.Encode(f, img)
}

// boundingBox represents the combined area of all monitors in logical pixels.
type boundingBox struct {
	X, Y          int
	Width, Height int
}

// computeBoundingBox calculates the total bounding box from the logical geometry
// of all monitors.
func computeBoundingBox(monitors []logicalMonitor) boundingBox {
	if len(monitors) == 0 {
		return boundingBox{}
	}

	minX, minY := monitors[0].X, monitors[0].Y
	maxX, maxY := monitors[0].X+monitors[0].LogicalWidth, monitors[0].Y+monitors[0].LogicalHeight

	for _, mon := range monitors[1:] {
		if mon.X < minX {
			minX = mon.X
		}
		if mon.Y < minY {
			minY = mon.Y
		}
		if mon.X+mon.LogicalWidth > maxX {
			maxX = mon.X + mon.LogicalWidth
		}
		if mon.Y+mon.LogicalHeight > maxY {
			maxY = mon.Y + mon.LogicalHeight
		}
	}

	return boundingBox{
		X:      minX,
		Y:      minY,
		Width:  maxX - minX,
		Height: maxY - minY,
	}
}
