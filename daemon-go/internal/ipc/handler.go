package ipc

import (
	"context"
	"database/sql"
	"fmt"
	"log/slog"
	"os"
	"path/filepath"
	"strings"
	"time"

	"waypaper-engine/daemon-go/internal/config"
	"waypaper-engine/daemon-go/internal/db"
	"waypaper-engine/daemon-go/internal/errors"
	"waypaper-engine/daemon-go/internal/image"
	"waypaper-engine/daemon-go/internal/media"
	"waypaper-engine/daemon-go/internal/monitor"
	"waypaper-engine/daemon-go/internal/playlist"
	"waypaper-engine/daemon-go/internal/store"
	"waypaper-engine/daemon-go/internal/system"
	"waypaper-engine/daemon-go/internal/types"
)

// Handler is the implementation of the MessageHandler interface.
type Handler struct {
	playlistManager *playlist.Manager
	dbOps           *db.DatabaseOperations
	dbQueries       *db.Queries
	configManager   *config.ConfigManager
	imageProcessor  *image.Processor
	monitorManager  *monitor.Manager
	logger          *slog.Logger
	server          *Server
	store           *store.Store
}

// NewHandler creates a new message handler.
func NewHandler(playlistManager *playlist.Manager, dbOps *db.DatabaseOperations, dbQueries *db.Queries, configManager *config.ConfigManager, imageProcessor *image.Processor, monitorManager *monitor.Manager, logger *slog.Logger) *Handler {
	return &Handler{
		playlistManager: playlistManager,
		dbOps:           dbOps,
		dbQueries:       dbQueries,
		configManager:   configManager,
		imageProcessor:  imageProcessor,
		monitorManager:  monitorManager,
		store:           nil, // Will be set later if JSON store is available
		logger:          logger,
	}
}

// SetStore sets the JSON store for the handler
func (h *Handler) SetStore(store *store.Store) {
	h.store = store
}

// SetServer sets the server reference for event broadcasting.
func (h *Handler) SetServer(server *Server) {
	h.server = server
	// Start listening to playlist events and broadcast them
	go h.listenToPlaylistEvents()
}

// createResponse creates a response with the message ID from the original message
func (h *Handler) createResponse(action string, data interface{}, err error) *Response {
	response := &Response{
		Action:    action,
		MessageID: 0, // Will be set by the caller
	}

	if err != nil {
		response.Error = err.Error()
	} else {
		response.Data = data
	}

	return response
}

// HandleMessage handles incoming IPC messages.
func (h *Handler) HandleMessage(msg *Message) *Response {
	fmt.Printf("DEBUG: HandleMessage called with action=%s, imagePaths=%v, fileNames=%v\n", msg.Action, msg.ImagePaths, msg.FileNames)
	h.logger.Info("handling message", "action", msg.Action)
	var response *Response

	switch msg.Action {
	case "ping":
		response = h.handlePing(msg)
	case "start_playlist":
		response = h.handleStartPlaylist(msg)
	case "stop_playlist":
		response = h.handleStopPlaylist(msg)
	case "pause_playlist":
		response = h.handlePausePlaylist(msg)
	case "resume_playlist":
		response = h.handleResumePlaylist(msg)
	case "next_image":
		response = h.handleNextImage(msg)
	case "previous_image":
		response = h.handlePreviousImage(msg)
	case "set_image":
		response = h.handleSetImage(msg)
	case "random_image":
		response = h.handleRandomImage(msg)
	case "get_info":
		response = h.handleGetInfo(msg)
	case "get_diagnostics":
		response = h.handleGetDiagnostics(msg)
	case "get_images":
		response = h.handleGetImages(msg)
	case "get_playlists":
		response = h.handleGetPlaylists(msg)
	case "get_active_playlist":
		response = h.handleGetActivePlaylist(msg)
	case "save_playlist":
		response = h.handleSavePlaylist(msg)

	// Image Operations
	case "get_image_metadata":
		response = h.handleGetImageMetadata(msg)
	case "resize_image":
		response = h.handleResizeImage(msg)
	case "convert_image":
		response = h.handleConvertImage(msg)
	case "process_for_monitors":
		response = h.handleProcessForMonitors(msg)
	case "set_image_across_monitors":
		response = h.handleSetImageAcrossMonitors(msg)
	case "duplicate_image_across_monitors":
		response = h.handleDuplicateImageAcrossMonitors(msg)
	case "delete_images":
		response = h.handleDeleteImages(msg)
	case "get_image_history":
		response = h.handleGetImageHistory(msg)

	// Bulk Operations
	case "next_image_all":
		response = h.handleNextImageAll(msg)
	case "previous_image_all":
		response = h.handlePreviousImageAll(msg)
	case "random_image_all":
		response = h.handleRandomImageAll(msg)
	case "stop_playlist_all":
		response = h.handleStopPlaylistAll(msg)
	case "pause_playlist_all":
		response = h.handlePausePlaylistAll(msg)
	case "resume_playlist_all":
		response = h.handleResumePlaylistAll(msg)

	// Configuration
	case "get_app_config":
		response = h.handleGetAppConfig(msg)
	case "set_app_config":
		response = h.handleSetAppConfig(msg)
	case "get_swww_config":
		response = h.handleGetSwwwConfig(msg)
	case "set_swww_config":
		response = h.handleSetSwwwConfig(msg)
	case "update_config":
		response = h.handleUpdateConfig(msg)

	// System
	case "stop_daemon":
		response = h.handleStopDaemon(msg)
	case "kill_daemon":
		response = h.handleKillDaemon(msg)
	case "stop_playlist_by_name":
		response = h.handleStopPlaylistByName(msg)
	case "stop_playlist_by_monitor_name":
		response = h.handleStopPlaylistByMonitorName(msg)
	case "stop_playlist_on_removed_monitors":
		response = h.handleStopPlaylistOnRemovedMonitors(msg)
	case "get_daemon_status":
		response = h.handleGetDaemonStatus(msg)
	case "get_monitors":
		response = h.handleGetMonitors(msg)
	case "set_selected_monitor":
		response = h.handleSetSelectedMonitor(msg)
	case "get_selected_monitor":
		response = h.handleGetSelectedMonitor(msg)
	case "get_playlist_images":
		response = h.handleGetPlaylistImages(msg)
	case "delete_playlist":
		response = h.handleDeletePlaylist(msg)
	case "delete_image_from_gallery":
		response = h.handleDeleteImageFromGallery(msg)
	case "process_images":
		response = h.handleProcessImages(msg)
	case "create_thumbnail":
		response = h.handleCreateThumbnail(msg)
	case "delete_image_from_cache":
		response = h.handleDeleteImageFromCache(msg)
	case "get_image_src":
		response = h.handleGetImageSrc(msg)
	case "get_thumbnail_src":
		response = h.handleGetThumbnailSrc(msg)
	case "get_monitor_image":
		response = h.handleGetMonitorImage(msg)
	case "open_context_menu":
		response = h.handleOpenContextMenu(msg)

	default:
		response := &Response{Action: msg.Action, Error: errors.New(errors.IPCError, "unknown action").Error()}
		response.MessageID = msg.MessageID
		return response
	}

	// Set the message ID from the original message
	response.MessageID = msg.MessageID
	return response
}

func (h *Handler) handleStartPlaylist(msg *Message) *Response {
	if msg.PlaylistID == 0 || msg.ActiveMonitor == nil {
		return &Response{Action: msg.Action, Error: errors.New(errors.IPCError, "missing playlist ID or monitor info").Error()}
	}

	err := h.playlistManager.StartPlaylist(context.Background(), msg.PlaylistID, msg.ActiveMonitor)
	if err != nil {
		h.logger.Error("failed to start playlist", "error", err)
		return &Response{Action: msg.Action, Error: err.Error()}
	}

	return &Response{Action: msg.Action, Data: "playlist started"}
}

func (h *Handler) handleStopPlaylist(msg *Message) *Response {
	if msg.ActiveMonitor == nil {
		return &Response{Action: msg.Action, Error: errors.New(errors.IPCError, "missing monitor info").Error()}
	}

	err := h.playlistManager.StopPlaylist(msg.ActiveMonitor.Name)
	if err != nil {
		h.logger.Error("failed to stop playlist", "error", err)
		return &Response{Action: msg.Action, Error: err.Error()}
	}

	return &Response{Action: msg.Action, Data: "playlist stopped"}
}

func (h *Handler) handlePausePlaylist(msg *Message) *Response {
	if msg.ActiveMonitor == nil {
		return &Response{Action: msg.Action, Error: errors.New(errors.IPCError, "missing monitor info").Error()}
	}

	err := h.playlistManager.PausePlaylist(msg.ActiveMonitor.Name)
	if err != nil {
		h.logger.Error("failed to pause playlist", "error", err)
		return &Response{Action: msg.Action, Error: err.Error()}
	}

	return &Response{Action: msg.Action, Data: "playlist paused"}
}

func (h *Handler) handleResumePlaylist(msg *Message) *Response {
	if msg.ActiveMonitor == nil {
		return &Response{Action: msg.Action, Error: errors.New(errors.IPCError, "missing monitor info").Error()}
	}

	err := h.playlistManager.ResumePlaylist(msg.ActiveMonitor.Name)
	if err != nil {
		h.logger.Error("failed to resume playlist", "error", err)
		return &Response{Action: msg.Action, Error: err.Error()}
	}

	return &Response{Action: msg.Action, Data: "playlist resumed"}
}

func (h *Handler) handleNextImage(msg *Message) *Response {
	if msg.ActiveMonitor == nil {
		return &Response{Action: msg.Action, Error: errors.New(errors.IPCError, "missing monitor info").Error()}
	}

	err := h.playlistManager.NextImage(context.Background(), msg.ActiveMonitor.Name)
	if err != nil {
		h.logger.Error("failed to set next image", "error", err)
		return &Response{Action: msg.Action, Error: err.Error()}
	}

	return &Response{Action: msg.Action, Data: "image changed"}
}

func (h *Handler) handlePreviousImage(msg *Message) *Response {
	if msg.ActiveMonitor == nil {
		return &Response{Action: msg.Action, Error: errors.New(errors.IPCError, "missing monitor info").Error()}
	}

	err := h.playlistManager.PreviousImage(context.Background(), msg.ActiveMonitor.Name)
	if err != nil {
		h.logger.Error("failed to set previous image", "error", err)
		return &Response{Action: msg.Action, Error: err.Error()}
	}

	return &Response{Action: msg.Action, Data: "image changed"}
}

func (h *Handler) handleSetImage(msg *Message) *Response {
	fmt.Printf("DEBUG: handleSetImage called with msg.Image: %+v, msg.ActiveMonitor: %+v\n", msg.Image, msg.ActiveMonitor)

	if msg.Image == nil || msg.ActiveMonitor == nil {
		fmt.Printf("DEBUG: Missing image or monitor info - Image: %v, ActiveMonitor: %v\n", msg.Image, msg.ActiveMonitor)
		return &Response{Action: msg.Action, Error: errors.New(errors.IPCError, "missing image or monitor info").Error()}
	}

	fmt.Printf("DEBUG: About to call SetImage with monitor: %s, imageId: %d\n", msg.ActiveMonitor.Name, msg.Image.ID)
	err := h.playlistManager.SetImage(context.Background(), msg.ActiveMonitor.Name, msg.Image.ID)
	if err != nil {
		h.logger.Error("failed to set image", "error", err)
		return &Response{Action: msg.Action, Error: err.Error()}
	}

	// Update monitor state with the current image
	// Get the image name from database to construct the full path
	image, err := h.dbOps.GetImage(context.Background(), msg.Image.ID)
	if err != nil {
		h.logger.Error("failed to get image for monitor state update", "error", err)
		// Don't fail the operation if we can't update monitor state
	} else {
		// Get image data for SetWallpaperForMonitorWithName
		imageData, err := h.dbOps.GetImageData(context.Background(), msg.Image.ID)
		if err != nil {
			h.logger.Error("failed to get image data for monitor state update", "error", err)
		} else {
			err = h.monitorManager.SetWallpaperForMonitorWithName(context.Background(), imageData, msg.ActiveMonitor.Name, image.Name)
			if err != nil {
				h.logger.Error("failed to update monitor state", "error", err)
				// Don't fail the operation if we can't update monitor state
			} else {
				h.logger.Debug("updated monitor state", "monitor", msg.ActiveMonitor.Name, "image", image.Name)
			}
		}
	}

	return &Response{Action: msg.Action, Data: "image changed"}
}

func (h *Handler) handleRandomImage(msg *Message) *Response {
	if msg.ActiveMonitor == nil {
		return &Response{Action: msg.Action, Error: errors.New(errors.IPCError, "missing monitor info").Error()}
	}

	err := h.playlistManager.RandomImage(context.Background(), msg.ActiveMonitor.Name)
	if err != nil {
		h.logger.Error("failed to set random image", "error", err)
		return &Response{Action: msg.Action, Error: err.Error()}
	}

	return &Response{Action: msg.Action, Data: "image changed"}
}

func (h *Handler) handleGetInfo(msg *Message) *Response {
	info, err := system.GetInfo(context.Background(), h.dbOps)
	if err != nil {
		h.logger.Error("failed to get info", "error", err)
		return &Response{Action: msg.Action, Error: err.Error()}
	}

	return &Response{Action: msg.Action, Data: info}
}

func (h *Handler) handleGetImages(msg *Message) *Response {
	// For now, return all images. In the future, this could support filtering
	h.logger.Info("handleGetImages: starting to get images")

	// Try to get images from JSON store first (migrated images)
	if h.store != nil {
		registry, err := h.store.LoadImageRegistry()
		if err == nil && registry != nil && len(registry.Images) > 0 {
			h.logger.Info("handleGetImages: found images in JSON store", "count", len(registry.Images))

			// Log the first few images for debugging
			for i, img := range registry.Images {
				if i < 3 { // Only log first 3 images
					h.logger.Info("handleGetImages: JSON image", "index", i, "id", img.ID, "name", img.Name, "path", img.Path)
				} else {
					break
				}
			}

			// Convert JSON images to frontend-compatible format
			// Frontend expects only the database schema fields: id, name, isChecked, isSelected, width, height, format
			var frontendImages []map[string]interface{}
			for _, jsonImg := range registry.Images {
				frontendImg := map[string]interface{}{
					"id":         jsonImg.ID,
					"name":       jsonImg.Name,
					"isChecked":  jsonImg.Selection.IsChecked,
					"isSelected": jsonImg.Selection.IsSelected,
					"width":      jsonImg.Dimensions.Width,
					"height":     jsonImg.Dimensions.Height,
					"format":     jsonImg.Metadata.Format,
				}
				frontendImages = append(frontendImages, frontendImg)
			}

			h.logger.Info("handleGetImages: returning images from JSON store", "count", len(frontendImages))
			return &Response{Action: msg.Action, Data: frontendImages}
		}
	}

	// Fallback to SQLite database
	h.logger.Info("handleGetImages: falling back to SQLite database")
	dbImages, err := h.dbOps.GetAllImages(context.Background())
	if err != nil {
		h.logger.Error("failed to get images", "error", err)
		return &Response{Action: msg.Action, Error: err.Error()}
	}
	h.logger.Info("handleGetImages: got images from SQLite database", "count", len(dbImages))

	// Log the first few images for debugging
	for i, img := range dbImages {
		if i < 3 { // Only log first 3 images
			h.logger.Info("handleGetImages: SQLite image", "index", i, "id", img.ID, "name", img.Name)
		}
	}

	// Convert database images to frontend-compatible format
	// Frontend expects only the database schema fields: id, name, isChecked, isSelected, width, height, format
	var frontendImages []map[string]interface{}
	for _, dbImg := range dbImages {
		frontendImg := map[string]interface{}{
			"id":         dbImg.ID,
			"name":       dbImg.Name,
			"isChecked":  dbImg.Ischecked == 1,
			"isSelected": dbImg.Isselected == 1,
			"width":      int(dbImg.Width),
			"height":     int(dbImg.Height),
			"format":     dbImg.Format,
		}
		frontendImages = append(frontendImages, frontendImg)
	}

	if len(frontendImages) == 0 {
		h.logger.Info("handleGetImages: no images found, returning null")
		return &Response{Action: msg.Action, Data: nil}
	}

	return &Response{Action: msg.Action, Data: frontendImages}
}

func (h *Handler) handleGetPlaylists(msg *Message) *Response {
	// Get all playlists with their images
	playlists, err := h.dbOps.GetAllPlaylistsWithImages(context.Background())
	if err != nil {
		h.logger.Error("failed to get playlists", "error", err)
		return &Response{Action: msg.Action, Error: err.Error()}
	}

	return &Response{Action: msg.Action, Data: playlists}
}

func (h *Handler) handlePing(msg *Message) *Response {
	return &Response{Action: "pong", Data: "pong"}
}

// Image Operation Handlers

func (h *Handler) handleGetImageMetadata(msg *Message) *Response {
	// This would extract metadata from an image file
	// For now, return a placeholder
	return &Response{Action: msg.Action, Data: "metadata placeholder"}
}

func (h *Handler) handleResizeImage(msg *Message) *Response {
	// This would resize an image
	// For now, return a placeholder
	return &Response{Action: msg.Action, Data: "resize placeholder"}
}

func (h *Handler) handleConvertImage(msg *Message) *Response {
	// This would convert an image format
	// For now, return a placeholder
	return &Response{Action: msg.Action, Data: "convert placeholder"}
}

func (h *Handler) handleProcessForMonitors(msg *Message) *Response {
	if msg.Image == nil || msg.ActiveMonitor == nil {
		return h.createResponse(msg.Action, nil, errors.New(errors.IPCError, "image and activeMonitor are required"))
	}

	// Get image data from database
	imageData, err := h.dbOps.GetImageData(context.Background(), msg.Image.ID)
	if err != nil {
		return h.createResponse(msg.Action, nil, errors.New(errors.SystemError, fmt.Sprintf("failed to get image data: %v", err)))
	}

	// Convert models.ActiveMonitor to monitor.ActiveMonitor
	activeMonitor := &monitor.ActiveMonitor{
		Name:                 msg.ActiveMonitor.Name,
		ExtendAcrossMonitors: msg.ActiveMonitor.ExtendAcrossMonitors,
		Monitors:             make([]monitor.Monitor, len(msg.ActiveMonitor.Monitors)),
	}

	for i, m := range msg.ActiveMonitor.Monitors {
		activeMonitor.Monitors[i] = monitor.Monitor{
			Name:   m.Name,
			Width:  m.Width,
			Height: m.Height,
			Position: monitor.Position{
				X: m.Position.X,
				Y: m.Position.Y,
			},
		}
	}

	// Process image for monitors
	monitorImages, err := image.ProcessForMonitors(imageData, activeMonitor)
	if err != nil {
		return h.createResponse(msg.Action, nil, errors.New(errors.ImageError, fmt.Sprintf("failed to process image for monitors: %v", err)))
	}

	response := &Response{Action: msg.Action, Data: monitorImages}
	return response
}

func (h *Handler) handleSetImageAcrossMonitors(msg *Message) *Response {
	if msg.Image == nil || msg.ActiveMonitor == nil {
		return h.createResponse(msg.Action, nil, errors.New(errors.IPCError, "image and activeMonitor are required"))
	}

	// Get image info from database
	imageInfo, err := h.dbOps.GetImage(context.Background(), msg.Image.ID)
	if err != nil {
		return h.createResponse(msg.Action, nil, errors.New(errors.SystemError, fmt.Sprintf("failed to get image info: %v", err)))
	}

	// Get image data from database
	imageData, err := h.dbOps.GetImageData(context.Background(), msg.Image.ID)
	if err != nil {
		return h.createResponse(msg.Action, nil, errors.New(errors.SystemError, fmt.Sprintf("failed to get image data: %v", err)))
	}

	// Convert models.ActiveMonitor to monitor.ActiveMonitor
	activeMonitor := &monitor.ActiveMonitor{
		Name:                 msg.ActiveMonitor.Name,
		ExtendAcrossMonitors: msg.ActiveMonitor.ExtendAcrossMonitors,
		Monitors:             make([]monitor.Monitor, len(msg.ActiveMonitor.Monitors)),
	}

	for i, m := range msg.ActiveMonitor.Monitors {
		activeMonitor.Monitors[i] = monitor.Monitor{
			Name:   m.Name,
			Width:  m.Width,
			Height: m.Height,
			Position: monitor.Position{
				X: m.Position.X,
				Y: m.Position.Y,
			},
		}
	}

	// Process image for monitors
	monitorImages, err := image.ProcessForMonitors(imageData, activeMonitor)
	if err != nil {
		return h.createResponse(msg.Action, nil, errors.New(errors.ImageError, fmt.Sprintf("failed to process image for monitors: %v", err)))
	}

	// Set wallpaper for each monitor
	for _, monitorImage := range monitorImages {
		err = h.monitorManager.SetWallpaperForMonitorWithName(context.Background(), monitorImage.Image, monitorImage.Monitor.Name, imageInfo.Name)
		if err != nil {
			h.logger.Error("failed to set wallpaper for monitor", "monitor", monitorImage.Monitor.Name, "error", err)
			// Continue with other monitors even if one fails
		}
	}

	// Monitor state is already updated by SetWallpaperForMonitorWithName calls above

	response := &Response{Action: msg.Action, Data: "image_set_across_monitors"}
	return response
}

func (h *Handler) handleDuplicateImageAcrossMonitors(msg *Message) *Response {
	if msg.Image == nil || msg.ActiveMonitor == nil {
		return h.createResponse(msg.Action, nil, errors.New(errors.IPCError, "image and activeMonitor are required"))
	}

	// Get image info from database
	imageInfo, err := h.dbOps.GetImage(context.Background(), msg.Image.ID)
	if err != nil {
		return h.createResponse(msg.Action, nil, errors.New(errors.SystemError, fmt.Sprintf("failed to get image info: %v", err)))
	}

	// Get image data from database
	imageData, err := h.dbOps.GetImageData(context.Background(), msg.Image.ID)
	if err != nil {
		return h.createResponse(msg.Action, nil, errors.New(errors.SystemError, fmt.Sprintf("failed to get image data: %v", err)))
	}

	// Convert models.ActiveMonitor to monitor.ActiveMonitor
	activeMonitor := &monitor.ActiveMonitor{
		Name:                 msg.ActiveMonitor.Name,
		ExtendAcrossMonitors: false, // Force duplicate mode
		Monitors:             make([]monitor.Monitor, len(msg.ActiveMonitor.Monitors)),
	}

	for i, m := range msg.ActiveMonitor.Monitors {
		activeMonitor.Monitors[i] = monitor.Monitor{
			Name:   m.Name,
			Width:  m.Width,
			Height: m.Height,
			Position: monitor.Position{
				X: m.Position.X,
				Y: m.Position.Y,
			},
		}
	}

	// Process image for monitors (duplicate mode)
	monitorImages, err := image.ProcessForMonitors(imageData, activeMonitor)
	if err != nil {
		return h.createResponse(msg.Action, nil, errors.New(errors.ImageError, fmt.Sprintf("failed to process image for monitors: %v", err)))
	}

	// Set wallpaper for each monitor
	for _, monitorImage := range monitorImages {
		err = h.monitorManager.SetWallpaperForMonitorWithName(context.Background(), monitorImage.Image, monitorImage.Monitor.Name, imageInfo.Name)
		if err != nil {
			h.logger.Error("failed to set wallpaper for monitor", "monitor", monitorImage.Monitor.Name, "error", err)
			// Continue with other monitors even if one fails
		}
	}

	// Update monitor state
	err = h.monitorManager.UpdateMonitorState(context.Background(), msg.ActiveMonitor)
	if err != nil {
		h.logger.Error("failed to update monitor state", "error", err)
	}

	response := &Response{Action: msg.Action, Data: "image_duplicated_across_monitors"}
	return response
}

func (h *Handler) handleDeleteImages(msg *Message) *Response {
	// This would delete images from the database
	// For now, return a placeholder
	return &Response{Action: msg.Action, Data: "delete images placeholder"}
}

func (h *Handler) handleGetImageHistory(msg *Message) *Response {
	ctx := context.Background()

	// Get the history limit from config
	config, err := h.configManager.GetConfig()
	if err != nil {
		h.logger.Error("failed to get config for image history", "error", err)
		return &Response{Action: msg.Action, Error: err.Error()}
	}

	historyLimit := config.App.ImageHistoryLimit
	if historyLimit <= 0 {
		historyLimit = 50 // Default fallback
	}

	// Get image history with the configured limit
	history, err := h.dbOps.GetImageHistory(ctx, historyLimit)
	if err != nil {
		h.logger.Error("failed to get image history", "error", err)
		return &Response{Action: msg.Action, Error: err.Error()}
	}

	return &Response{Action: msg.Action, Data: history}
}

// Bulk Operation Handlers

func (h *Handler) handleNextImageAll(msg *Message) *Response {
	// This would advance to next image on all monitors
	// For now, return a placeholder
	return &Response{Action: msg.Action, Data: "next image all placeholder"}
}

func (h *Handler) handlePreviousImageAll(msg *Message) *Response {
	// This would go to previous image on all monitors
	// For now, return a placeholder
	return &Response{Action: msg.Action, Data: "previous image all placeholder"}
}

func (h *Handler) handleRandomImageAll(msg *Message) *Response {
	// This would set random image on all monitors
	// For now, return a placeholder
	return &Response{Action: msg.Action, Data: "random image all placeholder"}
}

func (h *Handler) handleStopPlaylistAll(msg *Message) *Response {
	// This would stop playlists on all monitors
	// For now, return a placeholder
	return &Response{Action: msg.Action, Data: "stop playlist all placeholder"}
}

func (h *Handler) handlePausePlaylistAll(msg *Message) *Response {
	// This would pause playlists on all monitors
	// For now, return a placeholder
	return &Response{Action: msg.Action, Data: "pause playlist all placeholder"}
}

func (h *Handler) handleResumePlaylistAll(msg *Message) *Response {
	// This would resume playlists on all monitors
	// For now, return a placeholder
	return &Response{Action: msg.Action, Data: "resume playlist all placeholder"}
}

// Configuration Handlers

func (h *Handler) handleGetAppConfig(msg *Message) *Response {
	config := h.configManager.GetAppConfig()
	return &Response{Action: msg.Action, Data: config}
}

func (h *Handler) handleSetAppConfig(msg *Message) *Response {
	// This would set app configuration
	// For now, return a placeholder
	return &Response{Action: msg.Action, Data: "set app config placeholder"}
}

func (h *Handler) handleGetSwwwConfig(msg *Message) *Response {
	config := h.configManager.GetSwwwConfig()
	return &Response{Action: msg.Action, Data: config}
}

func (h *Handler) handleSetSwwwConfig(msg *Message) *Response {
	// This would set swww configuration
	// For now, return a placeholder
	return &Response{Action: msg.Action, Data: "set swww config placeholder"}
}

func (h *Handler) handleUpdateConfig(msg *Message) *Response {
	// This would update configuration
	// For now, return a placeholder
	return &Response{Action: msg.Action, Data: "update config placeholder"}
}

// System Handlers

func (h *Handler) handleStopDaemon(msg *Message) *Response {
	// This would stop the daemon
	// For now, return a placeholder
	return &Response{Action: msg.Action, Data: "stop daemon placeholder"}
}

func (h *Handler) handleGetDaemonStatus(msg *Message) *Response {
	// This would get daemon status
	// For now, return a placeholder
	return &Response{Action: msg.Action, Data: "daemon status placeholder"}
}

func (h *Handler) handleGetMonitors(msg *Message) *Response {
	// Get monitor information from the monitor manager
	monitors := h.monitorManager.GetMonitors()
	return &Response{Action: msg.Action, Data: monitors}
}

func (h *Handler) handleSetSelectedMonitor(msg *Message) *Response {
	// Set the selected monitor configuration
	if msg.ActiveMonitor == nil {
		response := &Response{Action: msg.Action, Error: errors.New(errors.IPCError, "active monitor is required").Error()}
		return response
	}

	// Store the active monitor configuration using the monitor manager
	err := h.monitorManager.SetActiveMonitor(msg.ActiveMonitor)
	if err != nil {
		response := &Response{Action: msg.Action, Error: err.Error()}
		return response
	}

	response := &Response{Action: msg.Action, Data: "monitor configuration updated"}
	return response
}

func (h *Handler) handleGetSelectedMonitor(msg *Message) *Response {
	// Return the stored active monitor configuration
	activeMonitor := h.monitorManager.GetActiveMonitor()
	response := &Response{Action: msg.Action, Data: activeMonitor}
	return response
}

func (h *Handler) handleGetPlaylistImages(msg *Message) *Response {
	// Get playlist images from database
	ctx := context.Background()
	playlistID := msg.PlaylistID
	if playlistID == 0 {
		response := &Response{Action: msg.Action, Error: errors.New(errors.IPCError, "playlist ID is required").Error()}
		return response
	}

	images, err := h.dbQueries.GetPlaylistImagesOrdered(ctx, playlistID)
	if err != nil {
		h.logger.Error("failed to get playlist images", "error", err)
		response := &Response{Action: msg.Action, Error: err.Error()}
		return response
	}

	response := &Response{Action: msg.Action, Data: images}
	return response
}

func (h *Handler) handleDeletePlaylist(msg *Message) *Response {
	// Delete playlist from database
	ctx := context.Background()
	playlistName := msg.PlaylistName
	if playlistName == "" {
		response := &Response{Action: msg.Action, Error: errors.New(errors.IPCError, "playlist name is required").Error()}
		return response
	}

	err := h.dbQueries.DeletePlaylistByName(ctx, playlistName)
	if err != nil {
		h.logger.Error("failed to delete playlist", "error", err)
		response := &Response{Action: msg.Action, Error: err.Error()}
		return response
	}

	// Emit playlists updated event
	if h.server != nil {
		h.server.BroadcastEvent(&Event{
			Type: "playlists_updated",
			Payload: map[string]interface{}{
				"action":       "deleted",
				"playlistName": playlistName,
			},
		})
	}

	response := &Response{Action: msg.Action, Data: "playlist deleted"}
	return response
}

func (h *Handler) handleDeleteImageFromGallery(msg *Message) *Response {
	// Delete images from database and storage
	ctx := context.Background()
	imageIDs := msg.ImageIDs
	h.logger.Info("handleDeleteImageFromGallery called", "imageIDs", imageIDs, "action", msg.Action)

	if len(imageIDs) == 0 {
		h.logger.Error("no image IDs provided for deletion")
		response := &Response{Action: msg.Action, Error: errors.New(errors.IPCError, "image IDs are required").Error()}
		return response
	}

	// Get image names before deleting from database
	var imageNames []string
	for _, id := range imageIDs {
		image, err := h.dbOps.GetImage(ctx, id)
		if err != nil {
			h.logger.Warn("failed to get image name for deletion", "imageID", id, "error", err)
			continue
		}
		imageNames = append(imageNames, image.Name)
	}

	// Delete from database
	err := h.dbQueries.DeleteImagesByIDs(ctx, imageIDs)
	if err != nil {
		h.logger.Error("failed to delete images from database", "error", err)
		response := &Response{Action: msg.Action, Error: err.Error()}
		return response
	}

	// Delete files from storage
	config, err := h.configManager.GetConfig()
	if err != nil {
		h.logger.Error("failed to get config for file deletion", "error", err)
		// Don't fail the whole operation if we can't get config
	} else {
		for _, fileName := range imageNames {
			err := image.DeleteImageFromCache(fileName, config.Daemon.ImagesDir, config.Daemon.ThumbnailsDir)
			if err != nil {
				h.logger.Warn("failed to delete image file", "fileName", fileName, "error", err)
				// Continue with other files
			}
		}
	}

	// Emit images updated event
	if h.server != nil && len(imageIDs) > 0 {
		h.server.BroadcastEvent(&Event{
			Type: "images_updated",
			Payload: map[string]interface{}{
				"totalDeleted": len(imageIDs),
			},
		})
	}

	response := &Response{Action: msg.Action, Data: "images deleted"}
	return response
}

func (h *Handler) handleProcessImages(msg *Message) *Response {
	// Process images from file paths (equivalent to copyImagesToCacheAndProcessThumbnails)
	ctx := context.Background()

	fmt.Printf("DEBUG: handleProcessImages called with imagePaths=%v, fileNames=%v\n", msg.ImagePaths, msg.FileNames)
	h.logger.Info("handleProcessImages called", "imagePaths", msg.ImagePaths, "fileNames", msg.FileNames)

	if len(msg.ImagePaths) == 0 || len(msg.FileNames) == 0 {
		h.logger.Error("image paths or file names are empty", "imagePaths", msg.ImagePaths, "fileNames", msg.FileNames)
		response := &Response{Action: msg.Action, Error: errors.New(errors.IPCError, "image paths and file names are required").Error()}
		return response
	}

	// Get cache directory paths from configuration
	config, err := h.configManager.GetConfig()
	if err != nil {
		response := &Response{Action: msg.Action, Error: errors.New(errors.IPCError, "failed to get configuration").Error()}
		return response
	}

	cacheDir := config.Daemon.ImagesDir
	thumbnailsDir := config.Daemon.ThumbnailsDir

	// Get existing files in the cache directory to avoid conflicts
	existingFiles := make(map[string]bool)
	if entries, err := os.ReadDir(cacheDir); err == nil {
		for _, entry := range entries {
			if !entry.IsDir() {
				existingFiles[entry.Name()] = true
			}
		}
	}

	// Generate unique filenames to avoid conflicts
	uniqueFileNames := image.GetUniqueFileNames(existingFiles, msg.FileNames)
	h.logger.Info("generated unique filenames", "original", msg.FileNames, "unique", uniqueFileNames)

	// Process images one by one and emit events for each
	var metadataList []*image.Metadata

	for i, imagePath := range msg.ImagePaths {
		originalFileName := msg.FileNames[i]
		uniqueFileName := uniqueFileNames[i]
		h.logger.Info("processing image", "originalFileName", originalFileName, "uniqueFileName", uniqueFileName, "path", imagePath)

		// Process single image with unique filename
		metadata, err := image.CopyImageToCache(imagePath, cacheDir, thumbnailsDir, uniqueFileName)
		if err != nil {
			h.logger.Error("failed to process image", "originalFileName", originalFileName, "uniqueFileName", uniqueFileName, "error", err)
			// Emit error event
			if h.server != nil {
				h.server.BroadcastEvent(&Event{
					Type: EventImageError,
					Payload: map[string]interface{}{
						"originalFileName": originalFileName,
						"uniqueFileName":   uniqueFileName,
						"error":            err.Error(),
					},
				})
			}
			continue
		}

		// Create smart multi-resolution thumbnails based on connected monitors
		var thumbnailPaths map[string]string
		if h.monitorManager != nil {
			// Get connected monitors
			monitors := h.monitorManager.GetMonitors()

			// Convert to MonitorResolution format
			var monitorResolutions []image.MonitorResolution
			for _, monitor := range monitors {
				monitorResolutions = append(monitorResolutions, image.MonitorResolution{
					Width:  monitor.Width,
					Height: monitor.Height,
					Name:   monitor.Name,
				})
			}

			// Get required resolutions based on monitors
			requiredResolutions := image.GetRequiredResolutions(monitorResolutions)
			h.logger.Debug("Creating thumbnails for resolutions", "resolutions", requiredResolutions, "monitors", len(monitors))

			// Create smart thumbnails
			thumbnailPaths, err = image.CreateSmartMultiResolutionThumbnails(
				filepath.Join(cacheDir, uniqueFileName),
				thumbnailsDir,
				uniqueFileName,
				requiredResolutions,
			)
			if err != nil {
				h.logger.Warn("failed to create smart multi-resolution thumbnails", "uniqueFileName", uniqueFileName, "error", err)
				// Fallback to creating all resolutions if smart creation fails
				thumbnailPaths, err = image.CreateMultiResolutionThumbnails(
					filepath.Join(cacheDir, uniqueFileName),
					thumbnailsDir,
					uniqueFileName,
				)
				if err != nil {
					h.logger.Warn("failed to create fallback multi-resolution thumbnails", "uniqueFileName", uniqueFileName, "error", err)
				}
			}
		} else {
			// Fallback to creating all resolutions if no monitor manager
			thumbnailPaths, err = image.CreateMultiResolutionThumbnails(
				filepath.Join(cacheDir, uniqueFileName),
				thumbnailsDir,
				uniqueFileName,
			)
			if err != nil {
				h.logger.Warn("failed to create multi-resolution thumbnails", "uniqueFileName", uniqueFileName, "error", err)
			}
		}

		metadataList = append(metadataList, metadata)

		// Store image in JSON store with sequential ID
		var imageID string
		if h.store != nil {
			// Use JSON store with sequential IDs
			// Convert thumbnail paths to store format
			var storeThumbnails store.ImageThumbnails
			if thumbnailPaths != nil {
				storeThumbnails = store.ImageThumbnails{
					Resolution720p:  thumbnailPaths["720p"],
					Resolution1080p: thumbnailPaths["1080p"],
					Resolution1440p: thumbnailPaths["1440p"],
					Resolution4k:    thumbnailPaths["4k"],
					Fallback:        thumbnailPaths["fallback"],
				}
			}

			storeImage := &store.Image{
				Name:      uniqueFileName,
				Path:      filepath.Join(cacheDir, uniqueFileName),
				MediaType: media.MediaTypeImage, // Default to image type
				Metadata: store.ImageMetadata{
					Format:   metadata.Format,
					FileSize: 0,  // Will be calculated by AddImage
					Checksum: "", // Will be calculated by AddImage
				},
				Dimensions: store.ImageDimensions{
					Width:  int64(metadata.Width),
					Height: int64(metadata.Height),
				},
				Selection: store.ImageSelection{
					IsChecked:  true,
					IsSelected: false,
				},
				ImportInfo: store.ImageImportInfo{
					ImportedAt: time.Now(),
					Importer:   "manual",
				},
				Thumbnails: storeThumbnails,
			}

			imageStore := store.NewImageStore(h.store)
			if err := imageStore.AddImage(storeImage); err != nil {
				h.logger.Error("failed to store image in JSON store", "originalFileName", originalFileName, "uniqueFileName", uniqueFileName, "error", err)
				// Emit error event
				if h.server != nil {
					h.server.BroadcastEvent(&Event{
						Type: EventImageError,
						Payload: map[string]interface{}{
							"originalFileName": originalFileName,
							"uniqueFileName":   uniqueFileName,
							"error":            "failed to store in JSON store: " + err.Error(),
						},
					})
				}
				continue
			}

			imageID = fmt.Sprintf("%d", storeImage.ID)
			h.logger.Info("stored image in JSON store", "originalFileName", originalFileName, "uniqueFileName", uniqueFileName, "id", imageID)
		} else {
			// Fallback to SQLite if JSON store not available
			img := db.Image{
				Name:       uniqueFileName,
				Width:      int64(metadata.Width),
				Height:     int64(metadata.Height),
				Format:     metadata.Format,
				Ischecked:  1,
				Isselected: 0,
			}

			sqliteImageID, err := h.dbQueries.CreateImage(ctx, db.CreateImageParams{
				Name:       img.Name,
				Ischecked:  img.Ischecked,
				Isselected: img.Isselected,
				Width:      img.Width,
				Height:     img.Height,
				Format:     img.Format,
			})
			if err != nil {
				h.logger.Error("failed to store image in SQLite database", "originalFileName", originalFileName, "uniqueFileName", uniqueFileName, "error", err)
				// Emit error event
				if h.server != nil {
					h.server.BroadcastEvent(&Event{
						Type: EventImageError,
						Payload: map[string]interface{}{
							"originalFileName": originalFileName,
							"uniqueFileName":   uniqueFileName,
							"error":            "failed to store in SQLite: " + err.Error(),
						},
					})
				}
				continue
			}

			imageID = fmt.Sprintf("%d", sqliteImageID.ID)
			h.logger.Info("stored image in SQLite", "originalFileName", originalFileName, "uniqueFileName", uniqueFileName, "id", imageID)
		}

		// Note: imagesToStore is no longer used since we're storing directly in JSON store

		// Emit success event
		if h.server != nil {
			h.server.BroadcastEvent(&Event{
				Type: EventImageProcessed,
				Payload: map[string]interface{}{
					"id":               imageID,
					"originalFileName": originalFileName,
					"uniqueFileName":   uniqueFileName,
					"width":            metadata.Width,
					"height":           metadata.Height,
					"format":           metadata.Format,
				},
			})
		}
	}

	// Emit completion event
	if h.server != nil {
		h.server.BroadcastEvent(&Event{
			Type: EventProcessingComplete,
			Payload: map[string]interface{}{
				"totalProcessed": len(metadataList),
				"totalRequested": len(msg.ImagePaths),
			},
		})

		// Emit images updated event if any images were processed
		if len(metadataList) > 0 {
			h.server.BroadcastEvent(&Event{
				Type: "images_updated",
				Payload: map[string]interface{}{
					"totalAdded": len(metadataList),
				},
			})
		}
	}

	response := &Response{Action: msg.Action, Data: metadataList}
	return response
}

func (h *Handler) handleCreateThumbnail(msg *Message) *Response {
	// Create thumbnail for a single image
	if len(msg.ImagePaths) == 0 {
		response := &Response{Action: msg.Action, Error: errors.New(errors.IPCError, "image path is required").Error()}
		return response
	}

	inputPath := msg.ImagePaths[0]
	fileName := msg.FileNames[0]
	if fileName == "" {
		fileName = filepath.Base(inputPath)
	}

	// Use smart resolution selection based on connected monitors
	var thumbnailPaths map[string]string
	if h.monitorManager != nil {
		// Get connected monitors
		monitors := h.monitorManager.GetMonitors()

		// Convert to MonitorResolution format
		var monitorResolutions []image.MonitorResolution
		for _, monitor := range monitors {
			monitorResolutions = append(monitorResolutions, image.MonitorResolution{
				Width:  monitor.Width,
				Height: monitor.Height,
				Name:   monitor.Name,
			})
		}

		// Get required resolutions based on monitors
		requiredResolutions := image.GetRequiredResolutions(monitorResolutions)
		h.logger.Debug("Creating thumbnails for resolutions", "resolutions", requiredResolutions, "image", fileName)

		// Create smart thumbnails
		cfg, err := h.configManager.GetConfig()
		if err != nil {
			h.logger.Error("failed to get config for thumbnail creation", "error", err)
			response := &Response{Action: msg.Action, Error: err.Error()}
			return response
		}

		thumbnailPaths, err = image.CreateSmartMultiResolutionThumbnails(
			inputPath,
			cfg.Daemon.ThumbnailsDir,
			fileName,
			requiredResolutions,
		)
		if err != nil {
			h.logger.Error("failed to create smart multi-resolution thumbnails", "error", err, "image", fileName)
			response := &Response{Action: msg.Action, Error: err.Error()}
			return response
		}
	} else {
		// Fallback to creating all resolutions if no monitor manager
		cfg, err := h.configManager.GetConfig()
		if err != nil {
			h.logger.Error("failed to get config for thumbnail creation", "error", err)
			response := &Response{Action: msg.Action, Error: err.Error()}
			return response
		}

		thumbnailPaths, err = image.CreateMultiResolutionThumbnails(
			inputPath,
			cfg.Daemon.ThumbnailsDir,
			fileName,
		)
		if err != nil {
			h.logger.Error("failed to create multi-resolution thumbnails", "error", err, "image", fileName)
			response := &Response{Action: msg.Action, Error: err.Error()}
			return response
		}
	}

	// Send thumbnail_created event to frontend
	if h.server != nil {
		h.server.BroadcastEvent(&types.Event{
			Type: "thumbnail_created",
			Payload: map[string]interface{}{
				"imageName":  fileName,
				"thumbnails": thumbnailPaths,
				"timestamp":  time.Now().Unix(),
			},
		})
	}

	h.logger.Info("Successfully created thumbnails", "image", fileName, "resolutions", len(thumbnailPaths))

	response := &Response{Action: msg.Action, Data: thumbnailPaths}
	return response
}

func (h *Handler) handleDeleteImageFromCache(msg *Message) *Response {
	// Delete image and thumbnail from cache
	if len(msg.FileNames) == 0 {
		response := &Response{Action: msg.Action, Error: errors.New(errors.IPCError, "file names are required").Error()}
		return response
	}

	if msg.CacheDir == "" || msg.ThumbnailsDir == "" {
		response := &Response{Action: msg.Action, Error: errors.New(errors.IPCError, "cache directory and thumbnails directory are required").Error()}
		return response
	}

	for _, fileName := range msg.FileNames {
		err := image.DeleteImageFromCache(fileName, msg.CacheDir, msg.ThumbnailsDir)
		if err != nil {
			h.logger.Error("failed to delete image from cache", "error", err, "fileName", fileName)
			// Continue with other files
		}
	}

	response := &Response{Action: msg.Action, Data: "images deleted from cache"}
	return response
}

func (h *Handler) handleGetActivePlaylist(msg *Message) *Response {
	// This would get the active playlist
	// For now, return a placeholder
	return &Response{Action: msg.Action, Data: "get active playlist placeholder"}
}

func (h *Handler) handleSavePlaylist(msg *Message) *Response {
	ctx := context.Background()

	// Validate input
	if msg.Playlist == nil {
		return &Response{
			Action: msg.Action,
			Error:  errors.New(errors.IPCError, "playlist data is required").Error(),
		}
	}

	if msg.Playlist.Name == "" {
		return &Response{
			Action: msg.Action,
			Error:  errors.New(errors.IPCError, "playlist name is required").Error(),
		}
	}

	h.logger.Info("saving playlist", "name", msg.Playlist.Name, "type", msg.Playlist.Configuration.Type, "images", len(msg.Playlist.Images))

	// Convert frontend playlist configuration to database playlist
	playlist := db.Playlist{
		Name: msg.Playlist.Name,
		Type: msg.Playlist.Configuration.Type,
	}

	// Handle optional interval
	if msg.Playlist.Configuration.Interval != nil {
		playlist.Interval = sql.NullInt64{Int64: *msg.Playlist.Configuration.Interval, Valid: true}
	}

	// Handle optional order
	if msg.Playlist.Configuration.Order != nil {
		playlist.Order = sql.NullString{String: *msg.Playlist.Configuration.Order, Valid: true}
	}

	// Convert boolean to int64 for database
	if msg.Playlist.Configuration.ShowAnimations {
		playlist.Showanimations = 1
	} else {
		playlist.Showanimations = 0
	}

	if msg.Playlist.Configuration.AlwaysStartOnFirstImage {
		playlist.Alwaysstartonfirstimage = 1
	} else {
		playlist.Alwaysstartonfirstimage = 0
	}

	playlist.Currentimageindex = msg.Playlist.Configuration.CurrentImageIndex

	// First, upsert the playlist
	playlistID, err := h.dbQueries.UpsertPlaylist(ctx, db.UpsertPlaylistParams{
		Name:                    playlist.Name,
		Type:                    playlist.Type,
		Interval:                playlist.Interval,
		Showanimations:          playlist.Showanimations,
		Alwaysstartonfirstimage: playlist.Alwaysstartonfirstimage,
		Order:                   playlist.Order,
		Currentimageindex:       playlist.Currentimageindex,
	})
	if err != nil {
		h.logger.Error("failed to upsert playlist", "error", err, "name", playlist.Name)
		return &Response{
			Action: msg.Action,
			Error:  errors.New(errors.DatabaseError, "failed to save playlist").WithDetails(map[string]interface{}{"error": err.Error()}).Error(),
		}
	}

	// Delete existing playlist images
	if err := h.dbQueries.DeletePlaylistImages(ctx, playlistID); err != nil {
		h.logger.Error("failed to delete existing playlist images", "error", err)
		return &Response{
			Action: msg.Action,
			Error:  errors.New(errors.DatabaseError, "failed to update playlist images").Error(),
		}
	}

	// Insert new playlist images with time support
	for i, rendererImg := range msg.Playlist.Images {
		// Verify image exists in database
		_, err := h.dbOps.GetImage(ctx, rendererImg.ID)
		if err != nil {
			h.logger.Error("failed to get image for playlist", "imageID", rendererImg.ID, "error", err)
			return &Response{
				Action: msg.Action,
				Error:  errors.New(errors.DatabaseError, fmt.Sprintf("image with ID %d not found", rendererImg.ID)).Error(),
			}
		}

		// Create playlist image params
		params := db.InsertPlaylistImageParams{
			Imageid:         rendererImg.ID,
			Playlistid:      playlistID,
			Indexinplaylist: int64(i),
		}

		// Set time if provided (for time-of-day playlists)
		if rendererImg.Time != nil {
			params.Time = sql.NullInt64{Int64: *rendererImg.Time, Valid: true}
		}

		// Insert the playlist image
		if err := h.dbQueries.InsertPlaylistImage(ctx, params); err != nil {
			h.logger.Error("failed to insert playlist image", "error", err, "imageID", rendererImg.ID)
			return &Response{
				Action: msg.Action,
				Error:  errors.New(errors.DatabaseError, "failed to add images to playlist").Error(),
			}
		}
	}

	h.logger.Info("playlist saved successfully", "name", playlist.Name, "id", playlistID, "images", len(msg.Playlist.Images))

	// Emit playlists updated event
	if h.server != nil {
		h.server.BroadcastEvent(&Event{
			Type: "playlists_updated",
			Payload: map[string]interface{}{
				"action":       "saved",
				"playlistId":   playlistID,
				"playlistName": playlist.Name,
			},
		})
	}

	// Return success with playlist ID
	return &Response{
		Action: msg.Action,
		Data: map[string]interface{}{
			"id":      playlistID,
			"name":    playlist.Name,
			"message": "playlist saved successfully",
		},
	}
}

func (h *Handler) handleGetImageSrc(msg *Message) *Response {
	if len(msg.FileNames) == 0 {
		response := &Response{Action: msg.Action, Error: errors.New(errors.IPCError, "file name is required").Error()}
		return response
	}

	fileName := msg.FileNames[0]

	// Try to get image from JSON store first (new system with full paths)
	if h.store != nil {
		registry, err := h.store.LoadImageRegistry()
		if err == nil && registry != nil {
			// Extract basename in case fileName is a full path
			fileNameBase := filepath.Base(fileName)

			// Search for image by name (both trying original fileName and basename)
			// This handles cases where frontend passes full paths from monitor.currentImage
			for _, image := range registry.Images {
				if image.Name == fileName || image.Name == fileNameBase {
					// Validate that the file actually exists
					if _, err := os.Stat(image.Path); err == nil {
						// Return clean file path (electron will add atom:// protocol)
						response := &Response{Action: msg.Action, Data: image.Path}
						return response
					} else {
						h.logger.Warn("Image file not found, skipping", "path", image.Path, "name", fileName, "searched_name", image.Name)
					}
				}
			}
		}
	}

	// Fallback to old system: construct path from images directory
	config, err := h.configManager.GetConfig()
	if err != nil {
		response := &Response{Action: msg.Action, Error: errors.New(errors.IPCError, "failed to get configuration").Error()}
		return response
	}

	imagePath := filepath.Join(config.Daemon.ImagesDir, fileName)

	// Validate that the file exists
	if _, err := os.Stat(imagePath); err != nil {
		h.logger.Warn("Image file not found in fallback path", "path", imagePath, "name", fileName)
		response := &Response{Action: msg.Action, Error: errors.New(errors.IPCError, "image file not found").Error()}
		return response
	}

	// Return clean file path (electron will add atom:// protocol)
	response := &Response{Action: msg.Action, Data: imagePath}
	return response
}

func (h *Handler) handleGetThumbnailSrc(msg *Message) *Response {
	if len(msg.FileNames) == 0 {
		response := &Response{Action: msg.Action, Error: errors.New(errors.IPCError, "file name is required").Error()}
		return response
	}

	fileName := msg.FileNames[0]

	// Try to get image from JSON store first (new system with full paths)
	if h.store != nil {
		registry, err := h.store.LoadImageRegistry()
		if err == nil && registry != nil {
			// Extract basename in case fileName is a full path
			fileNameBase := filepath.Base(fileName)

			// Search for image by name (both trying original fileName and basename)
			// This handles cases where frontend passes full paths from monitor.currentImage
			for _, img := range registry.Images {
				if img.Name == fileName || img.Name == fileNameBase {
					// Generate thumbnail path based on the full image path
					thumbnailName := strings.TrimSuffix(filepath.Base(img.Path), filepath.Ext(img.Path)) + ".webp"

					// Get thumbnails directory from configuration
					config, err := h.configManager.GetConfig()
					if err != nil {
						response := &Response{Action: msg.Action, Error: errors.New(errors.IPCError, "failed to get configuration").Error()}
						return response
					}

					thumbnailPath := filepath.Join(config.Daemon.ThumbnailsDir, thumbnailName)

					// Validate that the thumbnail exists
					if _, err := os.Stat(thumbnailPath); err == nil {
						// Return clean file path (electron will add atom:// protocol)
						response := &Response{Action: msg.Action, Data: thumbnailPath}
						return response
					} else {
						h.logger.Warn("Thumbnail file not found, attempting to generate", "path", thumbnailPath, "name", fileName, "searched_name", img.Name)

						// Try to generate thumbnail on-demand
						if _, err := os.Stat(img.Path); err == nil {
							// Ensure thumbnails directory exists
							if err := os.MkdirAll(filepath.Dir(thumbnailPath), 0755); err != nil {
								h.logger.Error("Failed to create thumbnails directory", "error", err)
							} else {
								// Generate thumbnail
								opts := image.DefaultThumbnailOptions()
								_, err := image.CreateThumbnail(img.Path, thumbnailPath, opts)
								if err != nil {
									h.logger.Error("Failed to generate thumbnail", "error", err, "image", img.Path, "thumbnail", thumbnailPath)
								} else {
									h.logger.Info("Generated thumbnail on-demand", "image", img.Path, "thumbnail", thumbnailPath)
									// Return the newly created thumbnail path
									response := &Response{Action: msg.Action, Data: thumbnailPath}
									return response
								}
							}
						} else {
							h.logger.Warn("Source image file not found, cannot generate thumbnail", "path", img.Path)
						}
					}
				}
			}
		}
	}

	// Fallback to old system: construct thumbnail path from images directory
	config, err := h.configManager.GetConfig()
	if err != nil {
		response := &Response{Action: msg.Action, Error: errors.New(errors.IPCError, "failed to get configuration").Error()}
		return response
	}

	thumbnailName := strings.TrimSuffix(fileName, filepath.Ext(fileName)) + ".webp"
	thumbnailPath := filepath.Join(config.Daemon.ThumbnailsDir, thumbnailName)

	// Validate that the thumbnail exists
	if _, err := os.Stat(thumbnailPath); err != nil {
		h.logger.Warn("Thumbnail file not found in fallback path, attempting to generate", "path", thumbnailPath, "name", fileName)

		// Try to generate thumbnail on-demand
		imagePath := filepath.Join(config.Daemon.ImagesDir, fileName)
		if _, err := os.Stat(imagePath); err == nil {
			// Ensure thumbnails directory exists
			if err := os.MkdirAll(filepath.Dir(thumbnailPath), 0755); err != nil {
				h.logger.Error("Failed to create thumbnails directory", "error", err)
				response := &Response{Action: msg.Action, Error: errors.New(errors.IPCError, "failed to create thumbnails directory").Error()}
				return response
			}

			// Generate thumbnail
			opts := image.DefaultThumbnailOptions()
			_, err := image.CreateThumbnail(imagePath, thumbnailPath, opts)
			if err != nil {
				h.logger.Error("Failed to generate thumbnail", "error", err, "image", imagePath, "thumbnail", thumbnailPath)
				response := &Response{Action: msg.Action, Error: errors.New(errors.IPCError, "failed to generate thumbnail").Error()}
				return response
			}

			h.logger.Info("Generated thumbnail on-demand", "image", imagePath, "thumbnail", thumbnailPath)
		} else {
			h.logger.Warn("Source image file not found, cannot generate thumbnail", "path", imagePath)
			response := &Response{Action: msg.Action, Error: errors.New(errors.IPCError, "thumbnail file not found").Error()}
			return response
		}
	}

	// Return clean file path (electron will add atom:// protocol)
	response := &Response{Action: msg.Action, Data: thumbnailPath}
	return response
}

func (h *Handler) handleGetMonitorImage(msg *Message) *Response {
	if msg.MonitorName == "" {
		response := &Response{Action: msg.Action, Error: errors.New(errors.IPCError, "monitor name is required").Error()}
		return response
	}

	// Get the monitor-specific image path
	imagePath, err := h.monitorManager.GetMonitorImagePath(msg.MonitorName)
	if err != nil {
		h.logger.Error("failed to get monitor image path", "monitor", msg.MonitorName, "error", err)
		response := &Response{Action: msg.Action, Error: err.Error()}
		return response
	}

	// Validate that the file exists
	if _, err := os.Stat(imagePath); err != nil {
		h.logger.Warn("Monitor image file not found", "path", imagePath, "monitor", msg.MonitorName)
		response := &Response{Action: msg.Action, Error: errors.New(errors.IPCError, "monitor image file not found").Error()}
		return response
	}

	// Return clean file path (electron will add atom:// protocol)
	response := &Response{Action: msg.Action, Data: imagePath}
	return response
}

func (h *Handler) handleOpenContextMenu(msg *Message) *Response {
	// For now, just return success - the context menu will be handled by Electron
	// The Go daemon doesn't need to implement the actual context menu logic
	// since Electron handles the UI part
	h.logger.Info("context menu requested", "image", msg.Image, "selectedImagesLength", msg.SelectedImagesLength)

	response := &Response{Action: msg.Action, Data: "context_menu_opened"}
	return response
}

// listenToPlaylistEvents listens to playlist manager events and broadcasts them to clients
func (h *Handler) listenToPlaylistEvents() {
	h.logger.Info("playlist event listener disabled (stub implementation)")
	// Event channel is closed immediately, so this function does nothing
	for range h.playlistManager.GetEventChan() {
		// No-op: channel is already closed
	}
}

// handleKillDaemon handles the kill daemon command
func (h *Handler) handleKillDaemon(msg *Message) *Response {
	h.logger.Info("kill daemon requested")
	// For now, just return success - actual daemon termination will be handled by the main process
	response := &Response{Action: msg.Action, Data: "daemon_kill_requested"}
	return response
}

// handleStopPlaylistByName handles stopping a playlist by name
func (h *Handler) handleStopPlaylistByName(msg *Message) *Response {
	playlistName := msg.PlaylistName
	if playlistName == "" {
		response := &Response{Action: msg.Action, Error: errors.New(errors.IPCError, "playlist name is required").Error()}
		return response
	}

	h.logger.Info("stopping playlist by name", "playlist", playlistName)
	err := h.playlistManager.StopPlaylistByName(playlistName)
	if err != nil {
		h.logger.Error("failed to stop playlist by name", "playlist", playlistName, "error", err)
		response := &Response{Action: msg.Action, Error: err.Error()}
		return response
	}

	response := &Response{Action: msg.Action, Data: "playlist stopped by name"}
	return response
}

// handleStopPlaylistByMonitorName handles stopping playlists by monitor name
func (h *Handler) handleStopPlaylistByMonitorName(msg *Message) *Response {
	monitors := msg.Monitors
	if len(monitors) == 0 {
		response := &Response{Action: msg.Action, Error: errors.New(errors.IPCError, "monitors are required").Error()}
		return response
	}

	h.logger.Info("stopping playlists by monitor name", "monitors", monitors)
	// Stop playlist for each monitor
	for _, monitorName := range monitors {
		err := h.playlistManager.StopPlaylistByMonitorName(monitorName)
		if err != nil {
			h.logger.Error("failed to stop playlist for monitor", "monitor", monitorName, "error", err)
		}
	}

	response := &Response{Action: msg.Action, Data: "playlists stopped by monitor name"}
	return response
}

// handleStopPlaylistOnRemovedMonitors handles stopping playlists on removed monitors
func (h *Handler) handleStopPlaylistOnRemovedMonitors(msg *Message) *Response {
	h.logger.Info("stopping playlists on removed monitors")
	monitors := msg.Monitors
	if monitors == nil {
		monitors = []string{}
	}
	err := h.playlistManager.StopPlaylistOnRemovedMonitors(monitors)
	if err != nil {
		h.logger.Error("failed to stop playlists on removed monitors", "error", err)
		response := &Response{Action: msg.Action, Error: err.Error()}
		return response
	}

	response := &Response{Action: msg.Action, Data: "playlists stopped on removed monitors"}
	return response
}
