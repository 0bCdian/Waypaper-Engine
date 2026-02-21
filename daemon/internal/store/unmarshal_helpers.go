package store

import (
	"fmt"
	"math"

	clover "github.com/ostafen/clover/v2"
	d "github.com/ostafen/clover/v2/document"
	"github.com/ostafen/clover/v2/query"
)

// UnmarshalAll unmarshals a slice of CloverDB documents into typed structs.
// Documents that fail to unmarshal are silently skipped to stay resilient
// against corrupt or schema-mismatched records.
func UnmarshalAll[T any](docs []*d.Document) []T {
	out := make([]T, 0, len(docs))
	for _, doc := range docs {
		var v T
		if err := doc.Unmarshal(&v); err != nil {
			continue
		}
		out = append(out, v)
	}
	return out
}

// FindOne executes a FindFirst query and unmarshals the result into T.
// Returns a descriptive error (using label) when the document is missing
// or fails to unmarshal.
func FindOne[T any](db *clover.DB, q *query.Query, label string) (*T, error) {
	doc, err := db.FindFirst(q)
	if err != nil {
		return nil, fmt.Errorf("%s: find: %w", label, err)
	}
	if doc == nil {
		return nil, fmt.Errorf("%s: not found", label)
	}
	var v T
	if err := doc.Unmarshal(&v); err != nil {
		return nil, fmt.Errorf("%s: unmarshal: %w", label, err)
	}
	return &v, nil
}

// Paginate slices an in-memory result set and wraps it in a PaginatedResult.
// Used when CloverDB cannot paginate at the DB level (e.g., after in-memory
// filtering for search or nil-field workarounds).
func Paginate[T any](items []T, page, perPage int) *PaginatedResult[T] {
	total := len(items)
	totalPages := int(math.Ceil(float64(total) / float64(perPage)))

	skip := (page - 1) * perPage
	end := skip + perPage
	if skip > total {
		skip = total
	}
	if end > total {
		end = total
	}

	return &PaginatedResult[T]{
		Data: items[skip:end],
		Pagination: Pagination{
			Page:       page,
			PerPage:    perPage,
			TotalItems: total,
			TotalPages: totalPages,
		},
	}
}
