package monitor

import (
	"context"
	"os"
	"testing"
	"time"

	"waypaper-engine/daemon-go/internal/models"

	"log/slog"

	"github.com/stretchr/testify/assert"
)

// TestManagerWithWayland tests the manager with Wayland integration
func TestManagerWithWayland(t *testing.T) {
	// Skip if Wayland is not available
	if !isWaylandAvailable() {
		t.Skip("Wayland not available for testing")
		return
	}

	manager := NewManager(nil, slog.Default())

	// Test initialization
	err := manager.StartWithConfig(context.Background(), "/tmp/images", "/tmp/thumbnails", "/tmp/monitors.json")
	assert.NoError(t, err)

	// Test monitor retrieval
	monitors := manager.GetMonitors()
	assert.NotNil(t, monitors)

	// Test cleanup
	manager.Stop()
}

// TestManagerEventHandling tests the event handling system
func TestManagerEventHandling(t *testing.T) {
	if !isWaylandAvailable() {
		t.Skip("Wayland not available for testing")
		return
	}

	manager := NewManager(nil, slog.Default())

	var receivedEvents []MonitorEvent
	manager.SetEventCallback(func(event MonitorEvent) {
		receivedEvents = append(receivedEvents, event)
	})

	err := manager.StartWithConfig(context.Background(), "/tmp/images", "/tmp/thumbnails", "/tmp/monitors.json")
	assert.NoError(t, err)

	// Wait for initial events
	time.Sleep(100 * time.Millisecond)

	// Verify we can get monitors
	monitors := manager.GetMonitors()
	assert.NotNil(t, monitors)

	manager.Stop()
}

// TestManagerFallback tests the fallback mechanism
func TestManagerFallback(t *testing.T) {
	manager := NewManager(nil, slog.Default())

	// Test fallback when Wayland is not available
	err := manager.StartWithConfig(context.Background(), "/tmp/images", "/tmp/thumbnails", "/tmp/monitors.json")
	assert.NoError(t, err)

	monitors := manager.GetMonitors()
	assert.NotNil(t, monitors)

	manager.Stop()
}

// TestEventDrivenUpdates tests that updates are event-driven
func TestEventDrivenUpdates(t *testing.T) {
	if !isWaylandAvailable() {
		t.Skip("Wayland not available for testing")
		return
	}

	manager := NewManager(nil, slog.Default())

	var updateCount int
	manager.SetChangeCallback(func(monitors []models.Monitor) {
		updateCount++
	})

	err := manager.StartWithConfig(context.Background(), "/tmp/images", "/tmp/thumbnails", "/tmp/monitors.json")
	assert.NoError(t, err)

	// Wait for initial update
	time.Sleep(100 * time.Millisecond)
	assert.Greater(t, updateCount, 0)

	manager.Stop()
}

// TestManagerActiveMonitor tests active monitor functionality
func TestManagerActiveMonitor(t *testing.T) {
	manager := NewManager(nil, slog.Default())

	err := manager.StartWithConfig(context.Background(), "/tmp/images", "/tmp/thumbnails", "/tmp/monitors.json")
	if err != nil {
		t.Skip("Wayland not available for testing")
		return
	}

	// Get monitors
	monitors := manager.GetMonitors()
	if len(monitors) == 0 {
		t.Skip("No monitors available for testing")
		return
	}

	// Test setting active monitor
	testActiveMonitor := &models.ActiveMonitor{
		Name:                 "Test Setup",
		Monitors:             monitors,
		ExtendAcrossMonitors: false,
	}

	err = manager.SetActiveMonitor(testActiveMonitor)
	assert.NoError(t, err)

	// Test getting active monitor
	activeMonitor := manager.GetActiveMonitor()
	assert.NotNil(t, activeMonitor)
	assert.Equal(t, "Test Setup", activeMonitor.Name)
	assert.Equal(t, len(monitors), len(activeMonitor.Monitors))

	manager.Stop()
}

// TestManagerWallpaperSetting tests wallpaper setting functionality
func TestManagerWallpaperSetting(t *testing.T) {
	manager := NewManager(nil, slog.Default())

	err := manager.StartWithConfig(context.Background(), "/tmp/images", "/tmp/thumbnails", "/tmp/monitors.json")
	if err != nil {
		t.Skip("Wayland not available for testing")
		return
	}

	monitors := manager.GetMonitors()
	if len(monitors) == 0 {
		t.Skip("No monitors available for testing")
		return
	}

	// Create a test image file
	testImagePath := "/tmp/test_wallpaper.jpg"
	testImageData := []byte("fake image data")
	err = os.WriteFile(testImagePath, testImageData, 0644)
	assert.NoError(t, err)
	defer os.Remove(testImagePath)

	// Test setting wallpaper on first monitor
	firstMonitor := monitors[0]
	err = manager.SetWallpaper(firstMonitor.Name, testImagePath)
	assert.NoError(t, err)

	// Verify monitor state was updated
	updatedMonitor, exists := manager.GetMonitor(firstMonitor.Name)
	assert.True(t, exists)
	assert.Equal(t, testImagePath, updatedMonitor.CurrentImage)

	manager.Stop()
}

// TestManagerWallpaperAll tests setting wallpaper on all monitors
func TestManagerWallpaperAll(t *testing.T) {
	manager := NewManager(nil, slog.Default())

	err := manager.StartWithConfig(context.Background(), "/tmp/images", "/tmp/thumbnails", "/tmp/monitors.json")
	if err != nil {
		t.Skip("Wayland not available for testing")
		return
	}

	monitors := manager.GetMonitors()
	if len(monitors) == 0 {
		t.Skip("No monitors available for testing")
		return
	}

	// Create a test image file
	testImagePath := "/tmp/test_wallpaper_all.jpg"
	testImageData := []byte("fake image data")
	err = os.WriteFile(testImagePath, testImageData, 0644)
	assert.NoError(t, err)
	defer os.Remove(testImagePath)

	// Test setting wallpaper on all monitors
	err = manager.SetWallpaperAll(testImagePath)
	assert.NoError(t, err)

	// Verify all monitors were updated
	for _, monitor := range monitors {
		updatedMonitor, exists := manager.GetMonitor(monitor.Name)
		assert.True(t, exists)
		assert.Equal(t, testImagePath, updatedMonitor.CurrentImage)
	}

	manager.Stop()
}

// TestManagerMonitorStatePersistence tests monitor state persistence
func TestManagerMonitorStatePersistence(t *testing.T) {
	manager := NewManager(nil, slog.Default())

	err := manager.StartWithConfig(context.Background(), "/tmp/images", "/tmp/thumbnails", "/tmp/monitors.json")
	if err != nil {
		t.Skip("Wayland not available for testing")
		return
	}

	monitors := manager.GetMonitors()
	if len(monitors) == 0 {
		t.Skip("No monitors available for testing")
		return
	}

	// Set wallpaper on first monitor
	firstMonitor := monitors[0]
	testImagePath := "/tmp/test_persistence.jpg"
	testImageData := []byte("fake image data")
	err = os.WriteFile(testImagePath, testImageData, 0644)
	assert.NoError(t, err)
	defer os.Remove(testImagePath)

	err = manager.SetWallpaper(firstMonitor.Name, testImagePath)
	assert.NoError(t, err)

	// Test persistence
	err = manager.PersistCurrentWallpaperState(context.Background())
	assert.NoError(t, err)

	manager.Stop()
}

// TestManagerMonitorStateLoading tests loading monitor state
func TestManagerMonitorStateLoading(t *testing.T) {
	manager := NewManager(nil, slog.Default())

	err := manager.StartWithConfig(context.Background(), "/tmp/images", "/tmp/thumbnails", "/tmp/monitors.json")
	if err != nil {
		t.Skip("Wayland not available for testing")
		return
	}

	// Test loading monitor state
	err = manager.LoadMonitorState()
	assert.NoError(t, err)

	manager.Stop()
}

// TestManagerRestoreLastWallpapers tests wallpaper restoration
func TestManagerRestoreLastWallpapers(t *testing.T) {
	manager := NewManager(nil, slog.Default())

	err := manager.StartWithConfig(context.Background(), "/tmp/images", "/tmp/thumbnails", "/tmp/monitors.json")
	if err != nil {
		t.Skip("Wayland not available for testing")
		return
	}

	// Test restoring last wallpapers
	err = manager.RestoreLastWallpapers(context.Background(), "/tmp/images")
	assert.NoError(t, err)

	manager.Stop()
}

// TestManagerGetMonitorImagePath tests getting monitor-specific image paths
func TestManagerGetMonitorImagePath(t *testing.T) {
	manager := NewManager(nil, slog.Default())

	// Use a clean state file for this test
	cleanStateFile := "/tmp/clean_monitors.json"
	err := manager.StartWithConfig(context.Background(), "/tmp/images", "/tmp/thumbnails", cleanStateFile)
	if err != nil {
		t.Skip("Wayland not available for testing")
		return
	}

	monitors := manager.GetMonitors()
	if len(monitors) == 0 {
		t.Skip("No monitors available for testing")
		return
	}

	// Test getting monitor image path
	firstMonitor := monitors[0]
	imagePath, err := manager.GetMonitorImagePath(firstMonitor.Name)
	assert.NoError(t, err)
	assert.Empty(t, imagePath) // Should be empty if no image is set

	manager.Stop()

	// Clean up the test file
	os.Remove(cleanStateFile)
}

// Helper function to check if Wayland is available
func isWaylandAvailable() bool {
	// Check if WAYLAND_DISPLAY is set
	if os.Getenv("WAYLAND_DISPLAY") != "" {
		return true
	}

	// Check if we're in a Wayland session
	if os.Getenv("XDG_SESSION_TYPE") == "wayland" {
		return true
	}

	return false
}

// TestManagerErrorHandling tests error handling
func TestManagerErrorHandling(t *testing.T) {
	manager := NewManager(nil, slog.Default())

	// Test error handling for non-existent monitor
	err := manager.SetWallpaper("NonExistentMonitor", "/tmp/test.jpg")
	assert.Error(t, err)

	// Test error handling for non-existent image path
	monitors := manager.GetMonitors()
	if len(monitors) > 0 {
		err = manager.SetWallpaper(monitors[0].Name, "/non/existent/path.jpg")
		assert.Error(t, err)
	}
}

// TestManagerConcurrency tests concurrent access to manager
func TestManagerConcurrency(t *testing.T) {
	manager := NewManager(nil, slog.Default())

	err := manager.StartWithConfig(context.Background(), "/tmp/images", "/tmp/thumbnails", "/tmp/monitors.json")
	if err != nil {
		t.Skip("Wayland not available for testing")
		return
	}

	// Test concurrent access
	done := make(chan bool, 10)

	for i := 0; i < 10; i++ {
		go func() {
			monitors := manager.GetMonitors()
			_ = monitors
			done <- true
		}()
	}

	// Wait for all goroutines to complete
	for i := 0; i < 10; i++ {
		<-done
	}

	manager.Stop()
}
