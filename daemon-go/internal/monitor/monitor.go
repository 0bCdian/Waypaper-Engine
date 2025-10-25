package monitor

import (
	"errors"
	"fmt"
	"os"
	"waypaper-engine/daemon-go/internal/types"
)

func DetectCompositor() (*types.CompositorInfo, error) {
	sessionType := os.Getenv("XDG_SESSION_TYPE")

	if sessionType == "wayland" {
		return &types.CompositorInfo{
			Type: types.CompositorTypeWayland,
		}, nil
	}

	if sessionType == "x11" {
		return &types.CompositorInfo{
			Type: types.CompositorTypeX11,
		}, nil
	}
	// Fallback to environment variables
	if waylandDisplay := os.Getenv("WAYLAND_DISPLAY"); waylandDisplay != "" {
		return &types.CompositorInfo{
			Type: types.CompositorTypeWayland,
		}, nil
	}

	if x11Display := os.Getenv("DISPLAY"); x11Display != "" {
		return &types.CompositorInfo{
			Type: types.CompositorTypeX11,
		}, nil
	}

	return nil, errors.New("no compositor detected")
}

// CreateMonitorManager creates a monitor manager for the detected compositor
func CreateMonitorManager(compositorInfo *types.CompositorInfo) (MonitorManager, error) {
	if compositorInfo.Type == "auto" {
		detectedCompositor, err := DetectCompositor()
		compositorInfo.Type = detectedCompositor.Type
		if err != nil {
			return nil, fmt.Errorf("failed to detect compositor: %w", err)
		}
	}
	switch compositorInfo.Type {
	case types.CompositorTypeWayland:
		return NewWaylandMonitorManager()
	case types.CompositorTypeX11:
		return NewX11MonitorManager()
	default:
		return nil, fmt.Errorf("unsupported compositor type: %s", compositorInfo.Type)
	}
}

// GetPrimaryMonitorFromMap returns the primary monitor from a map
func GetPrimaryMonitorFromMap(monitors Monitors) *Monitor {
	for _, monitor := range monitors {
		if monitor.Position.X == 0 && monitor.Position.Y == 0 {
			return &monitor
		}
	}
	// If no monitor at origin, return the first one
	for _, monitor := range monitors {
		return &monitor
	}
	return nil
}

// CalculateTotalBounds calculates the bounding box of all monitors from a map
func CalculateTotalBounds(monitors Monitors) (x, y, width, height int32) {
	if len(monitors) == 0 {
		return 0, 0, 0, 0
	}

	// Find min/max coordinates
	var minX, minY, maxX, maxY int32
	first := true

	for _, m := range monitors {
		mX := int32(m.Position.X)
		mY := int32(m.Position.Y)
		mW := int32(m.Width)
		mH := int32(m.Height)

		if first {
			minX = mX
			minY = mY
			maxX = mX + mW
			maxY = mY + mH
			first = false
		} else {
			if mX < minX {
				minX = mX
			}
			if mY < minY {
				minY = mY
			}
			if mX+mW > maxX {
				maxX = mX + mW
			}
			if mY+mH > maxY {
				maxY = mY + mH
			}
		}
	}

	return minX, minY, maxX - minX, maxY - minY
}
