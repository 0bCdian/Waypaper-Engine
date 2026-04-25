package wallpaper

import (
	"encoding/json"

	"waypaper-engine/daemon/internal/config"
)

// VideoAudioDefaultFromCfg reads the waylandutauri backend's video_audio_default
// setting from the config manager. Returns false on any error.
func VideoAudioDefaultFromCfg(cfg config.ConfigManager) bool {
	raw, err := cfg.GetBackendConfig("waylandutauri")
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
