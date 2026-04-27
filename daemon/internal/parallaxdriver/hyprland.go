package parallaxdriver

import (
	"context"
	"fmt"
	"log/slog"
	"os/exec"
	"strings"
	"time"
)

// RunHyprland uses Hyprland socket2 when available (event-driven, low latency); otherwise polls hyprctl.
func RunHyprland(ctx context.Context, opts RunOpts, log *slog.Logger) error {
	if hyprlandSocket2Path() != "" {
		return runHyprlandSocket2(ctx, opts, log)
	}
	return runHyprlandPoll(ctx, opts, log, 50*time.Millisecond)
}

func runHyprlandPoll(ctx context.Context, opts RunOpts, log *slog.Logger, every time.Duration) error {
	if log == nil {
		log = slog.Default()
	}
	ticker := time.NewTicker(every)
	defer ticker.Stop()
	st := &workspaceParallaxAbsoluteState{}
	for {
		select {
		case <-ctx.Done():
			return ctx.Err()
		case <-ticker.C:
			tickCtx, cancel := context.WithTimeout(ctx, 600*time.Millisecond)
			entries, ok := hyprlandAllMonitorWorkspaces(tickCtx, log)
			if ok {
				vert := opts.Vertical != nil && opts.Vertical()
				st.tick(tickCtx, entries, opts.Move, opts.ResolveMonitor, opts.ExpandMoveTargets, vert, opts.ChunkSize, log)
			}
			cancel()
		}
	}
}

// hyprlandAllMonitorWorkspaces returns an entry for every connected Hyprland monitor
// with its active workspace id, geometry, and compositor monitor index.
func hyprlandAllMonitorWorkspaces(ctx context.Context, log *slog.Logger) ([]MonitorWorkspaceEntry, bool) {
	if log == nil {
		log = slog.Default()
	}
	raw, err := hyprctlJSON(ctx, "monitors")
	if err != nil {
		log.Warn("parallaxdriver hyprland: hyprctl monitors failed", "error", err)
		return nil, false
	}
	entries, err := parseHyprlandMonitorsJSON(raw)
	if err != nil {
		log.Warn("parallaxdriver hyprland: parse monitors json failed", "error", err)
		return nil, false
	}
	return entries, true
}

func hyprctlJSON(ctx context.Context, args ...string) ([]byte, error) {
	cctx, cancel := context.WithTimeout(ctx, 3*time.Second)
	defer cancel()
	cmd := exec.CommandContext(cctx, hyprctlBinary(), append([]string{"-j"}, args...)...)
	out, err := cmd.CombinedOutput()
	if err != nil {
		return nil, fmt.Errorf("hyprctl -j %v: %w: %s", args, err, strings.TrimSpace(string(out)))
	}
	return out, nil
}
