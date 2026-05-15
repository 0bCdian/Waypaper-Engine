package playlist

import (
	"context"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"waypaper-engine/daemon/internal/backend"
	"waypaper-engine/daemon/internal/store"
)

type stubImageStore struct {
	store.ImageStore
	images map[int]*store.Image
}

func (s *stubImageStore) GetByID(_ context.Context, id int) (*store.Image, error) {
	if img, ok := s.images[id]; ok {
		return img, nil
	}
	return &store.Image{ID: id, MediaType: "image"}, nil
}

func imageOnlyCaps() backend.Capabilities {
	return backend.Capabilities{
		ContentKinds: []backend.ContentKind{backend.KindStaticImage, backend.KindGIF},
	}
}

func allMediaCaps() backend.Capabilities {
	return backend.Capabilities{
		ContentKinds: []backend.ContentKind{backend.KindStaticImage, backend.KindGIF, backend.KindVideo, backend.KindWebWallpaper},
	}
}

func videoOnlyCaps() backend.Capabilities {
	return backend.Capabilities{
		ContentKinds: []backend.ContentKind{backend.KindVideo},
	}
}

func mixedPlaylist() *store.Playlist {
	return &store.Playlist{
		ID:   1,
		Name: "mixed",
		Images: []store.PlaylistImage{
			{ImageID: 1, MediaType: "image"},
			{ImageID: 2, MediaType: "video"},
			{ImageID: 3, MediaType: "web"},
			{ImageID: 4, MediaType: "image"},
			{ImageID: 5, MediaType: "video"},
		},
	}
}

func allVideoPlaylist() *store.Playlist {
	return &store.Playlist{
		ID:   2,
		Name: "all-video",
		Images: []store.PlaylistImage{
			{ImageID: 10, MediaType: "video"},
			{ImageID: 11, MediaType: "video"},
		},
	}
}

func defaultStubImages() *stubImageStore {
	return &stubImageStore{images: map[int]*store.Image{}}
}

func TestFindCompatibleIndex_FirstItemCompatible(t *testing.T) {
	pl := mixedPlaylist()
	idx, skipped := findCompatibleIndex(context.Background(), pl, 0, imageOnlyCaps(), defaultStubImages())
	assert.Equal(t, 0, idx)
	assert.Equal(t, 0, skipped)
}

func TestFindCompatibleIndex_SkipsIncompatible(t *testing.T) {
	pl := mixedPlaylist()
	idx, skipped := findCompatibleIndex(context.Background(), pl, 1, imageOnlyCaps(), defaultStubImages())
	assert.Equal(t, 3, idx)
	assert.Equal(t, 2, skipped)
}

func TestFindCompatibleIndex_WrapsAround(t *testing.T) {
	pl := mixedPlaylist()
	idx, skipped := findCompatibleIndex(context.Background(), pl, 4, imageOnlyCaps(), defaultStubImages())
	assert.Equal(t, 0, idx)
	assert.Equal(t, 1, skipped)
}

func TestFindCompatibleIndex_NoCompatible(t *testing.T) {
	pl := allVideoPlaylist()
	idx, skipped := findCompatibleIndex(context.Background(), pl, 0, imageOnlyCaps(), defaultStubImages())
	assert.Equal(t, -1, idx)
	assert.Equal(t, 2, skipped)
}

func TestFindCompatibleIndex_AllCompatible(t *testing.T) {
	pl := mixedPlaylist()
	idx, skipped := findCompatibleIndex(context.Background(), pl, 2, allMediaCaps(), defaultStubImages())
	assert.Equal(t, 2, idx)
	assert.Equal(t, 0, skipped)
}

func TestFindCompatibleIndex_VideoOnly(t *testing.T) {
	pl := mixedPlaylist()
	idx, skipped := findCompatibleIndex(context.Background(), pl, 0, videoOnlyCaps(), defaultStubImages())
	assert.Equal(t, 1, idx)
	assert.Equal(t, 1, skipped)
}

func TestFindCompatibleIndex_BackwardSkipsToPreviousCompatible(t *testing.T) {
	// Regression: forward-only search from the raw "previous" slot could wrap
	// back to the current index (e.g. [img, web, img] at last image).
	pl := &store.Playlist{
		ID:   9,
		Name: "sandwich",
		Images: []store.PlaylistImage{
			{ImageID: 1, MediaType: "image"},
			{ImageID: 2, MediaType: "web"},
			{ImageID: 3, MediaType: "image"},
		},
	}
	// Raw "previous" from index 2 is 1 (web); backward must reach index 0.
	idx, skipped, items := findCompatibleIndexWithWalk(context.Background(), pl, 1, compatBackward, imageOnlyCaps(), defaultStubImages())
	assert.Equal(t, 0, idx)
	assert.Equal(t, 1, skipped)
	require.Len(t, items, 1)
	assert.Equal(t, 2, items[0].ImageID)
	assert.Equal(t, "web", items[0].MediaType)
}

func TestFindCompatibleIndex_FallbackToImageStore(t *testing.T) {
	pl := &store.Playlist{
		ID:   3,
		Name: "no-mediatype",
		Images: []store.PlaylistImage{
			{ImageID: 1, MediaType: ""},
			{ImageID: 2, MediaType: ""},
		},
	}
	imgStore := &stubImageStore{
		images: map[int]*store.Image{
			1: {ID: 1, MediaType: "web"},
			2: {ID: 2, MediaType: "image"},
		},
	}
	idx, skipped := findCompatibleIndex(context.Background(), pl, 0, imageOnlyCaps(), imgStore)
	assert.Equal(t, 1, idx)
	assert.Equal(t, 1, skipped)
}

func TestBackendSupportsMedia(t *testing.T) {
	caps := imageOnlyCaps()
	require.True(t, backend.SupportsMedia(caps, "image"))
	require.True(t, backend.SupportsMedia(caps, "gif"))
	require.True(t, backend.SupportsMedia(caps, "IMAGE"))
	require.True(t, backend.SupportsMedia(caps, ""))
	require.False(t, backend.SupportsMedia(caps, "video"))
	require.False(t, backend.SupportsMedia(caps, "web"))
}
