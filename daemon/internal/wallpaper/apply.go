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
//
// Flow: build prospective snapshot → backend.Apply → persist + history + SSE.
// On error: DB unchanged, SSE wallpaper_apply_failed.
func Apply(ctx context.Context, opts ApplyOpts) error {
	snap, err := buildApplySnapshot(ctx, opts)
	if err != nil {
		return err
	}

	if len(snap.Outputs) == 0 {
		return fmt.Errorf("no compatible outputs for the requested image and backend %s", opts.Backend.Name())
	}

	gateKey := opts.Backend.Name()
	applyCtx, ticket := defaultApplyGate.acquire(ctx, gateKey)
	defer defaultApplyGate.release(gateKey, ticket)

	if applyErr := opts.Backend.Apply(applyCtx, snap); applyErr != nil {
		if ticket.preempted.Load() {
			return ErrSuperseded
		}
		if opts.Bus != nil {
			opts.Bus.Publish(events.Event{
				Type: events.WallpaperApplyFailed,
				Data: map[string]any{
					"image_id": opts.Image.ID,
					"error":    applyErr.Error(),
					"backend":  opts.Backend.Name(),
				},
			})
		}
		return fmt.Errorf("backend apply: %w", applyErr)
	}

	// Success: persist monitor_state, append history, fire SSE.
	now := time.Now()
	monNames := make([]string, len(opts.Monitors))
	for i, mon := range opts.Monitors {
		monNames[i] = mon.Name
	}

	entry := store.ImageHistoryEntry{
		ImageID:   opts.Image.ID,
		ImageName: opts.Image.Name,
		Monitors:  monNames,
		Mode:      string(opts.Mode),
		SetAt:     now,
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
		data := map[string]any{
			"image_id":   opts.Image.ID,
			"media_type": sseWallpaperMediaType(opts.Image.MediaType),
			"path":       opts.Image.Path,
			"tags":       append([]string(nil), opts.Image.Tags...),
			"monitors":   monNames,
			"mode":       opts.Mode,
			"source":     opts.Source.Type,
			"backend":    opts.Backend.Name(),
		}
		if len(opts.Image.Colors) > 0 {
			data["colors"] = append([]string(nil), opts.Image.Colors...)
		}
		opts.Bus.Publish(events.Event{
			Type: events.WallpaperChanged,
			Data: data,
		})
	}

	return nil
}

// buildApplySnapshot builds the Snapshot for the Apply flow.
// The image is already resolved by the caller; no DB lookup or orphan detection needed.
func buildApplySnapshot(ctx context.Context, opts ApplyOpts) (backend.Snapshot, error) {
	img := opts.Image
	kind := mediaTypeToKind(img.MediaType)

	// Check backend capability.
	caps := opts.Backend.Capabilities()
	if !supportsKind(caps, kind) {
		return backend.Snapshot{}, fmt.Errorf("%w: kind=%s backend=%s",
			ErrContentKindUnsupported, kind, opts.Backend.Name())
	}

	// For extend mode with static images and multiple monitors, split the image.
	var splitPaths map[string]string
	isExtend := opts.Mode == monitor.ModeExtend
	if isExtend && kind == backend.KindStaticImage && len(opts.Monitors) > 1 && opts.Splitter != nil {
		var splitErr error
		splitPaths, splitErr = opts.Splitter.Split(img.Path, img.ID, opts.Monitors)
		if splitErr != nil {
			return backend.Snapshot{}, fmt.Errorf("split image: %w", splitErr)
		}
	}
	// Non-image extend degrades to clone (splitPaths remains nil).

	var snap backend.Snapshot
	for _, mon := range opts.Monitors {
		content, err := buildApplyContent(img, kind, mon, splitPaths, opts.VideoAudioDefault)
		if err != nil {
			return backend.Snapshot{}, err
		}
		snap.Outputs = append(snap.Outputs, backend.Output{
			Monitor: mon,
			Content: content,
		})
	}

	_ = ctx // reserved for future use
	return snap, nil
}

// buildApplyContent returns the Content for a single monitor in the Apply flow.
func buildApplyContent(img *store.Image, kind backend.ContentKind, mon monitor.Monitor, splitPaths map[string]string, videoAudioDefault bool) (backend.Content, error) {
	switch kind {
	case backend.KindStaticImage:
		path := img.Path
		if splitPaths != nil {
			if p, ok := splitPaths[mon.Name]; ok {
				path = p
			}
		}
		return backend.StaticImage{Path_: path}, nil

	case backend.KindGIF:
		return backend.GIF{Path_: img.Path}, nil

	case backend.KindVideo:
		return backend.Video{
			Path_:        img.Path,
			AudioEnabled: img.AudioEnabled && videoAudioDefault,
		}, nil

	case backend.KindWebWallpaper:
		if img.WebMeta == nil {
			return nil, fmt.Errorf("web wallpaper image %d has no web_meta", img.ID)
		}
		return backend.WebWallpaper{
			ManifestPath:      img.WebMeta.ManifestPath,
			PackageRoot:       img.WebMeta.PackageRoot,
			Config:            MergedWallpaperConfigForImage(img),
			ParallaxDirection: ParallaxDirectionOverrideFromImage(img),
		}, nil

	default:
		return nil, fmt.Errorf("unsupported content kind %s", kind)
	}
}

// sseWallpaperMediaType returns the SSE media_type string for wallpaper_changed events.
func sseWallpaperMediaType(mediaType string) string {
	switch mediaType {
	case "video":
		return "video"
	case "web":
		return "web"
	default:
		return "image"
	}
}
