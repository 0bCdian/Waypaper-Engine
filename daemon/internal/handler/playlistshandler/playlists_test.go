package playlistshandler

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"waypaper-engine/daemon/internal/store"
	"waypaper-engine/daemon/internal/testutil"
)

func TestPlaylistHandler_List(t *testing.T) {
	ps := &testutil.MockPlaylistStore{
		GetAllFn: func(_ context.Context) ([]store.Playlist, error) {
			return []store.Playlist{
				testutil.SamplePlaylist(1, "Morning"),
				testutil.SamplePlaylist(2, "Evening"),
			}, nil
		},
	}
	h := NewPlaylistHandler(ps, &testutil.MockStateStore{}, nil, &testutil.MockBus{})

	w := httptest.NewRecorder()
	r := httptest.NewRequest(http.MethodGet, "/playlists", nil)
	h.List(w, r)

	assert.Equal(t, http.StatusOK, w.Code)

	var playlists []store.Playlist
	require.NoError(t, json.NewDecoder(w.Body).Decode(&playlists))
	assert.Len(t, playlists, 2)
}

func TestPlaylistHandler_Get_Found(t *testing.T) {
	ps := &testutil.MockPlaylistStore{
		GetByIDFn: func(_ context.Context, id int) (*store.Playlist, error) {
			pl := testutil.SamplePlaylist(id, "Nature")
			return &pl, nil
		},
	}
	h := NewPlaylistHandler(ps, &testutil.MockStateStore{}, nil, &testutil.MockBus{})

	w := httptest.NewRecorder()
	r := httptest.NewRequest(http.MethodGet, "/playlists/1", nil)
	r = testutil.WithChiURLParams(r, map[string]string{"id": "1"})
	h.Get(w, r)

	assert.Equal(t, http.StatusOK, w.Code)

	var pl store.Playlist
	require.NoError(t, json.NewDecoder(w.Body).Decode(&pl))
	assert.Equal(t, 1, pl.ID)
	assert.Equal(t, "Nature", pl.Name)
}

func TestPlaylistHandler_Get_NotFound(t *testing.T) {
	ps := &testutil.MockPlaylistStore{
		GetByIDFn: func(_ context.Context, id int) (*store.Playlist, error) {
			return nil, store.ErrNotFound
		},
	}
	h := NewPlaylistHandler(ps, &testutil.MockStateStore{}, nil, &testutil.MockBus{})

	w := httptest.NewRecorder()
	r := httptest.NewRequest(http.MethodGet, "/playlists/999", nil)
	r = testutil.WithChiURLParams(r, map[string]string{"id": "999"})
	h.Get(w, r)

	assert.Equal(t, http.StatusNotFound, w.Code)
}

func TestPlaylistHandler_Create(t *testing.T) {
	ps := &testutil.MockPlaylistStore{
		CreateFn: func(_ context.Context, pl store.Playlist) (*store.Playlist, error) {
			created := testutil.SamplePlaylist(10, pl.Name)
			return &created, nil
		},
	}
	h := NewPlaylistHandler(ps, &testutil.MockStateStore{}, nil, &testutil.MockBus{})

	w := httptest.NewRecorder()
	r := httptest.NewRequest(http.MethodPost, "/playlists",
		testutil.JSONBody(t, store.Playlist{Name: "New Playlist"}))
	h.Create(w, r)

	assert.Equal(t, http.StatusCreated, w.Code)

	var pl store.Playlist
	require.NoError(t, json.NewDecoder(w.Body).Decode(&pl))
	assert.Equal(t, 10, pl.ID)
	assert.Equal(t, "New Playlist", pl.Name)
}

func TestPlaylistHandler_Update(t *testing.T) {
	ps := &testutil.MockPlaylistStore{
		UpdateFn: func(_ context.Context, id int, updates map[string]any) (*store.Playlist, error) {
			pl := testutil.SamplePlaylist(id, "Updated")
			return &pl, nil
		},
	}
	h := NewPlaylistHandler(ps, &testutil.MockStateStore{}, nil, &testutil.MockBus{})

	w := httptest.NewRecorder()
	r := httptest.NewRequest(http.MethodPatch, "/playlists/5",
		testutil.JSONBody(t, map[string]any{"name": "Updated"}))
	r = testutil.WithChiURLParams(r, map[string]string{"id": "5"})
	h.Update(w, r)

	assert.Equal(t, http.StatusOK, w.Code)

	var pl store.Playlist
	require.NoError(t, json.NewDecoder(w.Body).Decode(&pl))
	assert.Equal(t, 5, pl.ID)
}

func TestPlaylistHandler_Delete(t *testing.T) {
	ps := &testutil.MockPlaylistStore{
		DeleteFn: func(_ context.Context, id int) error {
			return nil
		},
	}
	h := NewPlaylistHandler(ps, &testutil.MockStateStore{}, nil, &testutil.MockBus{})

	w := httptest.NewRecorder()
	r := httptest.NewRequest(http.MethodDelete, "/playlists/3", nil)
	r = testutil.WithChiURLParams(r, map[string]string{"id": "3"})
	h.Delete(w, r)

	assert.Equal(t, http.StatusOK, w.Code)
	assert.Contains(t, w.Body.String(), `"deleted"`)
}

func TestPlaylistHandler_Delete_NotFound(t *testing.T) {
	ps := &testutil.MockPlaylistStore{
		DeleteFn: func(_ context.Context, id int) error {
			return errors.New("playlist not found")
		},
	}
	h := NewPlaylistHandler(ps, &testutil.MockStateStore{}, nil, &testutil.MockBus{})

	w := httptest.NewRecorder()
	r := httptest.NewRequest(http.MethodDelete, "/playlists/999", nil)
	r = testutil.WithChiURLParams(r, map[string]string{"id": "999"})
	h.Delete(w, r)

	assert.Equal(t, http.StatusNotFound, w.Code)
}

func TestPlaylistHandler_ListActive(t *testing.T) {
	ss := &testutil.MockStateStore{
		GetActivePlaylistsFn: func() map[int]store.ActivePlaylistInstance {
			return map[int]store.ActivePlaylistInstance{
				1: {
					ActivePlaylistState: store.ActivePlaylistState{
						PlaylistID:   1,
						PlaylistName: "Morning",
					},
					Mode:     "individual",
					Monitors: []string{"HDMI-A-1"},
				},
			}
		},
	}
	h := NewPlaylistHandler(&testutil.MockPlaylistStore{}, ss, nil, &testutil.MockBus{})

	w := httptest.NewRecorder()
	r := httptest.NewRequest(http.MethodGet, "/playlists/active", nil)
	h.ListActive(w, r)

	assert.Equal(t, http.StatusOK, w.Code)

	var result []store.ActivePlaylistInstance
	require.NoError(t, json.NewDecoder(w.Body).Decode(&result))
	assert.Len(t, result, 1)
	assert.Equal(t, 1, result[0].PlaylistID)
	assert.Equal(t, []string{"HDMI-A-1"}, result[0].Monitors)
}

func TestPlaylistHandler_StopAll(t *testing.T) {
	t.Skip("StopAll requires a non-nil playlist.Manager; skipping unit test")
}

func TestPlaylistHandler_Get_BadID(t *testing.T) {
	h := NewPlaylistHandler(&testutil.MockPlaylistStore{}, &testutil.MockStateStore{}, nil, &testutil.MockBus{})

	w := httptest.NewRecorder()
	r := httptest.NewRequest(http.MethodGet, "/playlists/abc", nil)
	r = testutil.WithChiURLParams(r, map[string]string{"id": "abc"})
	h.Get(w, r)

	assert.Equal(t, http.StatusBadRequest, w.Code)
}
