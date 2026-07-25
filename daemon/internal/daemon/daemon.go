package daemon

import (
	"context"
	"fmt"
	"io"
	"log/slog"
	"net"
	"net/http"
	"os"
	"path/filepath"
	"time"
	"waypaper-engine/daemon/internal/backend"
	"waypaper-engine/daemon/internal/config"
	"waypaper-engine/daemon/internal/control"
	"waypaper-engine/daemon/internal/events"
	"waypaper-engine/daemon/internal/handler/backendshandler"
	"waypaper-engine/daemon/internal/handler/confighandler"
	"waypaper-engine/daemon/internal/handler/foldershandler"
	"waypaper-engine/daemon/internal/handler/healthhandler"
	"waypaper-engine/daemon/internal/handler/imageshandler"
	"waypaper-engine/daemon/internal/handler/monitorshandler"
	"waypaper-engine/daemon/internal/handler/playlistshandler"
	"waypaper-engine/daemon/internal/handler/themeshandler"
	"waypaper-engine/daemon/internal/handler/wallpaperhandler"
	"waypaper-engine/daemon/internal/image"
	"waypaper-engine/daemon/internal/monitor"
	"waypaper-engine/daemon/internal/playlist"
	"waypaper-engine/daemon/internal/server"
	"waypaper-engine/daemon/internal/store"
	"waypaper-engine/daemon/internal/system"
	"waypaper-engine/daemon/internal/wallpaper"
)

const themesSubdir = "themes"

type Options struct {
	SocketPath       string
	DB               store.DB
	Registry         backend.Registry
	Cfg              config.ConfigManager
	ImagesDir        string
	ThumbnailsDir    string
	Version          string
	Compositor       monitor.CompositorType
	MonitorProviders []monitor.MonitorProvider
}

type Daemon struct {
	opts Options
}

func New(opts Options) (*Daemon, error) {
	if opts.SocketPath == "" {
		return nil, fmt.Errorf("daemon: SocketPath is required")
	}
	if opts.DB == nil {
		return nil, fmt.Errorf("daemon: DB is required")
	}
	if opts.Registry == nil {
		return nil, fmt.Errorf("daemon: Registry is required")
	}
	if opts.Cfg == nil {
		return nil, fmt.Errorf("daemon: Cfg is required")
	}
	return &Daemon{opts: opts}, nil
}

func (d *Daemon) Start(ctx context.Context) error {
	opts := d.opts

	for _, dir := range []string{opts.ImagesDir, opts.ThumbnailsDir} {
		if dir != "" {
			if err := system.EnsureDir(dir); err != nil {
				return fmt.Errorf("daemon: ensure dir %s: %w", dir, err)
			}
		}
	}
	if err := system.EnsureParentDir(opts.SocketPath); err != nil {
		return fmt.Errorf("daemon: ensure socket parent dir: %w", err)
	}

	bus := events.NewBus()
	defer bus.Close()

	opts.Cfg.OnConfigChange(func(section string) {
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

	restoreRetryCtx, cancelRestoreRetry := context.WithCancel(ctx)
	defer cancelRestoreRetry()

	noBackendInstalled := !opts.Registry.HasActive()
	var initErr error
	if !noBackendInstalled {
		activeBackend := opts.Registry.Active()
		initErr = activeBackend.Initialize(ctx)
		if initErr != nil {
			slog.Error("failed to initialize backend; wallpaper restore deferred",
				"name", activeBackend.Name(), "error", initErr)
			bus.Publish(events.Event{
				Type: events.BackendUnavailable,
				Data: map[string]any{
					"backend":  activeBackend.Name(),
					"message":  initErr.Error(),
					"retrying": true,
				},
			})
		} else {
			slog.Info("backend initialized", "name", activeBackend.Name())
		}
	} else {
		slog.Warn("no wallpaper backend is installed; daemon running in degraded mode")
	}

	processor := image.NewProcessor(opts.DB.ImageStore(), bus, opts.ImagesDir, opts.ThumbnailsDir)
	splitter := image.NewSplitter(opts.ImagesDir)

	go processor.BackfillMissingVideoBrowserPreviews(ctx)

	monManager, err := monitor.NewMonitorManager(opts.MonitorProviders, opts.Compositor)
	if err != nil {
		return fmt.Errorf("daemon: create monitor manager: %w", err)
	}
	slog.Info("compositor detected", "type", monManager.Compositor())

	cleanStaleProcessedDir(ctx, opts.DB.ImageStore(), opts.ImagesDir)

	restoreDone := make(chan struct{})
	if !noBackendInstalled {
		if initErr != nil {
			close(restoreDone)
			wallpaper.StartDeferredDaemonRestore(
				restoreRetryCtx,
				opts.Registry,
				opts.Cfg,
				opts.DB.MonitorStateStore(),
				opts.DB.StateStore(),
				monManager,
				opts.DB.ImageStore(),
				splitter,
				bus,
			)
		} else {
			go func() {
				defer close(restoreDone)
				wallpaper.Restore(restoreRetryCtx, opts.DB.MonitorStateStore(), opts.DB.StateStore(), opts.Registry, opts.Cfg, monManager, opts.DB.ImageStore(), splitter, bus)
			}()
		}
	} else {
		close(restoreDone)
	}

	playlistMgr := playlist.NewManager(
		opts.DB.PlaylistStore(),
		opts.DB.StateStore(),
		opts.DB.HistoryStore(),
		opts.DB.ImageStore(),
		opts.DB.MonitorStateStore(),
		opts.Registry,
		monManager,
		bus,
		splitter,
		opts.Cfg,
	)
	select {
	case <-restoreDone:
	case <-time.After(20 * time.Second):
		slog.Warn("startup restore did not finish in time; restoring playlists anyway")
	case <-ctx.Done():
	}

	if err := playlistMgr.RestorePersistedRuns(ctx); err != nil {
		slog.Warn("playlist restore from disk failed", "error", err)
	}

	shutdownCh := make(chan struct{}, 1)
	shutdownFn := func() {
		select {
		case shutdownCh <- struct{}{}:
		default:
		}
	}

	ctrl := control.NewController(opts.Cfg, opts.Registry, bus, control.RestoreFunc(func(rctx context.Context) {
		wallpaper.Restore(rctx, opts.DB.MonitorStateStore(), opts.DB.StateStore(), opts.Registry, opts.Cfg, monManager, opts.DB.ImageStore(), splitter, bus)
	}))
	userThemesDir := filepath.Join(system.ConfigHome(), themesSubdir)
	handlers := server.Handlers{
		Health: healthhandler.NewHealthHandler(opts.Version, shutdownFn),
		Images: imageshandler.NewImageHandler(
			opts.DB.ImageStore(), opts.DB.MonitorStateStore(), opts.DB.HistoryStore(), opts.DB.PlaylistStore(),
			processor, bus, opts.Registry,
		),
		Playlists: playlistshandler.NewPlaylistHandler(opts.DB.PlaylistStore(), opts.DB.StateStore(), playlistMgr, bus),
		Monitors:  monitorshandler.NewMonitorHandler(monManager),
		Config:    confighandler.NewConfigHandler(ctrl),
		Backends:  backendshandler.NewBackendHandler(opts.Registry, ctrl),
		Wallpaper: wallpaperhandler.NewWallpaperHandler(
			opts.DB.ImageStore(), opts.DB.HistoryStore(), opts.DB.StateStore(), opts.DB.MonitorStateStore(),
			opts.Registry, monManager, splitter, bus, opts.Cfg,
		),
		Folders: foldershandler.NewFolderHandler(opts.DB.FolderStore(), opts.DB.ImageStore(), bus),
		Themes:  themeshandler.NewThemesHandler(userThemesDir),
	}

	router := server.NewRouter(handlers, bus)
	srv := server.NewServer(opts.SocketPath, router)

	errCh := make(chan error, 1)
	go func() {
		errCh <- srv.Serve()
	}()

	slog.Info("daemon ready", "socket", opts.SocketPath)

	if noBackendInstalled {
		checked := make([]string, 0)
		for _, info := range opts.Registry.Available() {
			checked = append(checked, info.Name)
		}
		go bus.Publish(events.Event{
			Type: events.BackendUnavailable,
			Data: map[string]any{
				"message": "No wallpaper backend is installed. Install at least one backend to set wallpapers.",
				"checked": checked,
			},
		})
	}

	var serverErr error
	select {
	case <-ctx.Done():
		slog.Info("context cancelled, shutting down")
	case <-shutdownCh:
		slog.Info("shutdown requested via API")
	case err := <-errCh:
		if err != nil {
			serverErr = err
			slog.Error("server error, initiating shutdown", "error", err)
		}
	}

	slog.Info("shutting down...")

	cancelRestoreRetry()

	shutdownCtx, shutdownCancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer shutdownCancel()

	playlistMgr.Shutdown(shutdownCtx)

	if err := srv.Shutdown(shutdownCtx); err != nil {
		slog.Error("server shutdown error", "error", err)
	}

	if opts.Registry.HasActive() {
		if err := opts.Registry.Active().Shutdown(shutdownCtx); err != nil {
			slog.Warn("backend shutdown error", "error", err)
		}
	}
	if closer, ok := opts.Cfg.(io.Closer); ok {
		if err := closer.Close(); err != nil {
			slog.Warn("config manager close error", "error", err)
		}
	}

	_ = os.Remove(opts.SocketPath)

	slog.Info("daemon stopped")
	if serverErr != nil {
		return fmt.Errorf("server error: %w", serverErr)
	}
	return nil
}

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

func WaitForSocket(path string, timeout time.Duration) error {
	deadline := time.Now().Add(timeout)
	for time.Now().Before(deadline) {
		conn, err := net.DialTimeout("unix", path, 100*time.Millisecond)
		if err == nil {
			_ = conn.Close()
			return nil
		}
		time.Sleep(20 * time.Millisecond)
	}
	return fmt.Errorf("socket %s did not become ready within %s", path, timeout)
}

func UnixClient(socketPath string) *http.Client {
	return &http.Client{
		Transport: &http.Transport{
			DialContext: func(ctx context.Context, _, _ string) (net.Conn, error) {
				return (&net.Dialer{}).DialContext(ctx, "unix", socketPath)
			},
		},
	}
}
