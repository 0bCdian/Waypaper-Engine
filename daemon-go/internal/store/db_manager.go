package store

import (
	"context"
	"fmt"
	"log/slog"
	"time"
)

// JSONDBManager interface for managing JSON database operations
type JSONDBManager interface {
	// Image gallery - bulk operations
	SaveImageGallery(images []Image) error
	LoadImageGallery() ([]Image, error)
	RemoveImagesFromGallery(imageIDs []string) error

	// Playlists - bulk operations
	SavePlaylists(playlists []Playlist) error
	LoadPlaylists() ([]Playlist, error)
	DeletePlaylists(playlistIDs []string) error

	// Active playlist state
	SaveActivePlaylistState(state *ManagerActivePlaylistState) error
	LoadActivePlaylistState() (*ManagerActivePlaylistState, error)

	// Current image set state (recovery point)
	SaveImageSetState(state *ImageSetState) error
	LoadImageSetState() (*ImageSetState, error)

	// Image history
	LoadImageHistory(limit int) ([]ImageHistoryEntry, error)
	AddImageHistoryEntry(entry ImageHistoryEntry) error

	// Individual operations for compatibility
	GetImageByID(ctx context.Context, id int64) (*Image, error)
	DeleteImage(ctx context.Context, id int64) error
	GetPlaylistByID(ctx context.Context, id int64) (*Playlist, error)
	SavePlaylist(ctx context.Context, playlist Playlist) error
	DeletePlaylist(ctx context.Context, id int64) error

	// Validation
	Validate() error
}

// ImageSetState represents the current image set state for recovery
type ImageSetState struct {
	ImageID   string             `json:"imageId"`
	ImagePath string             `json:"imagePath"`
	SetType   string             `json:"setType"`  // "extend" | "clone" | "individual"
	Monitors  map[string]Monitor `json:"monitors"` // if individual, this must be length 1
	LastSet   time.Time          `json:"lastSet"`
}

// ImageHistoryEntry represents an entry in the image history
type ImageHistoryEntry struct {
	ID           string    `json:"id"`
	ImageID      string    `json:"imageId"`
	ImagePath    string    `json:"imagePath"`
	MediaType    string    `json:"mediaType,omitempty"`
	MonitorName  string    `json:"monitorName,omitempty"`
	SetAt        time.Time `json:"setAt"`
	Duration     int       `json:"duration,omitempty"`
	PlaylistName *string   `json:"playlistName,omitempty"`
	BackendUsed  *string   `json:"backendUsed,omitempty"`
	Success      *bool     `json:"success,omitempty"`
	Monitors     []string  `json:"monitors"` // ["DP-1", "HDMI-1"]
	Mode         string    `json:"mode"`     // "individual", "extend", "clone"
}

// ManagerActivePlaylistState represents the current state of active playlists for the manager
type ManagerActivePlaylistState struct {
	ActivePlaylists map[string]*PlaylistInstance `json:"activePlaylists"`
	LastUpdated     time.Time                    `json:"lastUpdated"`
}

// PlaylistInstance represents an active playlist instance
type PlaylistInstance struct {
	PlaylistID       string     `json:"playlistId"`
	PlaylistName     string     `json:"playlistName"`
	StartedAt        time.Time  `json:"startedAt"`
	Status           string     `json:"status"`
	CurrentImageID   string     `json:"currentImageId"`
	CurrentImagePath string     `json:"currentImagePath"`
	ImageIndex       int        `json:"imageIndex"`
	NextChange       *time.Time `json:"nextChange,omitempty"`
	PausedAt         *time.Time `json:"pausedAt,omitempty"`
}

// Monitor represents a monitor configuration
type Monitor struct {
	Name     string `json:"name"`
	Width    int    `json:"width"`
	Height   int    `json:"height"`
	Position struct {
		X int `json:"x"`
		Y int `json:"y"`
	} `json:"position"`
}

// jsonDBManager implements the JSONDBManager interface
type jsonDBManager struct {
	store         *Store
	playlistStore *PlaylistStore
	stateManager  *StateManager
	logger        *slog.Logger
}

// NewJSONDBManager creates a new JSON DB manager
func NewJSONDBManager(store *Store, logger *slog.Logger) JSONDBManager {
	return &jsonDBManager{
		store:         store,
		playlistStore: store.playlistStore,
		stateManager:  store.stateManager,
		logger:        logger,
	}
}

// SaveImageGallery saves the entire image gallery
func (jdm *jsonDBManager) SaveImageGallery(images []Image) error {
	registry := &ImageRegistry{
		Images: images,
		Metadata: ImageRegistryMetadata{
			Version:     "1.0",
			LastUpdated: time.Now(),
			TotalImages: len(images),
		},
		// Indices will be rebuilt by SaveImageRegistry
	}

	// Rebuild indices before saving
	jdm.store.imageStore.rebuildIndices(registry)

	return jdm.store.imageStore.SaveImageRegistry(registry)
}

// LoadImageGallery loads the entire image gallery
func (jdm *jsonDBManager) LoadImageGallery() ([]Image, error) {
	registry, err := jdm.store.LoadImageRegistry()
	if err != nil {
		return nil, err
	}

	return registry.Images, nil
}

// RemoveImagesFromGallery removes multiple images from the gallery
func (jdm *jsonDBManager) RemoveImagesFromGallery(imageIDs []string) error {
	registry, err := jdm.store.LoadImageRegistry()
	if err != nil {
		return err
	}

	// Create a map for faster lookup
	removeMap := make(map[string]bool)
	for _, id := range imageIDs {
		removeMap[id] = true
	}

	// Filter out images to be removed
	var filteredImages []Image
	for _, image := range registry.Images {
		if !removeMap[fmt.Sprintf("%d", image.ID)] {
			filteredImages = append(filteredImages, image)
		}
	}

	// Save the updated registry
	return jdm.SaveImageGallery(filteredImages)
}

// SavePlaylists saves all playlists
func (jdm *jsonDBManager) SavePlaylists(playlists []Playlist) error {
	jdm.logger.Debug("saving playlists", "count", len(playlists))
	for i := range playlists {
		if err := jdm.playlistStore.SavePlaylist(&playlists[i]); err != nil {
			return fmt.Errorf("failed to save playlist %s: %w", playlists[i].Name, err)
		}
	}
	return nil
}

// LoadPlaylists loads all playlists
func (jdm *jsonDBManager) LoadPlaylists() ([]Playlist, error) {
	jdm.logger.Debug("loading playlists")
	playlistPtrs, err := jdm.playlistStore.GetAllPlaylists()
	if err != nil {
		return nil, fmt.Errorf("failed to load playlists: %w", err)
	}

	// Convert []*Playlist to []Playlist
	playlists := make([]Playlist, len(playlistPtrs))
	for i, ptr := range playlistPtrs {
		playlists[i] = *ptr
	}

	return playlists, nil
}

// DeletePlaylists deletes multiple playlists
func (jdm *jsonDBManager) DeletePlaylists(playlistIDs []string) error {
	playlists, err := jdm.LoadPlaylists()
	if err != nil {
		return err
	}

	// Create a map for faster lookup
	deleteMap := make(map[string]bool)
	for _, id := range playlistIDs {
		deleteMap[id] = true
	}

	// Filter out playlists to be deleted
	var filteredPlaylists []Playlist
	for _, playlist := range playlists {
		if !deleteMap[playlist.ID] {
			filteredPlaylists = append(filteredPlaylists, playlist)
		}
	}

	// Save the updated playlists
	return jdm.SavePlaylists(filteredPlaylists)
}

// SaveActivePlaylistState saves the active playlist state
func (jdm *jsonDBManager) SaveActivePlaylistState(state *ManagerActivePlaylistState) error {
	jdm.logger.Debug("saving active playlist state", "playlistCount", len(state.ActivePlaylists))
	return jdm.stateManager.SaveActivePlaylistState(state)
}

// LoadActivePlaylistState loads the active playlist state
func (jdm *jsonDBManager) LoadActivePlaylistState() (*ManagerActivePlaylistState, error) {
	jdm.logger.Debug("loading active playlist state")
	return jdm.stateManager.LoadActivePlaylistState()
}

// SaveImageSetState saves the current image set state
func (jdm *jsonDBManager) SaveImageSetState(state *ImageSetState) error {
	jdm.logger.Debug("saving image set state", "imageID", state.ImageID, "setType", state.SetType)
	return jdm.stateManager.SaveImageSetState(state)
}

// LoadImageSetState loads the current image set state
func (jdm *jsonDBManager) LoadImageSetState() (*ImageSetState, error) {
	jdm.logger.Debug("loading image set state")
	return jdm.stateManager.LoadImageSetState()
}

// LoadImageHistory loads image history with a limit
func (jdm *jsonDBManager) LoadImageHistory(limit int) ([]ImageHistoryEntry, error) {
	jdm.logger.Debug("loading image history", "limit", limit)
	history, err := jdm.stateManager.LoadImageHistory()
	if err != nil {
		return nil, fmt.Errorf("failed to load image history: %w", err)
	}

	// Apply limit if specified
	if limit > 0 && len(history) > limit {
		history = history[:limit]
	}

	return history, nil
}

// AddImageHistoryEntry adds an entry to the image history
func (jdm *jsonDBManager) AddImageHistoryEntry(entry ImageHistoryEntry) error {
	jdm.logger.Debug("adding image history entry", "imageID", entry.ImageID, "monitors", entry.Monitors)
	// Use a reasonable default limit if not configured
	// The limit should ideally come from config, but for now we use a default
	maxEntries := 100
	return jdm.stateManager.AddImageHistoryEntry(entry, maxEntries)
}

// Validate validates the JSON database integrity
func (jdm *jsonDBManager) Validate() error {
	jdm.logger.Debug("validating JSON database")
	issues := jdm.store.ValidateHealth()

	// Check for errors
	for _, issue := range issues {
		if issue.Severity == "error" {
			return fmt.Errorf("validation error in %s: %s", issue.Component, issue.Message)
		}
	}

	return nil
}

// Individual operations for compatibility

// GetImageByID retrieves a single image by ID
func (jdm *jsonDBManager) GetImageByID(ctx context.Context, id int64) (*Image, error) {
	images, err := jdm.LoadImageGallery()
	if err != nil {
		return nil, err
	}

	for _, img := range images {
		if fmt.Sprintf("%d", img.ID) == fmt.Sprintf("%d", id) {
			return &img, nil
		}
	}

	return nil, fmt.Errorf("image with ID %d not found", id)
}

// DeleteImage deletes a single image by ID
func (jdm *jsonDBManager) DeleteImage(ctx context.Context, id int64) error {
	images, err := jdm.LoadImageGallery()
	if err != nil {
		return err
	}

	var updatedImages []Image
	for _, img := range images {
		if fmt.Sprintf("%d", img.ID) != fmt.Sprintf("%d", id) {
			updatedImages = append(updatedImages, img)
		}
	}

	return jdm.SaveImageGallery(updatedImages)
}

// GetPlaylistByID retrieves a single playlist by ID
func (jdm *jsonDBManager) GetPlaylistByID(ctx context.Context, id int64) (*Playlist, error) {
	playlists, err := jdm.LoadPlaylists()
	if err != nil {
		return nil, err
	}

	idStr := fmt.Sprintf("%d", id)
	for _, playlist := range playlists {
		if playlist.ID == idStr {
			return &playlist, nil
		}
	}

	return nil, fmt.Errorf("playlist with ID %d not found", id)
}

// SavePlaylist saves a single playlist
func (jdm *jsonDBManager) SavePlaylist(ctx context.Context, playlist Playlist) error {
	playlists, err := jdm.LoadPlaylists()
	if err != nil {
		return err
	}

	// Update or add the playlist
	found := false
	for i, p := range playlists {
		if p.ID == playlist.ID {
			playlists[i] = playlist
			found = true
			break
		}
	}

	if !found {
		playlists = append(playlists, playlist)
	}

	return jdm.SavePlaylists(playlists)
}

// DeletePlaylist deletes a single playlist by ID
func (jdm *jsonDBManager) DeletePlaylist(ctx context.Context, id int64) error {
	playlists, err := jdm.LoadPlaylists()
	if err != nil {
		return err
	}

	idStr := fmt.Sprintf("%d", id)
	var updatedPlaylists []Playlist
	for _, playlist := range playlists {
		if playlist.ID != idStr {
			updatedPlaylists = append(updatedPlaylists, playlist)
		}
	}

	return jdm.SavePlaylists(updatedPlaylists)
}
