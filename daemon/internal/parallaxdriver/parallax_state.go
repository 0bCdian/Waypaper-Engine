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
// per waypaper monitor so each output's parallax stays independent.
type workspaceParallaxAbsoluteState struct {
	byMonitor map[uint32]monitorParallaxState
}

type monitorParallaxState struct {
	lastSentTargetPercent float64
	lastActiveWSID        int
}

func (s *workspaceParallaxAbsoluteState) forMonitor(mon uint32) monitorParallaxState {
	if s.byMonitor == nil {
		return monitorParallaxState{}
	}
	return s.byMonitor[mon]
}

func (s *workspaceParallaxAbsoluteState) updateMonitor(mon uint32, st monitorParallaxState) {
	if s.byMonitor == nil {
		s.byMonitor = make(map[uint32]monitorParallaxState)
	}
	s.byMonitor[mon] = st
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
		monID, ok := resolve(ctx, e)
		if !ok {
			continue
		}
		monState := s.forMonitor(monID)
		if monState.lastActiveWSID == e.WorkspaceID {
			continue
		}
		target := workspaceTargetPercent(e.WorkspaceID, chunkSize)
		delta := target - monState.lastSentTargetPercent
		if math.Abs(delta) < 0.25 {
			monState.lastActiveWSID = e.WorkspaceID
			s.updateMonitor(monID, monState)
			continue
		}
		dir := directionForDelta(delta, vertical)
		if dir == "" {
			continue
		}
		mctx, cancel := context.WithTimeout(ctx, 2*time.Second)
		err := move(mctx, dir, math.Abs(delta), monID)
		cancel()
		if err != nil {
			log.Debug("parallaxdriver: parallax-move failed", "monitor", monID, "error", err)
			continue
		}
		monState.lastSentTargetPercent = target
		monState.lastActiveWSID = e.WorkspaceID
		s.updateMonitor(monID, monState)
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
