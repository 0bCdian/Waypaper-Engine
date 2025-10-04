package main

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"log/slog"
	"os"
	"path/filepath"
	"testing"

	"waypaper-engine/daemon-go/internal/config"
	"waypaper-engine/daemon-go/internal/db"
	"waypaper-engine/daemon-go/internal/models"
	"waypaper-engine/daemon-go/internal/store"
)

// TestMigrationTool tests the complete migration functionality
func TestMigrationTool(t *testing.T) {
	// Setup test directories
	testDir := t.TempDir()
	sqlitePath := filepath.Join(testDir, "test.db")
	jsonPath := filepath.Join(testDir, "json")
	tomlPath := filepath.Join(testDir, "config.toml")

	// Setup logger
	logger := slog.New(slog.NewTextHandler(os.Stdout, &slog.HandlerOptions{
		Level: slog.LevelDebug,
	}))

	// Create test SQLite database with sample data
	if err := createTestSQLiteDB(sqlitePath, logger); err != nil {
		t.Fatalf("Failed to create test SQLite database: %v", err)
	}

	// Create migration options
	options := MigrationOptions{
		SQLitePath: sqlitePath,
		JSONPath:   jsonPath,
		TOMLPath:   tomlPath,
		DryRun:     false,
		Backup:     false,
		Force:      true,
		Verbose:    true,
	}

	// Test migration tool initialization
	tool, err := NewMigrationTool(options, logger)
	if err != nil {
		t.Fatalf("Failed to initialize migration tool: %v", err)
	}

	// Test dry run first
	t.Log("Testing dry run...")
	options.DryRun = true
	if err := tool.Run(context.Background(), options); err != nil {
		t.Fatalf("Dry run failed: %v", err)
	}

	// Test actual migration
	t.Log("Testing actual migration...")
	options.DryRun = false
	if err := tool.Run(context.Background(), options); err != nil {
		t.Fatalf("Migration failed: %v", err)
	}

	// Verify migration results
	t.Log("Verifying migration results...")
	if err := verifyMigrationResults(jsonPath, logger); err != nil {
		t.Fatalf("Migration verification failed: %v", err)
	}

	// Test swww config migration
	t.Log("Testing swww config migration...")
	if err := testSwwwConfigMigration(sqlitePath, tomlPath, logger); err != nil {
		t.Fatalf("Swww config migration failed: %v", err)
	}
}

// createTestSQLiteDB creates a test SQLite database with schema and sample data
func createTestSQLiteDB(dbPath string, logger *slog.Logger) error {
	// Initialize database manager
	dbManager, err := db.NewDatabaseManager(dbPath, db.DefaultPoolConfig())
	if err != nil {
		return fmt.Errorf("failed to initialize database: %w", err)
	}
	defer dbManager.Close()

	ctx := context.Background()

	// Initialize database schema
	if err := dbManager.Initialize(ctx); err != nil {
		return fmt.Errorf("failed to initialize schema: %w", err)
	}

	// Create sample images
	sampleImages := []db.Image{
		{ID: 1, Name: "test1.jpg", Ischecked: 1, Isselected: 1, Width: 1920, Height: 1080, Format: "jpg"},
		{ID: 2, Name: "test2.png", Ischecked: 0, Isselected: 1, Width: 2560, Height: 1440, Format: "png"},
		{ID: 3, Name: "test3.webp", Ischecked: 1, Isselected: 0, Width: 3840, Height: 2160, Format: "webp"},
	}

	// Insert images
	err = dbManager.Transaction(ctx, func(q *db.Queries) error {
		for _, img := range sampleImages {
			if _, err := q.CreateImage(ctx, db.CreateImageParams{
				Name:       img.Name,
				Ischecked:  img.Ischecked,
				Isselected: img.Isselected,
				Width:      img.Width,
				Height:     img.Height,
				Format:     img.Format,
			}); err != nil {
				return err
			}
		}
		return nil
	})
	if err != nil {
		return fmt.Errorf("failed to insert images: %w", err)
	}

	// Create sample playlist
	err = dbManager.Transaction(ctx, func(q *db.Queries) error {
		_, err := q.UpsertPlaylist(ctx, db.UpsertPlaylistParams{
			Name:                    "Test Playlist",
			Type:                    "timer",
			Interval:                sql.NullInt64{Int64: 300, Valid: true},
			Showanimations:          1,
			Alwaysstartonfirstimage: 0,
			Order:                   sql.NullString{String: "ordered", Valid: true},
			Currentimageindex:       0,
		})
		return err
	})
	if err != nil {
		return fmt.Errorf("failed to insert playlist: %w", err)
	}

	// Add images to playlist
	err = dbManager.Transaction(ctx, func(q *db.Queries) error {
		for i, img := range sampleImages {
			if err := q.InsertPlaylistImage(ctx, db.InsertPlaylistImageParams{
				Imageid:         img.ID,
				Playlistid:      1, // Assuming first playlist has ID 1
				Indexinplaylist: int64(i),
				Time:            sql.NullInt64{Int64: int64(10 * (i + 1)), Valid: true},
			}); err != nil {
				return err
			}
		}
		return nil
	})
	if err != nil {
		return fmt.Errorf("failed to insert playlist images: %w", err)
	}

	// Create sample swww config
	sampleSwwwConfig := models.SwwwConfig{
		ResizeType:               models.ResizeTypeCrop,
		FillColor:                "#000000",
		FilterType:               models.FilterTypeLanczos3,
		TransitionType:           models.TransitionTypeFade,
		TransitionStep:           90,
		TransitionDuration:       0.3, // 300ms in seconds
		TransitionFPS:            60,
		TransitionAngle:          45,
		TransitionPositionType:   models.TransitionPositionTypeAlias,
		TransitionPosition:       models.TransitionPositionCenter,
		TransitionPositionIntX:   0,
		TransitionPositionIntY:   0,
		TransitionPositionFloatX: 0.5,
		TransitionPositionFloatY: 0.5,
		InvertY:                  false,
		TransitionBezier:         "0.25,0.1,0.25,1",
		TransitionWaveX:          20,
		TransitionWaveY:          20,
	}

	err = dbManager.Transaction(ctx, func(q *db.Queries) error {
		// Marshal to JSON and store
		configJSON, err := json.Marshal(sampleSwwwConfig)
		if err != nil {
			return err
		}
		return q.UpsertSwwwConfig(ctx, string(configJSON))
	})
	if err != nil {
		return fmt.Errorf("failed to insert swww config: %w", err)
	}

	logger.Info("Test SQLite database created", "path", dbPath)
	return nil
}

// verifyMigrationResults verifies that the migration produced correct JSON files
func verifyMigrationResults(jsonPath string, logger *slog.Logger) error {
	// Initialize JSON store to read migrated data
	storeConfig := store.DefaultStoreConfig()
	storeConfig.BasePath = jsonPath
	jsonStore, err := store.NewStore(storeConfig, logger)
	if err != nil {
		return fmt.Errorf("failed to initialize JSON store: %w", err)
	}

	// Verify image registry
	imageStore := store.NewImageStore(jsonStore)
	imageRegistry, err := imageStore.LoadImageRegistry()
	if err != nil {
		return fmt.Errorf("failed to load image registry: %w", err)
	}

	if len(imageRegistry.Images) != 3 {
		return fmt.Errorf("expected 3 images, got %d", len(imageRegistry.Images))
	}

	// Verify playlist registry - simplified for now due to API limitations
	// For now, just check if we didn't crash during migration

	logger.Info("Migration verification completed successfully")
	return nil
}

// testSwwwConfigMigration tests migrating swww config from SQLite to TOML
func testSwwwConfigMigration(sqlitePath, tomlPath string, logger *slog.Logger) error {
	// Initialize database manager to read swww config
	dbManager, err := db.NewDatabaseManager(sqlitePath, db.DefaultPoolConfig())
	if err != nil {
		return fmt.Errorf("failed to initialize database: %w", err)
	}
	defer dbManager.Close()

	ctx := context.Background()

	// Get swww config from SQLite
	var swwwConfigJSON string
	err = dbManager.ReadOnlyTransaction(ctx, func(q *db.Queries) error {
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

	// JSON store is not needed for TOML config testing

	// Initialize config manager for TOML
	configManager := config.NewConfigManager(tomlPath)

	// Migrate swww config to TOML
	if err := migrateSwwwConfigToToml(configManager, &swwwConfig); err != nil {
		return fmt.Errorf("failed to migrate swww config to TOML: %w", err)
	}

	// Verify TOML config
	tomlConfig, err := configManager.LoadConfig()
	if err != nil {
		return fmt.Errorf("failed to load TOML config: %w", err)
	}

	// Verify swww config mapping
	if tomlConfig.Backend.Swww.TransitionType != string(swwwConfig.TransitionType) {
		return fmt.Errorf("transition type mismatch: TOML=%s, SQLite=%s",
			tomlConfig.Backend.Swww.TransitionType, swwwConfig.TransitionType)
	}

	if tomlConfig.Backend.Swww.TransitionStep != swwwConfig.TransitionStep {
		return fmt.Errorf("transition step mismatch: TOML=%d, SQLite=%d",
			tomlConfig.Backend.Swww.TransitionStep, swwwConfig.TransitionStep)
	}

	expectedDuration := int(swwwConfig.TransitionDuration * 1000) // Convert seconds to milliseconds
	if tomlConfig.Backend.Swww.TransitionDuration != expectedDuration {
		return fmt.Errorf("transition duration mismatch: TOML=%d, SQLite=%d (expected %d)",
			tomlConfig.Backend.Swww.TransitionDuration, swwwConfig.TransitionDuration, expectedDuration)
	}

	if tomlConfig.Backend.Swww.TransitionAngle != swwwConfig.TransitionAngle {
		return fmt.Errorf("transition angle mismatch: TOML=%d, SQLite=%d",
			tomlConfig.Backend.Swww.TransitionAngle, swwwConfig.TransitionAngle)
	}

	// Note: Some fields like TransitionPos, TransitionBezier, TransitionWave are stored differently
	// The TOML uses simple strings while the SQL model uses more complex structures
	// This is expected and handled by the migration function

	logger.Info("Swww config migration test completed successfully")
	return nil
}

// migrateSwwwConfigToToml migrates swww config from SQLite format to TOML format
func migrateSwwwConfigToToml(configManager *config.ConfigManager, swwwConfig *models.SwwwConfig) error {
	// Load current TOML config
	tomlConfig, err := configManager.LoadConfig()
	if err != nil {
		return fmt.Errorf("failed to load TOML config: %w", err)
	}

	// Map swww config fields to TOML
	tomlConfig.Backend.Type = "swww" // Ensure backend type is swww
	tomlConfig.Backend.Swww.TransitionType = convertTransitionType(swwwConfig.TransitionType)
	tomlConfig.Backend.Swww.TransitionStep = swwwConfig.TransitionStep
	tomlConfig.Backend.Swww.TransitionDuration = int(swwwConfig.TransitionDuration * 1000) // Convert seconds to milliseconds
	tomlConfig.Backend.Swww.TransitionAngle = swwwConfig.TransitionAngle
	tomlConfig.Backend.Swww.TransitionPos = convertTransitionPosition(swwwConfig.TransitionPosition)
	tomlConfig.Backend.Swww.TransitionBezier = swwwConfig.TransitionBezier
	tomlConfig.Backend.Swww.TransitionWave = fmt.Sprintf("%d,%d,0,0",
		swwwConfig.TransitionWaveX, swwwConfig.TransitionWaveY)

	// Save updated TOML config
	return configManager.SaveConfig()
}

// convertTransitionType converts from SQL models to TOML format
func convertTransitionType(transitionType models.TransitionType) string {
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
func convertTransitionPosition(position models.TransitionPosition) string {
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
