package wallpaperhandler

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"math/rand"
	"net/http"
	"strings"

	"waypaper-engine/daemon/internal/backend"
	"waypaper-engine/daemon/internal/config"
	"waypaper-engine/daemon/internal/events"
	"waypaper-engine/daemon/internal/handler/httpjson"
	"waypaper-engine/daemon/internal/image"
	"waypaper-engine/daemon/internal/monitor"
	"waypaper-engine/daemon/internal/store"
	"waypaper-engine/daemon/internal/wallpaper"
)

// WallpaperHandler handles /wallpaper endpoints.
type WallpaperHandler struct {
	imageStore        store.ImageStore
	historyStore      store.HistoryStore
	stateStore        store.StateStore
	monitorStateStore store.MonitorStateStore
	registry          backend.Registry
	monitorManager    monitor.MonitorManager
	splitter          *image.Splitter
	bus               events.Bus
	cfg               config.ConfigManager
}

// NewWallpaperHandler creates a WallpaperHandler.
func NewWallpaperHandler(
	imageStore store.ImageStore,
	historyStore store.HistoryStore,
	stateStore store.StateStore,
	monitorStateStore store.MonitorStateStore,
	registry backend.Registry,
	monitorManager monitor.MonitorManager,
	splitter *image.Splitter,
	bus events.Bus,
	cfg config.ConfigManager,
) *WallpaperHandler {
	return &WallpaperHandler{
		imageStore:        imageStore,
		historyStore:      historyStore,
		stateStore:        stateStore,
		monitorStateStore: monitorStateStore,
		registry:          registry,
		monitorManager:    monitorManager,
		splitter:          splitter,
		bus:               bus,
		cfg:               cfg,
	}
}

// setWallpaperRequest is the JSON body for POST /wallpaper/set.
type setWallpaperRequest struct {
	ImageID  int                 `json:"image_id"`
	Monitor  string              `json:"monitor"`
	Monitors []string            `json:"monitors,omitempty"`
	Mode     monitor.MonitorMode `json:"mode"`
}

// Set handles POST /wallpaper/set.
//
// @Summary      Set wallpaper
// @Tags         wallpaper
// @Param        body  body      setWallpaperRequest  true  "Set request"
// @Success      200   {object}  map[string]any
// @Failure      400   {object}  httpjson.APIError
// @Failure      404   {object}  httpjson.APIError
// @Failure      500   {object}  httpjson.APIError
// @Router       /wallpaper/set [post]
func (h *WallpaperHandler) Set(w http.ResponseWriter, r *http.Request) {
	var req setWallpaperRequest
	if err := httpjson.ParseBody(r, &req); err != nil {
		httpjson.WriteError(w, http.StatusBadRequest, err.Error())
		return
	}

	if req.ImageID == 0 {
		httpjson.WriteError(w, http.StatusBadRequest, "image_id is required")
		return
	}

	img, err := h.imageStore.GetByID(r.Context(), req.ImageID)
	if err != nil {
		httpjson.WriteError(w, http.StatusNotFound, err.Error())
		return
	}

	if req.Mode == "" {
		req.Mode = monitor.ModeIndividual
	}

	monitors, err := h.resolveMonitors(r.Context(), req.Monitors, req.Monitor)
	if err != nil {
		httpjson.WriteError(w, http.StatusBadRequest, err.Error())
		return
	}

	if err := backend.EnsureBackendForMedia(r.Context(), h.registry, h.cfg, img.MediaType); err != nil {
		httpjson.WriteStructuredError(w, http.StatusBadRequest, "incompatible_backend",
			err.Error(),
			map[string]any{
				"backend":    h.registry.Active().Name(),
				"media_type": img.MediaType,
				"image_id":   img.ID,
				"image_name": img.Name,
			},
		)
		return
	}

	if err := h.applyWallpaper(r.Context(), img, monitors, req.Mode, "manual"); err != nil {
		if strings.Contains(err.Error(), "extend mode is only supported") {
			httpjson.WriteError(w, http.StatusBadRequest, err.Error())
			return
		}
		httpjson.WriteError(w, http.StatusInternalServerError, err.Error())
		return
	}

	httpjson.WriteJSON(w, http.StatusOK, map[string]any{
		"status":   "set",
		"image_id": img.ID,
		"monitor":  req.Monitor,
		"mode":     req.Mode,
	})
}

// Random handles POST /wallpaper/random.
//
// @Summary      Set random wallpaper
// @Tags         wallpaper
// @Param        body  body      map[string]any  false  "Optional monitor/mode"
// @Success      200   {object}  map[string]any
// @Failure      400   {object}  httpjson.APIError
// @Failure      404   {object}  httpjson.APIError
// @Failure      500   {object}  httpjson.APIError
// @Router       /wallpaper/random [post]
func (h *WallpaperHandler) Random(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Monitor string              `json:"monitor"`
		Mode    monitor.MonitorMode `json:"mode"`
	}
	if err := httpjson.ParseBody(r, &req); err != nil {
		// Allow empty body — use defaults.
		req.Monitor = "*"
		req.Mode = monitor.ModeIndividual
	}
	if req.Monitor == "" {
		req.Monitor = "*"
	}
	if req.Mode == "" {
		req.Mode = monitor.ModeIndividual
	}

	count, err := h.imageStore.Count(r.Context())
	if err != nil || count == 0 {
		httpjson.WriteError(w, http.StatusNotFound, "no images in gallery")
		return
	}

	// Pick a random image.
	result, err := h.imageStore.GetAll(r.Context(), store.ImageQueryOpts{
		Page:    rand.Intn(count) + 1,
		PerPage: 1,
	})
	if err != nil || len(result.Data) == 0 {
		httpjson.WriteError(w, http.StatusInternalServerError, "failed to pick random image")
		return
	}

	img := &result.Data[0]

	monitors, err := h.resolveMonitors(r.Context(), nil, req.Monitor)
	if err != nil {
		httpjson.WriteError(w, http.StatusBadRequest, err.Error())
		return
	}

	if err := backend.EnsureBackendForMedia(r.Context(), h.registry, h.cfg, img.MediaType); err != nil {
		httpjson.WriteStructuredError(w, http.StatusBadRequest, "incompatible_backend",
			err.Error(),
			map[string]any{
				"backend":    h.registry.Active().Name(),
				"media_type": img.MediaType,
				"image_id":   img.ID,
				"image_name": img.Name,
			},
		)
		return
	}

	if err := h.applyWallpaper(r.Context(), img, monitors, req.Mode, "random"); err != nil {
		if strings.Contains(err.Error(), "extend mode is only supported") {
			httpjson.WriteError(w, http.StatusBadRequest, err.Error())
			return
		}
		httpjson.WriteError(w, http.StatusInternalServerError, err.Error())
		return
	}

	httpjson.WriteJSON(w, http.StatusOK, map[string]any{
		"status":   "set",
		"image_id": img.ID,
		"monitor":  req.Monitor,
		"mode":     req.Mode,
	})
}

// GetCurrent handles GET /wallpaper/current.
//
// @Summary      Get current wallpaper state
// @Tags         wallpaper
// @Success      200  {object}  WallpaperCurrentResponse
// @Failure      500  {object}  httpjson.APIError
// @Router       /wallpaper/current [get]
//
// Returns a single summary for the active backend: top-level image/mode/set_at are
// taken from the monitor row with the newest SetAt (tie-break: lexicographic monitor
// name), and monitors lists persisted rows for that backend whose monitor_name
// matches a currently connected monitor (when detection succeeds). Rows whose
// image_id no longer exists are removed from the store and omitted. Stale rows from
// previously used backends are not included in the response.
func (h *WallpaperHandler) GetCurrent(w http.ResponseWriter, r *http.Request) {
	states, err := h.monitorStateStore.GetAll(r.Context())
	if err != nil {
		httpjson.WriteError(w, http.StatusInternalServerError, err.Error())
		return
	}
	ctx := r.Context()
	out := make([]store.MonitorState, 0, len(states))
	for _, st := range states {
		_, err := h.imageStore.GetByID(ctx, st.ImageID)
		if err != nil {
			if errors.Is(err, store.ErrNotFound) {
				slog.Info("wallpaper/current: removing monitor state for deleted image",
					"monitor", st.MonitorName, "image_id", st.ImageID)
				if rmErr := h.monitorStateStore.Remove(ctx, st.MonitorName); rmErr != nil {
					slog.Warn("wallpaper/current: failed to remove stale monitor state",
						"monitor", st.MonitorName, "error", rmErr)
				}
				continue
			}
			httpjson.WriteError(w, http.StatusInternalServerError, err.Error())
			return
		}
		out = append(out, st)
	}
	var connected map[string]struct{}
	if mons, err := h.monitorManager.GetMonitors(ctx); err != nil {
		slog.Debug("wallpaper/current: not filtering by connected monitors", "error", err)
	} else if len(mons) > 0 {
		connected = make(map[string]struct{}, len(mons))
		for _, m := range mons {
			connected[m.Name] = struct{}{}
		}
	}
	active := h.registry.Active().Name()
	resp := buildWallpaperCurrentResponse(active, out, connected)
	httpjson.WriteJSON(w, http.StatusOK, resp)
}

// ClearHistory handles DELETE /images/history.
//
// @Summary      Clear wallpaper history
// @Tags         images
// @Success      200  {object}  map[string]string
// @Failure      500  {object}  httpjson.APIError
// @Router       /images/history [delete]
func (h *WallpaperHandler) ClearHistory(w http.ResponseWriter, r *http.Request) {
	if err := h.historyStore.Clear(r.Context()); err != nil {
		httpjson.WriteError(w, http.StatusInternalServerError, err.Error())
		return
	}

	h.bus.Publish(events.Event{
		Type: events.GalleryChanged,
		Data: map[string]any{"domain": "history"},
	})

	httpjson.WriteJSON(w, http.StatusOK, map[string]any{"status": "cleared"})
}

// GetHistory handles GET /images/history.
//
// @Summary      Get wallpaper history
// @Tags         images
// @Param        page      query     int  false  "Page number"
// @Param        per_page  query     int  false  "Items per page"
// @Success      200       {object}  map[string]any
// @Failure      500       {object}  httpjson.APIError
// @Router       /images/history [get]
func (h *WallpaperHandler) GetHistory(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query()
	opts := store.HistoryQueryOpts{
		Monitor: q.Get("monitor"),
	}

	if limit, err := httpjson.ParseIntParam(q.Get("limit")); err == nil {
		opts.Limit = limit
	}
	if sinceID, err := httpjson.ParseIntParam(q.Get("since_id")); err == nil {
		opts.SinceID = sinceID
	}

	entries, err := h.historyStore.GetRecent(r.Context(), opts)
	if err != nil {
		httpjson.WriteError(w, http.StatusInternalServerError, err.Error())
		return
	}

	httpjson.WriteJSON(w, http.StatusOK, entries)
}

// resolveMonitors turns the request's monitor fields into concrete Monitor structs.
// If names is non-empty, each name is resolved individually (unavailable monitors
// are skipped with a warning). Otherwise falls back to the legacy single-monitor
// field: "*" means all connected monitors, anything else is a single name lookup.
func (h *WallpaperHandler) resolveMonitors(ctx context.Context, names []string, fallback string) ([]monitor.Monitor, error) {
	if len(names) > 0 {
		var resolved []monitor.Monitor
		for _, name := range names {
			mon, err := h.monitorManager.GetMonitorByName(ctx, name)
			if err != nil {
				slog.Warn("skipping unavailable monitor from history replay", "name", name, "error", err)
				continue
			}
			resolved = append(resolved, mon)
		}
		if len(resolved) == 0 {
			return nil, fmt.Errorf("none of the specified monitors are available: %v", names)
		}
		return resolved, nil
	}

	if fallback == "" || fallback == "*" {
		return h.monitorManager.GetMonitors(ctx)
	}

	mon, err := h.monitorManager.GetMonitorByName(ctx, fallback)
	if err != nil {
		return nil, err
	}
	return []monitor.Monitor{mon}, nil
}

// applyWallpaper delegates to the shared wallpaper.Apply function.
func (h *WallpaperHandler) applyWallpaper(ctx context.Context, img *store.Image, monitors []monitor.Monitor, mode monitor.MonitorMode, source string) error {
	return wallpaper.Apply(ctx, wallpaper.ApplyOpts{
		Image:             img,
		Monitors:          monitors,
		Mode:              mode,
		Source:            store.HistorySource{Type: source},
		Backend:           h.registry.Active(),
		Splitter:          h.splitter,
		History:           h.historyStore,
		MonState:          h.monitorStateStore,
		State:             h.stateStore,
		Bus:               h.bus,
		VideoAudioDefault: wallpaper.VideoAudioDefaultFromCfg(h.cfg),
	})
}
