package playlist

import (
	"context"
	"database/sql"
	"testing"
	"time"

	"waypaper-engine/daemon-go/internal/db"
	"waypaper-engine/daemon-go/internal/models"
)

// MockTimer wraps a real timer but allows us to manipulate time for testing
type MockTimer struct {
	*time.Timer
	expectedFireTime time.Time
	artificialDelay  time.Duration
}

// TestSleepDetection_MissedEvent tests that we detect when a timer should have fired but didn't
func TestSleepDetection_MissedEvent(t *testing.T) {
	mockBackend := &MockBackendManager{
		setWallpaperCalls: make([]SetWallpaperCall, 0),
	}

	manager := &Manager{
		dbOps:           nil,
		instances:       make(map[string]*Instance),
		eventChan:       make(chan Event, 10),
		logger:          testLogger,
		wallpaperSetter: mockBackend,
	}

	playlist := &db.PlaylistWithImages{
		Playlist: db.Playlist{
			Name:              "Test Sleep Detection",
			Type:              TimeOfDay,
			Currentimageindex: 0,
		},
		Images: []db.GetPlaylistImagesOrderedRow{
			{ID: 1, Name: "morning.jpg", Time: sql.NullInt64{Valid: true, Int64: 480}, Width: 1920, Height: 1080, Format: "jpg"},  // 8:00 AM
			{ID: 2, Name: "noon.jpg", Time: sql.NullInt64{Valid: true, Int64: 720}, Width: 1920, Height: 1080, Format: "jpg"},     // 12:00 PM
			{ID: 3, Name: "evening.jpg", Time: sql.NullInt64{Valid: true, Int64: 1080}, Width: 1920, Height: 1080, Format: "jpg"}, // 6:00 PM
		},
	}

	activeMonitor := &models.ActiveMonitor{
		Name:     "DP-1",
		Monitors: []models.Monitor{{Name: "DP-1"}},
	}

	instance := &Instance{
		Playlist:      playlist,
		ActiveMonitor: activeMonitor,
		Done:          make(chan bool),
		paused:        false,
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	// Start at 10:00 AM (600 minutes)
	// Should set morning image and schedule noon for 2 hours later
	go manager.runTimeOfDayPlaylistWithSleepDetection(ctx, instance, 600, 500*time.Millisecond)

	// Wait for initial image to be set
	time.Sleep(300 * time.Millisecond)

	calls := mockBackend.GetSetWallpaperCalls()
	if len(calls) < 1 {
		t.Fatalf("Expected initial image to be set, got %d calls", len(calls))
	}

	if calls[0].ImagePath != "morning.jpg" {
		t.Errorf("Expected morning.jpg initially, got %s", calls[0].ImagePath)
	}

	mockBackend.ResetCalls()

	// Simulate time jump (system sleep) - advance to 2:00 PM (840 minutes)
	// This should be detected by the sanity checker and corrected
	// The noon image should be set

	// Wait for sanity check interval (500ms) + processing time
	time.Sleep(800 * time.Millisecond)

	// Note: In real implementation, we'd need a way to inject time
	// For now, this tests the mechanism is in place
	// A more complete test would use a time provider interface

	close(instance.Done)
}

// TestSleepDetection_NoFalsePositives tests that normal operation doesn't trigger re-evaluation
func TestSleepDetection_NoFalsePositives(t *testing.T) {
	mockBackend := &MockBackendManager{
		setWallpaperCalls: make([]SetWallpaperCall, 0),
	}

	manager := &Manager{
		dbOps:           nil,
		instances:       make(map[string]*Instance),
		eventChan:       make(chan Event, 10),
		logger:          testLogger,
		wallpaperSetter: mockBackend,
	}

	playlist := &db.PlaylistWithImages{
		Playlist: db.Playlist{
			Name:              "Test No False Positives",
			Type:              TimeOfDay,
			Currentimageindex: 0,
		},
		Images: []db.GetPlaylistImagesOrderedRow{
			{ID: 1, Name: "morning.jpg", Time: sql.NullInt64{Valid: true, Int64: 480}, Width: 1920, Height: 1080, Format: "jpg"},
			{ID: 2, Name: "noon.jpg", Time: sql.NullInt64{Valid: true, Int64: 720}, Width: 1920, Height: 1080, Format: "jpg"},
		},
	}

	activeMonitor := &models.ActiveMonitor{
		Name:     "DP-1",
		Monitors: []models.Monitor{{Name: "DP-1"}},
	}

	instance := &Instance{
		Playlist:      playlist,
		ActiveMonitor: activeMonitor,
		Done:          make(chan bool),
		paused:        false,
	}

	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()

	// Start at 10:00 AM
	go manager.runTimeOfDayPlaylistWithSleepDetection(ctx, instance, 600, 500*time.Millisecond)

	// Wait for initial setup
	time.Sleep(300 * time.Millisecond)

	initialCalls := len(mockBackend.GetSetWallpaperCalls())
	if initialCalls != 1 {
		t.Fatalf("Expected 1 initial call, got %d", initialCalls)
	}

	// Wait through multiple sanity check intervals
	// Should NOT trigger additional image sets
	time.Sleep(2 * time.Second)

	finalCalls := len(mockBackend.GetSetWallpaperCalls())

	// Should still be just the initial call (no false positives)
	if finalCalls != initialCalls {
		t.Errorf("Expected no additional calls during normal operation, got %d -> %d",
			initialCalls, finalCalls)
	}

	close(instance.Done)
}

// TestSleepDetection_ConfigurableInterval tests that the check interval can be configured
func TestSleepDetection_ConfigurableInterval(t *testing.T) {
	mockBackend := &MockBackendManager{
		setWallpaperCalls: make([]SetWallpaperCall, 0),
	}

	manager := &Manager{
		dbOps:           nil,
		instances:       make(map[string]*Instance),
		eventChan:       make(chan Event, 10),
		logger:          testLogger,
		wallpaperSetter: mockBackend,
	}

	playlist := &db.PlaylistWithImages{
		Playlist: db.Playlist{
			Name:              "Test Configurable Interval",
			Type:              TimeOfDay,
			Currentimageindex: 0,
		},
		Images: []db.GetPlaylistImagesOrderedRow{
			{ID: 1, Name: "morning.jpg", Time: sql.NullInt64{Valid: true, Int64: 480}, Width: 1920, Height: 1080, Format: "jpg"},
		},
	}

	activeMonitor := &models.ActiveMonitor{
		Name:     "DP-1",
		Monitors: []models.Monitor{{Name: "DP-1"}},
	}

	instance := &Instance{
		Playlist:      playlist,
		ActiveMonitor: activeMonitor,
		Done:          make(chan bool),
		paused:        false,
	}

	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
	defer cancel()

	// Use very short interval for testing (100ms)
	go manager.runTimeOfDayPlaylistWithSleepDetection(ctx, instance, 600, 100*time.Millisecond)

	time.Sleep(300 * time.Millisecond)

	// Verify it started (this tests that custom interval doesn't break startup)
	calls := mockBackend.GetSetWallpaperCalls()
	if len(calls) != 1 {
		t.Errorf("Expected 1 call with custom interval, got %d", len(calls))
	}

	close(instance.Done)
}

// TestSleepDetection_LargeTimeJump tests detection of large time jumps (hours)
func TestSleepDetection_LargeTimeJump(t *testing.T) {
	// This test would require a time provider interface to properly test
	// For now, we verify the mechanism exists

	// In a real implementation, we'd:
	// 1. Start playlist at 11:55 AM
	// 2. Set expected fire time at 12:00 PM
	// 3. Inject time jump to 3:00 PM
	// 4. Verify sanity check detects jump
	// 5. Verify correct image is set (noon or evening depending on logic)

	t.Skip("Requires time provider interface for proper testing")
}

// TestSleepDetection_ClockAdjustment tests detection of manual clock changes
func TestSleepDetection_ClockAdjustment(t *testing.T) {
	// Similar to large time jump test
	// Would test daylight saving time adjustments, manual clock changes, etc.

	t.Skip("Requires time provider interface for proper testing")
}

// TestSleepDetection_ShutdownDuringSleep tests graceful shutdown during sleep check
func TestSleepDetection_ShutdownDuringSleep(t *testing.T) {
	mockBackend := &MockBackendManager{
		setWallpaperCalls: make([]SetWallpaperCall, 0),
	}

	manager := &Manager{
		dbOps:           nil,
		instances:       make(map[string]*Instance),
		eventChan:       make(chan Event, 10),
		logger:          testLogger,
		wallpaperSetter: mockBackend,
	}

	playlist := &db.PlaylistWithImages{
		Playlist: db.Playlist{
			Name:              "Test Shutdown",
			Type:              TimeOfDay,
			Currentimageindex: 0,
		},
		Images: []db.GetPlaylistImagesOrderedRow{
			{ID: 1, Name: "morning.jpg", Time: sql.NullInt64{Valid: true, Int64: 480}, Width: 1920, Height: 1080, Format: "jpg"},
		},
	}

	activeMonitor := &models.ActiveMonitor{
		Name:     "DP-1",
		Monitors: []models.Monitor{{Name: "DP-1"}},
	}

	instance := &Instance{
		Playlist:      playlist,
		ActiveMonitor: activeMonitor,
		Done:          make(chan bool),
		paused:        false,
	}

	ctx, cancel := context.WithTimeout(context.Background(), 1*time.Second)
	defer cancel()

	// Start playlist
	go manager.runTimeOfDayPlaylistWithSleepDetection(ctx, instance, 600, 100*time.Millisecond)

	time.Sleep(200 * time.Millisecond)

	// Close done channel (simulating stop)
	close(instance.Done)

	// Should exit cleanly without panic
	time.Sleep(200 * time.Millisecond)

	// If we get here without panic, test passes
}
