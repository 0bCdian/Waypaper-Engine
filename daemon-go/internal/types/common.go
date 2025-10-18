package types

// ============================================================================
// CORE TYPES AND ENUMS
// ============================================================================

// ImageFormat represents supported image formats
type ImageFormat string

const (
	FormatJPG      ImageFormat = "jpg"
	FormatJPEG     ImageFormat = "jpeg"
	FormatPNG      ImageFormat = "png"
	FormatBMP      ImageFormat = "bmp"
	FormatGIF      ImageFormat = "gif"
	FormatWebP     ImageFormat = "webp"
	FormatFarbfeld ImageFormat = "farbfeld"
	FormatPNM      ImageFormat = "pnm"
	FormatTGA      ImageFormat = "tga"
	FormatTIFF     ImageFormat = "tiff"
)

// PlaylistType defines the type of the playlist
type PlaylistType string

const (
	PlaylistTypeTimer     PlaylistType = "timer"
	PlaylistTypeNever     PlaylistType = "never"
	PlaylistTypeTimeOfDay PlaylistType = "timeofday"
	PlaylistTypeDayOfWeek PlaylistType = "dayofweek"
)

// PlaylistOrder defines the order of images in a playlist
type PlaylistOrder string

const (
	PlaylistOrderOrdered PlaylistOrder = "ordered"
	PlaylistOrderRandom  PlaylistOrder = "random"
)

// ResizeType defines how images should be resized
type ResizeType string

const (
	ResizeTypeCrop    ResizeType = "crop"
	ResizeTypeFit     ResizeType = "fit"
	ResizeTypeNone    ResizeType = "no"
	ResizeTypeStretch ResizeType = "stretch"
)

// FilterType defines the filter algorithm for resizing
type FilterType string

const (
	FilterTypeLanczos3   FilterType = "Lanczos3"
	FilterTypeBilinear   FilterType = "Bilinear"
	FilterTypeCatmullRom FilterType = "CatmullRom"
	FilterTypeMitchell   FilterType = "Mitchell"
	FilterTypeNearest    FilterType = "Nearest"
)

// TransitionType defines the transition effect
type TransitionType string

const (
	TransitionTypeNone   TransitionType = "none"
	TransitionTypeSimple TransitionType = "simple"
	TransitionTypeFade   TransitionType = "fade"
	TransitionTypeLeft   TransitionType = "left"
	TransitionTypeRight  TransitionType = "right"
	TransitionTypeTop    TransitionType = "top"
	TransitionTypeBottom TransitionType = "bottom"
	TransitionTypeWipe   TransitionType = "wipe"
	TransitionTypeWave   TransitionType = "wave"
	TransitionTypeGrow   TransitionType = "grow"
	TransitionTypeCenter TransitionType = "center"
	TransitionTypeAny    TransitionType = "any"
	TransitionTypeOuter  TransitionType = "outer"
	TransitionTypeRandom TransitionType = "random"
)

// TransitionPosition defines the position for transitions
type TransitionPosition string

const (
	TransitionPositionCenter      TransitionPosition = "center"
	TransitionPositionTop         TransitionPosition = "top"
	TransitionPositionLeft        TransitionPosition = "left"
	TransitionPositionRight       TransitionPosition = "right"
	TransitionPositionBottom      TransitionPosition = "bottom"
	TransitionPositionTopLeft     TransitionPosition = "top-left"
	TransitionPositionTopRight    TransitionPosition = "top-right"
	TransitionPositionBottomLeft  TransitionPosition = "bottom-left"
	TransitionPositionBottomRight TransitionPosition = "bottom-right"
)

// TransitionPositionType defines the type of position values
type TransitionPositionType string

const (
	TransitionPositionTypeAlias TransitionPositionType = "alias"
	TransitionPositionTypeInt   TransitionPositionType = "int"
	TransitionPositionTypeFloat TransitionPositionType = "float"
)

// MonitorMode defines how monitors are configured
type MonitorMode string

const (
	MonitorModeIndividual MonitorMode = "individual"
	MonitorModeExtend     MonitorMode = "extend"
	MonitorModeClone      MonitorMode = "clone"
)

// BackendType defines supported backend types
type BackendType string

const (
	BackendTypeSwww      BackendType = "swww"
	BackendTypeFeh       BackendType = "feh"
	BackendTypeNitrogen  BackendType = "nitrogen"
	BackendTypeHyprpaper BackendType = "hyprpaper"
	BackendTypeWallutils BackendType = "wallutils"
	BackendTypeCustom    BackendType = "custom"
)

// CompositorType defines supported compositor types
type CompositorType string

const (
	CompositorTypeAuto    CompositorType = "auto"
	CompositorTypeX11     CompositorType = "x11"
	CompositorTypeWayland CompositorType = "wayland"
)

// CompositorInfo contains information about the current compositor
type CompositorInfo struct {
	Type CompositorType `toml:"type" json:"type"`
}

// LogLevel defines log levels
type LogLevel string

const (
	LogLevelDebug LogLevel = "debug"
	LogLevelInfo  LogLevel = "info"
	LogLevelWarn  LogLevel = "warn"
	LogLevelError LogLevel = "error"
)

// ============================================================================
// BASIC STRUCTS
// ============================================================================

// Position represents a 2D position
type Position struct {
	X int `toml:"x" json:"x"`
	Y int `toml:"y" json:"y"`
}

// Dimensions represents width and height
type Dimensions struct {
	Width  int `toml:"width" json:"width"`
	Height int `toml:"height" json:"height"`
}

// ============================================================================
// MONITOR STRUCTS
// ============================================================================

// Monitor represents a single display.
type Monitor struct {
	Name         string   `json:"name"`
	Width        int      `json:"width"`
	Height       int      `json:"height"`
	CurrentImage string   `json:"currentImage"`
	Position     Position `json:"position"`
}

// MonitorSelection represents monitor configuration for operations
type MonitorSelection struct {
	ID       string      `toml:"id" json:"id"`
	Monitors []Monitor   `toml:"monitors" json:"monitors"`
	Mode     MonitorMode `toml:"mode" json:"mode"` // "individual", "extend", or "clone"
}

// MonitorImagePair represents a monitor and its associated image path
type MonitorImagePair struct {
	Monitor Monitor `toml:"monitor" json:"monitor"`
	Image   string  `toml:"image" json:"image"`
}

// ============================================================================
// IMAGE STRUCTS
// ============================================================================

// Image represents an image file
type Image struct {
	ID         int64       `toml:"id" json:"id"`
	Name       string      `toml:"name" json:"name"`
	Path       string      `toml:"path" json:"path"`
	IsChecked  bool        `toml:"is_checked" json:"isChecked"`
	IsSelected bool        `toml:"is_selected" json:"isSelected"`
	Width      int         `toml:"width" json:"width"`
	Height     int         `toml:"height" json:"height"`
	Format     ImageFormat `toml:"format" json:"format"`
	Rating     int         `toml:"rating" json:"rating"`
	Time       *int        `toml:"time,omitempty" json:"time,omitempty"` // Corresponds to rendererImage's nullable time
}

// ImageInfo represents basic image information for IPC
type ImageInfo struct {
	ID   int64  `toml:"id" json:"id"`
	Name string `toml:"name" json:"name"`
}

// ============================================================================
// PLAYLIST STRUCTS
// ============================================================================

// Playlist represents a collection of images with its configuration
type Playlist struct {
	ID                      int64         `toml:"id" json:"id"`
	Name                    string        `toml:"name" json:"name"`
	Type                    PlaylistType  `toml:"type" json:"type"`
	Interval                *int          `toml:"interval,omitempty" json:"interval,omitempty"`
	ShowAnimations          bool          `toml:"show_animations" json:"showAnimations"`
	AlwaysStartOnFirstImage bool          `toml:"always_start_on_first_image" json:"alwaysStartOnFirstImage"`
	Order                   PlaylistOrder `toml:"order,omitempty" json:"order,omitempty"`
	CurrentImageIndex       int64         `toml:"current_image_index" json:"currentImageIndex"`
	Images                  []Image       `toml:"images" json:"images"`
}

// ============================================================================
// CONFIGURATION STRUCTS
// ============================================================================

// AppConfig represents the application configuration
type AppConfig struct {
	KillDaemonOnExit        bool   `toml:"kill_daemon_on_exit" json:"killDaemon"`
	Notifications           bool   `toml:"notifications" json:"notifications"`
	StartMinimized          bool   `toml:"start_minimized" json:"startMinimized"`
	MinimizeInsteadOfClose  bool   `toml:"minimize_instead_of_close" json:"minimizeInsteadOfClose"`
	ShowMonitorModalOnStart bool   `toml:"show_monitor_modal_on_start" json:"showMonitorModalOnStart"`
	ImagesPerPage           int    `toml:"images_per_page" json:"imagesPerPage"`
	Theme                   string `toml:"theme" json:"theme"`
	SortBy                  string `toml:"sort_by" json:"sortBy"`
	SortOrder               string `toml:"sort_order" json:"sortOrder"`
	ImageHistoryLimit       int    `toml:"image_history_limit" json:"imageHistoryLimit"`
}

// DaemonConfig represents daemon configuration
type DaemonConfig struct {
	DatabasePath      string         `toml:"database_path" json:"databasePath"`
	ImagesDir         string         `toml:"images_dir" json:"imagesDir"`
	ThumbnailsDir     string         `toml:"thumbnails_dir" json:"thumbnailsDir"`
	MonitorsStateFile string         `toml:"monitors_state_file" json:"monitorsStateFile"`
	SocketPath        string         `toml:"socket_path" json:"socketPath"`
	LogLevel          LogLevel       `toml:"log_level" json:"logLevel"`
	LogFile           string         `toml:"log_file" json:"logFile"`
	LogMaxSize        int            `toml:"log_max_size" json:"logMaxSize"`
	LogMaxAge         int            `toml:"log_max_age" json:"logMaxAge"`
	LogMaxBackups     int            `toml:"log_max_backups" json:"logMaxBackups"`
	Compositor        CompositorType `toml:"compositor" json:"compositor"`
}

// SwwwConfig represents the swww configuration
type SwwwConfig struct {
	// Image display options
	ResizeType ResizeType `toml:"resize_type" json:"resizeType"`
	FillColor  string     `toml:"fill_color" json:"fillColor"`
	FilterType FilterType `toml:"filter_type" json:"filterType"`

	// Transition configuration
	TransitionType     TransitionType `toml:"transition_type" json:"transitionType"`
	TransitionStep     int            `toml:"transition_step" json:"transitionStep"`
	TransitionDuration int            `toml:"transition_duration" json:"transitionDuration"`
	TransitionFPS      int            `toml:"transition_fps" json:"transitionFPS"`
	TransitionAngle    int            `toml:"transition_angle" json:"transitionAngle"`
	TransitionPos      string         `toml:"transition_pos" json:"transitionPos"`
	TransitionBezier   string         `toml:"transition_bezier" json:"transitionBezier"`
	TransitionWave     string         `toml:"transition_wave" json:"transitionWave"`
	InvertY            bool           `toml:"invert_y" json:"invertY"`

	// Position configuration (for transitions)
	PositionX float64 `toml:"position_x" json:"positionX"`
	PositionY float64 `toml:"position_y" json:"positionY"`
}

// BackendConfig represents backend configuration
type BackendConfig struct {
	Type BackendType `toml:"type" json:"type"`
	Swww SwwwConfig  `toml:"swww" json:"swww"`
	// TODO: Implement more backends in future implementations
}

// MonitorsConfig represents monitors configuration
type MonitorsConfig struct {
	SelectedMonitors []string    `toml:"selected_monitors" json:"selectedMonitors"`
	ImageSetType     MonitorMode `toml:"image_set_type" json:"imageSetType"`
}

// UnifiedConfig represents the complete configuration
type UnifiedConfig struct {
	App      AppConfig      `toml:"app" json:"app"`
	Daemon   DaemonConfig   `toml:"daemon" json:"daemon"`
	Backend  BackendConfig  `toml:"backend" json:"backend"`
	Monitors MonitorsConfig `toml:"monitors" json:"monitors"`
}

// ============================================================================
// IPC STRUCTS
// ============================================================================

// IPCMessage represents IPC message structure
type IPCMessage struct {
	Action               string            `toml:"action" json:"action"`
	PlaylistID           int64             `toml:"playlist_id,omitempty" json:"playlistId,omitempty"`
	PlaylistName         string            `toml:"playlist_name,omitempty" json:"playlistName,omitempty"`
	Playlist             *Playlist         `toml:"playlist,omitempty" json:"playlist,omitempty"`
	ImageIDs             []int64           `toml:"image_ids,omitempty" json:"imageIds,omitempty"`
	ImagePaths           []string          `toml:"image_paths,omitempty" json:"imagePaths,omitempty"`
	FileNames            []string          `toml:"file_names,omitempty" json:"fileNames,omitempty"`
	CacheDir             string            `toml:"cache_dir,omitempty" json:"cacheDir,omitempty"`
	ThumbnailsDir        string            `toml:"thumbnails_dir,omitempty" json:"thumbnailsDir,omitempty"`
	Image                *ImageInfo        `toml:"image,omitempty" json:"image,omitempty"`
	ActiveMonitor        *MonitorSelection `toml:"active_monitor,omitempty" json:"activeMonitor,omitempty"`
	Monitors             []string          `toml:"monitors" json:"monitors"`
	SelectedImagesLength int               `toml:"selected_images_length,omitempty" json:"selectedImagesLength,omitempty"`
	MonitorName          string            `toml:"monitor_name,omitempty" json:"monitorName,omitempty"`
	Config               *ConfigData       `toml:"config,omitempty" json:"config,omitempty"`
}

// ConfigData represents configuration data for IPC
type ConfigData struct {
	ConfigSection  string         `toml:"config_section,omitempty" json:"configSection,omitempty"`
	ConfigKey      string         `toml:"config_key,omitempty" json:"configKey,omitempty"`
	ConfigValue    any            `toml:"config_value,omitempty" json:"configValue,omitempty"`
	FrontendConfig *UnifiedConfig `toml:"frontend_config,omitempty" json:"frontendConfig,omitempty"`
}

// IPCResponse represents IPC response structure
type IPCResponse struct {
	Action    string  `toml:"action" json:"action"`
	MessageID *int64  `toml:"message_id,omitempty" json:"messageId,omitempty"`
	Data      any     `toml:"data,omitempty" json:"data,omitempty"`
	Error     *string `toml:"error,omitempty" json:"error,omitempty"`
}

// ============================================================================
// EVENT STRUCTS
// ============================================================================

// EventType defines the type of event
type EventType string

const (
	EventTypeImageChanged    EventType = "image_changed"
	EventTypePlaylistChanged EventType = "playlist_changed"
	EventTypeMonitorChanged  EventType = "monitor_changed"
	EventTypeConfigChanged   EventType = "config_changed"
	EventTypeError           EventType = "error"
)

// Event represents a real-time event from the daemon
type Event struct {
	Type     EventType     `toml:"type" json:"type"`
	Payload  any           `toml:"payload" json:"payload"`
	Metadata EventMetadata `toml:"metadata" json:"metadata"`
}

// EventMetadata contains rich metadata for events
type EventMetadata struct {
	// Timestamp when this event occurred
	Timestamp string `toml:"timestamp" json:"timestamp"`

	// Image-specific metadata for wallpaper/image events
	Image *ImageEventMetadata `toml:"image,omitempty" json:"image,omitempty"`

	// Playlist-specific metadata for playlist events
	Playlist *PlaylistEventMetadata `toml:"playlist,omitempty" json:"playlist,omitempty"`

	// Monitor-specific metadata
	Monitor *MonitorEventMetadata `toml:"monitor,omitempty" json:"monitor,omitempty"`

	// Configuration-specific metadata
	Config *ConfigEventMetadata `toml:"config,omitempty" json:"config,omitempty"`
}

// ImageEventMetadata contains metadata for image-related events
type ImageEventMetadata struct {
	ID            int64  `toml:"id" json:"id"`                                            // Database ID
	Name          string `toml:"name" json:"name"`                                        // File name
	Path          string `toml:"path" json:"path"`                                        // Full filesystem path
	ThumbnailPath string `toml:"thumbnail_path,omitempty" json:"thumbnailPath,omitempty"` // Thumbnail path
	Width         int    `toml:"width" json:"width"`                                      // Image width
	Height        int    `toml:"height" json:"height"`                                    // Image height
	Format        string `toml:"format" json:"format"`                                    // Image format (jpg, png, etc.)
	Size          int64  `toml:"size" json:"size"`                                        // File size in bytes
}

// PlaylistEventMetadata contains metadata for playlist-related events
type PlaylistEventMetadata struct {
	ID               int64  `toml:"id" json:"id"`
	Name             string `toml:"name" json:"name"`
	Type             string `toml:"type" json:"type"`
	ImageIndex       int64  `toml:"image_index" json:"imageIndex"`
	TotalImages      int    `toml:"total_images" json:"totalImages"`
	ImageChangeTime  *int64 `toml:"image_change_time,omitempty" json:"imageChangeTime,omitempty"`
	TimeToNextChange *int64 `toml:"time_to_next_change,omitempty" json:"timeToNextChange,omitempty"`
	Interval         *int64 `toml:"interval,omitempty" json:"interval,omitempty"`
	IsActive         bool   `toml:"is_active" json:"isActive"`
	IsPaused         bool   `toml:"is_paused" json:"isPaused"`
}

// MonitorEventMetadata contains metadata for monitor-related events
type MonitorEventMetadata struct {
	Name         string              `toml:"name" json:"name"`
	Width        int                 `toml:"width" json:"width"`
	Height       int                 `toml:"height" json:"height"`
	Position     *Position           `toml:"position,omitempty" json:"position,omitempty"`
	CurrentImage *ImageEventMetadata `toml:"current_image,omitempty" json:"currentImage,omitempty"`
	Selected     bool                `toml:"selected" json:"selected"`
}

// ConfigEventMetadata contains metadata for config-related events
type ConfigEventMetadata struct {
	ConfigType string `toml:"config_type" json:"configType"`
	Key        string `toml:"key" json:"key"`
	OldValue   any    `toml:"old_value,omitempty" json:"oldValue,omitempty"`
	NewValue   any    `toml:"new_value,omitempty" json:"newValue,omitempty"`
}
