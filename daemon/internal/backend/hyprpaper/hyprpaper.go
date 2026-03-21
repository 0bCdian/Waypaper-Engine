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
	"waypaper-engine/daemon/internal/media"
	"waypaper-engine/daemon/internal/monitor"

	"github.com/spf13/viper"
)

// Hyprpaper implements backend.Backend for the hyprpaper wallpaper daemon.
// Supports two wallpaper-setting strategies controlled by the use_ipc config:
//   - IPC mode (hyprctl hyprpaper wallpaper) -- requires hyprpaper > 0.8.3
//     with the fix for hyprwm/hyprpaper#333 (PR #335).
//   - Config-file mode (write hyprpaper.conf + restart) -- works with any version.
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
	if _, err := exec.LookPath("hyprpaper"); err != nil {
		return false
	}
	if h.loadConfigFromViper().UseIPC {
		if _, err := exec.LookPath("hyprctl"); err != nil {
			return false
		}
	}
	return true
}

func (h *Hyprpaper) Capabilities() backend.Capabilities {
	return backend.Capabilities{
		Compositors:   []monitor.CompositorType{monitor.CompositorWayland},
		MediaTypes:    []media.MediaType{media.MediaTypeImage},
		Transitions:   false,
		PerMonitor:    true,
		DaemonProcess: true,
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
	return nil
}

// ---------------------------------------------------------------------------
// IPC mode helpers (hyprctl hyprpaper wallpaper)
// Requires hyprpaper >= post-0.8.3 with hyprwm/hyprpaper#335
// ---------------------------------------------------------------------------

func isIPCReady(ctx context.Context) bool {
	if !isProcessRunning() {
		return false
	}
	out, _ := exec.CommandContext(ctx, "hyprctl", "hyprpaper", "wallpaper", ", /dev/null, cover").CombinedOutput()
	s := strings.ToLower(string(out))
	return !strings.Contains(s, "unknown") &&
		!strings.Contains(s, "failed to connect") &&
		!strings.Contains(s, "can't send")
}

func (h *Hyprpaper) setWallpaperIPC(ctx context.Context, req backend.WallpaperRequest, fitMode string) error {
	for _, mon := range req.Monitors {
		arg := fmt.Sprintf("%s, %s, %s", mon.Name, req.ImagePath, fitMode)
		out, err := exec.CommandContext(ctx, "hyprctl", "hyprpaper", "wallpaper", arg).CombinedOutput()
		if err != nil {
			return fmt.Errorf("hyprpaper wallpaper %s: %w (output: %s)", mon.Name, err, strings.TrimSpace(string(out)))
		}
	}
	return nil
}

func (h *Hyprpaper) initializeIPC(ctx context.Context) error {
	if isIPCReady(ctx) {
		slog.Info("hyprpaper already running")
		return nil
	}

	slog.Info("starting hyprpaper")
	if err := h.startDaemon(); err != nil {
		return err
	}

	for i := range 30 {
		if isIPCReady(ctx) {
			slog.Info("hyprpaper ready", "attempts", i+1)
			return nil
		}
		time.Sleep(100 * time.Millisecond)
	}

	slog.Warn("hyprpaper started but may not be ready yet")
	return nil
}

// ---------------------------------------------------------------------------
// Config-file mode helpers (write conf + restart)
// Workaround for hyprpaper <=0.8.3 where IPC wallpaper commands are
// accepted but never rendered (hyprwm/hyprpaper#333).
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
	entries := make([]wallpaperEntry, 0, len(req.Monitors))
	for _, mon := range req.Monitors {
		entries = append(entries, wallpaperEntry{
			Monitor: mon.Name,
			Path:    req.ImagePath,
			FitMode: fitMode,
		})
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
	if h.loadConfigFromViper().UseIPC {
		return h.initializeIPC(ctx)
	}
	return h.initializeConfig(ctx)
}

func (h *Hyprpaper) Shutdown(ctx context.Context) error {
	slog.Info("stopping hyprpaper")
	h.killProcess()
	return nil
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

	if cfg.UseIPC {
		return h.setWallpaperIPC(ctx, req, fitMode)
	}
	return h.setWallpaperConfig(ctx, req, fitMode, cfg.ConfigPath)
}

func (h *Hyprpaper) RegisterDefaults(v *viper.Viper) {
	h.v = v
	v.SetDefault("backend.hyprpaper.fit_mode", string(FitCover))
	v.SetDefault("backend.hyprpaper.use_ipc", false)
	v.SetDefault("backend.hyprpaper.config_path", "")
}

func (h *Hyprpaper) loadConfigFromViper() *Config {
	if h.v == nil {
		return &Config{FitMode: FitCover}
	}
	return &Config{
		FitMode:    FitMode(h.v.GetString("backend.hyprpaper.fit_mode")),
		UseIPC:     h.v.GetBool("backend.hyprpaper.use_ipc"),
		ConfigPath: h.v.GetString("backend.hyprpaper.config_path"),
	}
}

func (h *Hyprpaper) ValidateConfig(raw json.RawMessage) error {
	return backend.UnmarshalValidateConfig[Config](raw)
}

func (h *Hyprpaper) ParseConfig(raw json.RawMessage) (any, error) {
	return backend.UnmarshalParseConfig[Config](raw, "hyprpaper")
}
