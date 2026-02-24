package store_test

import (
	"context"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"waypaper-engine/daemon/internal/store"
	"waypaper-engine/daemon/internal/testutil"
)

// ---------------------------------------------------------------------------
// ImageStore
// ---------------------------------------------------------------------------

func TestImageStore_CreateAndGetByID(t *testing.T) {
	db := testutil.OpenTestDB(t)
	is := db.ImageStore()
	ctx := context.Background()

	img1 := testutil.SampleImage(0)
	img1.Name = "first.jpg"
	img2 := testutil.SampleImage(0)
	img2.Name = "second.jpg"

	created, err := is.Create(ctx, []store.Image{img1, img2})
	require.NoError(t, err)
	require.Len(t, created, 2)
	assert.Equal(t, 1, created[0].ID)
	assert.Equal(t, 2, created[1].ID)

	got, err := is.GetByID(ctx, 1)
	require.NoError(t, err)
	assert.Equal(t, "first.jpg", got.Name)

	got, err = is.GetByID(ctx, 2)
	require.NoError(t, err)
	assert.Equal(t, "second.jpg", got.Name)
}

func TestImageStore_GetByID_NotFound(t *testing.T) {
	db := testutil.OpenTestDB(t)
	is := db.ImageStore()

	_, err := is.GetByID(context.Background(), 999)
	require.Error(t, err)
	assert.Contains(t, err.Error(), "not found")
}

func TestImageStore_GetAll_Pagination(t *testing.T) {
	db := testutil.OpenTestDB(t)
	is := db.ImageStore()
	ctx := context.Background()

	imgs := make([]store.Image, 10)
	for i := range imgs {
		imgs[i] = testutil.SampleImage(0)
		imgs[i].Name = "img_" + string(rune('a'+i)) + ".jpg"
		imgs[i].Checksum = "sha256:pag" + string(rune('a'+i))
	}
	_, err := is.Create(ctx, imgs)
	require.NoError(t, err)

	page1, err := is.GetAll(ctx, store.ImageQueryOpts{Page: 1, PerPage: 3})
	require.NoError(t, err)
	assert.Len(t, page1.Data, 3)
	assert.Equal(t, 10, page1.Pagination.TotalItems)
	assert.Equal(t, 4, page1.Pagination.TotalPages)

	page4, err := is.GetAll(ctx, store.ImageQueryOpts{Page: 4, PerPage: 3})
	require.NoError(t, err)
	assert.Len(t, page4.Data, 1)
}

func TestImageStore_GetAll_SearchByName(t *testing.T) {
	db := testutil.OpenTestDB(t)
	is := db.ImageStore()
	ctx := context.Background()

	names := []string{"ocean sunset", "mountain view", "city lights"}
	imgs := make([]store.Image, len(names))
	for i, name := range names {
		imgs[i] = testutil.SampleImage(0)
		imgs[i].Name = name
		imgs[i].Checksum = "sha256:search_name_" + name
		imgs[i].Tags = []string{}
	}
	_, err := is.Create(ctx, imgs)
	require.NoError(t, err)

	result, err := is.GetAll(ctx, store.ImageQueryOpts{Search: "ocean", Page: 1, PerPage: 50})
	require.NoError(t, err)
	require.Len(t, result.Data, 1)
	assert.Contains(t, result.Data[0].Name, "ocean")
}

func TestImageStore_GetAll_SearchByTag(t *testing.T) {
	db := testutil.OpenTestDB(t)
	is := db.ImageStore()
	ctx := context.Background()

	img := testutil.SampleImage(0)
	img.Name = "tagged.jpg"
	img.Tags = []string{"nature", "beach"}
	img.Checksum = "sha256:tagged1"

	other := testutil.SampleImage(0)
	other.Name = "other.jpg"
	other.Tags = []string{"city"}
	other.Checksum = "sha256:tagged2"

	_, err := is.Create(ctx, []store.Image{img, other})
	require.NoError(t, err)

	result, err := is.GetAll(ctx, store.ImageQueryOpts{Search: "beach", Page: 1, PerPage: 50})
	require.NoError(t, err)
	require.Len(t, result.Data, 1)
	assert.Equal(t, "tagged.jpg", result.Data[0].Name)
}

func TestImageStore_GetAll_SortByName(t *testing.T) {
	db := testutil.OpenTestDB(t)
	is := db.ImageStore()
	ctx := context.Background()

	names := []string{"charlie", "alice", "bob"}
	imgs := make([]store.Image, len(names))
	for i, name := range names {
		imgs[i] = testutil.SampleImage(0)
		imgs[i].Name = name
		imgs[i].Checksum = "sha256:sort_" + name
	}
	_, err := is.Create(ctx, imgs)
	require.NoError(t, err)

	result, err := is.GetAll(ctx, store.ImageQueryOpts{
		Page: 1, PerPage: 50,
		SortBy: "name", SortOrder: "asc",
	})
	require.NoError(t, err)
	require.Len(t, result.Data, 3)
	assert.Equal(t, "alice", result.Data[0].Name)
	assert.Equal(t, "bob", result.Data[1].Name)
	assert.Equal(t, "charlie", result.Data[2].Name)
}

func TestImageStore_GetAll_MediaTypeFilter(t *testing.T) {
	db := testutil.OpenTestDB(t)
	is := db.ImageStore()
	ctx := context.Background()

	img := testutil.SampleImage(0)
	img.Name = "photo.jpg"
	img.MediaType = "image"
	img.Checksum = "sha256:media1"

	vid := testutil.SampleImage(0)
	vid.Name = "clip.mp4"
	vid.MediaType = "video"
	vid.Checksum = "sha256:media2"

	gif := testutil.SampleImage(0)
	gif.Name = "anim.gif"
	gif.MediaType = "gif"
	gif.Checksum = "sha256:media3"

	_, err := is.Create(ctx, []store.Image{img, vid, gif})
	require.NoError(t, err)

	result, err := is.GetAll(ctx, store.ImageQueryOpts{MediaType: "image", Page: 1, PerPage: 50})
	require.NoError(t, err)
	require.Len(t, result.Data, 1)
	assert.Equal(t, "photo.jpg", result.Data[0].Name)
}

func TestImageStore_GetAll_FolderFilter(t *testing.T) {
	db := testutil.OpenTestDB(t)
	is := db.ImageStore()
	fs := db.FolderStore()
	ctx := context.Background()

	folder, err := fs.Create(ctx, store.Folder{Name: "Wallpapers"})
	require.NoError(t, err)

	rootImg := testutil.SampleImage(0)
	rootImg.Name = "root.jpg"
	rootImg.Checksum = "sha256:folder1"

	folderImg := testutil.SampleImage(0)
	folderImg.Name = "in_folder.jpg"
	folderImg.FolderID = &folder.ID
	folderImg.Checksum = "sha256:folder2"

	_, err = is.Create(ctx, []store.Image{rootImg, folderImg})
	require.NoError(t, err)

	// nil = all images (no folder filter)
	all, err := is.GetAll(ctx, store.ImageQueryOpts{FolderID: nil, Page: 1, PerPage: 50})
	require.NoError(t, err)
	assert.Len(t, all.Data, 2)

	// FolderID=0 means root images only
	zero := 0
	root, err := is.GetAll(ctx, store.ImageQueryOpts{FolderID: &zero, Page: 1, PerPage: 50})
	require.NoError(t, err)
	require.Len(t, root.Data, 1)
	assert.Equal(t, "root.jpg", root.Data[0].Name)

	// FolderID=specific
	fid := folder.ID
	inFolder, err := is.GetAll(ctx, store.ImageQueryOpts{FolderID: &fid, Page: 1, PerPage: 50})
	require.NoError(t, err)
	require.Len(t, inFolder.Data, 1)
	assert.Equal(t, "in_folder.jpg", inFolder.Data[0].Name)
}

func TestImageStore_Update(t *testing.T) {
	db := testutil.OpenTestDB(t)
	is := db.ImageStore()
	ctx := context.Background()

	img := testutil.SampleImage(0)
	img.Name = "original.jpg"
	created, err := is.Create(ctx, []store.Image{img})
	require.NoError(t, err)
	id := created[0].ID

	updated, err := is.Update(ctx, id, map[string]any{"name": "renamed.jpg"})
	require.NoError(t, err)
	assert.Equal(t, "renamed.jpg", updated.Name)
	assert.Equal(t, img.Width, updated.Width)
	assert.Equal(t, img.Height, updated.Height)
	assert.Equal(t, img.MediaType, updated.MediaType)
}

func TestImageStore_Delete(t *testing.T) {
	db := testutil.OpenTestDB(t)
	is := db.ImageStore()
	ctx := context.Background()

	imgs := make([]store.Image, 3)
	for i := range imgs {
		imgs[i] = testutil.SampleImage(0)
		imgs[i].Name = "del_" + string(rune('a'+i)) + ".jpg"
		imgs[i].Checksum = "sha256:del_" + string(rune('a'+i))
	}
	created, err := is.Create(ctx, imgs)
	require.NoError(t, err)

	deleted, err := is.Delete(ctx, []int{created[0].ID, created[1].ID})
	require.NoError(t, err)
	assert.Equal(t, 2, deleted)

	count, err := is.Count(ctx)
	require.NoError(t, err)
	assert.Equal(t, 1, count)
}

func TestImageStore_UpdateAll(t *testing.T) {
	db := testutil.OpenTestDB(t)
	is := db.ImageStore()
	ctx := context.Background()

	imgs := make([]store.Image, 3)
	for i := range imgs {
		imgs[i] = testutil.SampleImage(0)
		imgs[i].Name = "upall_" + string(rune('a'+i)) + ".jpg"
		imgs[i].Checksum = "sha256:upall_" + string(rune('a'+i))
		imgs[i].IsSelected = false
	}
	_, err := is.Create(ctx, imgs)
	require.NoError(t, err)

	n, err := is.UpdateAll(ctx, map[string]any{"is_selected": true})
	require.NoError(t, err)
	assert.Equal(t, 3, n)

	result, err := is.GetAll(ctx, store.ImageQueryOpts{Page: 1, PerPage: 50})
	require.NoError(t, err)
	for _, img := range result.Data {
		assert.True(t, img.IsSelected, "image %d should be selected", img.ID)
	}
}

func TestImageStore_GetAllTags(t *testing.T) {
	db := testutil.OpenTestDB(t)
	is := db.ImageStore()
	ctx := context.Background()

	img1 := testutil.SampleImage(0)
	img1.Tags = []string{"nature", "sunset"}
	img1.Checksum = "sha256:tags1"

	img2 := testutil.SampleImage(0)
	img2.Tags = []string{"nature", "ocean"}
	img2.Checksum = "sha256:tags2"

	_, err := is.Create(ctx, []store.Image{img1, img2})
	require.NoError(t, err)

	tags, err := is.GetAllTags(ctx)
	require.NoError(t, err)
	assert.Len(t, tags, 3)
	assert.ElementsMatch(t, []string{"nature", "sunset", "ocean"}, tags)
}

func TestImageStore_Count(t *testing.T) {
	db := testutil.OpenTestDB(t)
	is := db.ImageStore()
	ctx := context.Background()

	imgs := make([]store.Image, 5)
	for i := range imgs {
		imgs[i] = testutil.SampleImage(0)
		imgs[i].Checksum = "sha256:count_" + string(rune('a'+i))
	}
	_, err := is.Create(ctx, imgs)
	require.NoError(t, err)

	count, err := is.Count(ctx)
	require.NoError(t, err)
	assert.Equal(t, 5, count)
}

func TestImageStore_IsNameTaken(t *testing.T) {
	db := testutil.OpenTestDB(t)
	is := db.ImageStore()
	ctx := context.Background()

	img := testutil.SampleImage(0)
	img.Name = "test.jpg"
	created, err := is.Create(ctx, []store.Image{img})
	require.NoError(t, err)
	id := created[0].ID

	taken, err := is.IsNameTaken(ctx, "test.jpg", 0)
	require.NoError(t, err)
	assert.True(t, taken, "name should be taken when excludeID=0")

	taken, err = is.IsNameTaken(ctx, "test.jpg", id)
	require.NoError(t, err)
	assert.False(t, taken, "name should not be taken when excluding own ID")
}

// ---------------------------------------------------------------------------
// FolderStore
// ---------------------------------------------------------------------------

func TestFolderStore_CreateAndGetByID(t *testing.T) {
	db := testutil.OpenTestDB(t)
	fs := db.FolderStore()
	ctx := context.Background()

	created, err := fs.Create(ctx, store.Folder{Name: "My Folder"})
	require.NoError(t, err)
	assert.Greater(t, created.ID, 0)
	assert.Equal(t, "My Folder", created.Name)

	got, err := fs.GetByID(ctx, created.ID)
	require.NoError(t, err)
	assert.Equal(t, created.ID, got.ID)
	assert.Equal(t, "My Folder", got.Name)
}

func TestFolderStore_GetAll_ParentFilter(t *testing.T) {
	db := testutil.OpenTestDB(t)
	fs := db.FolderStore()
	ctx := context.Background()

	root, err := fs.Create(ctx, store.Folder{Name: "Root"})
	require.NoError(t, err)

	parentID := root.ID
	_, err = fs.Create(ctx, store.Folder{Name: "Child", ParentID: &parentID})
	require.NoError(t, err)

	// GetAll(nil) returns root-level folders (those without a parent)
	rootFolders, err := fs.GetAll(ctx, nil)
	require.NoError(t, err)
	assert.Len(t, rootFolders, 1)
	assert.Equal(t, "Root", rootFolders[0].Name)

	// GetAll with parent ID returns children of that folder
	children, err := fs.GetAll(ctx, &parentID)
	require.NoError(t, err)
	assert.Len(t, children, 1)
	assert.Equal(t, "Child", children[0].Name)
}

func TestFolderStore_GetPath(t *testing.T) {
	db := testutil.OpenTestDB(t)
	fs := db.FolderStore()
	ctx := context.Background()

	grandparent, err := fs.Create(ctx, store.Folder{Name: "Grandparent"})
	require.NoError(t, err)

	gpID := grandparent.ID
	parent, err := fs.Create(ctx, store.Folder{Name: "Parent", ParentID: &gpID})
	require.NoError(t, err)

	pID := parent.ID
	child, err := fs.Create(ctx, store.Folder{Name: "Child", ParentID: &pID})
	require.NoError(t, err)

	path, err := fs.GetPath(ctx, child.ID)
	require.NoError(t, err)
	require.Len(t, path, 3)
	assert.Equal(t, "Grandparent", path[0].Name)
	assert.Equal(t, "Parent", path[1].Name)
	assert.Equal(t, "Child", path[2].Name)
}

func TestFolderStore_Update(t *testing.T) {
	db := testutil.OpenTestDB(t)
	fs := db.FolderStore()
	ctx := context.Background()

	created, err := fs.Create(ctx, store.Folder{Name: "Old Name"})
	require.NoError(t, err)

	updated, err := fs.Update(ctx, created.ID, map[string]any{"name": "New Name"})
	require.NoError(t, err)
	assert.Equal(t, "New Name", updated.Name)
}

func TestFolderStore_Delete(t *testing.T) {
	db := testutil.OpenTestDB(t)
	fs := db.FolderStore()
	ctx := context.Background()

	created, err := fs.Create(ctx, store.Folder{Name: "Doomed"})
	require.NoError(t, err)

	err = fs.Delete(ctx, created.ID)
	require.NoError(t, err)

	_, err = fs.GetByID(ctx, created.ID)
	require.Error(t, err)
	assert.Contains(t, err.Error(), "not found")
}

func TestFolderStore_Search(t *testing.T) {
	db := testutil.OpenTestDB(t)
	fs := db.FolderStore()
	ctx := context.Background()

	_, err := fs.Create(ctx, store.Folder{Name: "Photos"})
	require.NoError(t, err)
	_, err = fs.Create(ctx, store.Folder{Name: "Videos"})
	require.NoError(t, err)

	results, err := fs.Search(ctx, "photo")
	require.NoError(t, err)
	require.Len(t, results, 1)
	assert.Equal(t, "Photos", results[0].Name)
}

func TestFolderStore_Count(t *testing.T) {
	db := testutil.OpenTestDB(t)
	fs := db.FolderStore()
	ctx := context.Background()

	for _, name := range []string{"A", "B", "C"} {
		_, err := fs.Create(ctx, store.Folder{Name: name})
		require.NoError(t, err)
	}

	count, err := fs.Count(ctx)
	require.NoError(t, err)
	assert.Equal(t, 3, count)
}

// ---------------------------------------------------------------------------
// PlaylistStore
// ---------------------------------------------------------------------------

func TestPlaylistStore_CreateAndGetByID(t *testing.T) {
	db := testutil.OpenTestDB(t)
	ps := db.PlaylistStore()
	ctx := context.Background()

	pl := testutil.SamplePlaylist(0, "My Playlist")
	created, err := ps.Create(ctx, pl)
	require.NoError(t, err)
	assert.Greater(t, created.ID, 0)
	assert.Equal(t, "My Playlist", created.Name)

	got, err := ps.GetByID(ctx, created.ID)
	require.NoError(t, err)
	assert.Equal(t, created.ID, got.ID)
	assert.Equal(t, "My Playlist", got.Name)
}

func TestPlaylistStore_GetAll(t *testing.T) {
	db := testutil.OpenTestDB(t)
	ps := db.PlaylistStore()
	ctx := context.Background()

	for _, name := range []string{"Alpha", "Beta", "Gamma"} {
		_, err := ps.Create(ctx, testutil.SamplePlaylist(0, name))
		require.NoError(t, err)
	}

	all, err := ps.GetAll(ctx)
	require.NoError(t, err)
	assert.Len(t, all, 3)
}

func TestPlaylistStore_Update(t *testing.T) {
	db := testutil.OpenTestDB(t)
	ps := db.PlaylistStore()
	ctx := context.Background()

	created, err := ps.Create(ctx, testutil.SamplePlaylist(0, "Original"))
	require.NoError(t, err)

	updated, err := ps.Update(ctx, created.ID, map[string]any{"name": "Updated"})
	require.NoError(t, err)
	assert.Equal(t, "Updated", updated.Name)
}

func TestPlaylistStore_Delete(t *testing.T) {
	db := testutil.OpenTestDB(t)
	ps := db.PlaylistStore()
	ctx := context.Background()

	created, err := ps.Create(ctx, testutil.SamplePlaylist(0, "Ephemeral"))
	require.NoError(t, err)

	err = ps.Delete(ctx, created.ID)
	require.NoError(t, err)

	_, err = ps.GetByID(ctx, created.ID)
	require.Error(t, err)
}

func TestPlaylistStore_Count(t *testing.T) {
	db := testutil.OpenTestDB(t)
	ps := db.PlaylistStore()
	ctx := context.Background()

	for _, name := range []string{"One", "Two"} {
		_, err := ps.Create(ctx, testutil.SamplePlaylist(0, name))
		require.NoError(t, err)
	}

	count, err := ps.Count(ctx)
	require.NoError(t, err)
	assert.Equal(t, 2, count)
}

// ---------------------------------------------------------------------------
// HistoryStore
// ---------------------------------------------------------------------------

func newHistoryEntry(imageID int, monitors []string) store.ImageHistoryEntry {
	return store.ImageHistoryEntry{
		ImageID:   imageID,
		ImageName: "wallpaper.jpg",
		Monitors:  monitors,
		Mode:      "individual",
		SetAt:     time.Now(),
		Source:    store.HistorySource{Type: "manual"},
		Backend:   "swww",
	}
}

func TestHistoryStore_AppendAndGetRecent(t *testing.T) {
	db := testutil.OpenTestDB(t)
	hs := db.HistoryStore()
	ctx := context.Background()

	for i := 1; i <= 3; i++ {
		_, err := hs.Append(ctx, newHistoryEntry(i, []string{"HDMI-A-1"}))
		require.NoError(t, err)
	}

	entries, err := hs.GetRecent(ctx, store.HistoryQueryOpts{Limit: 50})
	require.NoError(t, err)
	require.Len(t, entries, 3)

	// Newest first (highest ID first)
	assert.Greater(t, entries[0].ID, entries[1].ID)
	assert.Greater(t, entries[1].ID, entries[2].ID)
}

func TestHistoryStore_GetRecent_Limit(t *testing.T) {
	db := testutil.OpenTestDB(t)
	hs := db.HistoryStore()
	ctx := context.Background()

	for i := 1; i <= 5; i++ {
		_, err := hs.Append(ctx, newHistoryEntry(i, []string{"HDMI-A-1"}))
		require.NoError(t, err)
	}

	entries, err := hs.GetRecent(ctx, store.HistoryQueryOpts{Limit: 2})
	require.NoError(t, err)
	assert.Len(t, entries, 2)
}

func TestHistoryStore_GetRecent_MonitorFilter(t *testing.T) {
	db := testutil.OpenTestDB(t)
	hs := db.HistoryStore()
	ctx := context.Background()

	_, err := hs.Append(ctx, newHistoryEntry(1, []string{"HDMI-A-1"}))
	require.NoError(t, err)
	_, err = hs.Append(ctx, newHistoryEntry(2, []string{"DP-1"}))
	require.NoError(t, err)
	_, err = hs.Append(ctx, newHistoryEntry(3, []string{"HDMI-A-1"}))
	require.NoError(t, err)

	entries, err := hs.GetRecent(ctx, store.HistoryQueryOpts{Limit: 50, Monitor: "DP-1"})
	require.NoError(t, err)
	require.Len(t, entries, 1)
	assert.Equal(t, 2, entries[0].ImageID)
}

func TestHistoryStore_Clear(t *testing.T) {
	db := testutil.OpenTestDB(t)
	hs := db.HistoryStore()
	ctx := context.Background()

	for i := 1; i <= 3; i++ {
		_, err := hs.Append(ctx, newHistoryEntry(i, []string{"HDMI-A-1"}))
		require.NoError(t, err)
	}

	err := hs.Clear(ctx)
	require.NoError(t, err)

	count, err := hs.Count(ctx)
	require.NoError(t, err)
	assert.Equal(t, 0, count)
}

func TestHistoryStore_Count(t *testing.T) {
	db := testutil.OpenTestDB(t)
	hs := db.HistoryStore()
	ctx := context.Background()

	for i := 1; i <= 3; i++ {
		_, err := hs.Append(ctx, newHistoryEntry(i, []string{"HDMI-A-1"}))
		require.NoError(t, err)
	}

	count, err := hs.Count(ctx)
	require.NoError(t, err)
	assert.Equal(t, 3, count)
}

// ---------------------------------------------------------------------------
// MonitorStateStore
// ---------------------------------------------------------------------------

func newMonitorState(name string, imageID int) store.MonitorState {
	return store.MonitorState{
		MonitorName: name,
		ImageID:     imageID,
		ImageName:   "wallpaper.jpg",
		ImagePath:   "/tmp/wallpaper.jpg",
		Mode:        "individual",
		Backend:     "swww",
		SetAt:       time.Now(),
	}
}

func TestMonitorStateStore_SetAndGet(t *testing.T) {
	db := testutil.OpenTestDB(t)
	ms := db.MonitorStateStore()
	ctx := context.Background()

	state := newMonitorState("HDMI-A-1", 42)
	err := ms.Set(ctx, state)
	require.NoError(t, err)

	got, err := ms.Get(ctx, "HDMI-A-1")
	require.NoError(t, err)
	require.NotNil(t, got)
	assert.Equal(t, "HDMI-A-1", got.MonitorName)
	assert.Equal(t, 42, got.ImageID)
}

func TestMonitorStateStore_Upsert(t *testing.T) {
	db := testutil.OpenTestDB(t)
	ms := db.MonitorStateStore()
	ctx := context.Background()

	err := ms.Set(ctx, newMonitorState("HDMI-A-1", 1))
	require.NoError(t, err)

	err = ms.Set(ctx, newMonitorState("HDMI-A-1", 99))
	require.NoError(t, err)

	got, err := ms.Get(ctx, "HDMI-A-1")
	require.NoError(t, err)
	require.NotNil(t, got)
	assert.Equal(t, 99, got.ImageID)
}

func TestMonitorStateStore_GetAll(t *testing.T) {
	db := testutil.OpenTestDB(t)
	ms := db.MonitorStateStore()
	ctx := context.Background()

	for i, name := range []string{"HDMI-A-1", "DP-1", "DP-2"} {
		err := ms.Set(ctx, newMonitorState(name, i+1))
		require.NoError(t, err)
	}

	all, err := ms.GetAll(ctx)
	require.NoError(t, err)
	assert.Len(t, all, 3)
}

func TestMonitorStateStore_Remove(t *testing.T) {
	db := testutil.OpenTestDB(t)
	ms := db.MonitorStateStore()
	ctx := context.Background()

	err := ms.Set(ctx, newMonitorState("HDMI-A-1", 1))
	require.NoError(t, err)

	err = ms.Remove(ctx, "HDMI-A-1")
	require.NoError(t, err)

	got, err := ms.Get(ctx, "HDMI-A-1")
	require.NoError(t, err)
	assert.Nil(t, got)
}

func TestMonitorStateStore_GetUnknown(t *testing.T) {
	db := testutil.OpenTestDB(t)
	ms := db.MonitorStateStore()

	got, err := ms.Get(context.Background(), "nonexistent")
	require.NoError(t, err)
	assert.Nil(t, got)
}

// ---------------------------------------------------------------------------
// StateStore (in-memory)
// ---------------------------------------------------------------------------

func TestStateStore_ActivePlaylist(t *testing.T) {
	db := testutil.OpenTestDB(t)
	ss := db.StateStore()

	instance := store.ActivePlaylistInstance{
		ActivePlaylistState: store.ActivePlaylistState{
			PlaylistID:   1,
			PlaylistName: "Evening",
			TotalImages:  5,
			StartedAt:    time.Now(),
		},
		Mode:     "individual",
		Monitors: []string{"HDMI-A-1"},
	}
	ss.SetActivePlaylist(instance)

	got := ss.GetActivePlaylistByID(1)
	require.NotNil(t, got)
	assert.Equal(t, 1, got.PlaylistID)
	assert.Equal(t, "Evening", got.PlaylistName)
	assert.Equal(t, []string{"HDMI-A-1"}, got.Monitors)

	gotByMon := ss.GetActivePlaylistForMonitor("HDMI-A-1")
	require.NotNil(t, gotByMon)
	assert.Equal(t, 1, gotByMon.PlaylistID)

	assert.Nil(t, ss.GetActivePlaylistForMonitor("DP-1"))
}

func TestStateStore_GetActivePlaylists(t *testing.T) {
	db := testutil.OpenTestDB(t)
	ss := db.StateStore()

	ss.SetActivePlaylist(store.ActivePlaylistInstance{
		ActivePlaylistState: store.ActivePlaylistState{
			PlaylistID:   1,
			PlaylistName: "Playlist HDMI",
			StartedAt:    time.Now(),
		},
		Mode:     "individual",
		Monitors: []string{"HDMI-A-1"},
	})
	ss.SetActivePlaylist(store.ActivePlaylistInstance{
		ActivePlaylistState: store.ActivePlaylistState{
			PlaylistID:   2,
			PlaylistName: "Playlist DP",
			StartedAt:    time.Now(),
		},
		Mode:     "individual",
		Monitors: []string{"DP-1"},
	})

	all := ss.GetActivePlaylists()
	assert.Len(t, all, 2)
	assert.Contains(t, all, 1)
	assert.Contains(t, all, 2)
}

func TestStateStore_RemoveActivePlaylist(t *testing.T) {
	db := testutil.OpenTestDB(t)
	ss := db.StateStore()

	ss.SetActivePlaylist(store.ActivePlaylistInstance{
		ActivePlaylistState: store.ActivePlaylistState{
			PlaylistID: 1,
			StartedAt:  time.Now(),
		},
		Mode:     "individual",
		Monitors: []string{"HDMI-A-1"},
	})

	ss.RemoveActivePlaylist(1)

	got := ss.GetActivePlaylistByID(1)
	assert.Nil(t, got)
	assert.Nil(t, ss.GetActivePlaylistForMonitor("HDMI-A-1"))
}

func TestStateStore_RemoveAllActivePlaylists(t *testing.T) {
	db := testutil.OpenTestDB(t)
	ss := db.StateStore()

	ss.SetActivePlaylist(store.ActivePlaylistInstance{
		ActivePlaylistState: store.ActivePlaylistState{
			PlaylistID: 1,
			StartedAt:  time.Now(),
		},
		Mode:     "individual",
		Monitors: []string{"HDMI-A-1", "DP-1", "DP-2"},
	})

	ss.RemoveAllActivePlaylists()

	all := ss.GetActivePlaylists()
	assert.Empty(t, all)
}

func TestStateStore_UpdateActivePlaylist(t *testing.T) {
	db := testutil.OpenTestDB(t)
	ss := db.StateStore()

	ss.SetActivePlaylist(store.ActivePlaylistInstance{
		ActivePlaylistState: store.ActivePlaylistState{
			PlaylistID:   1,
			PlaylistName: "Test",
			StartedAt:    time.Now(),
		},
		Mode:     "individual",
		Monitors: []string{"HDMI-A-1"},
	})

	ok := ss.UpdateActivePlaylist(1, func(inst *store.ActivePlaylistInstance) {
		inst.Paused = true
		inst.NextChangeAt = nil
	})
	assert.True(t, ok)

	got := ss.GetActivePlaylistByID(1)
	require.NotNil(t, got)
	assert.True(t, got.Paused)

	ok = ss.UpdateActivePlaylist(999, func(inst *store.ActivePlaylistInstance) {
		inst.Paused = true
	})
	assert.False(t, ok)
}

func TestStateStore_CurrentWallpaper(t *testing.T) {
	db := testutil.OpenTestDB(t)
	ss := db.StateStore()

	entry := store.ImageHistoryEntry{
		ID:        1,
		ImageID:   42,
		ImageName: "sunset.jpg",
		Monitors:  []string{"HDMI-A-1"},
		Mode:      "individual",
		SetAt:     time.Now(),
		Source:    store.HistorySource{Type: "manual"},
		Backend:   "swww",
	}
	ss.SetCurrentWallpaper("HDMI-A-1", entry)

	got := ss.GetCurrentWallpaper("HDMI-A-1")
	require.NotNil(t, got)
	assert.Equal(t, 42, got.ImageID)
	assert.Equal(t, "sunset.jpg", got.ImageName)
}

func TestStateStore_CurrentWallpaper_Unknown(t *testing.T) {
	db := testutil.OpenTestDB(t)
	ss := db.StateStore()

	got := ss.GetCurrentWallpaper("nonexistent")
	assert.Nil(t, got)
}
