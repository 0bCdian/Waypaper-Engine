package playlist

import (
	"testing"
	"waypaper-engine/daemon-go/internal/models"

	"github.com/stretchr/testify/assert"
)

func TestPlaylist_NextImage(t *testing.T) {
	images := []models.Image{
		{ID: 1, Name: "img1.jpg"},
		{ID: 2, Name: "img2.jpg"},
		{ID: 3, Name: "img3.jpg"},
	}

	playlist := &Playlist{
		images:            images,
		currentImageIndex: 0,
	}

	// First next
	nextImage, err := playlist.NextImage()
	assert.NoError(t, err)
	assert.Equal(t, "img2.jpg", nextImage.Name)
	assert.Equal(t, 1, playlist.currentImageIndex)

	// Second next
	nextImage, err = playlist.NextImage()
	assert.NoError(t, err)
	assert.Equal(t, "img3.jpg", nextImage.Name)
	assert.Equal(t, 2, playlist.currentImageIndex)

	// Wrap around
	nextImage, err = playlist.NextImage()
	assert.NoError(t, err)
	assert.Equal(t, "img1.jpg", nextImage.Name)
	assert.Equal(t, 0, playlist.currentImageIndex)
}

func TestPlaylist_PreviousImage(t *testing.T) {
	images := []models.Image{
		{ID: 1, Name: "img1.jpg"},
		{ID: 2, Name: "img2.jpg"},
		{ID: 3, Name: "img3.jpg"},
	}

	playlist := &Playlist{
		images:            images,
		currentImageIndex: 0,
	}

	// First previous (wraps around)
	prevImage, err := playlist.PreviousImage()
	assert.NoError(t, err)
	assert.Equal(t, "img3.jpg", prevImage.Name)
	assert.Equal(t, 2, playlist.currentImageIndex)

	// Second previous
	prevImage, err = playlist.PreviousImage()
	assert.NoError(t, err)
	assert.Equal(t, "img2.jpg", prevImage.Name)
	assert.Equal(t, 1, playlist.currentImageIndex)
}

func TestPlaylist_EmptyImages(t *testing.T) {
	playlist := &Playlist{
		images:            []models.Image{},
		currentImageIndex: 0,
	}

	// Next image on empty playlist should return error
	_, err := playlist.NextImage()
	assert.Error(t, err)

	// Previous image on empty playlist should return error
	_, err = playlist.PreviousImage()
	assert.Error(t, err)
}

func TestPlaylist_SingleImage(t *testing.T) {
	images := []models.Image{
		{ID: 1, Name: "single.jpg"},
	}

	playlist := &Playlist{
		images:            images,
		currentImageIndex: 0,
	}

	// Next image should wrap around to same image
	nextImage, err := playlist.NextImage()
	assert.NoError(t, err)
	assert.Equal(t, "single.jpg", nextImage.Name)
	assert.Equal(t, 0, playlist.currentImageIndex)

	// Previous image should wrap around to same image
	prevImage, err := playlist.PreviousImage()
	assert.NoError(t, err)
	assert.Equal(t, "single.jpg", prevImage.Name)
	assert.Equal(t, 0, playlist.currentImageIndex)
}

func TestNewPlaylist(t *testing.T) {
	playlistData := models.Playlist{
		ID:                      1,
		Name:                    "Test Playlist",
		Type:                    models.PlaylistTypeTimer,
		Interval:                intPtr(5),
		ShowAnimations:          true,
		AlwaysStartOnFirstImage: false,
		Order:                   models.PlaylistOrderOrdered,
		CurrentImageIndex:       2,
		Images: []models.Image{
			{ID: 1, Name: "img1.jpg"},
			{ID: 2, Name: "img2.jpg"},
			{ID: 3, Name: "img3.jpg"},
		},
	}

	activeMonitor := models.ActiveMonitor{
		Name: "Monitor-1",
		Monitors: []models.Monitor{
			{Name: "Monitor-1", Width: 1920, Height: 1080},
		},
		ExtendAcrossMonitors: false,
	}

	playlist := NewPlaylist(playlistData, activeMonitor)

	assert.Equal(t, "Test Playlist", playlist.name)
	assert.Equal(t, models.PlaylistTypeTimer, playlist.currentType)
	assert.Equal(t, 2, playlist.currentImageIndex)
	assert.Equal(t, 3, len(playlist.images))
	assert.Equal(t, "Monitor-1", playlist.activeMonitor.Name)
	assert.True(t, playlist.showAnimations)
}

func TestPlaylist_CurrentImage(t *testing.T) {
	images := []models.Image{
		{ID: 1, Name: "img1.jpg"},
		{ID: 2, Name: "img2.jpg"},
		{ID: 3, Name: "img3.jpg"},
	}

	playlist := &Playlist{
		images:            images,
		currentImageIndex: 1,
	}

	// Get current image
	currentImage := playlist.GetCurrentImage()
	assert.Equal(t, "img2.jpg", currentImage.Name)
	assert.Equal(t, int64(2), currentImage.ID)
}

func TestPlaylist_SetCurrentImage(t *testing.T) {
	images := []models.Image{
		{ID: 1, Name: "img1.jpg"},
		{ID: 2, Name: "img2.jpg"},
		{ID: 3, Name: "img3.jpg"},
	}

	playlist := &Playlist{
		images:            images,
		currentImageIndex: 0,
	}

	// Set to valid index
	err := playlist.SetCurrentImage(2)
	assert.NoError(t, err)
	assert.Equal(t, 2, playlist.currentImageIndex)

	// Set to invalid index (negative)
	err = playlist.SetCurrentImage(-1)
	assert.Error(t, err)
	assert.Equal(t, 2, playlist.currentImageIndex) // Should remain unchanged

	// Set to invalid index (too high)
	err = playlist.SetCurrentImage(5)
	assert.Error(t, err)
	assert.Equal(t, 2, playlist.currentImageIndex) // Should remain unchanged
}

// Helper function to create int pointer
func intPtr(i int) *int {
	return &i
}
