package ipc

import (
	"errors"
	"fmt"
	"time"

	"waypaper-engine/daemon-go/internal/backend"
	"waypaper-engine/daemon-go/internal/events"
	"waypaper-engine/daemon-go/internal/monitor"
)

// Configuration handlers

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
			"show_monitor_modal_on_start": config.App.ShowMonitorModalOnStart,
			"images_per_page":             config.App.ImagesPerPage,
			"theme":                       config.App.Theme,
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

	return &Response{Action: msg.Action, Data: frontendConfig}
}

func (h *Handler) handleUpsertConfig(msg *Message) *Response {
	if msg.Config == nil {
		return &Response{Action: msg.Action, Error: errors.New("config is required").Error()}
	}

	// Check if this is a partial config update (FrontendConfig is provided)
	if msg.Config.FrontendConfig != nil {
		return h.handlePartialConfigUpdate(msg)
	}

	// Legacy single key-value update
	if msg.Config.ConfigSection == "" || msg.Config.ConfigKey == "" {
		return &Response{Action: msg.Action, Error: errors.New("config section and key are required for single key updates").Error()}
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
		return &Response{Action: msg.Action, Error: errors.New("unknown config section: " + section).Error()}
	}

	if err != nil {
		h.logger.Error("failed to set config", "error", err, "section", section, "key", key, "value", value)
		return &Response{Action: msg.Action, Error: err.Error()}
	}

	h.logger.Info("config updated", "section", section, "key", key, "value", value)

	// Broadcast config change event to frontend
	if h.server != nil {
		h.server.BroadcastEvent(&events.Event{
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
func (h *Handler) handlePartialConfigUpdate(msg *Message) *Response {
	frontendConfig, ok := msg.Config.FrontendConfig.(map[string]any)
	if !ok {
		return &Response{Action: msg.Action, Error: errors.New("frontendConfig must be a map").Error()}
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
			h.server.BroadcastEvent(&events.Event{
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

		// Validation removed - typeRegistry not available
		// TODO: Add proper validation when available
		_ = sectionMap // Avoid unused variable warning
	}

	return nil
}

// Helper methods for setting config values by section
func (h *Handler) setAppConfigValue(key string, value any) error {
	return h.configManager.SetAppConfig(key, value)
}

func (h *Handler) setDaemonConfigValue(key string, value any) error {
	// For daemon config, we need to update the TOML file directly
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
			config.Backend.Swww.TransitionType = backend.TransitionType(v)
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
func (h *Handler) validateActiveMonitorConfig(activeMonitor *monitor.MonitorSelection) error {
	if activeMonitor == nil {
		return fmt.Errorf("active monitor is nil")
	}

	if len(activeMonitor.Monitors) == 0 {
		return fmt.Errorf("no monitors selected")
	}

	monitorCount := len(activeMonitor.Monitors)
	imageSetType := string(activeMonitor.Mode)

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

func (h *Handler) handleSetSelectedMonitor(msg *Message) *Response {
	// Set the selected monitor configuration
	if msg.ActiveMonitor == nil {
		return &Response{Action: msg.Action, Error: errors.New("active monitor is required").Error()}
	}

	// Validate monitor configuration
	if err := h.validateActiveMonitorConfig(msg.ActiveMonitor); err != nil {
		h.logger.Error("invalid monitor configuration", "error", err)
		return &Response{Action: msg.Action, Error: err.Error()}
	}

	// Update in-memory state
	err := h.configManager.SetActiveMonitor(h.monitorManager, msg.ActiveMonitor)
	if err != nil {
		return &Response{Action: msg.Action, Error: err.Error()}
	}

	// ALSO save to TOML config for persistence
	selectedMonitors := make([]string, len(msg.ActiveMonitor.Monitors))
	for i, monitor := range msg.ActiveMonitor.Monitors {
		selectedMonitors[i] = monitor.Name
	}

	// Use the imageSetType from frontend, fallback to individual
	imageSetType := "individual"
	if string(msg.ActiveMonitor.Mode) != "" {
		imageSetType = string(msg.ActiveMonitor.Mode)
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
	return &Response{Action: msg.Action, Data: "monitor configuration updated"}
}

func (h *Handler) handleGetSelectedMonitor(msg *Message) *Response {
	// Return the stored active monitor configuration
	activeMonitor, err := h.configManager.GetActiveMonitor()
	if err != nil {
		return &Response{Action: msg.Action, Error: err.Error()}
	}
	return &Response{Action: msg.Action, Data: activeMonitor}
}

