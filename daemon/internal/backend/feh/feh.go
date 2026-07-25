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

type Feh struct {
	v               backend.ConfigReader
	execFn          func(args []string) error
	xineramaOrderFn func() (map[string]int, error)
}

func New() backend.Backend {
	f := &Feh{}
	f.execFn = f.execReal
	f.xineramaOrderFn = xineramaOrderFromXrandr
	return f
}

func (f *Feh) SetExecForTest(fn func(args []string) error) (prev func([]string) error) {
	prev = f.execFn
	f.execFn = fn
	return prev
}

func (f *Feh) SetXineramaOrderForTest(fn func() (map[string]int, error)) (prev func() (map[string]int, error)) {
	prev = f.xineramaOrderFn
	f.xineramaOrderFn = fn
	return prev
}

func (f *Feh) execReal(args []string) error {
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

func (f *Feh) Initialize(_ context.Context) error { return nil }

func (f *Feh) Shutdown(_ context.Context) error { return nil }

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

func xineramaIndex(order map[string]int, name string) int {
	if i, ok := order[name]; ok {
		return i
	}
	return 1<<30 + len(name)
}

func xineramaOrderFromXrandr() (map[string]int, error) {
	cmd := exec.Command("xrandr", "--listmonitors")
	out, err := cmd.Output()
	if err != nil {
		return nil, fmt.Errorf("xrandr --listmonitors: %w", err)
	}
	return parseXrandrListMonitors(string(out)), nil
}

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
	v.SetDefault("backend.feh.mode", string(ModeFill))
}

func (f *Feh) SetConfigReader(r backend.ConfigReader) {
	f.v = r
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
