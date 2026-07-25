package wallpaperhandler

import "waypaper-engine/daemon/internal/monitor"

// RandomWallpaperResponse is the JSON body for POST /wallpaper/random.
type RandomWallpaperResponse struct {
	Status  string              `json:"status"`
	ImageID int                 `json:"image_id"`
	Monitor string              `json:"monitor"`
	Mode    monitor.MonitorMode `json:"mode"`
}
