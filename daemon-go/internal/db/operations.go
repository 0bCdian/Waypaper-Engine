package db

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"strings"
)

// BatchImageInsert represents a batch image insert operation
type BatchImageInsert struct {
	Name       string
	IsChecked  bool
	IsSelected bool
	Width      int64
	Height     int64
	Format     string
}

// BatchPlaylistImageInsert represents a batch playlist image insert operation
type BatchPlaylistImageInsert struct {
	ImageID         int64
	PlaylistID      int64
	IndexInPlaylist int64
	Time            sql.NullInt64
}

// DatabaseOperations provides high-level database operations
type DatabaseOperations struct {
	manager *DatabaseManager
}

// NewDatabaseOperations creates a new database operations instance
func NewDatabaseOperations(manager *DatabaseManager) *DatabaseOperations {
	return &DatabaseOperations{
		manager: manager,
	}
}

// GetManager returns the database manager
func (dbo *DatabaseOperations) GetManager() *DatabaseManager {
	return dbo.manager
}

// InsertImagesBatch inserts multiple images in a single transaction
func (ops *DatabaseOperations) InsertImagesBatch(ctx context.Context, images []BatchImageInsert) ([]Image, error) {
	var result []Image

	err := ops.manager.Transaction(ctx, func(q *Queries) error {
		for _, img := range images {
			insertedImages, err := q.InsertImages(ctx, InsertImagesParams{
				Name:       img.Name,
				Ischecked:  boolToInt64(img.IsChecked),
				Isselected: boolToInt64(img.IsSelected),
				Width:      img.Width,
				Height:     img.Height,
				Format:     img.Format,
			})
			if err != nil {
				return fmt.Errorf("failed to insert image %s: %w", img.Name, err)
			}
			result = append(result, insertedImages...)
		}
		return nil
	})

	return result, err
}

// InsertPlaylistImagesBatch inserts multiple playlist images in a single transaction
func (ops *DatabaseOperations) InsertPlaylistImagesBatch(ctx context.Context, playlistImages []BatchPlaylistImageInsert) error {
	return ops.manager.Transaction(ctx, func(q *Queries) error {
		for _, pImg := range playlistImages {
			err := q.InsertPlaylistImage(ctx, InsertPlaylistImageParams{
				Imageid:         pImg.ImageID,
				Playlistid:      pImg.PlaylistID,
				Indexinplaylist: pImg.IndexInPlaylist,
				Time:            pImg.Time,
			})
			if err != nil {
				return fmt.Errorf("failed to insert playlist image: %w", err)
			}
		}
		return nil
	})
}

// UpdateImageSelectionBatch updates multiple images' selection status in a single transaction
func (ops *DatabaseOperations) UpdateImageSelectionBatch(ctx context.Context, updates map[int64]struct{ IsSelected, IsChecked bool }) error {
	return ops.manager.Transaction(ctx, func(q *Queries) error {
		for imageID, selection := range updates {
			err := q.UpdateImageSelection(ctx, UpdateImageSelectionParams{
				ID:         imageID,
				Isselected: boolToInt64(selection.IsSelected),
				Ischecked:  boolToInt64(selection.IsChecked),
			})
			if err != nil {
				return fmt.Errorf("failed to update image %d selection: %w", imageID, err)
			}
		}
		return nil
	})
}

// DeleteImagesBatch deletes multiple images by their names in a single transaction
func (ops *DatabaseOperations) DeleteImagesBatch(ctx context.Context, imageNames []string) error {
	if len(imageNames) == 0 {
		return nil
	}

	return ops.manager.Transaction(ctx, func(q *Queries) error {
		// Build the query with placeholders
		placeholders := make([]string, len(imageNames))
		args := make([]interface{}, len(imageNames))
		for i, name := range imageNames {
			placeholders[i] = "?"
			args[i] = name
		}

		query := fmt.Sprintf("DELETE FROM Images WHERE name IN (%s)", strings.Join(placeholders, ","))
		_, err := ops.manager.db.ExecContext(ctx, query, args...)
		if err != nil {
			return fmt.Errorf("failed to delete images: %w", err)
		}

		return nil
	})
}

// GetPlaylistByID returns a playlist by its ID
func (ops *DatabaseOperations) GetPlaylistByID(ctx context.Context, id int64) (Playlist, error) {
	var result Playlist
	err := ops.manager.ReadOnlyTransaction(ctx, func(q *Queries) error {
		var err error
		result, err = q.GetPlaylistByID(ctx, id)
		return err
	})
	return result, err
}

// GetPlaylistByName returns a playlist by its name
func (ops *DatabaseOperations) GetPlaylistByName(ctx context.Context, name string) (Playlist, error) {
	var result Playlist
	err := ops.manager.ReadOnlyTransaction(ctx, func(q *Queries) error {
		var err error
		result, err = q.GetPlaylistByName(ctx, name)
		return err
	})
	return result, err
}

// UpdatePlaylistCurrentIndex updates the current image index of a playlist
func (ops *DatabaseOperations) UpdatePlaylistCurrentIndex(ctx context.Context, params UpdatePlaylistCurrentIndexParams) error {
	return ops.manager.Transaction(ctx, func(q *Queries) error {
		return q.UpdatePlaylistCurrentIndex(ctx, params)
	})
}

// GetAllImages returns all images in the database
func (ops *DatabaseOperations) GetAllImages(ctx context.Context) ([]Image, error) {
	var result []Image
	err := ops.manager.ReadOnlyTransaction(ctx, func(q *Queries) error {
		var err error
		result, err = q.GetAllImages(ctx)
		return err
	})
	return result, err
}

// GetAllPlaylistsWithImages returns all playlists with their images
func (ops *DatabaseOperations) GetAllPlaylistsWithImages(ctx context.Context) ([]PlaylistWithImages, error) {
	var result []PlaylistWithImages
	err := ops.manager.ReadOnlyTransaction(ctx, func(q *Queries) error {
		// Get all playlists
		playlists, err := q.GetAllPlaylists(ctx)
		if err != nil {
			return err
		}

		// For each playlist, get its images
		for _, playlist := range playlists {
			playlistWithImages, err := q.GetPlaylistImagesOrdered(ctx, playlist.ID)
			if err != nil {
				return err
			}

			// Convert to PlaylistWithImages
			images := make([]GetPlaylistImagesOrderedRow, len(playlistWithImages))
			for i, img := range playlistWithImages {
				images[i] = img
			}

			result = append(result, PlaylistWithImages{
				Playlist: playlist,
				Images:   images,
			})
		}
		return nil
	})
	return result, err
}

// GetPlaylistWithImages returns a playlist with all its images
func (ops *DatabaseOperations) GetPlaylistWithImages(ctx context.Context, playlistName string) (*PlaylistWithImages, error) {
	var result *PlaylistWithImages

	err := ops.manager.ReadOnlyTransaction(ctx, func(q *Queries) error {
		// Get playlist
		playlist, err := q.GetPlaylistByName(ctx, playlistName)
		if err != nil {
			return fmt.Errorf("failed to get playlist: %w", err)
		}

		// Get playlist images
		var images []GetPlaylistImagesOrderedRow
		if playlist.Order.Valid && playlist.Order.String == "random" {
			randomImages, err := q.GetPlaylistImagesRandom(ctx, playlist.ID)
			if err != nil {
				return fmt.Errorf("failed to get random playlist images: %w", err)
			}
			// Convert to ordered format
			for _, img := range randomImages {
				images = append(images, GetPlaylistImagesOrderedRow{
					ID:         img.ID,
					Name:       img.Name,
					Width:      img.Width,
					Height:     img.Height,
					Ischecked:  img.Ischecked,
					Isselected: img.Isselected,
					Format:     img.Format,
					Time:       img.Time,
				})
			}
		} else {
			images, err = q.GetPlaylistImagesOrdered(ctx, playlist.ID)
			if err != nil {
				return fmt.Errorf("failed to get ordered playlist images: %w", err)
			}
		}

		result = &PlaylistWithImages{
			Playlist: playlist,
			Images:   images,
		}

		return nil
	})

	return result, err
}

// GetActivePlaylistsWithImages returns all active playlists with their images
func (ops *DatabaseOperations) GetActivePlaylistsWithImages(ctx context.Context) ([]ActivePlaylistWithImages, error) {
	var result []ActivePlaylistWithImages

	err := ops.manager.ReadOnlyTransaction(ctx, func(q *Queries) error {
		// Get active playlists
		activePlaylists, err := q.GetActivePlaylists(ctx)
		if err != nil {
			return fmt.Errorf("failed to get active playlists: %w", err)
		}

		for _, activePlaylist := range activePlaylists {
			// Get images for this playlist
			var images []GetPlaylistImagesOrderedRow
			if activePlaylist.Order.Valid && activePlaylist.Order.String == "random" {
				randomImages, err := q.GetPlaylistImagesRandom(ctx, activePlaylist.ID)
				if err != nil {
					return fmt.Errorf("failed to get random playlist images: %w", err)
				}
				// Convert to ordered format
				for _, img := range randomImages {
					images = append(images, GetPlaylistImagesOrderedRow{
						ID:         img.ID,
						Name:       img.Name,
						Width:      img.Width,
						Height:     img.Height,
						Ischecked:  img.Ischecked,
						Isselected: img.Isselected,
						Format:     img.Format,
						Time:       img.Time,
					})
				}
			} else {
				images, err = q.GetPlaylistImagesOrdered(ctx, activePlaylist.ID)
				if err != nil {
					return fmt.Errorf("failed to get ordered playlist images: %w", err)
				}
			}

			result = append(result, ActivePlaylistWithImages{
				ActivePlaylist: activePlaylist,
				Images:         images,
			})
		}

		return nil
	})

	return result, err
}

// ReplacePlaylistImages replaces all images in a playlist with new ones
func (ops *DatabaseOperations) ReplacePlaylistImages(ctx context.Context, playlistID int64, newImages []BatchPlaylistImageInsert) error {
	return ops.manager.Transaction(ctx, func(q *Queries) error {
		// Delete existing images
		if err := q.DeletePlaylistImages(ctx, playlistID); err != nil {
			return fmt.Errorf("failed to delete existing playlist images: %w", err)
		}

		// Insert new images
		for _, img := range newImages {
			err := q.InsertPlaylistImage(ctx, InsertPlaylistImageParams{
				Imageid:         img.ImageID,
				Playlistid:      playlistID,
				Indexinplaylist: img.IndexInPlaylist,
				Time:            img.Time,
			})
			if err != nil {
				return fmt.Errorf("failed to insert new playlist image: %w", err)
			}
		}

		return nil
	})
}

// GetDatabaseStatistics returns comprehensive database statistics
func (ops *DatabaseOperations) GetDatabaseStatistics(ctx context.Context) (*DatabaseStatistics, error) {
	var stats DatabaseStatistics

	err := ops.manager.ReadOnlyTransaction(ctx, func(q *Queries) error {
		info, err := q.GetDatabaseInfo(ctx)
		if err != nil {
			return fmt.Errorf("failed to get basic statistics: %w", err)
		}

		stats.ImageCount = info.ImageCount
		stats.PlaylistCount = info.PlaylistCount
		stats.ActivePlaylistCount = info.ActivePlaylistCount
		stats.HistoryCount = info.HistoryCount

		// Get format statistics
		formatStats, err := q.GetImageFormatStats(ctx)
		if err != nil {
			return fmt.Errorf("failed to get format statistics: %w", err)
		}
		stats.FormatStats = formatStats

		// Get playlist type statistics
		typeStats, err := q.GetPlaylistTypeStats(ctx)
		if err != nil {
			return fmt.Errorf("failed to get playlist type statistics: %w", err)
		}
		stats.PlaylistTypeStats = typeStats

		return nil
	})

	return &stats, err
}

// UpsertPlaylistWithImages creates or updates a playlist and its associated images.
func (ops *DatabaseOperations) UpsertPlaylistWithImages(ctx context.Context, playlist Playlist, images []Image) (int64, error) {
	var playlistID int64
	err := ops.manager.Transaction(ctx, func(q *Queries) error {
		// Upsert the playlist
		insertedPlaylist, err := q.UpsertPlaylist(ctx, UpsertPlaylistParams{
			Name:                    playlist.Name,
			Type:                    playlist.Type,
			Interval:                playlist.Interval,
			Showanimations:          playlist.Showanimations,
			Alwaysstartonfirstimage: playlist.Alwaysstartonfirstimage,
			Order:                   playlist.Order,
			Currentimageindex:       playlist.Currentimageindex,
		})
		if err != nil {
			return fmt.Errorf("failed to upsert playlist: %w", err)
		}
		playlistID = insertedPlaylist

		// Replace images
		if err := q.DeletePlaylistImages(ctx, playlistID); err != nil {
			return fmt.Errorf("failed to delete existing playlist images: %w", err)
		}

		for i, img := range images {
			err := q.InsertPlaylistImage(ctx, InsertPlaylistImageParams{
				Imageid:         img.ID,
				Playlistid:      playlistID,
				Indexinplaylist: int64(i),
			})
			if err != nil {
				return fmt.Errorf("failed to insert playlist image: %w", err)
			}
		}
		return nil
	})
	return playlistID, err
}

// GetOrCreateAppConfig retrieves the app config, creating it if it doesn't exist.
func (ops *DatabaseOperations) GetOrCreateAppConfig(ctx context.Context, defaultConfig json.RawMessage) (json.RawMessage, error) {
	var config json.RawMessage
	err := ops.manager.Transaction(ctx, func(q *Queries) error {
		var err error
		rawConfig, err := q.GetAppConfig(ctx)
		if err == sql.ErrNoRows {
			// Config doesn't exist, create it
			err = q.UpsertAppConfig(ctx, string(defaultConfig))
			if err != nil {
				return fmt.Errorf("failed to create default app config: %w", err)
			}
			config = defaultConfig
			return nil
		}
		if err != nil {
			return err
		}
		config = json.RawMessage(rawConfig)
		return nil
	})
	return config, err
}

// GetOrCreateSwwwConfig retrieves the swww config, creating it if it doesn't exist.
func (ops *DatabaseOperations) GetOrCreateSwwwConfig(ctx context.Context, defaultConfig json.RawMessage) (json.RawMessage, error) {
	var config json.RawMessage
	err := ops.manager.Transaction(ctx, func(q *Queries) error {
		var err error
		rawConfig, err := q.GetSwwwConfig(ctx)
		if err == sql.ErrNoRows {
			// Config doesn't exist, create it
			err = q.UpsertSwwwConfig(ctx, string(defaultConfig))
			if err != nil {
				return fmt.Errorf("failed to create default swww config: %w", err)
			}
			config = defaultConfig
			return nil
		}
		if err != nil {
			return err
		}
		config = json.RawMessage(rawConfig)
		return nil
	})
	return config, err
}

// AddImageToHistoryWithCheck adds an image to history, updating the timestamp if it already exists for the given monitor.
// It also performs cleanup to maintain the history limit.
func (ops *DatabaseOperations) AddImageToHistoryWithCheck(ctx context.Context, imageID int64, monitorName string, historyLimit int) error {
	return ops.manager.Transaction(ctx, func(q *Queries) error {
		count, err := q.CheckImageInHistory(ctx, CheckImageInHistoryParams{
			Imageid: imageID,
			Monitor: monitorName,
		})
		if err != nil {
			return fmt.Errorf("failed to check image history: %w", err)
		}

		if count > 0 {
			// Update timestamp
			err = q.UpdateImageHistoryTime(ctx, UpdateImageHistoryTimeParams{
				Imageid: imageID,
				Monitor: monitorName,
			})
		} else {
			// Insert new record
			err = q.AddImageToHistory(ctx, AddImageToHistoryParams{
				Imageid: imageID,
				Monitor: monitorName,
			})
		}

		if err != nil {
			return err
		}

		// Cleanup old history entries to maintain the limit
		return q.CleanupImageHistory(ctx, int64(historyLimit))
	})
}

func (ops *DatabaseOperations) GetImageHistory(ctx context.Context, limit int) ([]GetImageHistoryRow, error) {
	var history []GetImageHistoryRow
	err := ops.manager.ReadOnlyTransaction(ctx, func(q *Queries) error {
		var err error
		history, err = q.GetImageHistory(ctx, int64(limit))
		return err
	})
	return history, err
}

// CleanupImageHistory removes old history entries beyond the specified limit
func (ops *DatabaseOperations) CleanupImageHistory(ctx context.Context, limit int) error {
	return ops.manager.Transaction(ctx, func(q *Queries) error {
		return q.CleanupImageHistory(ctx, int64(limit))
	})
}

// GetImage returns an image by its ID
func (ops *DatabaseOperations) GetImage(ctx context.Context, id int64) (Image, error) {
	var image Image
	err := ops.manager.ReadOnlyTransaction(ctx, func(q *Queries) error {
		var err error
		image, err = q.GetImage(ctx, id)
		return err
	})
	return image, err
}

// GetImageData returns the raw image data for a given image ID
func (ops *DatabaseOperations) GetImageData(ctx context.Context, id int64) ([]byte, error) {
	// Get image metadata first
	image, err := ops.GetImage(ctx, id)
	if err != nil {
		return nil, fmt.Errorf("failed to get image metadata: %w", err)
	}

	// Construct the image file path
	homeDir, err := os.UserHomeDir()
	if err != nil {
		return nil, fmt.Errorf("failed to get home directory: %w", err)
	}

	imagePath := filepath.Join(homeDir, ".waypaper-engine", "images", image.Name)

	// Read the image file
	data, err := os.ReadFile(imagePath)
	if err != nil {
		return nil, fmt.Errorf("failed to read image file: %w", err)
	}

	return data, nil
}

// Helper function to convert bool to int64 for SQLite
func boolToInt64(b bool) int64 {
	if b {
		return 1
	}
	return 0
}

// Data structures for complex operations
type PlaylistWithImages struct {
	Playlist Playlist
	Images   []GetPlaylistImagesOrderedRow
}

type ActivePlaylistWithImages struct {
	ActivePlaylist GetActivePlaylistsRow
	Images         []GetPlaylistImagesOrderedRow
}

type DatabaseStatistics struct {
	ImageCount          int64
	PlaylistCount       int64
	ActivePlaylistCount int64
	HistoryCount        int64
	FormatStats         []GetImageFormatStatsRow
	PlaylistTypeStats   []GetPlaylistTypeStatsRow
}
