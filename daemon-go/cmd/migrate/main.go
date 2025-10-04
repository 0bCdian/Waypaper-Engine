package main

import (
	"context"
	"flag"
	"fmt"
	"log/slog"
	"os"
	"time"
)

func main() {
	var (
		sqlitePath     = flag.String("sqlite", "", "Path to existing SQLite database")
		jsonPath       = flag.String("json", "", "Path to new JSON store directory")
		tomlPath       = flag.String("toml", "", "Path to TOML config file for swww config migration")
		dryRun         = flag.Bool("dry-run", false, "Preview migration without making changes")
		backup         = flag.Bool("backup", true, "Create backup of SQLite database before migration")
		force          = flag.Bool("force", false, "Overwrite existing JSON store if it exists")
		verbose        = flag.Bool("verbose", false, "Enable verbose logging")
		help           = flag.Bool("help", false, "Show help information")
		consolidateImages = flag.Bool("consolidate-images", false, "Move images to consolidated directory (saves space but risks broken paths)")
		validatePaths  = flag.Bool("validate-paths", true, "Validate image paths exist before migration")
		regenerateThumbnails = flag.Bool("regenerate-thumbnails", false, "Regenerate thumbnails for existing migrated images")
	)

	flag.Parse()

	if *help {
		showHelp()
		return
	}

	// Get default paths from configuration (respects DEV environment variable)
	defaultOptions := DefaultMigrationOptions()
	
	if *sqlitePath == "" {
		*sqlitePath = defaultOptions.SQLitePath
	}

	if *jsonPath == "" {
		*jsonPath = defaultOptions.JSONPath
	}

	if *tomlPath == "" {
		*tomlPath = defaultOptions.TOMLPath
	}

	// Set up logging
	logLevel := slog.LevelInfo
	if *verbose {
		logLevel = slog.LevelDebug
	}

	logger := slog.New(slog.NewTextHandler(os.Stdout, &slog.HandlerOptions{
		Level: logLevel,
	}))

	// Create migration options
	options := MigrationOptions{
		SQLitePath:       *sqlitePath,
		JSONPath:         *jsonPath,
		TOMLPath:         *tomlPath,
		DryRun:           *dryRun,
		Backup:           *backup,
		Force:            *force,
		Verbose:          *verbose,
		ConsolidateImages: *consolidateImages,
		ValidatePaths:    *validatePaths,
		RegenerateThumbnails: *regenerateThumbnails,
	}

	logger.Info("Waypaper Engine Migration Tool",
		"sqlite", options.SQLitePath,
		"json", options.JSONPath,
		"toml", options.TOMLPath,
		"dry_run", options.DryRun,
		"backup", options.Backup,
		"force", options.Force)

	// Validate inputs
	if err := validateOptions(options); err != nil {
		logger.Error("Validation failed", "error", err)
		os.Exit(1)
	}

	// Create and run migration tool
	tool, err := NewMigrationTool(options, logger)
	if err != nil {
		logger.Error("Failed to create migration tool", "error", err)
		os.Exit(1)
	}

	ctx := context.Background()

	start := time.Now()
	if err := tool.Run(ctx, options); err != nil {
		logger.Error("Migration failed", "error", err, "duration", time.Since(start))
		os.Exit(1)
	}

	duration := time.Since(start)
	logger.Info("Migration completed successfully!",
		"duration", duration,
		"sqlite_backup", options.Backup && !options.DryRun,
		"next_steps", []string{
			"Stop any running Waypaper Engine instances",
			"Update to the new version with JSON support",
			"Remove the old SQLite database if migration looks correct",
		})
}

func validateOptions(options MigrationOptions) error {
	// Skip SQLite validation if only regenerating thumbnails
	if options.RegenerateThumbnails {
		return nil
	}

	// Check SQLite database exists
	if _, err := os.Stat(options.SQLitePath); os.IsNotExist(err) {
		return fmt.Errorf("SQLite database not found: %s", options.SQLitePath)
	}

	// Check SQLite database is readable
	if _, err := os.Open(options.SQLitePath); err != nil {
		return fmt.Errorf("cannot read SQLite database: %w", err)
	}

	return nil
}

func showHelp() {
	fmt.Printf(`Waypaper Engine Migration Tool

This tool migrates your existing SQLite-based Waypaper Engine database to the new JSON-based storage format.

USAGE:
    %s [OPTIONS]

OPTIONS:
    -sqlite PATH    Path to existing SQLite database
                    Default: ~/.config/waypaper-engine/waypaper.db
                    (or /tmp/waypaper-engine/waypaper.db if DEV=true)

    -json PATH      Path to new JSON store directory  
                    Default: ~/.waypaper-engine/data
                    (or /tmp/waypaper-engine/data if DEV=true)

    -toml PATH      Path to TOML config file for swww config migration
                    Default: ~/.config/waypaper-engine/config.toml
                    (or /tmp/waypaper-engine/config.toml if DEV=true)

    -dry-run        Preview migration without making changes
                    Use this to see what would be migrated

    -backup         Create backup of SQLite database (default: true)
                    Backup is created as {sqlite-path}.backup.{timestamp}

    -force          Overwrite existing JSON store if it exists
                    Use with caution - this will delete existing JSON data

    -verbose        Enable verbose logging
                    Shows detailed migration progress

    -help           Show this help message

ENVIRONMENT VARIABLES:
    DEV=true         Use /tmp/waypaper-engine/ paths for development
                    This makes the migration tool use temporary paths
                    instead of user home directory paths

EXAMPLES:
    # Basic migration using default paths
    %s

    # Preview migration without changes
    %s -dry-run

    # Migrate with custom paths
    %s -sqlite /custom/path/db.sqlite -json /custom/json/store

    # Force overwrite existing JSON store
    %s -force -verbose

    # Development mode (uses /tmp paths)
    DEV=true %s -dry-run

MIGRATION PROCESS:
   1. Validates SQLite database is accessible
   2. Creates backup of SQLite database (unless --backup=false)
   3. Migrates swww configuration from SQLite to TOML config file
   4. Migrates images, playlists, image history, and runtime state
   5. Verifies migration completed successfully
   6. Provides next steps for full migration

AFTER MIGRATION:
   1. Stop any running Waypaper Engine instances
   2. Update to new version with JSON support
   3. Verify everything works correctly
   4. Remove old SQLite database (keep backup for safety)

TROUBLESHOOTING:
   - Use -dry-run to preview changes safely
   - Check -verbose logs for detailed information
   - Ensure no Waypaper Engine instances are running
   - Verify disk space available for migration

`, os.Args[0], os.Args[0], os.Args[0], os.Args[0], os.Args[0])
}
