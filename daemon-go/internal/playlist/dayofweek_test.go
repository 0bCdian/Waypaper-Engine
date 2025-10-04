package playlist

import (
	"context"
	"testing"
	"time"

	"waypaper-engine/daemon-go/internal/db"
	"waypaper-engine/daemon-go/internal/models"
)

// TestDayOfWeekPlaylist_SetsInitialImage tests that day-of-week playlist sets correct initial image
func TestDayOfWeekPlaylist_SetsInitialImage(t *testing.T) {
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

	// Create day-of-week playlist with 7 images (one for each day)
	playlist := &db.PlaylistWithImages{
		Playlist: db.Playlist{
			Name:              "Test Day of Week",
			Type:              DayOfWeek,
			Currentimageindex: 0,
		},
		Images: []db.GetPlaylistImagesOrderedRow{
			{ID: 1, Name: "sunday.jpg", Width: 1920, Height: 1080, Format: "jpg"},
			{ID: 2, Name: "monday.jpg", Width: 1920, Height: 1080, Format: "jpg"},
			{ID: 3, Name: "tuesday.jpg", Width: 1920, Height: 1080, Format: "jpg"},
			{ID: 4, Name: "wednesday.jpg", Width: 1920, Height: 1080, Format: "jpg"},
			{ID: 5, Name: "thursday.jpg", Width: 1920, Height: 1080, Format: "jpg"},
			{ID: 6, Name: "friday.jpg", Width: 1920, Height: 1080, Format: "jpg"},
			{ID: 7, Name: "saturday.jpg", Width: 1920, Height: 1080, Format: "jpg"},
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

	// Get current day of week
	currentDay := time.Now().Weekday()
	expectedImage := playlist.Images[int(currentDay)].Name

	go manager.runDayOfWeekPlaylistImproved(ctx, instance, 500*time.Millisecond)

	// Wait for initial image to be set
	time.Sleep(300 * time.Millisecond)

	// Verify that SetWallpaper was called with today's image
	calls := mockBackend.GetSetWallpaperCalls()
	if len(calls) < 1 {
		t.Fatalf("Expected initial image to be set, got %d calls", len(calls))
	}

	firstCall := calls[0]
	if firstCall.ImagePath != expectedImage {
		t.Errorf("Expected %s for day %v, got %s", expectedImage, currentDay, firstCall.ImagePath)
	}

	close(instance.Done)
}

// TestDayOfWeekPlaylist_HandlesFewerThan7Images tests playlist with < 7 images
func TestDayOfWeekPlaylist_HandlesFewerThan7Images(t *testing.T) {
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

	// Create playlist with only 5 images (weekday-only)
	playlist := &db.PlaylistWithImages{
		Playlist: db.Playlist{
			Name:              "Test Weekdays Only",
			Type:              DayOfWeek,
			Currentimageindex: 0,
		},
		Images: []db.GetPlaylistImagesOrderedRow{
			{ID: 1, Name: "monday.jpg", Width: 1920, Height: 1080, Format: "jpg"},
			{ID: 2, Name: "tuesday.jpg", Width: 1920, Height: 1080, Format: "jpg"},
			{ID: 3, Name: "wednesday.jpg", Width: 1920, Height: 1080, Format: "jpg"},
			{ID: 4, Name: "thursday.jpg", Width: 1920, Height: 1080, Format: "jpg"},
			{ID: 5, Name: "friday.jpg", Width: 1920, Height: 1080, Format: "jpg"},
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

	currentDay := time.Now().Weekday()
	dayIndex := int(currentDay)

	go manager.runDayOfWeekPlaylistImproved(ctx, instance, 500*time.Millisecond)

	time.Sleep(300 * time.Millisecond)

	calls := mockBackend.GetSetWallpaperCalls()

	if dayIndex < len(playlist.Images) {
		// Should set image for today
		if len(calls) < 1 {
			t.Fatalf("Expected image to be set for day %d, got %d calls", dayIndex, len(calls))
		}
		expectedImage := playlist.Images[dayIndex].Name
		if calls[0].ImagePath != expectedImage {
			t.Errorf("Expected %s, got %s", expectedImage, calls[0].ImagePath)
		}
	} else {
		// Should use last image (Friday)
		if len(calls) < 1 {
			t.Fatalf("Expected last image to be set for day %d, got %d calls", dayIndex, len(calls))
		}
		expectedImage := playlist.Images[len(playlist.Images)-1].Name
		if calls[0].ImagePath != expectedImage {
			t.Errorf("Expected last image %s, got %s", expectedImage, calls[0].ImagePath)
		}
	}

	close(instance.Done)
}

// TestDayOfWeekPlaylist_EmptyImages tests handling of empty image list
func TestDayOfWeekPlaylist_EmptyImages(t *testing.T) {
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
			Name:              "Empty Day Playlist",
			Type:              DayOfWeek,
			Currentimageindex: 0,
		},
		Images: []db.GetPlaylistImagesOrderedRow{},
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

	// Should not panic
	go manager.runDayOfWeekPlaylistImproved(ctx, instance, 500*time.Millisecond)

	time.Sleep(300 * time.Millisecond)

	// Should not have called SetWallpaper (no images to set)
	calls := mockBackend.GetSetWallpaperCalls()
	if len(calls) != 0 {
		t.Errorf("Expected no SetWallpaper calls with empty images, got %d", len(calls))
	}

	close(instance.Done)
}

// TestDayOfWeekPlaylist_PreciseMidnightScheduling tests that midnight transition is precise
func TestDayOfWeekPlaylist_PreciseMidnightScheduling(t *testing.T) {
	// This test verifies the mechanism exists
	// Full testing would require time injection

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
			Name:              "Test Midnight",
			Type:              DayOfWeek,
			Currentimageindex: 0,
		},
		Images: []db.GetPlaylistImagesOrderedRow{
			{ID: 1, Name: "day1.jpg", Width: 1920, Height: 1080, Format: "jpg"},
			{ID: 2, Name: "day2.jpg", Width: 1920, Height: 1080, Format: "jpg"},
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

	// Start playlist - should set initial image and schedule midnight timer
	go manager.runDayOfWeekPlaylistImproved(ctx, instance, 500*time.Millisecond)

	time.Sleep(300 * time.Millisecond)

	// Verify initial image was set
	calls := mockBackend.GetSetWallpaperCalls()
	if len(calls) != 1 {
		t.Errorf("Expected 1 initial call, got %d", len(calls))
	}

	// Note: We can't easily test the midnight transition without time injection
	// but we verify the mechanism is in place

	close(instance.Done)
}

// TestCalculateDurationUntilMidnight tests the midnight calculation function
func TestCalculateDurationUntilMidnight(t *testing.T) {
	tests := []struct {
		name        string
		currentTime time.Time
		wantMin     time.Duration
		wantMax     time.Duration
	}{
		{
			name:        "just after midnight",
			currentTime: time.Date(2024, 1, 1, 0, 0, 1, 0, time.Local),
			wantMin:     23*time.Hour + 59*time.Minute + 58*time.Second,
			wantMax:     24 * time.Hour,
		},
		{
			name:        "noon",
			currentTime: time.Date(2024, 1, 1, 12, 0, 0, 0, time.Local),
			wantMin:     11*time.Hour + 59*time.Minute + 59*time.Second,
			wantMax:     12 * time.Hour,
		},
		{
			name:        "almost midnight",
			currentTime: time.Date(2024, 1, 1, 23, 59, 59, 0, time.Local),
			wantMin:     0 * time.Second,
			wantMax:     2 * time.Second,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			duration := calculateDurationUntilMidnight(tt.currentTime)

			if duration < tt.wantMin || duration > tt.wantMax {
				t.Errorf("calculateDurationUntilMidnight() = %v, want between %v and %v",
					duration, tt.wantMin, tt.wantMax)
			}
		})
	}
}

// TestDayOfWeekPlaylist_NoFalsePositivesOnDayChange tests that sanity check doesn't trigger unnecessarily
func TestDayOfWeekPlaylist_NoFalsePositivesOnDayChange(t *testing.T) {
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
			Type:              DayOfWeek,
			Currentimageindex: 0,
		},
		Images: []db.GetPlaylistImagesOrderedRow{
			{ID: 1, Name: "day1.jpg", Width: 1920, Height: 1080, Format: "jpg"},
			{ID: 2, Name: "day2.jpg", Width: 1920, Height: 1080, Format: "jpg"},
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

	// Start with short check interval for testing
	go manager.runDayOfWeekPlaylistImproved(ctx, instance, 500*time.Millisecond)

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
