package awww

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"os"
	"os/exec"
	"strconv"
	"strings"
	"sync"
	"syscall"
	"time"

	"waypaper-engine/daemon/internal/backend"
	"waypaper-engine/daemon/internal/media"
	"waypaper-engine/daemon/internal/monitor"

	"github.com/spf13/viper"
)

const cliBinary = "awww"
const daemonBinary = "awww-daemon"

// Awww implements backend.Backend for the awww wallpaper daemon.
type Awww struct {
	once    sync.Once
	v       *viper.Viper // viper instance for reading config at runtime
	process *os.Process  // tracks the awww-daemon we started (nil if pre-existing)
}

// New returns a new awww backend instance.
func New() backend.Backend {
	return &Awww{}
}

var _ backend.Backend = (*Awww)(nil)

func (a *Awww) Name() string { return "awww" }

func (a *Awww) IsAvailable() bool {
	_, err := exec.LookPath(cliBinary)
	return err == nil
}

func (a *Awww) Capabilities() backend.Capabilities {
	return backend.Capabilities{
		Compositors:   []monitor.CompositorType{monitor.CompositorWayland},
		MediaTypes:    []media.MediaType{media.MediaTypeImage},
		Transitions:   true,
		PerMonitor:    true,
		DaemonProcess: true,
	}
}

func (a *Awww) Initialize(ctx context.Context) error {
	if !a.IsAvailable() {
		return fmt.Errorf("awww: awww not found in PATH")
	}

	// Check if the daemon is already running via `<cli> query`.
	if err := exec.CommandContext(ctx, cliBinary, "query").Run(); err == nil {
		slog.Info("daemon already running", "binary", cliBinary)
		return nil
	}

	slog.Info("starting daemon with --no-cache", "binary", daemonBinary)
	// Use Background context: the daemon must outlive the HTTP request that
	// triggered activation. Pdeathsig ensures cleanup when waypaper-daemon exits.
	cmd := exec.Command(daemonBinary, "--no-cache")
	cmd.SysProcAttr = &syscall.SysProcAttr{Pdeathsig: syscall.SIGTERM}
	if err := cmd.Start(); err != nil {
		return fmt.Errorf("awww: start %s: %w", daemonBinary, err)
	}
	a.process = cmd.Process

	// Collect exit status in the background so the process doesn't become a zombie.
	go func() {
		_ = cmd.Wait()
	}()

	// Wait for the daemon to become ready (accepts queries).
	// awww-daemon needs a moment to start listening on its socket.
	for i := range 20 {
		if err := exec.CommandContext(ctx, cliBinary, "query").Run(); err == nil {
			slog.Info("daemon ready", "binary", daemonBinary, "attempts", i+1)
			return nil
		}
		time.Sleep(100 * time.Millisecond)
	}

	slog.Warn("daemon started but may not be ready yet", "binary", daemonBinary)
	return nil
}

func (a *Awww) Shutdown(ctx context.Context) error {
	if !a.IsAvailable() {
		return nil
	}

	slog.Info("stopping daemon", "binary", cliBinary)
	if err := exec.CommandContext(ctx, cliBinary, "kill").Run(); err != nil {
		// Exit 1 means the daemon wasn't running — that's the desired state.
		slog.Warn("awww kill command failed (daemon may already be stopped)", "error", err)
	}

	// If we started the daemon ourselves, ensure the process is actually dead.
	if a.process != nil {
		done := make(chan struct{})
		go func() {
			_, _ = a.process.Wait()
			close(done)
		}()
		select {
		case <-done:
			slog.Debug("awww-daemon process exited")
		case <-time.After(3 * time.Second):
			slog.Warn("awww-daemon did not exit after kill, sending SIGKILL")
			_ = a.process.Signal(syscall.SIGKILL)
		}
		a.process = nil
	}

	return nil
}

func (a *Awww) SetWallpaper(ctx context.Context, req backend.WallpaperRequest) error {
	if !a.IsAvailable() {
		return fmt.Errorf("awww: awww not found in PATH")
	}

	cfg, _ := req.Config.(*Config)
	if cfg == nil {
		cfg = a.loadConfigFromViper()
	}

	args := []string{"img", req.ImagePath}

	// Transition flags.
	if cfg.TransitionType != "" {
		args = append(args, "--transition-type", string(cfg.TransitionType))
	}
	// For "none", awww sets step=255 internally for an instant switch; passing --transition-step
	// after --transition-type would override that and break the effect.
	if cfg.TransitionType != TransitionNone && cfg.TransitionStep > 0 {
		args = append(args, "--transition-step", strconv.Itoa(cfg.TransitionStep))
	}
	if durStr := formatAwwwTransitionDurationCLI(cfg.TransitionDuration); durStr != "" {
		args = append(args, "--transition-duration", durStr)
	}
	if cfg.TransitionFPS > 0 {
		args = append(args, "--transition-fps", strconv.Itoa(cfg.TransitionFPS))
	}
	if cfg.TransitionAngle > 0 {
		args = append(args, "--transition-angle", strconv.Itoa(cfg.TransitionAngle))
	}
	if cfg.TransitionPos != "" {
		args = append(args, "--transition-pos", string(cfg.TransitionPos))
	}
	if cfg.TransitionBezier != "" {
		args = append(args, "--transition-bezier", cfg.TransitionBezier)
	}
	if cfg.TransitionWave != "" {
		args = append(args, "--transition-wave", cfg.TransitionWave)
	}
	if cfg.Resize != "" {
		args = append(args, "--resize", string(cfg.Resize))
	}
	if cfg.FillColor != "" {
		args = append(args, "--fill-color", strings.TrimPrefix(cfg.FillColor, "#"))
	}
	if cfg.FilterType != "" {
		args = append(args, "--filter", string(cfg.FilterType))
	}
	if cfg.InvertY {
		args = append(args, "--invert-y")
	}

	// Per-monitor targeting: individual mode sets --outputs.
	if req.Mode == monitor.ModeIndividual && len(req.Monitors) == 1 {
		args = append(args, "--outputs", req.Monitors[0].Name)
	}

	slog.Debug("awww command", "binary", cliBinary, "args", args)
	cmd := exec.CommandContext(ctx, cliBinary, args...)
	output, err := cmd.CombinedOutput()
	if err != nil {
		return fmt.Errorf("%s img: %w (output: %s)", cliBinary, err, string(output))
	}
	return nil
}

func (a *Awww) RegisterDefaults(v *viper.Viper) {
	a.v = v
	v.SetDefault("backend.awww.transition_type", string(TransitionWipe))
	v.SetDefault("backend.awww.transition_step", 90)
	v.SetDefault("backend.awww.transition_duration", 3)
	v.SetDefault("backend.awww.transition_fps", 60)
	v.SetDefault("backend.awww.transition_angle", 45)
	v.SetDefault("backend.awww.transition_pos", string(PosCenter))
	v.SetDefault("backend.awww.transition_bezier", "0.25,0.1,0.25,1.0")
	v.SetDefault("backend.awww.transition_wave", "20,20")
	v.SetDefault("backend.awww.resize", string(ResizeCrop))
	v.SetDefault("backend.awww.fill_color", "000000")
	v.SetDefault("backend.awww.filter_type", string(FilterLanczos3))
	v.SetDefault("backend.awww.invert_y", false)
}

// loadConfigFromViper reads the [backend.awww] section from the TOML config via Viper.
// This is used as the fallback when req.Config is nil (i.e., most call sites).
//
// TOML convention uses hyphens (transition-type) while Go/mapstructure uses underscores
// (transition_type). Viper treats them as distinct keys, so we check both variants
// and prefer the explicitly-set value (from the file) over the default.
func (a *Awww) loadConfigFromViper() *Config {
	if a.v == nil {
		return &Config{}
	}

	prefix := "backend.awww."

	// getString checks the hyphenated key first (TOML convention), then underscored (defaults).
	getString := func(underscoreKey string) string {
		hyphenKey := prefix + strings.ReplaceAll(underscoreKey, "_", "-")
		fullKey := prefix + underscoreKey
		if a.v.IsSet(hyphenKey) {
			return a.v.GetString(hyphenKey)
		}
		return a.v.GetString(fullKey)
	}

	getInt := func(underscoreKey string) int {
		hyphenKey := prefix + strings.ReplaceAll(underscoreKey, "_", "-")
		fullKey := prefix + underscoreKey
		if a.v.IsSet(hyphenKey) {
			return a.v.GetInt(hyphenKey)
		}
		return a.v.GetInt(fullKey)
	}

	getFloat := func(underscoreKey string) float64 {
		hyphenKey := prefix + strings.ReplaceAll(underscoreKey, "_", "-")
		fullKey := prefix + underscoreKey
		if a.v.IsSet(hyphenKey) {
			return a.v.GetFloat64(hyphenKey)
		}
		return a.v.GetFloat64(fullKey)
	}

	getBool := func(underscoreKey string) bool {
		hyphenKey := prefix + strings.ReplaceAll(underscoreKey, "_", "-")
		fullKey := prefix + underscoreKey
		if a.v.IsSet(hyphenKey) {
			return a.v.GetBool(hyphenKey)
		}
		return a.v.GetBool(fullKey)
	}

	cfg := &Config{
		TransitionType:     TransitionType(getString("transition_type")),
		TransitionStep:     getInt("transition_step"),
		TransitionDuration: getFloat("transition_duration"),
		TransitionFPS:      getInt("transition_fps"),
		TransitionAngle:    getInt("transition_angle"),
		TransitionPos:      TransitionPosition(getString("transition_pos")),
		TransitionBezier:   getString("transition_bezier"),
		TransitionWave:     getString("transition_wave"),
		Resize:             ResizeType(getString("resize")),
		FillColor:          getString("fill_color"),
		FilterType:         FilterType(getString("filter_type")),
		InvertY:            getBool("invert_y"),
	}

	if a.v != nil {
		if canon := a.v.GetFloat64("backend.transition_duration_seconds"); canon > 0 {
			if canon > 120 {
				canon = 120
			}
			cfg.TransitionDuration = canon
		}
	}

	slog.Debug("awww: loaded config from viper",
		"transition_type", cfg.TransitionType,
		"transition_duration", cfg.TransitionDuration,
		"transition_fps", cfg.TransitionFPS,
		"transition_pos", cfg.TransitionPos,
	)

	return cfg
}

func (a *Awww) ValidateConfig(raw json.RawMessage) error {
	var cfg Config
	if err := json.Unmarshal(raw, &cfg); err != nil {
		return fmt.Errorf("awww: parse config: %w", err)
	}
	if cfg.TransitionDuration < 0 || cfg.TransitionDuration > 120 {
		return fmt.Errorf("awww: transition_duration must be between 0 and 120 seconds")
	}
	return nil
}

func (a *Awww) ParseConfig(raw json.RawMessage) (any, error) {
	return backend.UnmarshalParseConfig[Config](raw, "awww")
}
