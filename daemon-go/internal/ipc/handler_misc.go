package ipc

import (
	"context"
	"errors"
	"fmt"
	"os"
	"strconv"

	"waypaper-engine/daemon-go/internal/image"
	"waypaper-engine/daemon-go/internal/store"
)

// Misc handlers - manual image setting, history navigation, random images

func (h *Handler) handleSetImage(msg *Message) *Response {
	if msg.Image == nil || msg.ActiveMonitor == nil {
		return &Response{Action: msg.Action, Error: errors.New("missing image or monitor info").Error()}
	}

	// Determine behavior based on activeMonitor.Mode
	mode := string(msg.ActiveMonitor.Mode)
	if mode == "" {
		mode = "individual"
	}

	// If mode is "extend", use set_image_across_monitors logic
	if mode == "extend" {
		return h.handleSetImageAcrossMonitors(msg)
	}

	// For "clone" or "individual" modes, use unified SetImage method
	// Clone mode: same image on all monitors (merged from duplicate_image_across_monitors)
	// Individual mode: set image on each selected monitor individually
	err := h.playlistManager.SetImage(context.Background(), msg.Image.ID, msg.ActiveMonitor, nil)
	if err != nil {
		h.logger.Error("failed to set image", "error", err)
		return &Response{Action: msg.Action, Error: err.Error()}
	}

	// Update monitor state with the current image
	// Get the image from store to construct the full path
	registry, err := h.jsonDBManager.LoadImageGallery()
	if err != nil {
		h.logger.Error("failed to load image registry for monitor state update", "error", err)
		// Don't fail the operation if we can't update monitor state
	} else {
		var image *store.Image
		for _, img := range registry {
			if img.ID == msg.Image.ID {
				image = &img
				break
			}
		}

		if image != nil {
			h.logger.Debug("image found", "image", image.Name)
		}
	}

	return &Response{Action: msg.Action, Data: "image changed"}
}

func (h *Handler) handleSetImageAcrossMonitors(msg *Message) *Response {
	if msg.Image == nil || msg.ActiveMonitor == nil {
		return h.createResponse(msg.Action, nil, errors.New("image and activeMonitor are required"))
	}

	// Use unified SetImage method with default backend (no playlist-specific backend)
	// This will split the image across monitors (extend mode)
	err := h.playlistManager.SetImage(context.Background(), msg.Image.ID, msg.ActiveMonitor, nil)
	if err != nil {
		h.logger.Error("failed to set image across monitors", "error", err)
		return h.createResponse(msg.Action, nil, err)
	}

	return h.createResponse(msg.Action, "image set across monitors", nil)
}

func (h *Handler) handleNextImageHistory(msg *Message) *Response {
	// Navigate to next image in history (newer image)
	if msg.ActiveMonitor == nil {
		return &Response{Action: msg.Action, Error: errors.New("missing monitor info").Error()}
	}

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

	// Load image history
	history, err := h.jsonDBManager.LoadImageHistory(historyLimit)
	if err != nil {
		h.logger.Error("failed to load image history", "error", err)
		return &Response{Action: msg.Action, Error: err.Error()}
	}

	if len(history) == 0 {
		return &Response{Action: msg.Action, Error: "no image history available"}
	}

	// Find current position in history (most recent entry for the monitor)
	// For simplicity, we'll use the most recent entry as starting point
	// In a full implementation, we'd track the current history index
	currentIndex := 0

	// Navigate to next (newer) entry - going forward in the list (index + 1)
	// Since history is stored with newest first, index 0 is most recent
	// Next means going to index + 1 (older entry)
	if currentIndex+1 >= len(history) {
		return &Response{Action: msg.Action, Error: "already at oldest image in history"}
	}

	nextEntry := history[currentIndex+1]

	// Convert image ID from string to int64
	imageID, err := strconv.ParseInt(nextEntry.ImageID, 10, 64)
	if err != nil {
		h.logger.Error("failed to parse image ID from history", "imageID", nextEntry.ImageID, "error", err)
		return &Response{Action: msg.Action, Error: fmt.Errorf("invalid image ID in history: %v", err).Error()}
	}

	// Set the image from history
	err = h.playlistManager.SetImage(context.Background(), imageID, msg.ActiveMonitor, nil)
	if err != nil {
		h.logger.Error("failed to set image from history", "error", err)
		return &Response{Action: msg.Action, Error: err.Error()}
	}

	return &Response{Action: msg.Action, Data: "image changed from history"}
}

func (h *Handler) handlePreviousImageHistory(msg *Message) *Response {
	// Navigate to previous image in history (older image)
	if msg.ActiveMonitor == nil {
		return &Response{Action: msg.Action, Error: errors.New("missing monitor info").Error()}
	}

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

	// Load image history
	history, err := h.jsonDBManager.LoadImageHistory(historyLimit)
	if err != nil {
		h.logger.Error("failed to load image history", "error", err)
		return &Response{Action: msg.Action, Error: err.Error()}
	}

	if len(history) == 0 {
		return &Response{Action: msg.Action, Error: "no image history available"}
	}

	// Find current position in history (most recent entry for the monitor)
	// For simplicity, we'll use the most recent entry as starting point
	// In a full implementation, we'd track the current history index
	currentIndex := 0

	// Navigate to previous (older) entry - going backward in the list (index - 1)
	// Since history is stored with newest first, index 0 is most recent
	// Previous means going to index - 1 (newer entry, but we're already at newest)
	if currentIndex <= 0 {
		return &Response{Action: msg.Action, Error: "already at newest image in history"}
	}

	prevEntry := history[currentIndex-1]

	// Convert image ID from string to int64
	imageID, err := strconv.ParseInt(prevEntry.ImageID, 10, 64)
	if err != nil {
		h.logger.Error("failed to parse image ID from history", "imageID", prevEntry.ImageID, "error", err)
		return &Response{Action: msg.Action, Error: fmt.Errorf("invalid image ID in history: %v", err).Error()}
	}

	// Set the image from history
	err = h.playlistManager.SetImage(context.Background(), imageID, msg.ActiveMonitor, nil)
	if err != nil {
		h.logger.Error("failed to set image from history", "error", err)
		return &Response{Action: msg.Action, Error: err.Error()}
	}

	return &Response{Action: msg.Action, Data: "image changed from history"}
}

func (h *Handler) handleRandomImage(msg *Message) *Response {
	// Check if this is a bulk operation (all monitors)
	if msg.ActiveMonitor != nil && msg.ActiveMonitor.ID == "*" {
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
		return &Response{Action: msg.Action, Error: errors.New("missing monitor info").Error()}
	}

	err := h.playlistManager.RandomImage(context.Background(), msg.ActiveMonitor.ID)
	if err != nil {
		h.logger.Error("failed to set random image", "error", err)
		return &Response{Action: msg.Action, Error: err.Error()}
	}

	return &Response{Action: msg.Action, Data: "image changed"}
}

func (h *Handler) handleProcessForMonitors(msg *Message) *Response {
	if msg.Image == nil || msg.ActiveMonitor == nil {
		return h.createResponse(msg.Action, nil, errors.New("image and activeMonitor are required"))
	}

	// Get image data from store
	registry, err := h.jsonDBManager.LoadImageGallery()
	if err != nil {
		return h.createResponse(msg.Action, nil, fmt.Errorf("failed to load image registry: %v", err))
	}

	var imageInfo *store.Image
	for _, img := range registry {
		if img.ID == msg.Image.ID {
			imageInfo = &img
			break
		}
	}

	if imageInfo == nil {
		return h.createResponse(msg.Action, nil, fmt.Errorf("image with ID %d not found", msg.Image.ID))
	}

	// Read image file data
	imageData, err := os.ReadFile(imageInfo.Path)
	if err != nil {
		return h.createResponse(msg.Action, nil, fmt.Errorf("failed to read image file: %v", err))
	}

	// Process image for monitors using types from types package
	monitorImages, err := image.ProcessForMonitors(imageData, msg.ActiveMonitor.Monitors, msg.ActiveMonitor.Mode)
	if err != nil {
		return h.createResponse(msg.Action, nil, fmt.Errorf("failed to process image for monitors: %v", err))
	}

	response := &Response{Action: msg.Action, Data: monitorImages}
	return response
}

