package contracts

import (
	"time"
)

// MonitorContract represents the basic monitor information contract
type MonitorContract struct {
	Name           string           `json:"name"`
	Width          int              `json:"width"`
	Height         int              `json:"height"`
	Position       PositionContract `json:"position"`
	CurrentImage   string           `json:"currentImage"`
	Make           *string          `json:"make,omitempty"`
	Model          *string          `json:"model,omitempty"`
	RefreshRate    *float64         `json:"refreshRate,omitempty"`
	Scale          *int32           `json:"scale,omitempty"`
	Transform      *int32           `json:"transform,omitempty"`
	PhysicalWidth  *int32           `json:"physicalWidth,omitempty"`
	PhysicalHeight *int32           `json:"physicalHeight,omitempty"`
}

// PositionContract represents a 2D position
type PositionContract struct {
	X int `json:"x"`
	Y int `json:"y"`
}

// MonitorSelectionContract represents monitor configuration for operations
type MonitorSelectionContract struct {
	ID       string                   `json:"id"`
	Monitors []MonitorContract        `json:"monitors"`
	Mode     string                   `json:"mode"` // "individual", "extend", or "clone"
	Metadata *MonitorMetadataContract `json:"metadata,omitempty"`
}

// MonitorMetadataContract contains metadata for monitor selections
type MonitorMetadataContract struct {
	CreatedAt *time.Time `json:"createdAt,omitempty"`
	LastUsed  *time.Time `json:"lastUsed,omitempty"`
	UserLabel *string    `json:"userLabel,omitempty"`
}

// ImageContract represents image information
type ImageContract struct {
	ID         int64  `json:"id"`
	Name       string `json:"name"`
	Path       string `json:"path"`
	Width      int    `json:"width"`
	Height     int    `json:"height"`
	Format     string `json:"format"`
	Rating     *int   `json:"rating,omitempty"`
	Time       *int   `json:"time,omitempty"` // For playlist-specific timing
	IsChecked  *bool  `json:"isChecked,omitempty"`
	IsSelected *bool  `json:"isSelected,omitempty"`
}

// PlaylistContract represents playlist structure
type PlaylistContract struct {
	ID                      int64           `json:"id"`
	Name                    string          `json:"name"`
	Type                    string          `json:"type"` // "timer", "never", "timeofday", "dayofweek"
	Interval                *int            `json:"interval,omitempty"`
	ShowAnimations          bool            `json:"showAnimations"`
	AlwaysStartOnFirstImage bool            `json:"alwaysStartOnFirstImage"`
	Order                   *string         `json:"order,omitempty"` // "ordered" or "random"
	CurrentImageIndex       int64           `json:"currentImageIndex"`
	Images                  []ImageContract `json:"images"`
}

// PlaylistConfigurationContract represents playlist settings
type PlaylistConfigurationContract struct {
	Type                    string  `json:"type"`
	Interval                *int    `json:"interval,omitempty"`
	Order                   *string `json:"order,omitempty"`
	ShowAnimations          bool    `json:"showAnimations"`
	AlwaysStartOnFirstImage bool    `json:"alwaysStartOnFirstImage"`
	CurrentImageIndex       int64   `json:"currentImageIndex"`
}

// AppConfigContract represents application configuration
type AppConfigContract struct {
	KillDaemonOnExit        bool   `json:"kill_daemon_on_exit"`
	Notifications           bool   `json:"notifications"`
	StartMinimized          bool   `json:"start_minimized"`
	MinimizeInsteadOfClose  bool   `json:"minimize_instead_of_close"`
	RandomImageMonitor      string `json:"random_image_monitor"`
	ShowMonitorModalOnStart bool   `json:"show_monitor_modal_on_start"`
	ImagesPerPage           int    `json:"images_per_page"`
	Theme                   string `json:"theme"`
	SidebarCollapsed        bool   `json:"sidebar_collapsed"`
	SortBy                  string `json:"sort_by"`
	SortOrder               string `json:"sort_order"`
	ImageHistoryLimit       int    `json:"image_history_limit"`
}

// DaemonConfigContract represents daemon configuration
type DaemonConfigContract struct {
	DatabasePath      string `json:"database_path"`
	ImagesDir         string `json:"images_dir"`
	ThumbnailsDir     string `json:"thumbnails_dir"`
	MonitorsStateFile string `json:"monitors_state_file"`
	SocketPath        string `json:"socket_path"`
	LogLevel          string `json:"log_level"`
	LogFile           string `json:"log_file"`
	LogMaxSize        int    `json:"log_max_size"`
	LogMaxAge         int    `json:"log_max_age"`
	LogMaxBackups     int    `json:"log_max_backups"`
	Compositor        string `json:"compositor"`
}

// BackendConfigContract represents backend configuration
type BackendConfigContract struct {
	Type string             `json:"type"`
	Swww SwwwConfigContract `json:"swww"`
}

// SwwwConfigContract represents swww configuration
type SwwwConfigContract struct {
	TransitionType     string `json:"transition_type"`
	TransitionStep     int    `json:"transition_step"`
	TransitionDuration int    `json:"transition_duration"`
	TransitionAngle    int    `json:"transition_angle"`
	TransitionPos      string `json:"transition_pos"`
	TransitionBezier   string `json:"transition_bezier"`
	TransitionWave     string `json:"transition_wave"`
}

// MonitorsConfigContract represents monitors configuration
type MonitorsConfigContract struct {
	SelectedMonitors []string `json:"selected_monitors"`
	ImageSetType     string   `json:"image_set_type"`
}

// UnifiedConfigContract represents the complete configuration
type UnifiedConfigContract struct {
	App      AppConfigContract      `json:"app"`
	Daemon   DaemonConfigContract   `json:"daemon"`
	Backend  BackendConfigContract  `json:"backend"`
	Monitors MonitorsConfigContract `json:"monitors"`
}

// IPCMessageContract represents IPC message structure
type IPCMessageContract struct {
	Action               string                    `json:"action"`
	MessageID            *int64                    `json:"messageId,omitempty"`
	PlaylistID           *int64                    `json:"playlistId,omitempty"`
	PlaylistName         *string                   `json:"playlistName,omitempty"`
	Playlist             *PlaylistContract         `json:"playlist,omitempty"`
	ImageIDs             []int64                   `json:"imageIds,omitempty"`
	ImagePaths           []string                  `json:"imagePaths,omitempty"`
	FileNames            []string                  `json:"fileNames,omitempty"`
	CacheDir             *string                   `json:"cacheDir,omitempty"`
	ThumbnailsDir        *string                   `json:"thumbnailsDir,omitempty"`
	Image                *ImageInfoContract        `json:"image,omitempty"`
	ActiveMonitor        *MonitorSelectionContract `json:"activeMonitor,omitempty"`
	Monitors             []string                  `json:"monitors,omitempty"`
	SelectedImagesLength *int                      `json:"selectedImagesLength,omitempty"`
	MonitorName          *string                   `json:"monitorName,omitempty"`
	Config               *ConfigDataContract       `json:"config,omitempty"`
}

// ImageInfoContract represents basic image information for IPC
type ImageInfoContract struct {
	ID   int64  `json:"id"`
	Name string `json:"name"`
}

// ConfigDataContract represents configuration data for IPC
type ConfigDataContract struct {
	ConfigSection  *string                `json:"configSection,omitempty"`
	ConfigKey      *string                `json:"configKey,omitempty"`
	ConfigValue    any                    `json:"configValue,omitempty"`
	FrontendConfig *UnifiedConfigContract `json:"frontendConfig,omitempty"`
}

// IPCResponseContract represents IPC response structure
type IPCResponseContract struct {
	Action    string  `json:"action"`
	MessageID *int64  `json:"messageId,omitempty"`
	Data      any     `json:"data,omitempty"`
	Error     *string `json:"error,omitempty"`
}

// EventContract represents event structure
type EventContract struct {
	Type     string                `json:"type"`
	Payload  any                   `json:"payload"`
	Metadata EventMetadataContract `json:"metadata"`
}

// EventMetadataContract represents event metadata
type EventMetadataContract struct {
	Timestamp string                         `json:"timestamp"`
	Image     *ImageEventMetadataContract    `json:"image,omitempty"`
	Playlist  *PlaylistEventMetadataContract `json:"playlist,omitempty"`
	Monitor   *MonitorEventMetadataContract  `json:"monitor,omitempty"`
	Config    *ConfigEventMetadataContract   `json:"config,omitempty"`
}

// ImageEventMetadataContract represents image event metadata
type ImageEventMetadataContract struct {
	ID            int64   `json:"id"`
	Name          string  `json:"name"`
	Path          string  `json:"path"`
	ThumbnailPath *string `json:"thumbnailPath,omitempty"`
	Width         int     `json:"width"`
	Height        int     `json:"height"`
	Format        string  `json:"format"`
	Size          int64   `json:"size"`
}

// PlaylistEventMetadataContract represents playlist event metadata
type PlaylistEventMetadataContract struct {
	ID               int64  `json:"id"`
	Name             string `json:"name"`
	Type             string `json:"type"`
	ImageIndex       int64  `json:"imageIndex"`
	TotalImages      int    `json:"totalImages"`
	ImageChangeTime  *int64 `json:"imageChangeTime,omitempty"`
	TimeToNextChange *int64 `json:"timeToNextChange,omitempty"`
	Interval         *int64 `json:"interval,omitempty"`
	IsActive         bool   `json:"isActive"`
	IsPaused         bool   `json:"isPaused"`
}

// MonitorEventMetadataContract represents monitor event metadata
type MonitorEventMetadataContract struct {
	Name         string                      `json:"name"`
	Width        int                         `json:"width"`
	Height       int                         `json:"height"`
	Position     *PositionContract           `json:"position,omitempty"`
	CurrentImage *ImageEventMetadataContract `json:"currentImage,omitempty"`
	Selected     bool                        `json:"selected"`
}

// ConfigEventMetadataContract represents config event metadata
type ConfigEventMetadataContract struct {
	ConfigType string `json:"configType"`
	Key        string `json:"key"`
	OldValue   any    `json:"oldValue,omitempty"`
	NewValue   any    `json:"newValue,omitempty"`
}

// ContractFactory provides utility functions for creating contracts
type ContractFactory struct{}

// NewContractFactory creates a new contract factory
func NewContractFactory() *ContractFactory {
	return &ContractFactory{}
}

// CreateMonitorSelection creates a monitor selection contract
func (cf *ContractFactory) CreateMonitorSelection(
	monitors []MonitorContract,
	mode string,
	userLabel *string,
) MonitorSelectionContract {
	id := ""
	for i, monitor := range monitors {
		if i > 0 {
			id += ","
		}
		id += monitor.Name
	}

	now := time.Now()
	metadata := &MonitorMetadataContract{
		CreatedAt: &now,
		LastUsed:  &now,
		UserLabel: userLabel,
	}

	return MonitorSelectionContract{
		ID:       id,
		Monitors: monitors,
		Mode:     mode,
		Metadata: metadata,
	}
}

// CreatePlaylist creates a playlist contract
func (cf *ContractFactory) CreatePlaylist(
	name string,
	playlistType string,
	images []ImageContract,
	options *PlaylistConfigurationContract,
) PlaylistContract {
	config := &PlaylistConfigurationContract{
		ShowAnimations:          true,
		AlwaysStartOnFirstImage: false,
		CurrentImageIndex:       0,
	}

	if options != nil {
		config.Interval = options.Interval
		config.Order = options.Order
		config.ShowAnimations = options.ShowAnimations
		config.AlwaysStartOnFirstImage = options.AlwaysStartOnFirstImage
		config.CurrentImageIndex = options.CurrentImageIndex
	}

	return PlaylistContract{
		ID:                      0, // Will be set by the daemon
		Name:                    name,
		Type:                    playlistType,
		Interval:                config.Interval,
		ShowAnimations:          config.ShowAnimations,
		AlwaysStartOnFirstImage: config.AlwaysStartOnFirstImage,
		Order:                   config.Order,
		CurrentImageIndex:       config.CurrentImageIndex,
		Images:                  images,
	}
}

// CreateImage creates an image contract
func (cf *ContractFactory) CreateImage(
	id int64,
	name string,
	path string,
	width int,
	height int,
	format string,
	options *ImageContract,
) ImageContract {
	image := ImageContract{
		ID:     id,
		Name:   name,
		Path:   path,
		Width:  width,
		Height: height,
		Format: format,
	}

	if options != nil {
		image.Rating = options.Rating
		image.Time = options.Time
		image.IsChecked = options.IsChecked
		image.IsSelected = options.IsSelected
	}

	return image
}

// Validation functions for contracts
func IsValidMonitorMode(mode string) bool {
	validModes := []string{"individual", "extend", "clone"}
	for _, validMode := range validModes {
		if mode == validMode {
			return true
		}
	}
	return false
}

func IsValidPlaylistType(playlistType string) bool {
	validTypes := []string{"timer", "never", "timeofday", "dayofweek"}
	for _, validType := range validTypes {
		if playlistType == validType {
			return true
		}
	}
	return false
}

func IsValidPlaylistOrder(order string) bool {
	validOrders := []string{"ordered", "random"}
	for _, validOrder := range validOrders {
		if order == validOrder {
			return true
		}
	}
	return false
}

func IsValidTheme(theme string) bool {
	validThemes := []string{"light", "dark", "auto", "system"}
	for _, validTheme := range validThemes {
		if theme == validTheme {
			return true
		}
	}
	return false
}

func IsValidLogLevel(level string) bool {
	validLevels := []string{"debug", "info", "warn", "error"}
	for _, validLevel := range validLevels {
		if level == validLevel {
			return true
		}
	}
	return false
}

func IsValidBackendType(backendType string) bool {
	validTypes := []string{"swww", "feh", "nitrogen", "hyprpaper", "wallutils", "custom"}
	for _, validType := range validTypes {
		if backendType == validType {
			return true
		}
	}
	return false
}

func IsValidCompositor(compositor string) bool {
	validCompositors := []string{"auto", "x11", "wayland", "sway", "hyprland", "gnome", "kde"}
	for _, validCompositor := range validCompositors {
		if compositor == validCompositor {
			return true
		}
	}
	return false
}
