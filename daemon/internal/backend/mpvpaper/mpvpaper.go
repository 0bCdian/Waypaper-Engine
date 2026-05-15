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

// procState tracks the path and audio flag for a running mpvpaper process.
type procState struct {
	cmd          *exec.Cmd
	path         string
	audioEnabled bool
}

// Mpvpaper runs one mpvpaper process per Wayland output.
type Mpvpaper struct {
	mu    sync.Mutex
	procs map[string]*procState
	v     *viper.Viper
	// execFn starts an mpvpaper process with the given args and returns the cmd.
	// In tests, returns (nil, nil) to avoid spawning a real process.
	execFn func(output string, args []string) (*exec.Cmd, error)
	// killFn terminates a running process entry. In tests, a no-op.
	killFn func(output string, ps *procState)
}

// New returns a new mpvpaper backend.
func New() backend.Backend {
	m := &Mpvpaper{procs: make(map[string]*procState)}
	m.execFn = m.execReal
	m.killFn = m.killReal
	return m
}

// SetExecForTest replaces the exec seam and returns the previous fn for restore.
func (m *Mpvpaper) SetExecForTest(fn func(output string, args []string) (*exec.Cmd, error)) (prev func(string, []string) (*exec.Cmd, error)) {
	prev = m.execFn
	m.execFn = fn
	return prev
}

// SetKillForTest replaces the kill seam with a simpler fn(output string) signature,
// hiding the unexported procState from test packages. Returns the previous kill fn.
func (m *Mpvpaper) SetKillForTest(fn func(output string)) (prev func(string, *procState)) {
	prev = m.killFn
	m.killFn = func(output string, _ *procState) { fn(output) }
	return prev
}

// ResetProcsForTest clears the internal process map so each shadow-test run
// starts from a clean state. Only call from test helpers.
func (m *Mpvpaper) ResetProcsForTest() {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.procs = make(map[string]*procState)
}

// execReal starts mpvpaper and returns the cmd.
func (m *Mpvpaper) execReal(output string, args []string) (*exec.Cmd, error) {
	cmd := exec.Command(binary, args...)
	cmd.SysProcAttr = &syscall.SysProcAttr{Pdeathsig: syscall.SIGTERM}
	if err := cmd.Start(); err != nil {
		return nil, fmt.Errorf("mpvpaper: start output %s: %w", output, err)
	}
	go func(c *exec.Cmd) { _ = c.Wait() }(cmd)
	return cmd, nil
}

// killReal sends SIGTERM to a running process.
func (m *Mpvpaper) killReal(_ string, ps *procState) {
	if ps != nil {
		killMpvpaperCmd(ps.cmd)
	}
}

var _ backend.Backend = (*Mpvpaper)(nil)

func (m *Mpvpaper) Name() string { return "mpvpaper" }

func (m *Mpvpaper) IsAvailable() bool {
	_, err := exec.LookPath(binary)
	return err == nil
}

func (m *Mpvpaper) Capabilities() backend.Capabilities {
	return backend.Capabilities{
		ContentKinds: []backend.ContentKind{backend.KindVideo},
		Compositors:  []monitor.CompositorType{monitor.CompositorWayland},
	}
}

func (m *Mpvpaper) Initialize(context.Context) error { return nil }

func (m *Mpvpaper) Shutdown(context.Context) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	for out, ps := range m.procs {
		m.killFn(out, ps)
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
			m.killFn(out, old)
			delete(m.procs, out)
		}
		args := buildMpvpaperArgs(out, req.ImagePath, cfg, req.AudioEnabled)
		slog.Debug("mpvpaper command", "binary", binary, "args", args)
		cmd, err := m.execFn(out, args)
		if err != nil {
			return err
		}
		m.procs[out] = &procState{cmd: cmd, path: req.ImagePath, audioEnabled: req.AudioEnabled}
	}
	return nil
}

// Apply implements backend.Backend by natively consuming a Snapshot.
// It reconciles the desired state (snap.Outputs) against the currently-running
// per-output processes:
//   - Outputs not currently running → start a new process.
//   - Outputs whose path or audio flag changed → kill old, start new.
//   - Running outputs NOT in snap.Outputs → kill (they should stop).
//
// Equivalence for shadow testing: the set of (monitor → argv) started and the
// set of monitors killed must match between Apply and SetWallpaper for the same
// logical state. Byte-identical argv comparison is used for start actions;
// set equality is used for kill actions.
func (m *Mpvpaper) Apply(ctx context.Context, snap backend.Snapshot) error {
	if len(snap.Outputs) == 0 {
		return nil
	}

	cfg := m.loadConfigFromViper()
	if err := validateConfig(cfg); err != nil {
		return err
	}

	m.mu.Lock()
	defer m.mu.Unlock()

	// Build desired-state map.
	desired := make(map[string]backend.Output, len(snap.Outputs))
	for _, o := range snap.Outputs {
		desired[o.Monitor.Name] = o
	}

	// Kill outputs no longer in desired set.
	for out, ps := range m.procs {
		if _, ok := desired[out]; !ok {
			m.killFn(out, ps)
			delete(m.procs, out)
		}
	}

	// Start or restart desired outputs.
	for out, o := range desired {
		vid, ok := o.Content.(backend.Video)
		if !ok {
			// mpvpaper only handles Video; skip other content kinds.
			continue
		}
		path := vid.Path_
		audio := vid.AudioEnabled

		existing := m.procs[out]
		if existing != nil && existing.path == path && existing.audioEnabled == audio {
			// Already running with correct state; nothing to do.
			continue
		}
		if existing != nil {
			m.killFn(out, existing)
			delete(m.procs, out)
		}

		args := buildMpvpaperArgs(out, path, cfg, audio)
		slog.Debug("mpvpaper Apply command", "binary", binary, "output", out, "args", args)
		cmd, err := m.execFn(out, args)
		if err != nil {
			return err
		}
		m.procs[out] = &procState{cmd: cmd, path: path, audioEnabled: audio}
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
