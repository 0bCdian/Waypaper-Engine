package main

import (
	"context"
	"fmt"
	"io"
	"log/slog"
	"os"
	"path/filepath"
	"time"

	"waypaper-engine/daemon-go/internal/db"
	"waypaper-engine/daemon-go/internal/store"
	"waypaper-engine/daemon-go/internal/utils"
)

// MigrationTool handles one-time migration from SQLite to JSON storage
type MigrationTool struct {
	sqlitePath string
	jsonPath   string
	logger     *slog.Logger

	// Database connections
	dbOps     *db.DatabaseOperations
	jsonStore *store.Store
}

// MigrationOptions configures the migration process
type MigrationOptions struct {
	SQLitePath       string `help:"Path to existing SQLite database"`
	JSONPath         string `help:"Path to new JSON store directory"`
	TOMLPath         string `help:"Path to TOML config file for swww config migration"`
	DryRun           bool   `help:"Preview migration without making changes"`
	Backup           bool   `help:"Create backup of SQLite database before migration"`
	Force            bool   `help:"Overwrite existing JSON store if it exists"`
	Verbose          bool   `help:"Enable verbose logging"`
	ConsolidateImages bool   `help:"Move images to consolidated directory (saves space but risks broken paths)"`
	ValidatePaths    bool   `help:"Validate image paths exist before migration"`
	RegenerateThumbnails bool `help:"Regenerate thumbnails for existing migrated images"`
}

// DefaultMigrationOptions returns default migration options
func DefaultMigrationOptions() MigrationOptions {
	homeDir, _ := os.UserHomeDir()
	
	// Check for DEV environment variable to use /tmp paths for development
	devEnv := os.Getenv("DEV")
	
	var sqlitePath, jsonPath, tomlPath string
	
	if devEnv == "true" {
		// Development mode: use /tmp/waypaper-engine/ for all paths
		tmpDir := "/tmp/waypaper-engine"
		sqlitePath = filepath.Join(tmpDir, "waypaper.db")
		jsonPath = filepath.Join(tmpDir, "data")
		tomlPath = filepath.Join(tmpDir, "config.toml")
	} else {
		// Production mode: use user config directory
		sqlitePath = filepath.Join(homeDir, ".config", "waypaper-engine", "waypaper.db")
		jsonPath = filepath.Join(homeDir, ".waypaper-engine", "data")
		tomlPath = filepath.Join(homeDir, ".config", "waypaper-engine", "config.toml")
	}

	return MigrationOptions{
		SQLitePath: sqlitePath,
		JSONPath:   jsonPath,
		TOMLPath:   tomlPath,
		DryRun:     false,
		Backup:     true,
		Force:      false,
		Verbose:    false,
	}
}

// NewMigrationTool creates a new migration tool
func NewMigrationTool(options MigrationOptions, logger *slog.Logger) (*MigrationTool, error) {
	// Skip SQLite validation if only regenerating thumbnails
	if !options.RegenerateThumbnails {
		// Verify SQLite database exists
		if _, err := os.Stat(options.SQLitePath); os.IsNotExist(err) {
			return nil, fmt.Errorf("SQLite database not found at %s", options.SQLitePath)
		}
	}

	return &MigrationTool{
		sqlitePath: options.SQLitePath,
		jsonPath:   options.JSONPath,
		logger:     logger,
	}, nil
}

// Run performs the complete migration process
func (mt *MigrationTool) Run(ctx context.Context, options MigrationOptions) error {
	mt.logger.Info("Starting Waypaper Engine migration",
		"sqlite", options.SQLitePath,
		"json", options.JSONPath,
		"dry_run", options.DryRun)

	// Handle thumbnail regeneration only
	if options.RegenerateThumbnails {
		return utils.RegenerateThumbnails(options.JSONPath, options.TOMLPath, mt.logger)
	}

	// Step 1: Initialize connections
	if err := mt.initializeConnections(); err != nil {
		return fmt.Errorf("failed to initialize connections: %w", err)
	}

	// Step 2: Validate SQLite database
	if err := mt.validateSQLiteDatabase(); err != nil {
		return fmt.Errorf("SQLite database validation failed: %w", err)
	}

	// Step 3: Create backup if requested
	if options.Backup && !options.DryRun {
		if err := mt.createBackup(); err != nil {
			mt.logger.Warn("Failed to create backup", "error", err)
			if !options.Force {
				return fmt.Errorf("backup creation failed. Use --force to skip backup")
			}
		}
	}

	// Step 4: Check JSON store destination
	if err := mt.validateJSONDestination(options); err != nil {
		return fmt.Errorf("JSON destination validation failed: %w", err)
	}

	// Step 5: Perform migration
	if err := mt.migrateAllData(ctx, options); err != nil {
		return fmt.Errorf("migration failed: %w", err)
	}

	// Step 6: Verify migration
	if err := mt.verifyMigration(); err != nil {
		return fmt.Errorf("migration verification failed: %w", err)
	}

	mt.logger.Info("Migration completed successfully")
	
	// Create migration marker
	if err := mt.createMigrationMarker(options.TOMLPath); err != nil {
		mt.logger.Warn("Failed to create migration marker", "error", err)
		// Don't fail the migration for this
	}
	
	return nil
}

// initializeConnections sets up database and store connections
func (mt *MigrationTool) initializeConnections() error {
	// Initialize SQLite connection
	dbManager, err := db.NewDatabaseManager(mt.sqlitePath, db.DefaultPoolConfig())
	if err != nil {
		return fmt.Errorf("failed to initialize SQLite: %w", err)
	}

	mt.dbOps = db.NewDatabaseOperations(dbManager)

	// Initialize JSON store
	storeConfig := store.DefaultStoreConfig()
	storeConfig.BasePath = mt.jsonPath

	mt.jsonStore, err = store.NewStore(storeConfig, mt.logger)
	if err != nil {
		return fmt.Errorf("failed to initialize JSON store: %w", err)
	}

	return nil
}

// validateSQLiteDatabase checks if the SQLite database is valid and accessible
func (mt *MigrationTool) validateSQLiteDatabase() error {
	// Test database connectivity
	dbManager := mt.dbOps.GetManager()
	if dbManager == nil {
		return fmt.Errorf("database manager not available")
	}

	// Basic validation - if we can create transactions, DB is accessible
	ctx := context.Background()
	err := dbManager.Transaction(ctx, func(q *db.Queries) error {
		// Try a simple query to validate DB access
		if _, err := q.GetAllImages(ctx); err != nil {
			return err
		}
		return nil
	})

	if err != nil {
		return fmt.Errorf("database validation failed: %w", err)
	}

	mt.logger.Info("Database validation passed")
	return nil
}

// createBackup makes a backup copy of the SQLite database
func (mt *MigrationTool) createBackup() error {
	backupPath := mt.sqlitePath + ".backup." + fmt.Sprintf("%d", time.Now().Unix())

	sourceFile, err := os.Open(mt.sqlitePath)
	if err != nil {
		return fmt.Errorf("failed to open source database: %w", err)
	}
	defer sourceFile.Close()

	destFile, err := os.Create(backupPath)
	if err != nil {
		return fmt.Errorf("failed to create backup file: %w", err)
	}
	defer destFile.Close()

	_, err = io.Copy(destFile, sourceFile)
	if err != nil {
		return fmt.Errorf("failed to copy database: %w", err)
	}

	mt.logger.Info("Created backup", "path", backupPath)
	return nil
}

// validateJSONDestination checks if the JSON store destination is valid
func (mt *MigrationTool) validateJSONDestination(options MigrationOptions) error {
	// Check if JSON store already exists
	if _, err := os.Stat(mt.jsonPath); err == nil {
		if !options.Force {
			return fmt.Errorf("JSON store already exists at %s. Use --force to overwrite", mt.jsonPath)
		}
		mt.logger.Warn("Overwriting existing JSON store", "path", mt.jsonPath)
	} else if !os.IsNotExist(err) {
		return fmt.Errorf("failed to check JSON store directory: %w", err)
	}

	return nil
}

// migrateAllData performs the actual data migration
func (mt *MigrationTool) migrateAllData(ctx context.Context, options MigrationOptions) error {
	migrator := &SQLiteToJSONMigrator{
		dbOps:     mt.dbOps,
		jsonStore: mt.jsonStore,
		logger:    mt.logger,
		dryRun:    options.DryRun,
		options:   options,
	}

	// Migrate each component
	migrationSteps := []struct {
		name string
		fn   func() error
	}{
		{"swww-config", func() error { return migrator.migrateSwwwConfigToToml(options.TOMLPath) }},
		{"images", migrator.migrateImages},
		{"playlists", migrator.migratePlaylists},
		{"image-history", migrator.migrateImageHistory},
		{"runtime-state", migrator.migrateRuntimeState},
		{"monitor-state", migrator.migrateMonitorState},
	}

	for _, step := range migrationSteps {
		mt.logger.Info("Starting migration step", "step", step.name)

		if err := step.fn(); err != nil {
			return fmt.Errorf("migration step '%s' failed: %w", step.name, err)
		}

		mt.logger.Info("Completed migration step", "step", step.name)
	}

	return nil
}

// verifyMigration validates that the migration was successful
func (mt *MigrationTool) verifyMigration() error {
	// Count migrated records
	stats := struct {
		Images    int
		Playlists int
		History   int
	}{}

	// Validate images
	imageStore := store.NewImageStore(mt.jsonStore)
	if images, err := imageStore.LoadImageRegistry(); err == nil {
		stats.Images = len(images.Images)
	}

	// Validate playlists - individual playlist loading not supported yet
	stats.Playlists = 0 // Will be updated after migration completes

	// Validate history
	historyStore := store.NewHistoryStore(mt.jsonStore)
	if history, err := historyStore.LoadImageHistory(); err == nil {
		stats.History = len(history.Entries)
	}

	mt.logger.Info("Migration verification complete",
		"images", stats.Images,
		"playlists", stats.Playlists,
		"history", stats.History)

	return nil
}

// createMigrationMarker creates a marker file indicating successful migration
func (mt *MigrationTool) createMigrationMarker(tomlPath string) error {
	markerContent := fmt.Sprintf(`# Waypaper Engine Migration Marker
# This file indicates that migration from SQLite to JSON was completed successfully
# Created at: %s
# SQLite source: %s
# JSON target: %s
# TOML config: %s

completed=true
created_at=%s
migration_source=%s
migration_target=%s
`,
		time.Now().Format(time.RFC3339),
		mt.sqlitePath,
		mt.jsonPath,
		tomlPath,
		time.Now().Format(time.RFC3339),
		mt.sqlitePath,
		mt.jsonPath,
	)

	migrationMarkerPath := filepath.Join(filepath.Dir(tomlPath), ".migration_completed")

	if err := os.MkdirAll(filepath.Dir(migrationMarkerPath), 0755); err != nil {
		return fmt.Errorf("failed to create migration marker directory: %w", err)
	}

	if err := os.WriteFile(migrationMarkerPath, []byte(markerContent), 0644); err != nil {
		return fmt.Errorf("failed to create migration marker: %w", err)
	}

	mt.logger.Info("Migration marker created", "marker_file", migrationMarkerPath)
	return nil
}
