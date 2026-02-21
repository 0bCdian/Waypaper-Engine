package main

import (
	"context"
	"fmt"
	"io"
	"log/slog"
	"os"
	"os/signal"
	"path/filepath"
	"syscall"
	"time"

	slogmulti "github.com/samber/slog-multi"
	"gopkg.in/natefinch/lumberjack.v2"

	"waypaper-engine/daemon/internal/backend"
	"waypaper-engine/daemon/internal/backend/feh"
	"waypaper-engine/daemon/internal/backend/hyprpaper"
	"waypaper-engine/daemon/internal/backend/swww"
	"waypaper-engine/daemon/internal/config"
	"waypaper-engine/daemon/internal/events"
	"waypaper-engine/daemon/internal/handler"
	"waypaper-engine/daemon/internal/image"
	"waypaper-engine/daemon/internal/monitor"
	"waypaper-engine/daemon/internal/playlist"
	"waypaper-engine/daemon/internal/server"
	"waypaper-engine/daemon/internal/store"
	"waypaper-engine/daemon/internal/system"
)

// version is set at build time via ldflags: -X main.version=...
var version = "dev"

func main() {
	if err := run(); err != nil {
		fmt.Fprintf(os.Stderr, "fatal: %v\n", err)
		os.Exit(1)
	}
}

func run() error {
	// Parse CLI flags.
	rootCmd := buildCLI()
	return rootCmd.Execute()
}

// startDaemon is the main entry point called by the "start" command.
func startDaemon(configPath string, logLevel string) error {
	// 1. Acquire PID lock.
	lock := system.NewLockFile(system.DefaultLockPath())
	if err := lock.Acquire(); err != nil {
		return fmt.Errorf("acquire lock: %w", err)
	}
	defer lock.Release()

	// 2. Load config.
	if configPath == "" {
		configPath = system.DefaultConfigPath()
	}
	cfg, err := config.NewViperManager(configPath)
	if err != nil {
		return fmt.Errorf("load config: %w", err)
	}

	// 3. Setup logging.
	setupLogging(cfg, logLevel)
	slog.Info("daemon starting", "version", version, "config", configPath)

	// 4. Ensure directories exist.
	for _, dir := range []string{
		cfg.GetImagesDir(),
		cfg.GetThumbnailsDir(),
		cfg.GetDatabaseDir(),
	} {
		if err := system.EnsureDir(dir); err != nil {
			return fmt.Errorf("ensure dir %s: %w", dir, err)
		}
	}
	if err := system.EnsureParentDir(cfg.GetSocketPath()); err != nil {
		return fmt.Errorf("ensure socket parent dir: %w", err)
	}

	// 5. Open database.
	db, err := store.OpenDB(cfg.GetDatabaseDir())
	if err != nil {
		return fmt.Errorf("open database: %w", err)
	}
	defer db.Close()

	// 6. Create event bus.
	bus := events.NewBus()
	defer bus.Close()

	// 6b. Publish SSE events when config.toml is edited externally.
	cfg.OnConfigChange(func(section string) {
		sections := []string{section}
		if section == "" {
			sections = []string{"app", "daemon", "backend", "monitors"}
		}
		slog.Info("config file changed externally", "sections", sections)
		bus.Publish(events.Event{
			Type: events.ConfigChanged,
			Data: map[string]any{"sections": sections, "source": "file"},
		})
	})

	// 7. Create monitor manager.
	providers := []monitor.MonitorProvider{
		monitor.NewHyprctlProvider(),
		monitor.NewSwaymsgProvider(),
		monitor.NewWlrRandrProvider(),
		monitor.NewXrandrProvider(),
	}

	compositorOverride := monitor.CompositorType("")
	fullCfg, _ := cfg.GetConfig()
	if fullCfg != nil && fullCfg.Daemon.Compositor != "auto" && fullCfg.Daemon.Compositor != "" {
		compositorOverride = monitor.CompositorType(fullCfg.Daemon.Compositor)
	}

	monManager, err := monitor.NewMonitorManager(providers, compositorOverride)
	if err != nil {
		return fmt.Errorf("create monitor manager: %w", err)
	}

	slog.Info("compositor detected", "type", monManager.Compositor())

	// 8. Create and register backends.
	reg := backend.NewRegistry()
	backends := []backend.Backend{
		swww.New(),
		feh.New(),
		hyprpaper.New(),
	}
	for _, b := range backends {
		if err := reg.Register(b); err != nil {
			slog.Warn("failed to register backend", "name", b.Name(), "error", err)
		}
		b.RegisterDefaults(cfg.Viper())
	}

	// 9. Activate the configured backend.
	activeBackendName := cfg.GetActiveBackendType()
	if err := reg.SetActive(activeBackendName); err != nil {
		// Fall back to any available backend.
		slog.Warn("configured backend not available, trying alternatives", "backend", activeBackendName, "error", err)
		for _, info := range reg.Available() {
			if info.Available {
				if err := reg.SetActive(info.Name); err == nil {
					activeBackendName = info.Name
					slog.Info("using fallback backend", "name", info.Name)
					break
				}
			}
		}
	}

	// 10. Initialize active backend.
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	activeBackend := reg.Active()
	if err := activeBackend.Initialize(ctx); err != nil {
		slog.Warn("failed to initialize backend", "name", activeBackend.Name(), "error", err)
	} else {
		slog.Info("backend initialized", "name", activeBackend.Name())
	}

	// 11. Create image processor and splitter.
	processor := image.NewProcessor(db.ImageStore(), bus, cfg.GetImagesDir(), cfg.GetThumbnailsDir())
	splitter := image.NewSplitter(cfg.GetImagesDir())

	// 11b. Clean stale processed images if the gallery is empty (e.g. after a
	// DB wipe). Prevents cached split fragments from being served for
	// newly-assigned image IDs that map to different source images.
	cleanStaleProcessedDir(ctx, db.ImageStore(), cfg.GetImagesDir())

	// 10b. Restore wallpapers from persisted monitor state.
	handler.RestoreWallpapers(ctx, db.MonitorStateStore(), db.StateStore(), reg, monManager, splitter)

	// 12. Create playlist manager.
	playlistMgr := playlist.NewManager(
		db.PlaylistStore(),
		db.StateStore(),
		db.HistoryStore(),
		db.ImageStore(),
		db.MonitorStateStore(),
		reg,
		monManager,
		bus,
		splitter,
	)

	// 13. Create shutdown function.
	shutdownCh := make(chan struct{}, 1)
	shutdownFn := func() {
		select {
		case shutdownCh <- struct{}{}:
		default:
		}
	}

	// 14. Create handlers.
	handlers := server.Handlers{
		Health:    handler.NewHealthHandler(version, shutdownFn),
		Images:    handler.NewImageHandler(db.ImageStore(), processor, bus),
		Playlists: handler.NewPlaylistHandler(db.PlaylistStore(), db.StateStore(), playlistMgr, bus),
		Monitors:  handler.NewMonitorHandler(monManager),
		Config:    handler.NewConfigHandler(cfg, reg, bus),
		Backends:  handler.NewBackendHandler(reg, cfg, bus, db.MonitorStateStore(), db.StateStore(), monManager, splitter),
		Wallpaper: handler.NewWallpaperHandler(
			db.ImageStore(), db.HistoryStore(), db.StateStore(), db.MonitorStateStore(),
			reg, monManager, splitter, bus,
		),
		Folders: handler.NewFolderHandler(db.FolderStore(), db.ImageStore(), bus),
	}

	// 15. Create router and server.
	router := server.NewRouter(handlers, bus)
	srv := server.NewServer(cfg.GetSocketPath(), router)

	// 16. Handle OS signals.
	sigCh := make(chan os.Signal, 1)
	signal.Notify(sigCh, syscall.SIGINT, syscall.SIGTERM)

	// Start server in goroutine.
	errCh := make(chan error, 1)
	go func() {
		errCh <- srv.Serve()
	}()

	slog.Info("daemon ready", "socket", cfg.GetSocketPath(), "pid", os.Getpid())

	// 17. Wait for shutdown signal.
	var serverErr error
	select {
	case sig := <-sigCh:
		slog.Info("received signal", "signal", sig)
	case <-shutdownCh:
		slog.Info("shutdown requested via API")
	case err := <-errCh:
		if err != nil {
			serverErr = err
			slog.Error("server error, initiating shutdown", "error", err)
		}
	}

	// 18. Graceful shutdown.
	slog.Info("shutting down...")

	shutdownCtx, shutdownCancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer shutdownCancel()

	// Stop playlists.
	playlistMgr.StopAll()

	// Shutdown server.
	if err := srv.Shutdown(shutdownCtx); err != nil {
		slog.Error("server shutdown error", "error", err)
	}

	// Shutdown the currently active backend (use registry to get the
	// current one, not the startup-time snapshot which may be stale if
	// the backend was switched at runtime via the API).
	if err := reg.Active().Shutdown(shutdownCtx); err != nil {
		slog.Warn("backend shutdown error", "error", err)
	}

	// Close event bus (closes SSE connections).
	bus.Close()

	// Close database.
	if err := db.Close(); err != nil {
		slog.Error("database close error", "error", err)
	}

	// Remove socket file.
	_ = os.Remove(cfg.GetSocketPath())

	// Release lock.
	_ = lock.Release()

	slog.Info("daemon stopped")
	if serverErr != nil {
		return fmt.Errorf("server error: %w", serverErr)
	}
	return nil
}

// setupLogging configures slog with file output (via lumberjack) and stderr.
func setupLogging(cfg *config.ViperManager, levelOverride string) {
	logFile := cfg.GetLogFile()

	// Determine log level.
	level := slog.LevelInfo
	levelStr := levelOverride
	if levelStr == "" {
		fullCfg, _ := cfg.GetConfig()
		if fullCfg != nil {
			levelStr = fullCfg.Daemon.LogLevel
		}
	}
	switch levelStr {
	case "debug":
		level = slog.LevelDebug
	case "warn":
		level = slog.LevelWarn
	case "error":
		level = slog.LevelError
	}

	// Setup writers.
	var writers []io.Writer
	writers = append(writers, os.Stderr)

	if logFile != "" {
		if err := system.EnsureParentDir(logFile); err == nil {
			lj := &lumberjack.Logger{
				Filename:   logFile,
				MaxSize:    10, // megabytes
				MaxBackups: 3,
				Compress:   false,
			}

			fullCfg, _ := cfg.GetConfig()
			if fullCfg != nil {
				if fullCfg.Daemon.LogMaxSizeMB > 0 {
					lj.MaxSize = fullCfg.Daemon.LogMaxSizeMB
				}
				if fullCfg.Daemon.LogMaxBackups > 0 {
					lj.MaxBackups = fullCfg.Daemon.LogMaxBackups
				}
			}

			writers = append(writers, lj)
		}
	}

	// Create slog handler with multi-writer.
	handlerOpts := &slog.HandlerOptions{Level: level}
	multi := slogmulti.Fanout(
		slog.NewJSONHandler(io.MultiWriter(writers...), handlerOpts),
	)

	slog.SetDefault(slog.New(multi))
}

// cleanStaleProcessedDir removes the processed/ split-image cache when the
// image gallery is empty. This prevents stale cached fragments from being
// served after a DB wipe + re-import where image IDs get reassigned.
func cleanStaleProcessedDir(ctx context.Context, imageStore store.ImageStore, imagesDir string) {
	count, err := imageStore.Count(ctx)
	if err != nil {
		slog.Warn("clean processed: failed to count images", "error", err)
		return
	}
	if count > 0 {
		return
	}

	processedDir := filepath.Join(imagesDir, "processed")
	if _, err := os.Stat(processedDir); os.IsNotExist(err) {
		return
	}

	if err := os.RemoveAll(processedDir); err != nil {
		slog.Warn("clean processed: failed to remove stale cache", "error", err)
		return
	}
	slog.Info("clean processed: removed stale split-image cache (gallery is empty)")
}
