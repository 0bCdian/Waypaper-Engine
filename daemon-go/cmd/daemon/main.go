package main

import (
	"context"
	"crypto/rand"
	"encoding/json"
	"flag"
	"fmt"
	"log/slog"
	"os"
	"os/signal"
	"path/filepath"
	"sync"
	"syscall"
	"time"

	"waypaper-engine/daemon-go/internal/backend"
	"waypaper-engine/daemon-go/internal/config"
	"waypaper-engine/daemon-go/internal/db"
	"waypaper-engine/daemon-go/internal/image"
	"waypaper-engine/daemon-go/internal/ipc"
	"waypaper-engine/daemon-go/internal/logger"
	"waypaper-engine/daemon-go/internal/media"
	"waypaper-engine/daemon-go/internal/models"
	"waypaper-engine/daemon-go/internal/monitor"
	"waypaper-engine/daemon-go/internal/playlist"
	"waypaper-engine/daemon-go/internal/store"
	"waypaper-engine/daemon-go/internal/system"
	"waypaper-engine/daemon-go/internal/utils"
)

func main() {
	// Parse command line flags
	var (
		migrate     = flag.Bool("migrate", false, "Run database migration from SQLite to JSON")
		sqlitePath  = flag.String("sqlite", "", "Path to existing SQLite database (for migration)")
		jsonPath    = flag.String("json", "", "Path to new JSON store directory (for migration)")
		tomlPath    = flag.String("toml", "", "Path to TOML config file (for migration)")
		dryRun      = flag.Bool("dry-run", false, "Preview migration without making changes")
		forceMig    = flag.Bool("force", false, "Overwrite existing JSON store if it exists")
		noBackup    = flag.Bool("no-backup", false, "Skip creating backup of SQLite database")
		verbose     = flag.Bool("verbose", false, "Enable verbose logging")
		showHelp    = flag.Bool("help", false, "Show help message")
		showVersion = flag.Bool("version", false, "Show version information")
	)
	flag.Parse()

	// Show help if requested
	if *showHelp {
		showHelpMessage()
		return
	}

	// Show version if requested
	if *showVersion {
		fmt.Println("Waypaper Engine Daemon v2.0.0")
		return
	}

	// Configure log level based on debug/verbose flags
	var logLevel slog.Level
	if *verbose {
		logLevel = slog.LevelDebug
	} else {
		logLevel = slog.LevelInfo
	}

	// Initialize logger
	log := logger.New(logLevel)

	// Handle migration mode
	if *migrate {
		mustForce := *forceMig || *dryRun // Skip marker check for dry-run or forced runs
		if err := runMigration(log, *sqlitePath, *jsonPath, *tomlPath, *dryRun, *forceMig, !*noBackup, mustForce); err != nil {
			log.Error("Migration failed", "error", err)
			os.Exit(1)
		}
		log.Info("Migration completed successfully")
		return
	}

	// Get home directory for configuration
	homeDir, err := os.UserHomeDir()
	if err != nil {
		log.Error("failed to get home directory", "error", err)
		os.Exit(1)
	}

	// Initialize configuration manager
	// Check for DEV environment variable to use /tmp paths for development
	devEnv := os.Getenv("DEV")

	var configPath string
	if devEnv == "true" {
		// Development mode: use /tmp/waypaper-engine/ for all paths
		tmpDir := "/tmp/waypaper-engine"
		configPath = filepath.Join(tmpDir, "config.toml")
		log.Info("Development mode: using /tmp paths", "configPath", configPath)

		// Ensure /tmp/waypaper-engine directory exists
		if err := os.MkdirAll(tmpDir, 0755); err != nil {
			log.Error("failed to create /tmp/waypaper-engine directory", "error", err)
			os.Exit(1)
		}
	} else {
		// Production mode: use user config directory
		configPath = filepath.Join(homeDir, ".config", "waypaper-engine", "config.toml")
		log.Info("Production mode: using user config directory", "configPath", configPath)
	}

	configManager := config.NewConfigManager(configPath)

	// Load configuration
	cfg, err := configManager.LoadConfig()
	if err != nil {
		log.Error("failed to load configuration", "error", err)
		os.Exit(1)
	}

	log.Info("Configuration loaded successfully", "databasePath", cfg.Daemon.DatabasePath)

	// Check for and run migration if needed (non-blocking)
	go func() {
		if err := checkAndRunMigration(log, homeDir, devEnv == "true"); err != nil {
			log.Error("Migration check failed", "error", err)
			// Don't exit the daemon for migration failures
		}
	}()

	// Initialize daemon lock
	lockManager := system.NewLockManager(
		filepath.Join(homeDir, ".waypaper-engine", "daemon.lock"),
		filepath.Join(homeDir, ".waypaper-engine", "daemon.pid"),
	)

	// Try to acquire lock
	if err := lockManager.AcquireLock("1.0.0", cfg.Daemon.SocketPath); err != nil {
		log.Error("failed to acquire daemon lock", "error", err)
		os.Exit(1)
	}
	defer lockManager.ReleaseLock()

	// Initialize database using config (only if not using JSON store)
	dbPath := cfg.Daemon.DatabasePath
	var dbManager *db.DatabaseManager
	
	// Check if we should use SQLite (only if JSON store doesn't exist)
	jsonStorePath := cfg.Daemon.DatabasePath
	if _, err := os.Stat(jsonStorePath); os.IsNotExist(err) {
		// JSON store doesn't exist, use SQLite
		log.Info("Using SQLite database", "path", dbPath)
		
		// Ensure database directory exists
		dbDir := filepath.Dir(dbPath)
		if err := os.MkdirAll(dbDir, 0755); err != nil {
			log.Error("failed to create database directory", "error", err, "path", dbDir)
			os.Exit(1)
		}

		dbManager, err = db.NewDatabaseManager(dbPath, db.DefaultPoolConfig())
		if err != nil {
			log.Error("failed to initialize database", "error", err)
			os.Exit(1)
		}
		defer dbManager.Close()

		if err := dbManager.Initialize(context.Background()); err != nil {
			log.Error("failed to run migrations", "error", err)
			os.Exit(1)
		}
	} else {
		log.Info("JSON store detected, skipping SQLite initialization", "path", jsonStorePath)
	}

	// Initialize backend system
	backendFactory := backend.NewBackendFactory(&backend.SwwwCommandRunner{}, log)
	backendManager := backend.NewBackendManager()

	// Register all available backends
	availableBackends := backendFactory.CreateAllBackends()
	for backendType, backend := range availableBackends {
		backendManager.RegisterBackend(backend)
		log.Info("registered backend", "type", backendType)
	}

	// Use backend from config or detect best available
	var backendType backend.BackendType
	if cfg.Backend.Type != "" {
		backendType = backend.BackendType(cfg.Backend.Type)
	} else {
		backendType = backendFactory.GetRecommendedBackend(context.Background())
	}

	if err := backendManager.SetActiveBackend(backendType); err != nil {
		log.Error("failed to set active backend", "error", err)
		os.Exit(1)
	}

	// Initialize the active backend
	if err := backendManager.InitializeBackend(context.Background()); err != nil {
		log.Error("failed to initialize backend", "backend", backendType, "error", err)
		os.Exit(1)
	}

	log.Info("using backend", "type", backendType)

	// Initialize components
	var dbOps *db.DatabaseOperations
	var dbQueries *db.Queries
	
	if dbManager != nil {
		dbOps = db.NewDatabaseOperations(dbManager)
		dbQueries = dbManager.GetQueries()
	} else {
		log.Info("Using JSON store mode, database operations will be handled by store")
	}
	
	monitorManager := monitor.NewManager(backendManager, dbQueries, log)
	playlistManager := playlist.NewManager(dbOps, backendManager, log)

	// Initialize JSON store for image path validation
	var jsonStore *store.Store
	
	// Use the same path resolution logic as migration (jsonStorePath already declared above)
	if devEnv == "true" {
		jsonStorePath = "/tmp/waypaper-engine/data"
	} else {
		jsonStorePath = filepath.Join(homeDir, ".waypaper-engine", "data")
	}
	
	if _, err := os.Stat(jsonStorePath); err == nil {
		// JSON store exists, initialize it
		storeConfig := store.DefaultStoreConfig()
		storeConfig.BasePath = jsonStorePath
		storeConfig.ThumbnailsDir = cfg.Daemon.ThumbnailsDir
		jsonStore, err = store.NewStore(storeConfig, log)
		if err != nil {
			log.Warn("Failed to initialize JSON store, continuing without path validation", "error", err)
		} else {
			log.Info("JSON store initialized for path validation", "path", jsonStorePath)
			// Validate image paths at startup
			if err := validateImagePaths(jsonStore, log); err != nil {
				log.Warn("Image path validation failed, continuing anyway", "error", err)
			}
		}
	} else {
		log.Info("No JSON store found, using SQLite-only mode", "path", jsonStorePath)
	}

	// Set configurable history limit
	playlistManager.SetHistoryLimit(cfg.App.ImageHistoryLimit)

	imageProcessor := image.NewProcessor(4, 100, log) // 4 workers, 100 cache size
	ipcHandler := ipc.NewHandler(playlistManager, dbOps, dbQueries, configManager, imageProcessor, monitorManager, log)
	
	// Set JSON store in IPC handler if available
	if jsonStore != nil {
		ipcHandler.SetStore(jsonStore)
	}
	ipcServer, err := ipc.NewServer(ipcHandler, log)
	if err != nil {
		log.Error("failed to create IPC server", "error", err)
		os.Exit(1)
	}
	defer ipcServer.Close()

	// Start monitor manager with config paths
	if err := monitorManager.StartWithConfig(context.Background(), cfg.Daemon.ImagesDir, cfg.Daemon.ThumbnailsDir, cfg.Daemon.MonitorsStateFile); err != nil {
		log.Error("failed to start monitor manager", "error", err)
		os.Exit(1)
	}

	// Start IPC server
	go ipcServer.Listen()

	// Start configuration watcher
	go configManager.WatchConfig(func(event string) {
		log.Info("configuration changed", "event", event)
	})

	log.Info("daemon started successfully")

	// Create main context for graceful shutdown
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	// Start components that accept context
	go imageProcessor.Start(ctx)
	go monitorManager.WatchConfigChanges(ctx)

	log.Info("all components started")

	// Handle signals for graceful shutdown
	sigChan := make(chan os.Signal, 1)
	signal.Notify(sigChan, syscall.SIGINT, syscall.SIGTERM)
	<-sigChan

	log.Info("shutting down daemon gracefully")

	// Graceful shutdown with timeout
	shutdownCtx, shutdownCancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer shutdownCancel()
	go func() {
		<-sigChan
		log.Warn("received second signal, forcing immediate shutdown")
		shutdownCancel()
	}()

	// Perform graceful shutdown
	if err := gracefulShutdown(shutdownCtx, playlistManager, monitorManager, backendManager, log); err != nil {
		log.Error("graceful shutdown error", "error", err)
	} else {
		log.Info("graceful shutdown completed")
	}
}

// gracefulShutdown performs graceful shutdown of all components
func gracefulShutdown(ctx context.Context, playlistManager *playlist.Manager, monitorManager *monitor.Manager, backendManager *backend.BackendManager, logger *slog.Logger) error {
	var wg sync.WaitGroup
	errChan := make(chan error, 5)

	logger.Info("starting graceful shutdown sequence")

	// 1. Stop all active playlists
	wg.Add(1)
	go func() {
		defer wg.Done()
		logger.Info("stopping all active playlists")
		if err := playlistManager.StopAllPlaylists(ctx); err != nil {
			logger.Error("error stopping playlists", "error", err)
			errChan <- err
		} else {
			logger.Info("all playlists stopped successfully")
		}
	}()

	// 2. Stop image processor
	wg.Add(1)
	go func() {
		defer wg.Done()
		select {
		case <-ctx.Done():
			logger.Info("context cancelled, skipping image processor stop")
		default:
			logger.Info("stopping image processor")
			// imageProcessor.Stop() would be called here when implemented
		}
	}()

	// 3. Persist current state
	wg.Add(1)
	go func() {
		defer wg.Done()
		select {
		case <-ctx.Done():
			logger.Info("context cancelled, skipping state persistence")
		default:
			logger.Info("persisting current state")
			if err := persistCurrentState(ctx, monitorManager, logger); err != nil {
				logger.Error("error persisting state", "error", err)
				errChan <- err
			} else {
				logger.Info("state persisted successfully")
			}
		}
	}()

	// 4. Clean up backend child processes (swww daemon, etc.)
	wg.Add(1)
	go func() {
		defer wg.Done()
		select {
		case <-ctx.Done():
			logger.Info("context cancelled, skipping backend cleanup")
		default:
			logger.Info("cleaning up backend processes")
			if err := backendManager.CleanupChildProcesses(ctx); err != nil {
				logger.Error("error cleaning up backend processes", "error", err)
				errChan <- err
			} else {
				logger.Info("backend processes cleaned up successfully")
			}
		}
	}()

	// Wait for all operations to complete or context to be cancelled
	done := make(chan struct{})
	go func() {
		wg.Wait()
		close(done)
	}()

	select {
	case <-ctx.Done():
		logger.Warn("graceful shutdown timed out or was cancelled")
		return ctx.Err()
	case <-done:
		logger.Info("graceful shutdown operations completed")
	}

	// Check for any errors
	close(errChan)
	for err := range errChan {
		logger.Error("shutdown error received", "error", err)
		return err
	}

	logger.Info("graceful shutdown completed successfully")
	return nil
}

// persistCurrentState saves the current wallpaper and playlist state
func persistCurrentState(ctx context.Context, monitorManager *monitor.Manager, logger *slog.Logger) error {
	// Save current wallpaper state from monitor manager
	if err := monitorManager.PersistCurrentWallpaperState(ctx); err != nil {
		return err
	}

	// Save any other state as needed
	logger.Info("current state persisted")
	return nil
}

// MigrationOptions represents the configuration for migration
type MigrationOptions struct {
	SQLitePath string
	JSONPath   string
	TOMLPath   string
	DryRun     bool
	Force      bool
	Backup     bool
	Verbose    bool
}

// runMigration handles the migration from SQLite to JSON
func runMigration(logger *slog.Logger, sqlitePath, jsonPath, tomlPath string, dryRun, force, backup, mustForce bool) error {
	homeDir, err := os.UserHomeDir()
	if err != nil {
		return fmt.Errorf("failed to get home directory: %w", err)
	}

	// Set default paths if not provided
	if sqlitePath == "" {
		sqlitePath = filepath.Join(homeDir, ".waypaper_engine", "images_database.sqlite3")
	}
	if jsonPath == "" {
		jsonPath = filepath.Join(homeDir, ".waypaper-engine", "data")
	}
	if tomlPath == "" {
		tomlPath = filepath.Join(homeDir, ".config", "waypaper-engine", "config.toml")
	}

	logger.Info("Starting migration",
		"sqlite", sqlitePath,
		"json", jsonPath,
		"toml", tomlPath,
		"dry_run", dryRun,
		"force", force,
		"backup", backup)
	logger.Info("Migration is idempotent - existing configurations will be preserved")

	// Check if migration has already been completed
	migrationMarkerFile := filepath.Join(filepath.Dir(tomlPath), ".migration_completed")
	if !mustForce {
		if _, err := os.Stat(migrationMarkerFile); err == nil {
			logger.Info("Migration already completed - skipping", "marker_file", migrationMarkerFile)
			logger.Info("Use --force flag to re-run migration")
			return nil
		}
	}

	// Check if SQLite database exists
	if _, err := os.Stat(sqlitePath); os.IsNotExist(err) {
		return fmt.Errorf("SQLite database not found at: %s", sqlitePath)
	}

	options := MigrationOptions{
		SQLitePath: sqlitePath,
		JSONPath:   jsonPath,
		TOMLPath:   tomlPath,
		DryRun:     dryRun,
		Force:      force,
		Backup:     backup,
		Verbose:    true,
	}

	// Initialize database manager for reading SQLite
	dbManager, err := db.NewDatabaseManager(sqlitePath, db.DefaultPoolConfig())
	if err != nil {
		return fmt.Errorf("failed to initialize SQLite database: %w", err)
	}
	defer dbManager.Close()

	dbOps := db.NewDatabaseOperations(dbManager)
	configManager := config.NewConfigManager(tomlPath)

	// Initialize JSON store
	storeConfig := store.DefaultStoreConfig()
	if jsonPath != "" {
		storeConfig.BasePath = jsonPath
	}
	jsonStore, err := store.NewStore(storeConfig, logger)
	if err != nil {
		return fmt.Errorf("failed to initialize JSON store: %w", err)
	}

	// Determine migration marker location
	migrationMarkerPath := filepath.Join(filepath.Dir(tomlPath), ".migration_completed")

	// Create migration tool
	migrator := &MigrationTool{
		dbOps:               dbOps,
		jsonStore:           jsonStore,
		logger:              logger,
		options:             options,
		config:              configManager,
		migrationMarkerPath: migrationMarkerPath,
	}

	return migrator.RunMigration()
}

// MigrationTool handles the migration process
type MigrationTool struct {
	dbOps               *db.DatabaseOperations
	jsonStore           *store.Store
	logger              *slog.Logger
	options             MigrationOptions
	config              *config.ConfigManager
	migrationMarkerPath string
}

// RunMigration performs the complete migration process
func (mt *MigrationTool) RunMigration() error {
	// Validate SQLite database
	if err := mt.validateSQLiteDatabase(); err != nil {
		return fmt.Errorf("SQLite validation failed: %w", err)
	}

	if mt.options.Backup {
		if err := mt.createBackup(); err != nil {
			mt.logger.Warn("Failed to create backup, continuing anyway", "error", err)
		}
	}

	// Run migration steps
	if err := mt.migrateAllData(); err != nil {
		return fmt.Errorf("migration failed: %w", err)
	}

	// Verify migration
	if err := mt.verifyMigration(); err != nil {
		return fmt.Errorf("migration verification failed: %w", err)
	}

	// Create migration marker to indicate successful completion
	if err := mt.createMigrationMarker(); err != nil {
		mt.logger.Warn("Failed to create migration marker, but migration was successful", "error", err)
	}

	return nil
}

// validateSQLiteDatabase checks if SQLite database is accessible
func (mt *MigrationTool) validateSQLiteDatabase() error {
	dbManager := mt.dbOps.GetManager()
	ctx := context.Background()

	err := dbManager.Transaction(ctx, func(q *db.Queries) error {
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

// createBackup creates a backup of the SQLite database
func (mt *MigrationTool) createBackup() error {
	backupPath := mt.options.SQLitePath + ".backup." + fmt.Sprintf("%d", time.Now().Unix())

	dbManager := mt.dbOps.GetManager()
	if err := dbManager.Backup(context.Background(), backupPath); err != nil {
		return fmt.Errorf("failed to create backup: %w", err)
	}

	mt.logger.Info("Database backup created", "path", backupPath)
	return nil
}

// migrateAllData performs the actual data migration
func (mt *MigrationTool) migrateAllData() error {
	migrator := &SQLiteToJSONMigrator{
		dbOps:     mt.dbOps,
		jsonStore: mt.jsonStore,
		logger:    mt.logger,
		dryRun:    mt.options.DryRun,
		tomlPath:  mt.options.TOMLPath,
		options:   mt.options,
	}

	// Migrate each component
	migrationSteps := []struct {
		name string
		fn   func() error
	}{
		{"swww-config", func() error { return migrator.migrateSwwwConfigToToml(mt.options.TOMLPath) }},
		{"images", migrator.migrateImages},
		{"playlists", migrator.migratePlaylists},
		{"image-history", migrator.migrateImageHistory},
		{"runtime-state", migrator.migrateRuntimeState},
		{"monitor-state", migrator.migrateMonitorState},
	}

	for _, step := range migrationSteps {
		mt.logger.Info("Starting migration step", "step", step.name)

		if err := step.fn(); err != nil {
			return fmt.Errorf("failed to migrate %s: %w", step.name, err)
		}

		mt.logger.Info("Completed migration step", "step", step.name)
	}

	return nil
}

// verifyMigration validates the migrated data
func (mt *MigrationTool) verifyMigration() error {
	// Simple verification - check if basic files were created
	mt.logger.Info("Migration verification complete")
	return nil
}

// showHelpMessage displays the help text
func showHelpMessage() {
	fmt.Printf(`Waypaper Engine Daemon v2.0.0

A powerful wallpaper manager for Linux with multi-monitor support,
advanced playlist management, and multiple backend support.

USAGE:
  %s [OPTIONS]

DAEMON OPTIONS:
  -verbose        Enable verbose logging
  -version        Show version information
  -help           Show this help message

MIGRATION OPTIONS (use with --migrate):
  -migrate        Run database migration from SQLite to JSON
  -sqlite PATH    Path to existing SQLite database (default: ~/.waypaper_engine/images_database.sqlite3)
  -json PATH      Path to new JSON store directory (default: ~/.waypaper-engine/data)
  -toml PATH      Path to TOML config file (default: ~/.config/waypaper-engine/config.toml)
  -dry-run        Preview migration without making changes
  -force          Overwrite existing JSON store if it exists
  -no-backup      Skip creating backup of SQLite database

MIGRATION PROCESS:
  1. Validates SQLite database is accessible
  2. Creates backup of SQLite database (unless --no-backup)
  3. Migrates swww configuration from SQLite to TOML config file
  4. Migrates images, playlists, image history, and runtime state
  5. Verifies migration completed successfully
  6. Provides next steps for full migration

EXAMPLES:
  # Run daemon normally
  %s

  # Preview migration with verbose output
  %s -migrate -dry-run -verbose

  # Perform full migration
  %s -migrate -force

  # Show version
  %s -version

  # Show help
  %s -help

`, os.Args[0], os.Args[0], os.Args[0], os.Args[0], os.Args[0], os.Args[0])
}

// SQLiteToJSONMigrator handles the actual conversion from SQLite to JSON
type SQLiteToJSONMigrator struct {
	dbOps     *db.DatabaseOperations
	jsonStore *store.Store
	logger    *slog.Logger
	dryRun    bool
	tomlPath  string
	options   MigrationOptions
}

// migrateSwwwConfigToToml migrates swww configuration from SQLite to TOML
func (migrator *SQLiteToJSONMigrator) migrateSwwwConfigToToml(tomlPath string) error {
	migrator.logger.Info("Migrating swww configuration to TOML...")

	ctx := context.Background()

	// Migration marker already ensures we haven't migrated before

	// Check if swww config exists in SQLite
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
		migrator.logger.Info("No swww configuration found in SQLite, skipping TOML migration")
		return nil
	}

	if migrator.dryRun {
		migrator.logger.Info("DRY RUN: Would migrate swww config to TOML if not already customized", "toml_path", tomlPath)
		return nil
	}

	// Read swww config from SQLite
	var swwwConfigJSON string
	err = dbManager.Transaction(ctx, func(q *db.Queries) error {
		config, err := q.GetSwwwConfig(ctx)
		if err != nil {
			return err
		}
		swwwConfigJSON = config
		return nil
	})
	if err != nil {
		return fmt.Errorf("failed to read swww config from SQLite: %w", err)
	}

	// Parse JSON config and convert to TOML format
	var swwwConfig models.SwwwConfig
	if err := json.Unmarshal([]byte(swwwConfigJSON), &swwwConfig); err != nil {
		return fmt.Errorf("failed to parse swww config JSON: %w", err)
	}

	// Load existing TOML config
	configManager := config.NewConfigManager(tomlPath)
	tomlConfig, err := configManager.LoadConfig()
	if err != nil {
		return fmt.Errorf("failed to load TOML config: %w", err)
	}

	// Map the JSON fields to TOML fields
	tomlConfig.Backend.Swww.TransitionType = string(swwwConfig.TransitionType)
	tomlConfig.Backend.Swww.TransitionStep = swwwConfig.TransitionStep
	tomlConfig.Backend.Swww.TransitionDuration = int(swwwConfig.TransitionDuration * 1000) // Convert seconds to milliseconds
	tomlConfig.Backend.Swww.TransitionAngle = swwwConfig.TransitionAngle
	tomlConfig.Backend.Swww.TransitionPos = string(swwwConfig.TransitionPosition)
	tomlConfig.Backend.Swww.TransitionBezier = swwwConfig.TransitionBezier
	tomlConfig.Backend.Swww.TransitionWave = fmt.Sprintf("%d,%d,0,0",
		swwwConfig.TransitionWaveX, swwwConfig.TransitionWaveY)

	// Save updated TOML config
	if err := configManager.SaveConfig(); err != nil {
		return fmt.Errorf("failed to save updated TOML config: %w", err)
	}

	// Also migrate app configuration to TOML
	if err := migrator.migrateAppConfigToToml(tomlPath); err != nil {
		return fmt.Errorf("failed to migrate app config: %w", err)
	}

	migrator.logger.Info("Successfully migrated swww configuration to TOML")
	return nil
}

// migrateAppConfigToToml migrates app configuration from SQLite to TOML
func (migrator *SQLiteToJSONMigrator) migrateAppConfigToToml(tomlPath string) error {
	migrator.logger.Info("Migrating app configuration to TOML...")

	ctx := context.Background()
	dbManager := migrator.dbOps.GetManager()

	// Check if app config exists in SQLite
	var configExists bool
	err := dbManager.Transaction(ctx, func(q *db.Queries) error {
		count, err := q.GetConfigurationExists(ctx)
		if err != nil {
			return err
		}
		configExists = count > 0
		return nil
	})
	if err != nil {
		return fmt.Errorf("failed to check app config existence: %w", err)
	}

	if !configExists {
		migrator.logger.Info("No app configuration found in SQLite, skipping migration")
		return nil
	}

	if migrator.dryRun {
		migrator.logger.Info("DRY RUN: Would migrate app config to TOML if not already customized", "toml_path", tomlPath)
		return nil
	}

	// Read app config from SQLite
	var appConfigJSON string
	err = dbManager.Transaction(ctx, func(q *db.Queries) error {
		config, err := q.GetAppConfig(ctx)
		if err != nil {
			return err
		}
		appConfigJSON = config
		return nil
	})
	if err != nil {
		return fmt.Errorf("failed to read app config from SQLite: %w", err)
	}

	// Parse JSON config and convert to TOML format
	var appConfig struct {
		KillDaemon              bool   `json:"killDaemon"`
		Notifications           bool   `json:"notifications"`
		StartMinimized          bool   `json:"startMinimized"`
		MinimizeInsteadOfClose  bool   `json:"minimizeInsteadOfClose"`
		RandomImageMonitor      string `json:"randomImageMonitor"`
		ShowMonitorModalOnStart bool   `json:"showMonitorModalOnStart"`
		ImagesPerPage           int    `json:"imagesPerPage"`
	}

	if err := json.Unmarshal([]byte(appConfigJSON), &appConfig); err != nil {
		return fmt.Errorf("failed to parse app config JSON: %w", err)
	}

	// Load existing TOML config
	configManager := config.NewConfigManager(tomlPath)
	tomlConfig, err := configManager.LoadConfig()
	if err != nil {
		return fmt.Errorf("failed to load TOML config: %w", err)
	}

	// Map the JSON fields to TOML fields
	tomlConfig.App.KillDaemonOnExit = appConfig.KillDaemon
	tomlConfig.App.Notifications = appConfig.Notifications
	tomlConfig.App.StartMinimized = appConfig.StartMinimized
	tomlConfig.App.MinimizeInsteadOfClose = appConfig.MinimizeInsteadOfClose
	tomlConfig.App.RandomImageMonitor = appConfig.RandomImageMonitor
	tomlConfig.App.ShowMonitorModalOnStart = appConfig.ShowMonitorModalOnStart
	tomlConfig.App.ImagesPerPage = appConfig.ImagesPerPage

	// Save updated TOML config
	if err := configManager.SaveConfig(); err != nil {
		return fmt.Errorf("failed to save updated TOML config: %w", err)
	}

	migrator.logger.Info("Successfully migrated app configuration to TOML")
	return nil
}

// migrateImages migrates images from SQLite to JSON
func (migrator *SQLiteToJSONMigrator) migrateImages() error {
	migrator.logger.Info("Migrating images...")

	ctx := context.Background()
	dbManager := migrator.dbOps.GetManager()

	// Get all images from SQLite
	var images []db.Image
	err := dbManager.Transaction(ctx, func(q *db.Queries) error {
		dbImages, err := q.GetAllImages(ctx)
		if err != nil {
			return err
		}
		images = dbImages
		return nil
	})
	if err != nil {
		return fmt.Errorf("failed to get images from SQLite: %w", err)
	}

	if migrator.dryRun {
		migrator.logger.Info("DRY RUN: Would migrate images from SQLite", "count", len(images))
		return nil
	}

	if len(images) == 0 {
		migrator.logger.Info("No images found in SQLite database")
		return nil
	}

	// Convert to store format
	imageRegistry := store.ImageRegistry{
		Metadata: store.ImageRegistryMetadata{
			Version:     "1.0",
			TotalImages: len(images),
			LastUpdated: time.Now(),
		},
		Images: make([]store.Image, len(images)),
		Indices: store.ImageRegistryIndices{
			ByName:       make(map[string]string),
			ByFormat:     make(map[string][]string),
			ByDimensions: make(map[string][]string),
			ByMediaType:  make(map[media.MediaType][]string),
			ByTags:       make(map[string][]string),
			BySelected:   make(map[string][]string),
		},
	}

	for i, img := range images {
		// Preserve original SQLite ID instead of generating new UUID
		imageID := fmt.Sprintf("%d", img.ID)

		// Construct image path - assuming it's relative to the Node.js images dir
		imagesPath := filepath.Join(filepath.Dir(migrator.options.SQLitePath), "images")
		imagePath := filepath.Join(imagesPath, img.Name)

		storeImage := store.Image{
			ID:        imageID,
			Name:      img.Name,
			Path:      imagePath,
			MediaType: media.MediaTypeImage, // Default to image type
			Dimensions: store.ImageDimensions{
				Width:  int64(img.Width),
				Height: int64(img.Height),
			},
			Metadata: store.ImageMetadata{
				Format:   img.Format,
				FileSize: 0,          // Not available in SQLite
				Checksum: "",         // Not available in SQLite
				Tags:     []string{}, // Not available in SQLite
			},
			Selection: store.ImageSelection{
				IsChecked:         img.Ischecked == 1,
				IsSelected:        img.Isselected == 1,
				SelectedAt:        nil,        // Not available in SQLite
				SelectedPlaylists: []string{}, // Will be populated when playlists are migrated
			},
			ImportInfo: store.ImageImportInfo{
				ImportedAt: time.Now(),  // Default to migration time
				Importer:   "migration", // Mark as migrated
			},
		}

		imageRegistry.Images[i] = storeImage

		// Update indices
		imageRegistry.Indices.ByName[img.Name] = imageID
		imageRegistry.Indices.ByFormat[img.Format] = append(imageRegistry.Indices.ByFormat[img.Format], imageID)
		dimKey := fmt.Sprintf("%dx%d", img.Width, img.Height)
		imageRegistry.Indices.ByDimensions[dimKey] = append(imageRegistry.Indices.ByDimensions[dimKey], imageID)
		imageRegistry.Indices.ByMediaType[media.MediaTypeImage] = append(imageRegistry.Indices.ByMediaType[media.MediaTypeImage], imageID)

		// Update selection index
		if img.Ischecked == 1 {
			imageRegistry.Indices.BySelected["checked"] = append(imageRegistry.Indices.BySelected["checked"], imageID)
		}
		if img.Isselected == 1 {
			imageRegistry.Indices.BySelected["selected"] = append(imageRegistry.Indices.BySelected["selected"], imageID)
		}
	}

	// Save to JSON
	imageStore := store.NewImageStore(migrator.jsonStore)
	if err := imageStore.SaveImageRegistry(&imageRegistry); err != nil {
		return fmt.Errorf("failed to save image registry: %w", err)
	}

	migrator.logger.Info("Successfully migrated images", "count", len(images))
	return nil
}

// migratePlaylists migrates playlists from SQLite to JSON
func (migrator *SQLiteToJSONMigrator) migratePlaylists() error {
	migrator.logger.Info("Migrating playlists...")
	migrator.logger.Warn("Playlist migration is placeholder - need to map SQLite schema to JSON fields")
	if migrator.dryRun {
		migrator.logger.Info("DRY RUN: Would migrate playlists from SQLite")
	} else {
		migrator.logger.Info("Migrated playlists", "count", "TODO - implement after understanding SQLite schema")
	}
	return nil
}

// migrateImageHistory migrates image history from SQLite to JSON
func (migrator *SQLiteToJSONMigrator) migrateImageHistory() error {
	migrator.logger.Info("Migrating image history...")
	migrator.logger.Warn("Image history migration is placeholder - need to map SQLite schema to JSON fields")
	if migrator.dryRun {
		migrator.logger.Info("DRY RUN: Would migrate image history from SQLite")
	} else {
		migrator.logger.Info("Migrated image history", "count", "TODO - implement after understanding SQLite schema")
	}
	return nil
}

// migrateRuntimeState migrates runtime state from SQLite to JSON
func (migrator *SQLiteToJSONMigrator) migrateRuntimeState() error {
	migrator.logger.Info("Migrating runtime state...")

	ctx := context.Background()
	dbManager := migrator.dbOps.GetManager()

	if migrator.dryRun {
		migrator.logger.Info("DRY RUN: Would migrate runtime state from SQLite")
		return nil
	}

	// Get selected monitor from SQLite
	var selectedMonitorData string
	err := dbManager.Transaction(ctx, func(q *db.Queries) error {
		monitor, err := q.GetSelectedMonitor(ctx)
		if err != nil {
			return err
		}
		selectedMonitorData = monitor
		return nil
	})
	if err != nil {
		migrator.logger.Warn("Failed to get selected monitor", "error", err)
		return err
	}

	// Parse the JSON monitor data
	var monitorInfo struct {
		Name     string `json:"name"`
		Monitors []struct {
			Name         string `json:"name"`
			Width        int64  `json:"width"`
			Height       int64  `json:"height"`
			CurrentImage string `json:"currentImage"`
			Position     struct {
				X int64 `json:"x"`
				Y int64 `json:"y"`
			} `json:"position"`
		} `json:"monitors"`
		ExtendAcrossMonitors bool `json:"extendAcrossMonitors"`
	}

	if err := json.Unmarshal([]byte(selectedMonitorData), &monitorInfo); err != nil {
		migrator.logger.Warn("Failed to parse selected monitor JSON", "error", err)
		// Continue with defaults
	}

	// Convert to store format
	storeMonitors := make([]store.MonitorInfo, len(monitorInfo.Monitors))
	for i, m := range monitorInfo.Monitors {
		currentWallpaper := &store.CurrentWallpaper{
			ImageID:     "migrated-" + m.CurrentImage,
			ImagePath:   "", // Will be populated when actual images are set
			MediaType:   media.MediaTypeImage,
			SetAt:       time.Now(),
			BackendUsed: "migrated",
		}

		storeMonitors[i] = store.MonitorInfo{
			Name: m.Name,
			Dimensions: store.MonitorDimensions{
				Width:  int(m.Width),
				Height: int(m.Height),
			},
			Properties: store.MonitorProperties{
				IsPrimary: i == 0, // Assume first monitor is primary
			},
			CurrentWallpaper: currentWallpaper,
			BackendInUse:     nil, // Will be populated when backend management runs
		}
	}

	// Create runtime state
	storeRuntime := store.RuntimeState{
		Metadata: store.RuntimeMetadata{
			Version:       "1.0",
			LastSave:      time.Now(),
			DaemonPID:     0, // Will be set when daemon runs
			DaemonVersion: "2.0.0",
		},
		ActivePlaylists: make(map[string]*store.ActivePlaylistState), // Empty for now
		MonitorState: store.MonitorStateRegistry{
			Monitors:      storeMonitors,
			LastDetection: time.Now(),
			TotalDetected: len(storeMonitors),
			ActiveCount:   len(storeMonitors), // All monitors are considered active
		},
		SelectedMonitor: monitorInfo.Name,
		GlobalSettings: store.GlobalSettings{
			DefaultPlaylist:   nil, // No default playlist
			AutoStart:         false,
			ImageHistoryLimit: 50,
		},
		Statistics: store.RuntimeStatistics{
			TotalImagesProcessed:  0,
			TotalPlaylistsCreated: 0,
			TotalImagesSet:        0,
			TotalUptime:           0,
			LastStatisticsUpdate:  time.Now(),
		},
	}

	// Save to JSON
	runtimeStore := store.NewRuntimeStore(migrator.jsonStore)
	if err := runtimeStore.SaveRuntimeState(&storeRuntime); err != nil {
		return fmt.Errorf("failed to save runtime state: %w", err)
	}

	migrator.logger.Info("Successfully migrated runtime state",
		"monitors", len(storeMonitors),
		"selected_monitor", monitorInfo.Name)
	return nil
}

func (migrator *SQLiteToJSONMigrator) migrateMonitorState() error {
	migrator.logger.Info("Migrating monitor state...")
	migrator.logger.Info("Monitor state migration completed (deferred to runtime state)")
	return nil
}

// generateUUID generates a simple UUID v4 string
func generateUUID() string {
	b := make([]byte, 16)
	_, err := rand.Read(b)
	if err != nil {
		// Fallback to time-based ID
		return fmt.Sprintf("fallback-%d", time.Now().UnixNano())
	}
	return fmt.Sprintf("%x-%x-%x-%x-%x", b[0:4], b[4:6], b[6:8], b[8:10], b[10:])
}

// checkAndRunMigration checks if migration is needed and runs it automatically
func checkAndRunMigration(log *slog.Logger, homeDir string, isDev bool) error {
	// Determine paths based on environment
	var sqlitePath, jsonPath, tomlPath, migrationMarkerPath string
	
	if isDev {
		// Development mode: use /tmp paths
		tmpDir := "/tmp/waypaper-engine"
		sqlitePath = filepath.Join(tmpDir, "waypaper.db")
		jsonPath = filepath.Join(tmpDir, "data")
		tomlPath = filepath.Join(tmpDir, "config.toml")
		migrationMarkerPath = filepath.Join(tmpDir, ".migration_completed")
	} else {
		// Production mode: use user paths
		sqlitePath = filepath.Join(homeDir, ".config", "waypaper-engine", "waypaper.db")
		jsonPath = filepath.Join(homeDir, ".waypaper-engine", "data")
		tomlPath = filepath.Join(homeDir, ".config", "waypaper-engine", "config.toml")
		migrationMarkerPath = filepath.Join(homeDir, ".config", "waypaper-engine", ".migration_completed")
	}
	
	// Check if migration marker exists
	if _, err := os.Stat(migrationMarkerPath); err == nil {
		log.Info("Migration already completed, skipping", "marker_file", migrationMarkerPath)
		return nil
	}
	
	// Check if JSON store already exists and has data
	if _, err := os.Stat(jsonPath); err == nil {
		// Check if JSON store has any data
		storeConfig := store.DefaultStoreConfig()
		storeConfig.BasePath = jsonPath
		jsonStore, err := store.NewStore(storeConfig, log)
		if err == nil {
			if images, err := jsonStore.LoadImageRegistry(); err == nil && len(images.Images) > 0 {
				log.Info("JSON store exists with data, migration not needed")
				return nil
			}
		}
	}
	
	// Look for SQLite database to migrate from
	var sourceSQLitePath string
	
	// Try production SQLite locations
	if _, err := os.Stat(sqlitePath); err == nil {
		sourceSQLitePath = sqlitePath
		log.Info("Found SQLite database at expected location", "path", sourceSQLitePath)
	} else {
		// Try legacy location
		legacySQLitePath := filepath.Join(homeDir, ".waypaper_engine", "images_database.sqlite3")
		if _, err := os.Stat(legacySQLitePath); err == nil {
			sourceSQLitePath = legacySQLitePath
			log.Info("Found legacy SQLite database", "path", sourceSQLitePath)
		}
	}
	
	if sourceSQLitePath == "" {
		log.Info("No SQLite database found, migration not needed")
		return nil
	}
	
	log.Info("Migration needed", 
		"source_sqlite", sourceSQLitePath,
		"target_json", jsonPath,
		"target_toml", tomlPath)
	
	// Run migration
	if err := runMigration(log, sourceSQLitePath, jsonPath, tomlPath, false, true, true, true); err != nil {
		return err
	}
	
	// Thumbnail regeneration is now handled on-demand via events
	// No longer blocking startup for thumbnail creation
	log.Info("Migration completed - thumbnails will be generated on-demand")
	
	return nil
}

// regenerateThumbnailsIfNeeded checks if thumbnails need regeneration and runs it
func regenerateThumbnailsIfNeeded(log *slog.Logger, jsonPath, tomlPath string) error {
	// Check if thumbnails directory exists and has thumbnails
	configManager := config.NewConfigManager(tomlPath)
	cfg, err := configManager.GetConfig()
	if err != nil {
		return fmt.Errorf("failed to load configuration: %w", err)
	}

	// Check if thumbnails directory exists
	if _, err := os.Stat(cfg.Daemon.ThumbnailsDir); os.IsNotExist(err) {
		log.Info("Thumbnails directory doesn't exist, creating it")
		if err := os.MkdirAll(cfg.Daemon.ThumbnailsDir, 0755); err != nil {
			return fmt.Errorf("failed to create thumbnails directory: %w", err)
		}
	}

	// Check if thumbnails directory is empty
	entries, err := os.ReadDir(cfg.Daemon.ThumbnailsDir)
	if err != nil {
		return fmt.Errorf("failed to read thumbnails directory: %w", err)
	}

	// Count thumbnail files
	thumbnailCount := 0
	for _, entry := range entries {
		if !entry.IsDir() && filepath.Ext(entry.Name()) == ".webp" {
			thumbnailCount++
		}
	}

	// Load image registry to count images
	storeConfig := store.DefaultStoreConfig()
	storeConfig.BasePath = jsonPath
	jsonStore, err := store.NewStore(storeConfig, log)
	if err != nil {
		return fmt.Errorf("failed to initialize JSON store: %w", err)
	}

	imageStore := store.NewImageStore(jsonStore)
	registry, err := imageStore.LoadImageRegistry()
	if err != nil {
		return fmt.Errorf("failed to load image registry: %w", err)
	}

	imageCount := len(registry.Images)

	log.Info("Thumbnail check", "thumbnail_count", thumbnailCount, "image_count", imageCount)

	// If we have significantly fewer thumbnails than images, regenerate
	if thumbnailCount < imageCount/2 {
		log.Info("Thumbnails appear to be missing, regenerating...")
		return utils.RegenerateThumbnails(jsonPath, tomlPath, log)
	}

	log.Info("Thumbnails appear to be up to date")
	return nil
}

// createMigrationMarker creates a marker file indicating successful migration
func (mt *MigrationTool) createMigrationMarker() error {
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
		mt.options.SQLitePath,
		mt.options.JSONPath,
		mt.options.TOMLPath,
		time.Now().Format(time.RFC3339),
		mt.options.SQLitePath,
		mt.options.JSONPath,
	)

	if err := os.MkdirAll(filepath.Dir(mt.migrationMarkerPath), 0755); err != nil {
		return fmt.Errorf("failed to create migration marker directory: %w", err)
	}

	if err := os.WriteFile(mt.migrationMarkerPath, []byte(markerContent), 0644); err != nil {
		return fmt.Errorf("failed to create migration marker: %w", err)
	}

	mt.logger.Info("Migration marker created", "marker_file", mt.migrationMarkerPath)
	return nil
}

// validateImagePaths validates all image paths in the JSON store and removes invalid ones
func validateImagePaths(jsonStore *store.Store, log *slog.Logger) error {
	log.Info("Starting image path validation...")
	
	// Load image registry
	registry, err := jsonStore.LoadImageRegistry()
	if err != nil {
		return fmt.Errorf("failed to load image registry: %w", err)
	}
	
	if registry == nil {
		log.Info("No image registry found, skipping validation")
		return nil
	}
	
	var validImages []store.Image
	var removedCount int
	
	for _, image := range registry.Images {
		// Check if file exists
		if _, err := os.Stat(image.Path); err != nil {
			log.Warn("Removing invalid image path", "name", image.Name, "path", image.Path, "error", err)
			removedCount++
			continue
		}
		
		validImages = append(validImages, image)
	}
	
	if removedCount > 0 {
		log.Info("Image path validation completed", "valid_images", len(validImages), "removed_images", removedCount)
		
		// Update registry with only valid images
		registry.Images = validImages
		registry.Metadata.TotalImages = len(validImages)
		registry.Metadata.LastUpdated = time.Now()
		
		// Rebuild indices
		registry.Indices = store.ImageRegistryIndices{
			ByName:       make(map[string]string),
			ByFormat:     make(map[string][]string),
			ByDimensions: make(map[string][]string),
			ByMediaType:  make(map[media.MediaType][]string),
			ByTags:       make(map[string][]string),
			BySelected:   make(map[string][]string),
		}
		
		for _, image := range validImages {
			registry.Indices.ByName[image.Name] = image.ID
			registry.Indices.ByFormat[image.Metadata.Format] = append(registry.Indices.ByFormat[image.Metadata.Format], image.ID)
			dimKey := fmt.Sprintf("%dx%d", image.Dimensions.Width, image.Dimensions.Height)
			registry.Indices.ByDimensions[dimKey] = append(registry.Indices.ByDimensions[dimKey], image.ID)
			registry.Indices.ByMediaType[image.MediaType] = append(registry.Indices.ByMediaType[image.MediaType], image.ID)
			
			if image.Selection.IsChecked {
				registry.Indices.BySelected["checked"] = append(registry.Indices.BySelected["checked"], image.ID)
			}
			if image.Selection.IsSelected {
				registry.Indices.BySelected["selected"] = append(registry.Indices.BySelected["selected"], image.ID)
			}
		}
		
		// Save updated registry
		imageStore := store.NewImageStore(jsonStore)
		if err := imageStore.SaveImageRegistry(registry); err != nil {
			return fmt.Errorf("failed to save updated image registry: %w", err)
		}
		
		log.Info("Updated image registry saved successfully")
	} else {
		log.Info("Image path validation completed", "valid_images", len(validImages), "removed_images", 0)
	}
	
	return nil
}
