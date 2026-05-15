package hyprpaper

import (
	"context"

	"waypaper-engine/daemon/internal/backend"
	"waypaper-engine/daemon/internal/monitor"
)

// Apply implements backend.Backend by translating a Snapshot into a WallpaperRequest
// with IndividualTargets and delegating to SetWallpaper.
func (h *Hyprpaper) Apply(ctx context.Context, snap backend.Snapshot) error {
	if len(snap.Outputs) == 0 {
		return nil
	}
	targets := make([]backend.IndividualLoadTarget, 0, len(snap.Outputs))
	for _, o := range snap.Outputs {
		targets = append(targets, backend.IndividualLoadTarget{
			Monitor:   o.Monitor,
			Path:      o.Content.Path(),
			MediaType: backend.ContentToMediaType(o.Content),
		})
	}
	req := backend.WallpaperRequest{
		MediaType:         targets[0].MediaType,
		Mode:              monitor.ModeIndividual,
		IndividualTargets: targets,
	}
	return h.SetWallpaper(ctx, req)
}
