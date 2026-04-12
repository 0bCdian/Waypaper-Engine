package handler

import (
	"cmp"
	"slices"
	"time"

	"waypaper-engine/daemon/internal/store"
)

// WallpaperCurrentSlot is one monitor in GET /wallpaper/current.
type WallpaperCurrentSlot struct {
	MonitorName string    `json:"monitor_name"`
	ImageID     int       `json:"image_id"`
	ImageName   string    `json:"image_name"`
	ImagePath   string    `json:"image_path"`
	SetAt       time.Time `json:"set_at"`
}

// WallpaperCurrentResponse is the JSON body for GET /wallpaper/current.
// It reflects persisted state for the active backend only (not other backends'
// stale monitor_state rows). When connectedNames is non-empty, only rows whose
// monitor_name appears in that set are included (drops orphaned keys from old
// detection schemes, e.g. "Monitor 0" vs "DP-1").
type WallpaperCurrentResponse struct {
	Backend   string                 `json:"backend"`
	ImageID   int                    `json:"image_id"`
	ImageName string                 `json:"image_name"`
	ImagePath string                 `json:"image_path"`
	Mode      string                 `json:"mode"`
	Monitors  []WallpaperCurrentSlot `json:"monitors"`
	SetAt     time.Time              `json:"set_at,omitempty"`
}

func buildWallpaperCurrentResponse(
	activeBackend string,
	states []store.MonitorState,
	connectedNames map[string]struct{},
) WallpaperCurrentResponse {
	resp := WallpaperCurrentResponse{Backend: activeBackend}
	if len(states) == 0 {
		return resp
	}
	filterByConnected := len(connectedNames) > 0
	filtered := make([]store.MonitorState, 0, len(states))
	for _, st := range states {
		if st.Backend != activeBackend {
			continue
		}
		if filterByConnected {
			if _, ok := connectedNames[st.MonitorName]; !ok {
				continue
			}
		}
		filtered = append(filtered, st)
	}
	if len(filtered) == 0 {
		return resp
	}
	slices.SortFunc(filtered, func(a, b store.MonitorState) int {
		return cmp.Compare(a.MonitorName, b.MonitorName)
	})
	resp.Monitors = make([]WallpaperCurrentSlot, 0, len(filtered))
	for _, st := range filtered {
		resp.Monitors = append(resp.Monitors, WallpaperCurrentSlot{
			MonitorName: st.MonitorName,
			ImageID:     st.ImageID,
			ImageName:   st.ImageName,
			ImagePath:   st.ImagePath,
			SetAt:       st.SetAt,
		})
	}
	primary := pickPrimaryMonitorState(filtered)
	resp.ImageID = primary.ImageID
	resp.ImageName = primary.ImageName
	resp.ImagePath = primary.ImagePath
	resp.Mode = primary.Mode
	resp.SetAt = primary.SetAt
	return resp
}

func pickPrimaryMonitorState(states []store.MonitorState) store.MonitorState {
	best := states[0]
	for _, st := range states[1:] {
		if st.SetAt.After(best.SetAt) {
			best = st
		} else if st.SetAt.Equal(best.SetAt) && st.MonitorName < best.MonitorName {
			best = st
		}
	}
	return best
}
