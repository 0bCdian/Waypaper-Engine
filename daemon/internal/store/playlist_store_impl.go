package store

import (
	"context"
	"fmt"
	"time"

	clover "github.com/ostafen/clover/v2"
	d "github.com/ostafen/clover/v2/document"
	"github.com/ostafen/clover/v2/query"
)

// playlistStore is the CloverDB-backed implementation of PlaylistStore.
type playlistStore struct {
	db *clover.DB
	IDAllocator
}

func newPlaylistStore(db *clover.DB) *playlistStore {
	s := &playlistStore{db: db}
	s.IDAllocator.Init(db, CollectionPlaylists)
	return s
}

func (s *playlistStore) GetAll(_ context.Context) ([]Playlist, error) {
	docs, err := s.db.FindAll(query.NewQuery(CollectionPlaylists).Sort(
		query.SortOption{Field: "id", Direction: 1},
	))
	if err != nil {
		return nil, fmt.Errorf("playlist store: find all: %w", err)
	}

	return UnmarshalAll[Playlist](docs), nil
}

func (s *playlistStore) GetByID(_ context.Context, id int) (*Playlist, error) {
	q := query.NewQuery(CollectionPlaylists).Where(query.Field("id").Eq(id))
	return FindOne[Playlist](s.db, q, fmt.Sprintf("playlist store: playlist %d", id))
}

func (s *playlistStore) Create(_ context.Context, playlist Playlist) (*Playlist, error) {
	playlist.ID = s.Next()
	now := time.Now()
	playlist.CreatedAt = now
	playlist.UpdatedAt = now

	doc := d.NewDocument()
	doc.Set("id", playlist.ID)
	doc.Set("name", playlist.Name)
	doc.Set("created_at", playlist.CreatedAt)
	doc.Set("updated_at", playlist.UpdatedAt)
	doc.Set("configuration", jsonValue(playlist.Configuration))
	doc.Set("images", jsonValue(playlist.Images))

	if _, err := s.db.InsertOne(CollectionPlaylists, doc); err != nil {
		return nil, fmt.Errorf("playlist store: insert: %w", err)
	}
	return &playlist, nil
}

func (s *playlistStore) Update(_ context.Context, id int, updates map[string]any) (*Playlist, error) {
	updates["updated_at"] = time.Now()

	q := query.NewQuery(CollectionPlaylists).Where(query.Field("id").Eq(id))
	if err := s.db.Update(q, updates); err != nil {
		return nil, fmt.Errorf("playlist store: update %d: %w", id, err)
	}

	return FindOne[Playlist](s.db, q, fmt.Sprintf("playlist store: playlist %d after update", id))
}

func (s *playlistStore) SavePlaybackState(_ context.Context, id int, playback *PlaylistPlayback) error {
	q := query.NewQuery(CollectionPlaylists).Where(query.Field("id").Eq(id))
	updates := map[string]any{
		"updated_at": time.Now(),
	}
	if playback == nil {
		updates["playback"] = nil
	} else {
		updates["playback"] = jsonValue(*playback)
	}
	if err := s.db.Update(q, updates); err != nil {
		return fmt.Errorf("playlist store: save playback %d: %w", id, err)
	}
	return nil
}

func (s *playlistStore) Delete(_ context.Context, id int) error {
	q := query.NewQuery(CollectionPlaylists).Where(query.Field("id").Eq(id))

	doc, err := s.db.FindFirst(q)
	if err != nil {
		return fmt.Errorf("playlist store: find for delete: %w", err)
	}
	if doc == nil {
		return fmt.Errorf("playlist store: playlist %d not found", id)
	}

	if err := s.db.Delete(q); err != nil {
		return fmt.Errorf("playlist store: delete %d: %w", id, err)
	}
	return nil
}

func (s *playlistStore) Count(_ context.Context) (int, error) {
	return countCollection(s.db, CollectionPlaylists, "playlist store")
}
