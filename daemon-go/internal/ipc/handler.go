package ipc

import (
	"context"
	"fmt"
	"log/slog"
	"os"
	"path/filepath"
	"time"

	"waypaper-engine/daemon-go/internal/config"
	"waypaper-engine/daemon-go/internal/errors"
	"waypaper-engine/daemon-go/internal/image"
	"waypaper-engine/daemon-go/internal/models"
	"waypaper-engine/daemon-go/internal/monitor"
	"waypaper-engine/daemon-go/internal/playlist"
	"waypaper-engine/daemon-go/internal/store"
	"waypaper-engine/daemon-go/internal/system"
)

// Handler is the implementation of the MessageHandler interface.
type Handler struct {
	playlistManager *playlist.Manager
	configManager   *config.ConfigManager
	imageProcessor  *image.Processor
	monitorManager  *monitor.Manager
	logger          *slog.Logger
	server          *Server
	store           *store.Store
	jsonStore       *store.JsonStoreManager
}

// NewHandler creates a new message handler.
func NewHandler(playlistManager *playlist.Manager, configManager *config.ConfigManager, imageProcessor *image.Processor, monitorManager *monitor.Manager, logger *slog.Logger) *Handler {
	return &Handler{
		playlistManager: playlistManager,
		configManager:   configManager,
		imageProcessor:  imageProcessor,
		monitorManager:  monitorManager,
		store:           nil, // Will be set later if JSON store is available
		logger:          logger,
	}
}

// SetStore sets the JSON store for the handler
func (h *Handler) SetStore(s *store.Store) {
	h.store = s
	h.jsonStore = store.NewJsonStoreManager(s, h.logger)
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

	// Configuration
	case "get_config":
		response = h.handleGetConfig(msg)
	case "set_config":
		response = h.handleSetConfig(msg)
	case "get_swww_config":
		response = h.handleGetSwwwConfig(msg)

	// System
	case "stop_daemon":
		response = h.handleStopDaemon(msg)
	case "kill_daemon":
		response = h.handleKillDaemon(msg)
		// We should recollect some useful information, this is currently a placeholder.
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
	// Handle stopping by playlist name
	if msg.PlaylistName != "" {
		h.logger.Info("stopping playlist by name", "playlist", msg.PlaylistName)
		err := h.playlistManager.StopPlaylistByName(msg.PlaylistName)
		if err != nil {
			h.logger.Error("failed to stop playlist by name", "playlist", msg.PlaylistName, "error", err)
			return &Response{Action: msg.Action, Error: err.Error()}
		}
		return &Response{Action: msg.Action, Data: "playlist stopped by name"}
	}

	// Handle stopping by multiple monitor names
	if len(msg.Monitors) > 0 {
		h.logger.Info("stopping playlists by monitor names", "monitors", msg.Monitors)
		for _, monitorName := range msg.Monitors {
			err := h.playlistManager.StopPlaylistByMonitorName(monitorName)
			if err != nil {
				h.logger.Error("failed to stop playlist for monitor", "monitor", monitorName, "error", err)
			}
		}
		return &Response{Action: msg.Action, Data: "playlists stopped by monitor names"}
	}

	// Check if this is a bulk operation (all monitors)
	if msg.ActiveMonitor != nil && msg.ActiveMonitor.Name == "*" {
		// Get all monitors and stop playlists on each
		monitors := h.monitorManager.GetMonitors()
		var errors []string

		for _, monitor := range monitors {
			err := h.playlistManager.StopPlaylist(monitor.Name)
			if err != nil {
				h.logger.Error("failed to stop playlist on monitor", "monitor", monitor.Name, "error", err)
				errors = append(errors, fmt.Sprintf("monitor %s: %v", monitor.Name, err))
			}
		}

		if len(errors) > 0 {
			return &Response{Action: msg.Action, Error: fmt.Sprintf("some operations failed: %v", errors)}
		}

		return &Response{Action: msg.Action, Data: "stopped playlists on all monitors"}
	}

	// Handle stopping by single monitor name (original behavior)
	if msg.ActiveMonitor == nil {
		return &Response{Action: msg.Action, Error: errors.New(errors.IPCError, "missing monitor info, playlist name, or monitor names").Error()}
	}

	err := h.playlistManager.StopPlaylist(msg.ActiveMonitor.Name)
	if err != nil {
		h.logger.Error("failed to stop playlist", "error", err)
		return &Response{Action: msg.Action, Error: err.Error()}
	}

	return &Response{Action: msg.Action, Data: "playlist stopped"}
}

func (h *Handler) handlePausePlaylist(msg *Message) *Response {
	// Check if this is a bulk operation (all monitors)
	if msg.ActiveMonitor != nil && msg.ActiveMonitor.Name == "*" {
		// Get all monitors and pause playlists on each
		monitors := h.monitorManager.GetMonitors()
		var errors []string

		for _, monitor := range monitors {
			err := h.playlistManager.PausePlaylist(monitor.Name)
			if err != nil {
				h.logger.Error("failed to pause playlist on monitor", "monitor", monitor.Name, "error", err)
				errors = append(errors, fmt.Sprintf("monitor %s: %v", monitor.Name, err))
			}
		}

		if len(errors) > 0 {
			return &Response{Action: msg.Action, Error: fmt.Sprintf("some operations failed: %v", errors)}
		}

		return &Response{Action: msg.Action, Data: "paused playlists on all monitors"}
	}

	// Single monitor operation (original behavior)
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
	// Check if this is a bulk operation (all monitors)
	if msg.ActiveMonitor != nil && msg.ActiveMonitor.Name == "*" {
		// Get all monitors and resume playlists on each
		monitors := h.monitorManager.GetMonitors()
		var errors []string

		for _, monitor := range monitors {
			err := h.playlistManager.ResumePlaylist(monitor.Name)
			if err != nil {
				h.logger.Error("failed to resume playlist on monitor", "monitor", monitor.Name, "error", err)
				errors = append(errors, fmt.Sprintf("monitor %s: %v", monitor.Name, err))
			}
		}

		if len(errors) > 0 {
			return &Response{Action: msg.Action, Error: fmt.Sprintf("some operations failed: %v", errors)}
		}

		return &Response{Action: msg.Action, Data: "resumed playlists on all monitors"}
	}

	// Single monitor operation (original behavior)
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
	// Check if this is a bulk operation (all monitors)
	if msg.ActiveMonitor != nil && msg.ActiveMonitor.Name == "*" {
		// Get all monitors and advance to next image on each
		monitors := h.monitorManager.GetMonitors()
		var errors []string

		for _, monitor := range monitors {
			err := h.playlistManager.NextImage(context.Background(), monitor.Name)
			if err != nil {
				h.logger.Error("failed to advance image on monitor", "monitor", monitor.Name, "error", err)
				errors = append(errors, fmt.Sprintf("monitor %s: %v", monitor.Name, err))
			}
		}

		if len(errors) > 0 {
			return &Response{Action: msg.Action, Error: fmt.Sprintf("some operations failed: %v", errors)}
		}

		return &Response{Action: msg.Action, Data: "advanced images on all monitors"}
	}

	// Single monitor operation (original behavior)
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
	// Check if this is a bulk operation (all monitors)
	if msg.ActiveMonitor != nil && msg.ActiveMonitor.Name == "*" {
		// Get all monitors and go to previous image on each
		monitors := h.monitorManager.GetMonitors()
		var errors []string

		for _, monitor := range monitors {
			err := h.playlistManager.PreviousImage(context.Background(), monitor.Name)
			if err != nil {
				h.logger.Error("failed to go to previous image on monitor", "monitor", monitor.Name, "error", err)
				errors = append(errors, fmt.Sprintf("monitor %s: %v", monitor.Name, err))
			}
		}

		if len(errors) > 0 {
			return &Response{Action: msg.Action, Error: fmt.Sprintf("some operations failed: %v", errors)}
		}

		return &Response{Action: msg.Action, Data: "went to previous images on all monitors"}
	}

	// Single monitor operation (original behavior)
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
	// Get the image from store to construct the full path
	registry, err := h.store.LoadImageRegistry()
	if err != nil {
		h.logger.Error("failed to load image registry for monitor state update", "error", err)
		// Don't fail the operation if we can't update monitor state
	} else {
		var image *store.Image
		for _, img := range registry.Images {
			if img.ID == msg.Image.ID {
				image = &img
				break
			}
		}

		if image != nil {
			err = h.monitorManager.SetWallpaperForMonitorWithName(context.Background(), []byte(image.Path), msg.ActiveMonitor.Name, filepath.Base(image.Path))
			if err != nil {
				h.logger.Error("failed to update monitor state", "error", err)
			} else {
				h.logger.Debug("updated monitor state", "monitor", msg.ActiveMonitor.Name, "image", filepath.Base(image.Path))
			}
		}
	}

	return &Response{Action: msg.Action, Data: "image changed"}
}

func (h *Handler) handleRandomImage(msg *Message) *Response {
	// Check if this is a bulk operation (all monitors)
	if msg.ActiveMonitor != nil && msg.ActiveMonitor.Name == "*" {
		// Get all monitors and set random image on each
		monitors := h.monitorManager.GetMonitors()
		var errors []string

		for _, monitor := range monitors {
			err := h.playlistManager.RandomImage(context.Background(), monitor.Name)
			if err != nil {
				h.logger.Error("failed to set random image on monitor", "monitor", monitor.Name, "error", err)
				errors = append(errors, fmt.Sprintf("monitor %s: %v", monitor.Name, err))
			}
		}

		if len(errors) > 0 {
			return &Response{Action: msg.Action, Error: fmt.Sprintf("some operations failed: %v", errors)}
		}

		return &Response{Action: msg.Action, Data: "set random images on all monitors"}
	}

	// Single monitor operation (original behavior)
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
	info, err := system.GetInfo(context.Background(), h.jsonStore)
	if err != nil {
		h.logger.Error("failed to get info", "error", err)
		return &Response{Action: msg.Action, Error: err.Error()}
	}

	return &Response{Action: msg.Action, Data: info}
}

func (h *Handler) handleGetImages(msg *Message) *Response {
	// JSON-only mode: Get images from JSON store only
	h.logger.Info("handleGetImages: starting to get images")

	// Try to get images from JSON store
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

			// Return JSON images directly - frontend should align with JSON store schema
			h.logger.Info("handleGetImages: returning images from JSON store", "count", len(registry.Images))
			return &Response{Action: msg.Action, Data: registry.Images}
		}
		h.logger.Info("handleGetImages: no images found in JSON store")
		return &Response{Action: msg.Action, Data: []any{}}
	}

	// Fallback: return empty array if no store
	h.logger.Warn("handleGetImages: no JSON store available")
	return &Response{Action: msg.Action, Data: []any{}}
}

func (h *Handler) handleGetPlaylists(msg *Message) *Response {
	// Use JSON store for playlists
	if h.store != nil {
		playlistStore := store.NewPlaylistStore(h.store, h.logger)
		playlists, err := playlistStore.GetAllPlaylists()
		if err == nil && playlists != nil {
			h.logger.Info("handleGetPlaylists: found playlists in JSON store", "count", len(playlists))
			return &Response{Action: msg.Action, Data: playlists}
		}
		h.logger.Warn("handleGetPlaylists: no playlists found in JSON store or error loading", "error", err)
		return &Response{Action: msg.Action, Data: []interface{}{}}
	}

	// Fallback: return empty array if no store
	h.logger.Warn("handleGetPlaylists: no JSON store available")
	return &Response{Action: msg.Action, Data: []interface{}{}}
}

func (h *Handler) handlePing(msg *Message) *Response {
	h.logger.Debug("ping received", "messageId", msg.MessageID)
	return &Response{
		Action:    "pong",
		MessageID: msg.MessageID,
		Data:      "pong",
	}
}

// Image Operation Handlers

func (h *Handler) handleProcessForMonitors(msg *Message) *Response {
	if msg.Image == nil || msg.ActiveMonitor == nil {
		return h.createResponse(msg.Action, nil, errors.New(errors.IPCError, "image and activeMonitor are required"))
	}

	// Get image data from store
	registry, err := h.store.LoadImageRegistry()
	if err != nil {
		return h.createResponse(msg.Action, nil, errors.New(errors.SystemError, fmt.Sprintf("failed to load image registry: %v", err)))
	}

	var imageInfo *store.Image
	for _, img := range registry.Images {
		if img.ID == msg.Image.ID {
			imageInfo = &img
			break
		}
	}

	if imageInfo == nil {
		return h.createResponse(msg.Action, nil, errors.New(errors.SystemError, fmt.Sprintf("image with ID %d not found", msg.Image.ID)))
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

	// Read image file data
	imageData, err := os.ReadFile(imageInfo.Path)
	if err != nil {
		return h.createResponse(msg.Action, nil, errors.New(errors.SystemError, fmt.Sprintf("failed to read image file: %v", err)))
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
	imageInfo, err := h.jsonStore.GetImageByID(context.Background(), msg.Image.ID)
	if err != nil {
		return h.createResponse(msg.Action, nil, errors.New(errors.SystemError, fmt.Sprintf("failed to get image info: %v", err)))
	}

	// Read image file data
	imageData, err := os.ReadFile(imageInfo.Path)
	if err != nil {
		return h.createResponse(msg.Action, nil, errors.New(errors.SystemError, fmt.Sprintf("failed to read image file: %v", err)))
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
	imageInfo, err := h.jsonStore.GetImageByID(context.Background(), msg.Image.ID)
	if err != nil {
		return h.createResponse(msg.Action, nil, errors.New(errors.SystemError, fmt.Sprintf("failed to get image info: %v", err)))
	}

	// Read image file data
	imageData, err := os.ReadFile(imageInfo.Path)
	if err != nil {
		return h.createResponse(msg.Action, nil, errors.New(errors.SystemError, fmt.Sprintf("failed to read image file: %v", err)))
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
	// This handler is redundant with handleDeleteImageFromGallery
	// Redirect to the existing implementation
	return h.handleDeleteImageFromGallery(msg)
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
	history, err := h.jsonStore.GetImageHistory(ctx, historyLimit)
	if err != nil {
		h.logger.Error("failed to get image history", "error", err)
		return &Response{Action: msg.Action, Error: err.Error()}
	}

	return &Response{Action: msg.Action, Data: history}
}

// Configuration Handlers

func (h *Handler) handleGetConfig(msg *Message) *Response {
	config, err := h.configManager.LoadConfig()
	if err != nil {
		h.logger.Error("failed to load config", "error", err)
		return &Response{Action: msg.Action, Error: err.Error()}
	}

	// Convert to frontend-compatible format
	frontendConfig := map[string]interface{}{
		"app": map[string]interface{}{
			"kill_daemon_on_exit":         config.App.KillDaemonOnExit,
			"notifications":               config.App.Notifications,
			"start_minimized":             config.App.StartMinimized,
			"minimize_instead_of_close":   config.App.MinimizeInsteadOfClose,
			"random_image_monitor":        config.App.RandomImageMonitor,
			"show_monitor_modal_on_start": config.App.ShowMonitorModalOnStart,
			"images_per_page":             config.App.ImagesPerPage,
			"theme":                       config.App.Theme,
			"sidebar_collapsed":           config.App.SidebarCollapsed,
			"sort_by":                     config.App.SortBy,
			"sort_order":                  config.App.SortOrder,
			"image_history_limit":         config.App.ImageHistoryLimit,
		},
		"daemon": map[string]interface{}{
			"database_path":       config.Daemon.DatabasePath,
			"images_dir":          config.Daemon.ImagesDir,
			"thumbnails_dir":      config.Daemon.ThumbnailsDir,
			"monitors_state_file": config.Daemon.MonitorsStateFile,
			"socket_path":         config.Daemon.SocketPath,
			"log_level":           config.Daemon.LogLevel,
			"log_file":            config.Daemon.LogFile,
			"log_max_size":        config.Daemon.LogMaxSize,
			"log_max_age":         config.Daemon.LogMaxAge,
			"log_max_backups":     config.Daemon.LogMaxBackups,
			"compositor":          config.Daemon.Compositor,
		},
		"backend": map[string]interface{}{
			"type": config.Backend.Type,
			"swww": map[string]interface{}{
				"transition_type":     config.Backend.Swww.TransitionType,
				"transition_step":     config.Backend.Swww.TransitionStep,
				"transition_duration": config.Backend.Swww.TransitionDuration,
				"transition_angle":    config.Backend.Swww.TransitionAngle,
				"transition_pos":      config.Backend.Swww.TransitionPos,
				"transition_bezier":   config.Backend.Swww.TransitionBezier,
				"transition_wave":     config.Backend.Swww.TransitionWave,
			},
		},
		"monitors": map[string]interface{}{
			"selected_monitors": config.Monitors.SelectedMonitors,
			"image_set_type":    config.Monitors.ImageSetType,
		},
	}

	return &Response{Action: msg.Action, Data: frontendConfig}
}

func (h *Handler) handleSetConfig(msg *Message) *Response {
	if msg.Config == nil || msg.Config.ConfigSection == "" || msg.Config.ConfigKey == "" {
		return &Response{Action: msg.Action, Error: errors.New(errors.IPCError, "config section and key are required").Error()}
	}

	section := msg.Config.ConfigSection
	key := msg.Config.ConfigKey
	value := msg.Config.ConfigValue

	// Update the specific configuration value based on section
	var err error
	switch section {
	case "app":
		err = h.setAppConfigValue(key, value)
	case "daemon":
		err = h.setDaemonConfigValue(key, value)
	case "backend":
		err = h.setBackendConfigValue(key, value)
	case "monitors":
		err = h.setMonitorsConfigValue(key, value)
	default:
		return &Response{Action: msg.Action, Error: errors.New(errors.IPCError, "unknown config section: "+section).Error()}
	}

	if err != nil {
		h.logger.Error("failed to set config", "error", err, "section", section, "key", key, "value", value)
		return &Response{Action: msg.Action, Error: err.Error()}
	}

	h.logger.Info("config updated", "section", section, "key", key, "value", value)

	// Broadcast config change event to frontend
	if h.server != nil {
		h.server.BroadcastEvent(&Event{
			Type: "config_changed",
			Payload: map[string]interface{}{
				"section":   section,
				"key":       key,
				"value":     value,
				"timestamp": time.Now().Unix(),
			},
		})
	}

	return &Response{Action: msg.Action, Data: true}
}

// Helper methods for setting config values by section
func (h *Handler) setAppConfigValue(key string, value interface{}) error {
	return h.configManager.SetAppConfig(key, value)
}

func (h *Handler) setDaemonConfigValue(key string, value interface{}) error {
	// For daemon config, we need to update the TOML file directly
	// This is a simplified implementation - in practice, you'd want to reload the config
	config, err := h.configManager.LoadConfig()
	if err != nil {
		return err
	}

	switch key {
	case "database_path":
		if v, ok := value.(string); ok {
			config.Daemon.DatabasePath = v
		}
	case "images_dir":
		if v, ok := value.(string); ok {
			config.Daemon.ImagesDir = v
		}
	case "thumbnails_dir":
		if v, ok := value.(string); ok {
			config.Daemon.ThumbnailsDir = v
		}
	case "monitors_state_file":
		if v, ok := value.(string); ok {
			config.Daemon.MonitorsStateFile = v
		}
	case "socket_path":
		if v, ok := value.(string); ok {
			config.Daemon.SocketPath = v
		}
	case "log_level":
		if v, ok := value.(string); ok {
			config.Daemon.LogLevel = v
		}
	case "log_file":
		if v, ok := value.(string); ok {
			config.Daemon.LogFile = v
		}
	case "log_max_size":
		if v, ok := value.(int); ok {
			config.Daemon.LogMaxSize = v
		}
	case "log_max_age":
		if v, ok := value.(int); ok {
			config.Daemon.LogMaxAge = v
		}
	case "log_max_backups":
		if v, ok := value.(int); ok {
			config.Daemon.LogMaxBackups = v
		}
	case "compositor":
		if v, ok := value.(string); ok {
			config.Daemon.Compositor = v
		}
	default:
		return fmt.Errorf("unknown daemon config key: %s", key)
	}

	return h.configManager.SaveConfig()
}

func (h *Handler) setBackendConfigValue(key string, value interface{}) error {
	config, err := h.configManager.LoadConfig()
	if err != nil {
		return err
	}

	switch key {
	case "type":
		if v, ok := value.(string); ok {
			config.Backend.Type = v
		}
	case "swww.transition_type":
		if v, ok := value.(string); ok {
			config.Backend.Swww.TransitionType = v
		}
	case "swww.transition_step":
		if v, ok := value.(int); ok {
			config.Backend.Swww.TransitionStep = v
		}
	case "swww.transition_duration":
		if v, ok := value.(int); ok {
			config.Backend.Swww.TransitionDuration = v
		}
	case "swww.transition_angle":
		if v, ok := value.(int); ok {
			config.Backend.Swww.TransitionAngle = v
		}
	case "swww.transition_pos":
		if v, ok := value.(string); ok {
			config.Backend.Swww.TransitionPos = v
		}
	case "swww.transition_bezier":
		if v, ok := value.(string); ok {
			config.Backend.Swww.TransitionBezier = v
		}
	case "swww.transition_wave":
		if v, ok := value.(string); ok {
			config.Backend.Swww.TransitionWave = v
		}
	default:
		return fmt.Errorf("unknown backend config key: %s", key)
	}

	return h.configManager.SaveConfig()
}

func (h *Handler) setMonitorsConfigValue(key string, value interface{}) error {
	config, err := h.configManager.LoadConfig()
	if err != nil {
		return err
	}

	switch key {
	case "selected_monitors":
		if v, ok := value.([]string); ok {
			config.Monitors.SelectedMonitors = v
		}
	case "image_set_type":
		if v, ok := value.(string); ok {
			config.Monitors.ImageSetType = v
		}
	default:
		return fmt.Errorf("unknown monitors config key: %s", key)
	}

	return h.configManager.SaveConfig()
}

func (h *Handler) handleGetSwwwConfig(msg *Message) *Response {
	config := h.configManager.GetSwwwConfig()
	return &Response{Action: msg.Action, Data: config}
}

// System Handlers

func (h *Handler) handleStopDaemon(msg *Message) *Response {
	h.logger.Info("stop daemon requested")
	// For now, just return success - actual daemon termination will be handled by the main process
	response := &Response{Action: msg.Action, Data: "daemon_stop_requested"}
	return response
}

func (h *Handler) handleGetDaemonStatus(msg *Message) *Response {
	// Return basic daemon status information
	status := map[string]interface{}{
		"running":   true,
		"uptime":    "unknown", // Could be implemented with start time tracking
		"version":   "1.0.0",   // Could be read from build info
		"monitors":  len(h.monitorManager.GetMonitors()),
		"playlists": "unknown", // Could be implemented by counting active playlists
		"images":    "unknown", // Could be implemented by counting images in database
	}

	return &Response{Action: msg.Action, Data: status}
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

	// Get playlist from JSON store
	playlist, err := h.jsonStore.GetPlaylistByID(ctx, playlistID)
	if err != nil {
		h.logger.Error("failed to get playlist images", "error", err)
		response := &Response{Action: msg.Action, Error: err.Error()}
		return response
	}

	response := &Response{Action: msg.Action, Data: playlist.Images}
	return response
}

func (h *Handler) handleDeletePlaylist(msg *Message) *Response {
	// Delete playlist from JSON store
	ctx := context.Background()
	playlistName := msg.PlaylistName
	if playlistName == "" {
		response := &Response{Action: msg.Action, Error: errors.New(errors.IPCError, "playlist name is required").Error()}
		return response
	}

	// Get all playlists to find the one with matching name
	playlists, err := h.jsonStore.GetPlaylists(ctx)
	if err != nil {
		h.logger.Error("failed to get playlists", "error", err)
		response := &Response{Action: msg.Action, Error: err.Error()}
		return response
	}

	var playlistID int64
	for _, playlist := range playlists {
		if playlist.Name == playlistName {
			playlistID = playlist.ID
			break
		}
	}

	if playlistID == 0 {
		response := &Response{Action: msg.Action, Error: errors.New(errors.IPCError, "playlist not found").Error()}
		return response
	}

	err = h.jsonStore.DeletePlaylist(ctx, playlistID)
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
		image, err := h.jsonStore.GetImageByID(ctx, id)
		if err != nil {
			h.logger.Warn("failed to get image name for deletion", "imageID", id, "error", err)
			continue
		}
		imageNames = append(imageNames, image.Name)
	}

	// Delete from JSON store
	for _, id := range imageIDs {
		err := h.jsonStore.DeleteImage(ctx, id)
		if err != nil {
			h.logger.Error("failed to delete image from JSON store", "imageID", id, "error", err)
			// Continue with other images even if one fails
		}
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
	// Process images using parallel processing pipeline
	ctx := context.Background()

	h.logger.Info("handleProcessImages called with parallel processing", "imagePaths", msg.ImagePaths, "fileNames", msg.FileNames)

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

	// Determine required resolutions based on connected monitors
	var requiredResolutions []string
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
		requiredResolutions = image.GetRequiredResolutions(monitorResolutions)
		h.logger.Debug("Creating thumbnails for resolutions", "resolutions", requiredResolutions, "monitors", len(monitors))
	} else {
		// Fallback to all resolutions if no monitor manager
		requiredResolutions = []string{"720p", "1080p", "1440p", "4k", "fallback"}
	}

	// Create parallel image processing jobs
	var jobs []*image.ImageProcessingJob
	for i, imagePath := range msg.ImagePaths {
		job := &image.ImageProcessingJob{
			ImagePath:           imagePath,
			OriginalName:        msg.FileNames[i],
			UniqueName:          uniqueFileNames[i],
			RequiredResolutions: requiredResolutions,
		}
		jobs = append(jobs, job)
	}

	// Create parallel processor
	processor := image.NewParallelImageProcessor(cacheDir, thumbnailsDir, h.store, 4) // 4 workers

	// Process images in parallel
	h.logger.Info("starting parallel image processing", "totalImages", len(jobs), "workers", 4)
	results, err := processor.ProcessImagesInParallel(ctx, jobs)
	if err != nil {
		h.logger.Error("parallel image processing failed", "error", err)
		response := &Response{Action: msg.Action, Error: errors.New(errors.ImageError, fmt.Sprintf("parallel processing failed: %v", err)).Error()}
		return response
	}

	// Process results and emit events
	var successCount int
	var totalProcessingTime time.Duration
	var metadataList []*image.Metadata

	for _, result := range results {
		if result.Error != nil {
			h.logger.Error("failed to process image", "originalFileName", result.Job.OriginalName, "uniqueFileName", result.Job.UniqueName, "error", result.Error)
			// Emit error event
			if h.server != nil {
				h.server.BroadcastEvent(&Event{
					Type: EventImageError,
					Payload: map[string]interface{}{
						"originalFileName": result.Job.OriginalName,
						"uniqueFileName":   result.Job.UniqueName,
						"error":            result.Error.Error(),
					},
				})
			}
			continue
		}

		successCount++
		totalProcessingTime += result.ProcessingTime
		metadataList = append(metadataList, result.Metadata)

		// Emit success event
		if h.server != nil {
			h.server.BroadcastEvent(&Event{
				Type: EventImageProcessed,
				Payload: map[string]interface{}{
					"id":               fmt.Sprintf("%d", result.Metadata.Width), // Using width as ID placeholder
					"originalFileName": result.Job.OriginalName,
					"uniqueFileName":   result.Job.UniqueName,
					"width":            result.Metadata.Width,
					"height":           result.Metadata.Height,
					"format":           result.Metadata.Format,
					"processingTime":   result.ProcessingTime.Milliseconds(),
				},
			})
		}

		h.logger.Info("successfully processed image",
			"originalFileName", result.Job.OriginalName,
			"uniqueFileName", result.Job.UniqueName,
			"processingTime", result.ProcessingTime)
	}

	// Emit completion event
	if h.server != nil {
		h.server.BroadcastEvent(&Event{
			Type: EventProcessingComplete,
			Payload: map[string]interface{}{
				"totalProcessed":        successCount,
				"totalRequested":        len(msg.ImagePaths),
				"totalProcessingTime":   totalProcessingTime.Milliseconds(),
				"averageProcessingTime": totalProcessingTime.Milliseconds() / int64(max(successCount, 1)),
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

	h.logger.Info("parallel image processing completed",
		"totalProcessed", successCount,
		"totalRequested", len(msg.ImagePaths),
		"totalProcessingTime", totalProcessingTime,
		"averageProcessingTime", totalProcessingTime/time.Duration(max(successCount, 1)))

	response := &Response{Action: msg.Action, Data: metadataList}
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
	// Get active playlists from the playlist manager
	// This would need to be implemented in the playlist manager
	// For now, return empty list
	activePlaylists := []map[string]interface{}{}

	return &Response{Action: msg.Action, Data: activePlaylists}
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

	// Convert frontend playlist configuration to JSON store playlist
	var interval *int
	if msg.Playlist.Configuration.Interval != nil {
		intervalVal := int(*msg.Playlist.Configuration.Interval)
		interval = &intervalVal
	}

	var order models.PlaylistOrder
	if msg.Playlist.Configuration.Order != nil {
		order = models.PlaylistOrder(*msg.Playlist.Configuration.Order)
	}

	// Convert RendererImage to models.Image
	var images []models.Image
	for _, rendererImg := range msg.Playlist.Images {
		var time *int
		if rendererImg.Time != nil {
			timeVal := int(*rendererImg.Time)
			time = &timeVal
		}

		images = append(images, models.Image{
			ID:         rendererImg.ID,
			Name:       "", // Will be populated from image store
			Path:       "", // Will be populated from image store
			IsChecked:  false,
			IsSelected: false,
			Width:      0,
			Height:     0,
			Format:     "",
			Rating:     0,
			Time:       time,
		})
	}

	playlist := models.Playlist{
		Name:                    msg.Playlist.Name,
		Type:                    models.PlaylistType(msg.Playlist.Configuration.Type),
		Interval:                interval,
		ShowAnimations:          msg.Playlist.Configuration.ShowAnimations,
		AlwaysStartOnFirstImage: msg.Playlist.Configuration.AlwaysStartOnFirstImage,
		Order:                   order,
		CurrentImageIndex:       msg.Playlist.Configuration.CurrentImageIndex,
		Images:                  images,
	}

	// Verify all images exist in JSON store
	for _, rendererImg := range msg.Playlist.Images {
		_, err := h.jsonStore.GetImageByID(ctx, rendererImg.ID)
		if err != nil {
			h.logger.Error("failed to get image for playlist", "imageID", rendererImg.ID, "error", err)
			return &Response{
				Action: msg.Action,
				Error:  errors.New(errors.DatabaseError, fmt.Sprintf("image with ID %d not found", rendererImg.ID)).Error(),
			}
		}
	}

	// Save playlist to JSON store
	err := h.jsonStore.SavePlaylist(ctx, playlist)
	if err != nil {
		h.logger.Error("failed to save playlist", "error", err, "name", playlist.Name)
		return &Response{
			Action: msg.Action,
			Error:  errors.New(errors.DatabaseError, "failed to save playlist").WithDetails(map[string]interface{}{"error": err.Error()}).Error(),
		}
	}

	h.logger.Info("playlist saved successfully", "name", playlist.Name, "id", playlist.ID, "images", len(msg.Playlist.Images))

	// Emit playlists updated event
	if h.server != nil {
		h.server.BroadcastEvent(&Event{
			Type: "playlists_updated",
			Payload: map[string]any{
				"action":       "saved",
				"playlistId":   playlist.ID,
				"playlistName": playlist.Name,
			},
		})
	}

	// Return success with playlist ID
	return &Response{
		Action: msg.Action,
		Data: map[string]interface{}{
			"id":      playlist.ID,
			"name":    playlist.Name,
			"message": "playlist saved successfully",
		},
	}
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
