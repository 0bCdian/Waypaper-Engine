package image

import (
	"fmt"
	"image"
	"os"
	"path/filepath"

	"github.com/chai2010/webp"
	"github.com/disintegration/imaging"
)

// ThumbnailResolution defines a named thumbnail size.
type ThumbnailResolution struct {
	Label    string
	MaxWidth int
	MaxHeight int
}

// DefaultThumbnailResolutions is the set of thumbnail sizes generated for each image.
var DefaultThumbnailResolutions = []ThumbnailResolution{
	{Label: "default", MaxWidth: 300, MaxHeight: 0},
	{Label: "720p", MaxWidth: 1280, MaxHeight: 720},
	{Label: "1080p", MaxWidth: 1920, MaxHeight: 1080},
	{Label: "1440p", MaxWidth: 2560, MaxHeight: 1440},
	{Label: "4k", MaxWidth: 3840, MaxHeight: 2160},
}

// Thumbnailer generates multi-resolution WebP thumbnails from source images.
type Thumbnailer struct {
	thumbnailsDir string
	resolutions   []ThumbnailResolution
}

// NewThumbnailer creates a Thumbnailer that saves thumbnails to the given directory.
func NewThumbnailer(thumbnailsDir string) *Thumbnailer {
	return &Thumbnailer{
		thumbnailsDir: thumbnailsDir,
		resolutions:   DefaultThumbnailResolutions,
	}
}

// Generate creates thumbnails for the given source image.
// Returns a map of resolution label to thumbnail absolute path.
func (t *Thumbnailer) Generate(sourcePath string, imageID int) (map[string]string, error) {
	src, err := imaging.Open(sourcePath)
	if err != nil {
		return nil, fmt.Errorf("thumbnailer: open source: %w", err)
	}

	if err := os.MkdirAll(t.thumbnailsDir, 0o755); err != nil {
		return nil, fmt.Errorf("thumbnailer: create dir: %w", err)
	}

	thumbnails := make(map[string]string, len(t.resolutions))

	for _, res := range t.resolutions {
		outPath := filepath.Join(t.thumbnailsDir, fmt.Sprintf("%d_%s.webp", imageID, res.Label))

		thumb := fitImage(src, res.MaxWidth, res.MaxHeight)

		f, err := os.Create(outPath)
		if err != nil {
			return nil, fmt.Errorf("thumbnailer: create file %s: %w", res.Label, err)
		}

		if err := webp.Encode(f, thumb, &webp.Options{Quality: 80}); err != nil {
			f.Close()
			return nil, fmt.Errorf("thumbnailer: encode %s: %w", res.Label, err)
		}
		f.Close()

		thumbnails[res.Label] = outPath
	}

	return thumbnails, nil
}

// fitImage resizes the image to fit within maxWidth x maxHeight, preserving aspect ratio.
// If maxHeight is 0, only maxWidth is used.
func fitImage(src image.Image, maxWidth, maxHeight int) image.Image {
	if maxHeight == 0 {
		return imaging.Resize(src, maxWidth, 0, imaging.Lanczos)
	}
	return imaging.Fit(src, maxWidth, maxHeight, imaging.Lanczos)
}
