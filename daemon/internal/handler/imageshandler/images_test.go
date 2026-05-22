package imageshandler

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"waypaper-engine/daemon/internal/handler/httpjson"
	"waypaper-engine/daemon/internal/store"
	"waypaper-engine/daemon/internal/testutil"
)

func TestImageHandler_List(t *testing.T) {
	imgStore := &testutil.MockImageStore{
		GetAllFn: func(_ context.Context, opts store.ImageQueryOpts) (*store.PaginatedResult[store.Image], error) {
			img1 := testutil.SampleImage(1)
			img2 := testutil.SampleImage(2)
			return &store.PaginatedResult[store.Image]{
				Data: []store.Image{img1, img2},
				Pagination: store.Pagination{
					Page:       opts.Page,
					PerPage:    opts.PerPage,
					TotalItems: 2,
					TotalPages: 1,
				},
			}, nil
		},
	}
	h := NewImageHandler(imgStore, nil, nil, nil, nil, &testutil.MockBus{}, nil)

	w := httptest.NewRecorder()
	r := httptest.NewRequest(http.MethodGet, "/images?page=1&per_page=50", nil)
	h.List(w, r)

	assert.Equal(t, http.StatusOK, w.Code)

	var result store.PaginatedResult[store.Image]
	require.NoError(t, json.NewDecoder(w.Body).Decode(&result))
	assert.Len(t, result.Data, 2)
	assert.Equal(t, 1, result.Pagination.Page)
}

func TestImageHandler_Get_Found(t *testing.T) {
	imgStore := &testutil.MockImageStore{
		GetByIDFn: func(_ context.Context, id int) (*store.Image, error) {
			img := testutil.SampleImage(id)
			return &img, nil
		},
	}
	h := NewImageHandler(imgStore, nil, nil, nil, nil, &testutil.MockBus{}, nil)

	w := httptest.NewRecorder()
	r := httptest.NewRequest(http.MethodGet, "/images/42", nil)
	r = testutil.WithChiURLParams(r, map[string]string{"id": "42"})
	h.Get(w, r)

	assert.Equal(t, http.StatusOK, w.Code)

	var img store.Image
	require.NoError(t, json.NewDecoder(w.Body).Decode(&img))
	assert.Equal(t, 42, img.ID)
}

func TestImageHandler_Get_NotFound(t *testing.T) {
	imgStore := &testutil.MockImageStore{
		GetByIDFn: func(_ context.Context, id int) (*store.Image, error) {
			return nil, store.ErrNotFound
		},
	}
	h := NewImageHandler(imgStore, nil, nil, nil, nil, &testutil.MockBus{}, nil)

	w := httptest.NewRecorder()
	r := httptest.NewRequest(http.MethodGet, "/images/999", nil)
	r = testutil.WithChiURLParams(r, map[string]string{"id": "999"})
	h.Get(w, r)

	assert.Equal(t, http.StatusNotFound, w.Code)
}

func TestImageHandler_Get_BadID(t *testing.T) {
	h := NewImageHandler(&testutil.MockImageStore{}, nil, nil, nil, nil, &testutil.MockBus{}, nil)

	w := httptest.NewRecorder()
	r := httptest.NewRequest(http.MethodGet, "/images/abc", nil)
	r = testutil.WithChiURLParams(r, map[string]string{"id": "abc"})
	h.Get(w, r)

	assert.Equal(t, http.StatusBadRequest, w.Code)
}

func TestImageHandler_Delete(t *testing.T) {
	imgStore := &testutil.MockImageStore{
		GetByIDFn: func(_ context.Context, id int) (*store.Image, error) {
			return &store.Image{ID: id, Path: "/tmp/test.jpg", Thumbnails: map[string]string{}}, nil
		},
		DeleteFn: func(_ context.Context, ids []int) (int, error) {
			return len(ids), nil
		},
	}
	monStateStore := &testutil.MockMonitorStateStore{}
	histStore := &testutil.MockHistoryStore{}
	playlistStore := &testutil.MockPlaylistStore{}
	h := NewImageHandler(imgStore, monStateStore, histStore, playlistStore, nil, &testutil.MockBus{}, nil)

	w := httptest.NewRecorder()
	r := httptest.NewRequest(http.MethodDelete, "/images", strings.NewReader(`{"ids":[1,2]}`))
	h.Delete(w, r)

	assert.Equal(t, http.StatusOK, w.Code)

	var body map[string]any
	require.NoError(t, json.NewDecoder(w.Body).Decode(&body))
	assert.Equal(t, float64(2), body["deleted"])
}

func TestImageHandler_Tags(t *testing.T) {
	imgStore := &testutil.MockImageStore{
		GetAllTagsFn: func(_ context.Context) ([]string, error) {
			return []string{"nature", "city"}, nil
		},
	}
	h := NewImageHandler(imgStore, nil, nil, nil, nil, &testutil.MockBus{}, nil)

	w := httptest.NewRecorder()
	r := httptest.NewRequest(http.MethodGet, "/images/tags", nil)
	h.Tags(w, r)

	assert.Equal(t, http.StatusOK, w.Code)

	var body map[string]any
	require.NoError(t, json.NewDecoder(w.Body).Decode(&body))
	tags := body["tags"].([]any)
	assert.Len(t, tags, 2)
	assert.Equal(t, "nature", tags[0])
	assert.Equal(t, "city", tags[1])
}

func TestImageHandler_Update(t *testing.T) {
	sample := testutil.SampleImage(42)
	// Give the sample a distinct name so rename logic sees name != current.Name.
	sample.Name = "old_name"
	sample.Path = "/tmp/images/old_name.jpg"
	sample.Format = "jpg"

	imgStore := &testutil.MockImageStore{
		GetByIDFn: func(_ context.Context, _ int) (*store.Image, error) {
			return &sample, nil
		},
		IsNameTakenFn: func(_ context.Context, _ string, _ int) (bool, error) {
			return false, nil
		},
		UpdateFn: func(_ context.Context, id int, updates map[string]any) (*store.Image, error) {
			img := testutil.SampleImage(id)
			if name, ok := updates["name"].(string); ok {
				img.Name = name
			}
			return &img, nil
		},
	}
	h := NewImageHandler(imgStore, nil, nil, nil, nil, &testutil.MockBus{}, nil)

	// Use a name that does not require an actual os.Rename: patch with same
	// name as current so the handler takes the no-op branch (delete from updates).
	w := httptest.NewRecorder()
	r := httptest.NewRequest(http.MethodPatch, "/images/42",
		testutil.JSONBody(t, map[string]any{"name": "old_name"}))
	r = testutil.WithChiURLParams(r, map[string]string{"id": "42"})
	h.Update(w, r)

	assert.Equal(t, http.StatusOK, w.Code)

	var img store.Image
	require.NoError(t, json.NewDecoder(w.Body).Decode(&img))
	assert.Equal(t, 42, img.ID)
}

func TestImageHandler_Update_BadField(t *testing.T) {
	h := NewImageHandler(&testutil.MockImageStore{}, nil, nil, nil, nil, &testutil.MockBus{}, nil)

	w := httptest.NewRecorder()
	r := httptest.NewRequest(http.MethodPatch, "/images/42",
		strings.NewReader(`{"path":"/evil"}`))
	r = testutil.WithChiURLParams(r, map[string]string{"id": "42"})
	h.Update(w, r)

	assert.Equal(t, http.StatusBadRequest, w.Code)
}

func TestImageHandler_Update_InvalidName(t *testing.T) {
	sample := testutil.SampleImage(42)
	imgStore := &testutil.MockImageStore{
		GetByIDFn: func(_ context.Context, _ int) (*store.Image, error) {
			return &sample, nil
		},
	}
	h := NewImageHandler(imgStore, nil, nil, nil, nil, &testutil.MockBus{}, nil)

	w := httptest.NewRecorder()
	// Empty name should fail validation.
	r := httptest.NewRequest(http.MethodPatch, "/images/42",
		testutil.JSONBody(t, map[string]any{"name": ""}))
	r = testutil.WithChiURLParams(r, map[string]string{"id": "42"})
	h.Update(w, r)

	assert.Equal(t, http.StatusBadRequest, w.Code)
}

func TestImageHandler_CancelImport_EmptyBatchID(t *testing.T) {
	h := NewImageHandler(&testutil.MockImageStore{}, nil, nil, nil, nil, &testutil.MockBus{}, nil)

	w := httptest.NewRecorder()
	r := httptest.NewRequest(http.MethodPost, "/images/cancel-import",
		strings.NewReader(`{"batch_id":""}`))
	h.CancelImport(w, r)

	assert.Equal(t, http.StatusBadRequest, w.Code)

	var body httpjson.APIError
	require.NoError(t, json.NewDecoder(w.Body).Decode(&body))
	assert.Contains(t, body.Error, "batch_id")
}
