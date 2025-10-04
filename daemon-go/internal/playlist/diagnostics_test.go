package playlist

import (
	"database/sql"
	"testing"
	"time"

	"waypaper-engine/daemon-go/internal/db"
	"waypaper-engine/daemon-go/internal/models"
)

// TestGetDiagnostics_TimerPlaylist tests diagnostics for timer playlists
func TestGetDiagnostics_TimerPlaylist(t *testing.T) {
	mockBackend := &MockBackendManager{}

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
			Interval:          sql.NullInt64{Valid: true, Int64: 5}, // 5 minutes
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

	instance := &Instance{
		Playlist:      playlist,
		ActiveMonitor: activeMonitor,
		Done:          make(chan bool),
		paused:        false,
		timerInterval: 5 * time.Minute,
	}

	manager.instances["DP-1"] = instance

	// Get diagnostics
	diag, err := manager.GetDiagnostics("DP-1")
	if err != nil {
		t.Fatalf("GetDiagnostics failed: %v", err)
	}

	// Verify basic info
	if diag.PlaylistName != "Timer Test" {
		t.Errorf("Expected playlist name 'Timer Test', got %s", diag.PlaylistName)
	}
	if diag.PlaylistType != Timer {
		t.Errorf("Expected type 'timer', got %s", diag.PlaylistType)
	}
	if diag.MonitorName != "DP-1" {
		t.Errorf("Expected monitor 'DP-1', got %s", diag.MonitorName)
	}
	if diag.IsPaused {
		t.Error("Expected playlist not to be paused")
	}
	if diag.ImageCount != 3 {
		t.Errorf("Expected 3 images, got %d", diag.ImageCount)
	}
	if diag.CurrentIndex != 1 {
		t.Errorf("Expected current index 1, got %d", diag.CurrentIndex)
	}

	// Verify current image
	if diag.CurrentImage == nil {
		t.Fatal("Expected current image info")
	}
	if diag.CurrentImage.ID != 2 {
		t.Errorf("Expected current image ID 2, got %d", diag.CurrentImage.ID)
	}
	if diag.CurrentImage.Name != "image2.jpg" {
		t.Errorf("Expected image2.jpg, got %s", diag.CurrentImage.Name)
	}

	// Verify previous image
	if diag.PreviousImage == nil {
		t.Fatal("Expected previous image info")
	}
	if diag.PreviousImage.ID != 1 {
		t.Errorf("Expected previous image ID 1, got %d", diag.PreviousImage.ID)
	}

	// Verify next image
	if diag.NextImage == nil {
		t.Fatal("Expected next image info")
	}
	if diag.NextImage.ID != 3 {
		t.Errorf("Expected next image ID 3, got %d", diag.NextImage.ID)
	}
	if diag.NextImage.Index != 2 {
		t.Errorf("Expected next image index 2, got %d", diag.NextImage.Index)
	}

	// Verify time info
	if diag.TimeUntilNext == nil {
		t.Error("Expected time until next")
	}
	if diag.TimeUntilNextMS == nil {
		t.Error("Expected time until next in ms")
	}
}

// TestGetDiagnostics_TimeOfDayPlaylist tests diagnostics for time-of-day playlists
func TestGetDiagnostics_TimeOfDayPlaylist(t *testing.T) {
	mockBackend := &MockBackendManager{}

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

	manager.instances["DP-1"] = instance

	// Get diagnostics
	diag, err := manager.GetDiagnostics("DP-1")
	if err != nil {
		t.Fatalf("GetDiagnostics failed: %v", err)
	}

	// Verify basic info
	if diag.PlaylistType != TimeOfDay {
		t.Errorf("Expected type 'timeofday', got %s", diag.PlaylistType)
	}

	// Verify current image has scheduled time
	if diag.CurrentImage == nil {
		t.Fatal("Expected current image info")
	}
	if diag.CurrentImage.ScheduledAt == nil {
		t.Fatal("Expected scheduled time for current image")
	}
	if *diag.CurrentImage.ScheduledAt != "08:00" {
		t.Errorf("Expected scheduled time '08:00', got %s", *diag.CurrentImage.ScheduledAt)
	}

	// Verify next image has scheduled time
	if diag.NextImage == nil {
		t.Fatal("Expected next image info")
	}
	if diag.NextImage.ScheduledAt == nil {
		t.Fatal("Expected scheduled time for next image")
	}
	if *diag.NextImage.ScheduledAt != "12:00" {
		t.Errorf("Expected next scheduled time '12:00', got %s", *diag.NextImage.ScheduledAt)
	}

	// Should have time until next
	if diag.TimeUntilNext == nil {
		t.Error("Expected time until next for time-of-day playlist")
	}
}

// TestGetDiagnostics_DayOfWeekPlaylist tests diagnostics for day-of-week playlists
func TestGetDiagnostics_DayOfWeekPlaylist(t *testing.T) {
	mockBackend := &MockBackendManager{}

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
			{ID: 1, Name: "sunday.jpg", Width: 1920, Height: 1080, Format: "jpg"},
			{ID: 2, Name: "monday.jpg", Width: 1920, Height: 1080, Format: "jpg"},
			{ID: 3, Name: "tuesday.jpg", Width: 1920, Height: 1080, Format: "jpg"},
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

	manager.instances["DP-1"] = instance

	// Get diagnostics
	diag, err := manager.GetDiagnostics("DP-1")
	if err != nil {
		t.Fatalf("GetDiagnostics failed: %v", err)
	}

	// Verify basic info
	if diag.PlaylistType != DayOfWeek {
		t.Errorf("Expected type 'dayofweek', got %s", diag.PlaylistType)
	}

	// Should have next image (tomorrow's day)
	if diag.NextImage == nil {
		t.Error("Expected next image for day-of-week playlist")
	}

	// Should have time until midnight
	if diag.TimeUntilNext == nil {
		t.Error("Expected time until next (midnight) for day-of-week playlist")
	}
}

// TestGetDiagnostics_NeverPlaylist tests diagnostics for never playlists
func TestGetDiagnostics_NeverPlaylist(t *testing.T) {
	mockBackend := &MockBackendManager{}

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
			{ID: 1, Name: "static.jpg", Width: 1920, Height: 1080, Format: "jpg"},
			{ID: 2, Name: "backup.jpg", Width: 1920, Height: 1080, Format: "jpg"},
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

	manager.instances["DP-1"] = instance

	// Get diagnostics
	diag, err := manager.GetDiagnostics("DP-1")
	if err != nil {
		t.Fatalf("GetDiagnostics failed: %v", err)
	}

	// Verify basic info
	if diag.PlaylistType != Never {
		t.Errorf("Expected type 'never', got %s", diag.PlaylistType)
	}

	// Should have current image
	if diag.CurrentImage == nil {
		t.Fatal("Expected current image")
	}

	// Should NOT have next image or time info (never changes)
	if diag.NextImage != nil {
		t.Error("Never playlist should not have next image")
	}
	if diag.TimeUntilNext != nil {
		t.Error("Never playlist should not have time until next")
	}
	if diag.TimeUntilNextMS != nil {
		t.Error("Never playlist should not have time until next ms")
	}
}

// TestGetDiagnostics_NoPlaylist tests when no playlist is running
func TestGetDiagnostics_NoPlaylist(t *testing.T) {
	manager := &Manager{
		dbOps:           nil,
		instances:       make(map[string]*Instance),
		eventChan:       make(chan Event, 10),
		logger:          testLogger,
		wallpaperSetter: &MockBackendManager{},
	}

	// Get diagnostics for non-existent monitor
	diag, err := manager.GetDiagnostics("DP-99")
	if err != nil {
		t.Fatalf("GetDiagnostics should not error: %v", err)
	}

	// Should return nil when no playlist
	if diag != nil {
		t.Error("Expected nil diagnostics when no playlist running")
	}
}

// TestGetDiagnostics_PausedPlaylist tests diagnostics for paused playlist
func TestGetDiagnostics_PausedPlaylist(t *testing.T) {
	mockBackend := &MockBackendManager{}

	manager := &Manager{
		dbOps:           nil,
		instances:       make(map[string]*Instance),
		eventChan:       make(chan Event, 10),
		logger:          testLogger,
		wallpaperSetter: mockBackend,
	}

	playlist := &db.PlaylistWithImages{
		Playlist: db.Playlist{
			Name:              "Paused Test",
			Type:              Timer,
			Interval:          sql.NullInt64{Valid: true, Int64: 5},
			Currentimageindex: 0,
		},
		Images: []db.GetPlaylistImagesOrderedRow{
			{ID: 1, Name: "image1.jpg", Width: 1920, Height: 1080, Format: "jpg"},
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
		paused:        true, // Paused
		timerInterval: 5 * time.Minute,
	}

	manager.instances["DP-1"] = instance

	// Get diagnostics
	diag, err := manager.GetDiagnostics("DP-1")
	if err != nil {
		t.Fatalf("GetDiagnostics failed: %v", err)
	}

	// Verify paused state
	if !diag.IsPaused {
		t.Error("Expected playlist to be marked as paused")
	}
}

// TestGetAllDiagnostics tests getting diagnostics for all playlists
func TestGetAllDiagnostics(t *testing.T) {
	manager := &Manager{
		dbOps:           nil,
		instances:       make(map[string]*Instance),
		eventChan:       make(chan Event, 10),
		logger:          testLogger,
		wallpaperSetter: &MockBackendManager{},
	}

	// Create multiple playlist instances
	for i, monitorName := range []string{"DP-1", "DP-2", "HDMI-1"} {
		playlist := &db.PlaylistWithImages{
			Playlist: db.Playlist{
				Name:              "Playlist " + monitorName,
				Type:              Timer,
				Interval:          sql.NullInt64{Valid: true, Int64: 5},
				Currentimageindex: 0,
			},
			Images: []db.GetPlaylistImagesOrderedRow{
				{ID: int64(i + 1), Name: "image.jpg", Width: 1920, Height: 1080, Format: "jpg"},
			},
		}

		activeMonitor := &models.ActiveMonitor{
			Name:     monitorName,
			Monitors: []models.Monitor{{Name: monitorName}},
		}

		instance := &Instance{
			Playlist:      playlist,
			ActiveMonitor: activeMonitor,
			Done:          make(chan bool),
			paused:        false,
			timerInterval: 5 * time.Minute,
		}

		manager.instances[monitorName] = instance
	}

	// Get all diagnostics
	allDiag, err := manager.GetAllDiagnostics()
	if err != nil {
		t.Fatalf("GetAllDiagnostics failed: %v", err)
	}

	// Verify we got all 3
	if len(allDiag) != 3 {
		t.Errorf("Expected 3 diagnostics, got %d", len(allDiag))
	}

	// Verify each has correct monitor name
	monitorNames := make(map[string]bool)
	for _, diag := range allDiag {
		monitorNames[diag.MonitorName] = true
	}

	expectedMonitors := []string{"DP-1", "DP-2", "HDMI-1"}
	for _, expected := range expectedMonitors {
		if !monitorNames[expected] {
			t.Errorf("Expected diagnostics for monitor %s", expected)
		}
	}
}

// TestFormatMinutesToTime tests the time formatting function
func TestFormatMinutesToTime(t *testing.T) {
	tests := []struct {
		minutes  int
		expected string
	}{
		{0, "00:00"},
		{60, "01:00"},
		{480, "08:00"},
		{720, "12:00"},
		{1080, "18:00"},
		{1439, "23:59"},
	}

	for _, tt := range tests {
		result := formatMinutesToTime(tt.minutes)
		if result != tt.expected {
			t.Errorf("formatMinutesToTime(%d) = %s, want %s", tt.minutes, result, tt.expected)
		}
	}
}
