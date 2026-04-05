package parallaxdriver

import (
	"context"
	"fmt"
	"log/slog"
)

// MonitorWorkspaceEntry represents one physical monitor and the workspace
// currently active on it.
type MonitorWorkspaceEntry struct {
	WorkspaceID     int
	Bounds          Rect
	CompositorMonID *int
}

// ResolveMonitorFunc maps compositor monitor data to the waypaper-tauri monitor id
// from GET /wallpaper/status topology.
type ResolveMonitorFunc func(ctx context.Context, e MonitorWorkspaceEntry) (monitorID uint32, ok bool)

// MoveFunc posts one parallax move (POST /wallpaper/parallax-move). amountPercent
// overrides the renderer default step when non-zero; the compositor driver always
// passes the absolute delta toward the chunk target. monitor is the waypaper index
// so only that output's wallpaper pans.
type MoveFunc func(ctx context.Context, direction string, amountPercent float64, monitor uint32) error

// RunOpts configures workspace -> parallax-move bridging.
type RunOpts struct {
	Move           MoveFunc
	ResolveMonitor ResolveMonitorFunc
	// ChunkSize is the number of workspace ids per chunk (>= 1). Targets are
	// normalized within each chunk like Quickshell.
	ChunkSize int
	// Vertical returns true when workspace parallax should use the Y axis.
	Vertical func() bool
}

// Run blocks until ctx is cancelled, forwarding workspace events as parallax-move nudges.
func Run(ctx context.Context, kind Kind, opts RunOpts, log *slog.Logger) error {
	if kind == None {
		return nil
	}
	if opts.Move == nil {
		return nil
	}
	if opts.ChunkSize < 1 {
		return fmt.Errorf("parallaxdriver: ChunkSize must be >= 1, got %d", opts.ChunkSize)
	}
	if opts.ResolveMonitor == nil {
		return fmt.Errorf("parallaxdriver: ResolveMonitor is required when Move is set")
	}
	optsCopy := opts
	if optsCopy.Vertical == nil {
		optsCopy.Vertical = func() bool { return false }
	}
	switch kind {
	case Hyprland:
		return RunHyprland(ctx, optsCopy, log)
	case Sway:
		return RunSway(ctx, optsCopy, log)
	default:
		return nil
	}
}
