package playlistshandler

import (
	"context"
	"errors"
	"log/slog"
	"net/http"

	"github.com/go-chi/chi/v5"

	"waypaper-engine/daemon/internal/events"
	"waypaper-engine/daemon/internal/handler/httpjson"
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
//
// @Summary      List playlists
// @Tags         playlists
// @Success      200  {array}   store.Playlist
// @Failure      500  {object}  httpjson.APIError
// @Router       /playlists [get]
func (h *PlaylistHandler) List(w http.ResponseWriter, r *http.Request) {
	playlists, err := h.store.GetAll(r.Context())
	if err != nil {
		httpjson.WriteError(w, http.StatusInternalServerError, err.Error())
		return
	}

	httpjson.WriteJSON(w, http.StatusOK, playlists)
}

// Get handles GET /playlists/{id}.
//
// @Summary      Get a playlist
// @Tags         playlists
// @Param        id   path      int  true  "Playlist ID"
// @Success      200  {object}  store.Playlist
// @Failure      400  {object}  httpjson.APIError
// @Failure      404  {object}  httpjson.APIError
// @Router       /playlists/{id} [get]
func (h *PlaylistHandler) Get(w http.ResponseWriter, r *http.Request) {
	id, err := httpjson.ParseIntParam(chi.URLParam(r, "id"))
	if err != nil {
		httpjson.WriteError(w, http.StatusBadRequest, err.Error())
		return
	}

	pl, err := h.store.GetByID(r.Context(), id)
	if err != nil {
		httpjson.WriteError(w, http.StatusNotFound, err.Error())
		return
	}

	httpjson.WriteJSON(w, http.StatusOK, pl)
}

// Create handles POST /playlists.
//
// @Summary      Create a playlist
// @Tags         playlists
// @Param        body  body      store.Playlist  true  "Playlist data"
// @Success      201   {object}  store.Playlist
// @Failure      400   {object}  httpjson.APIError
// @Failure      500   {object}  httpjson.APIError
// @Router       /playlists [post]
func (h *PlaylistHandler) Create(w http.ResponseWriter, r *http.Request) {
	var pl store.Playlist
	if err := httpjson.ParseBody(r, &pl); err != nil {
		httpjson.WriteError(w, http.StatusBadRequest, err.Error())
		return
	}

	created, err := h.store.Create(r.Context(), pl)
	if err != nil {
		httpjson.WriteError(w, http.StatusInternalServerError, err.Error())
		return
	}

	h.bus.Publish(events.Event{
		Type: events.GalleryChanged,
		Data: map[string]any{"domain": "playlists"},
	})

	httpjson.WriteJSON(w, http.StatusCreated, created)
}

// Update handles PATCH /playlists/{id}.
//
// @Summary      Update a playlist
// @Tags         playlists
// @Param        id    path      int             true  "Playlist ID"
// @Param        body  body      map[string]any  true  "Fields to update"
// @Success      200   {object}  store.Playlist
// @Failure      400   {object}  httpjson.APIError
// @Failure      404   {object}  httpjson.APIError
// @Router       /playlists/{id} [patch]
func (h *PlaylistHandler) Update(w http.ResponseWriter, r *http.Request) {
	id, err := httpjson.ParseIntParam(chi.URLParam(r, "id"))
	if err != nil {
		httpjson.WriteError(w, http.StatusBadRequest, err.Error())
		return
	}

	var updates map[string]any
	if err := httpjson.ParseBody(r, &updates); err != nil {
		httpjson.WriteError(w, http.StatusBadRequest, err.Error())
		return
	}

	// Playback is written only by the playlist manager (daemon-internal).
	delete(updates, "playback")

	pl, err := h.store.Update(r.Context(), id, updates)
	if err != nil {
		httpjson.WriteError(w, http.StatusNotFound, err.Error())
		return
	}

	slog.Debug("playlist_diag PATCH persisted",
		"playlist_id", id,
		"images_len", len(pl.Images),
		"type", pl.Configuration.Type,
		"order", pl.Configuration.Order,
		"interval_sec", pl.Configuration.Interval)

	if h.manager != nil {
		if err := h.manager.ReconcileAfterPlaylistUpdate(r.Context(), id); err != nil {
			slog.Warn("playlist reconcile after update", "playlist_id", id, "error", err)
		}
	}

	h.bus.Publish(events.Event{
		Type: events.GalleryChanged,
		Data: map[string]any{"domain": "playlists"},
	})

	httpjson.WriteJSON(w, http.StatusOK, pl)
}

// Delete handles DELETE /playlists/{id}.
//
// @Summary      Delete a playlist
// @Tags         playlists
// @Param        id   path      int  true  "Playlist ID"
// @Success      200  {object}  map[string]string
// @Failure      400  {object}  httpjson.APIError
// @Failure      404  {object}  httpjson.APIError
// @Router       /playlists/{id} [delete]
func (h *PlaylistHandler) Delete(w http.ResponseWriter, r *http.Request) {
	id, err := httpjson.ParseIntParam(chi.URLParam(r, "id"))
	if err != nil {
		httpjson.WriteError(w, http.StatusBadRequest, err.Error())
		return
	}

	if err := h.store.Delete(r.Context(), id); err != nil {
		httpjson.WriteError(w, http.StatusNotFound, err.Error())
		return
	}

	h.bus.Publish(events.Event{
		Type: events.GalleryChanged,
		Data: map[string]any{"domain": "playlists"},
	})

	httpjson.WriteJSON(w, http.StatusOK, map[string]string{"status": "deleted"})
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
//
// @Summary      Start a playlist
// @Tags         playlists
// @Param        id    path      int           true  "Playlist ID"
// @Param        body  body      startRequest  true  "Monitor target"
// @Success      200   {object}  map[string]string
// @Failure      400   {object}  httpjson.APIError
// @Failure      500   {object}  httpjson.APIError
// @Router       /playlists/{id}/start [post]
func (h *PlaylistHandler) Start(w http.ResponseWriter, r *http.Request) {
	id, err := httpjson.ParseIntParam(chi.URLParam(r, "id"))
	if err != nil {
		httpjson.WriteError(w, http.StatusBadRequest, err.Error())
		return
	}

	var req startRequest
	if err := httpjson.ParseBody(r, &req); err != nil {
		httpjson.WriteError(w, http.StatusBadRequest, err.Error())
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
		httpjson.WriteError(w, http.StatusInternalServerError, err.Error())
		return
	}

	httpjson.WriteJSON(w, http.StatusOK, map[string]string{"status": "started"})
}

// playlistAction is the shared handler for single-playlist lifecycle operations.
func (h *PlaylistHandler) playlistAction(w http.ResponseWriter, r *http.Request,
	action func(ctx context.Context, id int) error, statusWord string) {
	id, err := httpjson.ParseIntParam(chi.URLParam(r, "id"))
	if err != nil {
		httpjson.WriteError(w, http.StatusBadRequest, err.Error())
		return
	}
	if err := action(r.Context(), id); err != nil {
		httpjson.WriteError(w, http.StatusNotFound, err.Error())
		return
	}
	httpjson.WriteJSON(w, http.StatusOK, map[string]string{"status": statusWord})
}

// Stop handles POST /playlists/{id}/stop.
//
// @Summary      Stop a playlist
// @Tags         playlists
// @Param        id   path      int  true  "Playlist ID"
// @Success      200  {object}  map[string]string
// @Failure      400  {object}  httpjson.APIError
// @Failure      404  {object}  httpjson.APIError
// @Router       /playlists/{id}/stop [post]
func (h *PlaylistHandler) Stop(w http.ResponseWriter, r *http.Request) {
	h.playlistAction(w, r, h.manager.Stop, "stopped")
}

// Pause handles POST /playlists/{id}/pause.
//
// @Summary      Pause a playlist
// @Tags         playlists
// @Param        id   path      int  true  "Playlist ID"
// @Success      200  {object}  map[string]string
// @Failure      400  {object}  httpjson.APIError
// @Failure      404  {object}  httpjson.APIError
// @Router       /playlists/{id}/pause [post]
func (h *PlaylistHandler) Pause(w http.ResponseWriter, r *http.Request) {
	h.playlistAction(w, r, h.manager.Pause, "paused")
}

// Resume handles POST /playlists/{id}/resume.
//
// @Summary      Resume a playlist
// @Tags         playlists
// @Param        id   path      int  true  "Playlist ID"
// @Success      200  {object}  map[string]string
// @Failure      400  {object}  httpjson.APIError
// @Failure      404  {object}  httpjson.APIError
// @Router       /playlists/{id}/resume [post]
func (h *PlaylistHandler) Resume(w http.ResponseWriter, r *http.Request) {
	h.playlistAction(w, r, h.manager.Resume, "resumed")
}

// Next handles POST /playlists/{id}/next.
//
// @Summary      Advance to next image in playlist
// @Tags         playlists
// @Param        id   path      int  true  "Playlist ID"
// @Success      200  {object}  map[string]string
// @Failure      400  {object}  httpjson.APIError
// @Failure      404  {object}  httpjson.APIError
// @Router       /playlists/{id}/next [post]
func (h *PlaylistHandler) Next(w http.ResponseWriter, r *http.Request) {
	h.playlistAdvanceAction(w, r, h.manager.Next, "advanced")
}

// Previous handles POST /playlists/{id}/previous.
//
// @Summary      Go to previous image in playlist
// @Tags         playlists
// @Param        id   path      int  true  "Playlist ID"
// @Success      200  {object}  map[string]string
// @Failure      400  {object}  httpjson.APIError
// @Failure      404  {object}  httpjson.APIError
// @Router       /playlists/{id}/previous [post]
func (h *PlaylistHandler) Previous(w http.ResponseWriter, r *http.Request) {
	h.playlistAdvanceAction(w, r, h.manager.Previous, "rewound")
}

// playlistAdvanceAction handles next/previous with 400 for disallowed playlist types.
func (h *PlaylistHandler) playlistAdvanceAction(w http.ResponseWriter, r *http.Request,
	action func(ctx context.Context, id int) error, statusWord string) {
	id, err := httpjson.ParseIntParam(chi.URLParam(r, "id"))
	if err != nil {
		httpjson.WriteError(w, http.StatusBadRequest, err.Error())
		return
	}
	if err := action(r.Context(), id); err != nil {
		if errors.Is(err, playlist.ErrManualAdvanceNotAllowed) {
			httpjson.WriteError(w, http.StatusBadRequest, err.Error())
			return
		}
		httpjson.WriteError(w, http.StatusNotFound, err.Error())
		return
	}
	httpjson.WriteJSON(w, http.StatusOK, map[string]string{"status": statusWord})
}

// --- Bulk active-playlist lifecycle actions ---

// StopAll handles POST /playlists/active/stop.
//
// @Summary      Stop all active playlists
// @Tags         playlists
// @Success      200  {object}  map[string]any
// @Router       /playlists/active/stop [post]
func (h *PlaylistHandler) StopAll(w http.ResponseWriter, r *http.Request) {
	count := h.manager.StopAll()
	httpjson.WriteJSON(w, http.StatusOK, map[string]any{
		"message": "all playlists stopped",
		"stopped": count,
	})
}

// PauseAll handles POST /playlists/active/pause.
//
// @Summary      Pause all active playlists
// @Tags         playlists
// @Success      200  {object}  map[string]any
// @Router       /playlists/active/pause [post]
func (h *PlaylistHandler) PauseAll(w http.ResponseWriter, r *http.Request) {
	count := h.manager.PauseAll(r.Context())
	httpjson.WriteJSON(w, http.StatusOK, map[string]any{
		"message": "all playlists paused",
		"paused":  count,
	})
}

// ResumeAll handles POST /playlists/active/resume.
//
// @Summary      Resume all paused playlists
// @Tags         playlists
// @Success      200  {object}  map[string]any
// @Router       /playlists/active/resume [post]
func (h *PlaylistHandler) ResumeAll(w http.ResponseWriter, r *http.Request) {
	count := h.manager.ResumeAll(r.Context())
	httpjson.WriteJSON(w, http.StatusOK, map[string]any{
		"message": "all playlists resumed",
		"resumed": count,
	})
}

// NextAll handles POST /playlists/active/next.
//
// @Summary      Advance all active playlists
// @Tags         playlists
// @Success      200  {object}  map[string]any
// @Router       /playlists/active/next [post]
func (h *PlaylistHandler) NextAll(w http.ResponseWriter, r *http.Request) {
	count, err := h.manager.NextAll(r.Context())
	if err != nil {
		if errors.Is(err, playlist.ErrManualAdvanceNotAllowed) {
			httpjson.WriteError(w, http.StatusBadRequest, err.Error())
			return
		}
		httpjson.WriteError(w, http.StatusInternalServerError, err.Error())
		return
	}
	httpjson.WriteJSON(w, http.StatusOK, map[string]any{
		"message":  "all playlists advanced",
		"advanced": count,
	})
}

// PreviousAll handles POST /playlists/active/previous.
//
// @Summary      Rewind all active playlists
// @Tags         playlists
// @Success      200  {object}  map[string]any
// @Router       /playlists/active/previous [post]
func (h *PlaylistHandler) PreviousAll(w http.ResponseWriter, r *http.Request) {
	count, err := h.manager.PreviousAll(r.Context())
	if err != nil {
		if errors.Is(err, playlist.ErrManualAdvanceNotAllowed) {
			httpjson.WriteError(w, http.StatusBadRequest, err.Error())
			return
		}
		httpjson.WriteError(w, http.StatusInternalServerError, err.Error())
		return
	}
	httpjson.WriteJSON(w, http.StatusOK, map[string]any{
		"message":  "all playlists reversed",
		"reversed": count,
	})
}

// --- Active playlist queries ---

// ListActive handles GET /playlists/active.
//
// @Summary      List active playlist instances
// @Tags         playlists
// @Success      200  {array}   store.ActivePlaylistInstance
// @Router       /playlists/active [get]
func (h *PlaylistHandler) ListActive(w http.ResponseWriter, r *http.Request) {
	active := h.stateStore.GetActivePlaylists()

	result := make([]store.ActivePlaylistInstance, 0, len(active))
	for _, inst := range active {
		result = append(result, inst)
	}

	httpjson.WriteJSON(w, http.StatusOK, result)
}

// GetActiveByMonitor handles GET /playlists/active/{monitor}.
//
// @Summary      Get active playlist for a monitor
// @Tags         playlists
// @Param        monitor  path      string  true  "Monitor name"
// @Success      200      {object}  store.ActivePlaylistInstance
// @Failure      404      {object}  httpjson.APIError
// @Router       /playlists/active/{monitor} [get]
func (h *PlaylistHandler) GetActiveByMonitor(w http.ResponseWriter, r *http.Request) {
	monName := chi.URLParam(r, "monitor")

	inst := h.stateStore.GetActivePlaylistForMonitor(monName)
	if inst == nil {
		httpjson.WriteErrorf(w, http.StatusNotFound, "no active playlist on monitor %s", monName)
		return
	}

	httpjson.WriteJSON(w, http.StatusOK, inst)
}
