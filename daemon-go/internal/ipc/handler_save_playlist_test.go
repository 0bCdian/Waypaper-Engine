package ipc

import (
	"context"
	"log/slog"
	"os"
	"path/filepath"
	"testing"

	"waypaper-engine/daemon-go/internal/config"
	"waypaper-engine/daemon-go/internal/db"
	"waypaper-engine/daemon-go/internal/image"
	"waypaper-engine/daemon-go/internal/playlist"
)

// setupTestHandler creates a test handler with an in-memory database
func setupTestHandler(t *testing.T) (*Handler, string) {
	// Create temporary directory
	tempDir := t.TempDir()

	// Initialize in-memory database
	dbManager, err := db.NewDatabaseManager("file::memory:", db.DefaultPoolConfig())
	if err != nil {
		t.Fatalf("Failed to create database manager: %v", err)
	}

	// Run migrations
	ctx := context.Background()
	if err := dbManager.Initialize(ctx); err != nil {
		t.Fatalf("Failed to initialize database: %v", err)
	}

	// Create database operations
	dbOps := db.NewDatabaseOperations(dbManager)

	// Get queries instance
	dbQueries := db.New(dbManager.GetDB())

	// Create test logger
	logger := slog.New(slog.NewTextHandler(os.Stdout, &slog.HandlerOptions{Level: slog.LevelError}))

	// Create mock dependencies
	configManager := config.NewConfigManager(filepath.Join(tempDir, "config"))
	imageProcessor := image.NewProcessor(1, 1, logger)
	playlistManager := playlist.NewManager(dbOps, nil, logger)

	// Create handler
	handler := NewHandler(playlistManager, dbOps, dbQueries, configManager, imageProcessor, nil, logger)

	return handler, tempDir
}

// createTestImages helper function to insert test images
func createTestImages(t *testing.T, handler *Handler, count int) []int64 {
	ctx := context.Background()
	imageIDs := []int64{}

	for i := 1; i <= count; i++ {
		img, err := handler.dbQueries.CreateImage(ctx, db.CreateImageParams{
			Name:       "test-image-" + string(rune('0'+i)) + ".jpg",
			Format:     "jpg",
			Width:      1920,
			Height:     1080,
			Ischecked:  0,
			Isselected: 0,
		})
		if err != nil {
			t.Fatalf("Failed to create test image: %v", err)
		}
		imageIDs = append(imageIDs, img.ID)
	}

	return imageIDs
}

// TestHandleSavePlaylist_NewPlaylist tests saving a new playlist
func TestHandleSavePlaylist_NewPlaylist(t *testing.T) {
	handler, tempDir := setupTestHandler(t)
	defer os.RemoveAll(tempDir)

	// Create test images
	imageIDs := createTestImages(t, handler, 3)

	// Create test message
	interval := int64(5)
	order := "sequential"
	msg := &Message{
		Action: "save_playlist",
		Playlist: &RendererPlaylist{
			Name: "Test Playlist",
			Images: []RendererImage{
				{ID: imageIDs[0]},
				{ID: imageIDs[1]},
				{ID: imageIDs[2]},
			},
			Configuration: PlaylistConfiguration{
				Type:                    "timer",
				Interval:                &interval,
				Order:                   &order,
				ShowAnimations:          true,
				AlwaysStartOnFirstImage: true,
				CurrentImageIndex:       0,
			},
		},
	}

	// Handle the message
	response := handler.handleSavePlaylist(msg)

	// Verify response
	if response.Error != "" {
		t.Errorf("Expected no error, got: %s", response.Error)
	}

	if response.Data == nil {
		t.Fatal("Expected response data, got nil")
	}

	// Verify playlist was saved in database
	ctx := context.Background()
	savedPlaylist, err := handler.dbQueries.GetPlaylistByName(ctx, "Test Playlist")
	if err != nil {
		t.Fatalf("Failed to get saved playlist: %v", err)
	}

	if savedPlaylist.Name != "Test Playlist" {
		t.Errorf("Expected playlist name 'Test Playlist', got '%s'", savedPlaylist.Name)
	}

	if savedPlaylist.Type != "timer" {
		t.Errorf("Expected playlist type 'timer', got '%s'", savedPlaylist.Type)
	}

	if savedPlaylist.Interval.Int64 != 5 {
		t.Errorf("Expected interval 5, got %d", savedPlaylist.Interval.Int64)
	}
}

// TestHandleSavePlaylist_UpdateExisting tests updating an existing playlist
func TestHandleSavePlaylist_UpdateExisting(t *testing.T) {
	handler, tempDir := setupTestHandler(t)
	defer os.RemoveAll(tempDir)

	ctx := context.Background()

	// Create test images
	imageIDs := createTestImages(t, handler, 3)

	// Create initial playlist
	interval1 := int64(5)
	order1 := "sequential"
	msg1 := &Message{
		Action: "save_playlist",
		Playlist: &RendererPlaylist{
			Name: "Test Playlist",
			Images: []RendererImage{
				{ID: imageIDs[0]},
				{ID: imageIDs[1]},
			},
			Configuration: PlaylistConfiguration{
				Type:                    "timer",
				Interval:                &interval1,
				Order:                   &order1,
				ShowAnimations:          true,
				AlwaysStartOnFirstImage: true,
				CurrentImageIndex:       0,
			},
		},
	}

	response1 := handler.handleSavePlaylist(msg1)
	if response1.Error != "" {
		t.Fatalf("Failed to create initial playlist: %s", response1.Error)
	}

	// Update the playlist
	interval2 := int64(10)
	order2 := "random"
	msg2 := &Message{
		Action: "save_playlist",
		Playlist: &RendererPlaylist{
			Name: "Test Playlist", // Same name
			Images: []RendererImage{
				{ID: imageIDs[0]},
				{ID: imageIDs[1]},
				{ID: imageIDs[2]}, // Added new image
			},
			Configuration: PlaylistConfiguration{
				Type:                    "timer",
				Interval:                &interval2, // Changed interval
				Order:                   &order2,    // Changed order
				ShowAnimations:          false,      // Changed
				AlwaysStartOnFirstImage: false,      // Changed
				CurrentImageIndex:       1,          // Changed
			},
		},
	}

	response2 := handler.handleSavePlaylist(msg2)
	if response2.Error != "" {
		t.Errorf("Failed to update playlist: %s", response2.Error)
	}

	// Verify updated playlist
	updatedPlaylist, err := handler.dbQueries.GetPlaylistByName(ctx, "Test Playlist")
	if err != nil {
		t.Fatalf("Failed to get updated playlist: %v", err)
	}

	if updatedPlaylist.Interval.Int64 != 10 {
		t.Errorf("Expected updated interval 10, got %d", updatedPlaylist.Interval.Int64)
	}

	if updatedPlaylist.Order.String != "random" {
		t.Errorf("Expected updated order 'random', got '%s'", updatedPlaylist.Order.String)
	}

	// Verify image count
	images, err := handler.dbQueries.GetPlaylistImagesOrdered(ctx, updatedPlaylist.ID)
	if err != nil {
		t.Fatalf("Failed to get playlist images: %v", err)
	}

	if len(images) != 3 {
		t.Errorf("Expected 3 images in updated playlist, got %d", len(images))
	}
}

// TestHandleSavePlaylist_MissingPlaylist tests validation when playlist is nil
func TestHandleSavePlaylist_MissingPlaylist(t *testing.T) {
	handler, tempDir := setupTestHandler(t)
	defer os.RemoveAll(tempDir)

	msg := &Message{
		Action:   "save_playlist",
		Playlist: nil,
	}

	response := handler.handleSavePlaylist(msg)

	if response.Error == "" {
		t.Error("Expected error for missing playlist, got none")
	}

	if response.Error != "[ipc] playlist data is required" {
		t.Errorf("Expected specific error message, got: %s", response.Error)
	}
}

// TestHandleSavePlaylist_MissingName tests validation when playlist name is empty
func TestHandleSavePlaylist_MissingName(t *testing.T) {
	handler, tempDir := setupTestHandler(t)
	defer os.RemoveAll(tempDir)

	interval := int64(5)
	msg := &Message{
		Action: "save_playlist",
		Playlist: &RendererPlaylist{
			Name:   "", // Empty name
			Images: []RendererImage{{ID: 1}},
			Configuration: PlaylistConfiguration{
				Type:     "timer",
				Interval: &interval,
			},
		},
	}

	response := handler.handleSavePlaylist(msg)

	if response.Error == "" {
		t.Error("Expected error for missing name, got none")
	}
}

// TestHandleSavePlaylist_EmptyImages tests handling of playlist with no images
func TestHandleSavePlaylist_EmptyImages(t *testing.T) {
	handler, tempDir := setupTestHandler(t)
	defer os.RemoveAll(tempDir)

	interval := int64(5)
	msg := &Message{
		Action: "save_playlist",
		Playlist: &RendererPlaylist{
			Name:   "Empty Playlist",
			Images: []RendererImage{}, // No images
			Configuration: PlaylistConfiguration{
				Type:     "timer",
				Interval: &interval,
			},
		},
	}

	response := handler.handleSavePlaylist(msg)

	// Should succeed - playlists can be saved without images
	if response.Error != "" {
		t.Errorf("Expected no error for empty images, got: %s", response.Error)
	}
}

// TestHandleSavePlaylist_TimeOfDayPlaylist tests saving time-of-day playlist with times
func TestHandleSavePlaylist_TimeOfDayPlaylist(t *testing.T) {
	handler, tempDir := setupTestHandler(t)
	defer os.RemoveAll(tempDir)

	ctx := context.Background()

	// Create test images
	imageIDs := createTestImages(t, handler, 3)

	// Create time-of-day playlist
	time1 := int64(600)  // 10:00 AM
	time2 := int64(720)  // 12:00 PM
	time3 := int64(1080) // 6:00 PM

	msg := &Message{
		Action: "save_playlist",
		Playlist: &RendererPlaylist{
			Name: "Time of Day Playlist",
			Images: []RendererImage{
				{ID: imageIDs[0], Time: &time1},
				{ID: imageIDs[1], Time: &time2},
				{ID: imageIDs[2], Time: &time3},
			},
			Configuration: PlaylistConfiguration{
				Type:                    "timeofday",
				ShowAnimations:          true,
				AlwaysStartOnFirstImage: false,
				CurrentImageIndex:       0,
			},
		},
	}

	response := handler.handleSavePlaylist(msg)

	if response.Error != "" {
		t.Errorf("Expected no error, got: %s", response.Error)
	}

	// Verify playlist was saved with correct times
	savedPlaylist, err := handler.dbQueries.GetPlaylistByName(ctx, "Time of Day Playlist")
	if err != nil {
		t.Fatalf("Failed to get saved playlist: %v", err)
	}

	if savedPlaylist.Type != "timeofday" {
		t.Errorf("Expected playlist type 'timeofday', got '%s'", savedPlaylist.Type)
	}

	// Verify images have time values
	images, err := handler.dbQueries.GetPlaylistImagesOrdered(ctx, savedPlaylist.ID)
	if err != nil {
		t.Fatalf("Failed to get playlist images: %v", err)
	}

	if len(images) != 3 {
		t.Fatalf("Expected 3 images, got %d", len(images))
	}

	// Check times are saved
	expectedTimes := []int64{600, 720, 1080}
	for i, img := range images {
		if !img.Time.Valid {
			t.Errorf("Expected image %d to have time set", i)
		} else if img.Time.Int64 != expectedTimes[i] {
			t.Errorf("Expected image %d time %d, got %d", i, expectedTimes[i], img.Time.Int64)
		}
	}
}
