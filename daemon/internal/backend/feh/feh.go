package feh

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"os/exec"
	"sort"

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
	// args[0] is the flag (--bg-fill etc.); args[1:] are per-Xinerama-screen paths.
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

// Apply implements backend.Backend. feh accepts one path per Xinerama screen
// positionally: `feh --bg-fill img0 img1 ...` puts img0 on screen 0, img1 on
// screen 1. Xinerama indexes screens by geometry, so we sort outputs by (Y, X)
// before emitting paths to match. For clone mode the snapshot repeats the same
// path per output and feh sets each head to that image.
func (f *Feh) Apply(_ context.Context, snap backend.Snapshot) error {
	if len(snap.Outputs) == 0 {
		return nil
	}

	flag := modeToFlag(f.loadModeFromViper())

	outs := append([]backend.Output(nil), snap.Outputs...)
	sort.SliceStable(outs, func(i, j int) bool {
		a, b := outs[i].Monitor, outs[j].Monitor
		if a.Y != b.Y {
			return a.Y < b.Y
		}
		return a.X < b.X
	})

	args := make([]string, 0, len(outs)+1)
	args = append(args, flag)
	for _, o := range outs {
		args = append(args, o.Content.Path())
	}
	slog.Debug("feh command", "flag", flag, "paths", args[1:])
	return f.execFn(args)
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
