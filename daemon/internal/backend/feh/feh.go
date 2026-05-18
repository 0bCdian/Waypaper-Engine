package feh

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"os/exec"
	"sort"
	"strconv"
	"strings"

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
	// xineramaOrderFn returns a map of monitor name → Xinerama head index.
	// Defaults to a real impl that shells out to `xrandr --listmonitors`.
	// Tests override it.
	xineramaOrderFn func() (map[string]int, error)
}

// New returns a new feh backend instance.
func New() backend.Backend {
	f := &Feh{}
	f.execFn = f.execReal
	f.xineramaOrderFn = xineramaOrderFromXrandr
	return f
}

// SetExecForTest replaces the exec seam and returns the previous fn for restore.
func (f *Feh) SetExecForTest(fn func(args []string) error) (prev func([]string) error) {
	prev = f.execFn
	f.execFn = fn
	return prev
}

// SetXineramaOrderForTest replaces the Xinerama-ordering seam for tests.
func (f *Feh) SetXineramaOrderForTest(fn func() (map[string]int, error)) (prev func() (map[string]int, error)) {
	prev = f.xineramaOrderFn
	f.xineramaOrderFn = fn
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
// positionally: `feh --bg-fill img0 img1 ...` puts img0 on Xinerama head 0,
// img1 on head 1. The X server orders Xinerama heads "primary monitor first,
// then RandR enumeration order" — NOT by geometry — so we query the actual
// ordering via `xrandr --listmonitors` and reorder snap.Outputs to match
// before emitting paths. For clone mode the snapshot repeats the same path
// per output and feh sets each head to that image.
//
// If the Xinerama-order lookup fails (xrandr missing / parse error), we emit
// in snap.Outputs order with a warn log rather than failing Apply — a
// misaligned wallpaper is preferable to no wallpaper.
func (f *Feh) Apply(_ context.Context, snap backend.Snapshot) error {
	if len(snap.Outputs) == 0 {
		return nil
	}

	flag := modeToFlag(f.loadModeFromViper())

	outs := append([]backend.Output(nil), snap.Outputs...)
	if len(outs) > 1 {
		order, err := f.xineramaOrderFn()
		if err != nil {
			slog.Warn("feh: could not determine Xinerama head order; emitting outputs in snapshot order", "error", err)
		} else {
			sort.SliceStable(outs, func(i, j int) bool {
				return xineramaIndex(order, outs[i].Monitor.Name) < xineramaIndex(order, outs[j].Monitor.Name)
			})
		}
	}

	args := make([]string, 0, len(outs)+1)
	args = append(args, flag)
	for _, o := range outs {
		args = append(args, o.Content.Path())
	}
	slog.Debug("feh command", "flag", flag, "paths", args[1:])
	return f.execFn(args)
}

// xineramaIndex returns the Xinerama head index for the given monitor name,
// or a large sentinel for names not in the map (those sort to the end).
func xineramaIndex(order map[string]int, name string) int {
	if i, ok := order[name]; ok {
		return i
	}
	return 1<<30 + len(name)
}

// xineramaOrderFromXrandr runs `xrandr --listmonitors` and parses its output
// into a map of monitor name → Xinerama head index. The X server lists heads
// in Xinerama order in this command, so the leading integer is authoritative.
func xineramaOrderFromXrandr() (map[string]int, error) {
	cmd := exec.Command("xrandr", "--listmonitors")
	out, err := cmd.Output()
	if err != nil {
		return nil, fmt.Errorf("xrandr --listmonitors: %w", err)
	}
	return parseXrandrListMonitors(string(out)), nil
}

// parseXrandrListMonitors parses the output of `xrandr --listmonitors`.
//
// Example output:
//
//	Monitors: 2
//	 0: +*DisplayPort-0 2560/597x1440/336+1920+0  DisplayPort-0
//	 1: +HDMI-A-0 1920/477x1080/268+0+0  HDMI-A-0
//
// The leading integer is the Xinerama head index; the trailing token is the
// canonical RandR output name. We use those two and ignore everything in
// between.
func parseXrandrListMonitors(s string) map[string]int {
	result := make(map[string]int)
	for _, line := range strings.Split(s, "\n") {
		line = strings.TrimSpace(line)
		if line == "" || strings.HasPrefix(line, "Monitors:") {
			continue
		}
		// "0: +*DisplayPort-0 ... DisplayPort-0"
		colon := strings.IndexByte(line, ':')
		if colon <= 0 {
			continue
		}
		idx, err := strconv.Atoi(line[:colon])
		if err != nil {
			continue
		}
		fields := strings.Fields(line[colon+1:])
		if len(fields) == 0 {
			continue
		}
		name := fields[len(fields)-1]
		result[name] = idx
	}
	return result
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
