package wallpaper

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"strings"
	"time"

	"waypaper-engine/daemon/internal/backend"
	"waypaper-engine/daemon/internal/events"
	"waypaper-engine/daemon/internal/image"
	"waypaper-engine/daemon/internal/media"
	"waypaper-engine/daemon/internal/monitor"
	"waypaper-engine/daemon/internal/store"
	"waypaper-engine/daemon/internal/wallpaper/wallpaperconfig"
)

// ApplyOpts holds all dependencies and parameters needed to set a wallpaper.
type ApplyOpts struct {
	Image             *store.Image
	Monitors          []monitor.Monitor
	Mode              monitor.MonitorMode
	Source            store.HistorySource
	Backend           backend.Backend
	Splitter          *image.Splitter
	History           store.HistoryStore
	MonState          store.MonitorStateStore
	State             store.StateStore
	Bus               events.Bus // nil = no event publish
	VideoAudioDefault bool       // user preference: play audio for video wallpapers
}

// Apply is the core wallpaper-setting flow used by both the wallpaper handler
// and the playlist manager.
func Apply(ctx context.Context, opts ApplyOpts) error {
	mediaType := normalizeMediaType(opts.Image.MediaType)
	cfgVals := MergedWallpaperConfigForImage(opts.Image)

	switch {
	case opts.Mode == monitor.ModeExtend && mediaType != media.MediaTypeImage:
		// GIF / video / web: cannot engine-split; same wallpaper on each monitor (clone semantics).
		req := backend.WallpaperRequest{
			MediaType:             mediaType,
			ImagePath:             opts.Image.Path,
			AudioEnabled:          opts.Image.AudioEnabled && opts.VideoAudioDefault,
			Monitors:              opts.Monitors,
			Mode:                  monitor.ModeClone,
			WallpaperConfigValues: cfgVals,
			ParallaxDirection:     ParallaxDirectionOverrideFromImage(opts.Image),
		}
		if err := opts.Backend.SetWallpaper(ctx, req); err != nil {
			return fmt.Errorf("set wallpaper: %w", err)
		}

	case opts.Mode == monitor.ModeExtend && mediaType == media.MediaTypeImage && opts.Splitter != nil && len(opts.Monitors) > 1:
		splitPaths, err := opts.Splitter.Split(opts.Image.Path, opts.Image.ID, opts.Monitors)
		if err != nil {
			return fmt.Errorf("split image: %w", err)
		}

		for _, mon := range opts.Monitors {
			if splitPath, ok := splitPaths[mon.Name]; ok {
				req := backend.WallpaperRequest{
					MediaType:             mediaType,
					ImagePath:             splitPath,
					AudioEnabled:          opts.Image.AudioEnabled && opts.VideoAudioDefault,
					Monitors:              []monitor.Monitor{mon},
					Mode:                  monitor.ModeIndividual,
					WallpaperConfigValues: cfgVals,
					ParallaxDirection:     ParallaxDirectionOverrideFromImage(opts.Image),
				}
				if err := opts.Backend.SetWallpaper(ctx, req); err != nil {
					return fmt.Errorf("set wallpaper for %s: %w", mon.Name, err)
				}
			}
		}

	default:
		req := backend.WallpaperRequest{
			MediaType:             mediaType,
			ImagePath:             opts.Image.Path,
			AudioEnabled:          opts.Image.AudioEnabled && opts.VideoAudioDefault,
			Monitors:              opts.Monitors,
			Mode:                  opts.Mode,
			WallpaperConfigValues: cfgVals,
			ParallaxDirection:     ParallaxDirectionOverrideFromImage(opts.Image),
		}
		if err := opts.Backend.SetWallpaper(ctx, req); err != nil {
			return fmt.Errorf("set wallpaper: %w", err)
		}
	}

	monNames := make([]string, len(opts.Monitors))
	for i, mon := range opts.Monitors {
		monNames[i] = mon.Name
	}

	entry := store.ImageHistoryEntry{
		ImageID:   opts.Image.ID,
		ImageName: opts.Image.Name,
		Monitors:  monNames,
		Mode:      string(opts.Mode),
		SetAt:     time.Now(),
		Source:    opts.Source,
		Backend:   opts.Backend.Name(),
	}

	if _, err := opts.History.Append(ctx, entry); err != nil {
		slog.Warn("failed to record history", "error", err)
	}

	for _, mon := range opts.Monitors {
		opts.State.SetCurrentWallpaper(mon.Name, entry)

		// Persist user-selected mode even when the backend call used clone (extend + non-static) or per-monitor crops.
		if err := opts.MonState.Set(ctx, store.MonitorState{
			MonitorName: mon.Name,
			ImageID:     opts.Image.ID,
			ImageName:   opts.Image.Name,
			ImagePath:   opts.Image.Path,
			Mode:        string(opts.Mode),
			Backend:     opts.Backend.Name(),
			SetAt:       entry.SetAt,
		}); err != nil {
			slog.Warn("failed to persist monitor state", "monitor", mon.Name, "error", err)
		}
	}

	if opts.Bus != nil {
		opts.Bus.Publish(events.Event{
			Type: events.WallpaperChanged,
			Data: map[string]any{
				"image_id": opts.Image.ID,
				"monitors": monNames,
				"mode":     opts.Mode,
				"source":   opts.Source.Type,
				"backend":  opts.Backend.Name(),
			},
		})
	}

	return nil
}

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

func normalizeMediaType(value string) media.MediaType {
	switch strings.ToLower(strings.TrimSpace(value)) {
	case string(media.MediaTypeGIF):
		return media.MediaTypeGIF
	case string(media.MediaTypeVideo):
		return media.MediaTypeVideo
	case string(media.MediaTypeWeb):
		return media.MediaTypeWeb
	default:
		return media.MediaTypeImage
	}
}
