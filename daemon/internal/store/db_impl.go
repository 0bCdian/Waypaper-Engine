package store

import (
	"fmt"
	"log/slog"

	clover "github.com/ostafen/clover/v2"
)

// database is the concrete implementation of the DB interface using CloverDB.
type database struct {
	db                *clover.DB
	imageStore        ImageStore
	playlistStore     PlaylistStore
	historyStore      HistoryStore
	stateStore        StateStore
	monitorStateStore MonitorStateStore
	folderStore       FolderStore
}

// OpenDB opens a CloverDB database at the given directory, creates collections
// and indexes if they don't exist, and returns a DB instance.
func OpenDB(dbPath string) (DB, error) {
	slog.Info("opening database", "path", dbPath)

	db, err := clover.Open(dbPath)
	if err != nil {
		return nil, fmt.Errorf("store: open database: %w", err)
	}

	// Ensure collections exist (idempotent).
	for _, coll := range []string{CollectionImages, CollectionPlaylists, CollectionHistory, CollectionMonitorState, CollectionFolders} {
		if has, _ := db.HasCollection(coll); !has {
			if err := db.CreateCollection(coll); err != nil {
				_ = db.Close()
				return nil, fmt.Errorf("store: create collection %q: %w", coll, err)
			}
			slog.Info("created collection", "name", coll)
		}
	}

	// Create indexes (idempotent — CloverDB returns ErrIndexExist which we ignore).
	indexes := map[string][]string{
		CollectionImages: {
			IndexImageID, IndexImageName, IndexImageImportedAt,
			IndexImageMediaType, IndexImageFileSize, IndexImageChecksum,
		},
		CollectionPlaylists: {
			IndexPlaylistID,
		},
		CollectionHistory: {
			IndexHistoryID, IndexHistorySetAt, IndexHistoryImageID,
		},
		CollectionMonitorState: {
			IndexMonitorStateName,
		},
		CollectionFolders: {
			IndexFolderID, IndexFolderParentID, IndexFolderName,
		},
	}
	for coll, fields := range indexes {
		for _, field := range fields {
			if err := db.CreateIndex(coll, field); err != nil && err != clover.ErrIndexExist {
				slog.Debug("index creation issue", "collection", coll, "field", field, "err", err)
			}
		}
	}

	d := &database{db: db}
	d.imageStore = newImageStore(db)
	d.playlistStore = newPlaylistStore(db)
	d.historyStore = newHistoryStore(db)
	d.stateStore = newStateStore()
	d.monitorStateStore = newMonitorStateStore(db)
	d.folderStore = newFolderStore(db)

	return d, nil
}

func (d *database) Close() error {
	slog.Info("closing database")
	return d.db.Close()
}

func (d *database) ImageStore() ImageStore               { return d.imageStore }
func (d *database) PlaylistStore() PlaylistStore         { return d.playlistStore }
func (d *database) HistoryStore() HistoryStore           { return d.historyStore }
func (d *database) StateStore() StateStore               { return d.stateStore }
func (d *database) MonitorStateStore() MonitorStateStore { return d.monitorStateStore }
func (d *database) FolderStore() FolderStore             { return d.folderStore }
