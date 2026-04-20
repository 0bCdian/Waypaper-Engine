package parallaxdriver

import (
	"context"
	"log/slog"
	"math"
	"time"
)

// workspaceTargetPercent maps a 1-based compositor workspace id into a normalized
// pan target within its chunk (Quickshell-style). chunkSize must be >= 1; ids <= 0
// (Hyprland scratchpad/special workspaces) return 0.
func workspaceTargetPercent(id, chunkSize int) float64 {
	if chunkSize < 1 || id <= 0 {
		return 0
	}
	lower := ((id - 1) / chunkSize) * chunkSize
	pos := float64(id-lower) / float64(chunkSize)
	return (pos - 0.5) * 100.0
}

// workspaceParallaxAbsoluteState tracks the last applied target and active workspace
// per compositor output name so each output's parallax stays independent.
type workspaceParallaxAbsoluteState struct {
	byOutput map[string]monitorParallaxState
}

type monitorParallaxState struct {
	lastSentTargetPercent float64
	lastActiveWSID        int
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

// tick processes all monitor entries and sends parallax-move for any that changed.
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
		outName, ok := resolve(ctx, e)
		if !ok || outName == "" {
			continue
		}
		outState := s.forOutput(outName)
		if outState.lastActiveWSID == e.WorkspaceID {
			continue
		}
		target := workspaceTargetPercent(e.WorkspaceID, chunkSize)
		delta := target - outState.lastSentTargetPercent
		if math.Abs(delta) < 0.25 {
			outState.lastActiveWSID = e.WorkspaceID
			s.updateOutput(outName, outState)
			continue
		}
		dir := directionForDelta(delta, vertical)
		if dir == "" {
			continue
		}
		mctx, cancel := context.WithTimeout(ctx, 2*time.Second)
		err := move(mctx, dir, math.Abs(delta), outName)
		cancel()
		if err != nil {
			log.Debug("parallaxdriver: parallax-move failed", "output", outName, "error", err)
			continue
		}
		outState.lastSentTargetPercent = target
		outState.lastActiveWSID = e.WorkspaceID
		s.updateOutput(outName, outState)
	}
}

func directionForDelta(delta float64, vertical bool) string {
	if vertical {
		if delta > 0 {
			return "down"
		}
		if delta < 0 {
			return "up"
		}
		return ""
	}
	if delta > 0 {
		return "right"
	}
	if delta < 0 {
		return "left"
	}
	return ""
}
