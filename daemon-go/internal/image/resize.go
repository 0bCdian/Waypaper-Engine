package image

import (
	"bytes"
	"fmt"
	"image"
	"image/gif"
	"image/jpeg"
	"image/png"

	"github.com/chai2010/webp"
	"github.com/disintegration/imaging"
	"golang.org/x/image/bmp"
)

// ResizeOptions holds parameters for resizing an image.

type ResizeOptions struct {
	Width   int
	Height  int
	Filter  imaging.ResampleFilter
	Format  string // e.g., "jpeg", "png"
	Quality int    // For JPEG, from 1 to 100
}

// DefaultResizeOptions returns a default set of resizing options.
func DefaultResizeOptions() ResizeOptions {
	return ResizeOptions{
		Width:   0, // 0 means preserve aspect ratio
		Height:  0,
		Filter:  imaging.Lanczos,
		Format:  "jpeg",
		Quality: 90,
	}
}

// Resize resizes an image according to the provided options.
func Resize(data []byte, opts ResizeOptions) ([]byte, error) {
	img, _, err := image.Decode(bytes.NewReader(data))
	if err != nil {
		return nil, fmt.Errorf("failed to decode image: %w", err)
	}

	resizedImg := imaging.Resize(img, opts.Width, opts.Height, opts.Filter)

	var buf bytes.Buffer
	switch opts.Format {
	case "jpeg":
		err = jpeg.Encode(&buf, resizedImg, &jpeg.Options{Quality: opts.Quality})
	case "png":
		err = png.Encode(&buf, resizedImg)
	case "gif":
		err = gif.Encode(&buf, resizedImg, &gif.Options{NumColors: 256})
	case "bmp":
		err = bmp.Encode(&buf, resizedImg)
	case "webp":
		err = webp.Encode(&buf, resizedImg, &webp.Options{Quality: float32(opts.Quality)})
	default:
		return nil, fmt.Errorf("unsupported format: %s", opts.Format)
	}

	if err != nil {
		return nil, fmt.Errorf("failed to encode image: %w", err)
	}

	return buf.Bytes(), nil
}

// ConvertFormat converts an image from one format to another.
func ConvertFormat(data []byte, toFormat string, quality int) ([]byte, error) {
	img, _, err := image.Decode(bytes.NewReader(data))
	if err != nil {
		return nil, fmt.Errorf("failed to decode image: %w", err)
	}

	var buf bytes.Buffer
	switch toFormat {
	case "jpeg":
		err = jpeg.Encode(&buf, img, &jpeg.Options{Quality: quality})
	case "png":
		err = png.Encode(&buf, img)
	case "gif":
		err = gif.Encode(&buf, img, &gif.Options{NumColors: 256})
	case "bmp":
		err = bmp.Encode(&buf, img)
	case "webp":
		err = webp.Encode(&buf, img, &webp.Options{Quality: float32(quality)})
	default:
		return nil, fmt.Errorf("unsupported format: %s", toFormat)
	}

	if err != nil {
		return nil, fmt.Errorf("failed to encode image: %w", err)
	}

	return buf.Bytes(), nil
}
