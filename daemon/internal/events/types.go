// Package events defines event type constants for the daemon's pub/sub event bus.
//
// Events are published by daemon components (playlist manager, image processor, etc.)
// and consumed by the SSE broker to stream to connected clients.
package events

// EventType identifies a specific kind of event in the daemon.
type EventType string

// Image processing events — emitted during batch image import.
const (
	ProcessingStarted   EventType = "processing_started"
	ImageProcessed      EventType = "image_processed"
	ImageError          EventType = "image_error"
	ProcessingComplete  EventType = "processing_complete"
	ProcessingCancelled EventType = "processing_cancelled"
)

// Playlist events — emitted when playlist state changes.
const (
	PlaylistStarted      EventType = "playlist_started"
	PlaylistStopped      EventType = "playlist_stopped"
	PlaylistPaused       EventType = "playlist_paused"
	PlaylistResumed      EventType = "playlist_resumed"
	PlaylistImageChanged EventType = "playlist_image_changed"
)

// Wallpaper events — emitted when a wallpaper changes on any monitor.
const (
	WallpaperChanged EventType = "wallpaper_changed"
)

// Monitor events — emitted when monitor configuration changes.
const (
	MonitorConnected    EventType = "monitor_connected"
	MonitorDisconnected EventType = "monitor_disconnected"
)

// Configuration events — emitted when config is updated.
const (
	ConfigChanged EventType = "config_changed"
)

// History events — emitted when the wallpaper history is modified.
const (
	HistoryCleared EventType = "history_cleared"
)

// Gallery events — emitted when the image or playlist collections change.
const (
	ImagesUpdated    EventType = "images_updated"
	PlaylistsUpdated EventType = "playlists_updated"
	FoldersUpdated   EventType = "folders_updated"
)

// Backend lifecycle events.
const (
	// BackendUnavailable — long-lived renderer (e.g. wayland-utauri) could not be reached after retries.
	BackendUnavailable EventType = "backend_unavailable"

	// WallpaperRestoreFailed — one or more monitors could not restore their persisted wallpaper on startup.
	WallpaperRestoreFailed EventType = "wallpaper_restore_failed"

	// PlaylistSkippedIncompatible — playlist skipped items incompatible with the active backend.
	PlaylistSkippedIncompatible EventType = "playlist_skipped_incompatible"

	// PlaylistNoCompatibleItem — entire playlist exhausted with no item compatible with the active backend.
	PlaylistNoCompatibleItem EventType = "playlist_no_compatible_item"
)
