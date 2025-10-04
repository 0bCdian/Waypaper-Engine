
package image

import (
	"bytes"
	"image"
	"image/png"
	_ "image/png"
	"testing"

	"github.com/disintegration/imaging"
)

func TestResize(t *testing.T) {
	// Create a dummy 10x10 image
	img := image.NewRGBA(image.Rect(0, 0, 10, 10))
	var buf bytes.Buffer
	if err := png.Encode(&buf, img); err != nil {
		t.Fatalf("failed to create test image: %v", err)
	}
	imgBytes := buf.Bytes()

	tests := []struct {
		name        string
		opts        ResizeOptions
		expectError bool
		expectWidth int
		expectHeight int
	}{
		{
			name: "Resize to 5x5",
			opts: ResizeOptions{Width: 5, Height: 5, Filter: imaging.NearestNeighbor, Format: "png"},
			expectError: false,
			expectWidth: 5,
			expectHeight: 5,
		},
		{
			name: "Resize with aspect ratio (width)",
			opts: ResizeOptions{Width: 5, Height: 0, Filter: imaging.NearestNeighbor, Format: "png"},
			expectError: false,
			expectWidth: 5,
			expectHeight: 5,
		},
		{
			name: "Resize with aspect ratio (height)",
			opts: ResizeOptions{Width: 0, Height: 5, Filter: imaging.NearestNeighbor, Format: "png"},
			expectError: false,
			expectWidth: 5,
			expectHeight: 5,
		},
		{
			name: "Unsupported format",
			opts: ResizeOptions{Width: 5, Height: 5, Filter: imaging.NearestNeighbor, Format: "tiff"},
			expectError: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			resizedBytes, err := Resize(imgBytes, tt.opts)
			if (err != nil) != tt.expectError {
				t.Fatalf("Resize() error = %v, expectError %v", err, tt.expectError)
			}

			if !tt.expectError {
				img, _, err := image.Decode(bytes.NewReader(resizedBytes))
				if err != nil {
					t.Fatalf("failed to decode resized image: %v", err)
				}
				if img.Bounds().Dx() != tt.expectWidth {
					t.Errorf("Expected width %d, got %d", tt.expectWidth, img.Bounds().Dx())
				}
				if img.Bounds().Dy() != tt.expectHeight {
					t.Errorf("Expected height %d, got %d", tt.expectHeight, img.Bounds().Dy())
				}
			}
		})
	}
}

func TestConvertFormat(t *testing.T) {
	// Create a dummy 10x10 image
	img := image.NewRGBA(image.Rect(0, 0, 10, 10))
	var buf bytes.Buffer
	if err := png.Encode(&buf, img); err != nil {
		t.Fatalf("failed to create test image: %v", err)
	}
	imgBytes := buf.Bytes()

	tests := []struct {
		name         string
		toFormat     string
		expectError  bool
		expectFormat string
	}{
		{"Convert to JPEG", "jpeg", false, "jpeg"},
		{"Convert to GIF", "gif", false, "gif"},
		{"Unsupported format", "tiff", true, ""},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			convertedBytes, err := ConvertFormat(imgBytes, tt.toFormat, 80)
			if (err != nil) != tt.expectError {
				t.Fatalf("ConvertFormat() error = %v, expectError %v", err, tt.expectError)
			}

			if !tt.expectError {
				_, format, err := image.DecodeConfig(bytes.NewReader(convertedBytes))
				if err != nil {
					t.Fatalf("failed to decode converted image: %v", err)
				}
				if format != tt.expectFormat {
					t.Errorf("Expected format %s, got %s", tt.expectFormat, format)
				}
			}
		})
	}
}
