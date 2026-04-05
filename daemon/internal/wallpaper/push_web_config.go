package wallpaper

import (
	"context"
	"encoding/json"

	"waypaper-engine/daemon/internal/backend"
)

type waylandWebConfigPusher interface {
	PushWallpaperConfig(ctx context.Context, sourceTarget string, values json.RawMessage) error
	PushWebCapabilities(ctx context.Context, sourceTarget string, caps json.RawMessage) error
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

// PushWebCapabilitiesToRenderer updates in-memory web capabilities for running web wallpapers
// (e.g. audio_reactive) without reloading the page.
func PushWebCapabilitiesToRenderer(
	ctx context.Context,
	reg backend.Registry,
	sourceTarget string,
	caps json.RawMessage,
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
	return p.PushWebCapabilities(ctx, sourceTarget, caps)
}
