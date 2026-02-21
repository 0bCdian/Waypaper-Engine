package store

import "encoding/json"

// jsonValue converts a Go value to a JSON-compatible interface{} by marshaling
// to JSON then unmarshaling back. This ensures nested struct fields are stored
// with their JSON tag names (e.g. "image_id") instead of Go field names (e.g.
// "ImageID"). Required because CloverDB's Normalize uses Go field names, but
// its Unmarshal reads back via json.Unmarshal which expects JSON tag names.
// Only use for values stored via doc.Set that contain structs or slices of structs.
func jsonValue(v interface{}) interface{} {
	b, err := json.Marshal(v)
	if err != nil {
		return v
	}
	var result interface{}
	if err := json.Unmarshal(b, &result); err != nil {
		return v
	}
	return result
}

// ---------------------------------------------------------------------------
// Collection names
// ---------------------------------------------------------------------------

// CloverDB collection names. Each resource type maps to one collection.
const (
	CollectionImages       = "images"
	CollectionPlaylists    = "playlists"
	CollectionHistory      = "history"
	CollectionMonitorState = "monitor_state"
	CollectionFolders      = "folders"
)

// ---------------------------------------------------------------------------
// Index names
// ---------------------------------------------------------------------------

// Index names for CloverDB collections. Indexes are created at database
// initialization to support efficient queries.
const (
	// Images collection indexes
	IndexImageID         = "id"
	IndexImageName       = "name"
	IndexImageImportedAt = "imported_at"
	IndexImageMediaType  = "media_type"
	IndexImageFileSize   = "file_size"
	IndexImageChecksum   = "checksum"

	// Playlists collection indexes
	IndexPlaylistID = "id"

	// History collection indexes
	IndexHistoryID      = "id"
	IndexHistorySetAt   = "set_at"
	IndexHistoryImageID = "image_id"

	// MonitorState collection indexes
	IndexMonitorStateName = "monitor_name"

	// Folders collection indexes
	IndexFolderID       = "id"
	IndexFolderParentID = "parent_id"
	IndexFolderName     = "name"
)

// ---------------------------------------------------------------------------
// DB — top-level database abstraction
// ---------------------------------------------------------------------------

// DB is the top-level interface for the daemon's persistence layer.
//
// It owns the CloverDB instance and provides access to domain-specific stores.
// The concrete implementation:
//   - Opens the CloverDB database in the configured DatabaseDir
//   - Creates collections if they don't exist
//   - Creates indexes for efficient queries
//   - Constructs and caches store instances
//
// Usage in main.go wiring:
//
//	db, err := store.OpenDB(cfg.GetDatabaseDir())
//	defer db.Close()
//	imageHandler := handler.NewImageHandler(db.ImageStore())
//	playlistHandler := handler.NewPlaylistHandler(db.PlaylistStore())
type DB interface {
	// Close closes the underlying CloverDB database.
	// Must be called during graceful daemon shutdown.
	Close() error

	// ImageStore returns the store for the "images" collection.
	ImageStore() ImageStore

	// PlaylistStore returns the store for the "playlists" collection.
	PlaylistStore() PlaylistStore

	// HistoryStore returns the store for the "history" collection.
	HistoryStore() HistoryStore

	// StateStore returns the in-memory runtime state store.
	// This store is NOT backed by CloverDB — state is lost on restart.
	StateStore() StateStore

	// MonitorStateStore returns the persisted monitor state store.
	// Tracks the current wallpaper per monitor across daemon restarts.
	MonitorStateStore() MonitorStateStore

	// FolderStore returns the store for the "folders" collection.
	FolderStore() FolderStore
}
