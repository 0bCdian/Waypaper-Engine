package playlist

import (
	"context"
	"database/sql"
	"log/slog"
	"os"
	"testing"
	"time"

	"waypaper-engine/daemon-go/internal/db"
	"waypaper-engine/daemon-go/internal/models"
	"waypaper-engine/daemon-go/internal/types"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// MockSwwwManager is a mock implementation for testing
type MockSwwwManager struct{}

func (m *MockSwwwManager) SetWallpaper(imagePath string, monitorName string) (string, error) {
	// Mock implementation that always succeeds
	return "mock output", nil
}

func (m *MockSwwwManager) SwwwInit() error {
	return nil
}

func (m *MockSwwwManager) GetMonitors() ([]models.Monitor, error) {
	return []models.Monitor{
		{Name: "Monitor-1", Width: 1920, Height: 1080},
	}, nil
}

func setupTestManager(t *testing.T) (*Manager, *db.DatabaseManager, *db.DatabaseOperations) {
	// Use an in-memory SQLite database for testing
	dbManager, err := db.NewDatabaseManager(":memory:", db.DefaultPoolConfig())
	require.NoError(t, err)

	ctx := context.Background()
	require.NoError(t, dbManager.Initialize(ctx))

	dbOps := db.NewDatabaseOperations(dbManager)
	logger := slog.New(slog.NewTextHandler(os.Stdout, &slog.HandlerOptions{Level: slog.LevelDebug}))

	// Use mock backend for testing
	mockBackend := &MockBackendManager{
		setWallpaperCalls: make([]SetWallpaperCall, 0),
	}

	manager := NewManager(dbOps, mockBackend, logger)

	return manager, dbManager, dbOps
}

func TestStartStopTimerPlaylist(t *testing.T) {
	manager, dbManager, dbOps := setupTestManager(t)
	defer dbManager.Close()
	ctx := context.Background()

	// Create a dummy playlist
	images := []db.Image{
		{Name: "image1.jpg", Width: 1920, Height: 1080, Format: "jpeg"},
	}
	insertedImages, err := dbOps.InsertImagesBatch(ctx, []db.BatchImageInsert{
		{Name: "image1.jpg", Width: 1920, Height: 1080, Format: "jpeg"},
	})
	require.NoError(t, err)
	images[0].ID = insertedImages[0].ID

	playlist := db.Playlist{
		Name:                    "TestTimerPlaylist",
		Type:                    "timer",
		Interval:                sql.NullInt64{Int64: 1, Valid: true},
		Showanimations:          1,
		Alwaysstartonfirstimage: 0,
		Order:                   sql.NullString{String: "ordered", Valid: true},
		Currentimageindex:       0,
	}
	playlistID, err := dbOps.UpsertPlaylistWithImages(ctx, playlist, images)
	require.NoError(t, err)

	activeMonitor := &models.ActiveMonitor{Name: "Monitor-1", Monitors: []models.Monitor{{Name: "Monitor-1"}}}

	// Start playlist
	err = manager.StartPlaylist(ctx, playlistID, activeMonitor)
	require.NoError(t, err)

	// Check if playlist is running
	assert.Contains(t, manager.instances, activeMonitor.Name)

	// Stop playlist
	err = manager.StopPlaylist(activeMonitor.Name)
	require.NoError(t, err)

	// Check if playlist is stopped
	assert.NotContains(t, manager.instances, activeMonitor.Name)
}

func TestPauseResumeTimerPlaylist(t *testing.T) {
	manager, dbManager, dbOps := setupTestManager(t)
	defer dbManager.Close()
	ctx := context.Background()

	// Create a dummy playlist
	images := []db.Image{
		{Name: "image1.jpg", Width: 1920, Height: 1080, Format: "jpeg"},
		{Name: "image2.png", Width: 1280, Height: 720, Format: "png"},
	}
	insertedImages, err := dbOps.InsertImagesBatch(ctx, []db.BatchImageInsert{
		{Name: "image1.jpg", Width: 1920, Height: 1080, Format: "jpeg"},
		{Name: "image2.png", Width: 1280, Height: 720, Format: "png"},
	})
	require.NoError(t, err)
	images[0].ID = insertedImages[0].ID
	images[1].ID = insertedImages[1].ID

	playlist := db.Playlist{
		Name:                    "TestPauseResumePlaylist",
		Type:                    "timer",
		Interval:                sql.NullInt64{Int64: 1, Valid: true},
		Showanimations:          1,
		Alwaysstartonfirstimage: 0,
		Order:                   sql.NullString{String: "ordered", Valid: true},
		Currentimageindex:       0,
	}
	playlistID, err := dbOps.UpsertPlaylistWithImages(ctx, playlist, images)
	require.NoError(t, err)

	activeMonitor := &models.ActiveMonitor{Name: "Monitor-1", Monitors: []models.Monitor{{Name: "Monitor-1"}}}

	// Start playlist
	err = manager.StartPlaylist(ctx, playlistID, activeMonitor)
	require.NoError(t, err)

	// Pause playlist
	err = manager.PausePlaylist(activeMonitor.Name)
	require.NoError(t, err)
	assert.True(t, manager.instances[activeMonitor.Name].paused)

	// Resume playlist
	err = manager.ResumePlaylist(activeMonitor.Name)
	require.NoError(t, err)
	assert.False(t, manager.instances[activeMonitor.Name].paused)

	// Stop playlist
	err = manager.StopPlaylist(activeMonitor.Name)
	require.NoError(t, err)
}

func TestNextPreviousImage(t *testing.T) {
	manager, dbManager, dbOps := setupTestManager(t)
	defer dbManager.Close()
	ctx := context.Background()

	// Create a dummy playlist with multiple images
	images := []db.Image{
		{Name: "image1.jpg", Width: 1920, Height: 1080, Format: "jpeg"},
		{Name: "image2.png", Width: 1280, Height: 720, Format: "png"},
		{Name: "image3.gif", Width: 800, Height: 600, Format: "gif"},
	}
	insertedImages, err := dbOps.InsertImagesBatch(ctx, []db.BatchImageInsert{
		{Name: "image1.jpg", Width: 1920, Height: 1080, Format: "jpeg"},
		{Name: "image2.png", Width: 1280, Height: 720, Format: "png"},
		{Name: "image3.gif", Width: 800, Height: 600, Format: "gif"},
	})
	require.NoError(t, err)
	for i := range images {
		images[i].ID = insertedImages[i].ID
	}

	playlist := db.Playlist{
		Name:                    "TestNextPrevPlaylist",
		Type:                    "timer",
		Interval:                sql.NullInt64{Int64: 1, Valid: true},
		Showanimations:          1,
		Alwaysstartonfirstimage: 0,
		Order:                   sql.NullString{String: "ordered", Valid: true},
		Currentimageindex:       0,
	}
	playlistID, err := dbOps.UpsertPlaylistWithImages(ctx, playlist, images)
	require.NoError(t, err)

	activeMonitor := &models.ActiveMonitor{Name: "Monitor-1", Monitors: []models.Monitor{{Name: "Monitor-1"}}}

	// Start playlist
	err = manager.StartPlaylist(ctx, playlistID, activeMonitor)
	require.NoError(t, err)

	// Test NextImage
	err = manager.NextImage(ctx, activeMonitor.Name)
	require.NoError(t, err)
	assert.Equal(t, int64(1), manager.instances[activeMonitor.Name].Playlist.Playlist.Currentimageindex)

	err = manager.NextImage(ctx, activeMonitor.Name)
	require.NoError(t, err)
	assert.Equal(t, int64(2), manager.instances[activeMonitor.Name].Playlist.Playlist.Currentimageindex)

	// Test PreviousImage
	err = manager.PreviousImage(ctx, activeMonitor.Name)
	require.NoError(t, err)
	assert.Equal(t, int64(1), manager.instances[activeMonitor.Name].Playlist.Playlist.Currentimageindex)

	// Stop playlist
	err = manager.StopPlaylist(activeMonitor.Name)
	require.NoError(t, err)
}

func TestWallpaperChangedEvent(t *testing.T) {
	manager, dbManager, dbOps := setupTestManager(t)
	defer dbManager.Close()
	ctx := context.Background()

	// Create a test playlist
	images := []db.Image{
		{Name: "test1.jpg", Width: 1920, Height: 1080, Format: "jpeg"},
		{Name: "test2.png", Width: 1280, Height: 720, Format: "png"},
	}
	insertedImages, err := dbOps.InsertImagesBatch(ctx, []db.BatchImageInsert{
		{Name: "test1.jpg", Width: 1920, Height: 1080, Format: "jpeg"},
		{Name: "test2.png", Width: 1280, Height: 720, Format: "png"},
	})
	require.NoError(t, err)
	images[0].ID = insertedImages[0].ID
	images[1].ID = insertedImages[1].ID

	playlistData := db.Playlist{
		Name:                    "TestWallpaperEventPlaylist",
		Type:                    "timer",
		Interval:                sql.NullInt64{Int64: 1, Valid: true},
		Showanimations:          1,
		Alwaysstartonfirstimage: 0,
		Order:                   sql.NullString{String: "ordered", Valid: true},
		Currentimageindex:       0,
	}
	playlistID, err := dbOps.UpsertPlaylistWithImages(ctx, playlistData, images)
	require.NoError(t, err)

	activeMonitor := &models.ActiveMonitor{
		Name: "Monitor-1",
		Monitors: []models.Monitor{
			{Name: "Monitor-1", Width: 1920, Height: 1080},
		},
		ExtendAcrossMonitors: false,
	}

	// Start playlist
	err = manager.StartPlaylist(ctx, playlistID, activeMonitor)
	require.NoError(t, err)

	// Listen for events
	eventChan := manager.GetEventChannel()

	// Wait for the playlist started event first
	select {
	case event := <-eventChan:
		assert.Equal(t, types.EventPlaylistStarted, event.Type)
		assert.Equal(t, "TestWallpaperEventPlaylist", event.Payload)
	case <-time.After(1 * time.Second):
		t.Fatal("timeout waiting for playlist started event")
	}

	// Test next image to trigger another event
	err = manager.NextImage(ctx, activeMonitor.Name)
	require.NoError(t, err)

	// Wait for the next image change event
	select {
	case event := <-eventChan:
		assert.Equal(t, types.EventImageChanged, event.Type)
		assert.Equal(t, "test2.png", event.Payload)
	case <-time.After(1 * time.Second):
		t.Fatal("timeout waiting for next image change event")
	}

	// Clean up
	err = manager.StopPlaylist(activeMonitor.Name)
	require.NoError(t, err)
}
