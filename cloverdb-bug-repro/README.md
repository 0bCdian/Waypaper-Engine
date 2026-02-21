# CloverDB `IsNilOrNotExists()` panic when field has an index

## Version

`github.com/ostafen/clover/v2 v2.0.0-alpha.3`

## Bug

`query.Field("x").IsNilOrNotExists()` panics when the queried field has a CloverDB index on the collection.

```
interface conversion: interface {} is nil, not []*index.IndexInfo
```

**Stack trace:**

```
github.com/ostafen/clover/v2.(*IndexSelectVisitor).VisitBinaryCriteria
    visit.go:112
```

## Trigger condition

`IsNilOrNotExists()` internally creates a binary OR criteria (`IsNil() OR NotExists()`). When the `IndexSelectVisitor` walks this criteria tree on a collection that has an index on the queried field, it attempts to cast index metadata that is `nil`, causing the panic.

| Scenario | Index on field? | Result |
|---|---|---|
| Non-empty collection, no index | No | ✓ Works |
| Non-empty collection, with index | Yes | ✗ **Panic** |
| Empty collection, no index | No | ✓ Works |
| Empty collection, with index | Yes | ✗ **Panic** |

## Reproduce

```bash
cd cloverdb-bug-repro
go run .
```

**Output:**

```
=== Test 1: IsNilOrNotExists() on a field WITHOUT an index ===
  Inserted 3 documents (1 with parent_id=42, 2 without parent_id)
  ✓ Test 1 (no index): returned 2 documents

=== Test 2: IsNilOrNotExists() on a field WITH an index ===
  Inserted 3 documents (1 with parent_id=42, 2 without parent_id)
  ✗ Test 2 (with index): PANIC — interface conversion: interface {} is nil, not []*index.IndexInfo

=== Test 3: IsNilOrNotExists() on EMPTY collection (no docs) ===
  ✓ Test 3 (empty, no index): returned 0 documents

=== Test 4: IsNilOrNotExists() on EMPTY collection WITH index ===
  ✗ Test 4 (empty, with index): PANIC — interface conversion: interface {} is nil, not []*index.IndexInfo
```

## Workaround

Avoid `IsNilOrNotExists()` on indexed fields. Instead, fetch all documents and filter in Go:

```go
// Instead of:
//   q := query.NewQuery("items").Where(query.Field("parent_id").IsNilOrNotExists())

q := query.NewQuery("items")
docs, _ := db.FindAll(q)
for _, doc := range docs {
    if doc.Get("parent_id") == nil {
        // this is a root-level item
    }
}
```
