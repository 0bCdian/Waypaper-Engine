package store

import (
	"context"
	"fmt"
	"sync"

	clover "github.com/ostafen/clover/v2"
	d "github.com/ostafen/clover/v2/document"
	"github.com/ostafen/clover/v2/query"
)

// monitorStateStore is the CloverDB-backed implementation of MonitorStateStore.
// It stores one document per monitor, using monitor_name as the unique key.
// CloverDB has no unique index, so writes are serialised here: a delete-then-insert
// pair from two goroutines would otherwise leave two rows for one monitor.
type monitorStateStore struct {
	db *clover.DB
	mu sync.Mutex
}

func newMonitorStateStore(db *clover.DB) *monitorStateStore {
	return &monitorStateStore{db: db}
}

func (s *monitorStateStore) Get(_ context.Context, monitorName string) (*MonitorState, error) {
	q := query.NewQuery(CollectionMonitorState).Where(
		query.Field("monitor_name").Eq(monitorName),
	)

	doc, err := s.db.FindFirst(q)
	if err != nil {
		return nil, fmt.Errorf("monitor state store: get %q: %w", monitorName, err)
	}
	if doc == nil {
		return nil, nil
	}

	var state MonitorState
	if err := doc.Unmarshal(&state); err != nil {
		return nil, fmt.Errorf("monitor state store: unmarshal %q: %w", monitorName, err)
	}
	return &state, nil
}

func (s *monitorStateStore) GetAll(_ context.Context) ([]MonitorState, error) {
	docs, err := s.db.FindAll(query.NewQuery(CollectionMonitorState))
	if err != nil {
		return nil, fmt.Errorf("monitor state store: get all: %w", err)
	}

	return UnmarshalAll[MonitorState](docs), nil
}

func (s *monitorStateStore) Set(_ context.Context, state MonitorState) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	fields := map[string]any{
		"monitor_name": state.MonitorName,
		"image_id":     state.ImageID,
		"image_name":   state.ImageName,
		"image_path":   state.ImagePath,
		"mode":         state.Mode,
		"backend":      state.Backend,
		"set_at":       state.SetAt,
	}

	q := query.NewQuery(CollectionMonitorState).Where(
		query.Field("monitor_name").Eq(state.MonitorName),
	)

	existing, err := s.db.FindFirst(q)
	if err != nil {
		return fmt.Errorf("monitor state store: lookup %q: %w", state.MonitorName, err)
	}

	if existing != nil {
		// Update in place — never leaves a window with zero rows for this monitor.
		if err := s.db.Update(q, fields); err != nil {
			return fmt.Errorf("monitor state store: update %q: %w", state.MonitorName, err)
		}
		return nil
	}

	doc := d.NewDocument()
	for k, v := range fields {
		doc.Set(k, v)
	}
	if _, err := s.db.InsertOne(CollectionMonitorState, doc); err != nil {
		return fmt.Errorf("monitor state store: set %q: %w", state.MonitorName, err)
	}
	return nil
}

func (s *monitorStateStore) Remove(_ context.Context, monitorName string) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	if err := s.db.Delete(
		query.NewQuery(CollectionMonitorState).Where(
			query.Field("monitor_name").Eq(monitorName),
		),
	); err != nil {
		return fmt.Errorf("monitor state store: remove %q: %w", monitorName, err)
	}
	return nil
}
