package wallpaper

import (
	"encoding/json"
	"os"
	"path/filepath"
	"strings"
)

// WriteWallpaperConfigOverridesToManifest updates or removes the top-level
// `wallpaper_config_overrides` key in a waypaper.json (or project.json) file.
// Other keys are preserved; JSON key order may change on write.
func WriteWallpaperConfigOverridesToManifest(manifestPath string, overrides []byte) error {
	manifestPath = filepath.Clean(strings.TrimSpace(manifestPath))
	if manifestPath == "" || manifestPath == "." {
		return nil
	}
	raw, err := os.ReadFile(manifestPath)
	if err != nil {
		return err
	}

	var root map[string]any
	if err := json.Unmarshal(raw, &root); err != nil {
		return err
	}
	if root == nil {
		root = make(map[string]any)
	}

	trimmed := strings.TrimSpace(string(overrides))
	if len(trimmed) == 0 || trimmed == "null" || trimmed == "{}" {
		delete(root, "wallpaper_config_overrides")
	} else {
		var ov map[string]any
		if err := json.Unmarshal(overrides, &ov); err != nil {
			return err
		}
		if len(ov) == 0 {
			delete(root, "wallpaper_config_overrides")
		} else {
			root["wallpaper_config_overrides"] = ov
		}
	}

	out, err := json.MarshalIndent(root, "", "  ")
	if err != nil {
		return err
	}
	out = append(out, '\n')
	return os.WriteFile(manifestPath, out, 0o644)
}
