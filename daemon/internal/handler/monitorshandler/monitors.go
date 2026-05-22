package monitorshandler

import (
	"net/http"

	"github.com/go-chi/chi/v5"

	"waypaper-engine/daemon/internal/handler/httpjson"
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
//
// @Summary      List connected monitors
// @Tags         monitors
// @Success      200  {array}   monitor.Monitor
// @Failure      500  {object}  httpjson.APIError
// @Router       /monitors [get]
func (h *MonitorHandler) List(w http.ResponseWriter, r *http.Request) {
	// Force refresh to ensure fresh data.
	if err := h.manager.Refresh(r.Context()); err != nil {
		httpjson.WriteError(w, http.StatusInternalServerError, err.Error())
		return
	}

	monitors, err := h.manager.GetMonitors(r.Context())
	if err != nil {
		httpjson.WriteError(w, http.StatusInternalServerError, err.Error())
		return
	}

	httpjson.WriteJSON(w, http.StatusOK, monitors)
}

// Get handles GET /monitors/{name}.
//
// @Summary      Get a monitor by name
// @Tags         monitors
// @Param        name  path      string  true  "Monitor name"
// @Success      200   {object}  monitor.Monitor
// @Failure      404   {object}  httpjson.APIError
// @Router       /monitors/{name} [get]
func (h *MonitorHandler) Get(w http.ResponseWriter, r *http.Request) {
	name := chi.URLParam(r, "name")

	mon, err := h.manager.GetMonitorByName(r.Context(), name)
	if err != nil {
		httpjson.WriteError(w, http.StatusNotFound, err.Error())
		return
	}

	httpjson.WriteJSON(w, http.StatusOK, mon)
}
