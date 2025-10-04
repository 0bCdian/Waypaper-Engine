package playlist

import (
	"context"
	"database/sql"
	"testing"
	"time"

	"waypaper-engine/daemon-go/internal/db"
	"waypaper-engine/daemon-go/internal/models"
)

// TestFindClosestImageIndex tests the binary search algorithm for finding the closest image
func TestFindClosestImageIndex(t *testing.T) {
	tests := []struct {
		name          string
		images        []db.GetPlaylistImagesOrderedRow
		currentTime   int // in minutes since midnight
		expectedIndex int
	}{
		{
			name: "exact match - morning",
			images: []db.GetPlaylistImagesOrderedRow{
				{ID: 1, Name: "morning.jpg", Time: sql.NullInt64{Valid: true, Int64: 480}},  // 8:00 AM
				{ID: 2, Name: "noon.jpg", Time: sql.NullInt64{Valid: true, Int64: 720}},     // 12:00 PM
				{ID: 3, Name: "evening.jpg", Time: sql.NullInt64{Valid: true, Int64: 1080}}, // 6:00 PM
			},
			currentTime:   480, // 8:00 AM
			expectedIndex: 0,
		},
		{
			name: "exact match - noon",
			images: []db.GetPlaylistImagesOrderedRow{
				{ID: 1, Name: "morning.jpg", Time: sql.NullInt64{Valid: true, Int64: 480}},
				{ID: 2, Name: "noon.jpg", Time: sql.NullInt64{Valid: true, Int64: 720}},
				{ID: 3, Name: "evening.jpg", Time: sql.NullInt64{Valid: true, Int64: 1080}},
			},
			currentTime:   720, // 12:00 PM
			expectedIndex: 1,
		},
		{
			name: "between morning and noon",
			images: []db.GetPlaylistImagesOrderedRow{
				{ID: 1, Name: "morning.jpg", Time: sql.NullInt64{Valid: true, Int64: 480}},  // 8:00 AM
				{ID: 2, Name: "noon.jpg", Time: sql.NullInt64{Valid: true, Int64: 720}},     // 12:00 PM
				{ID: 3, Name: "evening.jpg", Time: sql.NullInt64{Valid: true, Int64: 1080}}, // 6:00 PM
			},
			currentTime:   600, // 10:00 AM
			expectedIndex: 0,   // Should show morning image (8:00 AM)
		},
		{
			name: "between noon and evening",
			images: []db.GetPlaylistImagesOrderedRow{
				{ID: 1, Name: "morning.jpg", Time: sql.NullInt64{Valid: true, Int64: 480}},
				{ID: 2, Name: "noon.jpg", Time: sql.NullInt64{Valid: true, Int64: 720}},
				{ID: 3, Name: "evening.jpg", Time: sql.NullInt64{Valid: true, Int64: 1080}},
			},
			currentTime:   900, // 3:00 PM
			expectedIndex: 1,   // Should show noon image (12:00 PM)
		},
		{
			name: "after last image - should wrap to last",
			images: []db.GetPlaylistImagesOrderedRow{
				{ID: 1, Name: "morning.jpg", Time: sql.NullInt64{Valid: true, Int64: 480}},
				{ID: 2, Name: "noon.jpg", Time: sql.NullInt64{Valid: true, Int64: 720}},
				{ID: 3, Name: "evening.jpg", Time: sql.NullInt64{Valid: true, Int64: 1080}},
			},
			currentTime:   1320, // 10:00 PM (after last image at 6:00 PM)
			expectedIndex: 2,    // Should show evening image
		},
		{
			name: "before first image - should wrap to last from previous day",
			images: []db.GetPlaylistImagesOrderedRow{
				{ID: 1, Name: "morning.jpg", Time: sql.NullInt64{Valid: true, Int64: 480}},  // 8:00 AM
				{ID: 2, Name: "noon.jpg", Time: sql.NullInt64{Valid: true, Int64: 720}},     // 12:00 PM
				{ID: 3, Name: "evening.jpg", Time: sql.NullInt64{Valid: true, Int64: 1080}}, // 6:00 PM
			},
			currentTime:   60, // 1:00 AM (before first image at 8:00 AM)
			expectedIndex: 2,  // Should wrap to last image from previous day (evening)
		},
		{
			name: "single image - before",
			images: []db.GetPlaylistImagesOrderedRow{
				{ID: 1, Name: "noon.jpg", Time: sql.NullInt64{Valid: true, Int64: 720}}, // 12:00 PM
			},
			currentTime:   600, // 10:00 AM
			expectedIndex: 0,   // Should wrap to same image
		},
		{
			name: "single image - after",
			images: []db.GetPlaylistImagesOrderedRow{
				{ID: 1, Name: "noon.jpg", Time: sql.NullInt64{Valid: true, Int64: 720}}, // 12:00 PM
			},
			currentTime:   900, // 3:00 PM
			expectedIndex: 0,
		},
		{
			name: "two images - between them",
			images: []db.GetPlaylistImagesOrderedRow{
				{ID: 1, Name: "morning.jpg", Time: sql.NullInt64{Valid: true, Int64: 480}},  // 8:00 AM
				{ID: 2, Name: "evening.jpg", Time: sql.NullInt64{Valid: true, Int64: 1080}}, // 6:00 PM
			},
			currentTime:   720, // 12:00 PM
			expectedIndex: 0,   // Should show morning
		},
		{
			name: "early morning - 5 AM",
			images: []db.GetPlaylistImagesOrderedRow{
				{ID: 1, Name: "morning.jpg", Time: sql.NullInt64{Valid: true, Int64: 480}},  // 8:00 AM
				{ID: 2, Name: "noon.jpg", Time: sql.NullInt64{Valid: true, Int64: 720}},     // 12:00 PM
				{ID: 3, Name: "evening.jpg", Time: sql.NullInt64{Valid: true, Int64: 1080}}, // 6:00 PM
			},
			currentTime:   300, // 5:00 AM
			expectedIndex: 2,   // Should wrap to evening from previous day
		},
		{
			name: "late night - 11 PM",
			images: []db.GetPlaylistImagesOrderedRow{
				{ID: 1, Name: "morning.jpg", Time: sql.NullInt64{Valid: true, Int64: 480}},
				{ID: 2, Name: "noon.jpg", Time: sql.NullInt64{Valid: true, Int64: 720}},
				{ID: 3, Name: "evening.jpg", Time: sql.NullInt64{Valid: true, Int64: 1080}},
			},
			currentTime:   1380, // 11:00 PM
			expectedIndex: 2,    // Should show evening
		},
		{
			name: "midnight - 12:00 AM",
			images: []db.GetPlaylistImagesOrderedRow{
				{ID: 1, Name: "morning.jpg", Time: sql.NullInt64{Valid: true, Int64: 480}},
				{ID: 2, Name: "noon.jpg", Time: sql.NullInt64{Valid: true, Int64: 720}},
				{ID: 3, Name: "evening.jpg", Time: sql.NullInt64{Valid: true, Int64: 1080}},
			},
			currentTime:   0, // 12:00 AM
			expectedIndex: 2, // Should wrap to evening from previous day
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			playlist := &db.PlaylistWithImages{
				Playlist: db.Playlist{
					Name: "Test Time of Day Playlist",
					Type: TimeOfDay,
				},
				Images: tt.images,
			}

			index := findClosestImageIndex(playlist, tt.currentTime)
			if index != tt.expectedIndex {
				t.Errorf("Expected index %d, got %d (current time: %d:%02d)",
					tt.expectedIndex, index, tt.currentTime/60, tt.currentTime%60)
			}
		})
	}
}

// TestFindClosestImageIndex_InvalidTimes tests edge cases with invalid time values
func TestFindClosestImageIndex_InvalidTimes(t *testing.T) {
	tests := []struct {
		name        string
		images      []db.GetPlaylistImagesOrderedRow
		currentTime int
		expectPanic bool
	}{
		{
			name: "image with no time set",
			images: []db.GetPlaylistImagesOrderedRow{
				{ID: 1, Name: "morning.jpg", Time: sql.NullInt64{Valid: true, Int64: 480}},
				{ID: 2, Name: "noon.jpg", Time: sql.NullInt64{Valid: false}}, // Invalid time
				{ID: 3, Name: "evening.jpg", Time: sql.NullInt64{Valid: true, Int64: 1080}},
			},
			currentTime: 600,
			expectPanic: false, // Should handle gracefully by skipping invalid entries
		},
		{
			name:        "empty playlist",
			images:      []db.GetPlaylistImagesOrderedRow{},
			currentTime: 600,
			expectPanic: false, // Should return -1 or handle gracefully
		},
		{
			name: "all invalid times",
			images: []db.GetPlaylistImagesOrderedRow{
				{ID: 1, Name: "img1.jpg", Time: sql.NullInt64{Valid: false}},
				{ID: 2, Name: "img2.jpg", Time: sql.NullInt64{Valid: false}},
			},
			currentTime: 600,
			expectPanic: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			playlist := &db.PlaylistWithImages{
				Playlist: db.Playlist{
					Name: "Test Playlist",
					Type: TimeOfDay,
				},
				Images: tt.images,
			}

			if tt.expectPanic {
				defer func() {
					if r := recover(); r == nil {
						t.Errorf("Expected panic but didn't get one")
					}
				}()
			}

			index := findClosestImageIndex(playlist, tt.currentTime)
			// For invalid cases, we expect -1 or 0
			if index < -1 {
				t.Errorf("Got invalid index %d", index)
			}
		})
	}
}

// TestTimeOfDayPlaylist_SetsInitialImage tests that time-of-day playlist sets correct initial image
func TestTimeOfDayPlaylist_SetsInitialImage(t *testing.T) {
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

	// Create time-of-day playlist with images at 8 AM, 12 PM, 6 PM
	playlist := &db.PlaylistWithImages{
		Playlist: db.Playlist{
			Name:              "Test Time of Day",
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

	// Mock current time to 10:00 AM (600 minutes)
	// This should select the morning image (8:00 AM) as the closest previous time
	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
	defer cancel()

	go manager.runTimeOfDayPlaylistWithTime(ctx, instance, 600) // 10:00 AM

	time.Sleep(500 * time.Millisecond)

	// Verify that SetWallpaper was called with the morning image
	calls := mockBackend.GetSetWallpaperCalls()
	if len(calls) < 1 {
		t.Fatalf("Expected at least 1 SetWallpaper call, got %d", len(calls))
	}

	firstCall := calls[0]
	if firstCall.ImagePath != "morning.jpg" {
		t.Errorf("Expected morning.jpg to be set at 10:00 AM, got %s", firstCall.ImagePath)
	}

	close(instance.Done)
}

// TestTimeOfDayPlaylist_WrapAroundToLastImage tests early morning behavior
func TestTimeOfDayPlaylist_WrapAroundToLastImage(t *testing.T) {
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
			Name:              "Test Time of Day Wrap",
			Type:              TimeOfDay,
			Currentimageindex: 0,
		},
		Images: []db.GetPlaylistImagesOrderedRow{
			{ID: 1, Name: "morning.jpg", Time: sql.NullInt64{Valid: true, Int64: 480}, Width: 1920, Height: 1080, Format: "jpg"},
			{ID: 2, Name: "noon.jpg", Time: sql.NullInt64{Valid: true, Int64: 720}, Width: 1920, Height: 1080, Format: "jpg"},
			{ID: 3, Name: "evening.jpg", Time: sql.NullInt64{Valid: true, Int64: 1080}, Width: 1920, Height: 1080, Format: "jpg"},
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

	// Mock current time to 5:00 AM (300 minutes) - before first image
	// Should wrap around to show evening image from previous day
	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
	defer cancel()

	go manager.runTimeOfDayPlaylistWithTime(ctx, instance, 300) // 5:00 AM

	time.Sleep(500 * time.Millisecond)

	calls := mockBackend.GetSetWallpaperCalls()
	if len(calls) < 1 {
		t.Fatalf("Expected at least 1 SetWallpaper call, got %d", len(calls))
	}

	firstCall := calls[0]
	if firstCall.ImagePath != "evening.jpg" {
		t.Errorf("Expected evening.jpg to be set at 5:00 AM (wrap around), got %s", firstCall.ImagePath)
	}

	close(instance.Done)
}
