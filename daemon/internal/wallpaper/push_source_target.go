package wallpaper

import (
	"path/filepath"
	"strings"

	"waypaper-engine/daemon/internal/store"
)

// WebConfigPushSourceTarget returns the filesystem path used to match a running
// web wallpaper when pushing live config. It must align with wal-qt's
// monitor `current_source` (canonical entry HTML path). Prefer WebMeta.EntryPath
// and resolve symlinks so pushes succeed even when the DB path is not canonical.
func WebConfigPushSourceTarget(img *store.Image) string {
	if img == nil {
		return ""
	}
	p := strings.TrimSpace(img.Path)
	if img.WebMeta != nil {
		if ep := strings.TrimSpace(img.WebMeta.EntryPath); ep != "" {
			p = ep
		}
	}
	if p == "" {
		return ""
	}
	p = filepath.Clean(p)
	if resolved, err := filepath.EvalSymlinks(p); err == nil {
		return resolved
	}
	return p
}
