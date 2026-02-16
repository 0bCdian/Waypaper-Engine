package main

import (
	"context"
	"fmt"
	"io"
	"log/slog"
	"os"
	"os/signal"
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

	// 10b. Restore wallpapers from persisted monitor state.
	restoreWallpapers(ctx, db.MonitorStateStore(), db.StateStore(), reg, monManager)

	// 11. Create image processor and splitter.
	processor := image.NewProcessor(db.ImageStore(), bus, cfg.GetImagesDir(), cfg.GetThumbnailsDir())
	splitter := image.NewSplitter(cfg.GetImagesDir())

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
		Backends:  handler.NewBackendHandler(reg, cfg, bus),
		Wallpaper: handler.NewWallpaperHandler(
			db.ImageStore(), db.HistoryStore(), db.StateStore(), db.MonitorStateStore(),
			reg, monManager, splitter, bus,
		),
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
	select {
	case sig := <-sigCh:
		slog.Info("received signal", "signal", sig)
	case <-shutdownCh:
		slog.Info("shutdown requested via API")
	case err := <-errCh:
		if err != nil {
			return fmt.Errorf("server error: %w", err)
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

	// Shutdown backend.
	if err := activeBackend.Shutdown(shutdownCtx); err != nil {
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
	return nil
}

// restoreWallpapers re-applies the last known wallpaper for each connected
// monitor using the persisted monitor state from CloverDB. This runs during
// startup so that monitors show the correct wallpaper after a daemon restart.
// Best-effort: errors are logged but do not block startup.
func restoreWallpapers(
	ctx context.Context,
	monitorStateStore store.MonitorStateStore,
	stateStore store.StateStore,
	reg backend.Registry,
	monManager monitor.MonitorManager,
) {
	states, err := monitorStateStore.GetAll(ctx)
	if err != nil {
		slog.Warn("restore: failed to load monitor states", "error", err)
		return
	}
	if len(states) == 0 {
		slog.Info("restore: no persisted monitor state, skipping")
		return
	}

	// Log the persisted state names for debugging.
	stateNames := make([]string, len(states))
	for i, s := range states {
		stateNames[i] = s.MonitorName
	}
	slog.Info("restore: loaded persisted states", "monitors", stateNames)

	monitors, err := monManager.GetMonitors(ctx)
	if err != nil {
		slog.Warn("restore: failed to get monitors", "error", err)
		return
	}

	// Build a set of connected monitor names for fast lookup.
	connected := make(map[string]monitor.Monitor, len(monitors))
	connectedNames := make([]string, len(monitors))
	for i, mon := range monitors {
		connected[mon.Name] = mon
		connectedNames[i] = mon.Name
	}
	slog.Info("restore: detected monitors", "monitors", connectedNames)

	activeBackend := reg.Active()
	restored := 0
	skipped := 0

	for _, state := range states {
		mon, ok := connected[state.MonitorName]
		if !ok {
			slog.Warn("restore: monitor not connected, skipping",
				"persisted_name", state.MonitorName,
				"connected_monitors", connectedNames,
			)
			skipped++
			continue
		}

		req := backend.WallpaperRequest{
			ImagePath: state.ImagePath,
			Monitors:  []monitor.Monitor{mon},
			Mode:      monitor.MonitorMode(state.Mode),
		}

		if err := activeBackend.SetWallpaper(ctx, req); err != nil {
			slog.Warn("restore: failed to set wallpaper",
				"monitor", state.MonitorName,
				"image_id", state.ImageID,
				"image_path", state.ImagePath,
				"error", err,
			)
			continue
		}

		// Populate in-memory state so API queries return correct data immediately.
		stateStore.SetCurrentWallpaper(state.MonitorName, store.ImageHistoryEntry{
			ImageID:   state.ImageID,
			ImageName: state.ImageName,
			Monitors:  []string{state.MonitorName},
			Mode:      state.Mode,
			SetAt:     state.SetAt,
			Source:    store.HistorySource{Type: "restore"},
			Backend:   state.Backend,
		})

		restored++
	}

	slog.Info("wallpaper restore complete", "restored", restored, "skipped", skipped)
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

