package ipc

import (
	"fmt"
	"log/slog"
	"strings"

	"waypaper-engine/daemon-go/internal/monitor"
)

// ValidationError represents a validation error with detailed information
type ValidationError struct {
	Field   string `json:"field"`
	Value   any    `json:"value"`
	Message string `json:"message"`
	Code    string `json:"code"`
}

func (ve *ValidationError) Error() string {
	return fmt.Sprintf("validation failed for field '%s': %s", ve.Field, ve.Message)
}

// ValidationResult contains the result of message validation
type ValidationResult struct {
	Valid    bool              `json:"valid"`
	Errors   []ValidationError `json:"errors,omitempty"`
	Warnings []ValidationError `json:"warnings,omitempty"`
}

// MessageValidator provides comprehensive validation for IPC messages
type MessageValidator struct {
	validators map[string]func(*Message) *ValidationResult
	logger     *slog.Logger
}

// NewMessageValidator creates a new message validator with all registered validators
func NewMessageValidator(logger *slog.Logger) *MessageValidator {
	mv := &MessageValidator{
		validators: make(map[string]func(*Message) *ValidationResult),
		logger:     logger,
	}

	// Register all message validators
	mv.registerValidators()

	return mv
}

// registerValidators registers validation functions for all message types
func (mv *MessageValidator) registerValidators() {
	// System
	mv.validators["ping"] = mv.validatePingMessage
	mv.validators["get_info"] = mv.validateGetInfoMessage
	mv.validators["get_diagnostics"] = mv.validateGetDiagnosticsMessage
	mv.validators["get_monitors"] = mv.validateGetMonitorsMessage
	mv.validators["get_daemon_status"] = mv.validateGetDaemonStatusMessage
	mv.validators["kill_daemon"] = mv.validateKillDaemonMessage
	mv.validators["stop_daemon"] = mv.validateStopDaemonMessage

	// Playlists
	mv.validators["get_playlists"] = mv.validateGetPlaylistsMessage
	mv.validators["get_playlist"] = mv.validateGetPlaylistImagesMessage // Reuse same validation
	mv.validators["upsert_playlist"] = mv.validateSavePlaylistMessage
	mv.validators["save_playlist"] = mv.validateSavePlaylistMessage // Legacy
	mv.validators["delete_playlist"] = mv.validateDeletePlaylistMessage
	mv.validators["start_playlist"] = mv.validateStartPlaylistMessage
	mv.validators["stop_playlist"] = mv.validateStopPlaylistMessage
	mv.validators["pause_playlist"] = mv.validatePausePlaylistMessage
	mv.validators["resume_playlist"] = mv.validateResumePlaylistMessage
	mv.validators["next_playlist_image"] = mv.validateNextImageMessage
	mv.validators["previous_playlist_image"] = mv.validatePreviousImageMessage
	mv.validators["get_running_playlists"] = mv.validateGetRunningPlaylistsMessage
	mv.validators["get_playlist_images"] = mv.validateGetPlaylistImagesMessage   // Legacy
	mv.validators["get_active_playlist"] = mv.validateGetRunningPlaylistsMessage // Legacy

	// Images
	mv.validators["get_images"] = mv.validateGetImagesMessage
	mv.validators["process_images"] = mv.validateProcessImagesMessage
	mv.validators["delete_images"] = mv.validateDeleteImagesMessage
	mv.validators["delete_image_from_gallery"] = mv.validateDeleteImageFromGalleryMessage // Legacy
	mv.validators["upsert_image"] = mv.validateSetImageMessage                            // Reuse set_image validation
	mv.validators["get_image_history"] = mv.validateGetImageHistoryMessage

	// Configuration
	mv.validators["get_config"] = mv.validateGetConfigMessage
	mv.validators["upsert_config"] = mv.validateSetConfigMessage
	mv.validators["set_config"] = mv.validateSetConfigMessage // Legacy
	mv.validators["set_selected_monitor"] = mv.validateSetSelectedMonitorMessage
	mv.validators["get_selected_monitor"] = mv.validateGetSelectedMonitorMessage
	mv.validators["get_swww_config"] = mv.validateGetSwwwConfigMessage

	// Misc
	mv.validators["set_image"] = mv.validateSetImageMessage
	mv.validators["set_image_across_monitors"] = mv.validateSetImageAcrossMonitorsMessage
	mv.validators["next_image_history"] = mv.validateNextImageMessage
	mv.validators["previous_image_history"] = mv.validatePreviousImageMessage
	mv.validators["random_image"] = mv.validateRandomImageMessage
	mv.validators["process_for_monitors"] = mv.validateProcessForMonitorsMessage

	// Legacy action names for backward compatibility
	mv.validators["next_image"] = mv.validateNextImageMessage
	mv.validators["previous_image"] = mv.validatePreviousImageMessage
	mv.validators["duplicate_image_across_monitors"] = mv.validateDuplicateImageAcrossMonitorsMessage
}

// ValidateMessage validates a message based on its action type
func (mv *MessageValidator) ValidateMessage(msg *Message) *ValidationResult {
	if msg == nil {
		return &ValidationResult{
			Valid: false,
			Errors: []ValidationError{{
				Field:   "message",
				Value:   nil,
				Message: "message cannot be nil",
				Code:    "MESSAGE_NIL",
			}},
		}
	}

	if msg.Action == "" {
		return &ValidationResult{
			Valid: false,
			Errors: []ValidationError{{
				Field:   "action",
				Value:   msg.Action,
				Message: "action is required",
				Code:    "ACTION_REQUIRED",
			}},
		}
	}

	validator, exists := mv.validators[msg.Action]
	if !exists {
		return &ValidationResult{
			Valid: false,
			Errors: []ValidationError{{
				Field:   "action",
				Value:   msg.Action,
				Message: fmt.Sprintf("unknown action: %s", msg.Action),
				Code:    "UNKNOWN_ACTION",
			}},
		}
	}

	return validator(msg)
}

// validatePingMessage validates ping messages
func (mv *MessageValidator) validatePingMessage(msg *Message) *ValidationResult {
	result := &ValidationResult{Valid: true}

	// Ping messages don't require any specific fields
	// Just ensure message ID is present if provided
	if msg.MessageID < 0 {
		result.Valid = false
		result.Errors = append(result.Errors, ValidationError{
			Field:   "messageId",
			Value:   msg.MessageID,
			Message: "message ID must be non-negative",
			Code:    "INVALID_MESSAGE_ID",
		})
	}

	return result
}

// validateStartPlaylistMessage validates start playlist messages
func (mv *MessageValidator) validateStartPlaylistMessage(msg *Message) *ValidationResult {
	result := &ValidationResult{Valid: true}

	// Validate playlist ID
	if msg.PlaylistID <= 0 {
		result.Valid = false
		result.Errors = append(result.Errors, ValidationError{
			Field:   "playlistId",
			Value:   msg.PlaylistID,
			Message: "playlist ID must be positive",
			Code:    "INVALID_PLAYLIST_ID",
		})
	}

	// Validate active monitor
	if msg.ActiveMonitor == nil {
		result.Valid = false
		result.Errors = append(result.Errors, ValidationError{
			Field:   "activeMonitor",
			Value:   nil,
			Message: "active monitor is required",
			Code:    "ACTIVE_MONITOR_REQUIRED",
		})
	} else {
		if err := mv.validateActiveMonitor(msg.ActiveMonitor); err != nil {
			result.Valid = false
			result.Errors = append(result.Errors, *err)
		}
	}

	return result
}

// validateStopPlaylistMessage validates stop playlist messages
func (mv *MessageValidator) validateStopPlaylistMessage(msg *Message) *ValidationResult {
	result := &ValidationResult{Valid: true}

	// Stop playlist can be called with:
	// 1. Playlist name
	// 2. Monitor names array
	// 3. Active monitor (single or "*" for all)

	hasPlaylistName := msg.PlaylistName != ""
	hasMonitorNames := len(msg.Monitors) > 0
	hasActiveMonitor := msg.ActiveMonitor != nil

	if !hasPlaylistName && !hasMonitorNames && !hasActiveMonitor {
		result.Valid = false
		result.Errors = append(result.Errors, ValidationError{
			Field:   "stop_criteria",
			Value:   nil,
			Message: "must provide either playlist name, monitor names, or active monitor",
			Code:    "STOP_CRITERIA_REQUIRED",
		})
	}

	// Validate monitor names if provided
	if hasMonitorNames {
		for i, monitorName := range msg.Monitors {
			if strings.TrimSpace(monitorName) == "" {
				result.Valid = false
				result.Errors = append(result.Errors, ValidationError{
					Field:   fmt.Sprintf("monitors[%d]", i),
					Value:   monitorName,
					Message: "monitor name cannot be empty",
					Code:    "EMPTY_MONITOR_NAME",
				})
			}
		}
	}

	// Validate active monitor if provided
	if hasActiveMonitor {
		if err := mv.validateActiveMonitor(msg.ActiveMonitor); err != nil {
			result.Valid = false
			result.Errors = append(result.Errors, *err)
		}
	}

	return result
}

// validatePausePlaylistMessage validates pause playlist messages
func (mv *MessageValidator) validatePausePlaylistMessage(msg *Message) *ValidationResult {
	result := &ValidationResult{Valid: true}

	// Pause playlist requires active monitor
	if msg.ActiveMonitor == nil {
		result.Valid = false
		result.Errors = append(result.Errors, ValidationError{
			Field:   "activeMonitor",
			Value:   nil,
			Message: "active monitor is required",
			Code:    "ACTIVE_MONITOR_REQUIRED",
		})
	} else {
		if err := mv.validateActiveMonitor(msg.ActiveMonitor); err != nil {
			result.Valid = false
			result.Errors = append(result.Errors, *err)
		}
	}

	return result
}

// validateResumePlaylistMessage validates resume playlist messages
func (mv *MessageValidator) validateResumePlaylistMessage(msg *Message) *ValidationResult {
	result := &ValidationResult{Valid: true}

	// Resume playlist requires active monitor
	if msg.ActiveMonitor == nil {
		result.Valid = false
		result.Errors = append(result.Errors, ValidationError{
			Field:   "activeMonitor",
			Value:   nil,
			Message: "active monitor is required",
			Code:    "ACTIVE_MONITOR_REQUIRED",
		})
	} else {
		if err := mv.validateActiveMonitor(msg.ActiveMonitor); err != nil {
			result.Valid = false
			result.Errors = append(result.Errors, *err)
		}
	}

	return result
}

// validateNextImageMessage validates next image messages
func (mv *MessageValidator) validateNextImageMessage(msg *Message) *ValidationResult {
	result := &ValidationResult{Valid: true}

	// Next image requires active monitor
	if msg.ActiveMonitor == nil {
		result.Valid = false
		result.Errors = append(result.Errors, ValidationError{
			Field:   "activeMonitor",
			Value:   nil,
			Message: "active monitor is required",
			Code:    "ACTIVE_MONITOR_REQUIRED",
		})
	} else {
		if err := mv.validateActiveMonitor(msg.ActiveMonitor); err != nil {
			result.Valid = false
			result.Errors = append(result.Errors, *err)
		}
	}

	return result
}

// validatePreviousImageMessage validates previous image messages
func (mv *MessageValidator) validatePreviousImageMessage(msg *Message) *ValidationResult {
	result := &ValidationResult{Valid: true}

	// Previous image requires active monitor
	if msg.ActiveMonitor == nil {
		result.Valid = false
		result.Errors = append(result.Errors, ValidationError{
			Field:   "activeMonitor",
			Value:   nil,
			Message: "active monitor is required",
			Code:    "ACTIVE_MONITOR_REQUIRED",
		})
	} else {
		if err := mv.validateActiveMonitor(msg.ActiveMonitor); err != nil {
			result.Valid = false
			result.Errors = append(result.Errors, *err)
		}
	}

	return result
}

// validateSetImageMessage validates set image messages
func (mv *MessageValidator) validateSetImageMessage(msg *Message) *ValidationResult {
	result := &ValidationResult{Valid: true}

	// Validate image
	if msg.Image == nil {
		result.Valid = false
		result.Errors = append(result.Errors, ValidationError{
			Field:   "image",
			Value:   nil,
			Message: "image is required",
			Code:    "IMAGE_REQUIRED",
		})
	} else {
		if err := mv.validateImageInfo(msg.Image); err != nil {
			result.Valid = false
			result.Errors = append(result.Errors, *err)
		}
	}

	// Validate active monitor
	if msg.ActiveMonitor == nil {
		result.Valid = false
		result.Errors = append(result.Errors, ValidationError{
			Field:   "activeMonitor",
			Value:   nil,
			Message: "active monitor is required",
			Code:    "ACTIVE_MONITOR_REQUIRED",
		})
	} else {
		if err := mv.validateActiveMonitor(msg.ActiveMonitor); err != nil {
			result.Valid = false
			result.Errors = append(result.Errors, *err)
		}
	}

	return result
}

// validateRandomImageMessage validates random image messages
func (mv *MessageValidator) validateRandomImageMessage(msg *Message) *ValidationResult {
	result := &ValidationResult{Valid: true}

	// Random image requires active monitor
	if msg.ActiveMonitor == nil {
		result.Valid = false
		result.Errors = append(result.Errors, ValidationError{
			Field:   "activeMonitor",
			Value:   nil,
			Message: "active monitor is required",
			Code:    "ACTIVE_MONITOR_REQUIRED",
		})
	} else {
		if err := mv.validateActiveMonitor(msg.ActiveMonitor); err != nil {
			result.Valid = false
			result.Errors = append(result.Errors, *err)
		}
	}

	return result
}

// validateGetInfoMessage validates get info messages
func (mv *MessageValidator) validateGetInfoMessage(msg *Message) *ValidationResult {
	result := &ValidationResult{Valid: true}
	// Get info doesn't require any specific fields
	return result
}

// validateGetDiagnosticsMessage validates get diagnostics messages
func (mv *MessageValidator) validateGetDiagnosticsMessage(msg *Message) *ValidationResult {
	result := &ValidationResult{Valid: true}
	// Get diagnostics doesn't require any specific fields
	return result
}

// validateGetImagesMessage validates get images messages
func (mv *MessageValidator) validateGetImagesMessage(msg *Message) *ValidationResult {
	result := &ValidationResult{Valid: true}
	// Get images doesn't require any specific fields
	return result
}

// validateGetPlaylistsMessage validates get playlists messages
func (mv *MessageValidator) validateGetPlaylistsMessage(msg *Message) *ValidationResult {
	result := &ValidationResult{Valid: true}
	// Get playlists doesn't require any specific fields
	return result
}

// validateSavePlaylistMessage validates save playlist messages
func (mv *MessageValidator) validateSavePlaylistMessage(msg *Message) *ValidationResult {
	result := &ValidationResult{Valid: true}

	// Validate playlist
	if msg.Playlist == nil {
		result.Valid = false
		result.Errors = append(result.Errors, ValidationError{
			Field:   "playlist",
			Value:   nil,
			Message: "playlist is required",
			Code:    "PLAYLIST_REQUIRED",
		})
	} else {
		if err := mv.validateRendererPlaylist(msg.Playlist); err != nil {
			result.Valid = false
			result.Errors = append(result.Errors, *err)
		}
	}

	return result
}

// validateProcessForMonitorsMessage validates process for monitors messages
func (mv *MessageValidator) validateProcessForMonitorsMessage(msg *Message) *ValidationResult {
	result := &ValidationResult{Valid: true}

	// Validate image
	if msg.Image == nil {
		result.Valid = false
		result.Errors = append(result.Errors, ValidationError{
			Field:   "image",
			Value:   nil,
			Message: "image is required",
			Code:    "IMAGE_REQUIRED",
		})
	} else {
		if err := mv.validateImageInfo(msg.Image); err != nil {
			result.Valid = false
			result.Errors = append(result.Errors, *err)
		}
	}

	// Validate active monitor
	if msg.ActiveMonitor == nil {
		result.Valid = false
		result.Errors = append(result.Errors, ValidationError{
			Field:   "activeMonitor",
			Value:   nil,
			Message: "active monitor is required",
			Code:    "ACTIVE_MONITOR_REQUIRED",
		})
	} else {
		if err := mv.validateActiveMonitor(msg.ActiveMonitor); err != nil {
			result.Valid = false
			result.Errors = append(result.Errors, *err)
		}
	}

	return result
}

// validateSetImageAcrossMonitorsMessage validates set image across monitors messages
func (mv *MessageValidator) validateSetImageAcrossMonitorsMessage(msg *Message) *ValidationResult {
	result := &ValidationResult{Valid: true}

	// Validate image
	if msg.Image == nil {
		result.Valid = false
		result.Errors = append(result.Errors, ValidationError{
			Field:   "image",
			Value:   nil,
			Message: "image is required",
			Code:    "IMAGE_REQUIRED",
		})
	} else {
		if err := mv.validateImageInfo(msg.Image); err != nil {
			result.Valid = false
			result.Errors = append(result.Errors, *err)
		}
	}

	// Validate active monitor
	if msg.ActiveMonitor == nil {
		result.Valid = false
		result.Errors = append(result.Errors, ValidationError{
			Field:   "activeMonitor",
			Value:   nil,
			Message: "active monitor is required",
			Code:    "ACTIVE_MONITOR_REQUIRED",
		})
	} else {
		if err := mv.validateActiveMonitor(msg.ActiveMonitor); err != nil {
			result.Valid = false
			result.Errors = append(result.Errors, *err)
		}
	}

	return result
}

// validateDuplicateImageAcrossMonitorsMessage validates duplicate image across monitors messages
func (mv *MessageValidator) validateDuplicateImageAcrossMonitorsMessage(msg *Message) *ValidationResult {
	result := &ValidationResult{Valid: true}

	// Validate image
	if msg.Image == nil {
		result.Valid = false
		result.Errors = append(result.Errors, ValidationError{
			Field:   "image",
			Value:   nil,
			Message: "image is required",
			Code:    "IMAGE_REQUIRED",
		})
	} else {
		if err := mv.validateImageInfo(msg.Image); err != nil {
			result.Valid = false
			result.Errors = append(result.Errors, *err)
		}
	}

	// Validate active monitor
	if msg.ActiveMonitor == nil {
		result.Valid = false
		result.Errors = append(result.Errors, ValidationError{
			Field:   "activeMonitor",
			Value:   nil,
			Message: "active monitor is required",
			Code:    "ACTIVE_MONITOR_REQUIRED",
		})
	} else {
		if err := mv.validateActiveMonitor(msg.ActiveMonitor); err != nil {
			result.Valid = false
			result.Errors = append(result.Errors, *err)
		}
	}

	return result
}

// validateDeleteImagesMessage validates delete images messages
func (mv *MessageValidator) validateDeleteImagesMessage(msg *Message) *ValidationResult {
	result := &ValidationResult{Valid: true}

	// Validate image IDs
	if len(msg.ImageIDs) == 0 {
		result.Valid = false
		result.Errors = append(result.Errors, ValidationError{
			Field:   "imageIds",
			Value:   msg.ImageIDs,
			Message: "image IDs are required",
			Code:    "IMAGE_IDS_REQUIRED",
		})
	} else {
		for i, id := range msg.ImageIDs {
			if id <= 0 {
				result.Valid = false
				result.Errors = append(result.Errors, ValidationError{
					Field:   fmt.Sprintf("imageIds[%d]", i),
					Value:   id,
					Message: "image ID must be positive",
					Code:    "INVALID_IMAGE_ID",
				})
			}
		}
	}

	return result
}

// validateGetImageHistoryMessage validates get image history messages
func (mv *MessageValidator) validateGetImageHistoryMessage(msg *Message) *ValidationResult {
	result := &ValidationResult{Valid: true}
	// Get image history doesn't require any specific fields
	return result
}

// validateGetConfigMessage validates get config messages
func (mv *MessageValidator) validateGetConfigMessage(msg *Message) *ValidationResult {
	result := &ValidationResult{Valid: true}
	// Get config doesn't require any specific fields
	return result
}

// validateSetConfigMessage validates set config messages
func (mv *MessageValidator) validateSetConfigMessage(msg *Message) *ValidationResult {
	result := &ValidationResult{Valid: true}

	// Validate config
	if msg.Config == nil {
		result.Valid = false
		result.Errors = append(result.Errors, ValidationError{
			Field:   "config",
			Value:   nil,
			Message: "config is required",
			Code:    "CONFIG_REQUIRED",
		})
	} else {
		if err := mv.validateConfigData(msg.Config); err != nil {
			result.Valid = false
			result.Errors = append(result.Errors, *err)
		}
	}

	return result
}

// validateGetSwwwConfigMessage validates get swww config messages
func (mv *MessageValidator) validateGetSwwwConfigMessage(msg *Message) *ValidationResult {
	result := &ValidationResult{Valid: true}
	// Get swww config doesn't require any specific fields
	return result
}

// validateStopDaemonMessage validates stop daemon messages
func (mv *MessageValidator) validateStopDaemonMessage(msg *Message) *ValidationResult {
	result := &ValidationResult{Valid: true}
	// Stop daemon doesn't require any specific fields
	return result
}

// validateKillDaemonMessage validates kill daemon messages
func (mv *MessageValidator) validateKillDaemonMessage(msg *Message) *ValidationResult {
	result := &ValidationResult{Valid: true}
	// Kill daemon doesn't require any specific fields
	return result
}

// validateGetDaemonStatusMessage validates get daemon status messages
func (mv *MessageValidator) validateGetDaemonStatusMessage(msg *Message) *ValidationResult {
	result := &ValidationResult{Valid: true}
	// Get daemon status doesn't require any specific fields
	return result
}

// validateGetMonitorsMessage validates get monitors messages
func (mv *MessageValidator) validateGetMonitorsMessage(msg *Message) *ValidationResult {
	result := &ValidationResult{Valid: true}
	// Get monitors doesn't require any specific fields
	return result
}

// validateSetSelectedMonitorMessage validates set selected monitor messages
func (mv *MessageValidator) validateSetSelectedMonitorMessage(msg *Message) *ValidationResult {
	result := &ValidationResult{Valid: true}

	// Validate active monitor
	if msg.ActiveMonitor == nil {
		result.Valid = false
		result.Errors = append(result.Errors, ValidationError{
			Field:   "activeMonitor",
			Value:   nil,
			Message: "active monitor is required",
			Code:    "ACTIVE_MONITOR_REQUIRED",
		})
	} else {
		if err := mv.validateActiveMonitor(msg.ActiveMonitor); err != nil {
			result.Valid = false
			result.Errors = append(result.Errors, *err)
		}
	}

	return result
}

// validateGetSelectedMonitorMessage validates get selected monitor messages
func (mv *MessageValidator) validateGetSelectedMonitorMessage(msg *Message) *ValidationResult {
	result := &ValidationResult{Valid: true}
	// Get selected monitor doesn't require any specific fields
	return result
}

// validateGetPlaylistImagesMessage validates get playlist images messages
func (mv *MessageValidator) validateGetPlaylistImagesMessage(msg *Message) *ValidationResult {
	result := &ValidationResult{Valid: true}

	// Validate playlist ID
	if msg.PlaylistID <= 0 {
		result.Valid = false
		result.Errors = append(result.Errors, ValidationError{
			Field:   "playlistId",
			Value:   msg.PlaylistID,
			Message: "playlist ID must be positive",
			Code:    "INVALID_PLAYLIST_ID",
		})
	}

	return result
}

// validateGetRunningPlaylistsMessage validates get running playlists messages
func (mv *MessageValidator) validateGetRunningPlaylistsMessage(msg *Message) *ValidationResult {
	result := &ValidationResult{Valid: true}
	// Get running playlists doesn't require any specific fields
	return result
}

// validateDeletePlaylistMessage validates delete playlist messages
func (mv *MessageValidator) validateDeletePlaylistMessage(msg *Message) *ValidationResult {
	result := &ValidationResult{Valid: true}

	// Validate playlist name
	if strings.TrimSpace(msg.PlaylistName) == "" {
		result.Valid = false
		result.Errors = append(result.Errors, ValidationError{
			Field:   "playlistName",
			Value:   msg.PlaylistName,
			Message: "playlist name is required",
			Code:    "PLAYLIST_NAME_REQUIRED",
		})
	}

	return result
}

// validateDeleteImageFromGalleryMessage validates delete image from gallery messages
func (mv *MessageValidator) validateDeleteImageFromGalleryMessage(msg *Message) *ValidationResult {
	result := &ValidationResult{Valid: true}

	// Validate image IDs
	if len(msg.ImageIDs) == 0 {
		result.Valid = false
		result.Errors = append(result.Errors, ValidationError{
			Field:   "imageIds",
			Value:   msg.ImageIDs,
			Message: "image IDs are required",
			Code:    "IMAGE_IDS_REQUIRED",
		})
	} else {
		for i, id := range msg.ImageIDs {
			if id <= 0 {
				result.Valid = false
				result.Errors = append(result.Errors, ValidationError{
					Field:   fmt.Sprintf("imageIds[%d]", i),
					Value:   id,
					Message: "image ID must be positive",
					Code:    "INVALID_IMAGE_ID",
				})
			}
		}
	}

	return result
}

// validateProcessImagesMessage validates process images messages
func (mv *MessageValidator) validateProcessImagesMessage(msg *Message) *ValidationResult {
	result := &ValidationResult{Valid: true}

	// Validate image paths
	if len(msg.ImagePaths) == 0 {
		result.Valid = false
		result.Errors = append(result.Errors, ValidationError{
			Field:   "imagePaths",
			Value:   msg.ImagePaths,
			Message: "image paths are required",
			Code:    "IMAGE_PATHS_REQUIRED",
		})
	} else {
		for i, path := range msg.ImagePaths {
			if strings.TrimSpace(path) == "" {
				result.Valid = false
				result.Errors = append(result.Errors, ValidationError{
					Field:   fmt.Sprintf("imagePaths[%d]", i),
					Value:   path,
					Message: "image path cannot be empty",
					Code:    "EMPTY_IMAGE_PATH",
				})
			}
		}
	}

	// Validate file names
	if len(msg.FileNames) == 0 {
		result.Valid = false
		result.Errors = append(result.Errors, ValidationError{
			Field:   "fileNames",
			Value:   msg.FileNames,
			Message: "file names are required",
			Code:    "FILE_NAMES_REQUIRED",
		})
	} else {
		for i, name := range msg.FileNames {
			if strings.TrimSpace(name) == "" {
				result.Valid = false
				result.Errors = append(result.Errors, ValidationError{
					Field:   fmt.Sprintf("fileNames[%d]", i),
					Value:   name,
					Message: "file name cannot be empty",
					Code:    "EMPTY_FILE_NAME",
				})
			}
		}
	}

	// Validate that arrays have same length
	if len(msg.ImagePaths) != len(msg.FileNames) {
		result.Valid = false
		result.Errors = append(result.Errors, ValidationError{
			Field:   "array_lengths",
			Value:   fmt.Sprintf("imagePaths: %d, fileNames: %d", len(msg.ImagePaths), len(msg.FileNames)),
			Message: "image paths and file names arrays must have the same length",
			Code:    "ARRAY_LENGTH_MISMATCH",
		})
	}

	return result
}

// Helper validation methods

// validateActiveMonitor validates an active monitor configuration
func (mv *MessageValidator) validateActiveMonitor(activeMonitor *monitor.MonitorSelection) *ValidationError {
	if activeMonitor == nil {
		return &ValidationError{
			Field:   "activeMonitor",
			Value:   nil,
			Message: "active monitor cannot be nil",
			Code:    "ACTIVE_MONITOR_NIL",
		}
	}

	if strings.TrimSpace(activeMonitor.ID) == "" {
		return &ValidationError{
			Field:   "activeMonitor.name",
			Value:   activeMonitor.ID,
			Message: "monitor name cannot be empty",
			Code:    "EMPTY_MONITOR_NAME",
		}
	}

	if len(activeMonitor.Monitors) == 0 {
		return &ValidationError{
			Field:   "activeMonitor.monitors",
			Value:   activeMonitor.Monitors,
			Message: "at least one monitor must be specified",
			Code:    "NO_MONITORS_SPECIFIED",
		}
	}

	// Validate each monitor
	for i, monitor := range activeMonitor.Monitors {
		if strings.TrimSpace(monitor.Name) == "" {
			return &ValidationError{
				Field:   fmt.Sprintf("activeMonitor.monitors[%d].name", i),
				Value:   monitor.Name,
				Message: "monitor name cannot be empty",
				Code:    "EMPTY_MONITOR_NAME",
			}
		}

		if monitor.Width <= 0 {
			return &ValidationError{
				Field:   fmt.Sprintf("activeMonitor.monitors[%d].width", i),
				Value:   monitor.Width,
				Message: "monitor width must be positive",
				Code:    "INVALID_MONITOR_WIDTH",
			}
		}

		if monitor.Height <= 0 {
			return &ValidationError{
				Field:   fmt.Sprintf("activeMonitor.monitors[%d].height", i),
				Value:   monitor.Height,
				Message: "monitor height must be positive",
				Code:    "INVALID_MONITOR_HEIGHT",
			}
		}
	}

	// Validate image set type if provided
	if string(activeMonitor.Mode) != "" {
		validTypes := []string{"individual", "extend", "clone"}
		isValid := false
		for _, validType := range validTypes {
			if string(activeMonitor.Mode) == validType {
				isValid = true
				break
			}
		}
		if !isValid {
			return &ValidationError{
				Field:   "activeMonitor.imageSetType",
				Value:   string(activeMonitor.Mode),
				Message: fmt.Sprintf("image set type must be one of: %s", strings.Join(validTypes, ", ")),
				Code:    "INVALID_IMAGE_SET_TYPE",
			}
		}
	}

	return nil
}

// validateImageInfo validates image information
func (mv *MessageValidator) validateImageInfo(image *ImageInfo) *ValidationError {
	if image == nil {
		return &ValidationError{
			Field:   "image",
			Value:   nil,
			Message: "image cannot be nil",
			Code:    "IMAGE_NIL",
		}
	}

	if image.ID <= 0 {
		return &ValidationError{
			Field:   "image.id",
			Value:   image.ID,
			Message: "image ID must be positive",
			Code:    "INVALID_IMAGE_ID",
		}
	}

	if strings.TrimSpace(image.Name) == "" {
		return &ValidationError{
			Field:   "image.name",
			Value:   image.Name,
			Message: "image name cannot be empty",
			Code:    "EMPTY_IMAGE_NAME",
		}
	}

	return nil
}

// validateRendererPlaylist validates a renderer playlist
func (mv *MessageValidator) validateRendererPlaylist(playlist *RendererPlaylist) *ValidationError {
	if playlist == nil {
		return &ValidationError{
			Field:   "playlist",
			Value:   nil,
			Message: "playlist cannot be nil",
			Code:    "PLAYLIST_NIL",
		}
	}

	if strings.TrimSpace(playlist.Name) == "" {
		return &ValidationError{
			Field:   "playlist.name",
			Value:   playlist.Name,
			Message: "playlist name cannot be empty",
			Code:    "EMPTY_PLAYLIST_NAME",
		}
	}

	// Validate playlist configuration
	if err := mv.validatePlaylistConfiguration(&playlist.Configuration); err != nil {
		return err
	}

	// Validate images
	if len(playlist.Images) == 0 {
		return &ValidationError{
			Field:   "playlist.images",
			Value:   playlist.Images,
			Message: "playlist must contain at least one image",
			Code:    "NO_IMAGES_IN_PLAYLIST",
		}
	}

	for i, image := range playlist.Images {
		if image.ID <= 0 {
			return &ValidationError{
				Field:   fmt.Sprintf("playlist.images[%d].id", i),
				Value:   image.ID,
				Message: "image ID must be positive",
				Code:    "INVALID_IMAGE_ID",
			}
		}

		if image.Time != nil && *image.Time < 0 {
			return &ValidationError{
				Field:   fmt.Sprintf("playlist.images[%d].time", i),
				Value:   *image.Time,
				Message: "image time must be non-negative",
				Code:    "INVALID_IMAGE_TIME",
			}
		}
	}

	return nil
}

// validatePlaylistConfiguration validates playlist configuration
func (mv *MessageValidator) validatePlaylistConfiguration(config *PlaylistConfiguration) *ValidationError {
	if config == nil {
		return &ValidationError{
			Field:   "playlist.configuration",
			Value:   nil,
			Message: "playlist configuration cannot be nil",
			Code:    "CONFIGURATION_NIL",
		}
	}

	// Validate playlist type
	validTypes := []string{"timer", "never", "manual", "time_of_day", "day_of_week", "timeofday", "dayofweek"}
	isValidType := false
	for _, validType := range validTypes {
		if config.Type == validType {
			isValidType = true
			break
		}
	}
	if !isValidType {
		return &ValidationError{
			Field:   "playlist.configuration.type",
			Value:   config.Type,
			Message: fmt.Sprintf("playlist type must be one of: %s", strings.Join(validTypes, ", ")),
			Code:    "INVALID_PLAYLIST_TYPE",
		}
	}

	// Validate interval for timer playlists
	if config.Type == "timer" && config.Interval != nil && *config.Interval <= 0 {
		return &ValidationError{
			Field:   "playlist.configuration.interval",
			Value:   *config.Interval,
			Message: "interval must be positive for timer playlists",
			Code:    "INVALID_INTERVAL",
		}
	}

	// Validate order if provided
	if config.Order != nil {
		validOrders := []string{"ordered", "random"}
		isValidOrder := false
		for _, validOrder := range validOrders {
			if *config.Order == validOrder {
				isValidOrder = true
				break
			}
		}
		if !isValidOrder {
			return &ValidationError{
				Field:   "playlist.configuration.order",
				Value:   *config.Order,
				Message: fmt.Sprintf("playlist order must be one of: %s", strings.Join(validOrders, ", ")),
				Code:    "INVALID_PLAYLIST_ORDER",
			}
		}
	}

	// Validate current image index
	if config.CurrentImageIndex < 0 {
		return &ValidationError{
			Field:   "playlist.configuration.currentImageIndex",
			Value:   config.CurrentImageIndex,
			Message: "current image index must be non-negative",
			Code:    "INVALID_CURRENT_IMAGE_INDEX",
		}
	}

	return nil
}

// validateConfigData validates configuration data
func (mv *MessageValidator) validateConfigData(config *ConfigData) *ValidationError {
	if config == nil {
		return &ValidationError{
			Field:   "config",
			Value:   nil,
			Message: "config cannot be nil",
			Code:    "CONFIG_NIL",
		}
	}

	// Check if this is a partial config update
	if config.FrontendConfig != nil {
		return mv.validateFrontendConfig(config.FrontendConfig)
	}

	// Legacy single key-value update
	if config.ConfigSection == "" {
		return &ValidationError{
			Field:   "config.configSection",
			Value:   config.ConfigSection,
			Message: "config section is required for single key updates",
			Code:    "CONFIG_SECTION_REQUIRED",
		}
	}

	if config.ConfigKey == "" {
		return &ValidationError{
			Field:   "config.configKey",
			Value:   config.ConfigKey,
			Message: "config key is required for single key updates",
			Code:    "CONFIG_KEY_REQUIRED",
		}
	}

	// Validate config section
	validSections := []string{"app", "daemon", "backend", "monitors"}
	isValidSection := false
	for _, validSection := range validSections {
		if config.ConfigSection == validSection {
			isValidSection = true
			break
		}
	}
	if !isValidSection {
		return &ValidationError{
			Field:   "config.configSection",
			Value:   config.ConfigSection,
			Message: fmt.Sprintf("config section must be one of: %s", strings.Join(validSections, ", ")),
			Code:    "INVALID_CONFIG_SECTION",
		}
	}

	return nil
}

// validateFrontendConfig validates frontend configuration
func (mv *MessageValidator) validateFrontendConfig(frontendConfig any) *ValidationError {
	configMap, ok := frontendConfig.(map[string]any)
	if !ok {
		return &ValidationError{
			Field:   "config.frontendConfig",
			Value:   frontendConfig,
			Message: "frontend config must be a map",
			Code:    "INVALID_FRONTEND_CONFIG_TYPE",
		}
	}

	// Validate each section
	for sectionName, sectionData := range configMap {
		sectionMap, ok := sectionData.(map[string]any)
		if !ok {
			return &ValidationError{
				Field:   fmt.Sprintf("config.frontendConfig.%s", sectionName),
				Value:   sectionData,
				Message: "config section must be a map",
				Code:    "INVALID_CONFIG_SECTION_TYPE",
			}
		}

		// Validate section-specific fields
		if err := mv.validateConfigSection(sectionName, sectionMap); err != nil {
			return err
		}
	}

	return nil
}

// validateConfigSection validates a specific configuration section
func (mv *MessageValidator) validateConfigSection(sectionName string, sectionMap map[string]any) *ValidationError {
	switch sectionName {
	case "app":
		return mv.validateAppConfig(sectionMap)
	case "daemon":
		return mv.validateDaemonConfig(sectionMap)
	case "backend":
		return mv.validateBackendConfig(sectionMap)
	case "monitors":
		return mv.validateMonitorsConfig(sectionMap)
	default:
		return &ValidationError{
			Field:   fmt.Sprintf("config.frontendConfig.%s", sectionName),
			Value:   sectionName,
			Message: "unknown config section",
			Code:    "UNKNOWN_CONFIG_SECTION",
		}
	}
}

// validateAppConfig validates app configuration
func (mv *MessageValidator) validateAppConfig(config map[string]any) *ValidationError {
	// Validate theme
	if theme, exists := config["theme"]; exists {
		if themeStr, ok := theme.(string); ok {
			validThemes := []string{"light", "dark", "auto", "system"}
			isValid := false
			for _, validTheme := range validThemes {
				if themeStr == validTheme {
					isValid = true
					break
				}
			}
			if !isValid {
				return &ValidationError{
					Field:   "config.frontendConfig.app.theme",
					Value:   themeStr,
					Message: fmt.Sprintf("theme must be one of: %s", strings.Join(validThemes, ", ")),
					Code:    "INVALID_THEME",
				}
			}
		} else {
			return &ValidationError{
				Field:   "config.frontendConfig.app.theme",
				Value:   theme,
				Message: "theme must be a string",
				Code:    "INVALID_THEME_TYPE",
			}
		}
	}

	// Validate images_per_page
	if imagesPerPage, exists := config["images_per_page"]; exists {
		if imagesPerPageInt, ok := imagesPerPage.(int); ok {
			if imagesPerPageInt <= 0 {
				return &ValidationError{
					Field:   "config.frontendConfig.app.images_per_page",
					Value:   imagesPerPageInt,
					Message: "images per page must be positive",
					Code:    "INVALID_IMAGES_PER_PAGE",
				}
			}
		} else if imagesPerPageFloat, ok := imagesPerPage.(float64); ok {
			if imagesPerPageFloat != float64(int(imagesPerPageFloat)) || imagesPerPageFloat <= 0 {
				return &ValidationError{
					Field:   "config.frontendConfig.app.images_per_page",
					Value:   imagesPerPageFloat,
					Message: "images per page must be a positive integer",
					Code:    "INVALID_IMAGES_PER_PAGE",
				}
			}
		} else {
			return &ValidationError{
				Field:   "config.frontendConfig.app.images_per_page",
				Value:   imagesPerPage,
				Message: "images per page must be a number",
				Code:    "INVALID_IMAGES_PER_PAGE_TYPE",
			}
		}
	}

	// Validate image_history_limit
	if historyLimit, exists := config["image_history_limit"]; exists {
		if historyLimitInt, ok := historyLimit.(int); ok {
			if historyLimitInt <= 0 {
				return &ValidationError{
					Field:   "config.frontendConfig.app.image_history_limit",
					Value:   historyLimitInt,
					Message: "image history limit must be positive",
					Code:    "INVALID_IMAGE_HISTORY_LIMIT",
				}
			}
		} else if historyLimitFloat, ok := historyLimit.(float64); ok {
			if historyLimitFloat != float64(int(historyLimitFloat)) || historyLimitFloat <= 0 {
				return &ValidationError{
					Field:   "config.frontendConfig.app.image_history_limit",
					Value:   historyLimitFloat,
					Message: "image history limit must be a positive integer",
					Code:    "INVALID_IMAGE_HISTORY_LIMIT",
				}
			}
		} else {
			return &ValidationError{
				Field:   "config.frontendConfig.app.image_history_limit",
				Value:   historyLimit,
				Message: "image history limit must be a number",
				Code:    "INVALID_IMAGE_HISTORY_LIMIT_TYPE",
			}
		}
	}

	return nil
}

// validateDaemonConfig validates daemon configuration
func (mv *MessageValidator) validateDaemonConfig(config map[string]any) *ValidationError {
	// Validate log_level
	if logLevel, exists := config["log_level"]; exists {
		if logLevelStr, ok := logLevel.(string); ok {
			validLevels := []string{"debug", "info", "warn", "error"}
			isValid := false
			for _, validLevel := range validLevels {
				if logLevelStr == validLevel {
					isValid = true
					break
				}
			}
			if !isValid {
				return &ValidationError{
					Field:   "config.frontendConfig.daemon.log_level",
					Value:   logLevelStr,
					Message: fmt.Sprintf("log level must be one of: %s", strings.Join(validLevels, ", ")),
					Code:    "INVALID_LOG_LEVEL",
				}
			}
		} else {
			return &ValidationError{
				Field:   "config.frontendConfig.daemon.log_level",
				Value:   logLevel,
				Message: "log level must be a string",
				Code:    "INVALID_LOG_LEVEL_TYPE",
			}
		}
	}

	// Validate compositor
	if compositor, exists := config["compositor"]; exists {
		if compositorStr, ok := compositor.(string); ok {
			validCompositors := []string{"auto", "x11", "wayland", "sway", "hyprland", "gnome", "kde"}
			isValid := false
			for _, validCompositor := range validCompositors {
				if compositorStr == validCompositor {
					isValid = true
					break
				}
			}
			if !isValid {
				return &ValidationError{
					Field:   "config.frontendConfig.daemon.compositor",
					Value:   compositorStr,
					Message: fmt.Sprintf("compositor must be one of: %s", strings.Join(validCompositors, ", ")),
					Code:    "INVALID_COMPOSITOR",
				}
			}
		} else {
			return &ValidationError{
				Field:   "config.frontendConfig.daemon.compositor",
				Value:   compositor,
				Message: "compositor must be a string",
				Code:    "INVALID_COMPOSITOR_TYPE",
			}
		}
	}

	return nil
}

// validateBackendConfig validates backend configuration
func (mv *MessageValidator) validateBackendConfig(config map[string]any) *ValidationError {
	// Validate backend type
	if backendType, exists := config["type"]; exists {
		if backendTypeStr, ok := backendType.(string); ok {
			validTypes := []string{"swww", "feh", "nitrogen", "hyprpaper", "wallutils", "custom"}
			isValid := false
			for _, validType := range validTypes {
				if backendTypeStr == validType {
					isValid = true
					break
				}
			}
			if !isValid {
				return &ValidationError{
					Field:   "config.frontendConfig.backend.type",
					Value:   backendTypeStr,
					Message: fmt.Sprintf("backend type must be one of: %s", strings.Join(validTypes, ", ")),
					Code:    "INVALID_BACKEND_TYPE",
				}
			}
		} else {
			return &ValidationError{
				Field:   "config.frontendConfig.backend.type",
				Value:   backendType,
				Message: "backend type must be a string",
				Code:    "INVALID_BACKEND_TYPE_TYPE",
			}
		}
	}

	// Validate swww config if present
	if swwwConfig, exists := config["swww"]; exists {
		if swwwMap, ok := swwwConfig.(map[string]any); ok {
			if err := mv.validateSwwwConfig(swwwMap); err != nil {
				return err
			}
		} else {
			return &ValidationError{
				Field:   "config.frontendConfig.backend.swww",
				Value:   swwwConfig,
				Message: "swww config must be a map",
				Code:    "INVALID_SWWW_CONFIG_TYPE",
			}
		}
	}

	return nil
}

// validateSwwwConfig validates swww configuration
func (mv *MessageValidator) validateSwwwConfig(config map[string]any) *ValidationError {
	// Validate transition_type
	if transitionType, exists := config["transition_type"]; exists {
		if transitionTypeStr, ok := transitionType.(string); ok {
			validTypes := []string{"simple", "wipe", "grow", "outer", "wave", "fade", "left", "right", "top", "bottom", "center", "any", "random"}
			isValid := false
			for _, validType := range validTypes {
				if transitionTypeStr == validType {
					isValid = true
					break
				}
			}
			if !isValid {
				return &ValidationError{
					Field:   "config.frontendConfig.backend.swww.transition_type",
					Value:   transitionTypeStr,
					Message: fmt.Sprintf("transition type must be one of: %s", strings.Join(validTypes, ", ")),
					Code:    "INVALID_TRANSITION_TYPE",
				}
			}
		} else {
			return &ValidationError{
				Field:   "config.frontendConfig.backend.swww.transition_type",
				Value:   transitionType,
				Message: "transition type must be a string",
				Code:    "INVALID_TRANSITION_TYPE_TYPE",
			}
		}
	}

	// Validate transition_duration
	if transitionDuration, exists := config["transition_duration"]; exists {
		if transitionDurationInt, ok := transitionDuration.(int); ok {
			if transitionDurationInt <= 0 {
				return &ValidationError{
					Field:   "config.frontendConfig.backend.swww.transition_duration",
					Value:   transitionDurationInt,
					Message: "transition duration must be positive",
					Code:    "INVALID_TRANSITION_DURATION",
				}
			}
		} else if transitionDurationFloat, ok := transitionDuration.(float64); ok {
			if transitionDurationFloat != float64(int(transitionDurationFloat)) || transitionDurationFloat <= 0 {
				return &ValidationError{
					Field:   "config.frontendConfig.backend.swww.transition_duration",
					Value:   transitionDurationFloat,
					Message: "transition duration must be a positive integer",
					Code:    "INVALID_TRANSITION_DURATION",
				}
			}
		} else {
			return &ValidationError{
				Field:   "config.frontendConfig.backend.swww.transition_duration",
				Value:   transitionDuration,
				Message: "transition duration must be a number",
				Code:    "INVALID_TRANSITION_DURATION_TYPE",
			}
		}
	}

	return nil
}

// validateMonitorsConfig validates monitors configuration
func (mv *MessageValidator) validateMonitorsConfig(config map[string]any) *ValidationError {
	// Validate selected_monitors
	if selectedMonitors, exists := config["selected_monitors"]; exists {
		if monitorsSlice, ok := selectedMonitors.([]any); ok {
			for i, monitor := range monitorsSlice {
				if monitorStr, ok := monitor.(string); ok {
					if strings.TrimSpace(monitorStr) == "" {
						return &ValidationError{
							Field:   fmt.Sprintf("config.frontendConfig.monitors.selected_monitors[%d]", i),
							Value:   monitorStr,
							Message: "monitor name cannot be empty",
							Code:    "EMPTY_MONITOR_NAME",
						}
					}
				} else {
					return &ValidationError{
						Field:   fmt.Sprintf("config.frontendConfig.monitors.selected_monitors[%d]", i),
						Value:   monitor,
						Message: "monitor name must be a string",
						Code:    "INVALID_MONITOR_NAME_TYPE",
					}
				}
			}
		} else {
			return &ValidationError{
				Field:   "config.frontendConfig.monitors.selected_monitors",
				Value:   selectedMonitors,
				Message: "selected monitors must be an array",
				Code:    "INVALID_SELECTED_MONITORS_TYPE",
			}
		}
	}

	// Validate image_set_type
	if imageSetType, exists := config["image_set_type"]; exists {
		if imageSetTypeStr, ok := imageSetType.(string); ok {
			validTypes := []string{"individual", "extend", "clone"}
			isValid := false
			for _, validType := range validTypes {
				if imageSetTypeStr == validType {
					isValid = true
					break
				}
			}
			if !isValid {
				return &ValidationError{
					Field:   "config.frontendConfig.monitors.image_set_type",
					Value:   imageSetTypeStr,
					Message: fmt.Sprintf("image set type must be one of: %s", strings.Join(validTypes, ", ")),
					Code:    "INVALID_IMAGE_SET_TYPE",
				}
			}
		} else {
			return &ValidationError{
				Field:   "config.frontendConfig.monitors.image_set_type",
				Value:   imageSetType,
				Message: "image set type must be a string",
				Code:    "INVALID_IMAGE_SET_TYPE_TYPE",
			}
		}
	}

	return nil
}
