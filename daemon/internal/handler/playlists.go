package handler

import (
	"context"
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
// Spec shape: { "monitor": { "id": "...", "mode": "..." } }
type startRequest struct {
	Monitor struct {
		ID   string              `json:"id"`
		Mode monitor.MonitorMode `json:"mode"`
	} `json:"monitor"`
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

	if req.Monitor.ID == "" {
		req.Monitor.ID = "*"
	}
	if req.Monitor.Mode == "" {
		req.Monitor.Mode = monitor.ModeIndividual
	}

	target := monitor.MonitorTarget{
		ID:   req.Monitor.ID,
		Mode: req.Monitor.Mode,
	}

	if err := h.manager.Start(r.Context(), id, target); err != nil {
		WriteError(w, http.StatusInternalServerError, err.Error())
		return
	}

	WriteJSON(w, http.StatusOK, map[string]string{"status": "started"})
}

// playlistAction is the shared handler for single-playlist lifecycle operations.
func (h *PlaylistHandler) playlistAction(w http.ResponseWriter, r *http.Request,
	action func(ctx context.Context, id int) error, statusWord string) {
	id, err := ParseIntParam(chi.URLParam(r, "id"))
	if err != nil {
		WriteError(w, http.StatusBadRequest, err.Error())
		return
	}
	if err := action(r.Context(), id); err != nil {
		WriteError(w, http.StatusNotFound, err.Error())
		return
	}
	WriteJSON(w, http.StatusOK, map[string]string{"status": statusWord})
}

// Stop handles POST /playlists/{id}/stop.
func (h *PlaylistHandler) Stop(w http.ResponseWriter, r *http.Request) {
	h.playlistAction(w, r, h.manager.Stop, "stopped")
}

// Pause handles POST /playlists/{id}/pause.
func (h *PlaylistHandler) Pause(w http.ResponseWriter, r *http.Request) {
	h.playlistAction(w, r, h.manager.Pause, "paused")
}

// Resume handles POST /playlists/{id}/resume.
func (h *PlaylistHandler) Resume(w http.ResponseWriter, r *http.Request) {
	h.playlistAction(w, r, h.manager.Resume, "resumed")
}

// Next handles POST /playlists/{id}/next.
func (h *PlaylistHandler) Next(w http.ResponseWriter, r *http.Request) {
	h.playlistAction(w, r, h.manager.Next, "advanced")
}

// Previous handles POST /playlists/{id}/previous.
func (h *PlaylistHandler) Previous(w http.ResponseWriter, r *http.Request) {
	h.playlistAction(w, r, h.manager.Previous, "rewound")
}

// --- Bulk active-playlist lifecycle actions ---

// StopAll handles POST /playlists/active/stop.
func (h *PlaylistHandler) StopAll(w http.ResponseWriter, r *http.Request) {
	count := h.manager.StopAll()
	WriteJSON(w, http.StatusOK, map[string]any{
		"message": "all playlists stopped",
		"stopped": count,
	})
}

// PauseAll handles POST /playlists/active/pause.
func (h *PlaylistHandler) PauseAll(w http.ResponseWriter, r *http.Request) {
	count := h.manager.PauseAll(r.Context())
	WriteJSON(w, http.StatusOK, map[string]any{
		"message": "all playlists paused",
		"paused":  count,
	})
}

// ResumeAll handles POST /playlists/active/resume.
func (h *PlaylistHandler) ResumeAll(w http.ResponseWriter, r *http.Request) {
	count := h.manager.ResumeAll(r.Context())
	WriteJSON(w, http.StatusOK, map[string]any{
		"message": "all playlists resumed",
		"resumed": count,
	})
}

// NextAll handles POST /playlists/active/next.
func (h *PlaylistHandler) NextAll(w http.ResponseWriter, r *http.Request) {
	count := h.manager.NextAll(r.Context())
	WriteJSON(w, http.StatusOK, map[string]any{
		"message":  "all playlists advanced",
		"advanced": count,
	})
}

// PreviousAll handles POST /playlists/active/previous.
func (h *PlaylistHandler) PreviousAll(w http.ResponseWriter, r *http.Request) {
	count := h.manager.PreviousAll(r.Context())
	WriteJSON(w, http.StatusOK, map[string]any{
		"message":  "all playlists reversed",
		"reversed": count,
	})
}

// --- Active playlist queries ---

// ListActive handles GET /playlists/active.
// Returns all active playlist instances, each with their monitors embedded.
func (h *PlaylistHandler) ListActive(w http.ResponseWriter, r *http.Request) {
	active := h.stateStore.GetActivePlaylists()

	result := make([]store.ActivePlaylistInstance, 0, len(active))
	for _, inst := range active {
		result = append(result, inst)
	}

	WriteJSON(w, http.StatusOK, result)
}

// GetActiveByMonitor handles GET /playlists/active/{monitor}.
func (h *PlaylistHandler) GetActiveByMonitor(w http.ResponseWriter, r *http.Request) {
	monName := chi.URLParam(r, "monitor")

	inst := h.stateStore.GetActivePlaylistForMonitor(monName)
	if inst == nil {
		WriteErrorf(w, http.StatusNotFound, "no active playlist on monitor %s", monName)
		return
	}

	WriteJSON(w, http.StatusOK, inst)
}
