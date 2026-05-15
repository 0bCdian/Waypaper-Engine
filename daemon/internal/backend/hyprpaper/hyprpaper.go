package hyprpaper

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"sync"
	"syscall"
	"time"

	"waypaper-engine/daemon/internal/backend"
	"waypaper-engine/daemon/internal/monitor"

	"github.com/spf13/viper"
)

// Hyprpaper implements backend.Backend for the hyprpaper wallpaper daemon.
// It writes hyprpaper.conf and restarts the daemon (compatible with all hyprpaper versions).
type Hyprpaper struct {
	v       *viper.Viper
	process *os.Process
	mu      sync.Mutex
}

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
		ContentKinds: []backend.ContentKind{backend.KindStaticImage, backend.KindGIF},
		Compositors:  []monitor.CompositorType{monitor.CompositorWayland},
	}
}

// ---------------------------------------------------------------------------
// Process helpers
// ---------------------------------------------------------------------------

func isProcessRunning() bool {
	return exec.Command("pgrep", "-x", "hyprpaper").Run() == nil
}

func (h *Hyprpaper) killProcess() {
	_ = exec.Command("pkill", "-x", "hyprpaper").Run()

	if h.process != nil {
		done := make(chan struct{})
		go func() {
			_, _ = h.process.Wait()
			close(done)
		}()
		select {
		case <-done:
		case <-time.After(3 * time.Second):
			_ = h.process.Signal(syscall.SIGKILL)
		}
		h.process = nil
	}

	for range 20 {
		if !isProcessRunning() {
			return
		}
		time.Sleep(50 * time.Millisecond)
	}
}

func (h *Hyprpaper) startDaemon() error {
	cmd := exec.Command("hyprpaper")
	cmd.SysProcAttr = &syscall.SysProcAttr{Pdeathsig: syscall.SIGTERM}
	if err := cmd.Start(); err != nil {
		return fmt.Errorf("hyprpaper: start: %w", err)
	}
	h.process = cmd.Process
	go func() { _ = cmd.Wait() }()

	for range 30 {
		if isProcessRunning() {
			return nil
		}
		time.Sleep(100 * time.Millisecond)
	}
	return fmt.Errorf("hyprpaper: process did not stay running after start (check hyprpaper.conf and logs)")
}

// ---------------------------------------------------------------------------
// Config-file mode (write conf + restart)
// ---------------------------------------------------------------------------

func configPath(override string) string {
	if override != "" {
		return override
	}
	if dir := os.Getenv("XDG_CONFIG_HOME"); dir != "" {
		return filepath.Join(dir, "hypr", "hyprpaper.conf")
	}
	home, _ := os.UserHomeDir()
	return filepath.Join(home, ".config", "hypr", "hyprpaper.conf")
}

type wallpaperEntry struct {
	Monitor string
	Path    string
	FitMode string
}

func writeConfig(pathOverride string, entries []wallpaperEntry) error {
	var b strings.Builder
	b.WriteString("splash = false\nipc = true\n\n")
	for _, e := range entries {
		b.WriteString("wallpaper {\n")
		fmt.Fprintf(&b, "    monitor = %s\n", e.Monitor)
		fmt.Fprintf(&b, "    path = %s\n", e.Path)
		fmt.Fprintf(&b, "    fit_mode = %s\n", e.FitMode)
		b.WriteString("}\n\n")
	}

	p := configPath(pathOverride)
	if err := os.MkdirAll(filepath.Dir(p), 0755); err != nil {
		return fmt.Errorf("hyprpaper: mkdir config dir: %w", err)
	}
	return os.WriteFile(p, []byte(b.String()), 0644)
}

func (h *Hyprpaper) setWallpaperConfig(ctx context.Context, req backend.WallpaperRequest, fitMode, confPath string) error {
	var entries []wallpaperEntry
	if len(req.IndividualTargets) > 0 {
		entries = make([]wallpaperEntry, 0, len(req.IndividualTargets))
		for _, t := range req.IndividualTargets {
			entries = append(entries, wallpaperEntry{
				Monitor: t.Monitor.Name,
				Path:    t.Path,
				FitMode: fitMode,
			})
		}
	} else {
		entries = make([]wallpaperEntry, 0, len(req.Monitors))
		for _, mon := range req.Monitors {
			entries = append(entries, wallpaperEntry{
				Monitor: mon.Name,
				Path:    req.ImagePath,
				FitMode: fitMode,
			})
		}
	}

	if err := writeConfig(confPath, entries); err != nil {
		return err
	}

	h.killProcess()
	return h.startDaemon()
}

func (h *Hyprpaper) initializeConfig(ctx context.Context) error {
	h.killProcess()

	slog.Info("starting hyprpaper")
	if err := h.startDaemon(); err != nil {
		return err
	}
	slog.Info("hyprpaper started")
	return nil
}

// ---------------------------------------------------------------------------
// Backend interface
// ---------------------------------------------------------------------------

func (h *Hyprpaper) Initialize(ctx context.Context) error {
	return h.initializeConfig(ctx)
}

func (h *Hyprpaper) Shutdown(ctx context.Context) error {
	slog.Info("stopping hyprpaper")
	h.killProcess()
	return nil
}

// OnConfigChanged is a no-op for hyprpaper. Config is read from Viper at SetWallpaper time.
// The daemon control layer re-applies the current wallpaper after this returns.
func (h *Hyprpaper) OnConfigChanged(_ context.Context, _ json.RawMessage) error {
	return nil
}

func (h *Hyprpaper) Apply(ctx context.Context, snap backend.Snapshot) error {
	h.mu.Lock()
	defer h.mu.Unlock()

	cfg := h.loadConfigFromViper()
	fitMode := string(cfg.FitMode)
	if fitMode == "" {
		fitMode = string(FitCover)
	}

	entries := make([]wallpaperEntry, 0, len(snap.Outputs))
	for _, o := range snap.Outputs {
		entries = append(entries, wallpaperEntry{
			Monitor: o.Monitor.Name,
			Path:    o.Content.Path(),
			FitMode: fitMode,
		})
	}

	if err := writeConfig(cfg.ConfigPath, entries); err != nil {
		return err
	}

	h.killProcess()
	return h.startDaemon()
}

func (h *Hyprpaper) SetWallpaper(ctx context.Context, req backend.WallpaperRequest) error {
	h.mu.Lock()
	defer h.mu.Unlock()

	cfg, _ := req.Config.(*Config)
	if cfg == nil {
		cfg = h.loadConfigFromViper()
	}

	fitMode := string(cfg.FitMode)
	if fitMode == "" {
		fitMode = string(FitCover)
	}

	return h.setWallpaperConfig(ctx, req, fitMode, cfg.ConfigPath)
}

func (h *Hyprpaper) RegisterDefaults(v *viper.Viper) {
	h.v = v
	v.SetDefault("backend.hyprpaper.fit_mode", string(FitCover))
	v.SetDefault("backend.hyprpaper.config_path", "")
}

func (h *Hyprpaper) loadConfigFromViper() *Config {
	if h.v == nil {
		return &Config{FitMode: FitCover}
	}
	return &Config{
		FitMode:    FitMode(h.v.GetString("backend.hyprpaper.fit_mode")),
		ConfigPath: h.v.GetString("backend.hyprpaper.config_path"),
	}
}

func (h *Hyprpaper) ValidateConfig(raw json.RawMessage) error {
	return backend.UnmarshalValidateConfig[Config](raw)
}

func (h *Hyprpaper) ParseConfig(raw json.RawMessage) (any, error) {
	return backend.UnmarshalParseConfig[Config](raw, "hyprpaper")
}
