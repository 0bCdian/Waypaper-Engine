package store

import (
	"testing"

	"github.com/ostafen/clover/v2/query"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// ---------------------------------------------------------------------------
// Paginate
// ---------------------------------------------------------------------------

func TestPaginate_FirstPage(t *testing.T) {
	items := make([]int, 10)
	for i := range items {
		items[i] = i + 1
	}

	res := Paginate(items, 1, 3)

	assert.Len(t, res.Data, 3)
	assert.Equal(t, 10, res.Pagination.TotalItems)
	assert.Equal(t, 4, res.Pagination.TotalPages)
	assert.Equal(t, 1, res.Pagination.Page)
}

func TestPaginate_LastPage(t *testing.T) {
	items := make([]int, 10)
	for i := range items {
		items[i] = i + 1
	}

	res := Paginate(items, 4, 3)

	assert.Len(t, res.Data, 1)
	assert.Equal(t, []int{10}, res.Data)
}

func TestPaginate_BeyondEnd(t *testing.T) {
	items := make([]int, 10)
	for i := range items {
		items[i] = i + 1
	}

	res := Paginate(items, 99, 3)

	assert.Empty(t, res.Data)
}

func TestPaginate_EmptySlice(t *testing.T) {
	res := Paginate([]int{}, 1, 5)

	assert.Empty(t, res.Data)
	assert.Equal(t, 0, res.Pagination.TotalItems)
}

// ---------------------------------------------------------------------------
// IDAllocator
// ---------------------------------------------------------------------------

func TestIDAllocator_Sequential(t *testing.T) {
	var a IDAllocator
	for i := 1; i <= 5; i++ {
		assert.Equal(t, i, a.Next())
	}
}

func TestIDAllocator_Reset(t *testing.T) {
	var a IDAllocator
	a.Next()
	a.Next()
	a.Next()
	a.Reset()

	assert.Equal(t, 1, a.Next())
}

// ---------------------------------------------------------------------------
// filterImagesBySearch
// ---------------------------------------------------------------------------

func TestFilterImagesBySearch_NameMatch(t *testing.T) {
	images := []Image{
		{Name: "ocean sunset"},
		{Name: "mountain peak"},
	}

	got := filterImagesBySearch(images, "ocean")

	require.Len(t, got, 1)
	assert.Equal(t, "ocean sunset", got[0].Name)
}

func TestFilterImagesBySearch_TagMatch(t *testing.T) {
	images := []Image{
		{Name: "pic1", Tags: []string{"nature", "water"}},
		{Name: "pic2", Tags: []string{"urban"}},
	}

	got := filterImagesBySearch(images, "nature")

	require.Len(t, got, 1)
	assert.Equal(t, "pic1", got[0].Name)
}

func TestFilterImagesBySearch_NoMatch(t *testing.T) {
	images := []Image{
		{Name: "ocean sunset", Tags: []string{"nature"}},
		{Name: "mountain peak", Tags: []string{"landscape"}},
	}

	got := filterImagesBySearch(images, "xyz")

	assert.Empty(t, got)
}

func TestFilterImagesBySearch_CaseInsensitive(t *testing.T) {
	images := []Image{
		{Name: "ocean sunset"},
		{Name: "desert dune"},
	}

	got := filterImagesBySearch(images, "OCEAN")

	require.Len(t, got, 1)
	assert.Equal(t, "ocean sunset", got[0].Name)
}

// ---------------------------------------------------------------------------
// jsonValue
// ---------------------------------------------------------------------------

func TestJsonValue_StructRoundTrip(t *testing.T) {
	type sample struct {
		ImageID int    `json:"image_id"`
		Label   string `json:"label"`
	}
	in := sample{ImageID: 42, Label: "test"}

	out := jsonValue(in)

	m, ok := out.(map[string]interface{})
	require.True(t, ok, "expected map[string]interface{}")
	assert.Contains(t, m, "image_id")
	assert.Contains(t, m, "label")
	assert.NotContains(t, m, "ImageID")
}

// ---------------------------------------------------------------------------
// ChainAnd
// ---------------------------------------------------------------------------

func TestChainAnd_NilExisting(t *testing.T) {
	crit := query.Field("id").Eq(1)

	result := ChainAnd(nil, crit)

	assert.NotNil(t, result)
}

func TestChainAnd_BothNonNil(t *testing.T) {
	crit1 := query.Field("id").Eq(1)
	crit2 := query.Field("name").Eq("test")

	result := ChainAnd(crit1, crit2)

	assert.NotNil(t, result)
}
