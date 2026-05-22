package testutil

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"testing"
	"time"

	"github.com/go-chi/chi/v5"

	"waypaper-engine/daemon/internal/store"
)

// OpenTestDB opens a CloverDB-backed store.DB in a temporary directory owned
// by t. The database is automatically closed when the test finishes.
func OpenTestDB(t *testing.T) store.DB {
	t.Helper()
	db, err := store.OpenDB(t.TempDir())
	if err != nil {
		t.Fatalf("OpenTestDB: %v", err)
	}
	t.Cleanup(func() { _ = db.Close() })
	return db
}

// SampleImage returns a store.Image populated with sensible defaults.
func SampleImage(id int) store.Image {
	return store.Image{
		ID:         id,
		Name:       fmt.Sprintf("image_%d.jpg", id),
		Path:       fmt.Sprintf("/tmp/images/image_%d.jpg", id),
		MediaType:  "image",
		Width:      1920,
		Height:     1080,
		Format:     "jpg",
		FileSize:   1024000,
		Checksum:   fmt.Sprintf("sha256:abc%d", id),
		Tags:       []string{"nature", "landscape"},
		Colors:     []string{"#ff0000", "#00ff00"},
		ImportedAt: time.Now(),
		SourcePath: fmt.Sprintf("/home/user/wallpapers/image_%d.jpg", id),
	}
}

// SamplePlaylist returns a store.Playlist populated with sensible defaults.
func SamplePlaylist(id int, name string) store.Playlist {
	now := time.Now()
	return store.Playlist{
		ID:        id,
		Name:      name,
		CreatedAt: now,
		UpdatedAt: now,
		Configuration: store.PlaylistConfiguration{
			Type:     "timer",
			Interval: 300,
			Order:    "ordered",
		},
		Images: []store.PlaylistImage{},
	}
}

// SampleFolder returns a store.Folder populated with sensible defaults.
func SampleFolder(id int, name string) store.Folder {
	now := time.Now()
	return store.Folder{
		ID:        id,
		Name:      name,
		ParentID:  nil,
		CreatedAt: now,
		UpdatedAt: now,
	}
}

// WithChiURLParams injects chi route context URL parameters into the request,
// enabling handler tests that rely on chi.URLParam extraction.
func WithChiURLParams(r *http.Request, params map[string]string) *http.Request {
	chiCtx := chi.NewRouteContext()
	for key, value := range params {
		chiCtx.URLParams.Add(key, value)
	}
	return r.WithContext(context.WithValue(r.Context(), chi.RouteCtxKey, chiCtx))
}

// JSONBody marshals v to JSON and returns a *strings.Reader suitable for use
// as an http.Request body. Fails the test on marshal error.
func JSONBody(t *testing.T, v any) *strings.Reader {
	t.Helper()
	data, err := json.Marshal(v)
	if err != nil {
		t.Fatalf("JSONBody: marshal: %v", err)
	}
	return strings.NewReader(string(data))
}
