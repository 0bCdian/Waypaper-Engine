package main

import (
	"context"
	"fmt"
	"log/slog"
	"os"
	"os/signal"
	"syscall"
	"waypaper-engine/daemon/internal/backend"
	"waypaper-engine/daemon/internal/backend/awww"
	"waypaper-engine/daemon/internal/backend/feh"
	"waypaper-engine/daemon/internal/backend/hyprpaper"
	"waypaper-engine/daemon/internal/backend/mpvpaper"
	"waypaper-engine/daemon/internal/backend/swaybg"
	"waypaper-engine/daemon/internal/backend/walqt"
	"waypaper-engine/daemon/internal/backenddefaults"
	"waypaper-engine/daemon/internal/config"
	"waypaper-engine/daemon/internal/daemon"
	"waypaper-engine/daemon/internal/monitor"
	"waypaper-engine/daemon/internal/store"
	"waypaper-engine/daemon/internal/system"

	slogmulti "github.com/samber/slog-multi"
	"gopkg.in/natefinch/lumberjack.v2"
)

var version = "dev"

func main() {
	if err := run(); err != nil {
		fmt.Fprintf(os.Stderr, "fatal: %v\n", err)
		os.Exit(1)
	}
}

func run() error {
	rootCmd := buildCLI()
	return rootCmd.Execute()
}

func startDaemon(configPath string, logLevel string) error {
	lp := lockPath
	if lp == "" {
		lp = system.DefaultLockPath()
	}
	lock := system.NewLockFile(lp)
	if err := lock.Acquire(); err != nil {
		return fmt.Errorf("acquire lock: %w", err)
	}
	defer lock.Release()

	if configPath == "" {
		configPath = system.DefaultConfigPath()
	}
	cfg, err := config.NewViperManager(configPath)
	if err != nil {
		return fmt.Errorf("load config: %w", err)
	}

	setupLogging(cfg, logLevel)
	slog.Info("daemon starting", "version", version, "config", configPath)

	if err := system.EnsureDir(cfg.GetDatabaseDir()); err != nil {
		return fmt.Errorf("ensure dir %s: %w", cfg.GetDatabaseDir(), err)
	}

	db, err := store.OpenDB(cfg.GetDatabaseDir())
	if err != nil {
		return fmt.Errorf("open database: %w", err)
	}
	defer db.Close()

	reg := backend.NewRegistry()
	backends := []backend.Backend{
		awww.New(),
		feh.New(),
		hyprpaper.New(),
		mpvpaper.New(),
		swaybg.New(),
		walqt.New(),
	}
	for _, b := range backends {
		if err := reg.Register(b); err != nil {
			slog.Warn("failed to register backend", "name", b.Name(), "error", err)
		}
		b.RegisterDefaults(cfg.Viper())
		if rc, ok := b.(backend.ConfigReaderReceiver); ok {
			rc.SetConfigReader(cfg)
		}
	}

	if err := cfg.EnsureDefaultsPersisted(backenddefaults.RegisterInto); err != nil {
		slog.Warn("could not persist complete config defaults", "error", err)
	}

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

	var compositorOverride monitor.CompositorType
	fullCfg, _ := cfg.GetConfig()
	if fullCfg != nil && fullCfg.Daemon.Compositor != "auto" && fullCfg.Daemon.Compositor != "" {
		compositorOverride = monitor.CompositorType(fullCfg.Daemon.Compositor)
	}

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

	opts := daemon.Options{
		SocketPath:       cfg.GetSocketPath(),
		DB:               db,
		Registry:         reg,
		Cfg:              cfg,
		ImagesDir:        cfg.GetImagesDir(),
		ThumbnailsDir:    cfg.GetThumbnailsDir(),
		Version:          version,
		Compositor:       compositorOverride,
		MonitorProviders: defaultMonitorProviders(cfg),
	}
	d, err := daemon.New(opts)
	if err != nil {
		return fmt.Errorf("create daemon: %w", err)
	}
	return d.Start(ctx)
}

var programLevel = new(slog.LevelVar)

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
