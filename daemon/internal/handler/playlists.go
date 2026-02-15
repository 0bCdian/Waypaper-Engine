package handler

import (
	"net/http"

	"github.com/go-chi/chi/v5"

	"waypaper-engine/daemon/internal/events"
	"waypaper-engine/daemon/internal/monitor"
	"waypaper-engine/daemon/internal/playlist"
	"waypaper-engine/daemon/internal/store"
)

// PlaylistHandler handles all /playlists endpoints.
type PlaylistHandler struct {
	store      store.PlaylistStore
	stateStore store.StateStore
	manager    *playlist.Manager
	bus        events.Bus
}

// NewPlaylistHandler creates a PlaylistHandler.
func NewPlaylistHandler(
	store store.PlaylistStore,
	stateStore store.StateStore,
	manager *playlist.Manager,
	bus events.Bus,
) *PlaylistHandler {
	return &PlaylistHandler{
		store:      store,
		stateStore: stateStore,
		manager:    manager,
		bus:        bus,
	}
}

// List handles GET /playlists.
func (h *PlaylistHandler) List(w http.ResponseWriter, r *http.Request) {
	playlists, err := h.store.GetAll(r.Context())
	if err != nil {
		WriteError(w, http.StatusInternalServerError, err.Error())
		return
	}

	WriteJSON(w, http.StatusOK, playlists)
}

// Get handles GET /playlists/{id}.
func (h *PlaylistHandler) Get(w http.ResponseWriter, r *http.Request) {
	id, err := ParseIntParam(chi.URLParam(r, "id"))
	if err != nil {
		WriteError(w, http.StatusBadRequest, err.Error())
		return
	}

	pl, err := h.store.GetByID(r.Context(), id)
	if err != nil {
		WriteError(w, http.StatusNotFound, err.Error())
		return
	}

	WriteJSON(w, http.StatusOK, pl)
}

// Create handles POST /playlists.
func (h *PlaylistHandler) Create(w http.ResponseWriter, r *http.Request) {
	var pl store.Playlist
	if err := ParseBody(r, &pl); err != nil {
		WriteError(w, http.StatusBadRequest, err.Error())
		return
	}

	created, err := h.store.Create(r.Context(), pl)
	if err != nil {
		WriteError(w, http.StatusInternalServerError, err.Error())
		return
	}

	h.bus.Publish(events.Event{
		Type: events.PlaylistsUpdated,
		Data: map[string]any{"action": "created", "playlist_id": created.ID},
	})

	WriteJSON(w, http.StatusCreated, created)
}

// Update handles PATCH /playlists/{id}.
func (h *PlaylistHandler) Update(w http.ResponseWriter, r *http.Request) {
	id, err := ParseIntParam(chi.URLParam(r, "id"))
	if err != nil {
		WriteError(w, http.StatusBadRequest, err.Error())
		return
	}

	var updates map[string]any
	if err := ParseBody(r, &updates); err != nil {
		WriteError(w, http.StatusBadRequest, err.Error())
		return
	}

	pl, err := h.store.Update(r.Context(), id, updates)
	if err != nil {
		WriteError(w, http.StatusNotFound, err.Error())
		return
	}

	h.bus.Publish(events.Event{
		Type: events.PlaylistsUpdated,
		Data: map[string]any{"action": "updated", "playlist_id": id},
	})

	WriteJSON(w, http.StatusOK, pl)
}

// Delete handles DELETE /playlists/{id}.
func (h *PlaylistHandler) Delete(w http.ResponseWriter, r *http.Request) {
	id, err := ParseIntParam(chi.URLParam(r, "id"))
	if err != nil {
		WriteError(w, http.StatusBadRequest, err.Error())
		return
	}

	if err := h.store.Delete(r.Context(), id); err != nil {
		WriteError(w, http.StatusNotFound, err.Error())
		return
	}

	h.bus.Publish(events.Event{
		Type: events.PlaylistsUpdated,
		Data: map[string]any{"action": "deleted", "playlist_id": id},
	})

	WriteJSON(w, http.StatusOK, map[string]string{"status": "deleted"})
}

// --- Playlist lifecycle actions ---

// startRequest is the JSON body for POST /playlists/{id}/start.
type startRequest struct {
	Monitor string              `json:"monitor"`
	Mode    monitor.MonitorMode `json:"mode"`
}

// Start handles POST /playlists/{id}/start.
func (h *PlaylistHandler) Start(w http.ResponseWriter, r *http.Request) {
	id, err := ParseIntParam(chi.URLParam(r, "id"))
	if err != nil {
		WriteError(w, http.StatusBadRequest, err.Error())
		return
	}

	var req startRequest
	if err := ParseBody(r, &req); err != nil {
		WriteError(w, http.StatusBadRequest, err.Error())
		return
	}

	if req.Monitor == "" {
		req.Monitor = "*"
	}
	if req.Mode == "" {
		req.Mode = monitor.ModeIndividual
	}

	target := monitor.MonitorTarget{
		ID:   req.Monitor,
		Mode: req.Mode,
	}

	if err := h.manager.Start(r.Context(), id, target); err != nil {
		WriteError(w, http.StatusInternalServerError, err.Error())
		return
	}

	WriteJSON(w, http.StatusOK, map[string]string{"status": "started"})
}

// Stop handles POST /playlists/{id}/stop.
func (h *PlaylistHandler) Stop(w http.ResponseWriter, r *http.Request) {
	id, err := ParseIntParam(chi.URLParam(r, "id"))
	if err != nil {
		WriteError(w, http.StatusBadRequest, err.Error())
		return
	}

	if err := h.manager.Stop(r.Context(), id); err != nil {
		WriteError(w, http.StatusNotFound, err.Error())
		return
	}

	WriteJSON(w, http.StatusOK, map[string]string{"status": "stopped"})
}

// Pause handles POST /playlists/{id}/pause.
func (h *PlaylistHandler) Pause(w http.ResponseWriter, r *http.Request) {
	id, err := ParseIntParam(chi.URLParam(r, "id"))
	if err != nil {
		WriteError(w, http.StatusBadRequest, err.Error())
		return
	}

	if err := h.manager.Pause(r.Context(), id); err != nil {
		WriteError(w, http.StatusNotFound, err.Error())
		return
	}

	WriteJSON(w, http.StatusOK, map[string]string{"status": "paused"})
}

// Resume handles POST /playlists/{id}/resume.
func (h *PlaylistHandler) Resume(w http.ResponseWriter, r *http.Request) {
	id, err := ParseIntParam(chi.URLParam(r, "id"))
	if err != nil {
		WriteError(w, http.StatusBadRequest, err.Error())
		return
	}

	if err := h.manager.Resume(r.Context(), id); err != nil {
		WriteError(w, http.StatusNotFound, err.Error())
		return
	}

	WriteJSON(w, http.StatusOK, map[string]string{"status": "resumed"})
}

// Next handles POST /playlists/{id}/next.
func (h *PlaylistHandler) Next(w http.ResponseWriter, r *http.Request) {
	id, err := ParseIntParam(chi.URLParam(r, "id"))
	if err != nil {
		WriteError(w, http.StatusBadRequest, err.Error())
		return
	}

	if err := h.manager.Next(r.Context(), id); err != nil {
		WriteError(w, http.StatusNotFound, err.Error())
		return
	}

	WriteJSON(w, http.StatusOK, map[string]string{"status": "advanced"})
}

// Previous handles POST /playlists/{id}/previous.
func (h *PlaylistHandler) Previous(w http.ResponseWriter, r *http.Request) {
	id, err := ParseIntParam(chi.URLParam(r, "id"))
	if err != nil {
		WriteError(w, http.StatusBadRequest, err.Error())
		return
	}

	if err := h.manager.Previous(r.Context(), id); err != nil {
		WriteError(w, http.StatusNotFound, err.Error())
		return
	}

	WriteJSON(w, http.StatusOK, map[string]string{"status": "rewound"})
}

// --- Active playlist queries ---

// ListActive handles GET /playlists/active.
func (h *PlaylistHandler) ListActive(w http.ResponseWriter, r *http.Request) {
	active := h.stateStore.GetActivePlaylists()
	WriteJSON(w, http.StatusOK, active)
}

// GetActiveByMonitor handles GET /playlists/active/{monitor}.
func (h *PlaylistHandler) GetActiveByMonitor(w http.ResponseWriter, r *http.Request) {
	monName := chi.URLParam(r, "monitor")

	inst := h.stateStore.GetActivePlaylistByMonitor(monName)
	if inst == nil {
		WriteErrorf(w, http.StatusNotFound, "no active playlist on monitor %s", monName)
		return
	}

	WriteJSON(w, http.StatusOK, inst)
}
