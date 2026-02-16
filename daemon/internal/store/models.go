// Package store defines the data models, store interfaces, and database abstraction
// for the daemon's persistence layer.
//
// Persistence is backed by CloverDB (github.com/ostafen/clover/v2), a lightweight
// embedded document-oriented NoSQL database. Each resource type maps to a CloverDB
// collection:
//
//   - "images"    — the image gallery
//   - "playlists" — user-created playlists
//   - "history"   — global wallpaper history log
//
// Runtime state (active playlists, current wallpapers) is kept in-memory only
// and is NOT persisted — it is reconstructed on daemon startup.
//
// All model structs carry both `json` tags (for HTTP API serialization) and `clover`
// tags (for CloverDB document mapping). The `_id` field managed by CloverDB is an
// internal detail; the API-facing identifier is the sequential integer `id` field.
package store

import "time"

// ---------------------------------------------------------------------------
// Image
// ---------------------------------------------------------------------------

// Image represents a wallpaper file imported into the gallery.
// Stored in the "images" collection.
type Image struct {
	// ID is the sequential integer identifier, generated daemon-side.
	// This is the API-facing primary key (NOT CloverDB's internal _id).
	ID int `json:"id" clover:"id"`

	// Name is the display name, derived from the original filename.
	Name string `json:"name" clover:"name"`

	// Path is the absolute path to the cached copy of the image inside ImagesDir.
	Path string `json:"path" clover:"path"`

	// MediaType classifies the file: "image", "video", "gif".
	MediaType string `json:"media_type" clover:"media_type"`

	// Width is the horizontal resolution in pixels.
	Width int `json:"width" clover:"width"`

	// Height is the vertical resolution in pixels.
	Height int `json:"height" clover:"height"`

	// Format is the file format (e.g. "png", "jpg", "webp").
	Format string `json:"format" clover:"format"`

	// FileSize is the size of the file in bytes.
	FileSize int64 `json:"file_size" clover:"file_size"`

	// Checksum is a content hash for deduplication (e.g. "sha256:abc123...").
	Checksum string `json:"checksum" clover:"checksum"`

	// Tags is a user-defined list of labels for organization and filtering.
	Tags []string `json:"tags" clover:"tags"`

	// ImportedAt is when the image was added to the gallery.
	ImportedAt time.Time `json:"imported_at" clover:"imported_at"`

	// SourcePath is the original filesystem path the image was imported from.
	SourcePath string `json:"source_path" clover:"source_path"`

	// IsSelected tracks whether the user has selected this image in the UI
	// (for batch operations).
	IsSelected bool `json:"is_selected" clover:"is_selected"`

	// Thumbnails maps resolution labels to their absolute file paths.
	// Keys: "default", "720p", "1080p", "1440p", "4k".
	Thumbnails map[string]string `json:"thumbnails" clover:"thumbnails"`
}

// ImageUpdate contains the mutable fields for PATCH /images/{id}.
// Only non-nil / non-zero fields are applied.
type ImageUpdate struct {
	Name       *string   `json:"name,omitempty"`
	Tags       *[]string `json:"tags,omitempty"`
	IsSelected *bool     `json:"is_selected,omitempty"`
}

// ---------------------------------------------------------------------------
// Image History
// ---------------------------------------------------------------------------

// ImageHistoryEntry is a single transaction in the global wallpaper history log.
// Every wallpaper change — manual, playlist, random, or history replay — appends
// one entry. Stored in the "history" collection.
//
// The ID is sequential and ever-incrementing. When the log exceeds the configured
// limit (default 1000), the oldest entries are trimmed.
type ImageHistoryEntry struct {
	// ID is the sequential, ever-incrementing transaction identifier.
	ID int `json:"id" clover:"id"`

	// ImageID references the Image that was set.
	ImageID int `json:"image_id" clover:"image_id"`

	// ImageName is denormalized from the Image for display convenience.
	ImageName string `json:"image_name" clover:"image_name"`

	// Monitors lists which monitors were affected. Multiple monitors for
	// clone/extend mode; single monitor for individual mode.
	Monitors []string `json:"monitors" clover:"monitors"`

	// Mode is the monitor mode used: "individual", "clone", or "extend".
	Mode string `json:"mode" clover:"mode"`

	// SetAt is when this wallpaper change occurred.
	SetAt time.Time `json:"set_at" clover:"set_at"`

	// Source describes what caused this wallpaper change.
	Source HistorySource `json:"source" clover:"source"`

	// Backend is the name of the backend that applied the wallpaper (e.g. "swww").
	Backend string `json:"backend" clover:"backend"`
}

// HistorySource identifies the origin of a wallpaper change.
type HistorySource struct {
	// Type is the source category: "manual", "playlist", "random", or "history".
	Type string `json:"type" clover:"type"`

	// PlaylistID is set when Type is "playlist".
	PlaylistID *int `json:"playlist_id,omitempty" clover:"playlist_id"`

	// PlaylistName is set when Type is "playlist".
	PlaylistName string `json:"playlist_name,omitempty" clover:"playlist_name"`

	// HistoryID is set when Type is "history" (replaying a previous entry).
	HistoryID *int `json:"history_id,omitempty" clover:"history_id"`
}

// ---------------------------------------------------------------------------
// Playlist
// ---------------------------------------------------------------------------

// Playlist is a user-defined collection of images with playback configuration.
// Stored in the "playlists" collection.
type Playlist struct {
	// ID is the sequential integer identifier, generated daemon-side.
	ID int `json:"id" clover:"id"`

	// Name is the user-facing display name (e.g. "Evening rotation").
	Name string `json:"name" clover:"name"`

	// CreatedAt is when the playlist was first created.
	CreatedAt time.Time `json:"created_at" clover:"created_at"`

	// UpdatedAt is when the playlist was last modified.
	UpdatedAt time.Time `json:"updated_at" clover:"updated_at"`

	// Configuration holds the playback behavior settings.
	Configuration PlaylistConfiguration `json:"configuration" clover:"configuration"`

	// Images is the ordered list of images in this playlist.
	Images []PlaylistImage `json:"images" clover:"images"`
}

// PlaylistConfiguration defines how a playlist rotates through its images.
type PlaylistConfiguration struct {
	// Type is the rotation strategy: "timer", "manual", "time_of_day", "day_of_week".
	Type string `json:"type" clover:"type"`

	// Interval is the rotation period in seconds (only used for "timer" type).
	Interval int `json:"interval" clover:"interval"`

	// Order is the playback order: "ordered" or "random" (only used for "timer" type).
	Order string `json:"order" clover:"order"`

	// ShowAnimations controls whether backend transitions are used during rotation.
	ShowAnimations bool `json:"show_animations" clover:"show_animations"`

	// AlwaysStartOnFirstImage forces the playlist to start from index 0 every time.
	AlwaysStartOnFirstImage bool `json:"always_start_on_first_image" clover:"always_start_on_first_image"`
}

// PlaylistImage is a reference to an image within a playlist, with optional
// time-of-day scheduling metadata.
type PlaylistImage struct {
	// ImageID references the Image in the gallery.
	ImageID int `json:"image_id" clover:"image_id"`

	// Time is minutes since midnight (0–1439), used by "time_of_day" playlists.
	// Nil for other playlist types.
	Time *int `json:"time" clover:"time"`
}

// ---------------------------------------------------------------------------
// Monitor State (persisted to CloverDB)
// ---------------------------------------------------------------------------

// MonitorState tracks the current wallpaper on a specific monitor.
// Stored in the "monitor_state" collection, one document per monitor.
// This is persisted so the daemon can restore wallpapers after restart.
type MonitorState struct {
	// MonitorName is the unique key — one entry per monitor.
	MonitorName string `json:"monitor_name" clover:"monitor_name"`

	// ImageID references the currently displayed image.
	ImageID int `json:"image_id" clover:"image_id"`

	// ImageName is denormalized for display convenience.
	ImageName string `json:"image_name" clover:"image_name"`

	// ImagePath is the absolute path to the image file on disk.
	ImagePath string `json:"image_path" clover:"image_path"`

	// Mode is the monitor mode used: "individual", "clone", or "extend".
	Mode string `json:"mode" clover:"mode"`

	// Backend is the name of the backend that applied the wallpaper.
	Backend string `json:"backend" clover:"backend"`

	// SetAt is when this wallpaper was applied.
	SetAt time.Time `json:"set_at" clover:"set_at"`
}

// ---------------------------------------------------------------------------
// Runtime State (in-memory only, NOT persisted to CloverDB)
// ---------------------------------------------------------------------------

// ActivePlaylistInstance represents a running playlist on a specific monitor.
// This is ephemeral runtime state — it is NOT stored in CloverDB.
// Returned by GET /playlists/active.
type ActivePlaylistInstance struct {
	PlaylistID      int        `json:"playlist_id"`
	PlaylistName    string     `json:"playlist_name"`
	CurrentIndex    int        `json:"current_index"`
	CurrentImageID  int        `json:"current_image_id"`
	PreviousImageID *int       `json:"previous_image_id"`
	NextImageID     *int       `json:"next_image_id"`
	TotalImages     int        `json:"total_images"`
	Paused          bool       `json:"paused"`
	Mode            string     `json:"mode"`
	StartedAt       time.Time  `json:"started_at"`
	NextChangeAt    *time.Time `json:"next_change_at"`
}
