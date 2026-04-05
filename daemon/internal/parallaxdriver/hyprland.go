package parallaxdriver

import (
	"context"
	"encoding/json"
	"log/slog"
	"os/exec"
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
			entries, ok := hyprlandAllMonitorWorkspaces(tickCtx)
			if ok {
				vert := opts.Vertical != nil && opts.Vertical()
				st.tick(tickCtx, entries, opts.Move, opts.ResolveMonitor, vert, opts.ChunkSize, log)
			}
			cancel()
		}
	}
}

// hyprlandAllMonitorWorkspaces returns an entry for every connected Hyprland monitor
// with its active workspace id, geometry, and compositor monitor index.
func hyprlandAllMonitorWorkspaces(ctx context.Context) ([]MonitorWorkspaceEntry, bool) {
	raw, err := hyprctlJSON(ctx, "monitors")
	if err != nil {
		return nil, false
	}
	var mons []struct {
		ID              int     `json:"id"`
		Name            string  `json:"name"`
		X               float64 `json:"x"`
		Y               float64 `json:"y"`
		Width           float64 `json:"width"`
		Height          float64 `json:"height"`
		ActiveWorkspace struct {
			ID int `json:"id"`
		} `json:"activeWorkspace"`
	}
	if err := json.Unmarshal(raw, &mons); err != nil {
		return nil, false
	}
	if len(mons) == 0 {
		return nil, false
	}
	entries := make([]MonitorWorkspaceEntry, 0, len(mons))
	for _, m := range mons {
		if m.Width <= 0 || m.Height <= 0 {
			continue
		}
		mid := m.ID
		entries = append(entries, MonitorWorkspaceEntry{
			WorkspaceID:     m.ActiveWorkspace.ID,
			Bounds:          Rect{X: m.X, Y: m.Y, Width: m.Width, Height: m.Height},
			CompositorMonID: &mid,
		})
	}
	return entries, len(entries) > 0
}

func hyprctlJSON(ctx context.Context, args ...string) ([]byte, error) {
	cctx, cancel := context.WithTimeout(ctx, 3*time.Second)
	defer cancel()
	cmd := exec.CommandContext(cctx, "hyprctl", append([]string{"-j"}, args...)...)
	return cmd.Output()
}
