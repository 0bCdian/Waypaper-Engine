package store

import (
	"fmt"
	"log/slog"
	"strings"
	"time"
)

// ValidationResult represents the result of playlist validation
type ValidationResult struct {
	IsValid  bool                `json:"is_valid"`
	Errors   []ValidationError   `json:"errors"`
	Warnings []ValidationWarning `json:"warnings"`
	Fixes    []ValidationFix     `json:"fixes"`
	Metadata ValidationMetadata  `json:"metadata"`
}

// ValidationError represents a critical issue that prevents playlist operation
type ValidationError struct {
	Code       string      `json:"code"`
	Message    string      `json:"message"`
	Severity   string      `json:"severity"`
	Suggestion string      `json:"suggestion"`
	Field      string      `json:"field"`
	Value      interface{} `json:"value"`
}

// ValidationWarning represents a non-critical issue
type ValidationWarning struct {
	Code       string `json:"code"`
	Message    string `json:"message"`
	Suggestion string `json:"suggestion"`
}

// ValidationFix represents an automated fix that can be applied
type ValidationFix struct {
	Code    string `json:"code"`
	Message string `json:"message"`
	Action  string `json:"action"`
	Field   string `json:"field"`
}

// ValidationMetadata contains validation metadata
type ValidationMetadata struct {
	ValidatedAt      time.Time `json:"validated_at"`
	ValidatorVersion string    `json:"validator_version"`
	TotalChecks      int       `json:"total_checks"`
	ErrorsFound      int       `json:"errors_found"`
	WarningsFound    int       `json:"warnings_found"`
	FixesAvailable   int       `json:"fixes_available"`
}

// PlaylistValidator performs validation and repair operations on playlists
type PlaylistValidator struct {
	logger        *slog.Logger
	playlistStore *PlaylistStore
}

// NewPlaylistValidator creates a new playlist validator
func NewPlaylistValidator(playlistStore *PlaylistStore, logger *slog.Logger) *PlaylistValidator {
	return &PlaylistValidator{
		logger:        logger,
		playlistStore: playlistStore,
	}
}

// ValidatePlaylist performs comprehensive validation on a playlist
func (pv *PlaylistValidator) ValidatePlaylist(playlist *Playlist) *ValidationResult {
	result := &ValidationResult{
		IsValid:  true,
		Errors:   []ValidationError{},
		Warnings: []ValidationWarning{},
		Fixes:    []ValidationFix{},
		Metadata: ValidationMetadata{
			ValidatedAt:      time.Now(),
			ValidatorVersion: "1.0",
		},
	}

	// Run validation checks
	pv.validateBasicFields(playlist, result)
	pv.validatePlaylistMetadata(playlist, result)
	pv.validatePlaylistImages(playlist, result)
	pv.validatePlaylistConfiguration(playlist, result)
	pv.validatePlaylistConsistency(playlist, result)

	// Update metadata
	result.Metadata.TotalChecks = 8
	result.Metadata.ErrorsFound = len(result.Errors)
	result.Metadata.WarningsFound = len(result.Warnings)
	result.Metadata.FixesAvailable = len(result.Fixes)

	result.IsValid = len(result.Errors) == 0

	pv.logger.Info("playlist validation completed",
		"playlist", playlist.Name,
		"valid", result.IsValid,
		"errors", len(result.Errors),
		"warnings", len(result.Warnings),
		"fixes", len(result.Fixes))

	return result
}

// validateBasicFields validates basic playlist fields
func (pv *PlaylistValidator) validateBasicFields(playlist *Playlist, result *ValidationResult) {
	// Check playlist name
	if playlist.Name == "" {
		result.Errors = append(result.Errors, ValidationError{
			Code:       "EMPTY_NAME",
			Message:    "Playlist name cannot be empty",
			Severity:   "critical",
			Suggestion: "Provide a valid playlist name",
			Field:      "name",
			Value:      playlist.Name,
		})
	} else if len(playlist.Name) > 100 {
		result.Warnings = append(result.Warnings, ValidationWarning{
			Code:       "NAME_TOO_LONG",
			Message:    "Playlist name is very long",
			Suggestion: "Consider shortening the playlist name",
		})
	}

	// Check playlist ID
	if playlist.ID == "" {
		result.Errors = append(result.Errors, ValidationError{
			Code:       "EMPTY_ID",
			Message:    "Playlist ID cannot be empty",
			Severity:   "critical",
			Suggestion: "Generate a unique playlist ID",
			Field:      "id",
			Value:      playlist.ID,
		})
		result.Fixes = append(result.Fixes, ValidationFix{
			Code:    "GENERATE_ID",
			Message: "Generate unique playlist ID",
			Action:  "auto_generate",
			Field:   "id",
		})
	}
}

// validatePlaylistMetadata validates playlist-specific metadata
func (pv *PlaylistValidator) validatePlaylistMetadata(playlist *Playlist, result *ValidationResult) {
	// Check metadata existence
	if playlist.Metadata.Version == "" {
		result.Warnings = append(result.Warnings, ValidationWarning{
			Code:       "NO_METADATA_VERSION",
			Message:    "Playlist metadata is missing version",
			Suggestion: "Set metadata version to current version",
		})
		result.Fixes = append(result.Fixes, ValidationFix{
			Code:    "SET_METADATA_VERSION",
			Message: "Set metadata version",
			Action:  "auto_update",
			Field:   "metadata.version",
		})
	}

	// Check metadata timestamps
	if playlist.Metadata.CreatedAt.IsZero() {
		result.Warnings = append(result.Warnings, ValidationWarning{
			Code:       "NO_CREATED_AT",
			Message:    "Playlist metadata is missing creation time",
			Suggestion: "Set creation timestamp",
		})
		result.Fixes = append(result.Fixes, ValidationFix{
			Code:    "SET_CREATED_AT",
			Message: "Set creation time",
			Action:  "auto_update",
			Field:   "metadata.created_at",
		})
	}

	if playlist.Metadata.LastModified.IsZero() {
		result.Fixes = append(result.Fixes, ValidationFix{
			Code:    "SET_LAST_MODIFIED",
			Message: "Set last modified time",
			Action:  "auto_update",
			Field:   "metadata.last_modified",
		})
	}
}

// validatePlaylistImages validates playlist images
func (pv *PlaylistValidator) validatePlaylistImages(playlist *Playlist, result *ValidationResult) {
	// Check if playlist has images
	if len(playlist.Images) == 0 {
		result.Errors = append(result.Errors, ValidationError{
			Code:       "NO_IMAGES",
			Message:    "Playlist has no images",
			Severity:   "critical",
			Suggestion: "Add images to the playlist",
			Field:      "images",
			Value:      len(playlist.Images),
		})
		return
	}

	// Check image integrity
	for i, image := range playlist.Images {
		if image.ImageID == "" {
			result.Errors = append(result.Errors, ValidationError{
				Code:       "EMPTY_IMAGE_ID",
				Message:    "Image ID cannot be empty",
				Severity:   "critical",
				Suggestion: "Provide valid image ID",
				Field:      fmt.Sprintf("images[%d].imageId", i),
				Value:      image.ImageID,
			})
		}

		if image.ImagePath == "" {
			result.Errors = append(result.Errors, ValidationError{
				Code:       "EMPTY_IMAGE_PATH",
				Message:    "Image path cannot be empty",
				Severity:   "critical",
				Suggestion: "Provide valid image path",
				Field:      fmt.Sprintf("images[%d].imagePath", i),
				Value:      image.ImagePath,
			})
		}

		if image.Index < 0 || image.Index >= len(playlist.Images) {
			result.Warnings = append(result.Warnings, ValidationWarning{
				Code:       "INVALID_IMAGE_INDEX",
				Message:    "Image index is out of bounds",
				Suggestion: "Verify image ordering",
			})
		}

		// Check for duplicate images by ID
		for j, otherImage := range playlist.Images {
			if i != j && image.ImageID == otherImage.ImageID {
				result.Warnings = append(result.Warnings, ValidationWarning{
					Code:       "DUPLICATE_IMAGE",
					Message:    "Duplicate image ID found in playlist",
					Suggestion: "Remove duplicate images",
				})
			}
		}
	}
}

// validatePlaylistConfiguration validates playlist configuration
func (pv *PlaylistValidator) validatePlaylistConfiguration(playlist *Playlist, result *ValidationResult) {
	config := playlist.Configuration

	// Check playlist type
	validTypes := []string{"timer", "never", "timeofday", "dayofweek"}
	isValidType := false
	for _, t := range validTypes {
		if strings.ToLower(config.Type) == t {
			isValidType = true
			break
		}
	}

	if !isValidType {
		result.Errors = append(result.Errors, ValidationError{
			Code:       "INVALID_TYPE",
			Message:    "Playlist type is invalid",
			Severity:   "critical",
			Suggestion: "Use a valid playlist type",
			Field:      "configuration.type",
			Value:      config.Type,
		})
		result.Fixes = append(result.Fixes, ValidationFix{
			Code:    "SET_DEFAULT_TYPE",
			Message: "Set default playlist type",
			Action:  "auto_fix",
			Field:   "configuration.type",
		})
	}

	// Validate timer playlist configuration
	if strings.ToLower(config.Type) == "timer" {
		if config.Interval == nil || *config.Interval <= 0 {
			result.Errors = append(result.Errors, ValidationError{
				Code:       "INVALID_INTERVAL",
				Message:    "Timer playlist must have positive interval",
				Severity:   "critical",
				Suggestion: "Set a valid interval value",
				Field:      "configuration.interval",
				Value:      config.Interval,
			})
			result.Fixes = append(result.Fixes, ValidationFix{
				Code:    "SET_DEFAULT_INTERVAL",
				Message: "Set default interval (5 minutes)",
				Action:  "auto_fix",
				Field:   "configuration.interval",
			})
		}
	}

	// Validate order configuration
	if config.Order == "" {
		result.Warnings = append(result.Warnings, ValidationWarning{
			Code:       "EMPTY_ORDER",
			Message:    "Playlist order is not specified",
			Suggestion: "Set order to 'sequential' or 'random'",
		})
		result.Fixes = append(result.Fixes, ValidationFix{
			Code:    "SET_DEFAULT_ORDER",
			Message: "Set default order",
			Action:  "auto_fix",
			Field:   "configuration.order",
		})
	}
}

// validatePlaylistConsistency validates playlist consistency
func (pv *PlaylistValidator) validatePlaylistConsistency(playlist *Playlist, result *ValidationResult) {
	// Check order configuration
	validOrders := []string{"sequential", "random", "manual"}
	isValidOrder := false
	for _, o := range validOrders {
		if strings.ToLower(playlist.Configuration.Order) == o {
			isValidOrder = true
			break
		}
	}
	if !isValidOrder {
		result.Warnings = append(result.Warnings, ValidationWarning{
			Code:       "INVALID_ORDER",
			Message:    "Playlist order configuration is invalid",
			Suggestion: "Use 'sequential', 'random', or 'manual' order",
		})
		result.Fixes = append(result.Fixes, ValidationFix{
			Code:    "SET_DEFAULT_ORDER",
			Message: "Set default order",
			Action:  "auto_fix",
			Field:   "configuration.order",
		})
	}

	// Check for time-based playlist specific validations
	if strings.ToLower(playlist.Configuration.Type) == "timeofday" {
		// Validate time-based playlist has progression logic
		if len(playlist.Images) < 2 {
			result.Warnings = append(result.Warnings, ValidationWarning{
				Code:       "MINIMAL_IMAGES_TIMEOFDAY",
				Message:    "Time-of-day playlist has minimal images",
				Suggestion: "Consider adding more images for better time progression",
			})
		}
	}

	// Check transition settings
	if playlist.Configuration.Transition != nil {
		if playlist.Configuration.Transition.Duration < 0 {
			result.Warnings = append(result.Warnings, ValidationWarning{
				Code:       "INVALID_TRANSITION_DURATION",
				Message:    "Transition duration cannot be negative",
				Suggestion: "Set positive transition duration",
			})
		}
	}
}

// RepairPlaylist applies available fixes to repair a playlist
func (pv *PlaylistValidator) RepairPlaylist(playlist *Playlist, fixes []ValidationFix) error {
	pv.logger.Info("repairing playlist", "playlist", playlist.Name, "fixes", len(fixes))

	modified := false

	for _, fix := range fixes {
		switch fix.Code {
		case "GENERATE_ID":
			if playlist.ID == "" {
				playlist.ID = generateUUID()
				modified = true
			}

		case "SET_METADATA_VERSION":
			if playlist.Metadata.Version == "" {
				playlist.Metadata.Version = "1.0"
				modified = true
			}

		case "SET_CREATED_AT":
			if playlist.Metadata.CreatedAt.IsZero() {
				playlist.Metadata.CreatedAt = time.Now()
				modified = true
			}

		case "SET_LAST_MODIFIED":
			playlist.Metadata.LastModified = time.Now()
			modified = true

		case "SET_DEFAULT_TYPE":
			if !isValidType(playlist.Configuration.Type) {
				playlist.Configuration.Type = "timer"
				modified = true
			}

		case "SET_DEFAULT_INTERVAL":
			if playlist.Configuration.Interval == nil || *playlist.Configuration.Interval <= 0 {
				defaultInterval := 5
				playlist.Configuration.Interval = &defaultInterval
				modified = true
			}

		case "VALIDATE_IMAGE_INDEXES":
			// Ensure image indexes are valid
			for i, image := range playlist.Images {
				if image.Index < 0 || image.Index >= len(playlist.Images) {
					image.Index = i
					modified = true
				}
			}

		case "SET_DEFAULT_ORDER":
			if !isValidOrder(playlist.Configuration.Order) {
				playlist.Configuration.Order = "sequential"
				modified = true
			}
		}
	}

	if modified {
		pv.logger.Info("playlist repaired", "playlist", playlist.Name)
		return pv.playlistStore.SavePlaylist(playlist)
	}

	return nil
}

// Helper functions
func isValidType(playlistType string) bool {
	validTypes := []string{"timer", "never", "timeofday", "dayofweek"}
	for _, t := range validTypes {
		if strings.ToLower(playlistType) == t {
			return true
		}
	}
	return false
}

func isValidOrder(order string) bool {
	validOrders := []string{"sequential", "random"}
	for _, o := range validOrders {
		if strings.ToLower(order) == o {
			return true
		}
	}
	return false
}

// ValidateAllPlaylists validates all playlists in the store
func (pv *PlaylistValidator) ValidateAllPlaylists() map[string]*ValidationResult {
	pv.logger.Info("validating all playlists")

	results := make(map[string]*ValidationResult)

	playlists, err := pv.playlistStore.GetAllPlaylists()
	if err != nil {
		pv.logger.Error("failed to get playlists for validation", "error", err)
		return results
	}

	for _, playlist := range playlists {
		results[playlist.Name] = pv.ValidatePlaylist(playlist)
	}

	pv.logger.Info("completed playlist validation",
		"total_playlists", len(playlists),
		"valid_playlists", countValidPlaylists(results),
		"invalid_playlists", countInvalidPlaylists(results))

	return results
}

func countValidPlaylists(results map[string]*ValidationResult) int {
	count := 0
	for _, result := range results {
		if result.IsValid {
			count++
		}
	}
	return count
}

func countInvalidPlaylists(results map[string]*ValidationResult) int {
	count := 0
	for _, result := range results {
		if !result.IsValid {
			count++
		}
	}
	return count
}
