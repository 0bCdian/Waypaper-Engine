package store

import (
	"context"
	"fmt"

	clover "github.com/ostafen/clover/v2"
	d "github.com/ostafen/clover/v2/document"
	"github.com/ostafen/clover/v2/query"
)

// monitorStateStore is the CloverDB-backed implementation of MonitorStateStore.
// It stores one document per monitor, using monitor_name as the unique key.
type monitorStateStore struct {
	db *clover.DB
}

func newMonitorStateStore(db *clover.DB) *monitorStateStore {
	return &monitorStateStore{db: db}
}

func (s *monitorStateStore) Get(_ context.Context, monitorName string) (*MonitorState, error) {
	doc, err := s.db.FindFirst(
		query.NewQuery(CollectionMonitorState).Where(
			query.Field("monitor_name").Eq(monitorName),
		),
	)
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

	states := make([]MonitorState, 0, len(docs))
	for _, doc := range docs {
		var state MonitorState
		if err := doc.Unmarshal(&state); err != nil {
			continue
		}
		states = append(states, state)
	}
	return states, nil
}

func (s *monitorStateStore) Set(_ context.Context, state MonitorState) error {
	// Upsert pattern: delete existing entry for this monitor, then insert new one.
	// CloverDB doesn't have a native upsert, so we delete + insert.
	_ = s.db.Delete(
		query.NewQuery(CollectionMonitorState).Where(
			query.Field("monitor_name").Eq(state.MonitorName),
		),
	)

	doc := d.NewDocument()
	doc.Set("monitor_name", state.MonitorName)
	doc.Set("image_id", state.ImageID)
	doc.Set("image_name", state.ImageName)
	doc.Set("image_path", state.ImagePath)
	doc.Set("mode", state.Mode)
	doc.Set("backend", state.Backend)
	doc.Set("set_at", state.SetAt)

	if _, err := s.db.InsertOne(CollectionMonitorState, doc); err != nil {
		return fmt.Errorf("monitor state store: set %q: %w", state.MonitorName, err)
	}
	return nil
}

func (s *monitorStateStore) Remove(_ context.Context, monitorName string) error {
	if err := s.db.Delete(
		query.NewQuery(CollectionMonitorState).Where(
			query.Field("monitor_name").Eq(monitorName),
		),
	); err != nil {
		return fmt.Errorf("monitor state store: remove %q: %w", monitorName, err)
	}
	return nil
}
