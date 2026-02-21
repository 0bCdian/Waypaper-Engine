package wallpaper

import (
	"context"
	"fmt"
	"log/slog"
	"time"

	"waypaper-engine/daemon/internal/backend"
	"waypaper-engine/daemon/internal/events"
	"waypaper-engine/daemon/internal/image"
	"waypaper-engine/daemon/internal/monitor"
	"waypaper-engine/daemon/internal/store"
)

// ApplyOpts holds all dependencies and parameters needed to set a wallpaper.
type ApplyOpts struct {
	Image    *store.Image
	Monitors []monitor.Monitor
	Mode     monitor.MonitorMode
	Source   store.HistorySource
	Backend  backend.Backend
	Splitter *image.Splitter
	History  store.HistoryStore
	MonState store.MonitorStateStore
	State    store.StateStore
	Bus      events.Bus // nil = no event publish
}

// Apply is the core wallpaper-setting flow used by both the wallpaper handler
// and the playlist manager.
func Apply(ctx context.Context, opts ApplyOpts) error {
	caps := opts.Backend.Capabilities()

	if opts.Mode == monitor.ModeExtend && !caps.NativeExtend && opts.Splitter != nil && len(opts.Monitors) > 1 {
		splitPaths, err := opts.Splitter.Split(opts.Image.Path, opts.Image.ID, opts.Monitors)
		if err != nil {
			return fmt.Errorf("split image: %w", err)
		}

		for _, mon := range opts.Monitors {
			if splitPath, ok := splitPaths[mon.Name]; ok {
				req := backend.WallpaperRequest{
					ImagePath: splitPath,
					Monitors:  []monitor.Monitor{mon},
					Mode:      monitor.ModeIndividual,
				}
				if err := opts.Backend.SetWallpaper(ctx, req); err != nil {
					return fmt.Errorf("set wallpaper for %s: %w", mon.Name, err)
				}
			}
		}
	} else {
		req := backend.WallpaperRequest{
			ImagePath: opts.Image.Path,
			Monitors:  opts.Monitors,
			Mode:      opts.Mode,
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
