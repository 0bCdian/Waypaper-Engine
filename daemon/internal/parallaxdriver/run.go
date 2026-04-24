package parallaxdriver

import (
	"context"
	"fmt"
	"log/slog"
)

// MonitorWorkspaceEntry represents one physical monitor and the workspace
// currently active on it.
type MonitorWorkspaceEntry struct {
	WorkspaceID int
	Bounds      Rect
	// OutputName is the compositor output name (e.g. Hyprland monitor "name"), matching
	// wal-utauri topology[].name. When set, the driver uses it directly instead of
	// geometry-based resolution (avoids GDK vs compositor coordinate mismatches).
	OutputName string
}

// ResolveMonitorFunc maps compositor monitor data to the compositor output name
// from GET /wallpaper/status topology (wal-utauri `name` field).
type ResolveMonitorFunc func(ctx context.Context, e MonitorWorkspaceEntry) (outputName string, ok bool)

// MoveFunc posts a relative parallax direction move (POST /wallpaper/parallax-move).
// direction is one of "left", "right", "up", "down"; outputName scopes the update.
type MoveFunc func(ctx context.Context, outputName, direction string) error

// RunOpts configures workspace → parallax direction bridging.
type RunOpts struct {
	Move MoveFunc
	// ResolveMonitor is optional when every MonitorWorkspaceEntry carries OutputName
	// (Hyprland/Sway paths); otherwise required for geometry-based fallback.
	ResolveMonitor ResolveMonitorFunc
	// ChunkSize is the number of workspace ids per chunk (>= 1).
	ChunkSize int
	// Vertical returns true when workspace parallax should use the Y axis.
	Vertical func() bool
}

// Run blocks until ctx is cancelled, forwarding workspace events as parallax-move calls.
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
