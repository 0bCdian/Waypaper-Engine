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
	lastSentTargetPercent map[uint32]float64
	lastActiveWSPerMon    map[uint32]int
}

func (s *workspaceParallaxAbsoluteState) lastSent(mon uint32) float64 {
	if s.lastSentTargetPercent == nil {
		return 0
	}
	return s.lastSentTargetPercent[mon]
}

func (s *workspaceParallaxAbsoluteState) setLastSent(mon uint32, target float64) {
	if s.lastSentTargetPercent == nil {
		s.lastSentTargetPercent = make(map[uint32]float64)
	}
	s.lastSentTargetPercent[mon] = target
}

func (s *workspaceParallaxAbsoluteState) lastWS(mon uint32) int {
	if s.lastActiveWSPerMon == nil {
		return 0
	}
	return s.lastActiveWSPerMon[mon]
}

func (s *workspaceParallaxAbsoluteState) setLastWS(mon uint32, wsID int) {
	if s.lastActiveWSPerMon == nil {
		s.lastActiveWSPerMon = make(map[uint32]int)
	}
	s.lastActiveWSPerMon[mon] = wsID
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
		if s.lastWS(monID) == e.WorkspaceID {
			continue
		}
		target := workspaceTargetPercent(e.WorkspaceID, chunkSize)
		delta := target - s.lastSent(monID)
		if math.Abs(delta) < 0.25 {
			s.setLastWS(monID, e.WorkspaceID)
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
		s.setLastSent(monID, target)
		s.setLastWS(monID, e.WorkspaceID)
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
