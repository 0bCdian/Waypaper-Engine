package store

import (
	"context"
	"fmt"
	"math"
	"strings"
	"sync/atomic"

	clover "github.com/ostafen/clover/v2"
	d "github.com/ostafen/clover/v2/document"
	"github.com/ostafen/clover/v2/query"
)

// imageStore is the CloverDB-backed implementation of ImageStore.
type imageStore struct {
	db     *clover.DB
	nextID atomic.Int64
}

func newImageStore(db *clover.DB) *imageStore {
	s := &imageStore{db: db}
	s.initNextID()
	return s
}

// initNextID loads the current max ID from the collection.
func (s *imageStore) initNextID() {
	doc, err := s.db.FindFirst(
		query.NewQuery(CollectionImages).Sort(query.SortOption{Field: "id", Direction: -1}),
	)
	if err == nil && doc != nil {
		if id, ok := doc.Get("id").(int64); ok {
			s.nextID.Store(id)
		}
	}
}

func (s *imageStore) allocID() int {
	return int(s.nextID.Add(1))
}

func (s *imageStore) GetAll(_ context.Context, opts ImageQueryOpts) (*PaginatedResult[Image], error) {
	if opts.Page < 1 {
		opts.Page = 1
	}
	if opts.PerPage < 1 {
		opts.PerPage = 50
	}
	if opts.PerPage > 200 {
		opts.PerPage = 200
	}

	// Build base query criteria.
	var criteria query.Criteria

	if opts.MediaType != "" {
		c := query.Field("media_type").Eq(opts.MediaType)
		criteria = chainAnd(criteria, c)
	}

	if len(opts.Tags) > 0 {
		for _, tag := range opts.Tags {
			c := query.Field("tags").Contains(tag)
			criteria = chainAnd(criteria, c)
		}
	}

	// Sorting.
	sortField := "imported_at"
	if opts.SortBy != "" {
		sortField = opts.SortBy
	}
	sortDir := -1 // desc
	if strings.ToLower(opts.SortOrder) == "asc" {
		sortDir = 1
	}

	// When search is active, load all DB-filtered images, apply search
	// in-memory, THEN paginate the results. CloverDB doesn't support
	// native fuzzy search, so we must filter before pagination.
	if opts.Search != "" {
		q := query.NewQuery(CollectionImages)
		if criteria != nil {
			q = q.Where(criteria)
		}
		q = q.Sort(query.SortOption{Field: sortField, Direction: sortDir})

		docs, err := s.db.FindAll(q)
		if err != nil {
			return nil, fmt.Errorf("image store: find all: %w", err)
		}

		allImages := make([]Image, 0, len(docs))
		for _, doc := range docs {
			var img Image
			if err := doc.Unmarshal(&img); err != nil {
				continue
			}
			allImages = append(allImages, img)
		}

		// Filter by search FIRST.
		filtered := filterImagesBySearch(allImages, opts.Search)
		total := len(filtered)
		totalPages := int(math.Ceil(float64(total) / float64(opts.PerPage)))

		// THEN paginate.
		skip := (opts.Page - 1) * opts.PerPage
		end := skip + opts.PerPage
		if skip > total {
			skip = total
		}
		if end > total {
			end = total
		}
		paged := filtered[skip:end]

		return &PaginatedResult[Image]{
			Data: paged,
			Pagination: Pagination{
				Page:       opts.Page,
				PerPage:    opts.PerPage,
				TotalItems: total,
				TotalPages: totalPages,
			},
		}, nil
	}

	// No search -- use DB-level pagination.
	countQ := query.NewQuery(CollectionImages)
	if criteria != nil {
		countQ = countQ.Where(criteria)
	}
	total, err := s.db.Count(countQ)
	if err != nil {
		return nil, fmt.Errorf("image store: count: %w", err)
	}

	q := query.NewQuery(CollectionImages)
	if criteria != nil {
		q = q.Where(criteria)
	}
	q = q.Sort(query.SortOption{Field: sortField, Direction: sortDir})

	skip := (opts.Page - 1) * opts.PerPage
	q = q.Skip(skip).Limit(opts.PerPage)

	docs, err := s.db.FindAll(q)
	if err != nil {
		return nil, fmt.Errorf("image store: find all: %w", err)
	}

	images := make([]Image, 0, len(docs))
	for _, doc := range docs {
		var img Image
		if err := doc.Unmarshal(&img); err != nil {
			continue
		}
		images = append(images, img)
	}

	totalPages := int(math.Ceil(float64(total) / float64(opts.PerPage)))

	return &PaginatedResult[Image]{
		Data: images,
		Pagination: Pagination{
			Page:       opts.Page,
			PerPage:    opts.PerPage,
			TotalItems: total,
			TotalPages: totalPages,
		},
	}, nil
}

func (s *imageStore) GetByID(_ context.Context, id int) (*Image, error) {
	doc, err := s.db.FindFirst(
		query.NewQuery(CollectionImages).Where(query.Field("id").Eq(id)),
	)
	if err != nil {
		return nil, fmt.Errorf("image store: find by id: %w", err)
	}
	if doc == nil {
		return nil, fmt.Errorf("image store: image %d not found", id)
	}

	var img Image
	if err := doc.Unmarshal(&img); err != nil {
		return nil, fmt.Errorf("image store: unmarshal: %w", err)
	}
	return &img, nil
}

func (s *imageStore) Create(_ context.Context, images []Image) ([]Image, error) {
	created := make([]Image, 0, len(images))

	for _, img := range images {
		img.ID = s.allocID()

		doc := d.NewDocument()
		doc.Set("id", img.ID)
		doc.Set("name", img.Name)
		doc.Set("path", img.Path)
		doc.Set("media_type", img.MediaType)
		doc.Set("width", img.Width)
		doc.Set("height", img.Height)
		doc.Set("format", img.Format)
		doc.Set("file_size", img.FileSize)
		doc.Set("checksum", img.Checksum)
		doc.Set("tags", img.Tags)
		doc.Set("imported_at", img.ImportedAt)
		doc.Set("source_path", img.SourcePath)
		doc.Set("is_selected", img.IsSelected)
		doc.Set("thumbnails", img.Thumbnails)

		if _, err := s.db.InsertOne(CollectionImages, doc); err != nil {
			return nil, fmt.Errorf("image store: insert image %q: %w", img.Name, err)
		}
		created = append(created, img)
	}

	return created, nil
}

func (s *imageStore) Update(_ context.Context, id int, updates map[string]any) (*Image, error) {
	q := query.NewQuery(CollectionImages).Where(query.Field("id").Eq(id))

	if err := s.db.Update(q, updates); err != nil {
		return nil, fmt.Errorf("image store: update image %d: %w", id, err)
	}

	doc, err := s.db.FindFirst(q)
	if err != nil || doc == nil {
		return nil, fmt.Errorf("image store: image %d not found after update", id)
	}

	var img Image
	if err := doc.Unmarshal(&img); err != nil {
		return nil, fmt.Errorf("image store: unmarshal after update: %w", err)
	}
	return &img, nil
}

func (s *imageStore) UpdateAll(_ context.Context, updates map[string]any) (int, error) {
	q := query.NewQuery(CollectionImages)
	count, err := s.db.Count(q)
	if err != nil {
		return 0, fmt.Errorf("image store: count for update all: %w", err)
	}
	if err := s.db.Update(q, updates); err != nil {
		return 0, fmt.Errorf("image store: update all: %w", err)
	}
	return count, nil
}

func (s *imageStore) Delete(_ context.Context, ids []int) (int, error) {
	deleted := 0
	for _, id := range ids {
		q := query.NewQuery(CollectionImages).Where(query.Field("id").Eq(id))
		if err := s.db.Delete(q); err != nil {
			continue
		}
		deleted++
	}
	return deleted, nil
}

func (s *imageStore) GetAllTags(_ context.Context) ([]string, error) {
	docs, err := s.db.FindAll(query.NewQuery(CollectionImages))
	if err != nil {
		return nil, fmt.Errorf("image store: find all for tags: %w", err)
	}
	seen := make(map[string]struct{})
	for _, doc := range docs {
		var img Image
		if err := doc.Unmarshal(&img); err != nil {
			continue
		}
		for _, tag := range img.Tags {
			seen[tag] = struct{}{}
		}
	}
	tags := make([]string, 0, len(seen))
	for tag := range seen {
		tags = append(tags, tag)
	}
	return tags, nil
}

func (s *imageStore) Count(_ context.Context) (int, error) {
	count, err := s.db.Count(query.NewQuery(CollectionImages))
	if err != nil {
		return 0, fmt.Errorf("image store: count: %w", err)
	}
	return count, nil
}

// filterImagesBySearch performs case-insensitive fuzzy search on name and tags.
func filterImagesBySearch(images []Image, search string) []Image {
	term := strings.ToLower(search)
	var filtered []Image
	for _, img := range images {
		if strings.Contains(strings.ToLower(img.Name), term) {
			filtered = append(filtered, img)
			continue
		}
		for _, tag := range img.Tags {
			if strings.Contains(strings.ToLower(tag), term) {
				filtered = append(filtered, img)
				break
			}
		}
	}
	return filtered
}

// chainAnd chains criteria with AND. If existing is nil, returns the new criteria.
func chainAnd(existing, new query.Criteria) query.Criteria {
	if existing == nil {
		return new
	}
	return existing.And(new)
}
