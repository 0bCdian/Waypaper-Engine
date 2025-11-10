package ipc

// System handlers

func (h *Handler) handleGetMonitors(msg *Message) *Response {
	// Get monitor information from the monitor manager
	monitors := h.monitorManager.GetMonitors()
	return &Response{Action: msg.Action, Data: monitors}
}

func (h *Handler) handleGetDaemonStatus(msg *Message) *Response {
	// Get image count
	registry, err := h.jsonDBManager.LoadImageGallery()
	imageCount := 0
	if err == nil && registry != nil {
		imageCount = len(registry)
	}

	// Get running playlists count
	runningPlaylists := h.playlistManager.GetRunningPlaylists()
	playlistCount := len(runningPlaylists)

	// Return comprehensive daemon status information
	status := map[string]any{
		"running":   true,
		"uptime":    "unknown", // Could be implemented with start time tracking
		"version":   "2.0.0",   // Could be read from build info
		"monitors":  len(h.monitorManager.GetMonitors()),
		"playlists": playlistCount,
		"images":    imageCount,
	}

	return &Response{Action: msg.Action, Data: status}
}

func (h *Handler) handleKillDaemon(msg *Message) *Response {
	h.logger.Info("kill daemon requested")
	// For now, just return success - actual daemon termination will be handled by the main process
	return &Response{Action: msg.Action, Data: "daemon_kill_requested"}
}

func (h *Handler) handleStopDaemon(msg *Message) *Response {
	h.logger.Info("stop daemon requested")
	// For now, just return success - actual daemon termination will be handled by the main process
	return &Response{Action: msg.Action, Data: "daemon_stop_requested"}
}

func (h *Handler) handleGetDiagnostics(msg *Message) *Response {
	// If monitor name is provided, get diagnostics for that monitor only
	if msg.MonitorName != "" {
		diag, err := h.playlistManager.GetDiagnostics(msg.MonitorName)
		if err != nil {
			h.logger.Error("failed to get diagnostics", "monitor", msg.MonitorName, "error", err)
			return &Response{
				Action: msg.Action,
				Error:  "failed to get playlist diagnostics",
			}
		}

		// If no playlist is running on this monitor, return empty response
		if diag == nil {
			return &Response{
				Action: msg.Action,
				Data:   nil,
			}
		}

		return &Response{
			Action: msg.Action,
			Data:   diag,
		}
	}

	// Otherwise, get diagnostics for all monitors
	allDiag, err := h.playlistManager.GetAllDiagnostics()
	if err != nil {
		h.logger.Error("failed to get all diagnostics", "error", err)
		return &Response{
			Action: msg.Action,
			Error:  "failed to get all playlist diagnostics",
		}
	}

	return &Response{
		Action: msg.Action,
		Data:   allDiag,
	}
}

func (h *Handler) handlePing(msg *Message) *Response {
	h.logger.Debug("ping received", "messageId", msg.MessageID)
	return &Response{
		Action:    "pong",
		MessageID: msg.MessageID,
		Data:      "pong",
	}
}

func (h *Handler) handleGetInfo(msg *Message) *Response {
	// System info
	info := map[string]interface{}{
		"status":  "running",
		"version": "2.0.0",
	}
	return &Response{Action: msg.Action, Data: info}
}

