package parallaxdriver

import (
	"context"
	"log/slog"
	"strings"
	"time"
)

// resolveDirection maps a workspace-id transition to a parallax move direction.
// It treats workspace IDs as positions on a chunked ring (matching the bash script).
// Returns "" when there is no movement or when lastID is 0 (first-tick sentinel).
func resolveDirection(lastID, nextID, chunkSize int, vertical bool) string {
	if lastID == 0 || lastID == nextID {
		return ""
	}
	delta := nextID - lastID
	absDelta := delta
	if absDelta < 0 {
		absDelta = -absDelta
	}
	halfChunk := chunkSize / 2

	var forward bool
	if absDelta > halfChunk {
		// wrap — large delta means we crossed a chunk boundary in the opposite sense
		forward = delta < 0
	} else {
		forward = delta > 0
	}

	if vertical {
		if forward {
			return "down"
		}
		return "up"
	}
	if forward {
		return "right"
	}
	return "left"
}

// workspaceParallaxAbsoluteState tracks the last active workspace per compositor output
// name so each output's parallax stays independent.
type workspaceParallaxAbsoluteState struct {
	byOutput map[string]monitorParallaxState
}

type monitorParallaxState struct {
	lastActiveWSID int
}

func (s *workspaceParallaxAbsoluteState) forOutput(name string) monitorParallaxState {
	if s.byOutput == nil {
		return monitorParallaxState{}
	}
	return s.byOutput[name]
}

func (s *workspaceParallaxAbsoluteState) updateOutput(name string, st monitorParallaxState) {
	if s.byOutput == nil {
		s.byOutput = make(map[string]monitorParallaxState)
	}
	s.byOutput[name] = st
}

// tick processes all monitor entries and POSTs a direction move when the active
// workspace changes for that output.
func (s *workspaceParallaxAbsoluteState) tick(
	ctx context.Context,
	entries []MonitorWorkspaceEntry,
	move MoveFunc,
	resolve ResolveMonitorFunc,
	vertical bool,
	chunkSize int,
	log *slog.Logger,
) {
	if log == nil {
		log = slog.Default()
	}
	for _, e := range entries {
		if e.WorkspaceID <= 0 {
			continue
		}
		outName, ok := outputNameForEntry(ctx, e, resolve)
		if !ok || outName == "" {
			continue
		}
		outState := s.forOutput(outName)
		direction := resolveDirection(outState.lastActiveWSID, e.WorkspaceID, chunkSize, vertical)
		// Always update lastActiveWSID, even on first tick (direction == "").
		if outState.lastActiveWSID != e.WorkspaceID {
			outState.lastActiveWSID = e.WorkspaceID
			s.updateOutput(outName, outState)
		}
		if direction == "" {
			continue
		}
		mctx, cancel := context.WithTimeout(ctx, 2*time.Second)
		err := move(mctx, outName, direction)
		cancel()
		if err != nil {
			log.Warn("parallaxdriver: parallax-move failed", "output", outName, "direction", direction, "error", err)
		}
	}
}

func outputNameForEntry(ctx context.Context, e MonitorWorkspaceEntry, resolve ResolveMonitorFunc) (string, bool) {
	if n := strings.TrimSpace(e.OutputName); n != "" {
		return n, true
	}
	if resolve == nil {
		return "", false
	}
	return resolve(ctx, e)
}
