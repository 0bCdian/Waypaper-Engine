
package image

import (
	"bytes"
	"fmt"
	"image"
	_ "image/gif"
	_ "image/jpeg"
	_ "image/png"

	"github.com/rwcarlsen/goexif/exif"
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

// extractEXIFFields iterates over EXIF data and extracts fields as strings.
func extractEXIFFields(x *exif.Exif) map[string]string {
	fields := make(map[string]string)
	// x.Walk(func(name exif.FieldName, tag *exif.Tag) error {
	// 	fields[string(name)] = tag.String()
	// 	return nil
	// })
	return fields
}

// parseOrientation converts an EXIF orientation string to an int value.
func parseOrientation(orientation string) int {
	switch orientation {
	case "1":
		return 1 // Normal
	case "2":
		return 2 // FlipH
	case "3":
		return 3 // Rotate180
	case "4":
		return 4 // FlipV
	case "5":
		return 5 // Transpose
	case "6":
		return 6 // Rotate270
	case "7":
		return 7 // Transverse
	case "8":
		return 8 // Rotate90
	default:
		return 0 // Invalid
	}
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
