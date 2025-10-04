package main

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"os"
	"path/filepath"
	"strconv"
	"time"

	"waypaper-engine/daemon-go/internal/config"
	"waypaper-engine/daemon-go/internal/db"
	"waypaper-engine/daemon-go/internal/image"
	"waypaper-engine/daemon-go/internal/media"
	"waypaper-engine/daemon-go/internal/models"
	"waypaper-engine/daemon-go/internal/store"
)

// SQLiteToJSONMigrator handles the actual conversion from SQLite to JSON
type SQLiteToJSONMigrator struct {
	dbOps     *db.DatabaseOperations
	jsonStore *store.Store
	logger    *slog.Logger
	dryRun    bool
	tomlPath  string
	options   MigrationOptions
}

// getConfig loads the configuration from TOML file
func (migrator *SQLiteToJSONMigrator) getConfig() (*config.WaypaperConfig, error) {
	configManager := config.NewConfigManager(migrator.tomlPath)
	return configManager.GetConfig()
}

// migrateSwwwConfigToToml migrates swww configuration from SQLite to TOML
func (migrator *SQLiteToJSONMigrator) migrateSwwwConfigToToml(tomlPath string) error {
	migrator.logger.Info("Migrating swww configuration to TOML...")

	ctx := context.Background()

	// Check if swww config exists
	dbManager := migrator.dbOps.GetManager()
	var configExists bool
	err := dbManager.Transaction(ctx, func(q *db.Queries) error {
		count, err := q.GetSwwwConfigExists(ctx)
		if err != nil {
			return err
		}
		configExists = count > 0
		return nil
	})
	if err != nil {
		return fmt.Errorf("failed to check swww config existence: %w", err)
	}

	if !configExists {
		migrator.logger.Info("No swww configuration found in SQLite, skipping migration")
		return nil
	}

	if migrator.dryRun {
		migrator.logger.Info("DRY RUN: Would migrate swww config to TOML", "toml_path", tomlPath)
		return nil
	}

	// Get swww config from SQLite
	var swwwConfigJSON string
	err = dbManager.Transaction(ctx, func(q *db.Queries) error {
		var err error
		swwwConfigJSON, err = q.GetSwwwConfig(ctx)
		return err
	})
	if err != nil {
		return fmt.Errorf("failed to get swww config from SQLite: %w", err)
	}

	// Parse JSON to SwwwConfig
	var swwwConfig models.SwwwConfig
	if err := json.Unmarshal([]byte(swwwConfigJSON), &swwwConfig); err != nil {
		return fmt.Errorf("failed to parse swww config JSON: %w", err)
	}

	// Initialize config manager
	configManager := config.NewConfigManager(tomlPath)

	// Load current TOML config
	tomlConfig, err := configManager.LoadConfig()
	if err != nil {
		return fmt.Errorf("failed to load TOML config: %w", err)
	}

	// Map swww config fields to TOML
	tomlConfig.Backend.Type = "swww" // Ensure backend type is swww
	tomlConfig.Backend.Swww.TransitionType = migrator.convertTransitionType(swwwConfig.TransitionType)
	tomlConfig.Backend.Swww.TransitionStep = swwwConfig.TransitionStep
	tomlConfig.Backend.Swww.TransitionDuration = int(swwwConfig.TransitionDuration * 1000) // Convert seconds to milliseconds
	tomlConfig.Backend.Swww.TransitionAngle = swwwConfig.TransitionAngle
	tomlConfig.Backend.Swww.TransitionPos = migrator.convertTransitionPosition(swwwConfig.TransitionPosition)
	tomlConfig.Backend.Swww.TransitionBezier = swwwConfig.TransitionBezier
	tomlConfig.Backend.Swww.TransitionWave = fmt.Sprintf("%d,%d,0,0",
		swwwConfig.TransitionWaveX, swwwConfig.TransitionWaveY)

	// Save updated TOML config
	if err := configManager.SaveConfig(); err != nil {
		return fmt.Errorf("failed to save updated TOML config: %w", err)
	}

	migrator.logger.Info("Successfully migrated swww configuration to TOML",
		"transition_type", tomlConfig.Backend.Swww.TransitionType,
		"transition_duration", tomlConfig.Backend.Swww.TransitionDuration,
		"transition_angle", tomlConfig.Backend.Swww.TransitionAngle)
	return nil
}

// migrateImages migrates all images from SQLite to JSON
func (migrator *SQLiteToJSONMigrator) migrateImages() error {
	migrator.logger.Info("Migrating images...")

	ctx := context.Background()

	if migrator.dryRun {
		var count int64
		dbManager := migrator.dbOps.GetManager()
		err := dbManager.Transaction(ctx, func(q *db.Queries) error {
			images, err := q.GetAllImages(ctx)
			if err != nil {
				return err
			}
			count = int64(len(images))
			return nil
		})
		if err != nil {
			return fmt.Errorf("failed to count images: %w", err)
		}

		migrator.logger.Info("DRY RUN: Would migrate images", "count", count)
		return nil
	}

	// Get images from SQLite
	var dbImages []db.Image
	dbManager := migrator.dbOps.GetManager()
	err := dbManager.Transaction(ctx, func(q *db.Queries) error {
		images, err := q.GetAllImages(ctx)
		if err != nil {
			return err
		}
		dbImages = images
		return nil
	})
	if err != nil {
		return fmt.Errorf("failed to get images: %w", err)
	}

	// Convert to JSON format
	var jsonImages []store.Image
	for _, dbImg := range dbImages {
		// Determine media type based on format
		detector := media.NewDetector()
		mediaType := detector.DetectMediaType(dbImg.Format)

		// Construct full path to original image location
		// The original SQLite system stored images in ~/.waypaper_engine/images/
		homeDir, _ := os.UserHomeDir()
		originalImagePath := filepath.Join(homeDir, ".waypaper_engine", "images", dbImg.Name)

		// Validate path exists if requested
		if migrator.options.ValidatePaths {
			if _, err := os.Stat(originalImagePath); os.IsNotExist(err) {
				migrator.logger.Warn("Image file not found, skipping", "path", originalImagePath, "name", dbImg.Name)
				continue
			}
		}

		// Determine final path based on consolidation option
		finalPath := originalImagePath
		if migrator.options.ConsolidateImages {
			// Move image to consolidated directory
			consolidatedDir := filepath.Join(migrator.options.JSONPath, "images")
			if err := os.MkdirAll(consolidatedDir, 0755); err != nil {
				migrator.logger.Error("Failed to create consolidated images directory", "error", err)
				continue
			}
			
			consolidatedPath := filepath.Join(consolidatedDir, dbImg.Name)
			if err := os.Rename(originalImagePath, consolidatedPath); err != nil {
				migrator.logger.Error("Failed to move image to consolidated directory", "error", err, "from", originalImagePath, "to", consolidatedPath)
				continue
			}
			finalPath = consolidatedPath
			migrator.logger.Debug("Moved image to consolidated directory", "from", originalImagePath, "to", consolidatedPath)
		}

		// Generate multi-resolution thumbnails for the image
		var thumbnailPaths map[string]string
		if !migrator.dryRun {
			// Get thumbnails directory from configuration
			config, err := migrator.getConfig()
			if err == nil {
				// Create multi-resolution thumbnails (migration creates all resolutions for compatibility)
				thumbnailPaths, err = image.CreateMultiResolutionThumbnails(finalPath, config.Daemon.ThumbnailsDir, dbImg.Name)
				if err != nil {
					migrator.logger.Warn("Failed to create multi-resolution thumbnails", "image", dbImg.Name, "error", err)
				} else {
					migrator.logger.Debug("Created multi-resolution thumbnails", "image", dbImg.Name, "thumbnails", len(thumbnailPaths))
				}
			}
		}

		// Convert thumbnail paths to store format
		var storeThumbnails store.ImageThumbnails
		if thumbnailPaths != nil {
			storeThumbnails = store.ImageThumbnails{
				Resolution720p:  thumbnailPaths["720p"],
				Resolution1080p: thumbnailPaths["1080p"],
				Resolution1440p: thumbnailPaths["1440p"],
				Resolution4k:    thumbnailPaths["4k"],
				Fallback:        thumbnailPaths["fallback"],
			}
		}

		jsonImg := store.Image{
			ID:        fmt.Sprintf("%d", dbImg.ID),
			Name:      dbImg.Name,
			Path:      finalPath, // Use final path (original or consolidated)
			MediaType: mediaType,
			Metadata: store.ImageMetadata{
				Format: dbImg.Format,
				// FileSize and other metadata will be populated by image scan
			},
			Dimensions: store.ImageDimensions{
				Width:  dbImg.Width,
				Height: dbImg.Height,
			},
			Selection: store.ImageSelection{
				IsChecked:  dbImg.Ischecked == 1,
				IsSelected: dbImg.Isselected == 1,
			},
			ImportInfo: store.ImageImportInfo{
				ImportedAt: time.Now(),
				Importer:   "sqlite-migration",
			},
			Thumbnails: storeThumbnails,
		}
		jsonImages = append(jsonImages, jsonImg)
	}

	// Create image registry
	registry := store.ImageRegistry{
		Metadata: store.ImageRegistryMetadata{
			Version:     "2.0.0-migrated",
			LastUpdated: time.Now(),
			TotalImages: len(jsonImages),
		},
		Images: jsonImages,
		Indices: store.ImageRegistryIndices{
			ByName:     make(map[string]string),
			ByFormat:   make(map[string][]string),
			BySelected: make(map[string][]string),
		},
	}

	// Build simple indices
	for _, img := range jsonImages {
		registry.Indices.ByName[img.Name] = img.ID
		registry.Indices.ByFormat[img.Metadata.Format] = append(registry.Indices.ByFormat[img.Metadata.Format], img.ID)
		if img.Selection.IsChecked {
			registry.Indices.BySelected["checked"] = append(registry.Indices.BySelected["checked"], img.ID)
		}
		if img.Selection.IsSelected {
			registry.Indices.BySelected["selected"] = append(registry.Indices.BySelected["selected"], img.ID)
		}
	}

	// Save to JSON store
	imageStore := store.NewImageStore(migrator.jsonStore)
	if err := imageStore.SaveImageRegistry(&registry); err != nil {
		return fmt.Errorf("failed to save image registry: %w", err)
	}

	migrator.logger.Info("Migrated images", "count", len(jsonImages))
	return nil
}

// migratePlaylists migrates all playlists from SQLite to JSON
func (migrator *SQLiteToJSONMigrator) migratePlaylists() error {
	migrator.logger.Info("Migrating playlists...")

	ctx := context.Background()

	if migrator.dryRun {
		var count int64
		dbManager := migrator.dbOps.GetManager()
		err := dbManager.Transaction(ctx, func(q *db.Queries) error {
			playlists, err := q.GetAllPlaylists(ctx)
			if err != nil {
				return err
			}
			count = int64(len(playlists))
			return nil
		})
		if err != nil {
			return fmt.Errorf("failed to count playlists: %w", err)
		}

		migrator.logger.Info("DRY RUN: Would migrate playlists", "count", count)
		return nil
	}

	// Get playlists from SQLite
	var dbPlaylists []db.Playlist
	dbManager := migrator.dbOps.GetManager()
	err := dbManager.Transaction(ctx, func(q *db.Queries) error {
		playlists, err := q.GetAllPlaylists(ctx)
		if err != nil {
			return err
		}
		dbPlaylists = playlists
		return nil
	})
	if err != nil {
		return fmt.Errorf("failed to get playlists: %w", err)
	}

	for _, dbPlaylist := range dbPlaylists {
		// Get playlist images
		var playlistImages []db.GetPlaylistImagesOrderedRow
		err = dbManager.Transaction(ctx, func(q *db.Queries) error {
			images, err := q.GetPlaylistImagesOrdered(ctx, dbPlaylist.ID)
			if err != nil {
				return err
			}
			playlistImages = images
			return nil
		})
		if err != nil {
			migrator.logger.Warn("Failed to get playlist images", "playlist", dbPlaylist.Name, "error", err)
			continue
		}

		// Convert playlist images
		var jsonImages []store.PlaylistImage
		for _, img := range playlistImages {
			jsonImg := store.PlaylistImage{
				ImageID: fmt.Sprintf("%d", img.ID),
				Index:   int(img.Time.Int64), // Using Time.Int64 since IndexInPlaylist doesn't exist
			}
			jsonImages = append(jsonImages, jsonImg)
		}

		// Convert playlist order type
		var orderType string
		if dbPlaylist.Order.Valid {
			orderType = dbPlaylist.Order.String
		} else {
			orderType = "sequential"
		}

		// Convert interval
		var interval *int
		if dbPlaylist.Interval.Valid {
			intervalVal := int(dbPlaylist.Interval.Int64)
			interval = &intervalVal
		}

		// Create JSON playlist
		jsonPlaylist := store.Playlist{
			ID:   fmt.Sprintf("%d", dbPlaylist.ID),
			Name: dbPlaylist.Name,
			Metadata: store.PlaylistMetadata{
				Version:      "2.0.0-migrated",
				CreatedAt:    time.Now(),
				LastModified: time.Now(),
			},
			Configuration: store.PlaylistConfiguration{
				Type:                    dbPlaylist.Type,
				Interval:                interval,
				ShowAnimations:          dbPlaylist.Showanimations == 1,
				AlwaysStartOnFirstImage: dbPlaylist.Alwaysstartonfirstimage == 1,
				Order:                   orderType,
			},
			Images: jsonImages,
			Runtime: &store.PlaylistRuntime{
				Status:       "stopped",
				CurrentIndex: int(dbPlaylist.Currentimageindex),
			},
			// Note: Backend configuration is embedded in TOML, not in playlist JSON
		}

		// Save playlist using playlist store
		playlistStore := store.NewPlaylistStore(migrator.jsonStore, migrator.logger)
		if err := playlistStore.SavePlaylist(&jsonPlaylist); err != nil {
			migrator.logger.Error("Failed to save playlist", "name", dbPlaylist.Name, "error", err)
			continue
		}
	}

	migrator.logger.Info("Migrated playlists", "count", len(dbPlaylists))
	return nil
}

// migrateImageHistory migrates image history from SQLite to JSON
func (migrator *SQLiteToJSONMigrator) migrateImageHistory() error {
	migrator.logger.Info("Migrating image history...")

	ctx := context.Background()

	if migrator.dryRun {
		var count int64
		dbManager := migrator.dbOps.GetManager()
		err := dbManager.Transaction(ctx, func(q *db.Queries) error {
			history, err := q.GetImageHistory(ctx, 1000000) // Get all
			if err != nil {
				return err
			}
			count = int64(len(history))
			return nil
		})
		if err != nil {
			return fmt.Errorf("failed to count history entries: %w", err)
		}

		migrator.logger.Info("DRY RUN: Would migrate image history", "count", count)
		return nil
	}

	// Get history from SQLite
	var dbHistory []db.GetImageHistoryRow
	dbManager := migrator.dbOps.GetManager()
	err := dbManager.Transaction(ctx, func(q *db.Queries) error {
		history, err := q.GetImageHistory(ctx, 1000000) // Get all
		if err != nil {
			return err
		}
		dbHistory = history
		return nil
	})
	if err != nil {
		return fmt.Errorf("failed to get image history: %w", err)
	}

	// Convert history entries
	var jsonEntries []store.ImageHistoryEntry
	for _, dbEntry := range dbHistory {
		// Parse timestamp - SQLite stores as string in Unix format
		var displayedAt time.Time
		if dbEntry.Time.Valid && dbEntry.Time.String != "" {
			// Try to parse as Unix timestamp
			if timestamp, err := parseUnixTimestamp(dbEntry.Time.String); err == nil {
				displayedAt = time.Unix(timestamp, 0)
			} else {
				displayedAt = time.Now() // Fallback
			}
		} else {
			displayedAt = time.Now() // Fallback
		}

		jsonEntry := store.ImageHistoryEntry{
			ImageID:     fmt.Sprintf("%d", dbEntry.ID),
			ImagePath:   dbEntry.Name,
			MediaType:   media.MediaTypeImage, // Defaulting to image for migration
			MonitorName: dbEntry.Monitor,
			SetAt:       displayedAt,
		}
		jsonEntries = append(jsonEntries, jsonEntry)
	}

	// Create history structure
	history := store.ImageHistory{
		Metadata: store.ImageHistoryMetadata{
			Version:      "2.0.0-migrated",
			LastCleanup:  time.Now(),
			TotalEntries: int64(len(jsonEntries)),
		},
		Entries: jsonEntries,
	}

	// Save history using history store
	historyStore := store.NewHistoryStore(migrator.jsonStore)
	if err := historyStore.SaveImageHistory(&history); err != nil {
		return fmt.Errorf("failed to save image history: %w", err)
	}

	migrator.logger.Info("Migrated image history", "count", len(jsonEntries))
	return nil
}

// migrateRuntimeState migrates runtime state from SQLite to JSON
func (migrator *SQLiteToJSONMigrator) migrateRuntimeState() error {
	migrator.logger.Info("Migrating runtime state...")

	ctx := context.Background()

	if migrator.dryRun {
		var count int64
		dbManager := migrator.dbOps.GetManager()
		err := dbManager.Transaction(ctx, func(q *db.Queries) error {
			active, err := q.GetActivePlaylists(ctx)
			if err != nil {
				return err
			}
			count = int64(len(active))
			return nil
		})
		if err != nil {
			return fmt.Errorf("failed to count active playlists: %w", err)
		}

		migrator.logger.Info("DRY RUN: Would migrate runtime state", "active_playlists", count)
		return nil
	}

	// Get active playlists
	var activePlaylists []db.GetActivePlaylistsRow
	dbManager := migrator.dbOps.GetManager()
	err := dbManager.Transaction(ctx, func(q *db.Queries) error {
		active, err := q.GetActivePlaylists(ctx)
		if err != nil {
			return err
		}
		activePlaylists = active
		return nil
	})
	if err != nil {
		return fmt.Errorf("failed to get active playlists database transaction error: %w", err)
	}

	// Convert active playlists
	activePlaylistMap := make(map[string]*store.ActivePlaylistState)
	for _, activePlaylist := range activePlaylists {
		monitorName := activePlaylist.Activemonitor
		activePlaylistMap[monitorName] = &store.ActivePlaylistState{
			PlaylistID:   fmt.Sprintf("%d", activePlaylist.ID),
			PlaylistName: activePlaylist.Name,
			StartedAt:    time.Now(), // Original start time not available
			Status:       "active",
			LastActivity: time.Now(),
		}
	}

	// Get selected monitor
	var selectedMonitor string
	err = dbManager.Transaction(ctx, func(q *db.Queries) error {
		monitor, err := q.GetSelectedMonitor(ctx)
		if err != nil {
			return err
		}
		selectedMonitor = monitor
		return nil
	})
	if err != nil {
		migrator.logger.Warn("Failed to get selected monitor", "error", err)
	}

	// Create runtime state
	runtimeState := store.RuntimeState{
		Metadata: store.RuntimeMetadata{
			Version:       "2.0.0-migrated",
			LastSave:      time.Now(),
			DaemonPID:     os.Getpid(),
			DaemonVersion: "2.0.0-migrated",
		},
		ActivePlaylists: activePlaylistMap,
		MonitorState: store.MonitorStateRegistry{
			Monitors:      []store.MonitorInfo{}, // Will be detected at runtime
			TotalDetected: 0,
		},
		SelectedMonitor: selectedMonitor,
		Statistics: store.RuntimeStatistics{
			TotalImagesProcessed:  0,
			TotalPlaylistsCreated: int64(len(activePlaylistMap)),
			TotalImagesSet:        0,
			TotalUptime:           0,
			LastStatisticsUpdate:  time.Now(),
		},
	}

	// Save runtime state using runtime store
	runtimeStore := store.NewRuntimeStore(migrator.jsonStore)
	if err := runtimeStore.SaveRuntimeState(&runtimeState); err != nil {
		return fmt.Errorf("failed to save runtime state: %w", err)
	}

	migrator.logger.Info("Migrated runtime state",
		"active_playlists", len(activePlaylistMap),
		"selected_monitor", selectedMonitor)
	return nil
}

// migrateMonitorState migrates monitor state (placeholder for future enhancement)
func (migrator *SQLiteToJSONMigrator) migrateMonitorState() error {
	migrator.logger.Info("Migrating monitor state...")

	// For now, monitor state is handled as part of runtime state
	// This can be expanded later if there are specific monitor configurations to migrate
	migrator.logger.Info("Monitor state migration completed (deferred to runtime state)")
	return nil
}

// Helper functions for conversion

// convertTransitionType converts from SQL models to TOML format
func (migrator *SQLiteToJSONMigrator) convertTransitionType(transitionType models.TransitionType) string {
	switch transitionType {
	case models.TransitionTypeSimple:
		return "simple"
	case models.TransitionTypeFade:
		return "fade"
	case models.TransitionTypeWipe:
		return "wipe"
	case models.TransitionTypeGrow:
		return "grow"
	case models.TransitionTypeOuter:
		return "outer"
	case models.TransitionTypeWave:
		return "wave"
	case models.TransitionTypeRandom:
		return "random"
	default:
		return "simple" // Default fallback
	}
}

// convertTransitionPosition converts from SQL models to TOML format
func (migrator *SQLiteToJSONMigrator) convertTransitionPosition(position models.TransitionPosition) string {
	switch position {
	case models.TransitionPositionCenter:
		return "center"
	case models.TransitionPositionTop:
		return "top"
	case models.TransitionPositionBottom:
		return "bottom"
	case models.TransitionPositionLeft:
		return "left"
	case models.TransitionPositionRight:
		return "right"
	default:
		return "center" // Default fallback
	}
}

// parseUnixTimestamp safely parses Unix timestamp string
func parseUnixTimestamp(timestampStr string) (int64, error) {
	// Try to parse as integer first
	if timestamp, err := strconv.ParseInt(timestampStr, 10, 64); err == nil {
		return timestamp, nil
	}
	// Try to parse as float (in case it includes decimals)
	if timestampFloat, err := strconv.ParseFloat(timestampStr, 64); err == nil {
		return int64(timestampFloat), nil
	}
	return 0, fmt.Errorf("unable to parse timestamp: %s", timestampStr)
}
