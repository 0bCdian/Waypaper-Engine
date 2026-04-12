package handler

import (
	"net/http"

	"github.com/go-chi/chi/v5"

	"waypaper-engine/daemon/internal/backend"
	"waypaper-engine/daemon/internal/config"
	"waypaper-engine/daemon/internal/events"
	"waypaper-engine/daemon/internal/image"
	"waypaper-engine/daemon/internal/monitor"
	"waypaper-engine/daemon/internal/store"
)

// BackendHandler handles /backends endpoints.
type BackendHandler struct {
	registry          backend.Registry
	cfg               config.ConfigManager
	bus               events.Bus
	monitorStateStore store.MonitorStateStore
	stateStore        store.StateStore
	imageStore        store.ImageStore
	monitorManager    monitor.MonitorManager
	splitter          *image.Splitter
}

// NewBackendHandler creates a BackendHandler.
func NewBackendHandler(
	registry backend.Registry,
	cfg config.ConfigManager,
	bus events.Bus,
	monitorStateStore store.MonitorStateStore,
	stateStore store.StateStore,
	imageStore store.ImageStore,
	monitorManager monitor.MonitorManager,
	splitter *image.Splitter,
) *BackendHandler {
	return &BackendHandler{
		registry:          registry,
		cfg:               cfg,
		bus:               bus,
		monitorStateStore: monitorStateStore,
		stateStore:        stateStore,
		imageStore:        imageStore,
		monitorManager:    monitorManager,
		splitter:          splitter,
	}
}

// List handles GET /backends.
func (h *BackendHandler) List(w http.ResponseWriter, r *http.Request) {
	WriteJSON(w, http.StatusOK, h.registry.Available())
}

// Activate handles POST /backends/{name}/activate.
func (h *BackendHandler) Activate(w http.ResponseWriter, r *http.Request) {
	name := chi.URLParam(r, "name")
	if h.registry.Active() != nil && h.registry.Active().Name() == name {
		WriteJSON(w, http.StatusOK, map[string]any{
			"status":  "activated",
			"backend": name,
		})
		return
	}

	if err := backend.SwitchActiveBackend(r.Context(), h.registry, name, h.cfg, backend.SwitchOpts{
		PersistConfig: true,
	}); err != nil {
		WriteErrorf(w, http.StatusInternalServerError, "activate backend %s: %s", name, err.Error())
		return
	}

	RestoreWallpapers(r.Context(), h.monitorStateStore, h.stateStore, h.registry, h.monitorManager, h.imageStore, h.splitter, h.bus)

	h.bus.Publish(events.Event{
		Type: events.ConfigChanged,
		Data: map[string]any{
			"sections": []string{"backend"},
			"backend":  name,
		},
	})

	WriteJSON(w, http.StatusOK, map[string]any{
		"status":  "activated",
		"backend": name,
	})
}
