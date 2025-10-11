package monitor

import (
	"context"
	"encoding/json"
	"runtime"
	"testing"
	"time"

	"waypaper-engine/daemon-go/internal/models"

	"log/slog"

	"github.com/stretchr/testify/assert"
)

// BenchmarkMonitorDetection benchmarks monitor detection performance
func BenchmarkMonitorDetection(b *testing.B) {
	manager := NewManager(nil, slog.Default())

	b.Run("OldImplementation", func(b *testing.B) {
		for i := 0; i < b.N; i++ {
			err := manager.refreshMonitors(context.Background())
			if err != nil {
				b.Fatal(err)
			}
		}
	})

	b.Run("NewImplementation", func(b *testing.B) {
		err := manager.StartWithConfig(context.Background(), "/tmp/images", "/tmp/thumbnails", "/tmp/monitors.json")
		if err != nil {
			b.Skip("Wayland not available for benchmarking")
			return
		}
		defer manager.Stop()

		b.ResetTimer()
		for i := 0; i < b.N; i++ {
			monitors := manager.GetMonitors()
			_ = monitors
		}
	})
}

// BenchmarkMonitorConversion benchmarks conversion between MonitorInfo and models.Monitor
func BenchmarkMonitorConversion(b *testing.B) {
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

	b.Run("MonitorInfoToModel", func(b *testing.B) {
		for i := 0; i < b.N; i++ {
			model := MonitorInfoToModel(info)
			_ = model
		}
	})

	b.Run("ModelToMonitorInfo", func(b *testing.B) {
		model := MonitorInfoToModel(info)
		b.ResetTimer()
		for i := 0; i < b.N; i++ {
			converted := ModelToMonitorInfo(model)
			_ = converted
		}
	})

	b.Run("RoundTripConversion", func(b *testing.B) {
		for i := 0; i < b.N; i++ {
			model := MonitorInfoToModel(info)
			converted := ModelToMonitorInfo(model)
			_ = converted
		}
	})
}

// BenchmarkMonitorNameGeneration benchmarks monitor name generation
func BenchmarkMonitorNameGeneration(b *testing.B) {
	tests := []struct {
		name string
		info MonitorInfo
	}{
		{
			name: "MakeAndModel",
			info: MonitorInfo{
				Make:  "Samsung",
				Model: "U28E590D",
			},
		},
		{
			name: "OnlyMake",
			info: MonitorInfo{
				Make: "Dell",
			},
		},
		{
			name: "ResolutionOnly",
			info: MonitorInfo{
				Width:  1920,
				Height: 1080,
			},
		},
		{
			name: "Empty",
			info: MonitorInfo{},
		},
	}

	for _, tt := range tests {
		b.Run(tt.name, func(b *testing.B) {
			for i := 0; i < b.N; i++ {
				name := generateMonitorName(tt.info)
				_ = name
			}
		})
	}
}

// BenchmarkMonitorEquality benchmarks monitor equality comparison
func BenchmarkMonitorEquality(b *testing.B) {
	monitor1 := MonitorInfo{
		X:         0,
		Y:         0,
		Width:     1920,
		Height:    1080,
		Scale:     1,
		Transform: 0,
	}

	monitor2 := MonitorInfo{
		X:         0,
		Y:         0,
		Width:     1920,
		Height:    1080,
		Scale:     1,
		Transform: 0,
	}

	b.Run("EqualMonitors", func(b *testing.B) {
		for i := 0; i < b.N; i++ {
			equal := monitorsEqual(monitor1, monitor2)
			_ = equal
		}
	})

	monitor3 := MonitorInfo{
		X:         1920,
		Y:         0,
		Width:     2560,
		Height:    1440,
		Scale:     2,
		Transform: 0,
	}

	b.Run("DifferentMonitors", func(b *testing.B) {
		for i := 0; i < b.N; i++ {
			equal := monitorsEqual(monitor1, monitor3)
			_ = equal
		}
	})
}

// BenchmarkMonitorManagerCreation benchmarks MonitorManager creation
func BenchmarkMonitorManagerCreation(b *testing.B) {
	for i := 0; i < b.N; i++ {
		mm, err := NewMonitorManager()
		if err != nil {
			b.Skip("Wayland not available for benchmarking")
			return
		}
		mm.Stop()
	}
}

// BenchmarkMonitorManagerOperations benchmarks MonitorManager operations
func BenchmarkMonitorManagerOperations(b *testing.B) {
	mm, err := NewMonitorManager()
	if err != nil {
		b.Skip("Wayland not available for benchmarking")
		return
	}
	defer mm.Stop()

	b.Run("GetMonitors", func(b *testing.B) {
		for i := 0; i < b.N; i++ {
			monitors := mm.GetMonitors()
			_ = monitors
		}
	})

	b.Run("GetMonitorByName", func(b *testing.B) {
		monitors := mm.GetMonitors()
		if len(monitors) == 0 {
			b.Skip("No monitors available for benchmarking")
			return
		}

		monitorName := monitors[0].Name
		b.ResetTimer()
		for i := 0; i < b.N; i++ {
			monitor, exists := mm.GetMonitorByName(monitorName)
			_ = monitor
			_ = exists
		}
	})
}

// BenchmarkManagerOperations benchmarks Manager operations
func BenchmarkManagerOperations(b *testing.B) {
	manager := NewManager(nil, slog.Default())

	err := manager.StartWithConfig(context.Background(), "/tmp/images", "/tmp/thumbnails", "/tmp/monitors.json")
	if err != nil {
		b.Skip("Wayland not available for benchmarking")
		return
	}
	defer manager.Stop()

	b.Run("GetMonitors", func(b *testing.B) {
		for i := 0; i < b.N; i++ {
			monitors := manager.GetMonitors()
			_ = monitors
		}
	})

	b.Run("GetActiveMonitor", func(b *testing.B) {
		for i := 0; i < b.N; i++ {
			activeMonitor := manager.GetActiveMonitor()
			_ = activeMonitor
		}
	})

	b.Run("GetMonitor", func(b *testing.B) {
		monitors := manager.GetMonitors()
		if len(monitors) == 0 {
			b.Skip("No monitors available for benchmarking")
			return
		}

		monitorName := monitors[0].Name
		b.ResetTimer()
		for i := 0; i < b.N; i++ {
			monitor, exists := manager.GetMonitor(monitorName)
			_ = monitor
			_ = exists
		}
	})
}

// TestMemoryUsage tests memory usage of the new implementation
func TestMemoryUsage(t *testing.T) {
	if !isWaylandAvailable() {
		t.Skip("Wayland not available for testing")
		return
	}

	manager := NewManager(nil, slog.Default())

	err := manager.StartWithConfig(context.Background(), "/tmp/images", "/tmp/thumbnails", "/tmp/monitors.json")
	assert.NoError(t, err)

	var m runtime.MemStats
	runtime.ReadMemStats(&m)
	initialAlloc := m.Alloc

	// Run some operations
	for i := 0; i < 100; i++ {
		monitors := manager.GetMonitors()
		_ = monitors
	}

	runtime.ReadMemStats(&m)
	finalAlloc := m.Alloc

	// Verify no significant memory leak
	memoryIncrease := finalAlloc - initialAlloc
	assert.Less(t, memoryIncrease, uint64(1024*1024)) // Less than 1MB increase

	manager.Stop()
}

// TestScalability tests performance with different numbers of monitors
func TestScalability(t *testing.T) {
	if !isWaylandAvailable() {
		t.Skip("Wayland not available for testing")
		return
	}

	manager := NewManager(nil, slog.Default())

	// Test performance with current monitor setup
	start := time.Now()
	err := manager.StartWithConfig(context.Background(), "/tmp/images", "/tmp/thumbnails", "/tmp/monitors.json")
	duration := time.Since(start)

	assert.NoError(t, err)
	assert.Less(t, duration, 5*time.Second) // Should start within 5 seconds

	// Test getting monitors multiple times
	start = time.Now()
	for i := 0; i < 100; i++ {
		monitors := manager.GetMonitors()
		_ = monitors
	}
	duration = time.Since(start)

	assert.Less(t, duration, 1*time.Second) // Should complete within 1 second

	manager.Stop()
}

// BenchmarkEventSystem benchmarks the event system performance
func BenchmarkEventSystem(b *testing.B) {
	mm, err := NewMonitorManager()
	if err != nil {
		b.Skip("Wayland not available for benchmarking")
		return
	}
	defer mm.Stop()

	// Start monitoring
	mm.Start()
	defer mm.Stop()

	b.Run("EventChannelRead", func(b *testing.B) {
		events := mm.Events()
		b.ResetTimer()
		for i := 0; i < b.N; i++ {
			select {
			case event := <-events:
				_ = event
			case <-time.After(1 * time.Millisecond):
				// Timeout to prevent blocking
			}
		}
	})
}

// BenchmarkJSONSerialization benchmarks JSON serialization/deserialization
func BenchmarkJSONSerialization(b *testing.B) {
	monitor := models.Monitor{
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
		CurrentImage:   "wallpaper1.jpg",
		Position:       models.Position{X: 0, Y: 0},
	}

	b.Run("Marshal", func(b *testing.B) {
		for i := 0; i < b.N; i++ {
			data, err := json.Marshal(monitor)
			if err != nil {
				b.Fatal(err)
			}
			_ = data
		}
	})

	b.Run("Unmarshal", func(b *testing.B) {
		data, err := json.Marshal(monitor)
		if err != nil {
			b.Fatal(err)
		}

		b.ResetTimer()
		for i := 0; i < b.N; i++ {
			var m models.Monitor
			err := json.Unmarshal(data, &m)
			if err != nil {
				b.Fatal(err)
			}
		}
	})

	b.Run("RoundTrip", func(b *testing.B) {
		for i := 0; i < b.N; i++ {
			data, err := json.Marshal(monitor)
			if err != nil {
				b.Fatal(err)
			}

			var m models.Monitor
			err = json.Unmarshal(data, &m)
			if err != nil {
				b.Fatal(err)
			}
		}
	})
}
