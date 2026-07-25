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
func (h *BackendHandler) List(w http.ResponseWriter, r *http.Request) {
	httpjson.WriteJSON(w, http.StatusOK, h.registry.Available())
}

// Activate handles POST /backends/{name}/activate.
func (h *BackendHandler) Activate(w http.ResponseWriter, r *http.Request) {
	name := chi.URLParam(r, "name")
	result, err := h.control.ActivateBackend(r.Context(), name)
	if err != nil {
		httpjson.WriteErrorf(w, http.StatusInternalServerError, "activate backend %s: %s", name, err.Error())
		return
	}
	httpjson.WriteJSON(w, http.StatusOK, ActivateBackendResponse{
		Status:  "activated",
		Backend: result.Backend,
	})
}
