package backendshandler

import (
	"net/http"
	"waypaper-engine/daemon/internal/backend"
	"waypaper-engine/daemon/internal/control"
	"waypaper-engine/daemon/internal/handler/httpjson"

	"github.com/go-chi/chi/v5"
)

type BackendHandler struct {
	registry backend.Registry
	control  *control.Controller
}

func NewBackendHandler(registry backend.Registry, control *control.Controller) *BackendHandler {
	return &BackendHandler{
		registry: registry,
		control:  control,
	}
}

func (h *BackendHandler) List(w http.ResponseWriter, r *http.Request) {
	httpjson.WriteJSON(w, http.StatusOK, h.registry.Available())
}

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
