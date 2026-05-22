package wallpaper

import (
	"strings"

	"waypaper-engine/daemon/internal/store"
)

// WebConfigPushSourceTarget returns the filesystem path used to match a running web
// wallpaper when pushing live config or capability updates.
//
// Contract: must equal the `target` string the daemon sent in the most recent
// /wallpaper/load request, because wal-qt stores that string verbatim as
// `current_target` and `decodeBySourceSelector` matches via string equality
// (see wal-qt openapi/wal-qt.yaml WallpaperConfigRequest.source_target).
//
// The load path uses WebWallpaper.Path() = WebMeta.ManifestPath unmodified
// (daemon/internal/backend/walqt/mapping.go + daemon/internal/wallpaper/apply.go),
// so we return the same — no EvalSymlinks, no filepath.Clean. Returning a
// different normalization (e.g. the resolved EntryPath) makes wal-qt silently
// drop the push, which is what caused "save in sidebar doesn't apply until
// the wallpaper is reset".
func WebConfigPushSourceTarget(img *store.Image) string {
	if img == nil || img.WebMeta == nil {
		return ""
	}
	return strings.TrimSpace(img.WebMeta.ManifestPath)
}
