package wallpaper

import (
	"strings"

	"waypaper-engine/daemon/internal/store"
)

// WebConfigPushSourceTarget identifies a running web wallpaper for live config
// pushes. It must stay byte-identical to the target sent in the last
// /wallpaper/load: wal-qt matches by string equality, so normalising it
// (filepath.Clean, EvalSymlinks) makes wal-qt silently drop the push.
func WebConfigPushSourceTarget(img *store.Image) string {
	if img == nil || img.WebMeta == nil {
		return ""
	}
	return strings.TrimSpace(img.WebMeta.ManifestPath)
}
