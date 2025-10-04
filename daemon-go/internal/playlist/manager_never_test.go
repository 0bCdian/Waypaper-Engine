package playlist

import (
	"context"
	"database/sql"
	"testing"
	"time"

	"waypaper-engine/daemon-go/internal/db"
	"waypaper-engine/daemon-go/internal/models"
)

// TestNeverPlaylist_SetsInitialImage tests that a "never" type playlist sets the image once on start
func TestNeverPlaylist_SetsInitialImage(t *testing.T) {
	// Setup mock backend that tracks SetWallpaper calls
	mockBackend := &MockBackendManager{
		setWallpaperCalls: make([]SetWallpaperCall, 0),
	}

	// Create a manager with mock backend
	manager := &Manager{
		dbOps:           nil, // Not needed for this test
		instances:       make(map[string]*Instance),
		eventChan:       make(chan Event, 10),
		logger:          testLogger,
		wallpaperSetter: mockBackend,
	}

	// Create test playlist with "never" type
	playlist := &db.PlaylistWithImages{
		Playlist: db.Playlist{
			Name:              "Test Never Playlist",
			Type:              Never,
			Currentimageindex: 0,
		},
		Images: []db.GetPlaylistImagesOrderedRow{
			{
				ID:     1,
				Name:   "image1.jpg",
				Width:  1920,
				Height: 1080,
				Format: "jpg",
				Time:   sql.NullInt64{Valid: false},
			},
			{
				ID:     2,
				Name:   "image2.jpg",
				Width:  1920,
				Height: 1080,
				Format: "jpg",
				Time:   sql.NullInt64{Valid: false},
			},
		},
	}

	activeMonitor := &models.ActiveMonitor{
		Name:     "DP-1",
		Monitors: []models.Monitor{{Name: "DP-1"}},
	}

	// Create instance
	instance := &Instance{
		Playlist:      playlist,
		ActiveMonitor: activeMonitor,
		Done:          make(chan bool),
		paused:        false,
	}

	// Start the playlist in a goroutine
	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
	defer cancel()

	go manager.runPlaylist(ctx, instance)

	// Wait a bit for the image to be set
	time.Sleep(500 * time.Millisecond)

	// Verify that SetWallpaper was called exactly once
	if len(mockBackend.setWallpaperCalls) != 1 {
		t.Errorf("Expected SetWallpaper to be called once, got %d calls", len(mockBackend.setWallpaperCalls))
	}

	// Verify the correct image was set
	if len(mockBackend.setWallpaperCalls) > 0 {
		call := mockBackend.setWallpaperCalls[0]
		if call.ImagePath != "image1.jpg" {
			t.Errorf("Expected image1.jpg to be set, got %s", call.ImagePath)
		}
		if call.MonitorName != "DP-1" {
			t.Errorf("Expected monitor DP-1, got %s", call.MonitorName)
		}
	}

	// Wait longer to ensure no additional calls are made
	time.Sleep(1 * time.Second)

	// Verify still only one call (never type should not auto-change)
	if len(mockBackend.setWallpaperCalls) != 1 {
		t.Errorf("Expected exactly 1 SetWallpaper call for never playlist, got %d", len(mockBackend.setWallpaperCalls))
	}

	// Clean up
	close(instance.Done)
}

// TestNeverPlaylist_RespectsCurrentImageIndex tests that never playlist uses currentImageIndex
func TestNeverPlaylist_RespectsCurrentImageIndex(t *testing.T) {
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

	// Create playlist with currentImageIndex set to 2 (third image)
	playlist := &db.PlaylistWithImages{
		Playlist: db.Playlist{
			Name:              "Test Never Playlist Index",
			Type:              Never,
			Currentimageindex: 2, // Should start with third image
		},
		Images: []db.GetPlaylistImagesOrderedRow{
			{ID: 1, Name: "image1.jpg", Width: 1920, Height: 1080, Format: "jpg", Time: sql.NullInt64{Valid: false}},
			{ID: 2, Name: "image2.jpg", Width: 1920, Height: 1080, Format: "jpg", Time: sql.NullInt64{Valid: false}},
			{ID: 3, Name: "image3.jpg", Width: 1920, Height: 1080, Format: "jpg", Time: sql.NullInt64{Valid: false}},
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

	go manager.runPlaylist(ctx, instance)

	time.Sleep(500 * time.Millisecond)

	// Verify that the third image (index 2) was set
	if len(mockBackend.setWallpaperCalls) != 1 {
		t.Errorf("Expected 1 SetWallpaper call, got %d", len(mockBackend.setWallpaperCalls))
	}

	if len(mockBackend.setWallpaperCalls) > 0 {
		call := mockBackend.setWallpaperCalls[0]
		if call.ImagePath != "image3.jpg" {
			t.Errorf("Expected image3.jpg (index 2) to be set, got %s", call.ImagePath)
		}
	}

	close(instance.Done)
}

// TestNeverPlaylist_EmptyImages tests that never playlist handles empty image list gracefully
func TestNeverPlaylist_EmptyImages(t *testing.T) {
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
			Name:              "Empty Never Playlist",
			Type:              Never,
			Currentimageindex: 0,
		},
		Images: []db.GetPlaylistImagesOrderedRow{}, // Empty image list
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
	go manager.runPlaylist(ctx, instance)

	time.Sleep(500 * time.Millisecond)

	// Should not have called SetWallpaper (no images to set)
	if len(mockBackend.setWallpaperCalls) != 0 {
		t.Errorf("Expected no SetWallpaper calls with empty images, got %d", len(mockBackend.setWallpaperCalls))
	}

	close(instance.Done)
}
