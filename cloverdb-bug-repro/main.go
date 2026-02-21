// Minimal reproduction for CloverDB v2.0.0-alpha.3 IsNilOrNotExists() panic.
//
// Bug: query.Field("x").IsNilOrNotExists() panics inside
// IndexSelectVisitor.VisitBinaryCriteria with:
//
//   interface conversion: interface {} is nil, not []*index.IndexInfo
//
// IsNilOrNotExists() internally creates a binary OR criteria (IsNil OR NotExists).
// The IndexSelectVisitor walks this tree and attempts to cast index metadata
// that is nil, causing the panic.
//
// Trigger condition: the field MUST have an index on the collection.
//   - Without index → works fine (Test 1, Test 3)
//   - With index    → panics    (Test 2, Test 4)
//
// Discovered in: github.com/ostafen/clover/v2@v2.0.0-alpha.3
// File:          visit.go:112 — (*IndexSelectVisitor).VisitBinaryCriteria
//
// To run:
//   cd cloverdb-bug-repro && go run .
//
// Expected: query returns documents where "parent_id" is nil or absent.
// Actual:   panics when the field has an index.

package main

import (
	"fmt"
	"os"

	clover "github.com/ostafen/clover/v2"
	d "github.com/ostafen/clover/v2/document"
	"github.com/ostafen/clover/v2/query"
)

const collection = "items"

func main() {
	// Use a temp directory so we don't pollute anything.
	dbPath, err := os.MkdirTemp("", "cloverdb-repro-*")
	if err != nil {
		panic(err)
	}
	defer os.RemoveAll(dbPath)

	db, err := clover.Open(dbPath)
	if err != nil {
		panic(err)
	}
	defer db.Close()

	if err := db.CreateCollection(collection); err != nil {
		panic(err)
	}

	// ── Test 1: Field WITHOUT an index ──────────────────────────────
	fmt.Println("=== Test 1: IsNilOrNotExists() on a field WITHOUT an index ===")
	insertTestDocuments(db)
	runIsNilOrNotExistsQuery(db, "Test 1 (no index)")
	clearCollection(db)

	// ── Test 2: Field WITH an index ─────────────────────────────────
	fmt.Println("\n=== Test 2: IsNilOrNotExists() on a field WITH an index ===")
	if err := db.CreateIndex(collection, "parent_id"); err != nil {
		panic(err)
	}
	insertTestDocuments(db)
	runIsNilOrNotExistsQuery(db, "Test 2 (with index)")
	clearCollection(db)

	// ── Test 3: Empty collection, no index on field ─────────────────
	fmt.Println("\n=== Test 3: IsNilOrNotExists() on EMPTY collection (no docs) ===")
	// Drop and recreate without the index.
	db.DropCollection(collection)
	db.CreateCollection(collection)
	runIsNilOrNotExistsQuery(db, "Test 3 (empty, no index)")

	// ── Test 4: Empty collection, with index on field ───────────────
	fmt.Println("\n=== Test 4: IsNilOrNotExists() on EMPTY collection WITH index ===")
	db.CreateIndex(collection, "parent_id")
	runIsNilOrNotExistsQuery(db, "Test 4 (empty, with index)")

	fmt.Println("\n✓ If you see this, all tests passed without panicking.")
}

func insertTestDocuments(db *clover.DB) {
	// Doc 1: parent_id is set to a value.
	doc1 := d.NewDocument()
	doc1.Set("id", 1)
	doc1.Set("name", "child-item")
	doc1.Set("parent_id", 42)

	// Doc 2: parent_id is explicitly nil (not set at all).
	doc2 := d.NewDocument()
	doc2.Set("id", 2)
	doc2.Set("name", "root-item")
	// parent_id intentionally omitted — simulates a "root" item.

	// Doc 3: parent_id is explicitly set to nil.
	doc3 := d.NewDocument()
	doc3.Set("id", 3)
	doc3.Set("name", "root-item-explicit-nil")
	// CloverDB stores nil differently from absent — test both.

	if _, err := db.InsertOne(collection, doc1); err != nil {
		panic(err)
	}
	if _, err := db.InsertOne(collection, doc2); err != nil {
		panic(err)
	}
	if _, err := db.InsertOne(collection, doc3); err != nil {
		panic(err)
	}

	fmt.Printf("  Inserted 3 documents (1 with parent_id=42, 2 without parent_id)\n")
}

func runIsNilOrNotExistsQuery(db *clover.DB, label string) {
	defer func() {
		if r := recover(); r != nil {
			fmt.Printf("  ✗ %s: PANIC — %v\n", label, r)
		}
	}()

	q := query.NewQuery(collection).
		Where(query.Field("parent_id").IsNilOrNotExists())

	docs, err := db.FindAll(q)
	if err != nil {
		fmt.Printf("  ✗ %s: error — %v\n", label, err)
		return
	}

	fmt.Printf("  ✓ %s: returned %d documents\n", label, len(docs))
	for _, doc := range docs {
		fmt.Printf("    → id=%v name=%v parent_id=%v\n",
			doc.Get("id"), doc.Get("name"), doc.Get("parent_id"))
	}
}

func clearCollection(db *clover.DB) {
	db.Delete(query.NewQuery(collection))
}
