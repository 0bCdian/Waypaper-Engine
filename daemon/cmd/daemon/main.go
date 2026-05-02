//go:generate swag init -g cmd/daemon/main.go -o docs --outputTypes yaml --parseInternal --parseDependency

// @title        waypaper-engine daemon
// @version      3.0.0
// @description  HTTP API served over a Unix socket for the waypaper-engine wallpaper manager.
// @BasePath     /

package main

import (
	"context"
	"fmt"
	"log/slog"
	"os"
	"os/signal"
	"syscall"

	slogmulti "github.com/samber/slog-multi"
	"gopkg.in/natefinch/lumberjack.v2"

	"waypaper-engine/daemon/internal/backend"
	"waypaper-engine/daemon/internal/backend/awww"
	"waypaper-engine/daemon/internal/backend/feh"
	"waypaper-engine/daemon/internal/backend/hyprpaper"
	"waypaper-engine/daemon/internal/backend/mpvpaper"
	"waypaper-engine/daemon/internal/backend/waylandutauri"
	"waypaper-engine/daemon/internal/config"
	"waypaper-engine/daemon/internal/daemon"
	"waypaper-engine/daemon/internal/monitor"
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
	lp := lockPath
	if lp == "" {
		lp = system.DefaultLockPath()
	}
	lock := system.NewLockFile(lp)
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

	// 4. Ensure database directory exists (images/thumbnails/socket are handled
	//    by daemon.Start(); DB dir must exist before OpenDB).
	if err := system.EnsureDir(cfg.GetDatabaseDir()); err != nil {
		return fmt.Errorf("ensure dir %s: %w", cfg.GetDatabaseDir(), err)
	}

	// 5. Open database.
	db, err := store.OpenDB(cfg.GetDatabaseDir())
	if err != nil {
		return fmt.Errorf("open database: %w", err)
	}
	defer db.Close()

	// 6. Create and register backends.
	reg := backend.NewRegistry()
	backends := []backend.Backend{
		awww.New(),
		feh.New(),
		hyprpaper.New(),
		mpvpaper.New(),
		waylandutauri.New(),
	}
	for _, b := range backends {
		if err := reg.Register(b); err != nil {
			slog.Warn("failed to register backend", "name", b.Name(), "error", err)
		}
		b.RegisterDefaults(cfg.Viper())
	}

	// 7. Activate the configured backend (fall back to any available backend).
	// If nothing is available the daemon starts in degraded mode and notifies the GUI via SSE.
	activeBackendName := cfg.GetActiveBackendType()
	if err := reg.SetActive(activeBackendName); err != nil {
		slog.Warn("configured backend not available, trying alternatives", "backend", activeBackendName, "error", err)
		activated := false
		for _, info := range reg.Available() {
			if info.Available {
				if err := reg.SetActive(info.Name); err == nil {
					slog.Info("using fallback backend", "name", info.Name)
					activated = true
					break
				}
			}
		}
		if !activated {
			slog.Warn("no wallpaper backend found; daemon will start in degraded mode — install a backend to set wallpapers")
		}
	}

	// 8. Determine compositor override from config.
	var compositorOverride monitor.CompositorType
	fullCfg, _ := cfg.GetConfig()
	if fullCfg != nil && fullCfg.Daemon.Compositor != "auto" && fullCfg.Daemon.Compositor != "" {
		compositorOverride = monitor.CompositorType(fullCfg.Daemon.Compositor)
	}

	// 9. Set up signal-aware context.
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	sigCh := make(chan os.Signal, 1)
	signal.Notify(sigCh, syscall.SIGINT, syscall.SIGTERM)
	defer signal.Stop(sigCh)
	go func() {
		select {
		case sig := <-sigCh:
			slog.Info("received signal", "signal", sig)
			cancel()
		case <-ctx.Done():
		}
	}()

	// 10. Build daemon options and start.
	opts := daemon.Options{
		SocketPath:    cfg.GetSocketPath(),
		DB:            db,
		Registry:      reg,
		Cfg:           cfg,
		Viper:         cfg.Viper(),
		ImagesDir:     cfg.GetImagesDir(),
		ThumbnailsDir: cfg.GetThumbnailsDir(),
		Version:       version,
		Compositor:    compositorOverride,
		MonitorProviders: []monitor.MonitorProvider{
			waylandutauri.NewMonitorProvider(cfg.Viper()),
			monitor.NewWaylandProvider(),
			monitor.NewXrandrProvider(),
		},
	}
	d, err := daemon.New(opts)
	if err != nil {
		return fmt.Errorf("create daemon: %w", err)
	}
	return d.Start(ctx)
}

// logLevel is a package-level LevelVar so the level can be changed at runtime.
var programLevel = new(slog.LevelVar)

// setupLogging configures slog with a human-readable text handler for stderr
// and a JSON handler for the log file (via lumberjack rotation).
// Level precedence: CLI flag > WAYPAPER_LOG_LEVEL env var > config file > info.
func setupLogging(cfg *config.ViperManager, levelOverride string) {
	logFile := cfg.GetLogFile()

	levelStr := levelOverride
	if levelStr == "" {
		levelStr = os.Getenv("WAYPAPER_LOG_LEVEL")
	}
	if levelStr == "" {
		fullCfg, _ := cfg.GetConfig()
		if fullCfg != nil {
			levelStr = fullCfg.Daemon.LogLevel
		}
	}
	switch levelStr {
	case "debug":
		programLevel.Set(slog.LevelDebug)
	case "info":
		programLevel.Set(slog.LevelInfo)
	case "warn":
		programLevel.Set(slog.LevelWarn)
	case "error":
		programLevel.Set(slog.LevelError)
	default:
		programLevel.Set(slog.LevelInfo)
	}

	handlers := []slog.Handler{
		slog.NewTextHandler(os.Stderr, &slog.HandlerOptions{Level: programLevel}),
	}

	if logFile != "" {
		if err := system.EnsureParentDir(logFile); err == nil {
			lj := &lumberjack.Logger{
				Filename:   logFile,
				MaxSize:    10,
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

			handlers = append(handlers, slog.NewJSONHandler(lj, &slog.HandlerOptions{Level: programLevel}))
		}
	}

	slog.SetDefault(slog.New(slogmulti.Fanout(handlers...)))
}
