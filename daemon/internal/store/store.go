package store

import (
	"context"
	"errors"
)

// ErrNotFound is returned when a requested entity does not exist.
var ErrNotFound = errors.New("not found")

// ---------------------------------------------------------------------------
// Pagination & Query types
// ---------------------------------------------------------------------------

// PaginatedResult wraps a page of results with pagination metadata.
type PaginatedResult[T any] struct {
	Data       []T        `json:"data"`
	Pagination Pagination `json:"pagination"`
}

// Pagination holds the metadata for a paginated response.
type Pagination struct {
	Page       int `json:"page"`
	PerPage    int `json:"per_page"`
	TotalItems int `json:"total_items"`
	TotalPages int `json:"total_pages"`
}

// ColorNearConstraint limits images to those with at least one palette color
// within MaxDeltaE (CIE76, Euclidean in Lab) of Hex.
type ColorNearConstraint struct {
	Hex       string
	MaxDeltaE float64
}

// ImageQueryOpts controls filtering, sorting, and pagination for image queries.
type ImageQueryOpts struct {
	// Page number (1-indexed). Default: 1.
	Page int
	// Items per page. Default: 50, max: 200.
	PerPage int
	// Sort field: "name", "imported_at", "file_size". Default: "imported_at".
	SortBy string
	// Sort direction: "asc" or "desc". Default: "desc".
	SortOrder string
	// Filter by media type: "image", "video", "gif". Empty = no filter.
	MediaType string
	// Fuzzy search on name and tags. Empty = no search.
	Search string
	// Filter by tags (all must match). Empty = no filter.
	Tags []string
	// Filter by colors (each hex must appear as a stored palette swatch; AND). Empty = no filter.
	Colors []string
	// ColorsNear filters by CIE76 ΔE in Lab vs stored swatches (AND across constraints).
	// When non-empty, GetAll uses an in-memory filter path (same as text search).
	ColorsNear []ColorNearConstraint
	// FolderID filters images by folder. nil = no filter (all images).
	// A pointer to 0 means root level (images with no folder).
	// A pointer to a positive int means images in that specific folder.
	FolderID *int
}

// HistoryQueryOpts controls filtering and pagination for history queries.
type HistoryQueryOpts struct {
	// Maximum number of entries to return. Default: 50.
	Limit int
	// Filter by monitor name. Empty = all monitors.
	Monitor string
	// Only return entries with ID greater than this value (for polling). 0 = no filter.
	SinceID int
}

// ---------------------------------------------------------------------------
// ImageStore
// ---------------------------------------------------------------------------

// ImageStore manages the "images" CloverDB collection.
//
// All methods are goroutine-safe (CloverDB handles internal locking).
// IDs are sequential integers managed by the store, not CloverDB's auto-generated _id.
type ImageStore interface {
	// GetAll returns a paginated, filtered, sorted list of images.
	GetAll(ctx context.Context, opts ImageQueryOpts) (*PaginatedResult[Image], error)

	// GetByID returns a single image by its sequential ID.
	// Returns an error if not found.
	GetByID(ctx context.Context, id int) (*Image, error)

	// Create inserts one or more images into the collection.
	// IDs are assigned by the store (next sequential value).
	// Returns the created images with their assigned IDs.
	Create(ctx context.Context, images []Image) ([]Image, error)

	// Update applies a partial update to a single image.
	// Only fields present in the updates map are changed.
	// Returns the full updated image, or an error if not found.
	Update(ctx context.Context, id int, updates map[string]any) (*Image, error)

	// Delete removes images by their IDs. Also removes associated files and thumbnails
	// from disk (or delegates that to the caller — TBD during implementation).
	// Returns the number of images actually deleted.
	Delete(ctx context.Context, ids []int) (int, error)

	// UpdateAll applies a partial update to every image in the collection.
	// Returns the number of images updated.
	UpdateAll(ctx context.Context, updates map[string]any) (int, error)

	// GetAllTags returns all unique tags across every image in the collection.
	GetAllTags(ctx context.Context) ([]string, error)

	// Count returns the total number of images in the collection.
	Count(ctx context.Context) (int, error)

	// IsNameTaken reports whether any image other than excludeID already uses the given name.
	IsNameTaken(ctx context.Context, name string, excludeID int) (bool, error)
}

// ---------------------------------------------------------------------------
// FolderStore
// ---------------------------------------------------------------------------

// FolderStore manages the "folders" CloverDB collection.
type FolderStore interface {
	// GetAll returns all folders with the given parent ID.
	// parentID nil returns root-level folders.
	GetAll(ctx context.Context, parentID *int) ([]Folder, error)

	// GetByID returns a single folder by its sequential ID.
	GetByID(ctx context.Context, id int) (*Folder, error)

	// GetPath returns the ancestor chain from root to the given folder (inclusive).
	// Used for breadcrumb navigation.
	GetPath(ctx context.Context, id int) ([]Folder, error)

	// Create inserts a new folder. The ID is assigned by the store.
	Create(ctx context.Context, folder Folder) (*Folder, error)

	// Update applies a partial update to a folder.
	Update(ctx context.Context, id int, updates map[string]any) (*Folder, error)

	// Delete removes a folder by ID.
	Delete(ctx context.Context, id int) error

	// Search returns folders whose name matches the query (case-insensitive substring).
	Search(ctx context.Context, query string) ([]Folder, error)

	// Count returns the total number of folders.
	Count(ctx context.Context) (int, error)
}

// ---------------------------------------------------------------------------
// PlaylistStore
// ---------------------------------------------------------------------------

// PlaylistStore manages the "playlists" CloverDB collection.
type PlaylistStore interface {
	// GetAll returns all playlists.
	GetAll(ctx context.Context) ([]Playlist, error)

	// GetByID returns a single playlist by its sequential ID.
	// Returns an error if not found.
	GetByID(ctx context.Context, id int) (*Playlist, error)

	// Create inserts a new playlist. The ID is assigned by the store.
	// Returns the created playlist with its assigned ID and timestamps.
	Create(ctx context.Context, playlist Playlist) (*Playlist, error)

	// Update applies a partial update to a playlist.
	// Only fields present in the updates map are changed. UpdatedAt is set automatically.
	// Returns the full updated playlist, or an error if not found.
	Update(ctx context.Context, id int, updates map[string]any) (*Playlist, error)

	// SavePlaybackState writes only the playback subdocument (and updated_at).
	// Pass nil to clear persisted playback state.
	SavePlaybackState(ctx context.Context, id int, playback *PlaylistPlayback) error

	// Delete removes a playlist by ID.
	// Returns an error if not found.
	Delete(ctx context.Context, id int) error

	// Count returns the total number of playlists in the collection.
	Count(ctx context.Context) (int, error)
}

// ---------------------------------------------------------------------------
// HistoryStore
// ---------------------------------------------------------------------------

// HistoryStore manages the "history" CloverDB collection — the global wallpaper
// history log. This is an append-heavy, ordered collection with automatic trimming.
type HistoryStore interface {
	// Append adds a new entry to the history log.
	// The ID is assigned by the store (next sequential value).
	// Returns the entry with its assigned ID.
	Append(ctx context.Context, entry ImageHistoryEntry) (*ImageHistoryEntry, error)

	// GetRecent returns history entries in reverse chronological order (newest first),
	// with optional filtering by monitor and since_id.
	GetRecent(ctx context.Context, opts HistoryQueryOpts) ([]ImageHistoryEntry, error)

	// Count returns the total number of history entries.
	Count(ctx context.Context) (int, error)

	// Clear removes all history entries and resets the ID sequence.
	Clear(ctx context.Context) error
}

// ---------------------------------------------------------------------------
// MonitorStateStore
// ---------------------------------------------------------------------------

// MonitorStateStore manages the "monitor_state" CloverDB collection.
// It persists the current wallpaper for each monitor so the daemon can
// restore wallpapers after restart. One document per monitor (upsert pattern).
type MonitorStateStore interface {
	// Get returns the current wallpaper state for a specific monitor.
	// Returns nil and no error if the monitor has no persisted state.
	Get(ctx context.Context, monitorName string) (*MonitorState, error)

	// GetAll returns the persisted state for all monitors.
	GetAll(ctx context.Context) ([]MonitorState, error)

	// Set upserts the wallpaper state for a monitor.
	// If an entry for the monitor already exists, it is replaced.
	Set(ctx context.Context, state MonitorState) error

	// Remove deletes the persisted state for a monitor.
	Remove(ctx context.Context, monitorName string) error
}

// ---------------------------------------------------------------------------
// StateStore
// ---------------------------------------------------------------------------

// StateStore manages ephemeral runtime state that is NOT persisted to CloverDB.
// This includes active playlist instances and per-monitor current wallpaper tracking.
//
// All methods are goroutine-safe (implementation must use internal locking).
// State is lost on daemon restart and must be reconstructed from playlists/config.
type StateStore interface {
	// GetActivePlaylists returns all currently running playlist instances,
	// keyed by playlist ID.
	GetActivePlaylists() map[int]ActivePlaylistInstance

	// GetActivePlaylistByID returns the active playlist for a specific playlist ID.
	// Returns nil if the playlist is not running.
	GetActivePlaylistByID(playlistID int) *ActivePlaylistInstance

	// GetActivePlaylistForMonitor scans active playlists and returns the one
	// whose Monitors list contains the given monitor name.
	// Returns nil if no playlist is running on that monitor.
	GetActivePlaylistForMonitor(monitor string) *ActivePlaylistInstance

	// SetActivePlaylist registers a running playlist instance, keyed by PlaylistID.
	SetActivePlaylist(instance ActivePlaylistInstance)

	// UpdateActivePlaylist applies fn to the instance with the given playlist ID
	// under the write lock, avoiding a get-modify-set round-trip.
	// Returns false if the playlist ID is not found.
	UpdateActivePlaylist(playlistID int, fn func(*ActivePlaylistInstance)) bool

	// RemoveActivePlaylist removes the active playlist by playlist ID.
	// No-op if the playlist is not active.
	RemoveActivePlaylist(playlistID int)

	// RemoveAllActivePlaylists stops tracking all active playlists.
	RemoveAllActivePlaylists()

	// GetCurrentWallpaper returns the most recent history entry for a monitor.
	// Returns nil if no wallpaper has been set on that monitor since daemon start.
	GetCurrentWallpaper(monitor string) *ImageHistoryEntry

	// SetCurrentWallpaper records the most recent wallpaper change for a monitor.
	SetCurrentWallpaper(monitor string, entry ImageHistoryEntry)
}
