package playlist

import (
	"context"
	"database/sql"
	"testing"
	"time"

	"waypaper-engine/daemon-go/internal/db"
	"waypaper-engine/daemon-go/internal/models"
)

// TestTimerReset_NextImageResetsTimer tests that manual next resets the timer
func TestTimerReset_NextImageResetsTimer(t *testing.T) {
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

	// Create timer playlist - we'll override the interval in the test function
	// But set it to a low value that matches our test (800ms = 0.8/60 minutes, so we'll just set to 1 and override)
	playlist := &db.PlaylistWithImages{
		Playlist: db.Playlist{
			Name:              "Timer Reset Test",
			Type:              Timer,
			Interval:          sql.NullInt64{Valid: true, Int64: 1}, // This will be interpreted as 1 minute in production
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

	instance := &Instance{
		Playlist:      playlist,
		ActiveMonitor: activeMonitor,
		Done:          make(chan bool),
		paused:        false,
	}

	manager.instances["DP-1"] = instance

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	// Start timer playlist with 800ms interval (for faster testing)
	go manager.runTimerPlaylistWithInterval(ctx, instance, 800*time.Millisecond)

	// Wait for playlist to start
	time.Sleep(50 * time.Millisecond)

	initialCalls := len(mockBackend.GetSetWallpaperCalls())
	testLogger.Info("test: initial state", "calls", initialCalls)

	// Manually navigate - this should reset the 800ms timer
	err := manager.NextImage(ctx, "DP-1")
	if err != nil {
		t.Fatalf("NextImage failed: %v", err)
	}

	// Verify manual navigation worked
	manualCalls := len(mockBackend.GetSetWallpaperCalls())
	testLogger.Info("test: after manual nav", "calls", manualCalls)
	if manualCalls != initialCalls+1 {
		t.Errorf("Expected %d calls after manual nav, got %d", initialCalls+1, manualCalls)
	}

	// Wait just under 800ms - should NOT see auto-advance yet
	time.Sleep(700 * time.Millisecond)
	callsAfter700ms := len(mockBackend.GetSetWallpaperCalls())
	testLogger.Info("test: after 700ms wait", "calls", callsAfter700ms)

	if callsAfter700ms != manualCalls {
		t.Errorf("Auto-advance happened too early (before timer reset completed), got %d calls, expected %d",
			callsAfter700ms, manualCalls)
	}

	// Wait another 250ms (total: 950ms from manual nav)
	// Now the auto-advance SHOULD have happened
	time.Sleep(250 * time.Millisecond)

	callsFinal := len(mockBackend.GetSetWallpaperCalls())
	testLogger.Info("test: after 950ms total", "calls", callsFinal)

	// Should have one more call from auto-advance
	if callsFinal != manualCalls+1 {
		t.Errorf("Expected auto-advance after timer reset, got %d calls, expected %d",
			callsFinal, manualCalls+1)
	}

	close(instance.Done)
}

// TestTimerReset_PreviousImageResetsTimer tests that manual previous resets the timer
func TestTimerReset_PreviousImageResetsTimer(t *testing.T) {
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
			Name:              "Timer Reset Previous Test",
			Type:              Timer,
			Interval:          sql.NullInt64{Valid: true, Int64: 1},
			Currentimageindex: 1, // Start at middle image
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
	}

	manager.instances["DP-1"] = instance

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	go manager.runTimerPlaylistWithInterval(ctx, instance, 1*time.Second)

	time.Sleep(100 * time.Millisecond)

	initialCalls := len(mockBackend.GetSetWallpaperCalls())

	// Manually go to previous image
	err := manager.PreviousImage(ctx, "DP-1")
	if err != nil {
		t.Fatalf("PreviousImage failed: %v", err)
	}

	manualCalls := len(mockBackend.GetSetWallpaperCalls())
	if manualCalls != initialCalls+1 {
		t.Errorf("Expected %d calls after manual nav, got %d", initialCalls+1, manualCalls)
	}

	// Wait and verify timer was reset
	time.Sleep(700 * time.Millisecond)
	callsAfterWait1 := len(mockBackend.GetSetWallpaperCalls())

	time.Sleep(500 * time.Millisecond)
	callsAfterWait2 := len(mockBackend.GetSetWallpaperCalls())

	if callsAfterWait2 != callsAfterWait1+1 {
		t.Errorf("Expected auto-advance after timer reset, got %d calls (was %d)",
			callsAfterWait2, callsAfterWait1)
	}

	close(instance.Done)
}

// TestTimerReset_MultipleManualNavigations tests multiple manual navigations
func TestTimerReset_MultipleManualNavigations(t *testing.T) {
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
			Name:              "Multiple Nav Test",
			Type:              Timer,
			Interval:          sql.NullInt64{Valid: true, Int64: 1},
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

	instance := &Instance{
		Playlist:      playlist,
		ActiveMonitor: activeMonitor,
		Done:          make(chan bool),
		paused:        false,
	}

	manager.instances["DP-1"] = instance

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	go manager.runTimerPlaylistWithInterval(ctx, instance, 1*time.Second)

	time.Sleep(100 * time.Millisecond)

	// First manual navigation
	_ = manager.NextImage(ctx, "DP-1")
	time.Sleep(400 * time.Millisecond)

	// Second manual navigation (should reset timer again)
	callsBeforeSecond := len(mockBackend.GetSetWallpaperCalls())
	_ = manager.NextImage(ctx, "DP-1")

	// Wait 1 second from second navigation
	time.Sleep(1100 * time.Millisecond)

	// Should have exactly one auto-advance after the second manual nav
	finalCalls := len(mockBackend.GetSetWallpaperCalls())
	expectedCalls := callsBeforeSecond + 1 + 1 // +1 for second manual nav, +1 for auto-advance

	if finalCalls != expectedCalls {
		t.Errorf("Expected %d calls after multiple navs, got %d", expectedCalls, finalCalls)
	}

	close(instance.Done)
}

// TestTimerReset_NoResetForNonTimerPlaylists tests that non-timer playlists don't attempt reset
func TestTimerReset_NoResetForNonTimerPlaylists(t *testing.T) {
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

	// Create "never" playlist (no timer)
	playlist := &db.PlaylistWithImages{
		Playlist: db.Playlist{
			Name:              "Never Playlist",
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

	instance := &Instance{
		Playlist:      playlist,
		ActiveMonitor: activeMonitor,
		Done:          make(chan bool),
		paused:        false,
		Timer:         nil, // No timer for never playlist
	}

	manager.instances["DP-1"] = instance

	ctx := context.Background()

	// Manual navigation should work without panicking (no timer to reset)
	err := manager.NextImage(ctx, "DP-1")
	if err != nil {
		t.Errorf("NextImage on never playlist should not error: %v", err)
	}

	// Verify it didn't crash
	calls := len(mockBackend.GetSetWallpaperCalls())
	if calls != 1 {
		t.Errorf("Expected 1 call for manual navigation, got %d", calls)
	}
}

// TestTimerReset_PausedPlaylistNoReset tests that paused playlists don't reset timer
func TestTimerReset_PausedPlaylistNoReset(t *testing.T) {
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
			Name:              "Paused Test",
			Type:              Timer,
			Interval:          sql.NullInt64{Valid: true, Int64: 1},
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

	instance := &Instance{
		Playlist:      playlist,
		ActiveMonitor: activeMonitor,
		Done:          make(chan bool),
		paused:        true, // Start paused
	}

	manager.instances["DP-1"] = instance

	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()

	go manager.runTimerPlaylistWithInterval(ctx, instance, 1*time.Second)

	time.Sleep(100 * time.Millisecond)

	// Manual navigation while paused
	err := manager.NextImage(ctx, "DP-1")
	if err != nil {
		t.Fatalf("NextImage failed: %v", err)
	}

	// Wait - no auto-advance should happen (playlist is paused)
	time.Sleep(1200 * time.Millisecond)

	calls := len(mockBackend.GetSetWallpaperCalls())
	// Should only have the manual navigation call, no auto-advance
	if calls != 1 {
		t.Errorf("Expected only manual navigation call while paused, got %d", calls)
	}

	close(instance.Done)
}

// runTimerPlaylistWithInterval is a testable version of runTimerPlaylist with configurable interval
func (m *Manager) runTimerPlaylistWithInterval(ctx context.Context, instance *Instance, interval time.Duration) {
	instance.timerInterval = interval // Store the interval for timer resets
	instance.Timer = time.NewTimer(interval)

	for {
		select {
		case <-instance.Timer.C:
			if !instance.paused {
				m.nextImage(ctx, instance)
				instance.Timer.Reset(interval)
			}
		case <-instance.Done:
			return
		case <-ctx.Done():
			return
		}
	}
}
