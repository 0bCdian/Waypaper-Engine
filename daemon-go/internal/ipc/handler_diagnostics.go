package ipc

// handleGetDiagnostics returns diagnostic information for running playlists
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
