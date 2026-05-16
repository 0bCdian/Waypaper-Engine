package walqt

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log/slog"
	"math"
	"os"
	"os/exec"
	"regexp"
	"strings"
	"sync"
	"sync/atomic"
	"syscall"
	"time"

	"waypaper-engine/daemon/internal/backend"
	"waypaper-engine/daemon/internal/monitor"
	"waypaper-engine/daemon/internal/parallaxdriver"

	"github.com/spf13/viper"
)

const binaryName = "wal-qt-host"

// viperBackendKey matches backend.Name() — must align with SetBackendConfig("backend."+name).
const viperBackendKey = "backend.wal-qt"

// Grow/outer origin as % of view (v_uv); values outside 0–100 place the anchor off-screen.
const transitionOriginPctMin = -200
const transitionOriginPctMax = 200

var validImageFitModes = map[string]struct{}{
	"fill":       {},
	"contain":    {},
	"cover":      {},
	"none":       {},
	"scale-down": {},
}

// fillColorPattern accepts RRGGBB or RRGGBBAA hex (no leading '#').
var fillColorPattern = regexp.MustCompile(`^[0-9a-fA-F]{6}([0-9a-fA-F]{2})?$`)

var validImageRenderingModes = map[string]struct{}{
	"auto":         {},
	"smooth":       {},
	"high-quality": {},
	"crisp-edges":  {},
	"pixelated":    {},
}

func intFromViperPrefixes(v *viper.Viper, wantKey string, fallback int) int {
	if v == nil {
		return fallback
	}
	full := viperBackendKey + "." + wantKey
	if v.IsSet(full) {
		return v.GetInt(full)
	}
	return fallback
}

func float32FromViperPrefixes(v *viper.Viper, wantKey string, fallback float32) float32 {
	if v == nil {
		return fallback
	}
	full := viperBackendKey + "." + wantKey
	if v.IsSet(full) {
		return float32(v.GetFloat64(full))
	}
	return fallback
}

func clampInt(v, lo, hi int) int {
	if v < lo {
		return lo
	}
	if v > hi {
		return hi
	}
	return v
}

func normalizeAngleDeg(v int) int {
	v %= 360
	if v < 0 {
		v += 360
	}
	return v
}

type WalQt struct {
	v          *viper.Viper
	makeClient func(cfg *Config) (*controlClient, error)
	processMu  sync.Mutex
	process    *os.Process
	// spawnGeneration increments on each child spawn; the wait goroutine only clears
	// process when it still matches, so a replaced child is not wiped by an old Wait.
	spawnGeneration int64
	// initMu serializes Initialize / initializeImpl so concurrent respawn and ensureRunning
	// cannot double-spawn; long poll runs under this lock (callers queue briefly).
	initMu sync.Mutex

	parallaxDriverMu     sync.Mutex
	parallaxDriverCancel context.CancelFunc
	parallaxDriverWG     sync.WaitGroup

	parallaxManifestDirMu     sync.Mutex
	parallaxManifestDirection string // "horizontal" | "vertical" | ""
	workspaceParallaxVertical atomic.Bool

	// extendParallaxGroup is sorted compositor output names that share one spanned
	// (sliced) static image; used to broadcast workspace parallax to every output.
	extendParallaxMu    sync.Mutex
	extendParallaxGroup []string

	// allowManagedChildRespawn is true only after we spawned a child and expect
	// respawnAfterChildExit to restart it on crash. Cleared in Shutdown so an
	// intentional backend switch does not resurrect wal-qt in the background.
	allowManagedChildRespawn atomic.Bool
}

var _ backend.Backend = (*WalQt)(nil)

func New() backend.Backend {
	return &WalQt{makeClient: newControlClient}
}

func (w *WalQt) Name() string { return backend.WalQtBackendName }

func (w *WalQt) IsAvailable() bool {
	_, err := exec.LookPath(binaryName)
	return err == nil
}

func (w *WalQt) Capabilities() backend.Capabilities {
	return backend.Capabilities{
		ContentKinds: []backend.ContentKind{backend.KindStaticImage, backend.KindGIF, backend.KindVideo, backend.KindWebWallpaper},
		Compositors:  []monitor.CompositorType{monitor.CompositorWayland},
	}
}

func (w *WalQt) Initialize(ctx context.Context) error {
	if err := ctx.Err(); err != nil {
		return err
	}
	w.initMu.Lock()
	defer w.initMu.Unlock()
	// Long poll must not inherit a short-lived caller context (e.g. HTTP).
	return w.initializeImpl(context.Background())
}

func (w *WalQt) initializeImpl(ctx context.Context) error {
	if !w.IsAvailable() {
		return fmt.Errorf("wal-qt: %s not found in PATH", binaryName)
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
		slog.Info("wal-qt already running")
		w.syncParallaxDriver(w.loadConfigFromViper())
		return nil
	}

	// If the service is reachable but has a contract mismatch (wrong
	// service name, API version), don't try to start another instance.
	if errors.Is(initialErr, errContract) {
		return fmt.Errorf("wal-qt: %w", initialErr)
	}

	// Service unreachable -- start it. Use a background-context command so the
	// process outlives the HTTP request that triggered activation.
	slog.Info("starting wal-qt",
		"binary", binaryName,
		"WAYLAND_DISPLAY", os.Getenv("WAYLAND_DISPLAY"),
		"XDG_RUNTIME_DIR", os.Getenv("XDG_RUNTIME_DIR"),
		"DISPLAY", os.Getenv("DISPLAY"),
	)
	cmd := exec.Command(binaryName)
	cmd.SysProcAttr = &syscall.SysProcAttr{Pdeathsig: syscall.SIGTERM}
	// Pipe stdout/stderr through the daemon logger so spawn failures are visible.
	cmd.Stdout = &slogWriter{prefix: "wal-qt stdout"}
	cmd.Stderr = &slogWriter{prefix: "wal-qt stderr"}
	if err := cmd.Start(); err != nil {
		return fmt.Errorf("wal-qt: start %s: %w", binaryName, err)
	}

	gen := atomic.AddInt64(&w.spawnGeneration, 1)
	w.processMu.Lock()
	w.process = cmd.Process
	w.processMu.Unlock()

	go func(g int64, c *exec.Cmd) {
		waitErr := c.Wait()
		pid := int(0)
		if c.Process != nil {
			pid = c.Process.Pid
		}
		w.processMu.Lock()
		defer w.processMu.Unlock()
		if atomic.LoadInt64(&w.spawnGeneration) != g {
			return
		}
		if w.process != nil && c.Process != nil && w.process.Pid == c.Process.Pid {
			w.process = nil
		}
		slog.Warn("wal-qt child process exited", "pid", pid, "wait_err", waitErr)
		go w.respawnAfterChildExit(g)
	}(gen, cmd)

	if err := w.pollHealthUntilReady(ctx, client, cfg); err != nil {
		return err
	}
	slog.Info("wal-qt ready after spawn")
	w.allowManagedChildRespawn.Store(true)
	w.syncParallaxDriver(w.loadConfigFromViper())
	return nil
}

// respawnAfterChildExit runs after our managed child exits; it restarts wal-qt
// so the daemon does not sit idle until the next explicit wallpaper operation.
func (w *WalQt) respawnAfterChildExit(exitGen int64) {
	if !w.allowManagedChildRespawn.Load() {
		return
	}
	const debounce = 400 * time.Millisecond
	time.Sleep(debounce)
	if atomic.LoadInt64(&w.spawnGeneration) != exitGen {
		return
	}
	w.processMu.Lock()
	need := w.process == nil
	w.processMu.Unlock()
	if !need {
		return
	}
	if err := w.Initialize(context.Background()); err != nil {
		slog.Error("wal-qt: respawn after child exit failed", "error", err)
		return
	}
	slog.Info("wal-qt: respawn after child exit succeeded")
}

// pollHealthUntilReady polls checkHealth with exponential backoff until success or overall deadline (~50s).
func (w *WalQt) pollHealthUntilReady(ctx context.Context, client *controlClient, cfg *Config) error {
	deadline := time.Now().Add(50 * time.Second)
	delay := 150 * time.Millisecond
	const maxDelay = 2 * time.Second
	var lastErr error
	attempts := 0
	for time.Now().Before(deadline) {
		select {
		case <-ctx.Done():
			return ctx.Err()
		default:
		}
		attempts++
		pollCtx, pollCancel := context.WithTimeout(ctx, time.Duration(cfg.ConnectTimeoutMS)*time.Millisecond)
		err := client.checkHealth(pollCtx)
		pollCancel()
		lastErr = err
		if err == nil {
			slog.Info("wal-qt health ok", "poll_attempts", attempts)
			return nil
		}
		if errors.Is(err, errContract) {
			return fmt.Errorf("wal-qt: %w", err)
		}
		select {
		case <-ctx.Done():
			return ctx.Err()
		case <-time.After(delay):
		}
		next := delay * 2
		if next > maxDelay {
			next = maxDelay
		}
		delay = next
	}
	return fmt.Errorf(
		"wal-qt: unavailable after %d health poll attempts (~50s, last error: %w). "+
			"Ensure the binary runs on Wayland and "+viperBackendKey+".socket_path matches the child",
		attempts, lastErr,
	)
}

const statusDialRetries = 12
const statusDialBackoff = 250 * time.Millisecond

// getStatusWithRetry tolerates a cold control socket right after spawn or during restore.
func (w *WalQt) getStatusWithRetry(ctx context.Context, client *controlClient) (*statusResponse, error) {
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
		if !isRetryableControlStatusErr(err) {
			return nil, err
		}
	}
	return nil, lastErr
}

func (w *WalQt) Shutdown(_ context.Context) error {
	w.allowManagedChildRespawn.Store(false)

	w.parallaxDriverMu.Lock()
	if w.parallaxDriverCancel != nil {
		w.parallaxDriverCancel()
		w.parallaxDriverCancel = nil
	}
	w.parallaxDriverMu.Unlock()
	w.parallaxDriverWG.Wait()
	w.extendParallaxMu.Lock()
	w.extendParallaxGroup = nil
	w.extendParallaxMu.Unlock()

	w.processMu.Lock()
	p := w.process
	w.processMu.Unlock()
	if p == nil {
		return nil
	}
	slog.Info("stopping wal-qt process we started")
	_ = p.Signal(syscall.SIGTERM)
	// Spawn goroutine in Initialize owns cmd.Wait; poll until it clears w.process.
	deadline := time.After(4 * time.Second)
	tick := time.NewTicker(80 * time.Millisecond)
	defer tick.Stop()
	for {
		select {
		case <-deadline:
			slog.Warn("wal-qt did not exit after SIGTERM, sending SIGKILL")
			_ = p.Signal(syscall.SIGKILL)
			return nil
		case <-tick.C:
			w.processMu.Lock()
			empty := w.process == nil
			w.processMu.Unlock()
			if empty {
				slog.Debug("wal-qt process exited")
				return nil
			}
		}
	}
}

// ensureRunning verifies the control plane answers health; if not (and not a contract error), runs Initialize.
func (w *WalQt) ensureRunning(ctx context.Context, cfg *Config) error {
	client, err := w.makeControlClient(cfg)
	if err != nil {
		return err
	}
	hctx, cancel := context.WithTimeout(ctx, time.Duration(cfg.ConnectTimeoutMS)*time.Millisecond)
	err = client.checkHealth(hctx)
	cancel()
	if err == nil {
		return nil
	}
	if errors.Is(err, errContract) {
		return fmt.Errorf("wal-qt: %w", err)
	}
	slog.Info("wal-qt: control plane unreachable, attempting initialize/restart", "error", err)
	if initErr := w.Initialize(ctx); initErr != nil {
		return fmt.Errorf("wal-qt: unavailable — could not reach or start backend: %w", initErr)
	}
	return nil
}

func (w *WalQt) expandParallaxMoveTargets(outputName string) []string {
	w.extendParallaxMu.Lock()
	g := w.extendParallaxGroup
	w.extendParallaxMu.Unlock()
	if len(g) < 2 {
		return nil
	}
	for _, n := range g {
		if n == outputName {
			out := make([]string, len(g))
			copy(out, g)
			return out
		}
	}
	return nil
}

func (w *WalQt) recomputeWorkspaceParallaxVertical(cfg *Config) {
	if cfg == nil {
		cfg = defaultConfig()
	}
	w.parallaxManifestDirMu.Lock()
	o := w.parallaxManifestDirection
	w.parallaxManifestDirMu.Unlock()
	v := parallaxdriver.EffectiveWorkspaceParallaxVertical(cfg.ParallaxDirection, o)
	w.workspaceParallaxVertical.Store(v)
}

func (w *WalQt) noteWallpaperParallaxDirection(cfg *Config, parallaxDirection string) {
	raw := strings.ToLower(strings.TrimSpace(parallaxDirection))
	switch raw {
	case "vertical", "horizontal":
		w.parallaxManifestDirMu.Lock()
		w.parallaxManifestDirection = raw
		w.parallaxManifestDirMu.Unlock()
	default:
		w.parallaxManifestDirMu.Lock()
		w.parallaxManifestDirection = ""
		w.parallaxManifestDirMu.Unlock()
	}
	w.recomputeWorkspaceParallaxVertical(cfg)
}

// syncParallaxDriver starts or stops the Hyprland/Sway workspace → parallax-move loop.
func (w *WalQt) syncParallaxDriver(cfg *Config) {
	w.recomputeWorkspaceParallaxVertical(cfg)
	w.parallaxDriverMu.Lock()
	if w.parallaxDriverCancel != nil {
		w.parallaxDriverCancel()
		w.parallaxDriverCancel = nil
	}
	w.parallaxDriverMu.Unlock()
	w.parallaxDriverWG.Wait()

	if cfg == nil || !cfg.ParallaxEnabled {
		return
	}
	mode := parallaxdriver.ParseDriverMode(cfg.ParallaxCompositorDriver)
	kind := parallaxdriver.EffectiveKind(mode)
	if kind == parallaxdriver.None {
		slog.Debug("parallax compositor driver inactive", "mode", string(mode))
		return
	}

	client, err := w.makeControlClient(cfg)
	if err != nil {
		slog.Debug("parallax compositor driver: no control client", "error", err)
		return
	}

	resetCtx, resetCancel := context.WithTimeout(context.Background(), 2*time.Second)
	_ = client.setParallax(resetCtx, map[string]any{"enabled": false})
	_ = client.setParallax(resetCtx, buildParallaxRequestBody(cfg))
	resetCancel()

	ctx, cancel := context.WithCancel(context.Background())
	w.parallaxDriverMu.Lock()
	w.parallaxDriverCancel = cancel
	w.parallaxDriverMu.Unlock()

	wRef := w
	opts := parallaxdriver.RunOpts{
		Move: func(c context.Context, outputName, direction string) error {
			return client.parallaxMove(c, outputName, direction)
		},
		ResolveMonitor: nil,
		ChunkSize:      cfg.ParallaxWorkspaceChunkSize,
		Vertical:       func() bool { return wRef.workspaceParallaxVertical.Load() },
		ExpandMoveTargets: func(name string) []string {
			if g := wRef.expandParallaxMoveTargets(name); g != nil {
				return g
			}
			return []string{name}
		},
	}

	w.parallaxDriverWG.Add(1)
	go func() {
		defer w.parallaxDriverWG.Done()
		_ = parallaxdriver.Run(ctx, kind, opts, slog.Default())
	}()
}

func (w *WalQt) RegisterDefaults(v *viper.Viper) {
	w.v = v
	def := defaultConfig()

	v.SetDefault(viperBackendKey+".socket_path", def.SocketPath)
	v.SetDefault(viperBackendKey+".expected_service", def.ExpectedService)
	v.SetDefault(viperBackendKey+".expected_api_version", def.ExpectedAPIVersion)
	v.SetDefault(viperBackendKey+".connect_timeout_ms", def.ConnectTimeoutMS)
	v.SetDefault(viperBackendKey+".request_timeout_ms", def.RequestTimeoutMS)
	v.SetDefault(viperBackendKey+".load_timeout_ms", def.LoadTimeoutMS)
	v.SetDefault(viperBackendKey+".transition", def.Transition)
	v.SetDefault(viperBackendKey+".duration_ms", def.DurationMS)
	v.SetDefault(viperBackendKey+".transition_bezier", def.TransitionBezier)
	v.SetDefault(viperBackendKey+".transition_angle_deg", def.TransitionAngleDeg)
	v.SetDefault(viperBackendKey+".transition_origin_x_percent", def.TransitionOriginXPct)
	v.SetDefault(viperBackendKey+".transition_origin_y_percent", def.TransitionOriginYPct)
	v.SetDefault(viperBackendKey+".transition_wave_amplitude_percent", def.TransitionWaveAmplitudePercent)
	v.SetDefault(viperBackendKey+".transition_wave_frequency", def.TransitionWaveFrequency)
	v.SetDefault(viperBackendKey+".parallax_enabled", def.ParallaxEnabled)
	v.SetDefault(viperBackendKey+".parallax_zoom", def.ParallaxZoom)
	v.SetDefault(viperBackendKey+".parallax_step_percent", def.ParallaxStepPct)
	v.SetDefault(viperBackendKey+".parallax_workspace_chunk_size", def.ParallaxWorkspaceChunkSize)
	v.SetDefault(viperBackendKey+".parallax_animation_ms", def.ParallaxAnimMS)
	v.SetDefault(viperBackendKey+".parallax_reset_ms", def.ParallaxResetMS)
	v.SetDefault(viperBackendKey+".parallax_easing", def.ParallaxEasing)
	v.SetDefault(viperBackendKey+".parallax_compositor_driver", def.ParallaxCompositorDriver)
	v.SetDefault(viperBackendKey+".parallax_direction", def.ParallaxDirection)
	v.SetDefault(viperBackendKey+".image_fit_mode", def.ImageFitMode)
	v.SetDefault(viperBackendKey+".image_rendering", def.ImageRendering)
	v.SetDefault(viperBackendKey+".fill_color", def.FillColor)
	v.SetDefault(viperBackendKey+".video_audio_default", def.VideoAudioDefault)
	v.SetDefault(viperBackendKey+".allow_network_wallpapers", def.AllowNetworkWallpapers)
}

func (w *WalQt) ValidateConfig(raw json.RawMessage) error {

	var cfg Config
	if err := json.Unmarshal(raw, &cfg); err != nil {
		return fmt.Errorf("wal-qt: parse config: %w", err)
	}
	if s := strings.TrimSpace(cfg.TransitionBezier); s != "" {
		if _, err := parseTransitionBezierStrict(s); err != nil {
			return fmt.Errorf("wal-qt: invalid transition_bezier: %w", err)
		}
	}
	if s := strings.ToLower(strings.TrimSpace(cfg.ParallaxDirection)); s != "" {
		if s != "horizontal" && s != "vertical" {
			return fmt.Errorf("wal-qt: parallax_direction must be horizontal or vertical")
		}
	}
	if s := strings.ToLower(strings.TrimSpace(cfg.ImageFitMode)); s != "" {
		if _, ok := validImageFitModes[s]; !ok {
			return fmt.Errorf("wal-qt: image_fit_mode must be one of fill, contain, cover, none, scale-down")
		}
	}
	if s := strings.ToLower(strings.TrimSpace(cfg.ImageRendering)); s != "" {
		if _, ok := validImageRenderingModes[s]; !ok {
			return fmt.Errorf("wal-qt: image_rendering must be one of auto, smooth, high-quality, crisp-edges, pixelated")
		}
	}
	if s := strings.TrimPrefix(strings.TrimSpace(cfg.FillColor), "#"); s != "" {
		if !fillColorPattern.MatchString(s) {
			return fmt.Errorf("wal-qt: fill_color must be 6- or 8-digit hex (RRGGBB or RRGGBBAA), got %q", cfg.FillColor)
		}
	}
	return nil
}

func (w *WalQt) loadConfigFromViper() *Config {
	if w.v == nil {
		return defaultConfig()
	}
	cfg := defaultConfig()

	getString := func(k string) string {
		if val := w.v.GetString(viperBackendKey + "." + k); val != "" {
			return val
		}
		return ""
	}
	getInt := func(k string) int {
		return w.v.GetInt(viperBackendKey + "." + k)
	}
	getBool := func(k string) bool {
		key := viperBackendKey + "." + k
		if w.v.IsSet(key) {
			return w.v.GetBool(key)
		}
		// Unset in file: use key so RegisterDefaults / SetDefault applies.
		return w.v.GetBool(key)
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
	if val := getInt("load_timeout_ms"); val > 0 {
		cfg.LoadTimeoutMS = val
	}
	if val := getString("transition"); val != "" {
		cfg.Transition = val
	}
	if w.v != nil {
		if canon := w.v.GetFloat64("backend.transition_duration_seconds"); canon > 0 {
			ms := int(math.Round(canon * 1000))
			if ms < 1 {
				ms = 1
			}
			const maxDurMS = 120_000
			if ms > maxDurMS {
				ms = maxDurMS
			}
			cfg.DurationMS = ms
		} else if val := getInt("duration_ms"); val > 0 {
			cfg.DurationMS = val
		}
	} else if val := getInt("duration_ms"); val > 0 {
		cfg.DurationMS = val
	}
	if val := getString("transition_bezier"); val != "" {
		cfg.TransitionBezier = val
	}
	cfg.ParallaxEnabled = getBool("parallax_enabled")
	if val := getInt("parallax_zoom"); val > 0 {
		cfg.ParallaxZoom = val
	}
	if val := getInt("parallax_step_percent"); val > 0 {
		cfg.ParallaxStepPct = val
	}
	if val := getInt("parallax_workspace_chunk_size"); val > 0 {
		cfg.ParallaxWorkspaceChunkSize = val
	}
	if val := getInt("parallax_animation_ms"); val > 0 {
		cfg.ParallaxAnimMS = val
	}
	if val := getInt("parallax_reset_ms"); val > 0 {
		cfg.ParallaxResetMS = val
	}
	if val := getString("parallax_easing"); val != "" {
		cfg.ParallaxEasing = val
	}
	if val := getString("parallax_compositor_driver"); val != "" {
		cfg.ParallaxCompositorDriver = val
	}
	if val := getString("parallax_direction"); val != "" {
		cfg.ParallaxDirection = val
	}
	if val := getString("image_fit_mode"); val != "" {
		cfg.ImageFitMode = val
	}
	if val := getString("image_rendering"); val != "" {
		cfg.ImageRendering = val
	}
	if val := getString("fill_color"); val != "" {
		cfg.FillColor = strings.TrimPrefix(strings.TrimSpace(val), "#")
	}
	cfg.VideoAudioDefault = getBool("video_audio_default")
	cfg.AllowNetworkWallpapers = getBool("allow_network_wallpapers")

	if w.v != nil {
		cfg.TransitionAngleDeg = normalizeAngleDeg(intFromViperPrefixes(w.v, "transition_angle_deg", cfg.TransitionAngleDeg))
		cfg.TransitionOriginXPct = clampInt(intFromViperPrefixes(w.v, "transition_origin_x_percent", cfg.TransitionOriginXPct), transitionOriginPctMin, transitionOriginPctMax)
		cfg.TransitionOriginYPct = clampInt(intFromViperPrefixes(w.v, "transition_origin_y_percent", cfg.TransitionOriginYPct), transitionOriginPctMin, transitionOriginPctMax)
		cfg.TransitionWaveAmplitudePercent = float32FromViperPrefixes(w.v, "transition_wave_amplitude_percent", cfg.TransitionWaveAmplitudePercent)
		if cfg.TransitionWaveAmplitudePercent < 0 {
			cfg.TransitionWaveAmplitudePercent = 0
		}
		cfg.TransitionWaveFrequency = float32FromViperPrefixes(w.v, "transition_wave_frequency", cfg.TransitionWaveFrequency)
		if cfg.TransitionWaveFrequency < 0 {
			cfg.TransitionWaveFrequency = 0
		}
	}

	return cfg
}

func (w *WalQt) makeControlClient(cfg *Config) (*controlClient, error) {
	if w.makeClient != nil {
		return w.makeClient(cfg)
	}
	return newControlClient(cfg)
}

// SyncRuntimeFromConfig pushes parallax settings to wal-qt so UI toggles
// apply without waiting for the next wallpaper load. Failures are non-fatal
// (child may be down); callers should log returned errors and still treat
// config save as successful.
//
// Ordering note: POST /settings/network updates global HTML outbound allow; the host combines it
// with manifest `capabilities.network` for effective permission and may reload webviews when
// that effective bit changes.
// PushWallpaperConfig pushes merged user config to wal-qt for monitors showing this entry path.
func (w *WalQt) PushWallpaperConfig(ctx context.Context, sourceTarget string, values json.RawMessage) error {
	cfg := w.loadConfigFromViper()
	client, err := w.makeControlClient(cfg)
	if err != nil {
		return fmt.Errorf("wal-qt: push wallpaper config: %w", err)
	}
	if err := client.pushWallpaperConfig(ctx, sourceTarget, values); err != nil {
		return fmt.Errorf("wal-qt: push wallpaper config: %w", err)
	}
	return nil
}

// PushWebCapabilities updates the running wal-qt session for monitors showing this entry.
func (w *WalQt) PushWebCapabilities(ctx context.Context, sourceTarget string, caps json.RawMessage) error {
	cfg := w.loadConfigFromViper()
	client, err := w.makeControlClient(cfg)
	if err != nil {
		return fmt.Errorf("wal-qt: push web capabilities: %w", err)
	}
	if err := client.pushWebCapabilities(ctx, sourceTarget, caps); err != nil {
		return fmt.Errorf("wal-qt: push web capabilities: %w", err)
	}
	return nil
}

// slogWriter is an io.Writer that logs each line via slog at Info level.
type slogWriter struct{ prefix string }

func (w *slogWriter) Write(p []byte) (int, error) {
	msg := strings.TrimRight(string(p), "\n\r")
	if msg != "" {
		slog.Info(msg, "source", w.prefix)
	}
	return len(p), nil
}

// Apply implements backend.Backend by POSTing a single multi-target /wallpaper/load
// request built directly from the Snapshot.
//
// Wire constraint: each target row has exactly {name, kind, target} — no extra fields.
// Root-level parallax_direction and wallpaper_config_values are taken from the first
// WebWallpaper output. If multiple outputs carry different ParallaxDirection or Config
// values, wal-qt's current API cannot express that per-target; only the first output's
// values are used (known limitation of the wal-qt wire format).
func (w *WalQt) Apply(ctx context.Context, snap backend.Snapshot) error {
	if len(snap.Outputs) == 0 {
		return nil
	}

	cfg := w.loadConfigFromViper()

	if err := w.ensureRunning(ctx, cfg); err != nil {
		return err
	}

	loadReq, err := buildSnapshotLoadRequest(snap, cfg)
	if err != nil {
		return err
	}

	const loadAttempts = 7
	delay := 200 * time.Millisecond
	const maxDelay = 5 * time.Second
	var lastErr error
	for attempt := range loadAttempts {
		if attempt > 0 {
			select {
			case <-time.After(delay):
			case <-ctx.Done():
				return ctx.Err()
			}
			delay = min(delay*2, maxDelay)
		}

		client, cerr := w.makeControlClient(cfg)
		if cerr != nil {
			return cerr
		}
		statusCode, body, callErr := client.load(ctx, loadReq)
		if callErr != nil {
			lastErr = callErr
			if !isRetryableError(callErr) || attempt == loadAttempts-1 {
				return fmt.Errorf("wal-qt: load request failed after %d attempt(s): %w", attempt+1, callErr)
			}
			continue
		}

		if statusCode >= 200 && statusCode < 300 {
			// Track parallax direction from the first web output for workspace parallax.
			if web, ok := snap.Outputs[0].Content.(backend.WebWallpaper); ok {
				w.noteWallpaperParallaxDirection(cfg, web.ParallaxDirection)
			} else {
				w.noteWallpaperParallaxDirection(cfg, "")
			}
			if loadReq.Parallax != nil {
				return nil
			}
			if strings.EqualFold(loadReq.Kind, "web") {
				return nil
			}
			pErr := client.setParallax(ctx, buildParallaxRequestBody(cfg))
			if pErr != nil {
				return fmt.Errorf("wal-qt: parallax sync: %w", pErr)
			}
			return nil
		}

		httpErr := classifyHTTPError(statusCode, body)
		lastErr = httpErr
		if !isTransientHTTPStatus(statusCode) || attempt == loadAttempts-1 {
			return fmt.Errorf("wal-qt: load request failed after %d attempt(s): %w", attempt+1, httpErr)
		}
	}

	if lastErr != nil {
		return fmt.Errorf("wal-qt: load request failed after %d attempt(s): %w", loadAttempts, lastErr)
	}
	return fmt.Errorf("wal-qt: load request failed without explicit error")
}
