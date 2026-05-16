package wallpaper

import (
	"context"
	"encoding/json"
	"log/slog"
	"strings"

	"waypaper-engine/daemon/internal/backend"
	"waypaper-engine/daemon/internal/store"
	"waypaper-engine/daemon/internal/wallpaper/wallpaperconfig"
)

// MergedWallpaperConfigForImage merges manifest wallpaper_config defaults with stored overrides.
func MergedWallpaperConfigForImage(img *store.Image) json.RawMessage {
	if img == nil || img.WebMeta == nil {
		return []byte("{}")
	}
	raw, err := wallpaperconfig.MergeValues(img.WebMeta.WallpaperConfig, img.WallpaperConfigOverrides)
	if err != nil {
		slog.Warn("wallpaper config merge failed", "error", err)
		return []byte("{}")
	}
	return raw
}

// SyncWebImageToRenderer writes img's current web_meta capabilities and
// wallpaper_config_overrides to its manifest file and pushes both to the live
// renderer if one is registered. img must be a web-type image with non-nil WebMeta.
// Both sync paths run; individual failures are logged as warnings, not returned.
func SyncWebImageToRenderer(ctx context.Context, registry backend.Registry, img *store.Image) {
	if img == nil || !strings.EqualFold(strings.TrimSpace(img.MediaType), "web") || img.WebMeta == nil {
		return
	}

	// Sync wallpaper_config_overrides to manifest + renderer
	mp := strings.TrimSpace(img.WebMeta.ManifestPath)
	if mp != "" {
		if err := WriteWallpaperConfigOverridesToManifest(mp, img.WallpaperConfigOverrides); err != nil {
			slog.Warn("sync wallpaper_config_overrides to manifest failed", "image_id", img.ID, "error", err)
		}
	}
	if registry != nil {
		merged := MergedWallpaperConfigForImage(img)
		target := WebConfigPushSourceTarget(img)
		if err := PushWallpaperConfigToRenderer(ctx, registry, target, merged); err != nil {
			slog.Warn("push web wallpaper config to renderer failed", "image_id", img.ID, "error", err)
		}
	}

	// Sync capabilities to manifest + renderer
	if mp != "" {
		if err := WriteWebCapabilitiesToManifest(mp, img.WebMeta.Capabilities); err != nil {
			slog.Warn("sync web capabilities to manifest failed", "image_id", img.ID, "error", err)
		}
	}
	if registry != nil {
		capsJSON, mErr := json.Marshal(img.WebMeta.Capabilities)
		if mErr != nil {
			slog.Warn("marshal web capabilities for renderer push failed", "image_id", img.ID, "error", mErr)
		} else {
			target := WebConfigPushSourceTarget(img)
			if err := PushWebCapabilitiesToRenderer(ctx, registry, target, capsJSON); err != nil {
				slog.Warn("push web capabilities to renderer failed", "image_id", img.ID, "error", err)
			}
		}
	}
}
