package playlist

import (
	"context"
	"testing"

	"waypaper-engine/daemon-go/internal/db"
	"waypaper-engine/daemon-go/internal/models"
)

// TestNextImage_TimeOfDayRestriction tests that time-of-day playlists reject next image
func TestNextImage_TimeOfDayRestriction(t *testing.T) {
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
			Name:              "Time-of-Day Test",
			Type:              TimeOfDay,
			Currentimageindex: 0,
		},
		Images: []db.GetPlaylistImagesOrderedRow{
			{ID: 1, Name: "image1.jpg", Width: 1920, Height: 1080, Format: "jpg"},
			{ID: 2, Name: "image2.jpg", Width: 1920, Height: 1080, Format: "jpg"},
		},
	}

	activeMonitor := &models.ActiveMonitor{
		Name:     "DP-1",
		Monitors: []models.Monitor{{Name: "DP-1"}},
	}

	manager.instances["DP-1"] = &Instance{
		Playlist:      playlist,
		ActiveMonitor: activeMonitor,
		Done:          make(chan bool),
		paused:        false,
	}

	// Attempt to call NextImage on time-of-day playlist
	err := manager.NextImage(context.Background(), "DP-1")

	// Should return error
	if err == nil {
		t.Error("Expected error for NextImage on time-of-day playlist, got nil")
	}

	// Should not have changed image
	if len(mockBackend.GetSetWallpaperCalls()) != 0 {
		t.Errorf("Expected no SetWallpaper calls, got %d", len(mockBackend.GetSetWallpaperCalls()))
	}
}

// TestPreviousImage_TimeOfDayRestriction tests that time-of-day playlists reject previous image
func TestPreviousImage_TimeOfDayRestriction(t *testing.T) {
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
			Name:              "Time-of-Day Test",
			Type:              TimeOfDay,
			Currentimageindex: 1,
		},
		Images: []db.GetPlaylistImagesOrderedRow{
			{ID: 1, Name: "image1.jpg", Width: 1920, Height: 1080, Format: "jpg"},
			{ID: 2, Name: "image2.jpg", Width: 1920, Height: 1080, Format: "jpg"},
		},
	}

	activeMonitor := &models.ActiveMonitor{
		Name:     "DP-1",
		Monitors: []models.Monitor{{Name: "DP-1"}},
	}

	manager.instances["DP-1"] = &Instance{
		Playlist:      playlist,
		ActiveMonitor: activeMonitor,
		Done:          make(chan bool),
		paused:        false,
	}

	// Attempt to call PreviousImage on time-of-day playlist
	err := manager.PreviousImage(context.Background(), "DP-1")

	// Should return error
	if err == nil {
		t.Error("Expected error for PreviousImage on time-of-day playlist, got nil")
	}

	// Should not have changed image
	if len(mockBackend.GetSetWallpaperCalls()) != 0 {
		t.Errorf("Expected no SetWallpaper calls, got %d", len(mockBackend.GetSetWallpaperCalls()))
	}
}

// TestNextImage_DayOfWeekRestriction tests that day-of-week playlists reject next image
func TestNextImage_DayOfWeekRestriction(t *testing.T) {
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
			Name:              "Day-of-Week Test",
			Type:              DayOfWeek,
			Currentimageindex: 0,
		},
		Images: []db.GetPlaylistImagesOrderedRow{
			{ID: 1, Name: "monday.jpg", Width: 1920, Height: 1080, Format: "jpg"},
			{ID: 2, Name: "tuesday.jpg", Width: 1920, Height: 1080, Format: "jpg"},
		},
	}

	activeMonitor := &models.ActiveMonitor{
		Name:     "DP-1",
		Monitors: []models.Monitor{{Name: "DP-1"}},
	}

	manager.instances["DP-1"] = &Instance{
		Playlist:      playlist,
		ActiveMonitor: activeMonitor,
		Done:          make(chan bool),
		paused:        false,
	}

	// Attempt to call NextImage on day-of-week playlist
	err := manager.NextImage(context.Background(), "DP-1")

	// Should return error
	if err == nil {
		t.Error("Expected error for NextImage on day-of-week playlist, got nil")
	}

	// Should not have changed image
	if len(mockBackend.GetSetWallpaperCalls()) != 0 {
		t.Errorf("Expected no SetWallpaper calls, got %d", len(mockBackend.GetSetWallpaperCalls()))
	}
}

// TestPreviousImage_DayOfWeekRestriction tests that day-of-week playlists reject previous image
func TestPreviousImage_DayOfWeekRestriction(t *testing.T) {
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
			Name:              "Day-of-Week Test",
			Type:              DayOfWeek,
			Currentimageindex: 1,
		},
		Images: []db.GetPlaylistImagesOrderedRow{
			{ID: 1, Name: "monday.jpg", Width: 1920, Height: 1080, Format: "jpg"},
			{ID: 2, Name: "tuesday.jpg", Width: 1920, Height: 1080, Format: "jpg"},
		},
	}

	activeMonitor := &models.ActiveMonitor{
		Name:     "DP-1",
		Monitors: []models.Monitor{{Name: "DP-1"}},
	}

	manager.instances["DP-1"] = &Instance{
		Playlist:      playlist,
		ActiveMonitor: activeMonitor,
		Done:          make(chan bool),
		paused:        false,
	}

	// Attempt to call PreviousImage on day-of-week playlist
	err := manager.PreviousImage(context.Background(), "DP-1")

	// Should return error
	if err == nil {
		t.Error("Expected error for PreviousImage on day-of-week playlist, got nil")
	}

	// Should not have changed image
	if len(mockBackend.GetSetWallpaperCalls()) != 0 {
		t.Errorf("Expected no SetWallpaper calls, got %d", len(mockBackend.GetSetWallpaperCalls()))
	}
}

// TestNextImage_TimerAllowed tests that timer playlists allow next image
func TestNextImage_TimerAllowed(t *testing.T) {
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
			Name:              "Timer Test",
			Type:              Timer,
			Currentimageindex: 0,
		},
		Images: []db.GetPlaylistImagesOrderedRow{
			{ID: 1, Name: "image1.jpg", Width: 1920, Height: 1080, Format: "jpg"},
			{ID: 2, Name: "image2.jpg", Width: 1920, Height: 1080, Format: "jpg"},
			{ID: 3, Name: "image3.jpg", Width: 1920, Height: 1080, Format: "jpg"},
		},
	}

	activeMonitor := &models.ActiveMonitor{
		Name:     "DP-1",
		Monitors: []models.Monitor{{Name: "DP-1"}},
	}

	manager.instances["DP-1"] = &Instance{
		Playlist:      playlist,
		ActiveMonitor: activeMonitor,
		Done:          make(chan bool),
		paused:        false,
	}

	// Should allow NextImage on timer playlist
	err := manager.NextImage(context.Background(), "DP-1")

	// Should not return error
	if err != nil {
		t.Errorf("Expected no error for NextImage on timer playlist, got: %v", err)
	}

	// Should have changed image
	if len(mockBackend.GetSetWallpaperCalls()) != 1 {
		t.Errorf("Expected 1 SetWallpaper call, got %d", len(mockBackend.GetSetWallpaperCalls()))
	}

	// Verify index advanced
	if playlist.Playlist.Currentimageindex != 1 {
		t.Errorf("Expected index 1, got %d", playlist.Playlist.Currentimageindex)
	}
}

// TestPreviousImage_TimerAllowed tests that timer playlists allow previous image
func TestPreviousImage_TimerAllowed(t *testing.T) {
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
			Name:              "Timer Test",
			Type:              Timer,
			Currentimageindex: 1,
		},
		Images: []db.GetPlaylistImagesOrderedRow{
			{ID: 1, Name: "image1.jpg", Width: 1920, Height: 1080, Format: "jpg"},
			{ID: 2, Name: "image2.jpg", Width: 1920, Height: 1080, Format: "jpg"},
			{ID: 3, Name: "image3.jpg", Width: 1920, Height: 1080, Format: "jpg"},
		},
	}

	activeMonitor := &models.ActiveMonitor{
		Name:     "DP-1",
		Monitors: []models.Monitor{{Name: "DP-1"}},
	}

	manager.instances["DP-1"] = &Instance{
		Playlist:      playlist,
		ActiveMonitor: activeMonitor,
		Done:          make(chan bool),
		paused:        false,
	}

	// Should allow PreviousImage on timer playlist
	err := manager.PreviousImage(context.Background(), "DP-1")

	// Should not return error
	if err != nil {
		t.Errorf("Expected no error for PreviousImage on timer playlist, got: %v", err)
	}

	// Should have changed image
	if len(mockBackend.GetSetWallpaperCalls()) != 1 {
		t.Errorf("Expected 1 SetWallpaper call, got %d", len(mockBackend.GetSetWallpaperCalls()))
	}

	// Verify index went back
	if playlist.Playlist.Currentimageindex != 0 {
		t.Errorf("Expected index 0, got %d", playlist.Playlist.Currentimageindex)
	}
}

// TestNextImage_NeverAllowed tests that never playlists allow next image (for manual browsing)
func TestNextImage_NeverAllowed(t *testing.T) {
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
			Name:              "Never Test",
			Type:              Never,
			Currentimageindex: 0,
		},
		Images: []db.GetPlaylistImagesOrderedRow{
			{ID: 1, Name: "image1.jpg", Width: 1920, Height: 1080, Format: "jpg"},
			{ID: 2, Name: "image2.jpg", Width: 1920, Height: 1080, Format: "jpg"},
		},
	}

	activeMonitor := &models.ActiveMonitor{
		Name:     "DP-1",
		Monitors: []models.Monitor{{Name: "DP-1"}},
	}

	manager.instances["DP-1"] = &Instance{
		Playlist:      playlist,
		ActiveMonitor: activeMonitor,
		Done:          make(chan bool),
		paused:        false,
	}

	// Should allow NextImage on never playlist (for manual navigation)
	err := manager.NextImage(context.Background(), "DP-1")

	// Should not return error
	if err != nil {
		t.Errorf("Expected no error for NextImage on never playlist, got: %v", err)
	}

	// Should have changed image
	if len(mockBackend.GetSetWallpaperCalls()) != 1 {
		t.Errorf("Expected 1 SetWallpaper call, got %d", len(mockBackend.GetSetWallpaperCalls()))
	}
}
