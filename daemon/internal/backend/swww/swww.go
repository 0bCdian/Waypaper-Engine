package swww

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

// binaryCandidates lists the CLI binary names to search for, in priority order.
// swww is the original; awww is a community fork with the same CLI interface.
var binaryCandidates = []string{"swww", "awww"}

// daemonCandidates lists the daemon binary names, matching the CLI order.
var daemonCandidates = []string{"swww-daemon", "awww-daemon"}

// Swww implements backend.Backend for the swww (or awww) wallpaper daemon.
type Swww struct {
	once      sync.Once
	cliBinary string       // resolved CLI binary ("swww" or "awww")
	daemonBin string       // resolved daemon binary ("swww-daemon" or "awww-daemon")
	v         *viper.Viper // viper instance for reading config at runtime
	process   *os.Process  // tracks the swww-daemon we started (nil if pre-existing)
}

// New returns a new swww/awww backend instance.
func New() backend.Backend {
	return &Swww{}
}

var _ backend.Backend = (*Swww)(nil)

func (s *Swww) Name() string { return "swww" }

// resolveBinary finds which binary is installed (swww preferred, awww fallback).
// Called lazily and cached via sync.Once.
func (s *Swww) resolveBinary() {
	s.once.Do(func() {
		for i, bin := range binaryCandidates {
			if _, err := exec.LookPath(bin); err == nil {
				s.cliBinary = bin
				s.daemonBin = daemonCandidates[i]
				slog.Debug("swww backend: resolved binary", "cli", s.cliBinary, "daemon", s.daemonBin)
				return
			}
		}
		// Neither found — leave empty, IsAvailable() will return false.
	})
}

func (s *Swww) IsAvailable() bool {
	s.resolveBinary()
	return s.cliBinary != ""
}

func (s *Swww) Capabilities() backend.Capabilities {
	return backend.Capabilities{
		Compositors:   []monitor.CompositorType{monitor.CompositorWayland},
		MediaTypes:    []media.MediaType{media.MediaTypeImage},
		Transitions:   true,
		PerMonitor:    true,
		NativeExtend:  false,
		DaemonProcess: true,
	}
}

func (s *Swww) Initialize(ctx context.Context) error {
	s.resolveBinary()
	if s.cliBinary == "" {
		return fmt.Errorf("swww: neither swww nor awww found in PATH")
	}

	// Check if the daemon is already running via `<cli> query`.
	if err := exec.CommandContext(ctx, s.cliBinary, "query").Run(); err == nil {
		slog.Info("daemon already running", "binary", s.cliBinary)
		return nil
	}

	slog.Info("starting daemon with --no-cache", "binary", s.daemonBin)
	// Use Background context: the daemon must outlive the HTTP request that
	// triggered activation. Pdeathsig ensures cleanup when waypaper-daemon exits.
	cmd := exec.Command(s.daemonBin, "--no-cache")
	cmd.SysProcAttr = &syscall.SysProcAttr{Pdeathsig: syscall.SIGTERM}
	if err := cmd.Start(); err != nil {
		return fmt.Errorf("swww: start %s: %w", s.daemonBin, err)
	}
	s.process = cmd.Process

	// Collect exit status in the background so the process doesn't become a zombie.
	go func() {
		_ = cmd.Wait()
	}()

	// Wait for the daemon to become ready (accepts queries).
	// swww-daemon needs a moment to start listening on its socket.
	for i := range 20 {
		if err := exec.CommandContext(ctx, s.cliBinary, "query").Run(); err == nil {
			slog.Info("daemon ready", "binary", s.daemonBin, "attempts", i+1)
			return nil
		}
		time.Sleep(100 * time.Millisecond)
	}

	slog.Warn("daemon started but may not be ready yet", "binary", s.daemonBin)
	return nil
}

func (s *Swww) Shutdown(ctx context.Context) error {
	s.resolveBinary()
	if s.cliBinary == "" {
		return nil
	}

	slog.Info("stopping daemon", "binary", s.cliBinary)
	if err := exec.CommandContext(ctx, s.cliBinary, "kill").Run(); err != nil {
		// Exit 1 means the daemon wasn't running — that's the desired state.
		slog.Warn("swww kill command failed (daemon may already be stopped)", "error", err)
	}

	// If we started the daemon ourselves, ensure the process is actually dead.
	if s.process != nil {
		done := make(chan struct{})
		go func() {
			_, _ = s.process.Wait()
			close(done)
		}()
		select {
		case <-done:
			slog.Debug("swww-daemon process exited")
		case <-time.After(3 * time.Second):
			slog.Warn("swww-daemon did not exit after kill, sending SIGKILL")
			_ = s.process.Signal(syscall.SIGKILL)
		}
		s.process = nil
	}

	return nil
}

func (s *Swww) SetWallpaper(ctx context.Context, req backend.WallpaperRequest) error {
	s.resolveBinary()
	if s.cliBinary == "" {
		return fmt.Errorf("swww: neither swww nor awww found in PATH")
	}

	cfg, _ := req.Config.(*Config)
	if cfg == nil {
		cfg = s.loadConfigFromViper()
	}

	args := []string{"img", req.ImagePath}

	// Transition flags.
	if cfg.TransitionType != "" {
		args = append(args, "--transition-type", string(cfg.TransitionType))
	}
	if cfg.TransitionStep > 0 {
		args = append(args, "--transition-step", strconv.Itoa(cfg.TransitionStep))
	}
	if cfg.TransitionDuration > 0 {
		args = append(args, "--transition-duration", strconv.Itoa(cfg.TransitionDuration))
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

	slog.Debug("swww command", "binary", s.cliBinary, "args", args)
	cmd := exec.CommandContext(ctx, s.cliBinary, args...)
	output, err := cmd.CombinedOutput()
	if err != nil {
		return fmt.Errorf("%s img: %w (output: %s)", s.cliBinary, err, string(output))
	}
	return nil
}

func (s *Swww) RegisterDefaults(v *viper.Viper) {
	s.v = v
	v.SetDefault("backend.swww.transition_type", string(TransitionWipe))
	v.SetDefault("backend.swww.transition_step", 90)
	v.SetDefault("backend.swww.transition_duration", 3)
	v.SetDefault("backend.swww.transition_fps", 60)
	v.SetDefault("backend.swww.transition_angle", 45)
	v.SetDefault("backend.swww.transition_pos", string(PosCenter))
	v.SetDefault("backend.swww.transition_bezier", "0.25,0.1,0.25,1.0")
	v.SetDefault("backend.swww.transition_wave", "20,20")
	v.SetDefault("backend.swww.resize", string(ResizeCrop))
	v.SetDefault("backend.swww.fill_color", "000000")
	v.SetDefault("backend.swww.filter_type", string(FilterLanczos3))
	v.SetDefault("backend.swww.invert_y", false)
}

// loadConfigFromViper reads the [backend.swww] section from the TOML config via Viper.
// This is used as the fallback when req.Config is nil (i.e., most call sites).
//
// TOML convention uses hyphens (transition-type) while Go/mapstructure uses underscores
// (transition_type). Viper treats them as distinct keys, so we check both variants
// and prefer the explicitly-set value (from the file) over the default.
func (s *Swww) loadConfigFromViper() *Config {
	if s.v == nil {
		return &Config{}
	}

	prefix := "backend.swww."

	// getString checks the hyphenated key first (TOML convention), then underscored (defaults).
	getString := func(underscoreKey string) string {
		hyphenKey := prefix + strings.ReplaceAll(underscoreKey, "_", "-")
		fullKey := prefix + underscoreKey
		if s.v.IsSet(hyphenKey) {
			return s.v.GetString(hyphenKey)
		}
		return s.v.GetString(fullKey)
	}

	getInt := func(underscoreKey string) int {
		hyphenKey := prefix + strings.ReplaceAll(underscoreKey, "_", "-")
		fullKey := prefix + underscoreKey
		if s.v.IsSet(hyphenKey) {
			return s.v.GetInt(hyphenKey)
		}
		return s.v.GetInt(fullKey)
	}

	getBool := func(underscoreKey string) bool {
		hyphenKey := prefix + strings.ReplaceAll(underscoreKey, "_", "-")
		fullKey := prefix + underscoreKey
		if s.v.IsSet(hyphenKey) {
			return s.v.GetBool(hyphenKey)
		}
		return s.v.GetBool(fullKey)
	}

	cfg := &Config{
		TransitionType:     TransitionType(getString("transition_type")),
		TransitionStep:     getInt("transition_step"),
		TransitionDuration: getInt("transition_duration"),
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

	slog.Debug("swww: loaded config from viper",
		"transition_type", cfg.TransitionType,
		"transition_duration", cfg.TransitionDuration,
		"transition_fps", cfg.TransitionFPS,
		"transition_pos", cfg.TransitionPos,
	)

	return cfg
}

func (s *Swww) ValidateConfig(raw json.RawMessage) error {
	return backend.UnmarshalValidateConfig[Config](raw)
}

func (s *Swww) ParseConfig(raw json.RawMessage) (any, error) {
	return backend.UnmarshalParseConfig[Config](raw, "swww")
}
