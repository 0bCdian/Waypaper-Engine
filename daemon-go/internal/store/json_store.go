package store

import (
	"context"
	"fmt"
	"log/slog"
	"os"
	"path/filepath"
	"sort"
	"strconv"
	"time"

	"waypaper-engine/daemon-go/internal/media"
	"waypaper-engine/daemon-go/internal/models"
)

// JsonStoreManager provides a comprehensive JSON-based storage manager
// that replaces all database operations with JSON file operations
type JsonStoreManager struct {
	store  *Store
	logger *slog.Logger
}

// NewJsonStoreManager creates a new JSON store manager
func NewJsonStoreManager(store *Store, logger *slog.Logger) *JsonStoreManager {
	return &JsonStoreManager{
		store:  store,
		logger: logger,
	}
}

// Image operations
func (jsm *JsonStoreManager) GetImages(ctx context.Context, filters map[string]interface{}) ([]models.Image, error) {
	registry, err := jsm.store.LoadImageRegistry()
	if err != nil {
		return nil, fmt.Errorf("failed to load image registry: %w", err)
	}

	var images []models.Image
	for _, img := range registry.Images {
		// Convert store.Image to models.Image
		modelImg := models.Image{
			ID:         img.ID,
			Name:       img.Name,
			Path:       img.Path,
			IsChecked:  img.Selection.IsChecked,
			IsSelected: img.Selection.IsSelected,
			Width:      int(img.Dimensions.Width),
			Height:     int(img.Dimensions.Height),
			Format:     img.Metadata.Format,
			Rating:     0, // Not implemented yet
		}
		images = append(images, modelImg)
	}

	// Apply filters if provided
	if filters != nil {
		images = jsm.applyImageFilters(images, filters)
	}

	return images, nil
}

func (jsm *JsonStoreManager) GetImageByID(ctx context.Context, id int64) (*models.Image, error) {
	registry, err := jsm.store.LoadImageRegistry()
	if err != nil {
		return nil, fmt.Errorf("failed to load image registry: %w", err)
	}

	for _, img := range registry.Images {
		if img.ID == id {
			return &models.Image{
				ID:         img.ID,
				Name:       img.Name,
				Path:       img.Path,
				IsChecked:  img.Selection.IsChecked,
				IsSelected: img.Selection.IsSelected,
				Width:      int(img.Dimensions.Width),
				Height:     int(img.Dimensions.Height),
				Format:     img.Metadata.Format,
				Rating:     0,
			}, nil
		}
	}

	return nil, fmt.Errorf("image with ID %d not found", id)
}

func (jsm *JsonStoreManager) AddImage(ctx context.Context, img models.Image) error {
	registry, err := jsm.store.LoadImageRegistry()
	if err != nil {
		return fmt.Errorf("failed to load image registry: %w", err)
	}

	// Convert models.Image to store.Image
	storeImg := Image{
		ID:        img.ID,
		Name:      img.Name,
		Path:      img.Path,
		MediaType: media.MediaTypeImage, // Default to image
		Dimensions: ImageDimensions{
			Width:  int64(img.Width),
			Height: int64(img.Height),
		},
		Metadata: ImageMetadata{
			Format:   img.Format,
			FileSize: 0,  // Will be populated by image processor
			Checksum: "", // Will be populated by image processor
			Tags:     []string{},
		},
		Selection: ImageSelection{
			IsChecked:         img.IsChecked,
			IsSelected:        img.IsSelected,
			SelectedPlaylists: []string{},
		},
		ImportInfo: ImageImportInfo{
			ImportedAt: time.Now(),
			Importer:   "manual",
		},
		Thumbnails: ImageThumbnails{
			Resolution720p:  "",
			Resolution1080p: "",
			Resolution1440p: "",
			Resolution4k:    "",
			Fallback:        "",
		},
	}

	// Add to registry
	registry.Images = append(registry.Images, storeImg)
	registry.Metadata.TotalImages = len(registry.Images)
	registry.Metadata.LastUpdated = time.Now()

	// Save registry
	return jsm.saveImageRegistry(registry)
}

func (jsm *JsonStoreManager) DeleteImage(ctx context.Context, id int64) error {
	registry, err := jsm.store.LoadImageRegistry()
	if err != nil {
		return fmt.Errorf("failed to load image registry: %w", err)
	}

	// Find and remove image
	for i, img := range registry.Images {
		if img.ID == id {
			registry.Images = append(registry.Images[:i], registry.Images[i+1:]...)
			registry.Metadata.TotalImages = len(registry.Images)
			registry.Metadata.LastUpdated = time.Now()
			return jsm.saveImageRegistry(registry)
		}
	}

	return fmt.Errorf("image with ID %d not found", id)
}

// Playlist operations
func (jsm *JsonStoreManager) GetPlaylists(ctx context.Context) ([]models.Playlist, error) {
	playlistsDir := filepath.Join(jsm.store.basePath, "playlists")

	// Read all playlist files
	files, err := os.ReadDir(playlistsDir)
	if err != nil {
		if os.IsNotExist(err) {
			return []models.Playlist{}, nil
		}
		return nil, fmt.Errorf("failed to read playlists directory: %w", err)
	}

	var playlists []models.Playlist
	for _, file := range files {
		if filepath.Ext(file.Name()) == ".json" {
			playlistPath := filepath.Join(playlistsDir, file.Name())
			playlist, err := jsm.loadPlaylist(playlistPath)
			if err != nil {
				jsm.logger.Warn("failed to load playlist", "file", file.Name(), "error", err)
				continue
			}
			playlists = append(playlists, *playlist)
		}
	}

	return playlists, nil
}

func (jsm *JsonStoreManager) GetPlaylistByID(ctx context.Context, id int64) (*models.Playlist, error) {
	playlists, err := jsm.GetPlaylists(ctx)
	if err != nil {
		return nil, err
	}

	for _, playlist := range playlists {
		if playlist.ID == id {
			return &playlist, nil
		}
	}

	return nil, fmt.Errorf("playlist with ID %d not found", id)
}

func (jsm *JsonStoreManager) SavePlaylist(ctx context.Context, playlist models.Playlist) error {
	playlistsDir := filepath.Join(jsm.store.basePath, "playlists")

	// Ensure playlists directory exists
	if err := os.MkdirAll(playlistsDir, 0755); err != nil {
		return fmt.Errorf("failed to create playlists directory: %w", err)
	}

	// Convert models.Playlist to store.Playlist
	storePlaylist := jsm.convertToStorePlaylist(playlist)

	// Save to file
	playlistPath := filepath.Join(playlistsDir, fmt.Sprintf("playlist_%d.json", playlist.ID))
	return jsm.store.saveJSON(playlistPath, storePlaylist)
}

func (jsm *JsonStoreManager) DeletePlaylist(ctx context.Context, id int64) error {
	playlistPath := filepath.Join(jsm.store.basePath, "playlists", fmt.Sprintf("playlist_%d.json", id))

	if err := os.Remove(playlistPath); err != nil {
		if os.IsNotExist(err) {
			return fmt.Errorf("playlist with ID %d not found", id)
		}
		return fmt.Errorf("failed to delete playlist: %w", err)
	}

	return nil
}

// Image history operations
func (jsm *JsonStoreManager) GetImageHistory(ctx context.Context, limit int) ([]ImageHistoryEntry, error) {
	historyPath := jsm.store.getFilePath("history.json")

	var history ImageHistory
	if err := jsm.store.loadJSON(historyPath, &history); err != nil {
		if os.IsNotExist(err) {
			return []ImageHistoryEntry{}, nil
		}
		return nil, fmt.Errorf("failed to load image history: %w", err)
	}

	// Sort by SetAt descending and limit
	sort.Slice(history.Entries, func(i, j int) bool {
		return history.Entries[i].SetAt.After(history.Entries[j].SetAt)
	})

	if limit > 0 && len(history.Entries) > limit {
		return history.Entries[:limit], nil
	}

	return history.Entries, nil
}

func (jsm *JsonStoreManager) AddImageHistory(ctx context.Context, entry ImageHistoryEntry) error {
	historyPath := jsm.store.getFilePath("history.json")

	var history ImageHistory
	if err := jsm.store.loadJSON(historyPath, &history); err != nil {
		if os.IsNotExist(err) {
			// Create new history
			history = ImageHistory{
				Metadata: ImageHistoryMetadata{
					Version:      "1.0",
					Limit:        1000,
					LastCleanup:  time.Now(),
					TotalEntries: 0,
					OldestEntry:  time.Now(),
					NewestEntry:  time.Now(),
				},
				Entries:    []ImageHistoryEntry{},
				ByMonitor:  make(map[string][]string),
				Statistics: ImageHistoryStats{},
			}
		} else {
			return fmt.Errorf("failed to load image history: %w", err)
		}
	}

	// Add entry
	history.Entries = append(history.Entries, entry)
	history.Metadata.TotalEntries++
	history.Metadata.NewestEntry = entry.SetAt
	if history.Metadata.OldestEntry.After(entry.SetAt) {
		history.Metadata.OldestEntry = entry.SetAt
	}

	// Update by-monitor index
	if history.ByMonitor[entry.MonitorName] == nil {
		history.ByMonitor[entry.MonitorName] = []string{}
	}
	history.ByMonitor[entry.MonitorName] = append(history.ByMonitor[entry.MonitorName], entry.ImageID)

	// Cleanup old entries if needed
	if len(history.Entries) > history.Metadata.Limit {
		sort.Slice(history.Entries, func(i, j int) bool {
			return history.Entries[i].SetAt.After(history.Entries[j].SetAt)
		})
		history.Entries = history.Entries[:history.Metadata.Limit]
		history.Metadata.TotalEntries = int64(len(history.Entries))
	}

	return jsm.store.saveJSON(historyPath, history)
}

// Configuration operations
func (jsm *JsonStoreManager) GetAppConfig(ctx context.Context) (*models.AppConfig, error) {
	configPath := jsm.store.getFilePath("config/app.json")

	var config models.AppConfig
	if err := jsm.store.loadJSON(configPath, &config); err != nil {
		if os.IsNotExist(err) {
			// Return default config
			return &models.AppConfig{
				KillDaemon:              false,
				Notifications:           true,
				StartMinimized:          false,
				MinimizeInsteadOfClose:  true,
				RandomImageMonitor:      "individual",
				ShowMonitorModalOnStart: true,
				ImagesPerPage:           20,
				ImageHistoryLimit:       50,
			}, nil
		}
		return nil, fmt.Errorf("failed to load app config: %w", err)
	}

	return &config, nil
}

func (jsm *JsonStoreManager) SaveAppConfig(ctx context.Context, config *models.AppConfig) error {
	configPath := jsm.store.getFilePath("config/app.json")
	return jsm.store.saveJSON(configPath, config)
}

func (jsm *JsonStoreManager) GetSwwwConfig(ctx context.Context) (*models.SwwwConfig, error) {
	configPath := jsm.store.getFilePath("config/swww.json")

	var config models.SwwwConfig
	if err := jsm.store.loadJSON(configPath, &config); err != nil {
		if os.IsNotExist(err) {
			// Return default config
			return &models.SwwwConfig{
				ResizeType:               models.ResizeTypeFit,
				FillColor:                "#000000",
				FilterType:               models.FilterTypeLanczos3,
				TransitionType:           models.TransitionTypeFade,
				TransitionStep:           90,
				TransitionDuration:       1.0,
				TransitionFPS:            60,
				TransitionAngle:          0,
				TransitionPositionType:   models.TransitionPositionTypeAlias,
				TransitionPosition:       models.TransitionPositionCenter,
				TransitionPositionIntX:   0,
				TransitionPositionIntY:   0,
				TransitionPositionFloatX: 0.5,
				TransitionPositionFloatY: 0.5,
				InvertY:                  false,
				TransitionBezier:         "0.25,0.1,0.25,1",
				TransitionWaveX:          20,
				TransitionWaveY:          20,
			}, nil
		}
		return nil, fmt.Errorf("failed to load swww config: %w", err)
	}

	return &config, nil
}

func (jsm *JsonStoreManager) SaveSwwwConfig(ctx context.Context, config *models.SwwwConfig) error {
	configPath := jsm.store.getFilePath("config/swww.json")
	return jsm.store.saveJSON(configPath, config)
}

// Helper methods

func (jsm *JsonStoreManager) applyImageFilters(images []models.Image, filters map[string]interface{}) []models.Image {
	var filtered []models.Image

	for _, img := range images {
		include := true

		// Apply filters
		if format, ok := filters["format"].(string); ok && format != "" {
			if img.Format != format {
				include = false
			}
		}

		if width, ok := filters["width"].(int); ok && width > 0 {
			if img.Width != width {
				include = false
			}
		}

		if height, ok := filters["height"].(int); ok && height > 0 {
			if img.Height != height {
				include = false
			}
		}

		if checked, ok := filters["checked"].(bool); ok {
			if img.IsChecked != checked {
				include = false
			}
		}

		if selected, ok := filters["selected"].(bool); ok {
			if img.IsSelected != selected {
				include = false
			}
		}

		if include {
			filtered = append(filtered, img)
		}
	}

	return filtered
}

func (jsm *JsonStoreManager) loadPlaylist(filePath string) (*models.Playlist, error) {
	var storePlaylist Playlist
	if err := jsm.store.loadJSON(filePath, &storePlaylist); err != nil {
		return nil, err
	}

	// Convert store.Playlist to models.Playlist
	id, err := strconv.ParseInt(storePlaylist.ID, 10, 64)
	if err != nil {
		return nil, fmt.Errorf("invalid playlist ID: %s", storePlaylist.ID)
	}

	var images []models.Image
	for _, img := range storePlaylist.Images {
		imageID, err := strconv.ParseInt(img.ImageID, 10, 64)
		if err != nil {
			continue // Skip invalid image IDs
		}

		images = append(images, models.Image{
			ID:         imageID,
			Name:       filepath.Base(img.ImagePath),
			Path:       img.ImagePath,
			IsChecked:  false,
			IsSelected: false,
			Width:      0, // Will be populated from image registry
			Height:     0,
			Format:     "",
		})
	}

	return &models.Playlist{
		ID:                      id,
		Name:                    storePlaylist.Name,
		Type:                    models.PlaylistType(storePlaylist.Configuration.Type),
		Interval:                storePlaylist.Configuration.Interval,
		ShowAnimations:          storePlaylist.Configuration.ShowAnimations,
		AlwaysStartOnFirstImage: storePlaylist.Configuration.AlwaysStartOnFirstImage,
		Order:                   models.PlaylistOrder(storePlaylist.Configuration.Order),
		CurrentImageIndex:       0, // Will be set from runtime
		Images:                  images,
	}, nil
}

func (jsm *JsonStoreManager) convertToStorePlaylist(playlist models.Playlist) Playlist {
	var images []PlaylistImage
	for i, img := range playlist.Images {
		images = append(images, PlaylistImage{
			ImageID:   strconv.FormatInt(img.ID, 10),
			ImagePath: img.Path,
			MediaType: media.MediaTypeImage,
			Index:     i,
			AddedAt:   time.Now(),
		})
	}

	return Playlist{
		ID:   strconv.FormatInt(playlist.ID, 10),
		Name: playlist.Name,
		Metadata: PlaylistMetadata{
			Version:      "1.0",
			CreatedAt:    time.Now(),
			LastModified: time.Now(),
		},
		Configuration: PlaylistConfiguration{
			Type:                    string(playlist.Type),
			Interval:                playlist.Interval,
			ShowAnimations:          playlist.ShowAnimations,
			AlwaysStartOnFirstImage: playlist.AlwaysStartOnFirstImage,
			Order:                   string(playlist.Order),
		},
		Images: images,
	}
}

func (jsm *JsonStoreManager) saveImageRegistry(registry *ImageRegistry) error {
	registryPath := jsm.store.getFilePath("images.json")
	return jsm.store.saveJSON(registryPath, registry)
}
