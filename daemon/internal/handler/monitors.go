package handler

import (
	"net/http"

	"github.com/go-chi/chi/v5"

	"waypaper-engine/daemon/internal/monitor"
)

// MonitorHandler handles /monitors endpoints.
type MonitorHandler struct {
	manager monitor.MonitorManager
}

// NewMonitorHandler creates a MonitorHandler.
func NewMonitorHandler(manager monitor.MonitorManager) *MonitorHandler {
	return &MonitorHandler{manager: manager}
}

// List handles GET /monitors.
func (h *MonitorHandler) List(w http.ResponseWriter, r *http.Request) {
	// Force refresh to ensure fresh data.
	if err := h.manager.Refresh(r.Context()); err != nil {
		WriteError(w, http.StatusInternalServerError, err.Error())
		return
	}

	monitors, err := h.manager.GetMonitors(r.Context())
	if err != nil {
		WriteError(w, http.StatusInternalServerError, err.Error())
		return
	}

	WriteJSON(w, http.StatusOK, monitors)
}

// Get handles GET /monitors/{name}.
func (h *MonitorHandler) Get(w http.ResponseWriter, r *http.Request) {
	name := chi.URLParam(r, "name")

	mon, err := h.manager.GetMonitorByName(r.Context(), name)
	if err != nil {
		WriteError(w, http.StatusNotFound, err.Error())
		return
	}

	WriteJSON(w, http.StatusOK, mon)
}
