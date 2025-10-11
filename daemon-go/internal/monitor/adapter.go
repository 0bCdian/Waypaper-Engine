package monitor

import (
	"fmt"
	"waypaper-engine/daemon-go/internal/models"
)

// MonitorInfoToModel converts MonitorInfo to models.Monitor
func MonitorInfoToModel(info MonitorInfo) models.Monitor {
	return models.Monitor{
		Name:           info.Name,
		Make:           info.Make,
		Model:          info.Model,
		Width:          int(info.Width),
		Height:         int(info.Height),
		RefreshRate:    info.RefreshRate,
		Scale:          info.Scale,
		Transform:      info.Transform,
		PhysicalWidth:  info.PhysicalWidth,
		PhysicalHeight: info.PhysicalHeight,
		Position:       models.Position{X: int(info.X), Y: int(info.Y)},
	}
}

// ModelToMonitorInfo converts models.Monitor to MonitorInfo
func ModelToMonitorInfo(model models.Monitor) MonitorInfo {
	return MonitorInfo{
		Name:           model.Name,
		Make:           model.Make,
		Model:          model.Model,
		Width:          int32(model.Width),
		Height:         int32(model.Height),
		RefreshRate:    model.RefreshRate,
		Scale:          model.Scale,
		Transform:      model.Transform,
		PhysicalWidth:  model.PhysicalWidth,
		PhysicalHeight: model.PhysicalHeight,
		X:              int32(model.Position.X),
		Y:              int32(model.Position.Y),
	}
}

// generateMonitorName creates a monitor name using make/model or fallback strategies
func generateMonitorName(info MonitorInfo) string {
	// Strategy 1: Use make and model if both available
	if info.Make != "" && info.Model != "" {
		return info.Make + " " + info.Model
	}

	// Strategy 2: Use make only if available
	if info.Make != "" {
		return info.Make + " Monitor"
	}

	// Strategy 3: Use model only if available
	if info.Model != "" {
		return info.Model + " Monitor"
	}

	// Strategy 4: Fallback to resolution-based naming
	if info.Width > 0 && info.Height > 0 {
		return fmt.Sprintf("Monitor-%dx%d", info.Width, info.Height)
	}

	// Strategy 5: Generic fallback
	return "Unknown Monitor"
}

// Enhanced monitor name generation with uniqueness handling
func generateUniqueMonitorName(info MonitorInfo, existingNames map[string]bool) string {
	baseName := generateMonitorName(info)

	// If name is unique, return it
	if !existingNames[baseName] {
		return baseName
	}

	// Add suffix to make it unique
	suffix := 1
	for {
		uniqueName := fmt.Sprintf("%s-%d", baseName, suffix)
		if !existingNames[uniqueName] {
			return uniqueName
		}
		suffix++
	}
}
