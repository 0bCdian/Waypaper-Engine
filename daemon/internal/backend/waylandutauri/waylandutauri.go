package waylandutauri

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log/slog"
	"os"
	"os/exec"
	"syscall"
	"time"

	"waypaper-engine/daemon/internal/backend"
	"waypaper-engine/daemon/internal/media"
	"waypaper-engine/daemon/internal/monitor"

	"github.com/spf13/viper"
)

const binaryName = "wayland-utauri"

// viperBackendKey matches backend.Name() — must align with SetBackendConfig("backend."+name).
const viperBackendKey = "backend.wayland-utauri"

// viperBackendKeyLegacy was used before hyphen matched Name(); still read for old config.toml.
const viperBackendKeyLegacy = "backend.waylandutauri"

// Launch flag forwarded to the wayland-utauri process (set by the daemon from CLI before Register).
var allowNetworkWallpapers bool

// SetAllowNetworkWallpapers records whether the daemon was started with --allow-network-wallpapers.
// Call before registering the backend (e.g. from cmd/daemon).
func SetAllowNetworkWallpapers(allow bool) {
	allowNetworkWallpapers = allow
}

type WaylandUtauri struct {
	v          *viper.Viper
	makeClient func(cfg *Config) (*controlClient, error)
	process    *os.Process
}

var _ backend.Backend = (*WaylandUtauri)(nil)

func New() backend.Backend {
	return &WaylandUtauri{makeClient: newControlClient}
}

func (w *WaylandUtauri) Name() string { return "wayland-utauri" }

func (w *WaylandUtauri) IsAvailable() bool {
	_, err := exec.LookPath(binaryName)
	return err == nil
}

func (w *WaylandUtauri) Capabilities() backend.Capabilities {
	return backend.Capabilities{
		Compositors:   []monitor.CompositorType{monitor.CompositorWayland},
		MediaTypes:    []media.MediaType{media.MediaTypeImage, media.MediaTypeGIF, media.MediaTypeVideo, media.MediaTypeWeb},
		Transitions:   true,
		PerMonitor:    true,
		DaemonProcess: true,
	}
}

func (w *WaylandUtauri) Initialize(ctx context.Context) error {
	if !w.IsAvailable() {
		return fmt.Errorf("wayland-utauri: %s not found in PATH", binaryName)
	}

	cfg := w.loadConfigFromViper()
	client, err := w.makeControlClient(cfg)
	if err != nil {
		return err
	}

	// Check if the service is already running.
	healthCtx, healthCancel := context.WithTimeout(ctx, time.Duration(cfg.ConnectTimeoutMS)*time.Millisecond)
	initialErr := client.checkHealth(healthCtx)
	healthCancel()

	if initialErr == nil {
		slog.Info("wayland-utauri already running")
		return w.postInitShow(ctx, client, cfg)
	}

	// If the service is reachable but has a contract mismatch (wrong
	// service name, API version), don't try to start another instance.
	if errors.Is(initialErr, errContract) {
		return fmt.Errorf("wayland-utauri: %w", initialErr)
	}

	// Service unreachable -- start it. Use a background-context command so the
	// process outlives the HTTP request that triggered activation.
	slog.Info("starting wayland-utauri", "binary", binaryName)
	args := []string(nil)
	if allowNetworkWallpapers {
		args = append(args, "--allow-network-wallpapers")
	}
	cmd := exec.Command(binaryName, args...)
	cmd.SysProcAttr = &syscall.SysProcAttr{Pdeathsig: syscall.SIGTERM}
	if err := cmd.Start(); err != nil {
		return fmt.Errorf("wayland-utauri: start %s: %w", binaryName, err)
	}
	w.process = cmd.Process

	go func() {
		_ = cmd.Wait()
	}()

	// Poll until the service becomes healthy (Tauri cold start can exceed a few seconds).
	const pollInterval = 250 * time.Millisecond
	const maxAttempts = 80 // up to ~20s after spawn

	var lastPollErr error
	for i := range maxAttempts {
		select {
		case <-ctx.Done():
			return ctx.Err()
		case <-time.After(pollInterval):
		}
		pollCtx, pollCancel := context.WithTimeout(ctx, time.Duration(cfg.ConnectTimeoutMS)*time.Millisecond)
		pollErr := client.checkHealth(pollCtx)
		pollCancel()
		lastPollErr = pollErr
		if pollErr == nil {
			slog.Info("wayland-utauri ready", "attempts", i+1)
			return w.postInitShow(ctx, client, cfg)
		}
		if errors.Is(pollErr, errContract) {
			return fmt.Errorf("wayland-utauri: %w", pollErr)
		}
	}

	return fmt.Errorf(
		"wayland-utauri: timed out waiting for control socket after starting %s (last error: %w). "+
			"Ensure the binary runs on Wayland and uses the same socket as "+viperBackendKey+".socket_path",
		binaryName, lastPollErr,
	)
}

func (w *WaylandUtauri) postInitShow(ctx context.Context, client *controlClient, cfg *Config) error {
	if cfg.ShowOnInitialize {
		if err := client.show(ctx); err != nil {
			return fmt.Errorf("wayland-utauri: show on initialize: %w", err)
		}
	}
	return nil
}

const statusDialRetries = 12
const statusDialBackoff = 250 * time.Millisecond

// getStatusWithRetry tolerates a cold control socket right after spawn or during restore.
func (w *WaylandUtauri) getStatusWithRetry(ctx context.Context, client *controlClient) (*statusResponse, error) {
	var lastErr error
	for attempt := range statusDialRetries {
		if attempt > 0 {
			select {
			case <-time.After(statusDialBackoff):
			case <-ctx.Done():
				return nil, ctx.Err()
			}
		}
		st, err := client.status(ctx)
		if err == nil {
			return st, nil
		}
		lastErr = err
		if !isRetryableUnixSocketDial(err) {
			return nil, err
		}
	}
	return nil, lastErr
}

func (w *WaylandUtauri) Shutdown(ctx context.Context) error {
	cfg := w.loadConfigFromViper()

	// Best-effort hide before stopping.
	if cfg.HideOnShutdown {
		client, err := w.makeControlClient(cfg)
		if err == nil {
			if err := client.hide(ctx); err != nil {
				slog.Warn("wayland-utauri: hide on shutdown failed", "error", err)
			}
		}
	}

	// If we started the process ourselves, terminate it.
	if w.process != nil {
		slog.Info("stopping wayland-utauri process we started")
		_ = w.process.Signal(syscall.SIGTERM)

		done := make(chan struct{})
		go func() {
			_, _ = w.process.Wait()
			close(done)
		}()
		select {
		case <-done:
			slog.Debug("wayland-utauri process exited")
		case <-time.After(3 * time.Second):
			slog.Warn("wayland-utauri did not exit after SIGTERM, sending SIGKILL")
			_ = w.process.Signal(syscall.SIGKILL)
		}
		w.process = nil
	}

	return nil
}

func (w *WaylandUtauri) SetWallpaper(ctx context.Context, req backend.WallpaperRequest) error {
	cfg, _ := req.Config.(*Config)
	if cfg == nil {
		cfg = w.loadConfigFromViper()
	}

	client, err := w.makeControlClient(cfg)
	if err != nil {
		return err
	}

	status, err := w.getStatusWithRetry(ctx, client)
	if err != nil {
		return fmt.Errorf("wayland-utauri: get status: %w", err)
	}
	monitorMap := buildMonitorMap(status.Status.Topology, req.Monitors)
	loadReq, err := buildLoadRequest(req, cfg, monitorMap)

	if err != nil {
		return err
	}

	backoffs := []time.Duration{0, 100 * time.Millisecond, 300 * time.Millisecond}
	var lastErr error
	for attempt := range backoffs {
		if attempt > 0 {
			select {
			case <-time.After(backoffs[attempt]):
			case <-ctx.Done():
				return ctx.Err()
			}
		}

		statusCode, body, callErr := client.load(ctx, loadReq)
		if callErr != nil {
			lastErr = callErr
			if !isRetryableError(callErr) || attempt == len(backoffs)-1 {
				return fmt.Errorf("wayland-utauri: load request failed: %w", callErr)
			}
			continue
		}

		if statusCode >= 200 && statusCode < 300 {
			// Parallax already embedded on load when enabled; avoid second POST and renderer double-apply.
			if cfg.ParallaxEnabled && loadReq.Parallax != nil {
				return nil
			}
			pErr := client.setParallax(ctx, buildParallaxRequestBody(cfg))
			if pErr != nil {
				return fmt.Errorf("wayland-utauri: parallax sync: %w", pErr)
			}
			return nil
		}

		httpErr := classifyHTTPError(statusCode, body)
		lastErr = httpErr
		if !isTransientHTTPStatus(statusCode) || attempt == len(backoffs)-1 {
			return fmt.Errorf("wayland-utauri: load request failed: %w", httpErr)
		}
	}

	if lastErr != nil {
		return fmt.Errorf("wayland-utauri: load request failed after retries: %w", lastErr)
	}
	return fmt.Errorf("wayland-utauri: load request failed without explicit error")
}

func (w *WaylandUtauri) RegisterDefaults(v *viper.Viper) {
	w.v = v
	def := defaultConfig()

	v.SetDefault(viperBackendKey+".socket_path", def.SocketPath)
	v.SetDefault(viperBackendKey+".expected_service", def.ExpectedService)
	v.SetDefault(viperBackendKey+".expected_api_version", def.ExpectedAPIVersion)
	v.SetDefault(viperBackendKey+".connect_timeout_ms", def.ConnectTimeoutMS)
	v.SetDefault(viperBackendKey+".request_timeout_ms", def.RequestTimeoutMS)
	v.SetDefault(viperBackendKey+".show_on_initialize", def.ShowOnInitialize)
	v.SetDefault(viperBackendKey+".hide_on_shutdown", def.HideOnShutdown)
	v.SetDefault(viperBackendKey+".transition", def.Transition)
	v.SetDefault(viperBackendKey+".duration_ms", def.DurationMS)
	v.SetDefault(viperBackendKey+".parallax_enabled", def.ParallaxEnabled)
	v.SetDefault(viperBackendKey+".parallax_zoom", def.ParallaxZoom)
	v.SetDefault(viperBackendKey+".parallax_step_percent", def.ParallaxStepPct)
	v.SetDefault(viperBackendKey+".parallax_animation_ms", def.ParallaxAnimMS)
	v.SetDefault(viperBackendKey+".parallax_easing", def.ParallaxEasing)
	v.SetDefault(viperBackendKey+".video_audio_default", def.VideoAudioDefault)
}

func (w *WaylandUtauri) ValidateConfig(raw json.RawMessage) error {
	return backend.UnmarshalValidateConfig[Config](raw)
}

func (w *WaylandUtauri) ParseConfig(raw json.RawMessage) (any, error) {
	return backend.UnmarshalParseConfig[Config](raw, "wayland-utauri")
}

func (w *WaylandUtauri) loadConfigFromViper() *Config {
	if w.v == nil {
		return defaultConfig()
	}
	cfg := defaultConfig()

	prefixes := []string{viperBackendKey + ".", viperBackendKeyLegacy + "."}
	getString := func(k string) string {
		for _, p := range prefixes {
			if val := w.v.GetString(p + k); val != "" {
				return val
			}
		}
		return ""
	}
	getInt := func(k string) int {
		for _, p := range prefixes {
			val := w.v.GetInt(p + k)
			if val != 0 {
				return val
			}
		}
		return 0
	}
	getBool := func(k string) bool {
		canonKey := viperBackendKey + "." + k
		legacyKey := viperBackendKeyLegacy + "." + k
		if w.v.IsSet(canonKey) {
			return w.v.GetBool(canonKey)
		}
		if w.v.IsSet(legacyKey) {
			return w.v.GetBool(legacyKey)
		}
		// Unset in file: use canonical key so RegisterDefaults / SetDefault applies.
		return w.v.GetBool(canonKey)
	}

	if val := getString("socket_path"); val != "" {
		cfg.SocketPath = val
	}
	if val := getString("expected_service"); val != "" {
		cfg.ExpectedService = val
	}
	if val := getString("expected_api_version"); val != "" {
		cfg.ExpectedAPIVersion = val
	}
	if val := getInt("connect_timeout_ms"); val > 0 {
		cfg.ConnectTimeoutMS = val
	}
	if val := getInt("request_timeout_ms"); val > 0 {
		cfg.RequestTimeoutMS = val
	}
	cfg.ShowOnInitialize = getBool("show_on_initialize")
	cfg.HideOnShutdown = getBool("hide_on_shutdown")
	if val := getString("transition"); val != "" {
		cfg.Transition = val
	}
	if val := getInt("duration_ms"); val > 0 {
		cfg.DurationMS = val
	}
	cfg.ParallaxEnabled = getBool("parallax_enabled")
	if val := getInt("parallax_zoom"); val > 0 {
		cfg.ParallaxZoom = val
	}
	if val := getInt("parallax_step_percent"); val > 0 {
		cfg.ParallaxStepPct = val
	}
	if val := getInt("parallax_animation_ms"); val > 0 {
		cfg.ParallaxAnimMS = val
	}
	if val := getString("parallax_easing"); val != "" {
		cfg.ParallaxEasing = val
	}
	cfg.VideoAudioDefault = getBool("video_audio_default")

	return cfg
}

func (w *WaylandUtauri) makeControlClient(cfg *Config) (*controlClient, error) {
	if w.makeClient != nil {
		return w.makeClient(cfg)
	}
	return newControlClient(cfg)
}
