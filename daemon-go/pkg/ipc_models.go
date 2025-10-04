package pkg

import "encoding/json"

// Command sent from Electron to Go
type Command struct {
	Type    string          `json:"type"`
	Payload json.RawMessage `json:"payload,omitempty"`
}

// Event sent from Go to Electron
type Event struct {
	Type    string      `json:"type"`
	Payload interface{} `json:"payload,omitempty"`
}

// Command payloads
type StartPlaylistPayload struct {
	PlaylistID int64  `json:"playlistId"`
	Monitor    string `json:"monitor"`
}

type StopPlaylistPayload struct {
	Monitor string `json:"monitor"`
}

type PausePlaylistPayload struct {
	Monitor string `json:"monitor"`
}

type ResumePlaylistPayload struct {
	Monitor string `json:"monitor"`
}

type NextImagePayload struct {
	Monitor string `json:"monitor"`
}

type PreviousImagePayload struct {
	Monitor string `json:"monitor"`
}

type SetImagePayload struct {
	ImageID int64  `json:"imageId"`
	Monitor string `json:"monitor"`
}

type RandomImagePayload struct {
	Monitor string `json:"monitor"`
}

type GetImagesPayload struct {
	Filters map[string]interface{} `json:"filters,omitempty"`
}

// Image Operation Payloads
type GetImageMetadataPayload struct {
	ImagePath string `json:"imagePath"`
}

type ResizeImagePayload struct {
	ImagePath  string `json:"imagePath"`
	Width      int    `json:"width"`
	Height     int    `json:"height"`
	ResizeType string `json:"resizeType,omitempty"` // "fit", "crop", "fill"
}

type ConvertImagePayload struct {
	ImagePath string `json:"imagePath"`
	Format    string `json:"format"`
	Quality   int    `json:"quality,omitempty"`
}

type ProcessForMonitorsPayload struct {
	ImagePath string   `json:"imagePath"`
	Monitors  []string `json:"monitors"`
	Mode      string   `json:"mode"` // "extend", "duplicate"
}

type SetImageAcrossMonitorsPayload struct {
	ImageID        int64    `json:"imageId"`
	Monitors       []string `json:"monitors"`
	ShowAnimations bool     `json:"showAnimations"`
}

type DuplicateImageAcrossMonitorsPayload struct {
	ImageID        int64    `json:"imageId"`
	Monitors       []string `json:"monitors"`
	ShowAnimations bool     `json:"showAnimations"`
}

type DeleteImagesPayload struct {
	ImageIDs []int64 `json:"imageIds"`
}

type GetImageHistoryPayload struct {
	Limit  int `json:"limit,omitempty"`
	Offset int `json:"offset,omitempty"`
}

// Bulk Operation Payloads
type BulkImagePayload struct {
	Monitors []string `json:"monitors,omitempty"`
}

// Configuration Payloads
type GetConfigPayload struct {
	Key string `json:"key"`
}

type SetConfigPayload struct {
	Key   string      `json:"key"`
	Value interface{} `json:"value"`
}

type UpdateConfigPayload struct {
	ConfigType string `json:"configType"` // "app", "swww", "monitors"
}

// Monitor Operation Payloads
type SetSelectedMonitorPayload struct {
	ActiveMonitor ActiveMonitor `json:"activeMonitor"`
}

type ActiveMonitor struct {
	Name                 string   `json:"name"`
	Monitors             []string `json:"monitors"`
	ExtendAcrossMonitors bool     `json:"extendAcrossMonitors"`
}

// Event payloads
type WallpaperChangedPayload struct {
	ImagePath string `json:"imagePath"`
	Monitor   string `json:"monitor"`
}

type PlaylistStartedPayload struct {
	PlaylistName string `json:"playlistName"`
	Monitor      string `json:"monitor"`
}

type PlaylistStoppedPayload struct {
	PlaylistName string `json:"playlistName"`
	Monitor      string `json:"monitor"`
}

type PlaylistPausedPayload struct {
	PlaylistName string `json:"playlistName"`
	Monitor      string `json:"monitor"`
}

type PlaylistResumedPayload struct {
	PlaylistName string `json:"playlistName"`
	Monitor      string `json:"monitor"`
}

type ImagesUpdatedPayload struct {
	Images []ImageInfo `json:"images"`
}

type PlaylistsUpdatedPayload struct {
	Playlists []PlaylistInfo `json:"playlists"`
}

type ImageInfo struct {
	ID         int64  `json:"id"`
	Name       string `json:"name"`
	Path       string `json:"path"`
	Width      int    `json:"width"`
	Height     int    `json:"height"`
	Format     string `json:"format"`
	Rating     int    `json:"rating"`
	IsChecked  bool   `json:"isChecked"`
	IsSelected bool   `json:"isSelected"`
	Time       *int   `json:"time,omitempty"`
}

type PlaylistInfo struct {
	ID                      int64       `json:"id"`
	Name                    string      `json:"name"`
	Type                    string      `json:"type"`
	Interval                *int        `json:"interval,omitempty"`
	ShowAnimations          bool        `json:"showAnimations"`
	AlwaysStartOnFirstImage bool        `json:"alwaysStartOnFirstImage"`
	Order                   string      `json:"order,omitempty"`
	CurrentImageIndex       int         `json:"currentImageIndex"`
	Images                  []ImageInfo `json:"images"`
}

type ErrorPayload struct {
	Message string `json:"message"`
	Code    string `json:"code,omitempty"`
}

const (
	// Commands
	CmdPing              = "PING"
	CmdStartPlaylist     = "START_PLAYLIST"
	CmdStopPlaylist      = "STOP_PLAYLIST"
	CmdNextImage         = "NEXT_IMAGE"
	CmdPreviousImage     = "PREVIOUS_IMAGE"
	CmdPausePlaylist     = "PAUSE_PLAYLIST"
	CmdResumePlaylist    = "RESUME_PLAYLIST"
	CmdSetImage          = "SET_IMAGE"
	CmdRandomImage       = "RANDOM_IMAGE"
	CmdGetImages         = "GET_IMAGES"
	CmdGetPlaylists      = "GET_PLAYLISTS"
	CmdGetActivePlaylist = "GET_ACTIVE_PLAYLIST"
	CmdGetInfo           = "GET_INFO"

	// Image Operations
	CmdGetImageMetadata             = "GET_IMAGE_METADATA"
	CmdResizeImage                  = "RESIZE_IMAGE"
	CmdConvertImage                 = "CONVERT_IMAGE"
	CmdProcessForMonitors           = "PROCESS_FOR_MONITORS"
	CmdSetImageAcrossMonitors       = "SET_IMAGE_ACROSS_MONITORS"
	CmdDuplicateImageAcrossMonitors = "DUPLICATE_IMAGE_ACROSS_MONITORS"
	CmdDeleteImages                 = "DELETE_IMAGES"
	CmdGetImageHistory              = "GET_IMAGE_HISTORY"

	// Bulk Operations
	CmdNextImageAll      = "NEXT_IMAGE_ALL"
	CmdPreviousImageAll  = "PREVIOUS_IMAGE_ALL"
	CmdRandomImageAll    = "RANDOM_IMAGE_ALL"
	CmdStopPlaylistAll   = "STOP_PLAYLIST_ALL"
	CmdPausePlaylistAll  = "PAUSE_PLAYLIST_ALL"
	CmdResumePlaylistAll = "RESUME_PLAYLIST_ALL"

	// Configuration
	CmdGetAppConfig  = "GET_APP_CONFIG"
	CmdSetAppConfig  = "SET_APP_CONFIG"
	CmdGetSwwwConfig = "GET_SWWW_CONFIG"
	CmdSetSwwwConfig = "SET_SWWW_CONFIG"
	CmdUpdateConfig  = "UPDATE_CONFIG"

	// Monitor Operations
	CmdGetMonitors        = "GET_MONITORS"
	CmdSetSelectedMonitor = "SET_SELECTED_MONITOR"
	CmdGetSelectedMonitor = "GET_SELECTED_MONITOR"

	// System
	CmdStopDaemon      = "STOP_DAEMON"
	CmdGetDaemonStatus = "GET_DAEMON_STATUS"

	// Events
	EvtPong             = "PONG"
	EvtPlaylistStarted  = "PLAYLIST_STARTED"
	EvtPlaylistStopped  = "PLAYLIST_STOPPED"
	EvtPlaylistPaused   = "PLAYLIST_PAUSED"
	EvtPlaylistResumed  = "PLAYLIST_RESUMED"
	EvtWallpaperChanged = "WALLPAPER_CHANGED"
	EvtImagesUpdated    = "IMAGES_UPDATED"
	EvtPlaylistsUpdated = "PLAYLISTS_UPDATED"
	EvtConfigUpdated    = "CONFIG_UPDATED"
	EvtError            = "ERROR"
)
