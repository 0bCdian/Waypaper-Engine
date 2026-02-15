// Package hyprpaper defines the configuration types for the hyprpaper wallpaper backend.
//
// hyprpaper is a Wayland wallpaper daemon designed for Hyprland.
// It requires a daemon process and supports per-monitor wallpapers,
// but does not support animated transitions.
// See: https://github.com/hyprwm/hyprpaper
package hyprpaper

// Config holds all hyprpaper-specific configuration.
type Config struct {
	// Splash controls whether hyprpaper shows its splash screen on startup.
	Splash bool `mapstructure:"splash" json:"splash"`

	// IPC controls whether hyprpaper enables its IPC socket for runtime commands.
	// Must be true for the daemon to control it after startup.
	IPC bool `mapstructure:"ipc" json:"ipc"`
}
