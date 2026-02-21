package store

import (
	d "github.com/ostafen/clover/v2/document"
	"github.com/ostafen/clover/v2/query"
)

// WhereNilOrNotExists filters documents in-memory, keeping only those where
// the given field is nil or does not exist.
//
// Workaround: CloverDB v2.0.0-alpha.3's query.Field(f).IsNilOrNotExists()
// panics on indexed fields with a nil interface cast in IndexSelectVisitor.
// See cloverdb-bug-repro/ for a standalone reproduction.
func WhereNilOrNotExists(docs []*d.Document, field string) []*d.Document {
	filtered := make([]*d.Document, 0, len(docs))
	for _, doc := range docs {
		if doc.Get(field) == nil {
			filtered = append(filtered, doc)
		}
	}
	return filtered
}

// WhereNotNil filters documents in-memory, keeping only those where the
// given field exists and is not nil. Inverse of WhereNilOrNotExists.
func WhereNotNil(docs []*d.Document, field string) []*d.Document {
	filtered := make([]*d.Document, 0, len(docs))
	for _, doc := range docs {
		if doc.Get(field) != nil {
			filtered = append(filtered, doc)
		}
	}
	return filtered
}

// ChainAnd chains criteria with AND. If existing is nil, returns the new one.
// CloverDB's Criteria.And() requires a non-nil receiver, so this handles the
// common pattern of building criteria incrementally from zero or more filters.
func ChainAnd(existing, next query.Criteria) query.Criteria {
	if existing == nil {
		return next
	}
	return existing.And(next)
}
