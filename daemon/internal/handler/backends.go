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

	// Shutdown current backend.
	currentBackend := h.registry.Active()
	if currentBackend.Name() != name {
		if err := currentBackend.Shutdown(r.Context()); err != nil {
			WriteErrorf(w, http.StatusInternalServerError, "shutdown current backend: %s", err.Error())
			return
		}
	}

	// Switch to new backend.
	if err := h.registry.SetActive(name); err != nil {
		WriteError(w, http.StatusBadRequest, err.Error())
		return
	}

	// Initialize new backend.
	newBackend := h.registry.Active()
	if err := newBackend.Initialize(r.Context()); err != nil {
		WriteErrorf(w, http.StatusInternalServerError, "initialize backend %s: %s", name, err.Error())
		return
	}

	// Update config to persist the change.
	if err := h.cfg.SetActiveBackendType(name); err != nil {
		WriteErrorf(w, http.StatusInternalServerError, "persist backend type: %s", err.Error())
		return
	}

	// Re-apply wallpapers with the newly activated backend.
	RestoreWallpapers(r.Context(), h.monitorStateStore, h.stateStore, h.registry, h.monitorManager, h.imageStore, h.splitter)

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
