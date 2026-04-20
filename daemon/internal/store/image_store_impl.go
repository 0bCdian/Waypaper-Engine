package store

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"

	clover "github.com/ostafen/clover/v2"
	d "github.com/ostafen/clover/v2/document"
	"github.com/ostafen/clover/v2/query"

	"waypaper-engine/daemon/internal/cielab"
)

// imageStore is the CloverDB-backed implementation of ImageStore.
type imageStore struct {
	db *clover.DB
	IDAllocator
}

func newImageStore(db *clover.DB) *imageStore {
	s := &imageStore{db: db}
	s.IDAllocator.Init(db, CollectionImages)
	return s
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

	var criteria query.Criteria

	if opts.MediaType != "" {
		criteria = ChainAnd(criteria, query.Field("media_type").Eq(opts.MediaType))
	}

	for _, tag := range opts.Tags {
		criteria = ChainAnd(criteria, query.Field("tags").Contains(tag))
	}

	for _, color := range opts.Colors {
		criteria = ChainAnd(criteria, query.Field("colors").Contains(color))
	}

	filterRootFolder := false
	if opts.FolderID != nil {
		if *opts.FolderID == 0 {
			filterRootFolder = true
		} else {
			criteria = ChainAnd(criteria, query.Field("folder_id").Eq(*opts.FolderID))
		}
	}

	sortField := "imported_at"
	if opts.SortBy != "" {
		sortField = opts.SortBy
	}
	sortDir := -1
	if strings.ToLower(opts.SortOrder) == "asc" {
		sortDir = 1
	}

	// When search, root-folder filtering, or perceptual color constraints are active,
	// load all DB-filtered docs, apply in-memory filters, then paginate in Go.
	if opts.Search != "" || filterRootFolder || len(opts.ColorsNear) > 0 {
		q := query.NewQuery(CollectionImages)
		if criteria != nil {
			q = q.Where(criteria)
		}
		q = q.Sort(query.SortOption{Field: sortField, Direction: sortDir})

		docs, err := s.db.FindAll(q)
		if err != nil {
			return nil, fmt.Errorf("image store: find all: %w", err)
		}

		if filterRootFolder {
			docs = WhereNilOrNotExists(docs, "folder_id")
		}

		allImages := UnmarshalAll[Image](docs)

		if opts.Search != "" {
			allImages = filterImagesBySearch(allImages, opts.Search)
		}
		if len(opts.ColorsNear) > 0 {
			allImages = filterImagesByColorsNear(allImages, opts.ColorsNear)
		}

		return Paginate(allImages, opts.Page, opts.PerPage), nil
	}

	// No in-memory filters needed — use DB-level pagination.
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

	images := UnmarshalAll[Image](docs)
	totalPages := 0
	if opts.PerPage > 0 {
		totalPages = (total + opts.PerPage - 1) / opts.PerPage
	}

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
	q := query.NewQuery(CollectionImages).Where(query.Field("id").Eq(id))
	return FindOne[Image](s.db, q, fmt.Sprintf("image store: image %d", id))
}

func (s *imageStore) Create(_ context.Context, images []Image) ([]Image, error) {
	created := make([]Image, 0, len(images))

	for _, img := range images {
		img.ID = s.Next()

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
		doc.Set("colors", img.Colors)
		doc.Set("imported_at", img.ImportedAt)
		doc.Set("source_path", img.SourcePath)
		doc.Set("is_selected", img.IsSelected)
		doc.Set("thumbnails", img.Thumbnails)
		doc.Set("preview_path", img.PreviewPath)
		if img.WebMeta != nil {
			doc.Set("web_meta", jsonValue(img.WebMeta))
		}
		if img.FolderID != nil {
			doc.Set("folder_id", *img.FolderID)
		}
		if len(img.WallpaperConfigOverrides) > 0 {
			var ov any
			if err := json.Unmarshal(img.WallpaperConfigOverrides, &ov); err == nil {
				doc.Set("wallpaper_config_overrides", ov)
			}
		}

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

	return FindOne[Image](s.db, q, fmt.Sprintf("image store: image %d after update", id))
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
		rawTags := doc.Get("tags")
		if rawTags == nil {
			continue
		}
		switch t := rawTags.(type) {
		case []interface{}:
			for _, v := range t {
				if str, ok := v.(string); ok {
					seen[str] = struct{}{}
				}
			}
		case []string:
			for _, tag := range t {
				seen[tag] = struct{}{}
			}
		}
	}
	tags := make([]string, 0, len(seen))
	for tag := range seen {
		tags = append(tags, tag)
	}
	return tags, nil
}

func (s *imageStore) Count(_ context.Context) (int, error) {
	return countCollection(s.db, CollectionImages, "image store")
}

func (s *imageStore) IsNameTaken(_ context.Context, name string, excludeID int) (bool, error) {
	q := query.NewQuery(CollectionImages).Where(
		query.Field("name").Eq(name).And(query.Field("id").Neq(excludeID)),
	)
	count, err := s.db.Count(q)
	if err != nil {
		return false, fmt.Errorf("image store: check name taken: %w", err)
	}
	return count > 0, nil
}

// filterImagesBySearch performs case-insensitive substring search on name and tags.
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

func filterImagesByColorsNear(images []Image, near []ColorNearConstraint) []Image {
	if len(near) == 0 {
		return images
	}
	var filtered []Image
outer:
	for _, im := range images {
		for _, c := range near {
			if !cielab.WithinDeltaE(c.Hex, c.MaxDeltaE, im.Colors) {
				continue outer
			}
		}
		filtered = append(filtered, im)
	}
	return filtered
}
