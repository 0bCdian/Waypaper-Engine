package store

import (
	"context"
	"fmt"
	"strings"
	"time"

	clover "github.com/ostafen/clover/v2"
	d "github.com/ostafen/clover/v2/document"
	"github.com/ostafen/clover/v2/query"
)

type folderStore struct {
	db *clover.DB
	IDAllocator
}

func newFolderStore(db *clover.DB) *folderStore {
	s := &folderStore{db: db}
	s.IDAllocator.Init(db, CollectionFolders)
	return s
}

func (s *folderStore) GetAll(_ context.Context, parentID *int) ([]Folder, error) {
	q := query.NewQuery(CollectionFolders).
		Sort(query.SortOption{Field: "name", Direction: 1})

	if parentID != nil {
		q = q.Where(query.Field("parent_id").Eq(*parentID))
	}

	docs, err := s.db.FindAll(q)
	if err != nil {
		return nil, fmt.Errorf("folder store: find all: %w", err)
	}

	if parentID == nil {
		docs = WhereNilOrNotExists(docs, "parent_id")
	}

	return UnmarshalAll[Folder](docs), nil
}

func (s *folderStore) GetByID(_ context.Context, id int) (*Folder, error) {
	q := query.NewQuery(CollectionFolders).Where(query.Field("id").Eq(id))
	return FindOne[Folder](s.db, q, fmt.Sprintf("folder store: folder %d", id))
}

func (s *folderStore) GetPath(ctx context.Context, id int) ([]Folder, error) {
	var path []Folder
	currentID := id

	for {
		folder, err := s.GetByID(ctx, currentID)
		if err != nil {
			return nil, err
		}
		path = append([]Folder{*folder}, path...)
		if folder.ParentID == nil {
			break
		}
		currentID = *folder.ParentID
	}

	return path, nil
}

func (s *folderStore) Create(_ context.Context, folder Folder) (*Folder, error) {
	folder.ID = s.Next()
	now := time.Now()
	folder.CreatedAt = now
	folder.UpdatedAt = now

	doc := d.NewDocument()
	doc.Set("id", folder.ID)
	doc.Set("name", folder.Name)
	if folder.ParentID != nil {
		doc.Set("parent_id", *folder.ParentID)
	}
	doc.Set("created_at", folder.CreatedAt)
	doc.Set("updated_at", folder.UpdatedAt)

	if _, err := s.db.InsertOne(CollectionFolders, doc); err != nil {
		return nil, fmt.Errorf("folder store: insert: %w", err)
	}

	return &folder, nil
}

func (s *folderStore) Update(_ context.Context, id int, updates map[string]any) (*Folder, error) {
	updates["updated_at"] = time.Now()

	q := query.NewQuery(CollectionFolders).Where(query.Field("id").Eq(id))
	if err := s.db.Update(q, updates); err != nil {
		return nil, fmt.Errorf("folder store: update folder %d: %w", id, err)
	}

	return FindOne[Folder](s.db, q, fmt.Sprintf("folder store: folder %d after update", id))
}

func (s *folderStore) Delete(_ context.Context, id int) error {
	q := query.NewQuery(CollectionFolders).Where(query.Field("id").Eq(id))
	return s.db.Delete(q)
}

func (s *folderStore) Search(_ context.Context, searchQuery string) ([]Folder, error) {
	docs, err := s.db.FindAll(
		query.NewQuery(CollectionFolders).Sort(query.SortOption{Field: "name", Direction: 1}),
	)
	if err != nil {
		return nil, fmt.Errorf("folder store: find all for search: %w", err)
	}

	all := UnmarshalAll[Folder](docs)

	term := strings.ToLower(searchQuery)
	var filtered []Folder
	for _, f := range all {
		if strings.Contains(strings.ToLower(f.Name), term) {
			filtered = append(filtered, f)
		}
	}
	return filtered, nil
}

func (s *folderStore) Count(_ context.Context) (int, error) {
	return countCollection(s.db, CollectionFolders, "folder store")
}
