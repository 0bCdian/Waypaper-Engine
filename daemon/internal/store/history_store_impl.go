package store

import (
	"context"
	"fmt"

	clover "github.com/ostafen/clover/v2"
	d "github.com/ostafen/clover/v2/document"
	"github.com/ostafen/clover/v2/query"
)

// historyStore is the CloverDB-backed implementation of HistoryStore.
type historyStore struct {
	db *clover.DB
	IDAllocator
}

func newHistoryStore(db *clover.DB) *historyStore {
	s := &historyStore{db: db}
	s.IDAllocator.Init(db, CollectionHistory)
	return s
}

func (s *historyStore) Append(_ context.Context, entry ImageHistoryEntry) (*ImageHistoryEntry, error) {
	entry.ID = s.Next()

	doc := d.NewDocument()
	doc.Set("id", entry.ID)
	doc.Set("image_id", entry.ImageID)
	doc.Set("image_name", entry.ImageName)
	doc.Set("monitors", entry.Monitors)
	doc.Set("mode", entry.Mode)
	doc.Set("set_at", entry.SetAt)
	doc.Set("source", jsonValue(entry.Source))
	doc.Set("backend", entry.Backend)

	if _, err := s.db.InsertOne(CollectionHistory, doc); err != nil {
		return nil, fmt.Errorf("history store: append: %w", err)
	}
	return &entry, nil
}

func (s *historyStore) GetRecent(_ context.Context, opts HistoryQueryOpts) ([]ImageHistoryEntry, error) {
	if opts.Limit < 1 {
		opts.Limit = 50
	}

	var criteria query.Criteria

	if opts.Monitor != "" {
		criteria = ChainAnd(criteria, query.Field("monitors").Contains(opts.Monitor))
	}

	if opts.SinceID > 0 {
		criteria = ChainAnd(criteria, query.Field("id").Gt(opts.SinceID))
	}

	q := query.NewQuery(CollectionHistory)
	if criteria != nil {
		q = q.Where(criteria)
	}
	q = q.Sort(query.SortOption{Field: "id", Direction: -1}).Limit(opts.Limit)

	docs, err := s.db.FindAll(q)
	if err != nil {
		return nil, fmt.Errorf("history store: get recent: %w", err)
	}

	return UnmarshalAll[ImageHistoryEntry](docs), nil
}

func (s *historyStore) Trim(_ context.Context, maxEntries int) error {
	count, err := s.db.Count(query.NewQuery(CollectionHistory))
	if err != nil {
		return fmt.Errorf("history store: count for trim: %w", err)
	}

	excess := count - maxEntries
	if excess <= 0 {
		return nil
	}

	q := query.NewQuery(CollectionHistory).
		Sort(query.SortOption{Field: "id", Direction: 1}).
		Limit(excess)

	if err := s.db.Delete(q); err != nil {
		return fmt.Errorf("history store: trim: %w", err)
	}
	return nil
}

func (s *historyStore) Count(_ context.Context) (int, error) {
	count, err := s.db.Count(query.NewQuery(CollectionHistory))
	if err != nil {
		return 0, fmt.Errorf("history store: count: %w", err)
	}
	return count, nil
}

func (s *historyStore) Clear(_ context.Context) error {
	if err := s.db.Delete(query.NewQuery(CollectionHistory)); err != nil {
		return fmt.Errorf("history store: clear: %w", err)
	}
	s.IDAllocator.Reset()
	return nil
}
