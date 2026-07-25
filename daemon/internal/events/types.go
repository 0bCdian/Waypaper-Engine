// Package events defines event type constants for the daemon's pub/sub event bus.
package events

type EventType string

const (
	ProcessingStarted   EventType = "processing_started"
	ImageProcessed      EventType = "image_processed"
	ImageError          EventType = "image_error"
	ProcessingComplete  EventType = "processing_complete"
	ProcessingCancelled EventType = "processing_cancelled"
)

const (
	PlaylistStarted      EventType = "playlist_started"
	PlaylistStopped      EventType = "playlist_stopped"
	PlaylistPaused       EventType = "playlist_paused"
	PlaylistResumed      EventType = "playlist_resumed"
	PlaylistImageChanged EventType = "playlist_image_changed"
)

const (
	WallpaperChanged     EventType = "wallpaper_changed"
	WallpaperApplyFailed EventType = "wallpaper_apply_failed"
)

const (
	MonitorConnected    EventType = "monitor_connected"
	MonitorDisconnected EventType = "monitor_disconnected"
)

const (
	ConfigChanged EventType = "config_changed"
)

const (
	GalleryChanged EventType = "gallery_changed"
)

const (
	BackendUnavailable          EventType = "backend_unavailable"
	WallpaperRestoreFailed      EventType = "wallpaper_restore_failed"
	PlaylistSkippedIncompatible EventType = "playlist_skipped_incompatible"
	PlaylistNoCompatibleItem    EventType = "playlist_no_compatible_item"
	ImageOrphanPurged           EventType = "image_orphan_purged"
)
