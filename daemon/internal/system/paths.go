// Package system provides OS-level utilities: XDG path resolution, tilde expansion,
// directory creation, and PID file (lock) management.
package system

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"
)

const appName = "waypaper-engine"

// ExpandPath resolves ~ and environment variables in a path string.
// "~" or "~/" is replaced with the current user's home directory.
// Environment variables in the form $VAR or ${VAR} are expanded.
func ExpandPath(path string) string {
	if path == "" {
		return path
	}

	// Expand ~ to home directory.
	if path == "~" || strings.HasPrefix(path, "~/") {
		home, err := os.UserHomeDir()
		if err == nil {
			path = filepath.Join(home, path[1:])
		}
	}

	// Expand environment variables ($VAR, ${VAR}).
	path = os.ExpandEnv(path)

	return filepath.Clean(path)
}

// EnsureDir creates the directory (and all parents) at the given path if it
// does not already exist. Permissions are set to 0700 (owner only).
func EnsureDir(path string) error {
	if err := os.MkdirAll(path, 0700); err != nil {
		return fmt.Errorf("system: create directory %s: %w", path, err)
	}
	return nil
}

// EnsureParentDir creates the parent directory of the given file path.
func EnsureParentDir(filePath string) error {
	return EnsureDir(filepath.Dir(filePath))
}

// --- XDG Base Directory helpers ---
// These follow the XDG Base Directory Specification:
// https://specifications.freedesktop.org/basedir-spec/latest/

// RuntimeDir returns $XDG_RUNTIME_DIR.
// Falls back to /tmp/<appName>-<uid> if the env var is unset.
func RuntimeDir() string {
	if dir := os.Getenv("XDG_RUNTIME_DIR"); dir != "" {
		return dir
	}
	return filepath.Join(os.TempDir(), fmt.Sprintf("%s-%d", appName, os.Getuid()))
}

// DataHome returns $XDG_DATA_HOME/<appName>.
// Falls back to ~/.local/share/<appName> if the env var is unset.
func DataHome() string {
	base := os.Getenv("XDG_DATA_HOME")
	if base == "" {
		home, err := os.UserHomeDir()
		if err != nil {
			home = "."
		}
		base = filepath.Join(home, ".local", "share")
	}
	return filepath.Join(base, appName)
}

// CacheHome returns $XDG_CACHE_HOME/<appName>.
// Falls back to ~/.cache/<appName> if the env var is unset.
func CacheHome() string {
	base := os.Getenv("XDG_CACHE_HOME")
	if base == "" {
		home, err := os.UserHomeDir()
		if err != nil {
			home = "."
		}
		base = filepath.Join(home, ".cache")
	}
	return filepath.Join(base, appName)
}

// ConfigHome returns $XDG_CONFIG_HOME/<appName>.
// Falls back to ~/.config/<appName> if the env var is unset.
func ConfigHome() string {
	base := os.Getenv("XDG_CONFIG_HOME")
	if base == "" {
		home, err := os.UserHomeDir()
		if err != nil {
			home = "."
		}
		base = filepath.Join(home, ".config")
	}
	return filepath.Join(base, appName)
}

// UniquePath returns path unchanged if nothing exists there.
// Otherwise it appends _1, _2, … before the extension until it finds a free name.
func UniquePath(path string) string {
	if _, err := os.Stat(path); os.IsNotExist(err) {
		return path
	}
	ext := filepath.Ext(path)
	base := strings.TrimSuffix(path, ext)
	for i := 1; ; i++ {
		candidate := fmt.Sprintf("%s_%d%s", base, i, ext)
		if _, err := os.Stat(candidate); os.IsNotExist(err) {
			return candidate
		}
	}
}

// --- Default path helpers ---

// DefaultConfigPath returns the default config file location:
// $XDG_CONFIG_HOME/<appName>/config.toml
func DefaultConfigPath() string {
	return filepath.Join(ConfigHome(), "config.toml")
}

// DefaultSocketPath returns the default Unix socket path:
// $XDG_RUNTIME_DIR/<appName>.sock
func DefaultSocketPath() string {
	return filepath.Join(RuntimeDir(), appName+".sock")
}

// DefaultImagesDir returns the default image cache directory:
// $XDG_DATA_HOME/<appName>/images
func DefaultImagesDir() string {
	return filepath.Join(DataHome(), "images")
}

// DefaultThumbnailsDir returns the default thumbnails directory:
// $XDG_CACHE_HOME/<appName>/thumbnails
func DefaultThumbnailsDir() string {
	return filepath.Join(CacheHome(), "thumbnails")
}

// DefaultDatabaseDir returns the default CloverDB directory:
// $XDG_DATA_HOME/<appName>/db
func DefaultDatabaseDir() string {
	return filepath.Join(DataHome(), "db")
}

// DefaultLogFile returns the default log file path:
// $XDG_DATA_HOME/<appName>/daemon.log
func DefaultLogFile() string {
	return filepath.Join(DataHome(), "daemon.log")
}
