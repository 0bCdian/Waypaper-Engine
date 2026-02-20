package hyprpaper

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"os/exec"

	"waypaper-engine/daemon/internal/backend"
	"waypaper-engine/daemon/internal/media"
	"waypaper-engine/daemon/internal/monitor"

	"github.com/spf13/viper"
)

// Hyprpaper implements backend.Backend for the hyprpaper wallpaper daemon.
type Hyprpaper struct{}

// New returns a new hyprpaper backend instance.
func New() backend.Backend {
	return &Hyprpaper{}
}

var _ backend.Backend = (*Hyprpaper)(nil)

func (h *Hyprpaper) Name() string { return "hyprpaper" }

func (h *Hyprpaper) IsAvailable() bool {
	_, err := exec.LookPath("hyprpaper")
	return err == nil
}

func (h *Hyprpaper) Capabilities() backend.Capabilities {
	return backend.Capabilities{
		Compositors:   []monitor.CompositorType{monitor.CompositorWayland},
		MediaTypes:    []media.MediaType{media.MediaTypeImage},
		Transitions:   false,
		PerMonitor:    true,
		NativeExtend:  false,
		DaemonProcess: true,
	}
}

func (h *Hyprpaper) Initialize(ctx context.Context) error {
	// Check if hyprpaper is already running by attempting hyprctl hyprpaper listloaded.
	if err := exec.CommandContext(ctx, "hyprctl", "hyprpaper", "listloaded").Run(); err == nil {
		slog.Info("hyprpaper already running")
		return nil
	}

	slog.Info("starting hyprpaper")
	// Use exec.Command (not CommandContext): the daemon must outlive the HTTP
	// request that triggered activation.
	cmd := exec.Command("hyprpaper")
	if err := cmd.Start(); err != nil {
		return fmt.Errorf("hyprpaper: start: %w", err)
	}

	go func() {
		_ = cmd.Wait()
	}()

	return nil
}

func (h *Hyprpaper) Shutdown(ctx context.Context) error {
	slog.Info("stopping hyprpaper")
	// hyprpaper doesn't have a graceful shutdown command; pkill it.
	if err := exec.CommandContext(ctx, "pkill", "hyprpaper").Run(); err != nil {
		return fmt.Errorf("hyprpaper: shutdown: %w", err)
	}
	return nil
}

func (h *Hyprpaper) SetWallpaper(ctx context.Context, req backend.WallpaperRequest) error {
	// Step 1: Unload all previously loaded wallpapers to free memory.
	_ = exec.CommandContext(ctx, "hyprctl", "hyprpaper", "unload", "all").Run()

	// Step 2: Preload the image.
	slog.Debug("hyprpaper preload", "image", req.ImagePath)
	if output, err := exec.CommandContext(ctx, "hyprctl", "hyprpaper", "preload", req.ImagePath).CombinedOutput(); err != nil {
		return fmt.Errorf("hyprpaper preload: %w (output: %s)", err, string(output))
	}

	// Step 3: Apply the wallpaper to each target monitor.
	for _, mon := range req.Monitors {
		wallpaperArg := fmt.Sprintf("%s,%s", mon.Name, req.ImagePath)
		slog.Debug("hyprpaper wallpaper", "arg", wallpaperArg)
		if output, err := exec.CommandContext(ctx, "hyprctl", "hyprpaper", "wallpaper", wallpaperArg).CombinedOutput(); err != nil {
			return fmt.Errorf("hyprpaper wallpaper %s: %w (output: %s)", mon.Name, err, string(output))
		}
	}

	return nil
}

func (h *Hyprpaper) RegisterDefaults(v *viper.Viper) {
	v.SetDefault("backend.hyprpaper.splash", false)
	v.SetDefault("backend.hyprpaper.ipc", true)
}

func (h *Hyprpaper) ValidateConfig(raw json.RawMessage) error {
	var cfg Config
	return json.Unmarshal(raw, &cfg)
}

func (h *Hyprpaper) ParseConfig(raw json.RawMessage) (any, error) {
	var cfg Config
	if err := json.Unmarshal(raw, &cfg); err != nil {
		return nil, fmt.Errorf("hyprpaper: parse config: %w", err)
	}
	return &cfg, nil
}
