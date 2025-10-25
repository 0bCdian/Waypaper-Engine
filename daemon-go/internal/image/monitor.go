package image

import (
	"bytes"
	"fmt"
	"image"
	"image/jpeg"
	"waypaper-engine/daemon-go/internal/monitor"

	"github.com/disintegration/imaging"
)

// MonitorImage represents an image that has been processed for a specific monitor.
type MonitorImage struct {
	Monitor monitor.Monitor
	Image   []byte // Encoded image data
}

// ProcessForMonitors takes an image and a monitor setup and returns a list of images
// ready to be applied to each monitor.
// The mode parameter should be monitor.MonitorModeExtend or monitor.MonitorModeClone
func ProcessForMonitors(data []byte, monitors []monitor.Monitor, mode monitor.MonitorMode) ([]MonitorImage, error) {
	img, _, err := image.Decode(bytes.NewReader(data))
	if err != nil {
		return nil, fmt.Errorf("failed to decode image: %w", err)
	}

	if mode == monitor.MonitorModeExtend {
		return splitImageForMonitors(img, monitors)
	} else {
		return duplicateImageForMonitors(img, monitors)
	}
}

// splitImageForMonitors splits an image across multiple monitors.
func splitImageForMonitors(img image.Image, monitors []monitor.Monitor) ([]MonitorImage, error) {
	var monitorImages []MonitorImage

	// Calculate the total bounds of all monitors
	totalWidth, totalHeight := 0, 0
	for _, m := range monitors {
		if m.Position.X+m.Width > totalWidth {
			totalWidth = m.Position.X + m.Width
		}
		if m.Position.Y+m.Height > totalHeight {
			totalHeight = m.Position.Y + m.Height
		}
	}

	// Resize the image to fit the total monitor space
	resizedImg := imaging.Fill(img, totalWidth, totalHeight, imaging.Center, imaging.Lanczos)

	for _, m := range monitors {
		// Crop the resized image for each monitor
		croppedImg := imaging.Crop(resizedImg, image.Rect(m.Position.X, m.Position.Y, m.Position.X+m.Width, m.Position.Y+m.Height))

		// Encode the image to JPEG
		var buf bytes.Buffer
		err := jpeg.Encode(&buf, croppedImg, &jpeg.Options{Quality: 90})
		if err != nil {
			return nil, fmt.Errorf("failed to encode image for monitor %s: %w", m.Name, err)
		}

		monitorImages = append(monitorImages, MonitorImage{
			Monitor: m,
			Image:   buf.Bytes(),
		})
	}

	return monitorImages, nil
}

// duplicateImageForMonitors duplicates an image for each monitor.
func duplicateImageForMonitors(img image.Image, monitors []monitor.Monitor) ([]MonitorImage, error) {
	var monitorImages []MonitorImage

	for _, m := range monitors {
		// Resize the image to fit the monitor
		resizedImg := imaging.Fill(img, m.Width, m.Height, imaging.Center, imaging.Lanczos)

		// Encode the image to JPEG
		var buf bytes.Buffer
		err := jpeg.Encode(&buf, resizedImg, &jpeg.Options{Quality: 90})
		if err != nil {
			return nil, fmt.Errorf("failed to encode image for monitor %s: %w", m.Name, err)
		}

		monitorImages = append(monitorImages, MonitorImage{
			Monitor: m,
			Image:   buf.Bytes(),
		})
	}

	return monitorImages, nil
}
