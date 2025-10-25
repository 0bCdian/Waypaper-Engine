package ipc

import (
	"waypaper-engine/daemon-go/internal/backend"
	"waypaper-engine/daemon-go/internal/config"
	"waypaper-engine/daemon-go/internal/events"
	"waypaper-engine/daemon-go/internal/monitor"
)

// Message is the structure for IPC communication.
type Message struct {
	Action               string                    `json:"action"`
	MessageID            int64                     `json:"messageId,omitempty"`
	PlaylistID           int64                     `json:"playlistId,omitempty"`
	PlaylistName         string                    `json:"playlistName,omitempty"`
	Playlist             *RendererPlaylist         `json:"playlist,omitempty"`
	ImageIDs             []int64                   `json:"imageIds,omitempty"`
	ImagePaths           []string                  `json:"imagePaths,omitempty"`
	FileNames            []string                  `json:"fileNames,omitempty"`
	CacheDir             string                    `json:"cacheDir,omitempty"`
	ThumbnailsDir        string                    `json:"thumbnailsDir,omitempty"`
	Image                *ImageInfo                `json:"image,omitempty"`
	ActiveMonitor        *monitor.MonitorSelection `json:"activeMonitor,omitempty"`
	Monitors             []string                  `json:"monitors"`
	SelectedImagesLength int                       `json:"selectedImagesLength,omitempty"`
	MonitorName          string                    `json:"monitorName,omitempty"`
	Config               *ConfigData               `json:"config,omitempty"`
	EventTypes           []string                  `json:"eventTypes,omitempty"`
}

// ConfigData holds configuration data for IPC operations
type ConfigData struct {
	ConfigSection string `json:"configSection,omitempty"`
	ConfigKey     string `json:"configKey,omitempty"`
	ConfigValue   any    `json:"configValue,omitempty"`

	// Legacy support - keep for backward compatibility
	AppConfig      *config.AppConfig   `json:"appConfig,omitempty"`
	SwwwConfig     *backend.SwwwConfig `json:"swwwConfig,omitempty"`
	FrontendConfig any                 `json:"frontendConfig,omitempty"`
}

// ImageInfo is a subset of the db.Image struct for IPC.
type ImageInfo struct {
	ID   int64  `json:"id"`
	Name string `json:"name"`
}

// RendererPlaylist represents a playlist from the frontend.
type RendererPlaylist struct {
	Name          string                    `json:"name"`
	Images        []RendererImage           `json:"images"`
	Configuration PlaylistConfiguration     `json:"configuration"`
	ActiveMonitor *monitor.MonitorSelection `json:"activeMonitor,omitempty"`
}

// RendererImage represents an image from the frontend for playlist operations.
type RendererImage struct {
	ID   int64  `json:"id"`
	Time *int64 `json:"time,omitempty"` // Time in minutes for time-of-day playlists
}

// PlaylistConfiguration represents playlist configuration from the frontend.
type PlaylistConfiguration struct {
	Type                    string  `json:"type"`
	Interval                *int64  `json:"interval,omitempty"`
	Order                   *string `json:"order,omitempty"`
	ShowAnimations          bool    `json:"showAnimations"`
	AlwaysStartOnFirstImage bool    `json:"alwaysStartOnFirstImage"`
	CurrentImageIndex       int64   `json:"currentImageIndex"`
}

// Response is the structure for IPC responses.
type Response struct {
	Action    string `json:"action"`
	MessageID int64  `json:"messageId,omitempty"`
	Data      any    `json:"data,omitempty"`
	Error     string `json:"error,omitempty"`
}

// Event represents a real-time event from the daemon.
type Event = events.Event

// EventType defines the type of daemon event (string alias for clarity).
type EventType = string

const (
	// Image processing events
	EventProcessingStarted  EventType = "processing_started"
	EventImageProcessed     EventType = "image_processed"
	EventImageProgress      EventType = "image_progress"
	EventImageError         EventType = "image_error"
	EventProcessingComplete EventType = "processing_complete"

	// Playlist events
	EventPlaylistStarted      EventType = "playlist_started"
	EventPlaylistStopped      EventType = "playlist_stopped"
	EventPlaylistPaused       EventType = "playlist_paused"
	EventPlaylistResumed      EventType = "playlist_resumed"
	EventPlaylistImageChanged EventType = "playlist_image_changed"

	// Wallpaper/Image events
	EventWallpaperChanged EventType = "wallpaper_changed"
	EventImageChanged     EventType = "image_changed"

	// Monitor events
	EventMonitorChanged      EventType = "monitor_changed"
	EventMonitorDisconnected EventType = "monitor_disconnected"

	// Configuration events
	EventConfigChanged EventType = "config_changed"

	// Gallery/Image library events
	EventImagesUpdated    EventType = "images_updated"
	EventPlaylistsUpdated EventType = "playlists_updated"
)
