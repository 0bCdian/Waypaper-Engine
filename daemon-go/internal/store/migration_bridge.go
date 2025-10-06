package store

import (
	"context"
	"database/sql"
	"fmt"
	"log/slog"
	"time"

	"waypaper-engine/daemon-go/internal/db"
	"waypaper-engine/daemon-go/internal/media"
)

// MigrationBridge facilitates migration from SQLite to JSON storage
type MigrationBridge struct {
	dbOps  *db.DatabaseOperations
	store  *Store
	logger *slog.Logger
}

// NewMigrationBridge creates a new migration bridge
func NewMigrationBridge(dbOps *db.DatabaseOperations, store *Store, logger *slog.Logger) *MigrationBridge {
	return &MigrationBridge{
		dbOps:  dbOps,
		store:  store,
		logger: logger,
	}
}

// MigrationFlags controls which parts of the system use JSON vs SQLite
type MigrationFlags struct {
	UseJSONForImages    bool `toml:"use_json_images"`
	UseJSONForPlaylists bool `toml:"use_json_playlists"`
	UseJSONForRuntime   bool `toml:"use_json_runtime"`
	UseJSONForHistory   bool `toml:"use_json_history"`
	UseJSONForConfig    bool `toml:"use_json_config"`
	EnableSync          bool `toml:"enable_sync"` // Sync changes between systems
}

// DefaultMigrationFlags returns default migration flags
func DefaultMigrationFlags() MigrationFlags {
	return MigrationFlags{
		UseJSONForImages:    false,
		UseJSONForPlaylists: false,
		UseJSONForRuntime:   false,
		UseJSONForHistory:   false,
		UseJSONForConfig:    false,
		EnableSync:          true, // Start with sync enabled for safety
	}
}

// SyncData transfers data FROM SQLite TO JSON store
func (mb *MigrationBridge) SyncData(ctx context.Context) error {
	mb.logger.Info("starting data synchronization from SQLite to JSON")

	// Sync images
	if err := mb.syncImages(ctx); err != nil {
		return fmt.Errorf("failed to sync images: %w", err)
	}

	// Sync playlists
	if err := mb.syncPlaylists(ctx); err != nil {
		return fmt.Errorf("failed to sync playlists: %w", err)
	}

	// Sync runtime state
	if err := mb.syncRuntimeState(ctx); err != nil {
		return fmt.Errorf("failed to sync runtime state: %w", err)
	}

	// Sync history
	if err := mb.syncHistory(ctx); err != nil {
		return fmt.Errorf("failed to sync history: %w", err)
	}

	mb.logger.Info("data synchronization completed successfully")
	return nil
}

// syncImages syncs images from SQLite to JSON
func (mb *MigrationBridge) syncImages(ctx context.Context) error {
	mb.logger.Debug("syncing images from SQLite to JSON")

	// Get all images from SQLite
	dbImages, err := mb.dbOps.GetAllImages(ctx)
	if err != nil {
		return fmt.Errorf("failed to get images from database: %w", err)
	}

	if len(dbImages) == 0 {
		mb.logger.Debug("no images to sync")
		return nil
	}

	// Create image registry
	registry := &ImageRegistry{
		Metadata: ImageRegistryMetadata{
			Version:     "1.0",
			LastUpdated: time.Now(),
			TotalImages: len(dbImages),
		},
		Images: []Image{},
		Indices: ImageRegistryIndices{
			ByName:       map[string]string{},
			ByMediaType:  map[media.MediaType][]string{},
			ByFormat:     map[string][]string{},
			ByDimensions: map[string][]string{},
			ByTags:       map[string][]string{},
			BySelected:   map[string][]string{},
		},
	}

	// Convert database images to JSON format
	for _, dbImage := range dbImages {
		image := mb.convertDBImageToStoreImage(dbImage)
		registry.Images = append(registry.Images, image)

		// Update indices
		imageIDStr := fmt.Sprintf("%d", image.ID)
		registry.Indices.ByName[image.Name] = imageIDStr
		registry.Indices.ByFormat[image.Metadata.Format] = append(registry.Indices.ByFormat[image.Metadata.Format], imageIDStr)

		if image.MediaType != "" {
			registry.Indices.ByMediaType[image.MediaType] = append(registry.Indices.ByMediaType[image.MediaType], imageIDStr)
		}

		dimensionKey := fmt.Sprintf("%dx%d", image.Dimensions.Width, image.Dimensions.Height)
		registry.Indices.ByDimensions[dimensionKey] = append(registry.Indices.ByDimensions[dimensionKey], imageIDStr)

		if image.Selection.IsSelected {
			registry.Indices.BySelected["selected"] = append(registry.Indices.BySelected["selected"], imageIDStr)
		}
		if image.Selection.IsChecked {
			registry.Indices.BySelected["checked"] = append(registry.Indices.BySelected["checked"], imageIDStr)
		}
	}

	// Save to JSON store
	imageStore := NewImageStore(mb.store)
	return imageStore.SaveImageRegistry(registry)
}

// syncPlaylists syncs playlists from SQLite to JSON
func (mb *MigrationBridge) syncPlaylists(ctx context.Context) error {
	mb.logger.Debug("syncing playlists from SQLite to JSON")

	// Get all playlists from SQLite
	dbPlaylists, err := mb.dbOps.GetAllPlaylistsWithImages(ctx)
	if err != nil {
		return fmt.Errorf("failed to get playlists from database: %w", err)
	}

	if len(dbPlaylists) == 0 {
		mb.logger.Debug("no playlists to sync")
		return nil
	}

	playlistStore := NewPlaylistStore(mb.store, mb.logger)

	for _, dbPlaylist := range dbPlaylists {
		playlist := mb.convertDBPlaylistToStorePlaylist(dbPlaylist)
		if err := playlistStore.SavePlaylist(playlist); err != nil {
			return fmt.Errorf("failed to save playlist %s: %w", playlist.Name, err)
		}
	}

	mb.logger.Debug("synced playlists", "count", len(dbPlaylists))
	return nil
}

// syncRuntimeState syncs runtime state from SQLite to JSON
func (mb *MigrationBridge) syncRuntimeState(ctx context.Context) error {
	mb.logger.Debug("syncing runtime state from SQLite to JSON")

	runtimeStore := NewRuntimeStore(mb.store)

	// Get active playlists
	activePlaylists, err := mb.dbOps.GetActivePlaylistsWithImages(ctx)
	if err != nil {
		return fmt.Errorf("failed to get active playlists: %w", err)
	}

	state := &RuntimeState{
		Metadata: RuntimeMetadata{
			Version:       "1.0",
			LastSave:      time.Now(),
			DaemonVersion: "1.0.0-alpha", // Default placeholder version
		},
		ActivePlaylists: make(map[string]*ActivePlaylistState),
		MonitorState: MonitorStateRegistry{
			Monitors:      []MonitorInfo{},
			LastDetection: time.Now(),
			ActiveCount:   0,
		},
		SelectedMonitor: "",
		GlobalSettings: GlobalSettings{
			AutoStart:         true,
			ImageHistoryLimit: 50,
		},
		Statistics: RuntimeStatistics{
			LastStatisticsUpdate: time.Now(),
		},
	}

	// Convert active playlists
	for _, activePlaylist := range activePlaylists {
		monitorName := activePlaylist.ActivePlaylist.Activemonitor
		state.ActivePlaylists[monitorName] = &ActivePlaylistState{
			PlaylistID:   fmt.Sprintf("%d", activePlaylist.ActivePlaylist.ID),
			PlaylistName: activePlaylist.ActivePlaylist.Name,
			StartedAt:    time.Now(), // Current time as start time
			Status:       "active",
			LastActivity: time.Now(),
		}
	}

	return runtimeStore.SaveRuntimeState(state)
}

// syncHistory syncs image history from SQLite to JSON
func (mb *MigrationBridge) syncHistory(ctx context.Context) error {
	mb.logger.Debug("syncing image history from SQLite to JSON")

	// Get image history from SQLite
	dbHistory, err := mb.dbOps.GetImageHistory(ctx, 1000) // Large limit to sync all
	if err != nil {
		return fmt.Errorf("failed to get image history from database: %w", err)
	}

	if len(dbHistory) == 0 {
		mb.logger.Debug("no history to sync")
		return nil
	}

	historyStore := NewHistoryStore(mb.store)

	for _, dbEntry := range dbHistory {
		// Convert database history entry to JSON format
		entry := ImageHistoryEntry{
			ImageID:     fmt.Sprintf("%d", dbEntry.ID),
			ImagePath:   dbEntry.Name,         // Assuming name is path for now
			MediaType:   media.MediaTypeImage, // Default to image
			MonitorName: dbEntry.Monitor,
			SetAt:       time.Now(), // Simplified - use current time
			Success:     func() *bool { b := true; return &b }(),
		}

		err := historyStore.AddImageToHistory(
			entry.ImageID,
			entry.ImagePath,
			entry.MonitorName,
			entry.MediaType,
			nil, // No duration info available
			"",  // No playlist name available
			"",  // No backend info available
		)
		if err != nil {
			mb.logger.Warn("failed to add history entry", "error", err)
		}
	}

	mb.logger.Debug("synced history entries", "count", len(dbHistory))
	return nil
}

// Conversion helper functions

// convertDBImageToStoreImage converts a database image to store image
func (mb *MigrationBridge) convertDBImageToStoreImage(dbImage db.Image) Image {
	// Generate path (database doesn't store full path, just name)
	// This is a simplified conversion - in production you'd want to preserve actual paths
	imagePath := dbImage.Name

	// Detect media type from extension
	mediaType := mb.store.mediaDetector.DetectMediaType(imagePath)

	return Image{
		ID:        dbImage.ID, // Use the database ID directly
		Name:      dbImage.Name,
		Path:      imagePath,
		MediaType: mediaType,
		Dimensions: ImageDimensions{
			Width:  dbImage.Width,
			Height: dbImage.Height,
		},
		Metadata: ImageMetadata{
			Format:   dbImage.Format,
			FileSize: 0,  // Not available from database
			Checksum: "", // Not available from database
			Tags:     []string{},
		},
		Selection: ImageSelection{
			IsChecked:  dbImage.Ischecked == 1,
			IsSelected: dbImage.Isselected == 1,
		},
		ImportInfo: ImageImportInfo{
			ImportedAt: time.Now(), // Use current time as fallback
			Importer:   "sqlite-migration",
		},
	}
}

// convertDBPlaylistToStorePlaylist converts a database playlist to store playlist
func (mb *MigrationBridge) convertDBPlaylistToStorePlaylist(dbPlaylist db.PlaylistWithImages) *Playlist {
	images := make([]PlaylistImage, 0, len(dbPlaylist.Images))
	for i, image := range dbPlaylist.Images {
		mediaType := mb.store.mediaDetector.DetectMediaType(image.Name)
		playlistImage := PlaylistImage{
			ImageID:   fmt.Sprintf("%d", image.ID),
			ImagePath: image.Name, // Simplified - assumes name is path
			MediaType: mediaType,
			Index:     i,
			AddedAt:   time.Now(), // Use current time as fallback
		}
		images = append(images, playlistImage)
	}

	return &Playlist{
		ID:   fmt.Sprintf("%d", dbPlaylist.Playlist.ID),
		Name: dbPlaylist.Playlist.Name,
		Metadata: PlaylistMetadata{
			Version:      "1.0",
			CreatedAt:    time.Now(), // Use current time as fallback
			LastModified: time.Now(),
		},
		Configuration: PlaylistConfiguration{
			Type:                    dbPlaylist.Playlist.Type,
			Interval:                convertNullableInt64(dbPlaylist.Playlist.Interval),
			ShowAnimations:          dbPlaylist.Playlist.Showanimations == 1,
			AlwaysStartOnFirstImage: dbPlaylist.Playlist.Alwaysstartonfirstimage == 1,
			Order:                   getOrderFromDBOrder(dbPlaylist.Playlist.Order),
		},
		Images: images,
		Runtime: &PlaylistRuntime{
			CurrentIndex:    int(dbPlaylist.Playlist.Currentimageindex),
			LastImageChange: time.Now(),
			Status:          "stopped",
			LastAccessed:    time.Now(),
		},
	}
}

// Utility functions

// getOrderFromDBOrder extracts order from database nullable order field
func getOrderFromDBOrder(dbOrder sql.NullString) string {
	if dbOrder.Valid {
		return dbOrder.String
	}
	return "sequential" // Default fallback
}

// Helper function to convert sql.NullInt64 to *int
func convertNullableInt64(ni sql.NullInt64) *int {
	if ni.Valid {
		val := int(ni.Int64)
		return &val
	}
	return nil
}

// generateUUID is defined in playlist_store.go
