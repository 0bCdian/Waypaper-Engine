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
type Feh struct {
	v *viper.Viper
	// execFn allows tests to capture argv without running feh.
	// Defaults to execReal; replaced by SetExecForTest in tests.
	execFn func(args []string) error
}

// New returns a new feh backend instance.
func New() backend.Backend {
	f := &Feh{}
	f.execFn = f.execReal
	return f
}

// SetExecForTest replaces the exec seam and returns the previous fn for restore.
func (f *Feh) SetExecForTest(fn func(args []string) error) (prev func([]string) error) {
	prev = f.execFn
	f.execFn = fn
	return prev
}

// execReal runs feh with ctx support and the given args.
func (f *Feh) execReal(args []string) error {
	// args[0] is the flag (--bg-fill etc.), args[1] is the path.
	cmd := exec.Command("feh", args...)
	output, err := cmd.CombinedOutput()
	if err != nil {
		return fmt.Errorf("feh %s: %w (output: %s)", args[0], err, string(output))
	}
	return nil
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

// Apply implements backend.Backend. feh sets the X11 root window globally —
// there is no per-monitor targeting in its CLI. When multiple outputs are
// present, the first output's image is used (the snapshot must supply the
// same image for all outputs, as the orchestrator clones for X11).
func (f *Feh) Apply(_ context.Context, snap backend.Snapshot) error {
	if len(snap.Outputs) == 0 {
		return nil
	}

	flag := modeToFlag(f.loadModeFromViper())
	path := snap.Outputs[0].Content.Path()
	slog.Debug("feh command", "flag", flag, "image", path)
	return f.execFn([]string{flag, path})
}

func (f *Feh) RegisterDefaults(v *viper.Viper) {
	f.v = v
	v.SetDefault("backend.feh.mode", string(ModeFill))
}

func (f *Feh) loadModeFromViper() FehMode {
	if f.v == nil {
		return ModeFill
	}
	return FehMode(f.v.GetString("backend.feh.mode"))
}

func (f *Feh) ValidateConfig(raw json.RawMessage) error {
	return backend.UnmarshalValidateConfig[Config](raw)
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
