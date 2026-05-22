package wallpaper

import (
	"encoding/json"
	"os"
	"strings"

	"waypaper-engine/daemon/internal/store"
)

type manifestParallaxStub struct {
	ParallaxDirection string `json:"parallax_direction"`
}

// ParallaxDirectionOverrideFromImage reads waypaper.json on disk and returns "horizontal" or "vertical"
// when set. Empty string means the app default (backend parallax_direction) applies.
func ParallaxDirectionOverrideFromImage(img *store.Image) string {
	if img == nil || img.WebMeta == nil {
		return ""
	}
	p := strings.TrimSpace(img.WebMeta.ManifestPath)
	if p == "" {
		return ""
	}
	raw, err := os.ReadFile(p)
	if err != nil {
		return ""
	}
	var m manifestParallaxStub
	if err := json.Unmarshal(raw, &m); err != nil {
		return ""
	}
	s := strings.ToLower(strings.TrimSpace(m.ParallaxDirection))
	switch s {
	case "vertical", "horizontal":
		return s
	default:
		return ""
	}
}
