package swww

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"os/exec"
	"strconv"

	"waypaper-engine/daemon/internal/backend"
	"waypaper-engine/daemon/internal/media"
	"waypaper-engine/daemon/internal/monitor"

	"github.com/spf13/viper"
)

// Swww implements backend.Backend for the swww wallpaper daemon.
type Swww struct{}

// New returns a new swww backend instance.
func New() backend.Backend {
	return &Swww{}
}

var _ backend.Backend = (*Swww)(nil)

func (s *Swww) Name() string { return "swww" }

func (s *Swww) IsAvailable() bool {
	_, err := exec.LookPath("swww")
	return err == nil
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
	// Check if swww-daemon is already running via `swww query`.
	if err := exec.CommandContext(ctx, "swww", "query").Run(); err == nil {
		slog.Info("swww-daemon already running")
		return nil
	}

	slog.Info("starting swww-daemon")
	cmd := exec.CommandContext(ctx, "swww-daemon")
	if err := cmd.Start(); err != nil {
		return fmt.Errorf("swww: start daemon: %w", err)
	}

	// Release the process so it survives if our context is cancelled during startup.
	go func() {
		_ = cmd.Wait()
	}()

	return nil
}

func (s *Swww) Shutdown(ctx context.Context) error {
	slog.Info("stopping swww-daemon")
	if err := exec.CommandContext(ctx, "swww", "kill").Run(); err != nil {
		return fmt.Errorf("swww: kill daemon: %w", err)
	}
	return nil
}

func (s *Swww) SetWallpaper(ctx context.Context, req backend.WallpaperRequest) error {
	cfg, _ := req.Config.(*Config)
	if cfg == nil {
		cfg = &Config{}
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
		args = append(args, "--fill-color", cfg.FillColor)
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

	slog.Debug("swww command", "args", args)
	cmd := exec.CommandContext(ctx, "swww", args...)
	output, err := cmd.CombinedOutput()
	if err != nil {
		return fmt.Errorf("swww img: %w (output: %s)", err, string(output))
	}
	return nil
}

func (s *Swww) RegisterDefaults(v *viper.Viper) {
	v.SetDefault("backend.swww.transition_type", string(TransitionWipe))
	v.SetDefault("backend.swww.transition_step", 90)
	v.SetDefault("backend.swww.transition_duration", 3)
	v.SetDefault("backend.swww.transition_fps", 60)
	v.SetDefault("backend.swww.transition_angle", 45)
	v.SetDefault("backend.swww.transition_pos", string(PosCenter))
	v.SetDefault("backend.swww.transition_bezier", "0.25,0.1,0.25,1.0")
	v.SetDefault("backend.swww.transition_wave", "20,20")
	v.SetDefault("backend.swww.resize", string(ResizeCrop))
	v.SetDefault("backend.swww.fill_color", "#000000")
	v.SetDefault("backend.swww.filter_type", string(FilterLanczos3))
	v.SetDefault("backend.swww.invert_y", false)
}

func (s *Swww) ValidateConfig(raw json.RawMessage) error {
	var cfg Config
	return json.Unmarshal(raw, &cfg)
}

func (s *Swww) ParseConfig(raw json.RawMessage) (any, error) {
	var cfg Config
	if err := json.Unmarshal(raw, &cfg); err != nil {
		return nil, fmt.Errorf("swww: parse config: %w", err)
	}
	return &cfg, nil
}
