package handler

import (
	"net/http"

	"github.com/go-chi/chi/v5"

	"waypaper-engine/daemon/internal/backend"
	"waypaper-engine/daemon/internal/control"
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
	WriteJSON(w, http.StatusOK, h.registry.Available())
}

// Activate handles POST /backends/{name}/activate.
func (h *BackendHandler) Activate(w http.ResponseWriter, r *http.Request) {
	name := chi.URLParam(r, "name")
	result, err := h.control.ActivateBackend(r.Context(), name)
	if err != nil {
		WriteErrorf(w, http.StatusInternalServerError, "activate backend %s: %s", name, err.Error())
		return
	}
	WriteJSON(w, http.StatusOK, map[string]any{
		"status":  "activated",
		"backend": result.Backend,
	})
}
