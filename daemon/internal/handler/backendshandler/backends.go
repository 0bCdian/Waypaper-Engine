package backendshandler

import (
	"net/http"

	"github.com/go-chi/chi/v5"

	"waypaper-engine/daemon/internal/backend"
	"waypaper-engine/daemon/internal/control"
	"waypaper-engine/daemon/internal/handler/httpjson"
)

// BackendHandler handles /backends endpoints.
type BackendHandler struct {
	registry backend.Registry
	control  *control.Controller
}

// NewBackendHandler creates a BackendHandler.
func NewBackendHandler(registry backend.Registry, control *control.Controller) *BackendHandler {
	return &BackendHandler{
		registry: registry,
		control:  control,
	}
}

// List handles GET /backends.
//
// @Summary      List available backends
// @Tags         backends
// @Success      200  {array}   backend.BackendInfo
// @Router       /backends [get]
func (h *BackendHandler) List(w http.ResponseWriter, r *http.Request) {
	httpjson.WriteJSON(w, http.StatusOK, h.registry.Available())
}

// Activate handles POST /backends/{name}/activate.
//
// @Summary      Activate a backend
// @Tags         backends
// @Param        name  path      string  true  "Backend name"
// @Success      200   {object}  map[string]any
// @Failure      500   {object}  httpjson.APIError
// @Router       /backends/{name}/activate [post]
func (h *BackendHandler) Activate(w http.ResponseWriter, r *http.Request) {
	name := chi.URLParam(r, "name")
	result, err := h.control.ActivateBackend(r.Context(), name)
	if err != nil {
		httpjson.WriteErrorf(w, http.StatusInternalServerError, "activate backend %s: %s", name, err.Error())
		return
	}
	httpjson.WriteJSON(w, http.StatusOK, map[string]any{
		"status":  "activated",
		"backend": result.Backend,
	})
}
