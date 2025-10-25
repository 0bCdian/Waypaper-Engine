package ipc

import (
	"context"
	"fmt"
	"log/slog"
	"os"
	"path/filepath"
	"strings"
	"time"

	"waypaper-engine/daemon-go/internal/config"
	"waypaper-engine/daemon-go/internal/errors"
	"waypaper-engine/daemon-go/internal/image"
	"waypaper-engine/daemon-go/internal/playlist"
	"waypaper-engine/daemon-go/internal/store"
	"waypaper-engine/daemon-go/internal/system"
)

// Handler is the implementation of the MessageHandler interface.
type Handler struct {
	playlistManager  *playlist.Manager
	configManager    *config.ConfigManager
	monitorManager   *monitor.Manager
	logger           *slog.Logger
	server           *Server
	store            *store.Store
	jsonStore        *store.JsonStoreManager
	typeRegistry     *ConfigTypeRegistry
	messageValidator *MessageValidator
}

// NewHandler creates a new message handler.
func NewHandler(playlistManager *playlist.Manager, configManager *config.ConfigManager, monitorManager *monitor.Manager, logger *slog.Logger) *Handler {
	return &Handler{
		playlistManager:  playlistManager,
		configManager:    configManager,
		monitorManager:   monitorManager,
		store:            nil, // Will be set later if JSON store is available
		logger:           logger,
		typeRegistry:     NewConfigTypeRegistry(),
		messageValidator: NewMessageValidator(logger),
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
func (h *Handler) createResponse(action string, data any, err error) *Response {
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
	h.logger.Info("handling message", "action", msg.Action)

	// Validate the message first
	validationResult := h.messageValidator.ValidateMessage(msg)
	if !validationResult.Valid {
		h.logger.Error("message validation failed", "action", msg.Action, "errors", validationResult.Errors)

		// Create detailed error message
		var errorMessages []string
		for _, err := range validationResult.Errors {
			errorMessages = append(errorMessages, err.Error())
		}

		return &Response{
			Action:    msg.Action,
			MessageID: msg.MessageID,
			Error:     fmt.Sprintf("validation failed: %s", strings.Join(errorMessages, "; ")),
		}
	}

	// Log any warnings
	if len(validationResult.Warnings) > 0 {
		h.logger.Warn("message validation warnings", "action", msg.Action, "warnings", validationResult.Warnings)
	}

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
	case "get_running_playlists":
		response = h.handleGetRunningPlaylists(msg)
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
	if msg.Image == nil || msg.ActiveMonitor == nil {
		return &Response{Action: msg.Action, Error: errors.New(errors.IPCError, "missing image or monitor info").Error()}
	}

	// Use unified SetImage method with default backend (no playlist-specific backend)
	err := h.playlistManager.SetImage(context.Background(), msg.Image.ID, msg.ActiveMonitor, nil)
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
		return &Response{Action: msg.Action, Data: []any{}}
	}

	// Fallback: return empty array if no store
	h.logger.Warn("handleGetPlaylists: no JSON store available")
	return &Response{Action: msg.Action, Data: []any{}}
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

	// Read image file data
	imageData, err := os.ReadFile(imageInfo.Path)
	if err != nil {
		return h.createResponse(msg.Action, nil, errors.New(errors.SystemError, fmt.Sprintf("failed to read image file: %v", err)))
	}

	// Process image for monitors using types from types package
	monitorImages, err := image.ProcessForMonitors(imageData, msg.ActiveMonitor.Monitors, msg.ActiveMonitor.Mode)
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

	// Use unified SetImage method with default backend (no playlist-specific backend)
	err := h.playlistManager.SetImage(context.Background(), msg.Image.ID, msg.ActiveMonitor, nil)
	if err != nil {
		h.logger.Error("failed to set image across monitors", "error", err)
		return h.createResponse(msg.Action, nil, err)
	}

	return h.createResponse(msg.Action, "image set across monitors", nil)
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

	// Process image for monitors (force clone/duplicate mode)
	monitorImages, err := image.ProcessForMonitors(imageData, msg.ActiveMonitor.Monitors, "clone")
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
	frontendConfig := map[string]any{
		"app": map[string]any{
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
		"daemon": map[string]any{
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
		"backend": map[string]any{
			"type": config.Backend.Type,
			"swww": map[string]any{
				"transition_type":     config.Backend.Swww.TransitionType,
				"transition_step":     config.Backend.Swww.TransitionStep,
				"transition_duration": config.Backend.Swww.TransitionDuration,
				"transition_angle":    config.Backend.Swww.TransitionAngle,
				"transition_pos":      config.Backend.Swww.TransitionPos,
				"transition_bezier":   config.Backend.Swww.TransitionBezier,
				"transition_wave":     config.Backend.Swww.TransitionWave,
			},
		},
		"monitors": map[string]any{
			"selected_monitors": config.Monitors.SelectedMonitors,
			"image_set_type":    config.Monitors.ImageSetType,
		},
	}

	// Monitor configuration comes from TOML config, not from monitor manager's JSON state
	// The monitor manager's JSON state is only for current image state, not configuration

	return &Response{Action: msg.Action, Data: frontendConfig}
}

func (h *Handler) handleSetConfig(msg *Message) *Response {
	if msg.Config == nil {
		return &Response{Action: msg.Action, Error: errors.New(errors.IPCError, "config is required").Error()}
	}

	// Check if this is a partial config update (FrontendConfig is provided)
	if msg.Config.FrontendConfig != nil {
		return h.handlePartialConfigUpdate(msg)
	}

	// Legacy single key-value update
	if msg.Config.ConfigSection == "" || msg.Config.ConfigKey == "" {
		return &Response{Action: msg.Action, Error: errors.New(errors.IPCError, "config section and key are required for single key updates").Error()}
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
			Payload: map[string]any{
				"section":   section,
				"key":       key,
				"value":     value,
				"timestamp": time.Now().Unix(),
			},
		})
	}

	return &Response{Action: msg.Action, Data: true}
}

// handlePartialConfigUpdate handles partial configuration updates
//
// This method allows the frontend to send partial config objects that get intelligently merged.
// Example usage:
//
//	{
//	  "app": {
//	    "theme": "dark",
//	    "notifications": true
//	  },
//	  "monitors": {
//	    "selected_monitors": ["DP-1", "HDMI-1"],
//	    "image_set_type": "extend"
//	  }
//	}
//
// This will update only the specified keys in each section, leaving other keys unchanged.
func (h *Handler) handlePartialConfigUpdate(msg *Message) *Response {
	frontendConfig, ok := msg.Config.FrontendConfig.(map[string]any)
	if !ok {
		return &Response{Action: msg.Action, Error: errors.New(errors.IPCError, "frontendConfig must be a map").Error()}
	}

	// Type validation using reflection
	if err := h.validatePartialConfig(frontendConfig); err != nil {
		h.logger.Error("type validation failed", "error", err)
		return &Response{Action: msg.Action, Error: fmt.Sprintf("type validation failed: %v", err)}
	}

	var updatedSections []string
	var errors []string

	// Process each section in the partial config
	for sectionName, sectionData := range frontendConfig {
		sectionMap, ok := sectionData.(map[string]any)
		if !ok {
			errors = append(errors, fmt.Sprintf("section %s must be a map", sectionName))
			continue
		}

		// Update each key-value pair in the section
		for key, value := range sectionMap {
			var err error
			switch sectionName {
			case "app":
				err = h.setAppConfigValue(key, value)
			case "daemon":
				err = h.setDaemonConfigValue(key, value)
			case "backend":
				err = h.setBackendConfigValue(key, value)
			case "monitors":
				err = h.setMonitorsConfigValue(key, value)
			default:
				err = fmt.Errorf("unknown config section: %s", sectionName)
			}

			if err != nil {
				errors = append(errors, fmt.Sprintf("failed to set %s.%s: %v", sectionName, key, err))
				h.logger.Error("failed to set config value", "section", sectionName, "key", key, "value", value, "error", err)
			} else {
				h.logger.Info("config value updated", "section", sectionName, "key", key, "value", value)
			}
		}

		updatedSections = append(updatedSections, sectionName)
	}

	// If there were any errors, return them
	if len(errors) > 0 {
		return &Response{Action: msg.Action, Error: fmt.Sprintf("partial config update failed: %v", errors)}
	}

	// Broadcast config change event for each updated section
	if h.server != nil {
		for _, section := range updatedSections {
			h.server.BroadcastEvent(&Event{
				Type: "config_changed",
				Payload: map[string]any{
					"section":   section,
					"partial":   true,
					"timestamp": time.Now().Unix(),
				},
			})
		}
	}

	h.logger.Info("partial config update completed", "sections", updatedSections)
	return &Response{Action: msg.Action, Data: map[string]any{
		"updated_sections": updatedSections,
		"success":          true,
	}}
}

// validatePartialConfig validates the structure and types of a partial config
func (h *Handler) validatePartialConfig(config map[string]any) error {
	for sectionName, sectionData := range config {
		sectionMap, ok := sectionData.(map[string]any)
		if !ok {
			return fmt.Errorf("section %s must be a map", sectionName)
		}

		// Validate the section using the type registry
		if err := h.typeRegistry.ValidateSection(sectionName, sectionMap); err != nil {
			return fmt.Errorf("validation failed for section %s: %w", sectionName, err)
		}
	}

	return nil
}

// Helper methods for setting config values by section
func (h *Handler) setAppConfigValue(key string, value any) error {
	return h.configManager.SetAppConfig(key, value)
}

func (h *Handler) setDaemonConfigValue(key string, value any) error {
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

func (h *Handler) setBackendConfigValue(key string, value any) error {
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

func (h *Handler) setMonitorsConfigValue(key string, value any) error {
	// Monitor configuration should ONLY be saved to TOML, not JSON
	// JSON (monitors.json) is for image state, TOML (config.toml) is for monitor configuration

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

	// Save to TOML config file
	if err := h.configManager.SaveConfig(); err != nil {
		h.logger.Error("failed to save monitor config to TOML", "error", err)
		return err
	}

	h.logger.Info("Monitor configuration saved to TOML", "key", key, "value", value)
	return nil
}

// validateActiveMonitorConfig validates the monitor configuration
func (h *Handler) validateActiveMonitorConfig(activeMonitor *models.ActiveMonitor) error {
	if activeMonitor == nil {
		return fmt.Errorf("active monitor is nil")
	}

	if len(activeMonitor.Monitors) == 0 {
		return fmt.Errorf("no monitors selected")
	}

	monitorCount := len(activeMonitor.Monitors)
	imageSetType := activeMonitor.ImageSetType

	// Determine the mode from imageSetType or fallback to individual
	if imageSetType == "" {
		imageSetType = "individual"
	}

	// Validate based on mode
	switch imageSetType {
	case "individual":
		if monitorCount != 1 {
			return fmt.Errorf("individual mode requires exactly 1 monitor, got %d", monitorCount)
		}
	case "extend", "clone":
		if monitorCount < 2 {
			return fmt.Errorf("%s mode requires at least 2 monitors, got %d", imageSetType, monitorCount)
		}
	default:
		return fmt.Errorf("invalid image set type: %s", imageSetType)
	}

	return nil
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
	status := map[string]any{
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

	// Validate monitor configuration
	if err := h.validateActiveMonitorConfig(msg.ActiveMonitor); err != nil {
		h.logger.Error("invalid monitor configuration", "error", err)
		return &Response{Action: msg.Action, Error: err.Error()}
	}

	// Update in-memory state
	err := h.monitorManager.SetActiveMonitor(msg.ActiveMonitor)
	if err != nil {
		response := &Response{Action: msg.Action, Error: err.Error()}
		return response
	}

	// ALSO save to TOML config for persistence
	selectedMonitors := make([]string, len(msg.ActiveMonitor.Monitors))
	for i, monitor := range msg.ActiveMonitor.Monitors {
		selectedMonitors[i] = monitor.Name
	}

	// Use the imageSetType from frontend, fallback to individual
	imageSetType := "individual"
	if msg.ActiveMonitor.ImageSetType != "" {
		imageSetType = msg.ActiveMonitor.ImageSetType
	}

	// Save to TOML config
	err = h.setMonitorsConfigValue("selected_monitors", selectedMonitors)
	if err != nil {
		h.logger.Error("failed to save selected monitors to TOML", "error", err)
		return &Response{Action: msg.Action, Error: err.Error()}
	}

	err = h.setMonitorsConfigValue("image_set_type", imageSetType)
	if err != nil {
		h.logger.Error("failed to save image set type to TOML", "error", err)
		return &Response{Action: msg.Action, Error: err.Error()}
	}

	h.logger.Info("Monitor configuration saved to TOML", "monitors", selectedMonitors, "type", imageSetType)
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

func (h *Handler) handleGetRunningPlaylists(msg *Message) *Response {
	runningPlaylists := h.playlistManager.GetRunningPlaylists()

	// Convert to a format the frontend can understand
	result := make(map[string]any)
	for monitorName, instance := range runningPlaylists {
		result[monitorName] = map[string]any{
			"playlist_id":    instance.PlaylistID,
			"playlist_name":  instance.PlaylistName,
			"active_monitor": instance.ActiveMonitor,
			"paused":         instance.Paused,
		}
	}

	return &Response{Action: msg.Action, Data: result}
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
			Payload: map[string]any{
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
			cachePath := filepath.Join(config.Daemon.ImagesDir, fileName)
			thumbnailName := image.GetThumbnailName(fileName)
			thumbnailPath := filepath.Join(config.Daemon.ThumbnailsDir, thumbnailName)
			err := image.DeleteImageFromCache(cachePath, thumbnailPath)
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
			Payload: map[string]any{
				"totalDeleted": len(imageIDs),
			},
		})
	}

	response := &Response{Action: msg.Action, Data: "images deleted"}
	return response
}

func (h *Handler) handleProcessImages(msg *Message) *Response {
	// Process images using simplified batch processing
	h.logger.Info("handleProcessImages called with batch processing", "imagePaths", msg.ImagePaths, "fileNames", msg.FileNames)

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

	// Process images using simplified batch processing
	h.logger.Info("starting batch image processing", "totalImages", len(msg.ImagePaths))

	// Map unique filenames to their paths for processing
	var imagePaths []string
	var fileNames []string
	for i := range msg.ImagePaths {
		imagePaths = append(imagePaths, msg.ImagePaths[i])
		fileNames = append(fileNames, uniqueFileNames[i])
	}

	// Process images - copy to cache and create default thumbnails
	metadataList, err := image.ProcessImagesFromPaths(imagePaths, fileNames, cacheDir, thumbnailsDir)
	if err != nil {
		h.logger.Error("batch image processing failed", "error", err)
		response := &Response{Action: msg.Action, Error: errors.New(errors.ImageError, fmt.Sprintf("processing failed: %v", err)).Error()}
		return response
	}

	// Create smart resolution thumbnails if monitor manager available
	if h.monitorManager != nil {
		monitors := h.monitorManager.GetMonitors()
		var monitorResolutions []image.MonitorResolution
		for _, monitor := range monitors {
			monitorResolutions = append(monitorResolutions, image.MonitorResolution{
				Width:  monitor.Width,
				Height: monitor.Height,
				Name:   monitor.Name,
			})
		}
		requiredResolutions := image.GetRequiredResolutions(monitorResolutions)
		h.logger.Debug("Creating smart resolution thumbnails", "resolutions", requiredResolutions)

		// Create smart thumbnails for each processed image
		for _, fileName := range fileNames {
			imagePath := filepath.Join(cacheDir, fileName)
			_, err := image.CreateSmartMultiResolutionThumbnails(imagePath, thumbnailsDir, fileName, requiredResolutions)
			if err != nil {
				h.logger.Warn("failed to create smart thumbnails", "fileName", fileName, "error", err)
				// Continue with other images
			}
		}
	}

	// Emit success events for processed images
	successCount := len(metadataList)
	for i, metadata := range metadataList {
		if h.server != nil {
			h.server.BroadcastEvent(&Event{
				Type: EventImageProcessed,
				Payload: map[string]any{
					"originalFileName": msg.FileNames[i],
					"uniqueFileName":   fileNames[i],
					"width":            metadata.Width,
					"height":           metadata.Height,
					"format":           metadata.Format,
				},
			})
		}

		h.logger.Info("successfully processed image",
			"originalFileName", msg.FileNames[i],
			"uniqueFileName", fileNames[i])
	}

	// Emit completion event
	if h.server != nil {
		h.server.BroadcastEvent(&Event{
			Type: EventProcessingComplete,
			Payload: map[string]any{
				"totalProcessed": successCount,
				"totalRequested": len(msg.ImagePaths),
			},
		})

		// Emit images updated event if any images were processed
		if len(metadataList) > 0 {
			h.server.BroadcastEvent(&Event{
				Type: "images_updated",
				Payload: map[string]any{
					"totalAdded": len(metadataList),
				},
			})
		}
	}

	h.logger.Info("batch image processing completed",
		"totalProcessed", successCount,
		"totalRequested", len(msg.ImagePaths))

	response := &Response{Action: msg.Action, Data: metadataList}
	return response
}

func (h *Handler) handleGetActivePlaylist(msg *Message) *Response {
	// Get active playlists from the playlist manager
	// This would need to be implemented in the playlist manager
	// For now, return empty list
	activePlaylists := []map[string]any{}

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
			Error:  errors.New(errors.DatabaseError, "failed to save playlist").WithDetails(map[string]any{"error": err.Error()}).Error(),
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
		Data: map[string]any{
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
