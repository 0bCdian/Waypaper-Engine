// Package swaybg implements backend.Backend for the swaybg Wayland wallpaper setter.
//
// swaybg has no IPC: a wallpaper change is performed by killing the running
// process and spawning a fresh one with the new arguments. A single invocation
// can target multiple outputs by repeating `-o NAME -i PATH -m MODE` segments.
package swaybg

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"os"
	"os/exec"
	"sync"
	"syscall"
	"time"

	"waypaper-engine/daemon/internal/backend"
	"waypaper-engine/daemon/internal/monitor"

	"github.com/spf13/viper"
)

type Swaybg struct {
	v       *viper.Viper
	process *os.Process
	mu      sync.Mutex
}

func New() backend.Backend {
	return &Swaybg{}
}

var _ backend.Backend = (*Swaybg)(nil)

func (s *Swaybg) Name() string { return "swaybg" }

func (s *Swaybg) IsAvailable() bool {
	_, err := exec.LookPath("swaybg")
	return err == nil
}

func (s *Swaybg) Capabilities() backend.Capabilities {
	return backend.Capabilities{
		ContentKinds: []backend.ContentKind{backend.KindStaticImage},
		Compositors:  []monitor.CompositorType{monitor.CompositorWayland},
	}
}

func isProcessRunning() bool {
	return exec.Command("pgrep", "-x", "swaybg").Run() == nil
}

func (s *Swaybg) killProcess() {
	_ = exec.Command("pkill", "-x", "swaybg").Run()

	if s.process != nil {
		done := make(chan struct{})
		go func() {
			_, _ = s.process.Wait()
			close(done)
		}()
		select {
		case <-done:
		case <-time.After(3 * time.Second):
			_ = s.process.Signal(syscall.SIGKILL)
		}
		s.process = nil
	}

	for range 20 {
		if !isProcessRunning() {
			return
		}
		time.Sleep(50 * time.Millisecond)
	}
}

func (s *Swaybg) startProcess(args []string) error {
	cmd := exec.Command("swaybg", args...)
	cmd.SysProcAttr = &syscall.SysProcAttr{Pdeathsig: syscall.SIGTERM}
	if err := cmd.Start(); err != nil {
		return fmt.Errorf("swaybg: start: %w", err)
	}
	s.process = cmd.Process
	go func() { _ = cmd.Wait() }()
	return nil
}

func (s *Swaybg) Initialize(_ context.Context) error {
	// swaybg has no persistent daemon mode — it is (re)started on each
	// SetWallpaper call. Make sure no stale instance is lingering.
	s.killProcess()
	return nil
}

func (s *Swaybg) Shutdown(_ context.Context) error {
	slog.Info("stopping swaybg")
	s.killProcess()
	return nil
}

// OnConfigChanged is a no-op for swaybg. The daemon control layer re-applies
// the current wallpaper after this returns, picking up the new fit mode.
func (s *Swaybg) OnConfigChanged(_ context.Context, _ json.RawMessage) error {
	return nil
}

func (s *Swaybg) SetWallpaper(_ context.Context, req backend.WallpaperRequest) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	cfg, _ := req.Config.(*Config)
	if cfg == nil {
		cfg = s.loadConfigFromViper()
	}
	fitMode := string(cfg.FitMode)
	if fitMode == "" {
		fitMode = string(FitFill)
	}

	args := make([]string, 0, len(req.Monitors)*6)
	for _, mon := range req.Monitors {
		args = append(args, "-o", mon.Name, "-i", req.ImagePath, "-m", fitMode)
	}

	s.killProcess()
	return s.startProcess(args)
}

func (s *Swaybg) RegisterDefaults(v *viper.Viper) {
	s.v = v
	v.SetDefault("backend.swaybg.fit_mode", string(FitFill))
}

func (s *Swaybg) loadConfigFromViper() *Config {
	if s.v == nil {
		return &Config{FitMode: FitFill}
	}
	return &Config{
		FitMode: FitMode(s.v.GetString("backend.swaybg.fit_mode")),
	}
}

func (s *Swaybg) ValidateConfig(raw json.RawMessage) error {
	return backend.UnmarshalValidateConfig[Config](raw)
}

func (s *Swaybg) ParseConfig(raw json.RawMessage) (any, error) {
	return backend.UnmarshalParseConfig[Config](raw, "swaybg")
}
