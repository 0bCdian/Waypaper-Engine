package store

// ---------------------------------------------------------------------------
// Collection names
// ---------------------------------------------------------------------------

// CloverDB collection names. Each resource type maps to one collection.
const (
	CollectionImages    = "images"
	CollectionPlaylists = "playlists"
	CollectionHistory   = "history"
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
}
