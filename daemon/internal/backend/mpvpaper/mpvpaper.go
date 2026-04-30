package mpvpaper

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"os/exec"
	"strconv"
	"strings"
	"sync"
	"syscall"

	"waypaper-engine/daemon/internal/backend"
	"waypaper-engine/daemon/internal/media"
	"waypaper-engine/daemon/internal/monitor"

	"github.com/spf13/viper"
)

const binary = "mpvpaper"

// Mpvpaper runs one mpvpaper process per Wayland output.
type Mpvpaper struct {
	mu    sync.Mutex
	procs map[string]*exec.Cmd
	v     *viper.Viper
}

// New returns a new mpvpaper backend.
func New() backend.Backend {
	return &Mpvpaper{procs: make(map[string]*exec.Cmd)}
}

var _ backend.Backend = (*Mpvpaper)(nil)

func (m *Mpvpaper) Name() string { return "mpvpaper" }

func (m *Mpvpaper) IsAvailable() bool {
	_, err := exec.LookPath(binary)
	return err == nil
}

func (m *Mpvpaper) Capabilities() backend.Capabilities {
	return backend.Capabilities{
		Compositors:   []monitor.CompositorType{monitor.CompositorWayland},
		MediaTypes:    []media.MediaType{media.MediaTypeVideo},
		Transitions:   false,
		PerMonitor:    true,
		DaemonProcess: false,
	}
}

func (m *Mpvpaper) Initialize(context.Context) error { return nil }

func (m *Mpvpaper) Shutdown(context.Context) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	for out, cmd := range m.procs {
		killMpvpaperCmd(cmd)
		delete(m.procs, out)
	}
	return nil
}

// OnConfigChanged is a no-op for mpvpaper. Config is read from Viper at SetWallpaper time.
// The daemon control layer re-applies the current wallpaper after this returns.
func (m *Mpvpaper) OnConfigChanged(_ context.Context, _ json.RawMessage) error {
	return nil
}

func (m *Mpvpaper) SetWallpaper(_ context.Context, req backend.WallpaperRequest) error {
	if req.MediaType != media.MediaTypeVideo {
		return fmt.Errorf("mpvpaper: unsupported media type %q (only %q)", req.MediaType, media.MediaTypeVideo)
	}
	if !m.IsAvailable() {
		return fmt.Errorf("mpvpaper: %s not found in PATH", binary)
	}
	if len(req.Monitors) == 0 {
		return fmt.Errorf("mpvpaper: no monitors in request")
	}
	if strings.TrimSpace(req.ImagePath) == "" {
		return fmt.Errorf("mpvpaper: empty image path")
	}

	cfg, _ := req.Config.(*Config)
	if cfg == nil {
		cfg = m.loadConfigFromViper()
	}
	if err := validateConfig(cfg); err != nil {
		return err
	}

	m.mu.Lock()
	defer m.mu.Unlock()

	for _, mon := range req.Monitors {
		if strings.TrimSpace(mon.Name) == "" {
			return fmt.Errorf("mpvpaper: empty monitor name")
		}
		out := mon.Name
		if old := m.procs[out]; old != nil {
			killMpvpaperCmd(old)
			delete(m.procs, out)
		}
		args := buildMpvpaperArgs(out, req.ImagePath, cfg, req.AudioEnabled)
		slog.Debug("mpvpaper command", "binary", binary, "args", args)
		cmd := exec.Command(binary, args...)
		cmd.SysProcAttr = &syscall.SysProcAttr{Pdeathsig: syscall.SIGTERM}
		if err := cmd.Start(); err != nil {
			return fmt.Errorf("mpvpaper: start output %s: %w", out, err)
		}
		m.procs[out] = cmd
		go func(c *exec.Cmd) {
			_ = c.Wait()
		}(cmd)
	}
	return nil
}

func (m *Mpvpaper) RegisterDefaults(v *viper.Viper) {
	m.v = v
	prefix := "backend.mpvpaper."
	v.SetDefault(prefix+"mpv_options", "loop")
	v.SetDefault(prefix+"verbose", 0)
	v.SetDefault(prefix+"auto_pause", false)
	v.SetDefault(prefix+"auto_stop", false)
	v.SetDefault(prefix+"layer", "")
	v.SetDefault(prefix+"slideshow_secs", 0)
}

func (m *Mpvpaper) ValidateConfig(raw json.RawMessage) error {
	if err := backend.UnmarshalValidateConfig[Config](raw); err != nil {
		return err
	}
	var c Config
	if err := json.Unmarshal(raw, &c); err != nil {
		return fmt.Errorf("mpvpaper: parse config: %w", err)
	}
	return validateConfig(&c)
}

func (m *Mpvpaper) ParseConfig(raw json.RawMessage) (any, error) {
	return backend.UnmarshalParseConfig[Config](raw, "mpvpaper")
}

func validateConfig(cfg *Config) error {
	if cfg == nil {
		return nil
	}
	if cfg.Verbose < 0 || cfg.Verbose > 2 {
		return fmt.Errorf("mpvpaper: verbose must be 0, 1, or 2")
	}
	if cfg.SlideshowSecs < 0 {
		return fmt.Errorf("mpvpaper: slideshow_secs must be >= 0")
	}
	return nil
}

func (m *Mpvpaper) loadConfigFromViper() *Config {
	if m.v == nil {
		return &Config{MpvOptions: "loop"}
	}
	p := "backend.mpvpaper."
	return &Config{
		MpvOptions:    m.v.GetString(p + "mpv_options"),
		Verbose:       m.v.GetInt(p + "verbose"),
		AutoPause:     m.v.GetBool(p + "auto_pause"),
		AutoStop:      m.v.GetBool(p + "auto_stop"),
		Layer:         m.v.GetString(p + "layer"),
		SlideshowSecs: m.v.GetInt(p + "slideshow_secs"),
	}
}

// mergeMpvAudio prepends no-audio when wallpaper audio is off.
func mergeMpvAudio(mpvOptions string, audioEnabled bool) string {
	opts := strings.TrimSpace(mpvOptions)
	if !audioEnabled {
		if opts == "" {
			return "no-audio"
		}
		return "no-audio " + opts
	}
	return opts
}

func buildMpvpaperArgs(output, path string, cfg *Config, audioEnabled bool) []string {
	if cfg == nil {
		cfg = &Config{MpvOptions: "loop"}
	}
	var args []string
	switch cfg.Verbose {
	case 1:
		args = append(args, "-v")
	case 2:
		args = append(args, "-vv")
	}
	if cfg.AutoPause {
		args = append(args, "-p")
	}
	if cfg.AutoStop {
		args = append(args, "-s")
	}
	if cfg.SlideshowSecs > 0 {
		args = append(args, "-n", strconv.Itoa(cfg.SlideshowSecs))
	}
	if strings.TrimSpace(cfg.Layer) != "" {
		args = append(args, "-l", strings.TrimSpace(cfg.Layer))
	}
	merged := mergeMpvAudio(cfg.MpvOptions, audioEnabled)
	if merged != "" {
		args = append(args, "-o", merged)
	}
	args = append(args, output, path)
	return args
}

// killMpvpaperCmd asks mpvpaper to exit. Only the goroutine started after Start() may call Wait()
// on this cmd, so we must not Wait here.
func killMpvpaperCmd(cmd *exec.Cmd) {
	if cmd == nil || cmd.Process == nil {
		return
	}
	_ = cmd.Process.Signal(syscall.SIGTERM)
}
