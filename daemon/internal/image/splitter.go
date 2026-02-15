package image

import (
	"fmt"
	"image"
	"image/png"
	"os"
	"path/filepath"

	"github.com/disintegration/imaging"

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

// Split takes a source image and a list of monitors, and produces one cropped
// image per monitor based on monitor geometry. Returns a map of monitor name to
// cropped image absolute path.
func (s *Splitter) Split(sourcePath string, imageID int, monitors []monitor.Monitor) (map[string]string, error) {
	src, err := imaging.Open(sourcePath)
	if err != nil {
		return nil, fmt.Errorf("splitter: open source: %w", err)
	}

	processedDir := filepath.Join(s.outputDir, "processed")
	if err := os.MkdirAll(processedDir, 0o755); err != nil {
		return nil, fmt.Errorf("splitter: create dir: %w", err)
	}

	// Compute the bounding box of all monitors.
	bbox := computeBoundingBox(monitors)
	if bbox.Width == 0 || bbox.Height == 0 {
		return nil, fmt.Errorf("splitter: invalid bounding box %dx%d", bbox.Width, bbox.Height)
	}

	// Scale source image to fit the bounding box.
	scaled := imaging.Resize(src, bbox.Width, bbox.Height, imaging.Lanczos)

	result := make(map[string]string, len(monitors))

	for _, mon := range monitors {
		// Compute the crop region for this monitor relative to the bounding box origin.
		cropX := mon.X - bbox.X
		cropY := mon.Y - bbox.Y

		cropped := imaging.Crop(scaled, image.Rect(cropX, cropY, cropX+mon.Width, cropY+mon.Height))

		outPath := filepath.Join(processedDir, fmt.Sprintf("%d_%s_%dx%d.png", imageID, mon.Name, mon.Width, mon.Height))

		f, err := os.Create(outPath)
		if err != nil {
			return nil, fmt.Errorf("splitter: create file for %s: %w", mon.Name, err)
		}

		if err := png.Encode(f, cropped); err != nil {
			f.Close()
			return nil, fmt.Errorf("splitter: encode for %s: %w", mon.Name, err)
		}
		f.Close()

		result[mon.Name] = outPath
	}

	return result, nil
}

// boundingBox represents the combined area of all monitors.
type boundingBox struct {
	X, Y          int
	Width, Height int
}

// computeBoundingBox calculates the total bounding box from the geometry of all monitors.
func computeBoundingBox(monitors []monitor.Monitor) boundingBox {
	if len(monitors) == 0 {
		return boundingBox{}
	}

	minX, minY := monitors[0].X, monitors[0].Y
	maxX, maxY := monitors[0].X+monitors[0].Width, monitors[0].Y+monitors[0].Height

	for _, mon := range monitors[1:] {
		if mon.X < minX {
			minX = mon.X
		}
		if mon.Y < minY {
			minY = mon.Y
		}
		if mon.X+mon.Width > maxX {
			maxX = mon.X + mon.Width
		}
		if mon.Y+mon.Height > maxY {
			maxY = mon.Y + mon.Height
		}
	}

	return boundingBox{
		X:      minX,
		Y:      minY,
		Width:  maxX - minX,
		Height: maxY - minY,
	}
}
