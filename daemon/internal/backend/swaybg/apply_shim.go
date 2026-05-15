package swaybg

import (
	"context"

	"waypaper-engine/daemon/internal/backend"
	"waypaper-engine/daemon/internal/monitor"
)

// Apply implements backend.Backend by translating a Snapshot into a WallpaperRequest
// and delegating to SetWallpaper. swaybg supports static images only.
// Multi-monitor differentiation is not supported by the shim (T7 fixes that).
func (s *Swaybg) Apply(ctx context.Context, snap backend.Snapshot) error {
	if len(snap.Outputs) == 0 {
		return nil
	}
	first := snap.Outputs[0]
	monitors := make([]monitor.Monitor, 0, len(snap.Outputs))
	for _, o := range snap.Outputs {
		monitors = append(monitors, o.Monitor)
	}
	req := backend.WallpaperRequest{
		MediaType: backend.ContentToMediaType(first.Content),
		ImagePath: first.Content.Path(),
		Monitors:  monitors,
		Mode:      monitor.ModeClone,
	}
	return s.SetWallpaper(ctx, req)
}
