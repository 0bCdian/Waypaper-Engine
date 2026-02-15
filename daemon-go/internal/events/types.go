package events

import (
	"time"
)

// Event type constants
const (
	EventImageSet           = "image:set"
	EventImageProcessed     = "image:processed"
	EventProcessingStarted  = "processing:started"
	EventProcessingComplete = "processing:complete"
	EventImageError         = "image:error"
	EventPlaylistStarted    = "playlist:started"
	EventPlaylistStopped    = "playlist:stopped"
	EventPlaylistPaused     = "playlist:paused"
	EventPlaylistResumed    = "playlist:resumed"
	EventConfigChanged      = "config:changed"
	EventConfigError        = "config:error"
	EventMonitorChanged     = "monitor:changed"
	EventBackendChanged     = "backend:changed"
)

// Event payload types
type ImageSetPayload struct {
	ImageID   string    `json:"imageId"`
	ImagePath string    `json:"imagePath"`
	Monitors  []string  `json:"monitors"`
	Mode      string    `json:"mode"`
	Timestamp time.Time `json:"timestamp"`
	Source    string    `json:"source"` // "manual" or "playlist"
}

type ImageProcessedPayload struct {
	ImageID       string `json:"imageId"`
	ImageName     string `json:"imageName"`
	Width         int    `json:"width"`
	Height        int    `json:"height"`
	Format        string `json:"format"`
	ThumbnailPath string `json:"thumbnailPath"`
}

type PlaylistStartedPayload struct {
	PlaylistID   string   `json:"playlistId"`
	PlaylistName string   `json:"playlistName"`
	Monitors     []string `json:"monitors"`
	Mode         string   `json:"mode"`
}

type PlaylistStoppedPayload struct {
	PlaylistID   string `json:"playlistId"`
	PlaylistName string `json:"playlistName"`
	Reason       string `json:"reason"` // "manual", "error", "completed"
}

type ConfigChangedPayload struct {
	ConfigType string      `json:"configType"` // "app", "daemon", "backend", "monitors"
	Field      string      `json:"field"`
	OldValue   interface{} `json:"oldValue"`
	NewValue   interface{} `json:"newValue"`
}

type MonitorChangedPayload struct {
	Action  string                 `json:"action"` // "added", "removed", "changed"
	Monitor string                 `json:"monitor"`
	Details map[string]interface{} `json:"details"`
}

type BackendChangedPayload struct {
	BackendType string                 `json:"backendType"`
	Action      string                 `json:"action"` // "switched", "configured"
	Details     map[string]interface{} `json:"details"`
}

// Helper functions for creating events
func NewImageSetEvent(imageID, imagePath string, monitors []string, mode, source string) *Event {
	return &Event{
		Type:      EventImageSet,
		Timestamp: time.Now(),
		Source:    source,
		Payload: map[string]interface{}{
			"imageId":   imageID,
			"imagePath": imagePath,
			"monitors":  monitors,
			"mode":      mode,
			"source":    source,
		},
	}
}

func NewImageProcessedEvent(imageID, imageName, format, thumbnailPath string, width, height int) *Event {
	return &Event{
		Type:      EventImageProcessed,
		Timestamp: time.Now(),
		Source:    "image-manager",
		Payload: map[string]interface{}{
			"imageId":       imageID,
			"imageName":     imageName,
			"width":         width,
			"height":        height,
			"format":        format,
			"thumbnailPath": thumbnailPath,
		},
	}
}

func NewPlaylistStartedEvent(playlistID, playlistName string, monitors []string, mode string) *Event {
	return &Event{
		Type:      EventPlaylistStarted,
		Timestamp: time.Now(),
		Source:    "playlist-manager",
		Payload: map[string]interface{}{
			"playlistId":   playlistID,
			"playlistName": playlistName,
			"monitors":     monitors,
			"mode":         mode,
		},
	}
}

func NewPlaylistStoppedEvent(playlistID, playlistName, reason string) *Event {
	return &Event{
		Type:      EventPlaylistStopped,
		Timestamp: time.Now(),
		Source:    "playlist-manager",
		Payload: map[string]interface{}{
			"playlistId":   playlistID,
			"playlistName": playlistName,
			"reason":       reason,
		},
	}
}

func NewConfigChangedEvent(configType, field string, oldValue, newValue interface{}) *Event {
	return &Event{
		Type:      EventConfigChanged,
		Timestamp: time.Now(),
		Source:    "config-manager",
		Payload: map[string]interface{}{
			"configType": configType,
			"field":      field,
			"oldValue":   oldValue,
			"newValue":   newValue,
		},
	}
}

func NewMonitorChangedEvent(action, monitor string, details map[string]interface{}) *Event {
	return &Event{
		Type:      EventMonitorChanged,
		Timestamp: time.Now(),
		Source:    "monitor-manager",
		Payload: map[string]interface{}{
			"action":  action,
			"monitor": monitor,
			"details": details,
		},
	}
}

func NewBackendChangedEvent(backendType, action string, details map[string]interface{}) *Event {
	return &Event{
		Type:      EventBackendChanged,
		Timestamp: time.Now(),
		Source:    "backend-manager",
		Payload: map[string]interface{}{
			"backendType": backendType,
			"action":      action,
			"details":     details,
		},
	}
}
