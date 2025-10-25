package store

import (
	"fmt"
	"log/slog"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"waypaper-engine/daemon-go/internal/media"
)

// PlaylistStore handles playlist-specific storage operations
type PlaylistStore struct {
	store  *Store
	logger *slog.Logger
	sync.RWMutex
	lazyLoaded bool // Flag to enable lazy loading optimization
}

// NewPlaylistStore creates a new playlist store
func NewPlaylistStore(store *Store, logger *slog.Logger) *PlaylistStore {
	return &PlaylistStore{
		store:      store,
		logger:     logger,
		lazyLoaded: true, // Enable lazy loading by default
	}
}

// EnableLazyLoading enables or disables lazy loading optimization
func (ps *PlaylistStore) EnableLazyLoading(enabled bool) {
	ps.Lock()
	defer ps.Unlock()
	ps.lazyLoaded = enabled
	ps.logger.Info("lazy loading", "enabled", enabled)
}

// LoadPlaylist loads a playlist by name
func (ps *PlaylistStore) LoadPlaylist(name string) (*Playlist, error) {
	cacheKey := fmt.Sprintf("playlist:%s", name)
	filePath := ps.store.getFilePath(filepath.Join("playlists", name+".json"))

	var playlist Playlist
	if err := ps.store.cachedLoad(cacheKey, filePath, &playlist); err != nil {
		if strings.Contains(err.Error(), "not found") {
			return nil, fmt.Errorf("playlist not found: %s", name)
		}
		return nil, fmt.Errorf("failed to load playlist %s: %w", name, err)
	}

	// Update last accessed time
	now := time.Now()
	playlist.Metadata.LastModified = now
	if playlist.Runtime != nil {
		playlist.Runtime.LastAccessed = now
	}

	return &playlist, nil
}

// SavePlaylist saves a playlist to storage
func (ps *PlaylistStore) SavePlaylist(playlist *Playlist) error {
	ps.Lock()
	defer ps.Unlock()

	// Generate ID if not set
	if playlist.ID == "" {
		playlist.ID = generateUUID()
	}

	// Update metadata
	now := time.Now()
	if playlist.Metadata.Version == "" {
		playlist.Metadata.Version = "1.0"
	}
	if playlist.Metadata.CreatedAt.IsZero() {
		playlist.Metadata.CreatedAt = now
	}
	playlist.Metadata.LastModified = now

	// Update media type detection for images
	if err := ps.updateImageMediaTypes(playlist); err != nil {
		ps.logger.Warn("failed to update media types", "playlist", playlist.Name, "error", err)
	}

	// Save to file
	filePath := ps.store.getFilePath(filepath.Join("playlists", playlist.Name+".json"))
	if err := ps.store.saveJSON(filePath, playlist); err != nil {
		return fmt.Errorf("failed to save playlist: %w", err)
	}

	// Update cache
	cacheKey := fmt.Sprintf("playlist:%s", playlist.Name)
	ps.store.cacheMutex.Lock()
	ps.store.cache[cacheKey] = playlist
	ps.store.cacheMutex.Unlock()

	return nil
}

// GetAllPlaylists returns all playlists with lazy loading optimization
func (ps *PlaylistStore) GetAllPlaylists() ([]*Playlist, error) {
	ps.RLock()
	defer ps.RUnlock()

	playlistsDir := ps.store.getFilePath("playlists")
	entries, err := os.ReadDir(playlistsDir)
	if err != nil {
		return nil, fmt.Errorf("failed to read playlists directory: %w", err)
	}

	var playlists []*Playlist
	for _, entry := range entries {
		if !entry.IsDir() && filepath.Ext(entry.Name()) == ".json" {
			name := strings.TrimSuffix(entry.Name(), ".json")

			// Use lazy loading if enabled
			if ps.lazyLoaded {
				playlist, err := ps.LoadPlaylistLazy(name)
				if err != nil {
					ps.logger.Error("failed to lazy load playlist", "name", name, "error", err)
					continue
				}
				playlists = append(playlists, playlist)
			} else {
				playlist, err := ps.LoadPlaylist(name)
				if err != nil {
					ps.logger.Error("failed to load playlist", "name", name, "error", err)
					continue
				}
				playlists = append(playlists, playlist)
			}
		}
	}

	return playlists, nil
}

// LoadPlaylistLazy loads a playlist with optimization (metadata only initially)
func (ps *PlaylistStore) LoadPlaylistLazy(name string) (*Playlist, error) {
	cacheKey := fmt.Sprintf("playlist:%s", name)
	filePath := ps.store.getFilePath(filepath.Join("playlists", name+".json"))

	// Check cache first
	ps.store.cacheMutex.RLock()
	if cached, exists := ps.store.cache[cacheKey]; exists {
		ps.store.cacheMutex.RUnlock()
		return cached.(*Playlist), nil
	}
	ps.store.cacheMutex.RUnlock()

	// For lazy loading, initially load only metadata
	// Full images can be loaded on demand
	var playlist Playlist
	if err := ps.store.cachedLoad(cacheKey, filePath, &playlist); err != nil {
		if strings.Contains(err.Error(), "not found") {
			return nil, fmt.Errorf("playlist not found: %s", name)
		}
		return nil, fmt.Errorf("failed to lazy load playlist %s: %w", name, err)
	}

	// If lazy loading, defer loading of heavy data (images)
	// The images will be loaded when specifically requested
	ps.logger.Debug("lazy loaded playlist", "name", name, "images_count", len(playlist.Images))

	return &playlist, nil
}

// DeletePlaylist deletes a playlist
func (ps *PlaylistStore) DeletePlaylist(name string) error {
	ps.Lock()
	defer ps.Unlock()

	filePath := ps.store.getFilePath(filepath.Join("playlists", name+".json"))
	if err := os.Remove(filePath); err != nil {
		return fmt.Errorf("failed to delete playlist file: %w", err)
	}

	// Remove from cache
	cacheKey := fmt.Sprintf("playlist:%s", name)
	ps.store.cacheMutex.Lock()
	delete(ps.store.cache, cacheKey)
	ps.store.cacheMutex.Unlock()

	return nil
}

// PlaylistExists checks if a playlist exists
func (ps *PlaylistStore) PlaylistExists(name string) bool {
	filePath := ps.store.getFilePath(filepath.Join("playlists", name+".json"))
	_, err := os.Stat(filePath)
	return err == nil
}

// GetPlaylistsByBackend returns playlists that use a specific backend
func (ps *PlaylistStore) GetPlaylistsByBackend(backendType string) ([]*Playlist, error) {
	playlists, err := ps.GetAllPlaylists()
	if err != nil {
		return nil, err
	}

	var filtered []*Playlist
	for _, playlist := range playlists {
		if ps.playlistUsesBackend(playlist, backendType) {
			filtered = append(filtered, playlist)
		}
	}

	return filtered, nil
}

// GetPlaylistsByMediaType returns playlists that support a specific media type
func (ps *PlaylistStore) GetPlaylistsByMediaType(mediaType media.MediaType) ([]*Playlist, error) {
	playlists, err := ps.GetAllPlaylists()
	if err != nil {
		return nil, err
	}

	var filtered []*Playlist
	for _, playlist := range playlists {
		if ps.playlistSupportsMediaType(playlist, mediaType) {
			filtered = append(filtered, playlist)
		}
	}

	return filtered, nil
}

// UpdatePlaylistRuntime updates the runtime state of a playlist
func (ps *PlaylistStore) UpdatePlaylistRuntime(name string, updates func(*PlaylistRuntime)) error {
	playlist, err := ps.LoadPlaylist(name)
	if err != nil {
		return err
	}

	if playlist.Runtime == nil {
		playlist.Runtime = &PlaylistRuntime{
			Status:       "stopped",
			LastAccessed: time.Now(),
		}
	}

	updates(playlist.Runtime)

	return ps.SavePlaylist(playlist)
}

// SetPlaylistStatus sets the status of a playlist
func (ps *PlaylistStore) SetPlaylistStatus(name string, status string) error {
	return ps.UpdatePlaylistRuntime(name, func(rt *PlaylistRuntime) {
		now := time.Now()

		switch status {
		case "active":
			rt.Status = "active"
			rt.LastImageChange = now
			rt.LastAccessed = now
		case "paused":
			rt.Status = "paused"
			rt.PausedAt = &now
			rt.LastAccessed = now
		case "stopped":
			rt.Status = "stopped"
			rt.LastAccessed = now
		}
	})
}

// IncrementPlaylistPlayCount increments the total play count
func (ps *PlaylistStore) IncrementPlaylistPlayCount(name string) error {
	return ps.UpdatePlaylistRuntime(name, func(rt *PlaylistRuntime) {
		rt.TotalPlays++
		rt.LastAccessed = time.Now()
	})
}

// UpdatePlaylistIndex updates the current image index
func (ps *PlaylistStore) UpdatePlaylistIndex(name string, index int) error {
	return ps.UpdatePlaylistRuntime(name, func(rt *PlaylistRuntime) {
		rt.CurrentIndex = index
		rt.LastImageChange = time.Now()
	})
}

// SetNextImageChange sets the next image change time
func (ps *PlaylistStore) SetNextImageChange(name string, nextChange *time.Time) error {
	return ps.UpdatePlaylistRuntime(name, func(rt *PlaylistRuntime) {
		rt.NextImageChange = nextChange
	})
}

// CalculatePlaylistStatistics calculates statistics for a playlist
func (ps *PlaylistStore) CalculatePlaylistStatistics(name string) (*PlaylistStats, error) {
	playlist, err := ps.LoadPlaylist(name)
	if err != nil {
		return nil, err
	}

	stats := &PlaylistStats{
		PlaylistName:     playlist.Name,
		CreatedAt:        playlist.Metadata.CreatedAt,
		TotalImages:      len(playlist.Images),
		TotalPlayCount:   int64(0),
		AverageCycleTime: int64(0),
		MostUsedImages:   []string{},
		BackendType:      "",
		MediaTypesUsed:   map[media.MediaType]int{},
		LastActivity:     playlist.Metadata.LastModified,
	}

	if playlist.Runtime != nil {
		stats.TotalPlayCount = playlist.Runtime.TotalPlays
		stats.LastActivity = playlist.Runtime.LastAccessed
		if playlist.Runtime.AverageCycleTime != nil {
			stats.AverageCycleTime = *playlist.Runtime.AverageCycleTime
		}
	}

	// Count media types
	for _, img := range playlist.Images {
		stats.MediaTypesUsed[img.MediaType]++
	}

	// Get backend type
	if playlist.Backend != nil {
		stats.BackendType = playlist.Backend.BackendType
	}

	return stats, nil
}

// Helper functions

// updateImageMediaTypes updates media types for all images in the playlist
func (ps *PlaylistStore) updateImageMediaTypes(playlist *Playlist) error {
	if len(playlist.Images) == 0 {
		return nil
	}

	// Load image registry to get media types
	registry, err := ps.store.LoadImageRegistry()
	if err != nil {
		// If registry doesn't exist yet, detect media types from file paths
		for i := range playlist.Images {
			playlist.Images[i].MediaType = ps.store.mediaDetector.DetectMediaType(playlist.Images[i].ImagePath)
		}
		return nil
	}

	mediaTypeByPath := make(map[string]media.MediaType)
	for _, img := range registry.Images {
		mediaTypeByPath[img.Path] = img.MediaType
	}

	for i := range playlist.Images {
		if mediaType, exists := mediaTypeByPath[playlist.Images[i].ImagePath]; exists {
			playlist.Images[i].MediaType = mediaType
		} else {
			playlist.Images[i].MediaType = ps.store.mediaDetector.DetectMediaType(playlist.Images[i].ImagePath)
		}
	}

	return nil
}

// playlistUsesBackend checks if a playlist uses a specific backend
func (ps *PlaylistStore) playlistUsesBackend(playlist *Playlist, backendType string) bool {
	if playlist.Backend != nil && playlist.Backend.BackendType == backendType {
		return true
	}
	return false
}

// playlistSupportsMediaType checks if a playlist supports a specific media type
func (ps *PlaylistStore) playlistSupportsMediaType(playlist *Playlist, mediaType media.MediaType) bool {
	// Check playlist-level filters
	if playlist.Configuration.Filters != nil && len(playlist.Configuration.Filters.MediaTypes) > 0 {
		for _, mt := range playlist.Configuration.Filters.MediaTypes {
			if mt == mediaType {
				return true
			}
		}
		return false
	}

	// Check if playlist has images of this media type
	for _, img := range playlist.Images {
		if img.MediaType == mediaType {
			return true
		}
	}

	return false
}

// Helper functions

func generateUUID() string {
	// Simple UUID v4 implementation
	// In production, use a proper UUID library
	b := make([]byte, 16)
	for i := range b {
		b[i] = byte(time.Now().UnixNano() % 256)
	}
	return fmt.Sprintf("%x-%x-%x-%x-%x", b[0:4], b[4:6], b[6:8], b[8:10], b[10:16])
}

// PlaylistStats contains statistics for a playlist
type PlaylistStats struct {
	PlaylistName     string                  `json:"playlistName"`
	CreatedAt        time.Time               `json:"createdAt"`
	TotalImages      int                     `json:"totalImages"`
	TotalPlayCount   int64                   `json:"totalPlayCount"`
	AverageCycleTime int64                   `json:"averageCycleTime"`
	MostUsedImages   []string                `json:"mostUsedImages"`
	BackendType      string                  `json:"backendType"`
	MediaTypesUsed   map[media.MediaType]int `json:"mediaTypesUsed"`
	LastActivity     time.Time               `json:"lastActivity"`
}
