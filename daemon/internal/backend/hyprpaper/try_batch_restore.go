package hyprpaper

import (
	"context"
	"strings"

	"waypaper-engine/daemon/internal/backend"
	"waypaper-engine/daemon/internal/media"
	"waypaper-engine/daemon/internal/monitor"
	"waypaper-engine/daemon/internal/store"
)

// TryBatchRestore implements wallpaper.batchRestorer. hyprpaper writes a single
// hyprpaper.conf that lists every output; each SetWallpaper replaces the whole
// file, so per-monitor restore must be merged into one request.
//
// Unlike wal-qt, hyprpaper has no per-image parallax or wallpaper config — those
// are irrelevant here. We batch whenever all states are individual-mode, connected,
// and of a supported media type.
func (h *Hyprpaper) TryBatchRestore(
	ctx context.Context,
	states []store.MonitorState,
	connected map[string]monitor.Monitor,
	images store.ImageStore,
) (*backend.WallpaperRequest, []store.MonitorState, []media.MediaType, bool) {
	if len(states) < 2 {
		return nil, nil, nil, false
	}

	targets := make([]backend.IndividualLoadTarget, 0, len(states))
	statesOut := make([]store.MonitorState, 0, len(states))
	mediaTypesOut := make([]media.MediaType, 0, len(states))

	for _, state := range states {
		if monitor.MonitorMode(state.Mode) != monitor.ModeIndividual {
			return nil, nil, nil, false
		}
		mon, ok := connected[state.MonitorName]
		if !ok {
			return nil, nil, nil, false
		}

		mt := media.MediaTypeImage
		if img, err := images.GetByID(ctx, state.ImageID); err == nil && img != nil {
			mt = hyprBatchRestoreNormalizeMediaType(img.MediaType)
		}
		if mt != media.MediaTypeImage && mt != media.MediaTypeGIF {
			return nil, nil, nil, false
		}

		targets = append(targets, backend.IndividualLoadTarget{
			Monitor:   mon,
			Path:      state.ImagePath,
			MediaType: mt,
		})
		statesOut = append(statesOut, state)
		mediaTypesOut = append(mediaTypesOut, mt)
	}

	req := &backend.WallpaperRequest{
		MediaType:         media.MediaTypeImage,
		Mode:              monitor.ModeIndividual,
		IndividualTargets: targets,
		WaitForCompletion: true,
		AudioEnabled:      false,
	}
	return req, statesOut, mediaTypesOut, true
}

func hyprBatchRestoreNormalizeMediaType(value string) media.MediaType {
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
