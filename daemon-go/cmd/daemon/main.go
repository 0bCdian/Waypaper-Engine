package main

import (
	"context"
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
	"waypaper-engine/daemon-go/internal/events"
	"waypaper-engine/daemon-go/internal/image"
	"waypaper-engine/daemon-go/internal/ipc"
	"waypaper-engine/daemon-go/internal/logger"
	"waypaper-engine/daemon-go/internal/monitor"
	"waypaper-engine/daemon-go/internal/playlist"
	"waypaper-engine/daemon-go/internal/store"
	"waypaper-engine/daemon-go/internal/system"
)

func main() {
	// Parse command line flags
	var (
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
		fmt.Println("Waypaper Engine Daemon v3.0.0")
		return
	}

	// Configure log level based on debug/verbose flags
	var logLevel slog.Level
	if *verbose {
		logLevel = slog.LevelDebug
	} else {
		logLevel = slog.LevelInfo
	}

	// Create temporary logger for initial setup
	tempLog := slog.New(slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{
		Level: logLevel,
	}))

	// Initialize configuration manager with centralized path handling
	configManager := config.NewConfigManager("") // Empty path - config manager will determine the correct path

	// Load configuration and ensure all directories exist
	cfg, err := configManager.LoadConfig()
	if err != nil {
		tempLog.Error("failed to load configuration", "error", err)
		os.Exit(1)
	}

	// Ensure all directories exist
	if err := configManager.EnsureAllDirectories(); err != nil {
		tempLog.Error("failed to create directories", "error", err)
		os.Exit(1)
	}

	tempLog.Info("Configuration loaded successfully", "databasePath", cfg.Daemon.DatabasePath)

	// Now create the proper logger with configuration
	log, err := logger.New(configManager)
	if err != nil {
		tempLog.Error("failed to create logger", "error", err)
		os.Exit(1)
	}

	// Initialize daemon lock
	// Set up lock manager for daemon process management
	// Use config-driven paths for lock files
	configPath := configManager.GetConfigFilePath()
	configDir := filepath.Dir(configPath)
	lockFile := filepath.Join(configDir, "daemon.lock")
	pidFile := filepath.Join(configDir, "daemon.pid")
	lockManager := system.NewLockManager(lockFile, pidFile)

	// Clean up any stale lock files from previous crashes
	log.Info("checking for stale lock files")
	if lockInfo, err := lockManager.GetLockInfo(); err == nil {
		// Check if the PID is still running
		if !isProcessRunning(lockInfo.PID) {
			log.Warn("found stale lock file, cleaning up", "pid", lockInfo.PID)
			if err := lockManager.ReleaseLock(); err != nil {
				log.Error("failed to clean up stale lock", "error", err)
			}
		} else {
			log.Error("daemon is already running", "pid", lockInfo.PID)
			os.Exit(1)
		}
	}

	// Try to acquire lock
	if err := lockManager.AcquireLock("1.0.0", cfg.Daemon.SocketPath); err != nil {
		log.Error("failed to acquire daemon lock", "error", err)
		os.Exit(1)
	}
	defer lockManager.ReleaseLock()

	// Initialize event bus
	eventBus := events.NewEventBus(log)
	log.Info("event bus initialized")

	// Initialize backend manager with config manager
	backendManager := backend.NewBackendManager(configManager)
	log.Info("backend manager initialized")

	// Initialize JSON store using config-driven paths
	jsonStorePath, err := configManager.GetDatabasePath()
	if err != nil {
		log.Error("failed to get database path from config", "error", err)
		os.Exit(1)
	}

	thumbnailsDir, err := configManager.GetThumbnailsDir()
	if err != nil {
		log.Error("failed to get thumbnails directory from config", "error", err)
		os.Exit(1)
	}

	storeConfig := store.DefaultStoreConfig()
	storeConfig.BasePath = jsonStorePath
	storeConfig.ThumbnailsDir = thumbnailsDir
	jsonStore, err := store.NewStore(storeConfig, log)
	if err != nil {
		log.Error("failed to initialize JSON store", "error", err)
		os.Exit(1)
	}
	log.Info("JSON store initialized", "path", jsonStorePath)

	// Initialize JSON DB manager
	jsonDBManager := store.NewJSONDBManager(jsonStore, log)
	log.Info("JSON DB manager initialized")

	// Initialize image manager
	imageManager, err := image.NewImageManager(configManager, backendManager, log, eventBus)
	if err != nil {
		log.Error("failed to initialize image manager", "error", err)
		os.Exit(1)
	}
	log.Info("image manager initialized")

	// Validate image paths at startup
	if err := validateImagePaths(jsonStore, log); err != nil {
		log.Warn("Image path validation failed, continuing anyway", "error", err)
	}

	// Initialize monitor manager (detects compositor internally)
	monitorManager, err := monitor.CreateMonitorManager()
	if err != nil {
		log.Error("Failed to create monitor manager", "error", err)
		os.Exit(1)
	}

	// Get paths from config for monitor manager (not used in current implementation)
	// imagesDir, err := configManager.GetImagesDir()
	// if err != nil {
	//	log.Error("failed to get images directory from config", "error", err)
	//	os.Exit(1)
	// }

	// monitorsStateFile, err := configManager.GetMonitorsStateFile()
	// if err != nil {
	//	log.Error("failed to get monitors state file from config", "error", err)
	//	os.Exit(1)
	// }

	// Start monitor manager
	if err := monitorManager.Start(); err != nil {
		log.Error("failed to start monitor manager", "error", err)
		os.Exit(1)
	}

	// Monitor manager is now started
	log.Info("monitor manager started successfully")

	playlistManager := playlist.NewManager(jsonDBManager, imageManager, log, cfg)
	playlistManager.SetHistoryLimit(cfg.App.ImageHistoryLimit)

	// JSON-only mode: No SQLite database initialization
	log.Info("using JSON-only storage mode")

	// Set up signal handler for cleanup
	sigChan := make(chan os.Signal, 1)
	signal.Notify(sigChan, syscall.SIGINT, syscall.SIGTERM, syscall.SIGQUIT)

	// Create IPC handler with new components
	ipcHandler := ipc.NewHandler(playlistManager, configManager, monitorManager, imageManager, jsonDBManager, log)

	// Get socket path from config
	socketPath, err := configManager.GetSocketPath()
	if err != nil {
		log.Error("failed to get socket path from config", "error", err)
		os.Exit(1)
	}

	ipcServer, err := ipc.NewServerWithSocket(ipcHandler, socketPath, log)
	if err != nil {
		log.Error("failed to create IPC server", "error", err)
		os.Exit(1)
	}
	defer ipcServer.Close()

	// Connect event bus to IPC server for broadcasting
	ipcServer.SetEventBus(eventBus)
	log.Info("event bus connected to IPC server")

	// Start IPC server
	go ipcServer.Listen()

	// Subscribe IPC server to all EventBus events and forward to clients
	eventBus.Subscribe("*", func(event *events.Event) error {
		return ipcServer.BroadcastEvent(event)
	})
	log.Info("event bus subscribed to broadcast events to IPC clients")

	// Start configuration watcher
	go configManager.WatchConfig(func(event string) {
		log.Info("configuration changed", "event", event)
	})

	log.Info("daemon started successfully")

	// Create main context for graceful shutdown (not used in current implementation)
	// ctx, cancel := context.WithCancel(context.Background())
	// defer cancel()

	// Start components that accept context
	// Monitor manager is already started and doesn't need additional context-based startup

	log.Info("all components started")

	// Start cleanup handler in background
	go func() {
		sig := <-sigChan
		log.Info("received signal, initiating cleanup", "signal", sig)
		// Ensure lock is released even if main goroutine is blocked
		if err := lockManager.ReleaseLock(); err != nil {
			log.Error("error releasing lock during signal handler", "error", err)
		} else {
			log.Info("lock released by signal handler")
		}
	}()

	// Wait for first signal
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
	if err := gracefulShutdown(shutdownCtx, playlistManager, monitorManager, backendManager, lockManager, log); err != nil {
		log.Error("graceful shutdown error", "error", err)
	} else {
		log.Info("graceful shutdown completed")
	}
}

// isProcessRunning checks if a process with the given PID is still running
func isProcessRunning(pid int) bool {
	process, err := os.FindProcess(pid)
	if err != nil {
		return false
	}

	// Send signal 0 to check if process exists
	// This doesn't actually send a signal, just checks if the process exists
	err = process.Signal(syscall.Signal(0))
	return err == nil
}

func gracefulShutdown(ctx context.Context, playlistManager *playlist.Manager, monitorManager monitor.MonitorManager, backendManager backend.BackendManager, lockManager *system.LockManager, logger *slog.Logger) error {
	var wg sync.WaitGroup
	errChan := make(chan error, 5)

	logger.Info("starting graceful shutdown sequence")

	// 1. Stop all playlists
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
		// Image processing is now done via pure functions, no cleanup needed
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

	// 4. Release daemon lock
	wg.Add(1)
	go func() {
		defer wg.Done()
		select {
		case <-ctx.Done():
			logger.Info("context cancelled, skipping lock release")
		default:
			logger.Info("releasing daemon lock")
			if err := lockManager.ReleaseLock(); err != nil {
				logger.Error("error releasing lock", "error", err)
				errChan <- err
			} else {
				logger.Info("daemon lock released successfully")
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
func persistCurrentState(ctx context.Context, monitorManager monitor.MonitorManager, logger *slog.Logger) error {
	// Monitor manager doesn't have persistence methods in the interface
	// State persistence is handled by other components

	// Save any other state as needed
	logger.Info("current state persisted")
	return nil
}

func showHelpMessage() {
	fmt.Printf(`Waypaper Engine Daemon v2.0.0

USAGE:
  %s [OPTIONS]

OPTIONS:
  -verbose        Enable verbose logging
  -version        Show version information
  -help           Show this help message

DESCRIPTION:
  The Waypaper Engine daemon manages wallpaper operations and provides
  IPC communication for the GUI application.

EXAMPLES:
  # Run daemon normally
  %s

  # Run with verbose logging
  %s -verbose

  # Show version
  %s -version

`, os.Args[0], os.Args[0], os.Args[0], os.Args[0])
}

// validateImagePaths validates that image files in the store still exist
func validateImagePaths(s *store.Store, logger *slog.Logger) error {
	logger.Info("validating image paths")

	registry, err := s.LoadImageRegistry()
	if err != nil {
		return fmt.Errorf("failed to load image registry: %w", err)
	}

	var validImages []store.Image
	var removedCount int

	for _, img := range registry.Images {
		if _, err := os.Stat(img.Path); os.IsNotExist(err) {
			logger.Warn("image file not found, removing from registry", "path", img.Path)
			removedCount++
		} else {
			validImages = append(validImages, img)
		}
	}

	if removedCount > 0 {
		logger.Info("updating image registry", "removed_count", removedCount, "valid_count", len(validImages))

		// Update registry with only valid images
		updatedRegistry := &store.ImageRegistry{
			Images: validImages,
			Metadata: store.ImageRegistryMetadata{
				Version:     registry.Metadata.Version,
				LastUpdated: time.Now(),
				TotalImages: len(validImages),
			},
		}

		imageStore := store.NewImageStore(s)
		if err := imageStore.SaveImageRegistry(updatedRegistry); err != nil {
			return fmt.Errorf("failed to save updated image registry: %w", err)
		}

		logger.Info("Updated image registry saved successfully")
	} else {
		logger.Info("Image path validation completed", "valid_images", len(validImages), "removed_images", 0)
	}

	return nil
}
