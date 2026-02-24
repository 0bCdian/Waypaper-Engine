package handler

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"waypaper-engine/daemon/internal/store"
	"waypaper-engine/daemon/internal/testutil"
)

func TestFolderHandler_List(t *testing.T) {
	fs := &testutil.MockFolderStore{
		GetAllFn: func(_ context.Context, parentID *int) ([]store.Folder, error) {
			return []store.Folder{
				testutil.SampleFolder(1, "Landscapes"),
				testutil.SampleFolder(2, "Portraits"),
			}, nil
		},
	}
	h := NewFolderHandler(fs, &testutil.MockImageStore{}, &testutil.MockBus{})

	w := httptest.NewRecorder()
	r := httptest.NewRequest(http.MethodGet, "/folders", nil)
	h.List(w, r)

	assert.Equal(t, http.StatusOK, w.Code)

	var body map[string][]store.Folder
	require.NoError(t, json.NewDecoder(w.Body).Decode(&body))
	assert.Len(t, body["data"], 2)
}

func TestFolderHandler_Get_Found(t *testing.T) {
	fs := &testutil.MockFolderStore{
		GetByIDFn: func(_ context.Context, id int) (*store.Folder, error) {
			f := testutil.SampleFolder(id, "Photos")
			return &f, nil
		},
	}
	h := NewFolderHandler(fs, &testutil.MockImageStore{}, &testutil.MockBus{})

	w := httptest.NewRecorder()
	r := httptest.NewRequest(http.MethodGet, "/folders/1", nil)
	r = testutil.WithChiURLParams(r, map[string]string{"id": "1"})
	h.Get(w, r)

	assert.Equal(t, http.StatusOK, w.Code)

	var folder store.Folder
	require.NoError(t, json.NewDecoder(w.Body).Decode(&folder))
	assert.Equal(t, 1, folder.ID)
}

func TestFolderHandler_Get_NotFound(t *testing.T) {
	fs := &testutil.MockFolderStore{
		GetByIDFn: func(_ context.Context, id int) (*store.Folder, error) {
			return nil, store.ErrNotFound
		},
	}
	h := NewFolderHandler(fs, &testutil.MockImageStore{}, &testutil.MockBus{})

	w := httptest.NewRecorder()
	r := httptest.NewRequest(http.MethodGet, "/folders/999", nil)
	r = testutil.WithChiURLParams(r, map[string]string{"id": "999"})
	h.Get(w, r)

	assert.Equal(t, http.StatusNotFound, w.Code)
}

func TestFolderHandler_GetPath(t *testing.T) {
	fs := &testutil.MockFolderStore{
		GetPathFn: func(_ context.Context, id int) ([]store.Folder, error) {
			return []store.Folder{
				testutil.SampleFolder(1, "Root"),
				testutil.SampleFolder(2, "Sub"),
				testutil.SampleFolder(3, "Deep"),
			}, nil
		},
	}
	h := NewFolderHandler(fs, &testutil.MockImageStore{}, &testutil.MockBus{})

	w := httptest.NewRecorder()
	r := httptest.NewRequest(http.MethodGet, "/folders/3/path", nil)
	r = testutil.WithChiURLParams(r, map[string]string{"id": "3"})
	h.GetPath(w, r)

	assert.Equal(t, http.StatusOK, w.Code)

	var body map[string][]store.Folder
	require.NoError(t, json.NewDecoder(w.Body).Decode(&body))
	assert.Len(t, body["data"], 3)
}

func TestFolderHandler_Create(t *testing.T) {
	fs := &testutil.MockFolderStore{
		CreateFn: func(_ context.Context, folder store.Folder) (*store.Folder, error) {
			created := testutil.SampleFolder(10, folder.Name)
			return &created, nil
		},
	}
	h := NewFolderHandler(fs, &testutil.MockImageStore{}, &testutil.MockBus{})

	w := httptest.NewRecorder()
	r := httptest.NewRequest(http.MethodPost, "/folders",
		strings.NewReader(`{"name":"Photos"}`))
	h.Create(w, r)

	assert.Equal(t, http.StatusCreated, w.Code)

	var folder store.Folder
	require.NoError(t, json.NewDecoder(w.Body).Decode(&folder))
	assert.Equal(t, "Photos", folder.Name)
}

func TestFolderHandler_Create_EmptyName(t *testing.T) {
	h := NewFolderHandler(&testutil.MockFolderStore{}, &testutil.MockImageStore{}, &testutil.MockBus{})

	w := httptest.NewRecorder()
	r := httptest.NewRequest(http.MethodPost, "/folders",
		strings.NewReader(`{"name":""}`))
	h.Create(w, r)

	assert.Equal(t, http.StatusBadRequest, w.Code)
}

func TestFolderHandler_Delete(t *testing.T) {
	fs := &testutil.MockFolderStore{
		GetByIDFn: func(_ context.Context, id int) (*store.Folder, error) {
			f := testutil.SampleFolder(id, "ToDelete")
			return &f, nil
		},
		GetAllFn: func(_ context.Context, parentID *int) ([]store.Folder, error) {
			return []store.Folder{}, nil
		},
		DeleteFn: func(_ context.Context, id int) error {
			return nil
		},
	}
	imgStore := &testutil.MockImageStore{
		GetAllFn: func(_ context.Context, opts store.ImageQueryOpts) (*store.PaginatedResult[store.Image], error) {
			return &store.PaginatedResult[store.Image]{Data: []store.Image{}}, nil
		},
	}
	h := NewFolderHandler(fs, imgStore, &testutil.MockBus{})

	w := httptest.NewRecorder()
	r := httptest.NewRequest(http.MethodDelete, "/folders/1", nil)
	r = testutil.WithChiURLParams(r, map[string]string{"id": "1"})
	h.Delete(w, r)

	assert.Equal(t, http.StatusOK, w.Code)

	var body map[string]any
	require.NoError(t, json.NewDecoder(w.Body).Decode(&body))
	assert.Equal(t, true, body["deleted"])
}

func TestFolderHandler_MoveImages(t *testing.T) {
	imgStore := &testutil.MockImageStore{
		UpdateFn: func(_ context.Context, id int, updates map[string]any) (*store.Image, error) {
			img := testutil.SampleImage(id)
			return &img, nil
		},
	}
	h := NewFolderHandler(&testutil.MockFolderStore{}, imgStore, &testutil.MockBus{})

	w := httptest.NewRecorder()
	folderID := 5
	r := httptest.NewRequest(http.MethodPost, "/folders/move-images",
		testutil.JSONBody(t, map[string]any{"image_ids": []int{1, 2, 3}, "folder_id": folderID}))
	h.MoveImages(w, r)

	assert.Equal(t, http.StatusOK, w.Code)

	var body map[string]any
	require.NoError(t, json.NewDecoder(w.Body).Decode(&body))
	assert.Equal(t, float64(3), body["moved"])
}
