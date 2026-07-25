package store

import (
	"sync/atomic"

	clover "github.com/ostafen/clover/v2"
	"github.com/ostafen/clover/v2/query"
)

// IDAllocator hands out sequential integer IDs. CloverDB only generates random
// string _id values, so stores needing integer primary keys embed this.
type IDAllocator struct {
	nextID atomic.Int64
}

// Init reads the current max "id" from the collection so the allocator
// continues from where it left off after a daemon restart.
func (a *IDAllocator) Init(db *clover.DB, collection string) {
	doc, err := db.FindFirst(
		query.NewQuery(collection).Sort(query.SortOption{Field: "id", Direction: -1}),
	)
	if err == nil && doc != nil {
		switch id := doc.Get("id").(type) {
		case int64:
			a.nextID.Store(id)
		case float64:
			a.nextID.Store(int64(id))
		}
	}
}

// Next returns the next available sequential ID (thread-safe).
func (a *IDAllocator) Next() int {
	return int(a.nextID.Add(1))
}

// Reset sets the counter back to zero. Used when a collection is cleared.
func (a *IDAllocator) Reset() {
	a.nextID.Store(0)
}
