package feh

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"os/exec"

	"waypaper-engine/daemon/internal/backend"
	"waypaper-engine/daemon/internal/monitor"

	"github.com/spf13/viper"
)

// Feh implements backend.Backend for the feh wallpaper setter.
type Feh struct{}

// New returns a new feh backend instance.
func New() backend.Backend {
	return &Feh{}
}

var _ backend.Backend = (*Feh)(nil)

func (f *Feh) Name() string { return "feh" }

func (f *Feh) IsAvailable() bool {
	_, err := exec.LookPath("feh")
	return err == nil
}

func (f *Feh) Capabilities() backend.Capabilities {
	return backend.Capabilities{
		ContentKinds: []backend.ContentKind{backend.KindStaticImage},
		Compositors:  []monitor.CompositorType{monitor.CompositorX11},
	}
}

// Initialize is a no-op for feh (no daemon process).
func (f *Feh) Initialize(_ context.Context) error { return nil }

// Shutdown is a no-op for feh (no daemon process).
func (f *Feh) Shutdown(_ context.Context) error { return nil }

// OnConfigChanged is a no-op for feh. Config is read from Viper at SetWallpaper time.
// The daemon control layer re-applies the current wallpaper after this returns.
func (f *Feh) OnConfigChanged(_ context.Context, _ json.RawMessage) error {
	return nil
}

func (f *Feh) SetWallpaper(ctx context.Context, req backend.WallpaperRequest) error {
	cfg, _ := req.Config.(*Config)
	if cfg == nil {
		cfg = &Config{Mode: ModeFill}
	}

	flag := modeToFlag(cfg.Mode)

	slog.Debug("feh command", "flag", flag, "image", req.ImagePath)
	cmd := exec.CommandContext(ctx, "feh", flag, req.ImagePath)
	output, err := cmd.CombinedOutput()
	if err != nil {
		return fmt.Errorf("feh %s: %w (output: %s)", flag, err, string(output))
	}
	return nil
}

func (f *Feh) RegisterDefaults(v *viper.Viper) {
	v.SetDefault("backend.feh.mode", string(ModeFill))
}

func (f *Feh) ValidateConfig(raw json.RawMessage) error {
	return backend.UnmarshalValidateConfig[Config](raw)
}

func (f *Feh) ParseConfig(raw json.RawMessage) (any, error) {
	return backend.UnmarshalParseConfig[Config](raw, "feh")
}

// modeToFlag converts a FehMode to the corresponding feh CLI flag.
func modeToFlag(mode FehMode) string {
	switch mode {
	case ModeFill:
		return "--bg-fill"
	case ModeScale:
		return "--bg-scale"
	case ModeTile:
		return "--bg-tile"
	case ModeCenter:
		return "--bg-center"
	case ModeMax:
		return "--bg-max"
	default:
		return "--bg-fill"
	}
}
