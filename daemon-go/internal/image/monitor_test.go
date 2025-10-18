package image

import (
	"bytes"
	"image"
	"image/png"
	"testing"
	"waypaper-engine/daemon-go/internal/monitor"
)

func TestProcessForMonitors(t *testing.T) {
	// Create a dummy 100x100 image
	img := image.NewRGBA(image.Rect(0, 0, 100, 100))
	var buf bytes.Buffer
	if err := png.Encode(&buf, img); err != nil {
		t.Fatalf("failed to create test image: %v", err)
	}
	imgBytes := buf.Bytes()

	monitors := []monitor.Monitor{
		{Name: "Monitor1", Width: 1920, Height: 1080, Position: monitor.Position{X: 0, Y: 0}},
		{Name: "Monitor2", Width: 1920, Height: 1080, Position: monitor.Position{X: 1920, Y: 0}},
	}

	tests := []struct {
		name               string
		activeMonitor      *monitor.ActiveMonitor
		expectError        bool
		expectedImageCount int
		expectedWidths     []int
		expectedHeights    []int
	}{
		{
			name:               "Extend across monitors",
			activeMonitor:      &monitor.ActiveMonitor{Name: "Test", Monitors: monitors, ImageSetType: "extend"},
			expectError:        false,
			expectedImageCount: 2,
			expectedWidths:     []int{1920, 1920},
			expectedHeights:    []int{1080, 1080},
		},
		{
			name:               "Duplicate on each monitor",
			activeMonitor:      &monitor.ActiveMonitor{Name: "Test", Monitors: monitors, ImageSetType: "clone"},
			expectError:        false,
			expectedImageCount: 2,
			expectedWidths:     []int{1920, 1920},
			expectedHeights:    []int{1080, 1080},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			monitorImages, err := ProcessForMonitors(imgBytes, tt.activeMonitor)
			if (err != nil) != tt.expectError {
				t.Fatalf("ProcessForMonitors() error = %v, expectError %v", err, tt.expectError)
			}

			if !tt.expectError {
				if len(monitorImages) != tt.expectedImageCount {
					t.Fatalf("Expected %d images, got %d", tt.expectedImageCount, len(monitorImages))
				}

				for i, mi := range monitorImages {
					// Decode the image bytes to get bounds
					img, _, err := image.Decode(bytes.NewReader(mi.Image))
					if err != nil {
						t.Fatalf("Failed to decode image %d: %v", i, err)
					}
					if img.Bounds().Dx() != tt.expectedWidths[i] {
						t.Errorf("Image %d: expected width %d, got %d", i, tt.expectedWidths[i], img.Bounds().Dx())
					}
					if img.Bounds().Dy() != tt.expectedHeights[i] {
						t.Errorf("Image %d: expected height %d, got %d", i, tt.expectedHeights[i], img.Bounds().Dy())
					}
				}
			}
		})
	}
}
