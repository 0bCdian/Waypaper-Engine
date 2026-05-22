package playlist

import (
	"testing"

	"github.com/stretchr/testify/assert"

	"waypaper-engine/daemon/internal/store"
)

func TestResolvePlaylistRowForPlayback_prefersCurrentImageID(t *testing.T) {
	inst := &store.ActivePlaylistInstance{
		ActivePlaylistState: store.ActivePlaylistState{
			CurrentIndex:   99,
			CurrentImageID: 42,
		},
	}
	pl := &store.Playlist{Images: []store.PlaylistImage{
		{ImageID: 10}, {ImageID: 42}, {ImageID: 99},
	}}
	assert.Equal(t, 1, resolvePlaylistRowForPlayback(inst, pl))
}

func TestResolvePlaylistRowForPlayback_fallbackWhenImageRemoved(t *testing.T) {
	inst := &store.ActivePlaylistInstance{
		ActivePlaylistState: store.ActivePlaylistState{
			CurrentIndex:   5,
			CurrentImageID: 404,
		},
	}
	pl := &store.Playlist{Images: []store.PlaylistImage{
		{ImageID: 1}, {ImageID: 2}, {ImageID: 3},
	}}
	assert.Equal(t, 2, resolvePlaylistRowForPlayback(inst, pl))
}

func TestResolvePlaylistRowForPlayback_nilInst(t *testing.T) {
	pl := &store.Playlist{Images: []store.PlaylistImage{{ImageID: 1}}}
	assert.Equal(t, 0, resolvePlaylistRowForPlayback(nil, pl))
}

func TestAdvancePlaylistRow_prefersCurrentImageIDWhenIndexStale(t *testing.T) {
	inst := &store.ActivePlaylistInstance{
		ActivePlaylistState: store.ActivePlaylistState{
			CurrentIndex:   7,
			CurrentImageID: 100,
		},
	}
	pl := &store.Playlist{Images: []store.PlaylistImage{
		{ImageID: 1}, {ImageID: 100}, {ImageID: 2}, {ImageID: 3},
	}}
	assert.Equal(t, 2, advancePlaylistRow(inst, pl, 1))
	assert.Equal(t, 0, advancePlaylistRow(inst, pl, -1))
}

func TestAdvancePlaylistRow_wrapAtEnds(t *testing.T) {
	inst := &store.ActivePlaylistInstance{
		ActivePlaylistState: store.ActivePlaylistState{
			CurrentIndex:   0,
			CurrentImageID: 3,
		},
	}
	pl := &store.Playlist{Images: []store.PlaylistImage{
		{ImageID: 1}, {ImageID: 2}, {ImageID: 3},
	}}
	assert.Equal(t, 0, advancePlaylistRow(inst, pl, 1))
	assert.Equal(t, 1, advancePlaylistRow(inst, pl, -1))
}
