package store

import (
	"encoding/json"
	"fmt"
	"strconv"
	"time"

	"waypaper-engine/daemon-go/internal/media"
)

// Image represents an image in the JSON store
type Image struct {
	ID           int64           `json:"id"`
	Name         string          `json:"name"`
	Path         string          `json:"path"`
	MediaType    media.MediaType `json:"mediaType"`
	Dimensions   ImageDimensions `json:"dimensions"`
	Metadata     ImageMetadata   `json:"metadata"`
	Selection    ImageSelection  `json:"selection"`
	ImportInfo   ImageImportInfo `json:"importInfo"`
	BackendHints BackendHints    `json:"backendHints,omitempty"`
	Thumbnails   ImageThumbnails `json:"thumbnails"`
}

// UnmarshalJSON custom unmarshaling to handle both string and int64 IDs
func (i *Image) UnmarshalJSON(data []byte) error {
	// Create a temporary struct with string ID for unmarshaling
	type TempImage struct {
		ID           interface{}     `json:"id"`
		Name         string          `json:"name"`
		Path         string          `json:"path"`
		MediaType    media.MediaType `json:"mediaType"`
		Dimensions   ImageDimensions `json:"dimensions"`
		Metadata     ImageMetadata   `json:"metadata"`
		Selection    ImageSelection  `json:"selection"`
		ImportInfo   ImageImportInfo `json:"importInfo"`
		BackendHints BackendHints    `json:"backendHints,omitempty"`
		Thumbnails   ImageThumbnails `json:"thumbnails"`
	}

	var temp TempImage
	if err := json.Unmarshal(data, &temp); err != nil {
		return err
	}

	// Convert ID to int64
	switch v := temp.ID.(type) {
	case string:
		if v == "" {
			i.ID = 0
		} else {
			id, err := strconv.ParseInt(v, 10, 64)
			if err != nil {
				return fmt.Errorf("invalid ID format: %v", v)
			}
			i.ID = id
		}
	case float64:
		i.ID = int64(v)
	case int64:
		i.ID = v
	case int:
		i.ID = int64(v)
	default:
		return fmt.Errorf("unsupported ID type: %T", v)
	}

	// Copy other fields
	i.Name = temp.Name
	i.Path = temp.Path
	i.MediaType = temp.MediaType
	i.Dimensions = temp.Dimensions
	i.Metadata = temp.Metadata
	i.Selection = temp.Selection
	i.ImportInfo = temp.ImportInfo
	i.BackendHints = temp.BackendHints
	i.Thumbnails = temp.Thumbnails

	return nil
}

// ImageThumbnails contains paths to different resolution thumbnails
type ImageThumbnails struct {
	Resolution720p  string `json:"720p"`
	Resolution1080p string `json:"1080p"`
	Resolution1440p string `json:"1440p"`
	Resolution4k    string `json:"4k"`
	Fallback        string `json:"fallback"`
}

// ImageDimensions represents image dimensions
type ImageDimensions struct {
	Width  int64 `json:"width"`
	Height int64 `json:"height"`
}

// ImageMetadata contains image metadata
type ImageMetadata struct {
	Format     string                 `json:"format"`
	FileSize   int64                  `json:"fileSize"`
	Checksum   string                 `json:"checksum"`
	Tags       []string               `json:"tags"`
	Properties map[string]interface{} `json:"properties,omitempty"`
}

// ImageSelection tracks selection status
type ImageSelection struct {
	IsChecked         bool       `json:"isChecked"`
	IsSelected        bool       `json:"isSelected"`
	SelectedAt        *time.Time `json:"selectedAt,omitempty"`
	SelectedPlaylists []string   `json:"selectedPlaylists"`
}

// ImageImportInfo tracks import information
type ImageImportInfo struct {
	ImportedAt time.Time `json:"importedAt"`
	SourcePath *string   `json:"sourcePath,omitempty"`
	Importer   string    `json:"importer"` // "scan", "manual", "bulk", etc.
}

// BackendHints provides hints for backend selection
type BackendHints struct {
	PreferredBackends []string         `json:"preferredBackends,omitempty"`
	RequireGPU        bool             `json:"requireGpu,omitempty"`
	MaxResolution     *ImageDimensions `json:"maxResolution,omitempty"`
}

// ImageRegistry represents the master images registry
type ImageRegistry struct {
	Metadata ImageRegistryMetadata `json:"metadata"`
	Images   []Image               `json:"images"`
	Indices  ImageRegistryIndices  `json:"indices"`
}

// ImageRegistryMetadata contains registry metadata
type ImageRegistryMetadata struct {
	Version     string     `json:"version"`
	LastUpdated time.Time  `json:"lastUpdated"`
	TotalImages int        `json:"totalImages"`
	LastScan    *time.Time `json:"lastScan,omitempty"`
}

// ImageRegistryIndices provides fast lookup indices
type ImageRegistryIndices struct {
	ByName       map[string]string            `json:"byName"`
	ByMediaType  map[media.MediaType][]string `json:"byMediaType"`
	ByFormat     map[string][]string          `json:"byFormat"`
	ByDimensions map[string][]string          `json:"byDimensions"` // "1920x1080"
	ByTags       map[string][]string          `json:"byTags"`
	BySelected   map[string][]string          `json:"bySelected"` // ["checked", "selected"]
}

// Playlist represents an enhanced playlist with backend configuration
type Playlist struct {
	ID            string                `json:"id"`
	Name          string                `json:"name"`
	Metadata      PlaylistMetadata      `json:"metadata"`
	Configuration PlaylistConfiguration `json:"configuration"`
	Images        []PlaylistImage       `json:"images"`
	Runtime       *PlaylistRuntime      `json:"runtime,omitempty"`
	// Backend configuration is embedded directly in the playlist (not separate JSON file)
	Backend *BackendConfiguration `json:"backend,omitempty"`
}

// PlaylistMetadata contains playlist metadata
type PlaylistMetadata struct {
	Version      string    `json:"version"`
	CreatedAt    time.Time `json:"createdAt"`
	LastModified time.Time `json:"lastModified"`
	CreatedBy    *string   `json:"createdBy,omitempty"`
	Tags         []string  `json:"tags,omitempty"`
	Description  *string   `json:"description,omitempty"`
}

// PlaylistConfiguration contains playlist settings
type PlaylistConfiguration struct {
	Type                    string              `json:"type"`               // "timer", "manual", "random"
	Interval                *int                `json:"interval,omitempty"` // seconds
	ShowAnimations          bool                `json:"showAnimations"`
	AlwaysStartOnFirstImage bool                `json:"alwaysStartOnFirstImage"`
	Order                   string              `json:"order"` // "sequential", "random", "manual"
	Filters                 *PlaylistFilters    `json:"filters,omitempty"`
	Transition              *TransitionSettings `json:"transition,omitempty"`
}

// PlaylistFilters defines filtering criteria
type PlaylistFilters struct {
	MinWidth       *int              `json:"minWidth,omitempty"`
	MaxWidth       *int              `json:"maxWidth,omitempty"`
	MinHeight      *int              `json:"minHeight,omitempty"`
	MaxHeight      *int              `json:"maxHeight,omitempty"`
	Formats        []string          `json:"formats,omitempty"`
	MediaTypes     []media.MediaType `json:"mediaTypes,omitempty"`
	Tags           []string          `json:"tags,omitempty"`
	TagsRequire    bool              `json:"tagsRequire"` // true = must have ALL tags, false = match ANY tag
	ExcludeFormats []string          `json:"excludeFormats,omitempty"`
	ExcludeTags    []string          `json:"excludeTags,omitempty"`
}

// TransitionSettings defines transition behavior
type TransitionSettings struct {
	Duration  float64 `json:"duration"` // seconds
	Effect    string  `json:"efftype"`  // "fade", "slide", "random"
	Easing    string  `json:"easing,omitempty"`
	Skippable bool    `json:"skippable"`
	CrossFade bool    `json:"crossFade"`
}

// PlaylistImage represents an image in a playlist
type PlaylistImage struct {
	ImageID         string                 `json:"imageId"`
	ImagePath       string                 `json:"imagePath"`
	MediaType       media.MediaType        `json:"mediaType"`
	Index           int                    `json:"index"`
	AddedAt         time.Time              `json:"addedAt"`
	CustomSettings  *PlaylistImageSettings `json:"customSettings,omitempty"`
	BackendOverride *BackendConfiguration  `json:"backendOverride,omitempty"`
}

// PlaylistImageSettings contains per-image customizations
type PlaylistImageSettings struct {
	DisplayTime     *int                   `json:"displayTime,omitempty"`
	TransitionTime  *float64               `json:"transitionTime,omitempty"`
	PreferredEffect *string                `json:"preferredEffect,omitempty"`
	SkipTransitions *bool                  `json:"skipTransitions,omitempty"`
	Metadata        map[string]interface{} `json:"metadata,omitempty"`
}

// PlaylistRuntime contains runtime state for a playlist
type PlaylistRuntime struct {
	CurrentIndex     int        `json:"currentIndex"`
	LastImageChange  time.Time  `json:"lastImageChange"`
	NextImageChange  *time.Time `json:"nextImageChange,omitempty"`
	TotalPlays       int64      `json:"totalPlays"`
	Status           string     `json:"status"` // "active", "paused", "stopped"
	LastAccessed     time.Time  `json:"lastAccessed"`
	PausedAt         *time.Time `json:"pausedAt,omitempty"`
	TotalTimeActive  *int64     `json:"totalTimeActive,omitempty"`  // in seconds
	AverageCycleTime *int64     `json:"averageCycleTime,omitempty"` // in seconds
}

// BackendConfiguration contains backend-specific configuration
type BackendConfiguration struct {
	Type              string                 `json:"type"`   // "swww", "feh", "mpv", etc.
	Config            map[string]interface{} `json:"config"` // Backend-specific config
	FallbackTo        *string                `json:"fallbackTo,omitempty"`
	MediaRestrictions *MediaRestrictions     `json:"mediaRestrictions,omitempty"`
}

// MediaRestrictions defines what media types are allowed
type MediaRestrictions struct {
	AllowedTypes        []media.MediaType `json:"allowedTypes"`
	RequiredFeatures    []string          `json:"requiredFeatures,omitempty"`
	MinPerformanceScore *int              `json:"minPerformanceScore,omitempty"`
}

// RuntimeState represents the current daemon runtime state
type RuntimeState struct {
	Metadata        RuntimeMetadata                 `json:"metadata"`
	ActivePlaylists map[string]*ActivePlaylistState `json:"activePlaylists"` // monitor name -> state
	MonitorState    MonitorStateRegistry            `json:"monitorState"`
	SelectedMonitor string                          `json:"selectedMonitor"`
	GlobalSettings  GlobalSettings                  `json:"globalSettings"`
	Statistics      RuntimeStatistics               `json:"statistics"`
}

// RuntimeMetadata contains runtime metadata
type RuntimeMetadata struct {
	Version       string     `json:"version"`
	LastSave      time.Time  `json:"lastSave"`
	DaemonPID     int        `json:"daemonPid"`
	DaemonVersion string     `json:"daemonVersion"`
	Uptime        *int64     `json:"uptime,omitempty"` // in seconds
	LastShutdown  *time.Time `json:"lastShutdown,omitempty"`
	CrashCount    *int       `json:"crashCount,omitempty"`
	LastCrash     *time.Time `json:"lastCrash,omitempty"`
}

// ActivePlaylistState represents an active playlist
type ActivePlaylistState struct {
	PlaylistID       string     `json:"playlistId"`
	PlaylistName     string     `json:"playlistName"`
	StartedAt        time.Time  `json:"startedAt"`
	Status           string     `json:"status"` // "playing", "paused", "stopped"
	PausedAt         *time.Time `json:"pausedAt,omitempty"`
	CurrentImagePath *string    `json:"currentImagePath,omitempty"`
	ImageIndex       *int       `json:"imageIndex,omitempty"`
	NextChange       *time.Time `json:"nextChange,omitempty"`
	CycleCount       *int64     `json:"cycleCount,omitempty"`
	LastActivity     time.Time  `json:"lastActivity"`
}

// MonitorStateRegistry manages monitor state
type MonitorStateRegistry struct {
	Monitors      []MonitorInfo `json:"monitors"`
	LastDetection time.Time     `json:"lastDetection"`
	TotalDetected int           `json:"totalDetected"`
	ActiveCount   int           `json:"activeCount"`
}

// MonitorInfo represents a monitor
type MonitorInfo struct {
	Name               string              `json:"name"`
	Dimensions         MonitorDimensions   `json:"dimensions"`
	Properties         MonitorProperties   `json:"properties"`
	CurrentWallpaper   *CurrentWallpaper   `json:"currentWallpaper,omitempty"`
	BackendInUse       *string             `json:"backendInUse,omitempty"`
	PerformanceMetrics *PerformanceMetrics `json:"performanceMetrics,omitempty"`
}

// MonitorDimensions represents monitor dimensions
type MonitorDimensions struct {
	Width       int      `json:"width"`
	Height      int      `json:"height"`
	RefreshRate *int     `json:"refreshRate,omitempty"`
	DPI         *int     `json:"dpi,omitempty"`
	Scale       *float64 `json:"scale,omitempty"`
}

// MonitorProperties contains additional monitor properties
type MonitorProperties struct {
	IsSelected       bool     `json:"isSelected"`
	IsPrimary        bool     `json:"isPrimary"`
	Connector        *string  `json:"connector,omitempty"` // "HDMI-1", "DP-1", etc.
	SupportedFormats []string `json:"supportedFormats"`
	MaxRefreshRate   *int     `json:"maxRefreshRate,omitempty"`
}

// CurrentWallpaper tracks current wallpaper information
type CurrentWallpaper struct {
	ImageID       string          `json:"imageId"`
	ImagePath     string          `json:"imagePath"`
	MediaType     media.MediaType `json:"mediaType"`
	SetAt         time.Time       `json:"setAt"`
	BackendUsed   string          `json:"backendUsed"`
	Duration      *int64          `json:"duration,omitempty"` // how long it's been displayed
	PreviousImage *string         `json:"previousImage,omitempty"`
}

// PerformanceMetrics contains performance information
type PerformanceMetrics struct {
	SetTime         *int64     `json:"setTime,omitempty"`         // milliseconds to set wallpaper
	LastSetDuration *int64     `json:"lastSetDuration,omitempty"` // milliseconds
	AverageSetTime  *int64     `json:"averageSetTime,omitempty"`  // milliseconds
	ErrorCount      int        `json:"errorCount"`
	LastError       *time.Time `json:"lastError,omitempty"`
	SuccessRate     *float64   `json:"successRate,omitempty"`
}

// GlobalSettings contains global daemon settings
type GlobalSettings struct {
	DefaultPlaylist           *string  `json:"defaultPlaylist,omitempty"`
	AutoStart                 bool     `json:"autoStart"`
	ImageHistoryLimit         int      `json:"imageHistoryLimit"`
	DefaultRefreshInterval    *int     `json:"defaultRefreshInterval,omitempty"`
	EnableTransitions         *bool    `json:"enableTransitions,omitempty"`
	DefaultTransitionDuration *float64 `json:"defaultTransitionDuration,omitempty"`
	LogLevel                  *string  `json:"logLevel,omitempty"`
	EnableDebugMode           *bool    `json:"enableDebugMode,omitempty"`
	DefaultBackend            *string  `json:"defaultBackend,omitempty"`
}

// RuntimeStatistics contains runtime statistics
type RuntimeStatistics struct {
	TotalImagesProcessed  int64     `json:"totalImagesProcessed"`
	TotalPlaylistsCreated int64     `json:"totalPlaylistsCreated"`
	TotalImagesSet        int64     `json:"totalImagesSet"`
	TotalUptime           int64     `json:"totalUptime"`                   // in seconds
	AverageImageSetTime   *int64    `json:"averageImageSetTime,omitempty"` // in milliseconds
	LastStatisticsUpdate  time.Time `json:"lastStatisticsUpdate"`
	PeakMemoryUsage       *int64    `json:"peakMemoryUsage,omitempty"` // in bytes
	DatabaseQueriesCount  *int64    `json:"databaseQueriesCount,omitempty"`
	DBSize                *int64    `json:"dbSize,omitempty"` // in bytes
}

// ImageHistory represents the image history
type ImageHistory struct {
	Metadata   ImageHistoryMetadata `json:"metadata"`
	Entries    []ImageHistoryEntry  `json:"entries"`
	ByMonitor  map[string][]string  `json:"byMonitor"` // monitor name -> list of image IDs
	Statistics ImageHistoryStats    `json:"statistics"`
}

// ImageHistoryMetadata contains history metadata
type ImageHistoryMetadata struct {
	Version      string    `json:"version"`
	Limit        int       `json:"limit"`
	LastCleanup  time.Time `json:"lastCleanup"`
	TotalEntries int64     `json:"totalEntries"`
	OldestEntry  time.Time `json:"oldestEntry"`
	NewestEntry  time.Time `json:"newestEntry"`
}

// ImageHistoryEntry represents a single history entry
type ImageHistoryEntry struct {
	ImageID      string          `json:"imageId"`
	ImagePath    string          `json:"imagePath"`
	MediaType    media.MediaType `json:"mediaType"`
	MonitorName  string          `json:"monitorName"`
	SetAt        time.Time       `json:"setAt"`
	Duration     *int64          `json:"duration,omitempty"` // how long it was displayed, in milliseconds
	PlaylistName *string         `json:"playlistName,omitempty"`
	BackendUsed  *string         `json:"backendUsed,omitempty"`
	Success      *bool           `json:"success,omitempty"`
}

// ImageHistoryStats contains history statistics
type ImageHistoryStats struct {
	TotalDisplays      int64            `json:"totalDisplays"`
	WeeklyDisplays     map[string]int64 `json:"weeklyDisplays"`
	MostUsedImages     []string         `json:"mostUsedImages"`               // image IDs
	AverageDisplayTime *int64           `json:"averageDisplayTime,omitempty"` // in milliseconds
	ErrorRate          *float64         `json:"errorRate,omitempty"`
	PopularMonitors    map[string]int64 `json:"popularMonitors"`
	MostActiveHours    []int            `json:"mostActiveHours"` // 0-23
}
