package api

import (
	"context"
	"database/sql"
	"log/slog"
	"os"
	"testing"

	"waypaper-engine/daemon-go/internal/config"
	"waypaper-engine/daemon-go/internal/db"
	"waypaper-engine/daemon-go/internal/image"
	"waypaper-engine/daemon-go/internal/ipc"
	"waypaper-engine/daemon-go/internal/models"
	"waypaper-engine/daemon-go/internal/playlist"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func setupTestHandlers(t *testing.T) (*ipc.Handler, *db.DatabaseManager, *db.DatabaseOperations, *playlist.Manager) {
	// Use an in-memory SQLite database for testing
	dbManager, err := db.NewDatabaseManager(":memory:", db.DefaultPoolConfig())
	require.NoError(t, err)

	ctx := context.Background()
	require.NoError(t, dbManager.Initialize(ctx))

	dbOps := db.NewDatabaseOperations(dbManager)
	dbQueries := db.New(dbManager.GetDB())
	logger := slog.New(slog.NewTextHandler(os.Stdout, &slog.HandlerOptions{Level: slog.LevelDebug}))
	configManager := config.NewConfigManager("/tmp/test-config")
	imageProcessor := image.NewProcessor(1, 1, logger)
	playlistManager := playlist.NewManager(dbOps, nil, logger) // nil wallpaper setter for this test
	handler := ipc.NewHandler(playlistManager, dbOps, dbQueries, configManager, imageProcessor, nil, logger)

	return handler, dbManager, dbOps, playlistManager
}

func TestHandleStartPlaylist(t *testing.T) {
	handler, dbManager, dbOps, playlistManager := setupTestHandlers(t)
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
		Name:                    "TestPlaylist",
		Type:                    "timer",
		Interval:                sql.NullInt64{Int64: 1, Valid: true},
		Showanimations:          1,
		Alwaysstartonfirstimage: 0,
		Order:                   sql.NullString{String: "ordered", Valid: true},
		Currentimageindex:       0,
	}
	playlistID, err := dbOps.UpsertPlaylistWithImages(ctx, playlistData, images)
	require.NoError(t, err)

	// Create test message
	activeMonitor := &models.ActiveMonitor{
		Name: "Monitor-1",
		Monitors: []models.Monitor{
			{Name: "Monitor-1", Width: 1920, Height: 1080},
		},
		ExtendAcrossMonitors: false,
	}

	msg := &ipc.Message{
		Action:        "start_playlist",
		PlaylistID:    playlistID,
		ActiveMonitor: activeMonitor,
	}

	// Test starting playlist
	response := handler.HandleMessage(msg)
	assert.Equal(t, "start_playlist", response.Action)
	assert.Empty(t, response.Error)
	assert.Equal(t, "playlist started", response.Data)

	// Verify playlist is running
	_, exists := playlistManager.GetInstance(activeMonitor.Name)
	assert.True(t, exists, "Playlist should be running on monitor")

	// Test stopping playlist
	stopMsg := &ipc.Message{
		Action:        "stop_playlist",
		ActiveMonitor: activeMonitor,
	}

	response = handler.HandleMessage(stopMsg)
	assert.Equal(t, "stop_playlist", response.Action)
	assert.Empty(t, response.Error)
	assert.Equal(t, "playlist stopped", response.Data)

	// Verify playlist is stopped
	_, exists = playlistManager.GetInstance(activeMonitor.Name)
	assert.False(t, exists, "Playlist should not be running on monitor")
}

func TestHandleNextImage(t *testing.T) {
	handler, dbManager, dbOps, playlistManager := setupTestHandlers(t)
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
		Name:                    "TestPlaylist",
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

	// Start playlist first
	startMsg := &ipc.Message{
		Action:        "start_playlist",
		PlaylistID:    playlistID,
		ActiveMonitor: activeMonitor,
	}
	response := handler.HandleMessage(startMsg)
	require.Empty(t, response.Error)

	// Test next image
	nextMsg := &ipc.Message{
		Action:        "next_image",
		ActiveMonitor: activeMonitor,
	}

	response = handler.HandleMessage(nextMsg)
	assert.Equal(t, "next_image", response.Action)
	assert.Empty(t, response.Error)
	assert.Equal(t, "image changed", response.Data)

	// Verify image index changed
	instance, exists := playlistManager.GetInstance(activeMonitor.Name)
	require.True(t, exists)
	assert.Equal(t, int64(1), instance.Playlist.Playlist.Currentimageindex)

	// Clean up
	stopMsg := &ipc.Message{
		Action:        "stop_playlist",
		ActiveMonitor: activeMonitor,
	}
	handler.HandleMessage(stopMsg)
}

func TestHandlePreviousImage(t *testing.T) {
	handler, dbManager, dbOps, playlistManager := setupTestHandlers(t)
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
		Name:                    "TestPlaylist",
		Type:                    "timer",
		Interval:                sql.NullInt64{Int64: 1, Valid: true},
		Showanimations:          1,
		Alwaysstartonfirstimage: 0,
		Order:                   sql.NullString{String: "ordered", Valid: true},
		Currentimageindex:       1, // Start at index 1
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

	// Start playlist first
	startMsg := &ipc.Message{
		Action:        "start_playlist",
		PlaylistID:    playlistID,
		ActiveMonitor: activeMonitor,
	}
	response := handler.HandleMessage(startMsg)
	require.Empty(t, response.Error)

	// Test previous image
	prevMsg := &ipc.Message{
		Action:        "previous_image",
		ActiveMonitor: activeMonitor,
	}

	response = handler.HandleMessage(prevMsg)
	assert.Equal(t, "previous_image", response.Action)
	assert.Empty(t, response.Error)
	assert.Equal(t, "image changed", response.Data)

	// Verify image index changed (should wrap around to 0)
	instance, exists := playlistManager.GetInstance(activeMonitor.Name)
	require.True(t, exists)
	assert.Equal(t, int64(0), instance.Playlist.Playlist.Currentimageindex)

	// Clean up
	stopMsg := &ipc.Message{
		Action:        "stop_playlist",
		ActiveMonitor: activeMonitor,
	}
	handler.HandleMessage(stopMsg)
}

func TestHandlePauseResumePlaylist(t *testing.T) {
	handler, dbManager, dbOps, playlistManager := setupTestHandlers(t)
	defer dbManager.Close()
	ctx := context.Background()

	// Create a test playlist
	images := []db.Image{
		{Name: "test1.jpg", Width: 1920, Height: 1080, Format: "jpeg"},
	}
	insertedImages, err := dbOps.InsertImagesBatch(ctx, []db.BatchImageInsert{
		{Name: "test1.jpg", Width: 1920, Height: 1080, Format: "jpeg"},
	})
	require.NoError(t, err)
	images[0].ID = insertedImages[0].ID

	playlistData := db.Playlist{
		Name:                    "TestPlaylist",
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

	// Start playlist first
	startMsg := &ipc.Message{
		Action:        "start_playlist",
		PlaylistID:    playlistID,
		ActiveMonitor: activeMonitor,
	}
	response := handler.HandleMessage(startMsg)
	require.Empty(t, response.Error)

	// Test pause playlist
	pauseMsg := &ipc.Message{
		Action:        "pause_playlist",
		ActiveMonitor: activeMonitor,
	}

	response = handler.HandleMessage(pauseMsg)
	assert.Equal(t, "pause_playlist", response.Action)
	assert.Empty(t, response.Error)
	assert.Equal(t, "playlist paused", response.Data)

	// Verify playlist is paused
	instance, exists := playlistManager.GetInstance(activeMonitor.Name)
	require.True(t, exists)
	assert.True(t, instance.IsPaused())

	// Test resume playlist
	resumeMsg := &ipc.Message{
		Action:        "resume_playlist",
		ActiveMonitor: activeMonitor,
	}

	response = handler.HandleMessage(resumeMsg)
	assert.Equal(t, "resume_playlist", response.Action)
	assert.Empty(t, response.Error)
	assert.Equal(t, "playlist resumed", response.Data)

	// Verify playlist is resumed
	instance, exists = playlistManager.GetInstance(activeMonitor.Name)
	require.True(t, exists)
	assert.False(t, instance.IsPaused())

	// Clean up
	stopMsg := &ipc.Message{
		Action:        "stop_playlist",
		ActiveMonitor: activeMonitor,
	}
	handler.HandleMessage(stopMsg)
}

func TestHandleUnknownAction(t *testing.T) {
	handler, dbManager, _, _ := setupTestHandlers(t)
	defer dbManager.Close()

	msg := &ipc.Message{
		Action: "unknown_action",
	}

	response := handler.HandleMessage(msg)
	assert.Equal(t, "unknown_action", response.Action)
	assert.NotEmpty(t, response.Error)
	assert.Contains(t, response.Error, "unknown action")
}
