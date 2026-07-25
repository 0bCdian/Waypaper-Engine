package config

type Config struct {
	App       AppConfig       `mapstructure:"app"       json:"app"`
	Daemon    DaemonConfig    `mapstructure:"daemon"    json:"daemon"`
	Backend   BackendSection  `mapstructure:"backend"   json:"backend"`
	Monitors  MonitorsConfig  `mapstructure:"monitors"  json:"monitors"`
	Wallhaven WallhavenConfig `mapstructure:"wallhaven" json:"wallhaven"`
}

type AppConfig struct {
	KillDaemonOnExit        bool   `mapstructure:"kill_daemon_on_exit" json:"kill_daemon_on_exit"`
	Notifications           bool   `mapstructure:"notifications" json:"notifications"`
	StartMinimized          bool   `mapstructure:"start_minimized" json:"start_minimized"`
	MinimizeInsteadOfClose  bool   `mapstructure:"minimize_instead_of_close" json:"minimize_instead_of_close"`
	ShowMonitorModalOnStart bool   `mapstructure:"show_monitor_modal_on_start" json:"show_monitor_modal_on_start"`
	StartupIntro            bool   `mapstructure:"startup_intro" json:"startup_intro"`
	ImagesPerPage           int    `mapstructure:"images_per_page" json:"images_per_page"`
	Theme                   string `mapstructure:"theme" json:"theme"`
	FontPreset              string `mapstructure:"font_preset" json:"font_preset"`
	FontFamilyBody          string `mapstructure:"font_family_body" json:"font_family_body"`
	FontFamilyDisplay       string `mapstructure:"font_family_display" json:"font_family_display"`
	FontFamilyMono          string `mapstructure:"font_family_mono" json:"font_family_mono"`
	ImageHistoryLimit       int    `mapstructure:"image_history_limit" json:"image_history_limit"`
	SortBy                  string `mapstructure:"sort_by" json:"sort_by"`
	SortOrder               string `mapstructure:"sort_order" json:"sort_order"`
}

type DaemonConfig struct {
	ImagesDir     string `mapstructure:"images_dir" json:"images_dir"`
	ThumbnailsDir string `mapstructure:"thumbnails_dir" json:"thumbnails_dir"`
	DatabaseDir   string `mapstructure:"database_dir" json:"database_dir"`
	SocketPath    string `mapstructure:"socket_path" json:"socket_path"`
	LogLevel      string `mapstructure:"log_level" json:"log_level"`
	LogFile       string `mapstructure:"log_file" json:"log_file"`
	LogMaxSizeMB  int    `mapstructure:"log_max_size_mb" json:"log_max_size_mb"`
	LogMaxBackups int    `mapstructure:"log_max_backups" json:"log_max_backups"`
	Compositor    string `mapstructure:"compositor" json:"compositor"`
}

type BackendSection struct {
	Type                      string         `mapstructure:"type" json:"type"`
	TransitionDurationSeconds float64        `mapstructure:"transition_duration_seconds" json:"transition_duration_seconds,omitempty"`
	SelectionMode             string         `mapstructure:"selection_mode" json:"selection_mode"`
	AutoPriorities            AutoPriorities `mapstructure:"auto_priorities" json:"auto_priorities"`
}

type AutoPriorities struct {
	Image []string `mapstructure:"image" json:"image"`
	Video []string `mapstructure:"video" json:"video"`
	Web   []string `mapstructure:"web"   json:"web"`
}

type MonitorsConfig struct {
	SelectedMonitors []string `mapstructure:"selected_monitors" json:"selected_monitors"`
	ImageSetType     string   `mapstructure:"image_set_type" json:"image_set_type"`
}

type WallhavenConfig struct {
	APIKey             string `mapstructure:"api_key" json:"api_key"`
	Enabled            bool   `mapstructure:"enabled" json:"enabled"`
	ScrollMode         string `mapstructure:"scroll_mode" json:"scroll_mode"`
	BlurNsfwThumbnails bool   `mapstructure:"blur_nsfw_thumbnails" json:"blur_nsfw_thumbnails"`
}
