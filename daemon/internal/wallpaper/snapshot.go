package wallpaper

import (
	"context"
	"errors"
	"os"

	"waypaper-engine/daemon/internal/backend"
	"waypaper-engine/daemon/internal/events"
	"waypaper-engine/daemon/internal/image"
	"waypaper-engine/daemon/internal/monitor"
	"waypaper-engine/daemon/internal/store"
	"waypaper-engine/daemon/internal/wallpaper/wallpaperconfig"
)

// SkipKind classifies why a monitor row was excluded from a Snapshot.
type SkipKind string

const (
	SkipMonitorDisconnected SkipKind = "monitor_disconnected"
	SkipImageMissing        SkipKind = "image_missing" // db row gone or file gone
	SkipManifestUnreadable  SkipKind = "manifest_unreadable"
	SkipSplitFailed         SkipKind = "split_failed"
	SkipKindUnsupported     SkipKind = "content_kind_unsupported"
)

// SkipReason records why a specific monitor row was excluded from the Snapshot.
type SkipReason struct {
	MonitorName string
	ImageID     int // 0 if unknown
	Kind        SkipKind
	Detail      string
}

// assignment groups monitor_state rows that share the same image and mode.
type assignment struct {
	imageID int
	mode    string // raw string from MonitorState.Mode
	rows    []store.MonitorState
}

// mediaTypeToKind maps Image.MediaType strings to ContentKind.
func mediaTypeToKind(mediaType string) backend.ContentKind {
	switch mediaType {
	case "gif":
		return backend.KindGIF
	case "video":
		return backend.KindVideo
	case "web":
		return backend.KindWebWallpaper
	default:
		return backend.KindStaticImage
	}
}

// supportsKind reports whether the backend capabilities include the given kind.
func supportsKind(caps backend.Capabilities, kind backend.ContentKind) bool {
	for _, k := range caps.ContentKinds {
		if k == kind {
			return true
		}
	}
	return false
}

// BuildSnapshot maps persisted monitor_state rows to a backend.Snapshot.
//
// Disconnected monitors, missing images, unsupported content kinds, and split
// failures are recorded in the returned []SkipReason rather than surfaced as
// errors. The error return is reserved for infrastructure failures (e.g. the
// image store is unreachable).
//
// When an image is found to be orphaned (DB row missing or file missing),
// PurgeImageReferences is called exactly once per unique imageID and an
// ImageOrphanPurged event is published on bus.
func BuildSnapshot(
	ctx context.Context,
	states []store.MonitorState,
	connected map[string]monitor.Monitor,
	images store.ImageStore,
	splitter *image.Splitter,
	activeBackend backend.Backend,
	monStateStore store.MonitorStateStore,
	historyStore store.HistoryStore,
	playlistStore store.PlaylistStore,
	bus events.Bus,
	videoAudioDefault bool,
) (backend.Snapshot, []SkipReason, error) {
	// --- Step 1: group rows by (image_id, mode) ---
	type assignKey struct {
		imageID int
		mode    string
	}
	order := make([]assignKey, 0, len(states))
	seen := make(map[assignKey]int) // key → index into assignments
	assignments := make([]assignment, 0)

	for _, s := range states {
		k := assignKey{imageID: s.ImageID, mode: s.Mode}
		idx, exists := seen[k]
		if !exists {
			idx = len(assignments)
			seen[k] = idx
			assignments = append(assignments, assignment{
				imageID: s.ImageID,
				mode:    s.Mode,
			})
			order = append(order, k)
		}
		assignments[idx].rows = append(assignments[idx].rows, s)
	}

	caps := activeBackend.Capabilities()
	purgedIDs := make(map[int]struct{}) // track per-ID to cascade exactly once

	var snap backend.Snapshot
	var skips []SkipReason

	// --- Step 2: process each assignment ---
	for _, k := range order {
		asgn := assignments[seen[k]]

		// 2a. Filter to connected monitors.
		var connectedRows []store.MonitorState
		for _, row := range asgn.rows {
			if _, ok := connected[row.MonitorName]; ok {
				connectedRows = append(connectedRows, row)
			} else {
				skips = append(skips, SkipReason{
					MonitorName: row.MonitorName,
					ImageID:     asgn.imageID,
					Kind:        SkipMonitorDisconnected,
					Detail:      "monitor not in connected set",
				})
			}
		}
		if len(connectedRows) == 0 {
			continue
		}

		// 2b. Look up image in DB.
		img, err := images.GetByID(ctx, asgn.imageID)
		if err != nil {
			if !errors.Is(err, store.ErrNotFound) {
				return backend.Snapshot{}, nil, err
			}
			// Row missing — orphan cascade (only when all required stores are available).
			if _, already := purgedIDs[asgn.imageID]; !already && monStateStore != nil && historyStore != nil && playlistStore != nil {
				purgedIDs[asgn.imageID] = struct{}{}
				result, purgeErr := store.PurgeImageReferences(ctx, asgn.imageID, monStateStore, historyStore, playlistStore)
				if purgeErr == nil && bus != nil {
					bus.Publish(events.Event{
						Type: events.ImageOrphanPurged,
						Data: map[string]any{
							"image_id":               asgn.imageID,
							"reason":                 "row_missing",
							"monitor_states_purged":  result.MonitorStatesPurged,
							"history_entries_purged": result.HistoryEntriesPurged,
							"playlists_affected":     result.PlaylistsAffected,
						},
					})
				}
			}
			for _, row := range connectedRows {
				skips = append(skips, SkipReason{
					MonitorName: row.MonitorName,
					ImageID:     asgn.imageID,
					Kind:        SkipImageMissing,
					Detail:      "image not found in store",
				})
			}
			continue
		}

		// 2c. Stat the image file.
		if _, statErr := os.Stat(img.Path); statErr != nil {
			if _, already := purgedIDs[asgn.imageID]; !already && monStateStore != nil && historyStore != nil && playlistStore != nil {
				purgedIDs[asgn.imageID] = struct{}{}
				result, purgeErr := store.PurgeImageReferences(ctx, asgn.imageID, monStateStore, historyStore, playlistStore)
				if purgeErr == nil && bus != nil {
					bus.Publish(events.Event{
						Type: events.ImageOrphanPurged,
						Data: map[string]any{
							"image_id":               asgn.imageID,
							"reason":                 "file_missing",
							"monitor_states_purged":  result.MonitorStatesPurged,
							"history_entries_purged": result.HistoryEntriesPurged,
							"playlists_affected":     result.PlaylistsAffected,
						},
					})
				}
			}
			for _, row := range connectedRows {
				skips = append(skips, SkipReason{
					MonitorName: row.MonitorName,
					ImageID:     asgn.imageID,
					Kind:        SkipImageMissing,
					Detail:      "image file missing on disk",
				})
			}
			continue
		}

		// 2d. Determine ContentKind.
		kind := mediaTypeToKind(img.MediaType)

		// 2e. Check backend capability.
		if !supportsKind(caps, kind) {
			for _, row := range connectedRows {
				skips = append(skips, SkipReason{
					MonitorName: row.MonitorName,
					ImageID:     asgn.imageID,
					Kind:        SkipKindUnsupported,
					Detail:      "backend does not support content kind " + string(kind),
				})
			}
			continue
		}

		// 2f–g. Handle ModeExtend.
		isExtend := asgn.mode == string(backend.ModeExtend)

		var splitPaths map[string]string
		if isExtend && kind == backend.KindStaticImage && len(connectedRows) >= 2 && splitter != nil {
			// Build monitor list in the order rows appear.
			mons := make([]monitor.Monitor, 0, len(connectedRows))
			for _, row := range connectedRows {
				mons = append(mons, connected[row.MonitorName])
			}
			var splitErr error
			splitPaths, splitErr = splitter.Split(img.Path, img.ID, mons)
			if splitErr != nil {
				for _, row := range connectedRows {
					skips = append(skips, SkipReason{
						MonitorName: row.MonitorName,
						ImageID:     asgn.imageID,
						Kind:        SkipSplitFailed,
						Detail:      splitErr.Error(),
					})
				}
				continue
			}
		}
		// Non-image extend degrades to clone (splitPaths remains nil).

		// 2h. Build Content for each surviving row.
		for _, row := range connectedRows {
			mon := connected[row.MonitorName]
			var content backend.Content

			switch kind {
			case backend.KindStaticImage:
				path := img.Path
				if splitPaths != nil {
					if p, ok := splitPaths[row.MonitorName]; ok {
						path = p
					}
				}
				content = backend.StaticImage{Path_: path}

			case backend.KindGIF:
				content = backend.GIF{Path_: img.Path}

			case backend.KindVideo:
				content = backend.Video{
					Path_:        img.Path,
					AudioEnabled: img.AudioEnabled && videoAudioDefault,
				}

			case backend.KindWebWallpaper:
				if img.WebMeta == nil {
					skips = append(skips, SkipReason{
						MonitorName: row.MonitorName,
						ImageID:     asgn.imageID,
						Kind:        SkipManifestUnreadable,
						Detail:      "web_meta is nil",
					})
					continue
				}
				merged, mergeErr := wallpaperconfig.MergeValues(img.WebMeta.WallpaperConfig, img.WallpaperConfigOverrides)
				if mergeErr != nil {
					skips = append(skips, SkipReason{
						MonitorName: row.MonitorName,
						ImageID:     asgn.imageID,
						Kind:        SkipManifestUnreadable,
						Detail:      "wallpaper config merge failed: " + mergeErr.Error(),
					})
					continue
				}
				content = backend.WebWallpaper{
					ManifestPath:      img.WebMeta.ManifestPath,
					PackageRoot:       img.WebMeta.PackageRoot,
					Config:            merged,
					ParallaxDirection: ParallaxDirectionOverrideFromImage(img),
				}
			}

			// 2i. Append Output.
			snap.Outputs = append(snap.Outputs, backend.Output{
				Monitor: mon,
				Content: content,
			})
		}
	}

	return snap, skips, nil
}
