package wallpaper

import (
	"context"
	"encoding/json"

	"waypaper-engine/daemon/internal/backend"
)

type waylandWebConfigPusher interface {
	PushWallpaperConfig(ctx context.Context, sourceTarget string, values json.RawMessage) error
}

// PushWallpaperConfigToRenderer forwards merged web wallpaper config to wayland-utauri when active.
func PushWallpaperConfigToRenderer(
	ctx context.Context,
	reg backend.Registry,
	sourceTarget string,
	values json.RawMessage,
) error {
	if reg == nil || sourceTarget == "" {
		return nil
	}
	b := reg.Active()
	if b.Name() != "wayland-utauri" {
		return nil
	}
	p, ok := b.(waylandWebConfigPusher)
	if !ok {
		return nil
	}
	return p.PushWallpaperConfig(ctx, sourceTarget, values)
}
