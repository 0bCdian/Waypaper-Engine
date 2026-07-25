package wallpaperhandler

import "waypaper-engine/daemon/internal/monitor"

// SetWallpaperResponse is the JSON body for POST /wallpaper/set.
type SetWallpaperResponse struct {
	Status  string              `json:"status"`
	ImageID int                 `json:"image_id"`
	Monitor string              `json:"monitor"`
	Mode    monitor.MonitorMode `json:"mode"`
}
