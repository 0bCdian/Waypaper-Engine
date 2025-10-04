package playlist

import (
	"errors"
	"waypaper-engine/daemon-go/internal/models"
)

type Playlist struct {
	images            []models.Image
	name              string
	activeMonitor     models.ActiveMonitor
	currentType       models.PlaylistType
	currentImageIndex int
	interval          *int
	showAnimations    bool
}

func NewPlaylist(playlist models.Playlist, activeMonitor models.ActiveMonitor) *Playlist {
	return &Playlist{
		images:            playlist.Images,
		name:              playlist.Name,
		activeMonitor:     activeMonitor,
		currentType:       playlist.Type,
		currentImageIndex: int(playlist.CurrentImageIndex),
		interval:          playlist.Interval,
		showAnimations:    playlist.ShowAnimations,
	}
}

func (p *Playlist) NextImage() (*models.Image, error) {
	if len(p.images) == 0 {
		return nil, errors.New("no images in playlist")
	}

	p.currentImageIndex++
	if p.currentImageIndex >= len(p.images) {
		p.currentImageIndex = 0
	}
	return &p.images[p.currentImageIndex], nil
}

func (p *Playlist) PreviousImage() (*models.Image, error) {
	if len(p.images) == 0 {
		return nil, errors.New("no images in playlist")
	}

	p.currentImageIndex--
	if p.currentImageIndex < 0 {
		p.currentImageIndex = len(p.images) - 1
	}
	return &p.images[p.currentImageIndex], nil
}

func (p *Playlist) GetCurrentImage() *models.Image {
	if len(p.images) == 0 {
		return nil
	}
	return &p.images[p.currentImageIndex]
}

func (p *Playlist) SetCurrentImage(index int) error {
	if len(p.images) == 0 {
		return errors.New("no images in playlist")
	}

	if index < 0 || index >= len(p.images) {
		return errors.New("invalid image index")
	}

	p.currentImageIndex = index
	return nil
}
