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

const viperBackendKey = "backend.wal-qt"

const (
	transitionOriginPctMin = -200
	transitionOriginPctMax = 200
)

var validImageFitModes = map[string]struct{}{
	"fill":       {},
	"contain":    {},
	"cover":      {},
	"none":       {},
	"scale-down": {},
}

var fillColorPattern = regexp.MustCompile(`^[0-9a-fA-F]{6}([0-9a-fA-F]{2})?$`)

var validImageRenderingModes = map[string]struct{}{
	"auto":         {},
	"smooth":       {},
	"high-quality": {},
	"crisp-edges":  {},
	"pixelated":    {},
}

func intFromViperPrefixes(v backend.ConfigReader, wantKey string, fallback int) int {
	if v == nil {
		return fallback
	}
	full := viperBackendKey + "." + wantKey
	if v.IsSet(full) {
		return v.GetInt(full)
	}
	return fallback
}

func float32FromViperPrefixes(v backend.ConfigReader, wantKey string, fallback float32) float32 {
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
	v                         backend.ConfigReader
	makeClient                func(cfg *Config) (*controlClient, error)
	processMu                 sync.Mutex
	process                   *os.Process
	spawnGeneration           int64
	initMu                    sync.Mutex
	parallaxDriverMu          sync.Mutex
	parallaxDriverCancel      context.CancelFunc
	parallaxDriverWG          sync.WaitGroup
	parallaxSyncMu            sync.Mutex
	parallaxDriverSig         parallaxDriverSignature
	parallaxDriverSynced      bool
	parallaxManifestDirMu     sync.Mutex
	parallaxManifestDirection string
	workspaceParallaxVertical atomic.Bool
	extendParallaxMu          sync.Mutex
	extendParallaxGroup       []string
	allowManagedChildRespawn  atomic.Bool
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

	healthCtx, healthCancel := context.WithTimeout(ctx, time.Duration(cfg.ConnectTimeoutMS)*time.Millisecond)
	initialErr := client.checkHealth(healthCtx)
	healthCancel()

	if initialErr == nil {
		slog.Info("wal-qt already running")
		w.pollOutputsUntilReady(ctx, client, cfg)
		w.syncParallaxDriver(w.loadConfigFromViper(), true)
		return nil
	}

	if errors.Is(initialErr, errContract) {
		return fmt.Errorf("wal-qt: %w", initialErr)
	}

	slog.Info("starting wal-qt",
		"binary", binaryName,
		"WAYLAND_DISPLAY", os.Getenv("WAYLAND_DISPLAY"),
		"XDG_RUNTIME_DIR", os.Getenv("XDG_RUNTIME_DIR"),
		"DISPLAY", os.Getenv("DISPLAY"),
	)
	cmd := exec.Command(binaryName)
	cmd.Env = mergeProcessEnv(os.Environ(), cfg.Env)
	cmd.SysProcAttr = &syscall.SysProcAttr{Pdeathsig: syscall.SIGTERM}
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
	w.pollOutputsUntilReady(ctx, client, cfg)
	slog.Info("wal-qt ready after spawn")
	w.allowManagedChildRespawn.Store(true)
	w.syncParallaxDriver(w.loadConfigFromViper(), true)
	return nil
}

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

const outputsReadyTimeout = 10 * time.Second

func (w *WalQt) pollOutputsUntilReady(ctx context.Context, client *controlClient, cfg *Config) {
	deadline := time.Now().Add(outputsReadyTimeout)
	delay := 100 * time.Millisecond
	const maxDelay = time.Second
	attempts := 0

	for time.Now().Before(deadline) {
		attempts++
		statusCtx, cancel := context.WithTimeout(ctx, time.Duration(cfg.RequestTimeoutMS)*time.Millisecond)
		st, err := client.status(statusCtx)
		cancel()
		if err == nil && st.Status.MonitorCount > 0 {
			slog.Info("wal-qt outputs ready", "monitors", st.Status.MonitorCount, "poll_attempts", attempts)
			return
		}
		select {
		case <-ctx.Done():
			return
		case <-time.After(delay):
		}
		delay = min(delay*2, maxDelay)
	}

	slog.Warn("wal-qt reported no outputs before timeout; applying anyway",
		"timeout", outputsReadyTimeout,
		"poll_attempts", attempts,
	)
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

type parallaxDriverSignature struct {
	enabled   bool
	mode      string
	chunkSize int
}

func parallaxDriverSignatureFromConfig(cfg *Config) parallaxDriverSignature {
	if cfg == nil {
		cfg = defaultConfig()
	}
	return parallaxDriverSignature{
		enabled:   cfg.ParallaxEnabled,
		mode:      string(parallaxdriver.ParseDriverMode(cfg.ParallaxCompositorDriver)),
		chunkSize: cfg.ParallaxWorkspaceChunkSize,
	}
}

func (w *WalQt) syncParallaxDriver(cfg *Config, force bool) {
	if cfg == nil {
		cfg = defaultConfig()
	}
	w.recomputeWorkspaceParallaxVertical(cfg)

	w.parallaxSyncMu.Lock()
	defer w.parallaxSyncMu.Unlock()

	sig := parallaxDriverSignatureFromConfig(cfg)

	w.parallaxDriverMu.Lock()
	sigUnchanged := w.parallaxDriverSynced && w.parallaxDriverSig == sig
	driverRunning := w.parallaxDriverCancel != nil
	w.parallaxDriverMu.Unlock()

	if sigUnchanged && !force {
		return
	}
	restartDriver := !sigUnchanged || !driverRunning

	if restartDriver {
		w.parallaxDriverMu.Lock()
		cancel := w.parallaxDriverCancel
		w.parallaxDriverCancel = nil
		w.parallaxDriverMu.Unlock()
		if cancel != nil {
			cancel()
		}
		w.parallaxDriverWG.Wait()
	}

	w.parallaxDriverMu.Lock()
	w.parallaxDriverSig = sig
	w.parallaxDriverSynced = true
	w.parallaxDriverMu.Unlock()

	if !cfg.ParallaxEnabled {
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

	if !restartDriver {
		return
	}

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
	v.SetDefault(viperBackendKey+".env", []string{})
}

func (w *WalQt) SetConfigReader(r backend.ConfigReader) {
	w.v = r
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
	if err := validateEnvEntries(cfg.Env); err != nil {
		return fmt.Errorf("wal-qt: %w", err)
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
	cfg.Env = w.v.GetStringSlice(viperBackendKey + ".env")

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

type slogWriter struct{ prefix string }

func (w *slogWriter) Write(p []byte) (int, error) {
	msg := strings.TrimRight(string(p), "\n\r")
	if msg != "" {
		slog.Info(msg, "source", w.prefix)
	}
	return len(p), nil
}

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
	if strings.EqualFold(loadReq.Kind, "web") {
		netClient, cerr := w.makeControlClient(cfg)
		if cerr != nil {
			return cerr
		}
		if err := netClient.setAllowNetworkWallpapers(ctx, cfg.AllowNetworkWallpapers); err != nil {
			return fmt.Errorf("wal-qt: push network settings: %w", err)
		}
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
			result, decodeErr := decodeLoadResult(body)
			if decodeErr != nil {
				return decodeErr
			}
			if failErr := loadResultError(result); failErr != nil {
				return failErr
			}

			if web, ok := snap.Outputs[0].Content.(backend.WebWallpaper); ok {
				w.noteWallpaperParallaxDirection(cfg, web.ParallaxDirection)
			} else {
				w.noteWallpaperParallaxDirection(cfg, "")
			}
			w.syncParallaxDriver(cfg, false)
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

func loadResultError(result loadResult) error {
	var bad []string
	for _, t := range result.Targets {
		switch t.Outcome {
		case "applied", "superseded":
			continue
		case "failed":
			bad = append(bad, fmt.Sprintf("%s: %s", t.Name, t.Error))
		case "timeout":
			bad = append(bad, fmt.Sprintf("%s: timed out waiting for renderer ack", t.Name))
		default:
			bad = append(bad, fmt.Sprintf("%s: unrecognized outcome %q", t.Name, t.Outcome))
		}
	}
	if len(bad) == 0 {
		return nil
	}
	return fmt.Errorf("wal-qt: load did not land on all monitors: %s", strings.Join(bad, "; "))
}
