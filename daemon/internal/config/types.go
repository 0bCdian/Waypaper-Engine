package config

// Config is the top-level configuration structure.
// It mirrors the TOML file layout and the JSON shape returned by GET /config.
type Config struct {
	App       AppConfig       `mapstructure:"app"       json:"app"`
	Daemon    DaemonConfig    `mapstructure:"daemon"    json:"daemon"`
	Backend   BackendSection  `mapstructure:"backend"   json:"backend"`
	Monitors  MonitorsConfig  `mapstructure:"monitors"  json:"monitors"`
	Wallhaven WallhavenConfig `mapstructure:"wallhaven" json:"wallhaven"`
}

// AppConfig holds application-level settings that affect the Electron frontend
// and general daemon behavior.
type AppConfig struct {
	// KillDaemonOnExit controls whether the daemon stops when the Electron app closes.
	KillDaemonOnExit bool `mapstructure:"kill_daemon_on_exit" json:"kill_daemon_on_exit"`

	// Notifications enables/disables desktop notifications from the daemon.
	Notifications bool `mapstructure:"notifications" json:"notifications"`

	// StartMinimized controls whether the app window starts hidden.
	StartMinimized bool `mapstructure:"start_minimized" json:"start_minimized"`

	// MinimizeInsteadOfClose makes the window minimize to tray instead of closing.
	MinimizeInsteadOfClose bool `mapstructure:"minimize_instead_of_close" json:"minimize_instead_of_close"`

	// ShowMonitorModalOnStart shows the monitor selection modal when the app starts.
	ShowMonitorModalOnStart bool `mapstructure:"show_monitor_modal_on_start" json:"show_monitor_modal_on_start"`

	// ImagesPerPage is the number of images shown per page in the gallery.
	ImagesPerPage int `mapstructure:"images_per_page" json:"images_per_page"`

	// Theme is the UI theme: "light", "dark", or "system".
	Theme string `mapstructure:"theme" json:"theme"`

	// ImageHistoryLimit is the maximum number of entries in the global wallpaper
	// history log. Oldest entries are trimmed when this limit is exceeded.
	ImageHistoryLimit int `mapstructure:"image_history_limit" json:"image_history_limit"`

	// SortBy is the default sort field for the image gallery: "name", "imported_at", "file_size".
	SortBy string `mapstructure:"sort_by" json:"sort_by"`

	// SortOrder is the default sort direction: "asc" or "desc".
	SortOrder string `mapstructure:"sort_order" json:"sort_order"`
}

// DaemonConfig holds daemon-specific settings (paths, logging, compositor).
type DaemonConfig struct {
	// ImagesDir is the directory where imported images are cached.
	ImagesDir string `mapstructure:"images_dir" json:"images_dir"`

	// ThumbnailsDir is the directory where generated thumbnails are stored.
	ThumbnailsDir string `mapstructure:"thumbnails_dir" json:"thumbnails_dir"`

	// DatabaseDir is the directory where the CloverDB database files are stored.
	// Defaults to "~/.local/share/waypaper-engine/db".
	DatabaseDir string `mapstructure:"database_dir" json:"database_dir"`

	// SocketPath is the path for the Unix domain socket the HTTP server listens on.
	SocketPath string `mapstructure:"socket_path" json:"socket_path"`

	// LogLevel controls the daemon's logging verbosity: "debug", "info", "warn", "error".
	LogLevel string `mapstructure:"log_level" json:"log_level"`

	// LogFile is the path to the log file for persistent logging.
	LogFile string `mapstructure:"log_file" json:"log_file"`

	// LogMaxSizeMB is the maximum size of a log file in megabytes before rotation.
	LogMaxSizeMB int `mapstructure:"log_max_size_mb" json:"log_max_size_mb"`

	// LogMaxBackups is the maximum number of rotated log files to keep.
	LogMaxBackups int `mapstructure:"log_max_backups" json:"log_max_backups"`

	// Compositor overrides compositor detection: "auto", "wayland", or "x11".
	// "auto" detects from environment variables.
	Compositor string `mapstructure:"compositor" json:"compositor"`
}

// BackendSection holds the active backend type selector.
// Per-backend configuration (e.g. awww transitions, feh mode) is accessed
// separately via ConfigManager.GetBackendConfig() — it is NOT part of this struct.
// This keeps the daemon core decoupled from backend-specific config shapes.
type BackendSection struct {
	// Type is the name of the active backend (e.g. "awww", "feh", "hyprpaper", "wayland-utauri").
	Type string `mapstructure:"type" json:"type"`

	// TransitionDurationSeconds is the canonical wallpaper transition length in seconds (float).
	// When > 0, wayland-utauri and awww map it to duration_ms / CLI seconds respectively.
	// When 0 or unset, each backend falls back to its legacy fields (duration_ms, transition_duration).
	TransitionDurationSeconds float64 `mapstructure:"transition_duration_seconds" json:"transition_duration_seconds,omitempty"`
}

// MonitorsConfig holds monitor selection and display mode preferences.
type MonitorsConfig struct {
	// SelectedMonitors is the list of monitor names the user has selected for
	// wallpaper operations (e.g. ["HDMI-A-1", "eDP-1"]).
	SelectedMonitors []string `mapstructure:"selected_monitors" json:"selected_monitors"`

	// ImageSetType is the default monitor mode: "individual", "clone", or "extend".
	ImageSetType string `mapstructure:"image_set_type" json:"image_set_type"`
}

// WallhavenConfig holds Wallhaven API integration settings.
type WallhavenConfig struct {
	// APIKey is the user's Wallhaven API key for accessing NSFW content and user-specific features.
	APIKey string `mapstructure:"api_key" json:"api_key"`

	// Enabled controls whether the Wallhaven integration is active.
	Enabled bool `mapstructure:"enabled" json:"enabled"`

	// ScrollMode controls the browsing mode: "paginated" for page-by-page or "infinite" for auto-loading.
	ScrollMode string `mapstructure:"scroll_mode" json:"scroll_mode"`
}
