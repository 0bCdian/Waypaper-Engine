package walqt

import (
	"context"

	"waypaper-engine/daemon/internal/backend"
	"waypaper-engine/daemon/internal/monitor"
)

// Apply implements backend.Backend by translating a Snapshot into a WallpaperRequest
// with IndividualTargets and delegating to SetWallpaper.
// Web wallpapers propagate their config and parallax direction from the Content.
func (w *WalQt) Apply(ctx context.Context, snap backend.Snapshot) error {
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

	first := snap.Outputs[0]
	req := backend.WallpaperRequest{
		MediaType:         targets[0].MediaType,
		Mode:              monitor.ModeIndividual,
		IndividualTargets: targets,
	}

	// Propagate web-specific fields from the first output's content.
	if web, ok := first.Content.(backend.WebWallpaper); ok {
		req.WallpaperConfigValues = web.Config
		req.ParallaxDirection = web.ParallaxDirection
	}

	// Propagate audio flag from the first output's video content.
	if vid, ok := first.Content.(backend.Video); ok {
		req.AudioEnabled = vid.AudioEnabled
	}

	return w.SetWallpaper(ctx, req)
}
