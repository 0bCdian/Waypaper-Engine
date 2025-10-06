package ipc

import (
	"waypaper-engine/daemon-go/internal/models"
	"waypaper-engine/daemon-go/internal/types"
)

// Message is the structure for IPC communication.
type Message struct {
	Action               string                `json:"action"`
	MessageID            int64                 `json:"messageId,omitempty"`
	PlaylistID           int64                 `json:"playlistId,omitempty"`
	PlaylistName         string                `json:"playlistName,omitempty"`
	Playlist             *RendererPlaylist     `json:"playlist,omitempty"`
	ImageIDs             []int64               `json:"imageIds,omitempty"`
	ImagePaths           []string              `json:"imagePaths,omitempty"`
	FileNames            []string              `json:"fileNames,omitempty"`
	CacheDir             string                `json:"cacheDir,omitempty"`
	ThumbnailsDir        string                `json:"thumbnailsDir,omitempty"`
	Image                *ImageInfo            `json:"image,omitempty"`
	ActiveMonitor        *models.ActiveMonitor `json:"activeMonitor,omitempty"`
	Monitors             []string              `json:"monitors"`
	SelectedImagesLength int                   `json:"selectedImagesLength,omitempty"`
	MonitorName          string                `json:"monitorName,omitempty"`
	Config               *ConfigData           `json:"config,omitempty"`
}

// ConfigData holds configuration data for IPC operations
type ConfigData struct {
	AppConfig      *models.AppConfig  `json:"appConfig,omitempty"`
	SwwwConfig     *models.SwwwConfig `json:"swwwConfig,omitempty"`
	FrontendConfig any                `json:"frontendConfig,omitempty"`
	ConfigKey      string             `json:"configKey,omitempty"`
	ConfigValue    any                `json:"configValue,omitempty"`
}

// ImageInfo is a subset of the db.Image struct for IPC.
type ImageInfo struct {
	ID   int64  `json:"id"`
	Name string `json:"name"`
}

// RendererPlaylist represents a playlist from the frontend.
type RendererPlaylist struct {
	Name          string                `json:"name"`
	Images        []RendererImage       `json:"images"`
	Configuration PlaylistConfiguration `json:"configuration"`
	ActiveMonitor *models.ActiveMonitor `json:"activeMonitor,omitempty"`
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
type Event = types.Event

// EventMetadata contains rich metadata for events
type EventMetadata = types.EventMetadata

// ImageEventMetadata contains metadata for image-related events
type ImageEventMetadata = types.ImageEventMetadata

// PlaylistEventMetadata contains metadata for playlist-related events
type PlaylistEventMetadata = types.PlaylistEventMetadata

// MonitorEventMetadata contains metadata for monitor-related events
type MonitorEventMetadata = types.MonitorEventMetadata

// ConfigEventMetadata contains metadata for configuration-related events
type ConfigEventMetadata = types.ConfigEventMetadata

// EventType defines the type of daemon event.
type EventType = types.EventType

const (
	// Image processing events
	EventProcessingStarted  types.EventType = "processing_started"
	EventImageProcessed     types.EventType = "image_processed"
	EventImageProgress      types.EventType = "image_progress"
	EventImageError         types.EventType = "image_error"
	EventProcessingComplete types.EventType = "processing_complete"

	// Playlist events
	EventPlaylistStarted      types.EventType = "playlist_started"
	EventPlaylistStopped      types.EventType = "playlist_stopped"
	EventPlaylistPaused       types.EventType = "playlist_paused"
	EventPlaylistResumed      types.EventType = "playlist_resumed"
	EventPlaylistImageChanged types.EventType = "playlist_image_changed"

	// Wallpaper/Image events
	EventWallpaperChanged types.EventType = "wallpaper_changed"
	EventImageChanged     types.EventType = "image_changed"

	// Monitor events
	EventMonitorChanged      types.EventType = "monitor_changed"
	EventMonitorDisconnected types.EventType = "monitor_disconnected"

	// Configuration events
	EventConfigChanged types.EventType = "config_changed"

	// Gallery/Image library events
	EventImagesUpdated    types.EventType = "images_updated"
	EventPlaylistsUpdated types.EventType = "playlists_updated"
)
