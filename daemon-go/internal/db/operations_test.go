package db

import (
	"context"
	"database/sql"
	"encoding/json"
	"testing"
	"time"

	_ "github.com/mattn/go-sqlite3"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func setupTestDB(t *testing.T) (*DatabaseManager, *DatabaseOperations) {
	// Use an in-memory SQLite database for testing
	dbManager, err := NewDatabaseManager("file::memory:", DefaultPoolConfig())
	require.NoError(t, err)

	ctx := context.Background()
	require.NoError(t, dbManager.Initialize(ctx))

	dbOps := NewDatabaseOperations(dbManager)
	return dbManager, dbOps
}

func TestUpsertPlaylistWithImages(t *testing.T) {
	dbManager, dbOps := setupTestDB(t)
	defer dbManager.Close()
	ctx := context.Background()

	// Create dummy images
	images := []Image{
		{Name: "image1.jpg", Width: 1920, Height: 1080, Format: "jpeg"},
		{Name: "image2.png", Width: 1280, Height: 720, Format: "png"},
	}
	insertedImages, err := dbOps.InsertImagesBatch(ctx, []BatchImageInsert{
		{Name: "image1.jpg", Width: 1920, Height: 1080, Format: "jpeg"},
		{Name: "image2.png", Width: 1280, Height: 720, Format: "png"},
	})
	require.NoError(t, err)
	require.Len(t, insertedImages, 2)
	images[0].ID = insertedImages[0].ID
	images[1].ID = insertedImages[1].ID

	// Create a playlist
	playlist := Playlist{
		Name:                    "Test Playlist",
		Type:                    "timer",
		Interval:                sql.NullInt64{Int64: 5, Valid: true},
		Showanimations:          1,
		Alwaysstartonfirstimage: 0,
		Order:                   sql.NullString{String: "ordered", Valid: true},
		Currentimageindex:       0,
	}

	// Upsert the playlist with images
	playlistID, err := dbOps.UpsertPlaylistWithImages(ctx, playlist, images)
	require.NoError(t, err)
	assert.True(t, playlistID > 0)

	// Verify the playlist and images are in the DB
	retrievedPlaylist, err := dbOps.GetPlaylistWithImages(ctx, playlist.Name)
	require.NoError(t, err)
	assert.Equal(t, playlist.Name, retrievedPlaylist.Playlist.Name)
	assert.Len(t, retrievedPlaylist.Images, 2)
	assert.Equal(t, images[0].Name, retrievedPlaylist.Images[0].Name)
	assert.Equal(t, images[1].Name, retrievedPlaylist.Images[1].Name)

	// Update the playlist with different images
	newImages := []Image{
		{Name: "image3.gif", Width: 800, Height: 600, Format: "gif"},
	}
	insertedNewImages, err := dbOps.InsertImagesBatch(ctx, []BatchImageInsert{
		{Name: "image3.gif", Width: 800, Height: 600, Format: "gif"},
	})
	require.NoError(t, err)
	require.Len(t, insertedNewImages, 1)
	newImages[0].ID = insertedNewImages[0].ID

	playlist.Interval = sql.NullInt64{Int64: 10, Valid: true}
	updatedPlaylistID, err := dbOps.UpsertPlaylistWithImages(ctx, playlist, newImages)
	require.NoError(t, err)
	assert.Equal(t, playlistID, updatedPlaylistID)

	// Verify the playlist is updated and images are replaced
	retrievedUpdatedPlaylist, err := dbOps.GetPlaylistWithImages(ctx, playlist.Name)
	require.NoError(t, err)
	assert.Equal(t, int64(10), retrievedUpdatedPlaylist.Playlist.Interval.Int64)
	assert.Len(t, retrievedUpdatedPlaylist.Images, 1)
	assert.Equal(t, newImages[0].Name, retrievedUpdatedPlaylist.Images[0].Name)
}

func TestGetOrCreateAppConfig(t *testing.T) {
	dbManager, dbOps := setupTestDB(t)
	defer dbManager.Close()
	ctx := context.Background()

	defaultConfig := json.RawMessage(`{"key": "value"}`)

	// First call should create and return default
	config, err := dbOps.GetOrCreateAppConfig(ctx, defaultConfig)
	require.NoError(t, err)
	assert.Equal(t, defaultConfig, config)

	// Second call should retrieve existing
	config, err = dbOps.GetOrCreateAppConfig(ctx, defaultConfig)
	require.NoError(t, err)
	assert.Equal(t, defaultConfig, config)

	// Manually update config and verify retrieval
	updatedConfig := json.RawMessage(`{"key": "new_value"}`)
	_, err = dbManager.db.ExecContext(ctx, "UPDATE appConfig SET config = ?", string(updatedConfig))
	require.NoError(t, err)

	config, err = dbOps.GetOrCreateAppConfig(ctx, defaultConfig)
	require.NoError(t, err)
	assert.Equal(t, updatedConfig, config)
}

func TestAddImageToHistoryWithCheck(t *testing.T) {
	dbManager, dbOps := setupTestDB(t)
	defer dbManager.Close()
	ctx := context.Background()

	// Insert a dummy image
	insertedImages, err := dbOps.InsertImagesBatch(ctx, []BatchImageInsert{
		{Name: "history_image.jpg", Width: 100, Height: 100, Format: "jpeg"},
	})
	require.NoError(t, err)
	imageID := insertedImages[0].ID
	monitorName := "Monitor-1"

	// Add to history for the first time
	err = dbOps.AddImageToHistoryWithCheck(ctx, imageID, monitorName, 50)
	require.NoError(t, err)

	history, err := dbOps.GetImageHistory(ctx, 50)
	require.NoError(t, err)
	assert.Len(t, history, 1)
	assert.Equal(t, imageID, history[0].ID)
	assert.Equal(t, monitorName, history[0].Monitor)

	// Add again (should update timestamp)
	time.Sleep(1 * time.Second) // Ensure timestamp changes
	err = dbOps.AddImageToHistoryWithCheck(ctx, imageID, monitorName, 50)
	require.NoError(t, err)

	history, err = dbOps.GetImageHistory(ctx, 50)
	require.NoError(t, err)
	assert.Len(t, history, 1) // Still one entry
}
