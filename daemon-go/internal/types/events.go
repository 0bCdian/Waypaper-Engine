package types

import (
	"waypaper-engine/daemon-go/internal/models"
)

// Event represents a real-time event from the daemon.
type Event struct {
	Type     EventType     `json:"type"`
	Payload  any           `json:"payload"`
	Metadata EventMetadata `json:"metadata"`
}

// EventMetadata contains rich metadata for events
type EventMetadata struct {
	// Timestamp when this event occurred
	Timestamp string `json:"timestamp"`

	// Image-specific metadata for wallpaper/image events
	Image *ImageEventMetadata `json:"image,omitempty"`

	// Playlist-specific metadata for playlist events
	Playlist *PlaylistEventMetadata `json:"playlist,omitempty"`

	// Monitor-specific metadata
	Monitor *MonitorEventMetadata `json:"monitor,omitempty"`

	// Configuration-specific metadata
	Config *ConfigEventMetadata `json:"config,omitempty"`
}

// ImageEventMetadata contains metadata for image-related events
type ImageEventMetadata struct {
	ID            int64  `json:"id"`                      // Database ID
	Name          string `json:"name"`                    // File name
	Path          string `json:"path"`                    // Full filesystem path
	ThumbnailPath string `json:"thumbnailPath,omitempty"` // Thumbnail path
	Width         int    `json:"width"`                   // Image width
	Height        int    `json:"height"`                  // Image height
	Format        string `json:"format"`                  // Image format (jpg, png, etc.)
	Size          int64  `json:"size"`                    // File size in bytes
}

// PlaylistEventMetadata contains metadata for playlist-related events
type PlaylistEventMetadata struct {
	ID               int64  `json:"id"`                         // Playlist database ID
	Name             string `json:"name"`                       // Playlist name
	Type             string `json:"type"`                       // playlist|timer|timerandom|timeofday|day_of_week
	ImageIndex       int64  `json:"imageIndex"`                 // Current image index in playlist
	TotalImages      int    `json:"totalImages"`                // Total number of images in playlist
	ImageChangeTime  int64  `json:"imageChangeTime,omitempty"`  // Timestamp of last image change
	TimeToNextChange int64  `json:"timeToNextChange,omitempty"` // Milliseconds until next change
	Interval         int64  `json:"interval,omitempty"`         // Interval for timer playlists
	IsActive         bool   `json:"isActive"`                   // Whether playlist is currently running
	IsPaused         bool   `json:"isPaused"`                   // Whether playlist is paused
}

// MonitorEventMetadata contains metadata for monitor-related events
type MonitorEventMetadata struct {
	Name         string              `json:"name"`                   // Monitor name
	Width        int                 `json:"width"`                  // Monitor width
	Height       int                 `json:"height"`                 // Monitor height
	Position     *models.Position    `json:"position"`               // Monitor position
	CurrentImage *ImageEventMetadata `json:"currentImage,omitempty"` // Currently set image
	Selected     bool                `json:"selected"`               // Whether this monitor is selected for operations
}

// ConfigEventMetadata contains metadata for configuration-related events
type ConfigEventMetadata struct {
	ConfigType string `json:"configType"`         // app|daemon|backend
	Key        string `json:"key"`                // Configuration key that changed
	OldValue   any    `json:"oldValue,omitempty"` // Previous value
	NewValue   any    `json:"newValue,omitempty"` // New value
}

// EventType defines the type of daemon event.
type EventType string

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
