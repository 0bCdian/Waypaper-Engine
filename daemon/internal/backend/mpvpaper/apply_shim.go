package mpvpaper

import (
	"context"

	"waypaper-engine/daemon/internal/backend"
	"waypaper-engine/daemon/internal/monitor"
)

// Apply implements backend.Backend by translating a Snapshot into a WallpaperRequest
// and delegating to SetWallpaper. mpvpaper supports video only.
// Multi-monitor differentiation is not supported by the shim (T9 fixes that).
func (m *Mpvpaper) Apply(ctx context.Context, snap backend.Snapshot) error {
	if len(snap.Outputs) == 0 {
		return nil
	}
	first := snap.Outputs[0]
	monitors := make([]monitor.Monitor, 0, len(snap.Outputs))
	for _, o := range snap.Outputs {
		monitors = append(monitors, o.Monitor)
	}
	audioEnabled := false
	if v, ok := first.Content.(backend.Video); ok {
		audioEnabled = v.AudioEnabled
	}
	req := backend.WallpaperRequest{
		MediaType:    backend.ContentToMediaType(first.Content),
		ImagePath:    first.Content.Path(),
		Monitors:     monitors,
		Mode:         monitor.ModeClone,
		AudioEnabled: audioEnabled,
	}
	return m.SetWallpaper(ctx, req)
}
