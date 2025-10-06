package store

import (
	"archive/tar"
	"compress/gzip"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log/slog"
	"os"
	"time"

	"waypaper-engine/daemon-go/internal/db"
)

// PlaylistExport represents the export format for playlists
type PlaylistExport struct {
	Version         string                  `json:"version"`
	ExportTimestamp string                  `json:"export_timestamp"`
	AppVersion      string                  `json:"app_version"`
	Metadata        ExportMetadata          `json:"metadata"`
	Playlists       []ExportedPlaylist      `json:"playlists"`
	Images          []ExportedImageMetadata `json:"images"`
}

// ExportMetadata contains export metadata
type ExportMetadata struct {
	ExportReason   string `json:"export_reason"`
	ExportSource   string `json:"export_source"`
	TotalPlaylists int    `json:"total_playlists"`
	TotalImages    int    `json:"total_images"`
}

// ExportedPlaylist represents a playlist in the export format
type ExportedPlaylist struct {
	ID                      int64                   `json:"id"`
	Name                    string                  `json:"name"`
	Type                    string                  `json:"type"`
	Interval                *int64                  `json:"interval,omitempty"`
	ShowAnimations          bool                    `json:"show_animations"`
	AlwaysStartOnFirstImage bool                    `json:"always_start_on_first_image"`
	Order                   *string                 `json:"order,omitempty"`
	CurrentImageIndex       int64                   `json:"current_image_index"`
	Images                  []ExportedPlaylistImage `json:"images"`
	Metadata                PlaylistMetadata        `json:"metadata"`
	CreatedAt               string                  `json:"created_at"`
	UpdatedAt               string                  `json:"updated_at"`
}

// ExportedPlaylistImage represents an image in a playlist export
type ExportedPlaylistImage struct {
	ID              int64  `json:"id"`
	ImageName       string `json:"image_name"`
	IndexInPlaylist int    `json:"index_in_playlist"`
	Width           int64  `json:"width"`
	Height          int64  `json:"height"`
	Format          string `json:"format"`
}

// ExportedImageMetadata represents image metadata in export
type ExportedImageMetadata struct {
	ID         int64  `json:"id"`
	Name       string `json:"name"`
	Width      int64  `json:"width"`
	Height     int64  `json:"height"`
	Format     string `json:"format"`
	IsChecked  bool   `json:"is_checked"`
	IsSelected bool   `json:"is_selected"`
}

// PlaylistExporter handles playlist export/import operations
type PlaylistExporter struct {
	playlistStore *PlaylistStore
	dbOps         *db.DatabaseOperations
	logger        *slog.Logger
}

// NewPlaylistExporter creates a new playlist exporter
func NewPlaylistExporter(playlistStore *PlaylistStore, dbOps *db.DatabaseOperations, logger *slog.Logger) *PlaylistExporter {
	return &PlaylistExporter{
		playlistStore: playlistStore,
		dbOps:         dbOps,
		logger:        logger,
	}
}

// ExportPlaylists exports playlists to a compressed archive
func (pe *PlaylistExporter) ExportPlaylists(ctx context.Context, exportPath string, reason string) error {
	pe.logger.Info("starting playlist export", "path", exportPath, "reason", reason)

	// Get all playlists from both JSON store and database
	playlists, err := pe.getAllPlaylistsForExport(ctx)
	if err != nil {
		return fmt.Errorf("failed to get playlists: %w", err)
	}

	// Get all images metadata
	images, err := pe.getAllImages(ctx)
	if err != nil {
		return fmt.Errorf("failed to get images: %w", err)
	}

	// Create export data
	export := &PlaylistExport{
		Version:         "1.0",
		ExportTimestamp: time.Now().Format(time.RFC3339),
		AppVersion:      "waypaper-engine-daemon-go",
		Metadata: ExportMetadata{
			ExportReason:   reason,
			ExportSource:   "waypaper-engine",
			TotalPlaylists: len(playlists),
			TotalImages:    len(images),
		},
		Playlists: playlists,
		Images:    images,
	}

	// Create compressed archive
	return pe.createCompressedArchive(exportPath, export)
}

// ImportPlaylists imports playlists from a compressed archive
func (pe *PlaylistExporter) ImportPlaylists(ctx context.Context, importPath string, overwrite bool) error {
	pe.logger.Info("starting playlist import", "path", importPath, "overwrite", overwrite)

	// Read and decompress archive
	export, err := pe.readCompressedArchive(importPath)
	if err != nil {
		return fmt.Errorf("failed to read archive: %w", err)
	}

	// Validate export format
	if err := pe.validateExportFormat(export); err != nil {
		return fmt.Errorf("invalid export format: %w", err)
	}

	// Import playlists
	return pe.importPlaylistsToStore(ctx, export, overwrite)
}

// ExportToJSON exports playlists to a simple JSON file (no compression)
func (pe *PlaylistExporter) ExportToJSON(ctx context.Context, exportPath string, reason string) error {
	playlists, err := pe.getAllPlaylistsForExport(ctx)
	if err != nil {
		return fmt.Errorf("failed to get playlists: %w", err)
	}

	images, err := pe.getAllImages(ctx)
	if err != nil {
		return fmt.Errorf("failed to get images: %w", err)
	}

	export := &PlaylistExport{
		Version:         "1.0",
		ExportTimestamp: time.Now().Format(time.RFC3339),
		AppVersion:      "waypaper-engine-daemon-go",
		Metadata: ExportMetadata{
			ExportReason:   reason,
			ExportSource:   "waypaper-engine",
			TotalPlaylists: len(playlists),
			TotalImages:    len(images),
		},
		Playlists: playlists,
		Images:    images,
	}

	data, err := json.MarshalIndent(export, "", "  ")
	if err != nil {
		return fmt.Errorf("failed to marshal export: %w", err)
	}

	return os.WriteFile(exportPath, data, 0644)
}

// getAllPlaylistsForExport retrieves all playlists from both stores
func (pe *PlaylistExporter) getAllPlaylistsForExport(ctx context.Context) ([]ExportedPlaylist, error) {
	var exportedPlaylists []ExportedPlaylist

	// First try JSON store
	if pe.playlistStore != nil {
		jsonPlaylists, err := pe.playlistStore.GetAllPlaylists()
		if err != nil {
			pe.logger.Warn("failed to get playlists from JSON store", "error", err)
		} else {
			for _, playlist := range jsonPlaylists {
				exported, err := pe.convertJSONPlaylistToExport(playlist)
				if err != nil {
					pe.logger.Warn("failed to convert JSON playlist", "error", err)
					continue
				}
				exportedPlaylists = append(exportedPlaylists, exported)
			}
		}
	}

	// TODO: Add database playlist export when GetAllPlaylists method is available
	// Currently commenting out due to missing method
	/*
		if pe.dbOps != nil {
			dbPlaylists, err := pe.dbOps.GetAllPlaylists(ctx)
			if err != nil {
				pe.logger.Warn("failed to get playlists from database", "error", err)
			} else {
				for _, dbPlaylist := range dbPlaylists {
					// Avoid duplicates from JSON store
					found := false
					for _, exported := range exportedPlaylists {
						if exported.Name == dbPlaylist.Name {
							found = true
							break
						}
					}
					if !found {
						exported, err := pe.convertDBPlaylistToExport(ctx, dbPlaylist)
						if err != nil {
							pe.logger.Warn("failed to convert database playlist", "playlist", dbPlaylist.Name, "error", err)
							continue
						}
						exportedPlaylists = append(exportedPlaylists, exported)
					}
				}
			}
		}
	*/

	return exportedPlaylists, nil
}

// getAllImages retrieves all images metadata
func (pe *PlaylistExporter) generateUUID() string {
	return fmt.Sprintf("%d", time.Now().UnixNano())
}

// Placeholder implementations for complex functions
func (pe *PlaylistExporter) getAllImages(ctx context.Context) ([]ExportedImageMetadata, error) {
	if pe.dbOps == nil {
		return []ExportedImageMetadata{}, nil
	}

	images, err := pe.dbOps.GetAllImages(ctx)
	if err != nil {
		return nil, err
	}

	exportedImages := make([]ExportedImageMetadata, len(images))
	for i, img := range images {
		exportedImages[i] = ExportedImageMetadata{
			ID:         img.ID,
			Name:       img.Name,
			Width:      img.Width,
			Height:     img.Height,
			Format:     img.Format,
			IsChecked:  img.Ischecked == 1,
			IsSelected: img.Isselected == 1,
		}
	}
	return exportedImages, nil
}

func (pe *PlaylistExporter) createCompressedArchive(exportPath string, export *PlaylistExport) error {
	file, err := os.Create(exportPath)
	if err != nil {
		return err
	}
	defer file.Close()

	gzWriter := gzip.NewWriter(file)
	defer gzWriter.Close()

	tarWriter := tar.NewWriter(gzWriter)
	defer tarWriter.Close()

	// Add export.json to archive
	exportData, err := json.MarshalIndent(export, "", "  ")
	if err != nil {
		return err
	}

	header := &tar.Header{
		Name:    "export.json",
		Mode:    0644,
		Size:    int64(len(exportData)),
		ModTime: time.Now(),
	}

	if err := tarWriter.WriteHeader(header); err != nil {
		return err
	}

	if _, err := tarWriter.Write(exportData); err != nil {
		return err
	}

	return nil
}

func (pe *PlaylistExporter) readCompressedArchive(importPath string) (*PlaylistExport, error) {
	file, err := os.Open(importPath)
	if err != nil {
		return nil, err
	}
	defer file.Close()

	gzReader, err := gzip.NewReader(file)
	if err != nil {
		return nil, err
	}
	defer gzReader.Close()

	tarReader := tar.NewReader(gzReader)

	for {
		header, err := tarReader.Next()
		if err == io.EOF {
			break
		}
		if err != nil {
			return nil, err
		}

		if header.Name == "export.json" {
			data, err := io.ReadAll(tarReader)
			if err != nil {
				return nil, err
			}

			var export PlaylistExport
			if err := json.Unmarshal(data, &export); err != nil {
				return nil, err
			}
			return &export, nil
		}
	}

	return nil, fmt.Errorf("export.json not found in archive")
}

func (pe *PlaylistExporter) validateExportFormat(export *PlaylistExport) error {
	if export.Version == "" {
		return fmt.Errorf("missing version")
	}
	if export.ExportTimestamp == "" {
		return fmt.Errorf("missing export timestamp")
	}
	if len(export.Playlists) == 0 {
		return fmt.Errorf("no playlists in export")
	}
	return nil
}

func (pe *PlaylistExporter) importPlaylistsToStore(ctx context.Context, export *PlaylistExport, overwrite bool) error {
	for _, exportedPlaylist := range export.Playlists {
		if err := pe.importSinglePlaylist(ctx, exportedPlaylist, overwrite); err != nil {
			pe.logger.Error("failed to import playlist", "playlist", exportedPlaylist.Name, "error", err)
			continue
		}
		pe.logger.Info("imported playlist", "playlist", exportedPlaylist.Name)
	}
	return nil
}

func (pe *PlaylistExporter) convertJSONPlaylistToExport(playlist *Playlist) (ExportedPlaylist, error) {
	// Placeholder implementation - would need actual conversion logic
	return ExportedPlaylist{}, nil
}

func (pe *PlaylistExporter) convertDBPlaylistToExport(ctx context.Context, dbPlaylist db.Playlist) (ExportedPlaylist, error) {
	// Placeholder implementation - would need actual conversion logic
	return ExportedPlaylist{}, nil
}

func (pe *PlaylistExporter) importSinglePlaylist(ctx context.Context, exported ExportedPlaylist, overwrite bool) error {
	// Placeholder implementation
	return nil
}
