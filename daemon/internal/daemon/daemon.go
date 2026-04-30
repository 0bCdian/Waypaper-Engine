// Package daemon provides the Daemon struct that wires all subsystems and
// serves the HTTP API over a Unix socket. It can be instantiated from main.go
// or from integration tests with injected dependencies.
package daemon

import (
	"context"
	"fmt"
	"log/slog"
	"net"
	"net/http"
	"os"
	"path/filepath"
	"time"

	"github.com/spf13/viper"

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
	"waypaper-engine/daemon/internal/handler/wallpaperhandler"
	"waypaper-engine/daemon/internal/image"
	"waypaper-engine/daemon/internal/monitor"
	"waypaper-engine/daemon/internal/playlist"
	"waypaper-engine/daemon/internal/server"
	"waypaper-engine/daemon/internal/store"
	"waypaper-engine/daemon/internal/system"
	"waypaper-engine/daemon/internal/wallpaper"
)

// Options holds all injected dependencies for a Daemon instance.
type Options struct {
	// SocketPath is the Unix socket the HTTP server listens on.
	SocketPath string
	// DB is the open database; the Daemon does NOT close it on shutdown — the
	// caller is responsible for closing it after Start returns.
	DB store.DB
	// Registry is the populated backend registry. The caller is responsible for
	// registering backends and setting the active one before calling New.
	Registry backend.Registry
	// Cfg is the config manager (provides typed accessors and update helpers).
	Cfg config.ConfigManager
	// Viper is the raw viper instance needed by image.NewProcessor.
	Viper *viper.Viper
	// ImagesDir is the directory where wallpaper images are stored.
	ImagesDir string
	// ThumbnailsDir is the directory where thumbnails are cached.
	ThumbnailsDir string
	// Version is embedded in /healthz responses.
	Version string
	// Compositor overrides compositor auto-detection. Leave empty for auto.
	Compositor monitor.CompositorType
	// MonitorProviders is the list of monitor providers to use. Pass nil/empty
	// to skip provider-based detection (useful in tests).
	MonitorProviders []monitor.MonitorProvider
}

// Daemon wires all subsystems and serves the HTTP API over a Unix socket.
type Daemon struct {
	opts Options
}

// New validates options and creates a Daemon. It does not start the server.
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
	if opts.Viper == nil {
		return nil, fmt.Errorf("daemon: Viper is required")
	}
	return &Daemon{opts: opts}, nil
}

// Start wires subsystems, starts the HTTP server, and blocks until ctx is
// cancelled or the server fails.
//
// Shutdown sequence on ctx cancellation:
//  1. Stop playlist manager
//  2. Shutdown HTTP server
//  3. Shutdown active backend
//  4. Close event bus
//
// The caller is responsible for closing opts.DB after Start returns.
func (d *Daemon) Start(ctx context.Context) error {
	opts := d.opts

	// Ensure directories exist.
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

	// Create event bus.
	bus := events.NewBus()
	defer bus.Close()

	// Publish SSE events when config.toml is edited externally.
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

	// restoreRetryCtx is cancelled as soon as graceful shutdown begins so that
	// deferred daemon-backend restore retries stop immediately.
	restoreRetryCtx, cancelRestoreRetry := context.WithCancel(ctx)
	defer cancelRestoreRetry()

	// Initialize active backend.
	activeBackend := opts.Registry.Active()
	if activeBackend == nil {
		return fmt.Errorf("daemon: no active backend set in registry")
	}
	caps := activeBackend.Capabilities()
	initErr := activeBackend.Initialize(ctx)
	if initErr != nil {
		if caps.DaemonProcess {
			slog.Error("failed to initialize daemon backend; wallpaper restore deferred",
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
			slog.Warn("failed to initialize backend", "name", activeBackend.Name(), "error", initErr)
		}
	} else {
		slog.Info("backend initialized", "name", activeBackend.Name())
		if err := activeBackend.OnConfigChanged(ctx, nil); err != nil {
			slog.Warn("backend config sync after init failed", "error", err)
		}
	}

	// Create image processor and splitter.
	processor := image.NewProcessor(opts.DB.ImageStore(), bus, opts.ImagesDir, opts.ThumbnailsDir, opts.Viper)
	splitter := image.NewSplitter(opts.ImagesDir)

	// Backfill missing video browser previews asynchronously.
	go processor.BackfillMissingVideoBrowserPreviews(context.Background())

	// Create monitor manager.
	monManager, err := monitor.NewMonitorManager(opts.MonitorProviders, opts.Compositor)
	if err != nil {
		return fmt.Errorf("daemon: create monitor manager: %w", err)
	}
	slog.Info("compositor detected", "type", monManager.Compositor())

	// Clean stale processed images if gallery is empty (e.g. after a DB wipe).
	cleanStaleProcessedDir(ctx, opts.DB.ImageStore(), opts.ImagesDir)

	// Restore wallpapers from persisted monitor state.
	if initErr != nil && caps.DaemonProcess {
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
		wallpaper.Restore(ctx, opts.DB.MonitorStateStore(), opts.DB.StateStore(), opts.Registry, opts.Cfg, monManager, opts.DB.ImageStore(), splitter, bus)
	}

	// Create playlist manager.
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
	if err := playlistMgr.RestorePersistedRuns(ctx); err != nil {
		slog.Warn("playlist restore from disk failed", "error", err)
	}

	// Shutdown channel (used by /healthz shutdown endpoint).
	shutdownCh := make(chan struct{}, 1)
	shutdownFn := func() {
		select {
		case shutdownCh <- struct{}{}:
		default:
		}
	}

	// Create control plane and handlers.
	ctrl := control.NewController(opts.Cfg, opts.Registry, bus, control.RestoreFunc(func(rctx context.Context) {
		wallpaper.Restore(rctx, opts.DB.MonitorStateStore(), opts.DB.StateStore(), opts.Registry, opts.Cfg, monManager, opts.DB.ImageStore(), splitter, bus)
	}))
	handlers := server.Handlers{
		Health:    healthhandler.NewHealthHandler(opts.Version, shutdownFn),
		Images:    imageshandler.NewImageHandler(opts.DB.ImageStore(), processor, bus, opts.Registry),
		Playlists: playlistshandler.NewPlaylistHandler(opts.DB.PlaylistStore(), opts.DB.StateStore(), playlistMgr, bus),
		Monitors:  monitorshandler.NewMonitorHandler(monManager),
		Config:    confighandler.NewConfigHandler(ctrl),
		Backends:  backendshandler.NewBackendHandler(opts.Registry, ctrl),
		Wallpaper: wallpaperhandler.NewWallpaperHandler(
			opts.DB.ImageStore(), opts.DB.HistoryStore(), opts.DB.StateStore(), opts.DB.MonitorStateStore(),
			opts.Registry, monManager, splitter, bus, opts.Cfg,
		),
		Folders: foldershandler.NewFolderHandler(opts.DB.FolderStore(), opts.DB.ImageStore(), bus),
	}

	// Create router and server.
	router := server.NewRouter(handlers, bus)
	srv := server.NewServer(opts.SocketPath, router)

	// Start HTTP server.
	errCh := make(chan error, 1)
	go func() {
		errCh <- srv.Serve()
	}()

	slog.Info("daemon ready", "socket", opts.SocketPath)

	// Wait for shutdown.
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

	// Graceful shutdown.
	slog.Info("shutting down...")

	// Stop deferred restore retries immediately so shutdown isn't delayed.
	cancelRestoreRetry()

	shutdownCtx, shutdownCancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer shutdownCancel()

	playlistMgr.Shutdown(shutdownCtx)

	if err := srv.Shutdown(shutdownCtx); err != nil {
		slog.Error("server shutdown error", "error", err)
	}

	if err := opts.Registry.Active().Shutdown(shutdownCtx); err != nil {
		slog.Warn("backend shutdown error", "error", err)
	}

	_ = os.Remove(opts.SocketPath)

	slog.Info("daemon stopped")
	if serverErr != nil {
		return fmt.Errorf("server error: %w", serverErr)
	}
	return nil
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

// WaitForSocket polls until the Unix socket at path is accepting connections,
// or until timeout is exceeded. Useful in tests.
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

// UnixClient returns an *http.Client that dials the given Unix socket path.
// The baseURL (e.g. "http://daemon") is only used for path construction.
func UnixClient(socketPath string) *http.Client {
	return &http.Client{
		Transport: &http.Transport{
			DialContext: func(ctx context.Context, _, _ string) (net.Conn, error) {
				return (&net.Dialer{}).DialContext(ctx, "unix", socketPath)
			},
		},
	}
}
