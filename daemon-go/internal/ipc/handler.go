package ipc

import (
	"errors"
	"fmt"
	"log/slog"
	"strings"

	"waypaper-engine/daemon-go/internal/config"
	"waypaper-engine/daemon-go/internal/image"
	"waypaper-engine/daemon-go/internal/monitor"
	"waypaper-engine/daemon-go/internal/playlist"
	"waypaper-engine/daemon-go/internal/store"
)

// Handler is the implementation of the MessageHandler interface.
type Handler struct {
	playlistManager  *playlist.Manager
	configManager    *config.ConfigManager
	monitorManager   monitor.MonitorManager
	imageManager     *image.ImageManager
	jsonDBManager    store.JSONDBManager
	logger           *slog.Logger
	server           *Server
	messageValidator *MessageValidator
}

// NewHandler creates a new message handler.
func NewHandler(playlistManager *playlist.Manager, configManager *config.ConfigManager, monitorManager monitor.MonitorManager, imageManager *image.ImageManager, jsonDBManager store.JSONDBManager, logger *slog.Logger) *Handler {
	return &Handler{
		playlistManager:  playlistManager,
		configManager:    configManager,
		monitorManager:   monitorManager,
		imageManager:     imageManager,
		jsonDBManager:    jsonDBManager,
		logger:           logger,
		messageValidator: NewMessageValidator(logger),
	}
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
	// System
	case "ping":
		response = h.handlePing(msg)
	case "get_info":
		response = h.handleGetInfo(msg)
	case "get_diagnostics":
		response = h.handleGetDiagnostics(msg)
	case "get_monitors":
		response = h.handleGetMonitors(msg)
	case "get_daemon_status":
		response = h.handleGetDaemonStatus(msg)
	case "kill_daemon":
		response = h.handleKillDaemon(msg)
	case "stop_daemon":
		response = h.handleStopDaemon(msg)

	// Playlists
	case "get_playlists":
		response = h.handleGetPlaylists(msg)
	case "get_playlist":
		response = h.handleGetPlaylist(msg)
	case "upsert_playlist":
		response = h.handleUpsertPlaylist(msg)
	case "save_playlist": // Legacy support
		response = h.handleUpsertPlaylist(msg)
	case "delete_playlist":
		response = h.handleDeletePlaylist(msg)
	case "start_playlist":
		response = h.handleStartPlaylist(msg)
	case "stop_playlist":
		response = h.handleStopPlaylist(msg)
	case "pause_playlist":
		response = h.handlePausePlaylist(msg)
	case "resume_playlist":
		response = h.handleResumePlaylist(msg)
	case "next_playlist_image":
		response = h.handleNextPlaylistImage(msg)
	case "previous_playlist_image":
		response = h.handlePreviousPlaylistImage(msg)
	case "get_running_playlists":
		response = h.handleGetRunningPlaylists(msg)
	case "get_playlist_images": // Legacy - redirect to get_playlist
		response = h.handleGetPlaylist(msg)
	case "get_active_playlist": // Legacy - redirect to get_running_playlists
		response = h.handleGetRunningPlaylists(msg)

	// Images
	case "get_images":
		response = h.handleGetImages(msg)
	case "process_images":
		response = h.handleProcessImages(msg)
	case "delete_images":
		response = h.handleDeleteImages(msg)
	case "delete_image_from_gallery": // Legacy - redirect to delete_images
		response = h.handleDeleteImages(msg)
	case "upsert_image":
		response = h.handleUpsertImage(msg)
	case "get_image_history":
		response = h.handleGetImageHistory(msg)

	// Configuration
	case "get_config":
		response = h.handleGetConfig(msg)
	case "upsert_config":
		response = h.handleUpsertConfig(msg)
	case "set_config": // Legacy support
		response = h.handleUpsertConfig(msg)
	case "set_selected_monitor":
		response = h.handleSetSelectedMonitor(msg)
	case "get_selected_monitor":
		response = h.handleGetSelectedMonitor(msg)

	// Misc
	case "set_image":
		response = h.handleSetImage(msg)
	case "set_image_across_monitors":
		response = h.handleSetImageAcrossMonitors(msg)
	case "next_image_history":
		response = h.handleNextImageHistory(msg)
	case "previous_image_history":
		response = h.handlePreviousImageHistory(msg)
	case "random_image":
		response = h.handleRandomImage(msg)
	case "process_for_monitors":
		response = h.handleProcessForMonitors(msg)

	// Legacy action names for backward compatibility
	case "next_image":
		// Check if there's a playlist running, if so use playlist navigation, otherwise history
		// For now, default to playlist navigation
		response = h.handleNextPlaylistImage(msg)
	case "previous_image":
		// Check if there's a playlist running, if so use playlist navigation, otherwise history
		// For now, default to playlist navigation
		response = h.handlePreviousPlaylistImage(msg)
	case "duplicate_image_across_monitors":
		// Merged into set_image with clone mode
		// For backward compatibility, set mode to clone if not specified
		if msg.ActiveMonitor != nil && string(msg.ActiveMonitor.Mode) == "" {
			msg.ActiveMonitor.Mode = monitor.MonitorModeClone
		}
		response = h.handleSetImage(msg)

	// Subscriptions (stub implementations)
	case "subscribe":
		response = h.handleSubscribe(msg)
	case "unsubscribe":
		response = h.handleUnsubscribe(msg)

	default:
		response := &Response{Action: msg.Action, Error: errors.New("unknown action").Error()}
		response.MessageID = msg.MessageID
		return response
	}

	// Set the message ID from the original message
	response.MessageID = msg.MessageID
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

// handleSubscribe handles client subscription requests
func (h *Handler) handleSubscribe(msg *Message) *Response {
	if len(msg.EventTypes) == 0 {
		return &Response{Action: msg.Action, Error: "no event types specified"}
	}

	// Get client connection from message context
	// Note: In a real implementation, we'd need to track client connections
	// For now, we'll return success but not actually subscribe
	h.logger.Info("client subscription request", "eventTypes", msg.EventTypes)

	return &Response{Action: msg.Action, Data: "subscribed successfully"}
}

// handleUnsubscribe handles client unsubscription requests
func (h *Handler) handleUnsubscribe(msg *Message) *Response {
	if len(msg.EventTypes) == 0 {
		return &Response{Action: msg.Action, Error: "no event types specified"}
	}

	// Get client connection from message context
	// Note: In a real implementation, we'd need to track client connections
	// For now, we'll return success but not actually unsubscribe
	h.logger.Info("client unsubscription request", "eventTypes", msg.EventTypes)

	return &Response{Action: msg.Action, Data: "unsubscribed successfully"}
}
