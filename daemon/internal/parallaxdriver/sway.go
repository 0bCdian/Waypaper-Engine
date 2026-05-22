package parallaxdriver

import (
	"bufio"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log/slog"
	"os/exec"
	"time"
)

// RunSway uses `swaymsg -t subscribe` when possible; otherwise polls get_workspaces.
func RunSway(ctx context.Context, opts RunOpts, log *slog.Logger) error {
	if log == nil {
		log = slog.Default()
	}
	if err := runSwaySubscribe(ctx, opts, log); err != nil {
		if ctx.Err() != nil {
			return ctx.Err()
		}
		log.Debug("parallaxdriver sway: subscribe unavailable, using poll", "error", err)
		return runSwayPoll(ctx, opts, log, 50*time.Millisecond)
	}
	return nil
}

func doSwayTick(ctx context.Context, st *workspaceParallaxAbsoluteState, opts RunOpts, log *slog.Logger) {
	tickCtx, cancel := context.WithTimeout(ctx, 600*time.Millisecond)
	defer cancel()
	entries, ok := swayAllOutputWorkspaces(tickCtx)
	if !ok {
		return
	}
	vert := opts.Vertical != nil && opts.Vertical()
	st.tick(tickCtx, entries, opts.Move, opts.ResolveMonitor, opts.ExpandMoveTargets, vert, opts.ChunkSize, log)
}

func runSwaySubscribe(ctx context.Context, opts RunOpts, log *slog.Logger) error {
	cmd := exec.CommandContext(ctx, "swaymsg", "-t", "subscribe", "[\"workspace\"]")
	stdout, err := cmd.StdoutPipe()
	if err != nil {
		return err
	}
	if err := cmd.Start(); err != nil {
		return err
	}

	st := &workspaceParallaxAbsoluteState{}
	doSwayTick(ctx, st, opts, log)

	scanner := bufio.NewScanner(stdout)
	buf := make([]byte, 0, 64*1024)
	scanner.Buffer(buf, 1024*1024)

	for scanner.Scan() {
		line := scanner.Bytes()
		var ev struct {
			Change  string `json:"change"`
			Current *struct {
				Type string `json:"type"`
			} `json:"current"`
		}
		if err := json.Unmarshal(line, &ev); err != nil {
			continue
		}
		if ev.Change != "focus" || ev.Current == nil || ev.Current.Type != "workspace" {
			continue
		}
		doSwayTick(ctx, st, opts, log)
	}

	scanErr := scanner.Err()
	waitErr := cmd.Wait()
	if ctx.Err() != nil {
		return ctx.Err()
	}
	if scanErr != nil {
		return fmt.Errorf("sway subscribe scan: %w", scanErr)
	}
	if waitErr != nil && !errors.Is(waitErr, context.Canceled) {
		return fmt.Errorf("sway subscribe: %w", waitErr)
	}
	return errors.New("sway subscribe: stream closed")
}

func runSwayPoll(ctx context.Context, opts RunOpts, log *slog.Logger, every time.Duration) error {
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
			doSwayTick(ctx, st, opts, log)
		}
	}
}

// swayAllOutputWorkspaces returns an entry for every Sway output with its
// focused workspace and geometry.
func swayAllOutputWorkspaces(ctx context.Context) ([]MonitorWorkspaceEntry, bool) {
	rawOutputs, err := swaymsgJSON(ctx, "get_outputs")
	if err != nil {
		return nil, false
	}
	var outputs []struct {
		Name string   `json:"name"`
		Rect swayRect `json:"rect"`
	}
	if err := json.Unmarshal(rawOutputs, &outputs); err != nil {
		return nil, false
	}

	rawWS, err := swaymsgJSON(ctx, "get_workspaces")
	if err != nil {
		return nil, false
	}
	var workspaces []struct {
		ID      int    `json:"id"`
		Num     *int   `json:"num"`
		Output  string `json:"output"`
		Visible bool   `json:"visible"`
	}
	if err := json.Unmarshal(rawWS, &workspaces); err != nil {
		return nil, false
	}

	// One visible workspace per output (not `focused`: only one workspace is
	// globally focused, so other outputs would be missing from the map).
	activePerOutput := make(map[string]int, len(outputs))
	for _, w := range workspaces {
		if !w.Visible || w.Output == "" {
			continue
		}
		activePerOutput[w.Output] = swayParallaxKey(w.ID, w.Num)
	}

	entries := make([]MonitorWorkspaceEntry, 0, len(outputs))
	for _, o := range outputs {
		if o.Rect.Width <= 0 || o.Rect.Height <= 0 {
			continue
		}
		wsID, ok := activePerOutput[o.Name]
		if !ok {
			continue
		}
		entries = append(entries, MonitorWorkspaceEntry{
			WorkspaceID: wsID,
			Bounds: Rect{
				X: o.Rect.X, Y: o.Rect.Y,
				Width: o.Rect.Width, Height: o.Rect.Height,
			},
			OutputName: o.Name,
		})
	}
	return entries, len(entries) > 0
}

// swayParallaxKey maps Sway get_workspaces fields to a value comparable across
// switches. Internal container `id` is not ordered by workspace position;
// `num` is the logical number (1, 2, …) when set, else -1 for name-only
// workspaces — then we fall back to `id`.
func swayParallaxKey(id int, num *int) int {
	if num != nil && *num != -1 {
		return *num
	}
	return id
}

func swaymsgJSON(ctx context.Context, msgType string) ([]byte, error) {
	cctx, cancel := context.WithTimeout(ctx, 3*time.Second)
	defer cancel()
	return exec.CommandContext(cctx, "swaymsg", "-t", msgType).Output()
}

type swayRect struct {
	X      float64 `json:"x"`
	Y      float64 `json:"y"`
	Width  float64 `json:"width"`
	Height float64 `json:"height"`
}
