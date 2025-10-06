package image

import (
	"bytes"
	"fmt"
	"image"
	_ "image/gif"
	_ "image/jpeg"
	_ "image/png"

	"golang.org/x/image/bmp"
	_ "golang.org/x/image/webp"
)

// Metadata holds information about an image.

type Metadata struct {
	Format      string
	Width       int
	Height      int
	EXIF        map[string]string
	Orientation int
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
		EXIF:   make(map[string]string),
	}

	// Extract EXIF data
	// exifData, err := exif.Decode(bytes.NewReader(data))
	// if err == nil {
	// 	meta.EXIF = extractEXIFFields(exifData)
	// 	orientation, ok := meta.EXIF["Orientation"]
	// 	if ok {
	// 		meta.Orientation = parseOrientation(orientation)
	// 	}
	// }

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
