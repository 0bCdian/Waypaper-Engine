package monitor

import (
	"encoding/json"
	"testing"
	"time"

	"waypaper-engine/daemon-go/internal/models"

	"github.com/stretchr/testify/assert"
)

// TestMonitorBackwardCompatibility tests that old JSON format still works
func TestMonitorBackwardCompatibility(t *testing.T) {
	// Test old JSON format still works
	oldJSON := `{"name":"HDMI-A-1","width":1920,"height":1080,"currentImage":"","position":{"x":0,"y":0}}`
	var monitor models.Monitor
	err := json.Unmarshal([]byte(oldJSON), &monitor)
	assert.NoError(t, err)
	assert.Equal(t, "HDMI-A-1", monitor.Name)
	assert.Equal(t, 1920, monitor.Width)
	assert.Equal(t, 1080, monitor.Height)
	assert.Equal(t, "", monitor.CurrentImage)
	assert.Equal(t, 0, monitor.Position.X)
	assert.Equal(t, 0, monitor.Position.Y)
}

// TestMonitorNewFormat tests that new JSON format with additional fields works
func TestMonitorNewFormat(t *testing.T) {
	newJSON := `{
		"name":"HDMI-A-1",
		"make":"Samsung",
		"model":"U28E590D",
		"width":1920,
		"height":1080,
		"refreshRate":60.0,
		"scale":1,
		"transform":0,
		"physicalWidth":620,
		"physicalHeight":340,
		"currentImage":"",
		"position":{"x":0,"y":0}
	}`
	var monitor models.Monitor
	err := json.Unmarshal([]byte(newJSON), &monitor)
	assert.NoError(t, err)
	assert.Equal(t, "HDMI-A-1", monitor.Name)
	assert.Equal(t, "Samsung", monitor.Make)
	assert.Equal(t, "U28E590D", monitor.Model)
	assert.Equal(t, 1920, monitor.Width)
	assert.Equal(t, 1080, monitor.Height)
	assert.Equal(t, 60.0, monitor.RefreshRate)
	assert.Equal(t, int32(1), monitor.Scale)
	assert.Equal(t, int32(0), monitor.Transform)
	assert.Equal(t, int32(620), monitor.PhysicalWidth)
	assert.Equal(t, int32(340), monitor.PhysicalHeight)
}

// TestMonitorInfoToModel tests conversion from MonitorInfo to models.Monitor
func TestMonitorInfoToModel(t *testing.T) {
	info := MonitorInfo{
		Name:           "HDMI-A-1",
		Make:           "Samsung",
		Model:          "U28E590D",
		Width:          1920,
		Height:         1080,
		RefreshRate:    60.0,
		Scale:          1,
		Transform:      0,
		PhysicalWidth:  620,
		PhysicalHeight: 340,
		X:              0,
		Y:              0,
	}

	model := MonitorInfoToModel(info)

	assert.Equal(t, "HDMI-A-1", model.Name)
	assert.Equal(t, "Samsung", model.Make)
	assert.Equal(t, "U28E590D", model.Model)
	assert.Equal(t, 1920, model.Width)
	assert.Equal(t, 1080, model.Height)
	assert.Equal(t, 60.0, model.RefreshRate)
	assert.Equal(t, int32(1), model.Scale)
	assert.Equal(t, int32(0), model.Transform)
	assert.Equal(t, int32(620), model.PhysicalWidth)
	assert.Equal(t, int32(340), model.PhysicalHeight)
	assert.Equal(t, 0, model.Position.X)
	assert.Equal(t, 0, model.Position.Y)
}

// TestModelToMonitorInfo tests conversion from models.Monitor to MonitorInfo
func TestModelToMonitorInfo(t *testing.T) {
	model := models.Monitor{
		Name:           "HDMI-A-1",
		Make:           "Samsung",
		Model:          "U28E590D",
		Width:          1920,
		Height:         1080,
		RefreshRate:    60.0,
		Scale:          1,
		Transform:      0,
		PhysicalWidth:  620,
		PhysicalHeight: 340,
		Position:       models.Position{X: 0, Y: 0},
	}

	info := ModelToMonitorInfo(model)

	assert.Equal(t, "HDMI-A-1", info.Name)
	assert.Equal(t, "Samsung", info.Make)
	assert.Equal(t, "U28E590D", info.Model)
	assert.Equal(t, int32(1920), info.Width)
	assert.Equal(t, int32(1080), info.Height)
	assert.Equal(t, 60.0, info.RefreshRate)
	assert.Equal(t, int32(1), info.Scale)
	assert.Equal(t, int32(0), info.Transform)
	assert.Equal(t, int32(620), info.PhysicalWidth)
	assert.Equal(t, int32(340), info.PhysicalHeight)
	assert.Equal(t, int32(0), info.X)
	assert.Equal(t, int32(0), info.Y)
}

// TestRoundTripConversion tests that conversion is reversible
func TestRoundTripConversion(t *testing.T) {
	original := MonitorInfo{
		Name:           "DP-1",
		Make:           "Dell",
		Model:          "U2720Q",
		Width:          2560,
		Height:         1440,
		RefreshRate:    60.0,
		Scale:          2,
		Transform:      0,
		PhysicalWidth:  597,
		PhysicalHeight: 336,
		X:              1920,
		Y:              0,
	}

	model := MonitorInfoToModel(original)
	converted := ModelToMonitorInfo(model)

	assert.Equal(t, original, converted)
}

// TestMonitorNameGeneration tests the enhanced monitor name generation
func TestMonitorNameGeneration(t *testing.T) {
	tests := []struct {
		name     string
		info     MonitorInfo
		expected string
	}{
		{
			name: "Make and model available",
			info: MonitorInfo{
				Make:  "Samsung",
				Model: "U28E590D",
			},
			expected: "Samsung U28E590D",
		},
		{
			name: "Only make available",
			info: MonitorInfo{
				Make: "Dell",
			},
			expected: "Dell Monitor",
		},
		{
			name: "No make/model",
			info: MonitorInfo{
				Width:  1920,
				Height: 1080,
			},
			expected: "Monitor-1920x1080",
		},
		{
			name: "Empty make/model",
			info: MonitorInfo{
				Make:   "",
				Model:  "",
				Width:  2560,
				Height: 1440,
			},
			expected: "Monitor-2560x1440",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := generateMonitorName(tt.info)
			assert.Equal(t, tt.expected, result)
		})
	}
}

// TestMonitorNameUniqueness tests handling of duplicate names
func TestMonitorNameUniqueness(t *testing.T) {
	// Test handling of duplicate names
	info1 := MonitorInfo{Make: "Samsung", Model: "U28E590D"}
	info2 := MonitorInfo{Make: "Samsung", Model: "U28E590D"}

	name1 := generateMonitorName(info1)
	name2 := generateMonitorName(info2)

	// Current implementation returns the same name for identical info
	// This test verifies the basic functionality works
	assert.Equal(t, "Samsung U28E590D", name1)
	assert.Equal(t, "Samsung U28E590D", name2)

	// Test the unique name generation function
	existingNames := map[string]bool{
		"Samsung U28E590D": true,
	}

	uniqueName := generateUniqueMonitorName(info2, existingNames)
	assert.NotEqual(t, "Samsung U28E590D", uniqueName)
	assert.Equal(t, "Samsung U28E590D-1", uniqueName)
}

// TestMonitorsEqual tests the monitor equality comparison
func TestMonitorsEqual(t *testing.T) {
	tests := []struct {
		name     string
		a        MonitorInfo
		b        MonitorInfo
		expected bool
	}{
		{
			name: "Identical monitors",
			a: MonitorInfo{
				X:         0,
				Y:         0,
				Width:     1920,
				Height:    1080,
				Scale:     1,
				Transform: 0,
			},
			b: MonitorInfo{
				X:         0,
				Y:         0,
				Width:     1920,
				Height:    1080,
				Scale:     1,
				Transform: 0,
			},
			expected: true,
		},
		{
			name: "Different position",
			a: MonitorInfo{
				X:         0,
				Y:         0,
				Width:     1920,
				Height:    1080,
				Scale:     1,
				Transform: 0,
			},
			b: MonitorInfo{
				X:         1920,
				Y:         0,
				Width:     1920,
				Height:    1080,
				Scale:     1,
				Transform: 0,
			},
			expected: false,
		},
		{
			name: "Different resolution",
			a: MonitorInfo{
				X:         0,
				Y:         0,
				Width:     1920,
				Height:    1080,
				Scale:     1,
				Transform: 0,
			},
			b: MonitorInfo{
				X:         0,
				Y:         0,
				Width:     2560,
				Height:    1440,
				Scale:     1,
				Transform: 0,
			},
			expected: false,
		},
		{
			name: "Different scale",
			a: MonitorInfo{
				X:         0,
				Y:         0,
				Width:     1920,
				Height:    1080,
				Scale:     1,
				Transform: 0,
			},
			b: MonitorInfo{
				X:         0,
				Y:         0,
				Width:     1920,
				Height:    1080,
				Scale:     2,
				Transform: 0,
			},
			expected: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := monitorsEqual(tt.a, tt.b)
			assert.Equal(t, tt.expected, result)
		})
	}
}

// TestMonitorEventTypes tests the monitor event type string conversion
func TestMonitorEventTypes(t *testing.T) {
	tests := []struct {
		eventType MonitorEventType
		expected  string
	}{
		{MonitorAdded, "Added"},
		{MonitorRemoved, "Removed"},
		{MonitorChanged, "Changed"},
		{MonitorEventType(999), "Unknown"},
	}

	for _, tt := range tests {
		t.Run(tt.expected, func(t *testing.T) {
			result := tt.eventType.String()
			assert.Equal(t, tt.expected, result)
		})
	}
}

// TestMonitorManagerCreation tests creating a new MonitorManager
func TestMonitorManagerCreation(t *testing.T) {
	// This test might fail if Wayland is not available
	// In a real test environment, we'd mock the Wayland connection
	mm, err := NewMonitorManager()
	if err != nil {
		t.Skip("Wayland not available for testing")
		return
	}

	assert.NotNil(t, mm)
	assert.NotNil(t, mm.Events())

	// Test that we can get monitors
	monitors := mm.GetMonitors()
	assert.NotNil(t, monitors)

	// Clean up
	mm.Stop()
}

// TestMonitorManagerEvents tests the event system
func TestMonitorManagerEvents(t *testing.T) {
	mm, err := NewMonitorManager()
	if err != nil {
		t.Skip("Wayland not available for testing")
		return
	}
	defer mm.Stop()

	// Test that events channel is available
	events := mm.Events()
	assert.NotNil(t, events)

	// Test that we can get monitors
	monitors := mm.GetMonitors()
	assert.NotNil(t, monitors)

	// Test GetMonitorByName
	if len(monitors) > 0 {
		firstMonitor := monitors[0]
		foundMonitor, exists := mm.GetMonitorByName(firstMonitor.Name)
		assert.True(t, exists)
		assert.Equal(t, firstMonitor.Name, foundMonitor.Name)
	}
}

// TestMonitorManagerPollRate tests changing the poll rate
func TestMonitorManagerPollRate(t *testing.T) {
	mm, err := NewMonitorManager()
	if err != nil {
		t.Skip("Wayland not available for testing")
		return
	}
	defer mm.Stop()

	// Test setting poll rate
	newRate := 1 * time.Second
	mm.SetPollRate(newRate)

	// Start monitoring
	mm.Start()

	// Give it a moment to start
	time.Sleep(100 * time.Millisecond)

	// Stop monitoring
	mm.Stop()
}

// TestGetPrimaryMonitor tests finding the primary monitor
func TestGetPrimaryMonitor(t *testing.T) {
	tests := []struct {
		name     string
		monitors []MonitorInfo
		expected *MonitorInfo
	}{
		{
			name: "Monitor at origin",
			monitors: []MonitorInfo{
				{X: 0, Y: 0, Width: 1920, Height: 1080},
				{X: 1920, Y: 0, Width: 2560, Height: 1440},
			},
			expected: &MonitorInfo{X: 0, Y: 0, Width: 1920, Height: 1080},
		},
		{
			name: "No monitor at origin",
			monitors: []MonitorInfo{
				{X: 1920, Y: 0, Width: 2560, Height: 1440},
				{X: 0, Y: 1080, Width: 1920, Height: 1080},
			},
			expected: &MonitorInfo{X: 1920, Y: 0, Width: 2560, Height: 1440},
		},
		{
			name:     "Empty monitors",
			monitors: []MonitorInfo{},
			expected: nil,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := GetPrimaryMonitor(tt.monitors)
			if tt.expected == nil {
				assert.Nil(t, result)
			} else {
				assert.NotNil(t, result)
				assert.Equal(t, *tt.expected, *result)
			}
		})
	}
}

// TestCalculateTotalBounds tests calculating the bounding box of all monitors
func TestCalculateTotalBounds(t *testing.T) {
	tests := []struct {
		name           string
		monitors       []MonitorInfo
		expectedX      int32
		expectedY      int32
		expectedWidth  int32
		expectedHeight int32
	}{
		{
			name: "Single monitor",
			monitors: []MonitorInfo{
				{X: 0, Y: 0, Width: 1920, Height: 1080},
			},
			expectedX:      0,
			expectedY:      0,
			expectedWidth:  1920,
			expectedHeight: 1080,
		},
		{
			name: "Two monitors side by side",
			monitors: []MonitorInfo{
				{X: 0, Y: 0, Width: 1920, Height: 1080},
				{X: 1920, Y: 0, Width: 2560, Height: 1440},
			},
			expectedX:      0,
			expectedY:      0,
			expectedWidth:  4480,
			expectedHeight: 1440,
		},
		{
			name: "Monitors with negative positions",
			monitors: []MonitorInfo{
				{X: -1920, Y: 0, Width: 1920, Height: 1080},
				{X: 0, Y: 0, Width: 1920, Height: 1080},
			},
			expectedX:      -1920,
			expectedY:      0,
			expectedWidth:  3840,
			expectedHeight: 1080,
		},
		{
			name:           "Empty monitors",
			monitors:       []MonitorInfo{},
			expectedX:      0,
			expectedY:      0,
			expectedWidth:  0,
			expectedHeight: 0,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			x, y, width, height := CalculateTotalBounds(tt.monitors)
			assert.Equal(t, tt.expectedX, x)
			assert.Equal(t, tt.expectedY, y)
			assert.Equal(t, tt.expectedWidth, width)
			assert.Equal(t, tt.expectedHeight, height)
		})
	}
}
