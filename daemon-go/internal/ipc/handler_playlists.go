package ipc

import (
	"context"
	"errors"
	"fmt"
	"strconv"
	"time"

	"waypaper-engine/daemon-go/internal/events"
	"waypaper-engine/daemon-go/internal/store"
)

// Playlist handlers

func (h *Handler) handleGetPlaylists(msg *Message) *Response {
	// Use JSON store for playlists
	playlists, err := h.jsonDBManager.LoadPlaylists()
	if err == nil && playlists != nil {
		h.logger.Info("handleGetPlaylists: found playlists in JSON store", "count", len(playlists))
		return &Response{Action: msg.Action, Data: playlists}
	}
	h.logger.Warn("handleGetPlaylists: no playlists found in JSON store or error loading", "error", err)
	return &Response{Action: msg.Action, Data: []any{}}
}

func (h *Handler) handleGetPlaylist(msg *Message) *Response {
	// Get playlist by ID (from get_playlist_images)
	ctx := context.Background()
	playlistID := msg.PlaylistID
	if playlistID == 0 {
		return &Response{Action: msg.Action, Error: errors.New("playlist ID is required").Error()}
	}

	// Get playlist from JSON store
	playlist, err := h.jsonDBManager.GetPlaylistByID(ctx, playlistID)
	if err != nil {
		h.logger.Error("failed to get playlist", "error", err)
		return &Response{Action: msg.Action, Error: err.Error()}
	}

	return &Response{Action: msg.Action, Data: playlist}
}

func (h *Handler) handleUpsertPlaylist(msg *Message) *Response {
	ctx := context.Background()

	// Validate input
	if msg.Playlist == nil {
		return &Response{
			Action: msg.Action,
			Error:  errors.New("playlist data is required").Error(),
		}
	}

	if msg.Playlist.Name == "" {
		return &Response{
			Action: msg.Action,
			Error:  errors.New("playlist name is required").Error(),
		}
	}

	h.logger.Info("upserting playlist", "name", msg.Playlist.Name, "type", msg.Playlist.Configuration.Type, "images", len(msg.Playlist.Images))

	// Convert frontend playlist configuration to JSON store playlist
	var interval *int
	if msg.Playlist.Configuration.Interval != nil {
		intervalVal := int(*msg.Playlist.Configuration.Interval)
		interval = &intervalVal
	}

	var order string
	if msg.Playlist.Configuration.Order != nil {
		order = string(*msg.Playlist.Configuration.Order)
	}

	// Convert RendererImage to store.PlaylistImage
	var images []store.PlaylistImage
	for i, rendererImg := range msg.Playlist.Images {
		images = append(images, store.PlaylistImage{
			ImageID:   fmt.Sprintf("%d", rendererImg.ID),
			ImagePath: "", // Will be populated from image store
			Index:     i,
			AddedAt:   time.Now(),
		})
	}

	playlist := store.Playlist{
		ID:   fmt.Sprintf("playlist_%d", time.Now().Unix()),
		Name: msg.Playlist.Name,
		Metadata: store.PlaylistMetadata{
			Version:      "1.0",
			CreatedAt:    time.Now(),
			LastModified: time.Now(),
		},
		Configuration: store.PlaylistConfiguration{
			Type:                    string(msg.Playlist.Configuration.Type),
			Interval:                interval,
			ShowAnimations:          msg.Playlist.Configuration.ShowAnimations,
			AlwaysStartOnFirstImage: msg.Playlist.Configuration.AlwaysStartOnFirstImage,
			Order:                   order,
		},
		Images: images,
	}

	// Verify all images exist in JSON store
	for _, rendererImg := range msg.Playlist.Images {
		_, err := h.jsonDBManager.GetImageByID(ctx, rendererImg.ID)
		if err != nil {
			h.logger.Error("failed to get image for playlist", "imageID", rendererImg.ID, "error", err)
			return &Response{
				Action: msg.Action,
				Error:  fmt.Errorf("image with ID %d not found", rendererImg.ID).Error(),
			}
		}
	}

	// Save playlist to JSON store
	err := h.jsonDBManager.SavePlaylist(ctx, playlist)
	if err != nil {
		h.logger.Error("failed to save playlist", "error", err, "name", playlist.Name)
		return &Response{
			Action: msg.Action,
			Error:  errors.New("failed to save playlist").Error(),
		}
	}

	h.logger.Info("playlist saved successfully", "name", playlist.Name, "id", playlist.ID, "images", len(msg.Playlist.Images))

	// Emit playlists updated event
	if h.server != nil {
		h.server.BroadcastEvent(&events.Event{
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

func (h *Handler) handleDeletePlaylist(msg *Message) *Response {
	// Delete playlist from JSON store
	ctx := context.Background()
	playlistName := msg.PlaylistName
	if playlistName == "" {
		return &Response{Action: msg.Action, Error: errors.New("playlist name is required").Error()}
	}

	// Get all playlists to find the one with matching name
	playlists, err := h.jsonDBManager.LoadPlaylists()
	if err != nil {
		h.logger.Error("failed to get playlists", "error", err)
		return &Response{Action: msg.Action, Error: err.Error()}
	}

	var playlistID int64
	for _, playlist := range playlists {
		if playlist.Name == playlistName {
			// Convert string ID to int64
			if id, err := strconv.ParseInt(playlist.ID, 10, 64); err == nil {
				playlistID = id
			}
			break
		}
	}

	if playlistID == 0 {
		return &Response{Action: msg.Action, Error: errors.New("playlist not found").Error()}
	}

	err = h.jsonDBManager.DeletePlaylist(ctx, playlistID)
	if err != nil {
		h.logger.Error("failed to delete playlist", "error", err)
		return &Response{Action: msg.Action, Error: err.Error()}
	}

	// Emit playlists updated event
	if h.server != nil {
		h.server.BroadcastEvent(&events.Event{
			Type: "playlists_updated",
			Payload: map[string]any{
				"action":       "deleted",
				"playlistName": playlistName,
			},
		})
	}

	return &Response{Action: msg.Action, Data: "playlist deleted"}
}

func (h *Handler) handleStartPlaylist(msg *Message) *Response {
	if msg.PlaylistID == 0 || msg.ActiveMonitor == nil {
		return &Response{Action: msg.Action, Error: errors.New("missing playlist ID or monitor info").Error()}
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
	if msg.ActiveMonitor != nil && msg.ActiveMonitor.ID == "*" {
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
		return &Response{Action: msg.Action, Error: errors.New("missing monitor info, playlist name, or monitor names").Error()}
	}

	err := h.playlistManager.StopPlaylist(msg.ActiveMonitor.ID)
	if err != nil {
		h.logger.Error("failed to stop playlist", "error", err)
		return &Response{Action: msg.Action, Error: err.Error()}
	}

	return &Response{Action: msg.Action, Data: "playlist stopped"}
}

func (h *Handler) handlePausePlaylist(msg *Message) *Response {
	// Check if this is a bulk operation (all monitors)
	if msg.ActiveMonitor != nil && msg.ActiveMonitor.ID == "*" {
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
		return &Response{Action: msg.Action, Error: errors.New("missing monitor info").Error()}
	}

	err := h.playlistManager.PausePlaylist(msg.ActiveMonitor.ID)
	if err != nil {
		h.logger.Error("failed to pause playlist", "error", err)
		return &Response{Action: msg.Action, Error: err.Error()}
	}

	return &Response{Action: msg.Action, Data: "playlist paused"}
}

func (h *Handler) handleResumePlaylist(msg *Message) *Response {
	// Check if this is a bulk operation (all monitors)
	if msg.ActiveMonitor != nil && msg.ActiveMonitor.ID == "*" {
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
		return &Response{Action: msg.Action, Error: errors.New("missing monitor info").Error()}
	}

	err := h.playlistManager.ResumePlaylist(msg.ActiveMonitor.ID)
	if err != nil {
		h.logger.Error("failed to resume playlist", "error", err)
		return &Response{Action: msg.Action, Error: err.Error()}
	}

	return &Response{Action: msg.Action, Data: "playlist resumed"}
}

func (h *Handler) handleNextPlaylistImage(msg *Message) *Response {
	// Check if this is a bulk operation (all monitors)
	if msg.ActiveMonitor != nil && msg.ActiveMonitor.ID == "*" {
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
		return &Response{Action: msg.Action, Error: errors.New("missing monitor info").Error()}
	}

	err := h.playlistManager.NextImage(context.Background(), msg.ActiveMonitor.ID)
	if err != nil {
		h.logger.Error("failed to set next image", "error", err)
		return &Response{Action: msg.Action, Error: err.Error()}
	}

	return &Response{Action: msg.Action, Data: "image changed"}
}

func (h *Handler) handlePreviousPlaylistImage(msg *Message) *Response {
	// Check if this is a bulk operation (all monitors)
	if msg.ActiveMonitor != nil && msg.ActiveMonitor.ID == "*" {
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
		return &Response{Action: msg.Action, Error: errors.New("missing monitor info").Error()}
	}

	err := h.playlistManager.PreviousImage(context.Background(), msg.ActiveMonitor.ID)
	if err != nil {
		h.logger.Error("failed to set previous image", "error", err)
		return &Response{Action: msg.Action, Error: err.Error()}
	}

	return &Response{Action: msg.Action, Data: "image changed"}
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

