package wallpaper

import (
	"encoding/json"

	"waypaper-engine/daemon/internal/config"
)

// HistoryLimitFromCfg returns app.image_history_limit, or 0 (unlimited) when config is unreadable.
func HistoryLimitFromCfg(cfg config.ConfigManager) int {
	c, err := cfg.GetConfig()
	if err != nil || c == nil {
		return 0
	}
	return c.App.ImageHistoryLimit
}

// VideoAudioDefaultFromCfg reads the wal-qt backend's video_audio_default
// setting from the config manager. Returns false on any error.
func VideoAudioDefaultFromCfg(cfg config.ConfigManager) bool {
	raw, err := cfg.GetBackendConfig("wal-qt")
	if err != nil || len(raw) == 0 {
		return false
	}
	var v struct {
		VideoAudioDefault bool `json:"video_audio_default"`
	}
	if err := json.Unmarshal(raw, &v); err != nil {
		return false
	}
	return v.VideoAudioDefault
}
