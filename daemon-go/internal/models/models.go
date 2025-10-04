package models

// Position represents a 2D position
type Position struct {
	X int `json:"x"`
	Y int `json:"y"`
}

// Monitor represents a single display.
type Monitor struct {
	Name         string `json:"name"`
	Width        int    `json:"width"`
	Height       int    `json:"height"`
	CurrentImage string `json:"currentImage"`
	Position     struct {
		X int `json:"x"`
		Y int `json:"y"`
	} `json:"position"`
}

// WlrRandMonitor represents a wlr-randr monitor structure.
type WlrRandMonitor struct {
	Name         string `json:"name"`
	Description  string `json:"description"`
	Make         string `json:"make"`
	Model        string `json:"model"`
	Serial       string `json:"serial"`
	PhysicalSize struct {
		Width  int `json:"width"`
		Height int `json:"height"`
	} `json:"physical_size"`
	Enabled bool `json:"enabled"`
	Modes   []struct {
		Width     int  `json:"width"`
		Height    int  `json:"height"`
		Refresh   int  `json:"refresh"`
		Preferred bool `json:"preferred"`
		Current   bool `json:"current"`
	} `json:"modes"`
	Position struct {
		X int `json:"x"`
		Y int `json:"y"`
	} `json:"position"`
	Transform    string  `json:"transform"`
	Scale        float64 `json:"scale"`
	AdaptiveSync bool    `json:"adaptive_sync"`
}

// WlrOutput represents an array of wlr-randr monitors.
type WlrOutput []WlrRandMonitor

// ActiveMonitor represents the monitor configuration for a playlist.
type ActiveMonitor struct {
	Name                 string    `json:"name"`
	Monitors             []Monitor `json:"monitors"`
	ExtendAcrossMonitors bool      `json:"extendAcrossMonitors"`
}

// MonitorImagePair represents a monitor and its associated image path.
type MonitorImagePair struct {
	Monitor Monitor `json:"monitor"`
	Image   string  `json:"image"`
}

// Image represents an image file.
type Image struct {
	ID         int64  `json:"id"`
	Name       string `json:"name"`
	Path       string `json:"path"`
	IsChecked  bool   `json:"isChecked"`
	IsSelected bool   `json:"isSelected"`
	Width      int    `json:"width"`
	Height     int    `json:"height"`
	Format     string `json:"format"`
	Rating     int    `json:"rating"`
	Time       *int   `json:"time,omitempty"` // Corresponds to rendererImage's nullable time
}

// ImageFormat represents supported image formats.
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

// PlaylistType defines the type of the playlist.
type PlaylistType string

const (
	PlaylistTypeTimer     PlaylistType = "timer"
	PlaylistTypeNever     PlaylistType = "never"
	PlaylistTypeTimeOfDay PlaylistType = "timeofday"
	PlaylistTypeDayOfWeek PlaylistType = "dayofweek"
)

// PlaylistOrder defines the order of images in a playlist.
type PlaylistOrder string

const (
	PlaylistOrderOrdered PlaylistOrder = "ordered"
	PlaylistOrderRandom  PlaylistOrder = "random"
)

// Playlist represents a collection of images with its configuration.
type Playlist struct {
	ID                      int64         `json:"id"`
	Name                    string        `json:"name"`
	Type                    PlaylistType  `json:"type"`
	Interval                *int          `json:"interval,omitempty"`
	ShowAnimations          bool          `json:"showAnimations"`
	AlwaysStartOnFirstImage bool          `json:"alwaysStartOnFirstImage"`
	Order                   PlaylistOrder `json:"order,omitempty"`
	CurrentImageIndex       int64         `json:"currentImageIndex"`
	Images                  []Image       `json:"images"`
}

// AppConfig represents the application configuration.
type AppConfig struct {
	KillDaemon              bool   `json:"killDaemon"`
	Notifications           bool   `json:"notifications"`
	StartMinimized          bool   `json:"startMinimized"`
	MinimizeInsteadOfClose  bool   `json:"minimizeInsteadOfClose"`
	RandomImageMonitor      string `json:"randomImageMonitor"` // "clone" | "extend" | "individual"
	ShowMonitorModalOnStart bool   `json:"showMonitorModalOnStart"`
	ImagesPerPage           int    `json:"imagesPerPage"`
	ImageHistoryLimit       int    `json:"imageHistoryLimit"`
}

// ResizeType defines how images should be resized.
type ResizeType string

const (
	ResizeTypeCrop ResizeType = "crop"
	ResizeTypeFit  ResizeType = "fit"
	ResizeTypeNone ResizeType = "no"
)

// FilterType defines the filter algorithm for resizing.
type FilterType string

const (
	FilterTypeLanczos3   FilterType = "Lanczos3"
	FilterTypeBilinear   FilterType = "Bilinear"
	FilterTypeCatmullRom FilterType = "CatmullRom"
	FilterTypeMitchell   FilterType = "Mitchell"
	FilterTypeNearest    FilterType = "Nearest"
)

// TransitionType defines the transition effect.
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

// TransitionPosition defines the position for transitions.
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

// TransitionPositionType defines the type of position values.
type TransitionPositionType string

const (
	TransitionPositionTypeAlias TransitionPositionType = "alias"
	TransitionPositionTypeInt   TransitionPositionType = "int"
	TransitionPositionTypeFloat TransitionPositionType = "float"
)

// SwwwConfig represents the swww configuration.
type SwwwConfig struct {
	ResizeType               ResizeType             `json:"resizeType"`
	FillColor                string                 `json:"fillColor"`
	FilterType               FilterType             `json:"filterType"`
	TransitionType           TransitionType         `json:"transitionType"`
	TransitionStep           int                    `json:"transitionStep"`
	TransitionDuration       float64                `json:"transitionDuration"`
	TransitionFPS            int                    `json:"transitionFPS"`
	TransitionAngle          int                    `json:"transitionAngle"`
	TransitionPositionType   TransitionPositionType `json:"transitionPositionType"`
	TransitionPosition       TransitionPosition     `json:"transitionPosition"`
	TransitionPositionIntX   int                    `json:"transitionPositionIntX"`
	TransitionPositionIntY   int                    `json:"transitionPositionIntY"`
	TransitionPositionFloatX float64                `json:"transitionPositionFloatX"`
	TransitionPositionFloatY float64                `json:"transitionPositionFloatY"`
	InvertY                  bool                   `json:"invertY"`
	TransitionBezier         string                 `json:"transitionBezier"`
	TransitionWaveX          int                    `json:"transitionWaveX"`
	TransitionWaveY          int                    `json:"transitionWaveY"`
}
