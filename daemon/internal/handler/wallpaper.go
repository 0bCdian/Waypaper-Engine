package handler

import (
	"context"
	"math/rand"
	"net/http"
	"time"

	"waypaper-engine/daemon/internal/backend"
	"waypaper-engine/daemon/internal/events"
	"waypaper-engine/daemon/internal/image"
	"waypaper-engine/daemon/internal/monitor"
	"waypaper-engine/daemon/internal/store"
)

// WallpaperHandler handles /wallpaper endpoints.
type WallpaperHandler struct {
	imageStore     store.ImageStore
	historyStore   store.HistoryStore
	stateStore     store.StateStore
	registry       backend.Registry
	monitorManager monitor.MonitorManager
	splitter       *image.Splitter
	bus            events.Bus
}

// NewWallpaperHandler creates a WallpaperHandler.
func NewWallpaperHandler(
	imageStore store.ImageStore,
	historyStore store.HistoryStore,
	stateStore store.StateStore,
	registry backend.Registry,
	monitorManager monitor.MonitorManager,
	splitter *image.Splitter,
	bus events.Bus,
) *WallpaperHandler {
	return &WallpaperHandler{
		imageStore:     imageStore,
		historyStore:   historyStore,
		stateStore:     stateStore,
		registry:       registry,
		monitorManager: monitorManager,
		splitter:       splitter,
		bus:            bus,
	}
}

// setWallpaperRequest is the JSON body for POST /wallpaper/set.
type setWallpaperRequest struct {
	ImageID int                 `json:"image_id"`
	Monitor string              `json:"monitor"`
	Mode    monitor.MonitorMode `json:"mode"`
}

// Set handles POST /wallpaper/set.
func (h *WallpaperHandler) Set(w http.ResponseWriter, r *http.Request) {
	var req setWallpaperRequest
	if err := ParseBody(r, &req); err != nil {
		WriteError(w, http.StatusBadRequest, err.Error())
		return
	}

	if req.ImageID == 0 {
		WriteError(w, http.StatusBadRequest, "image_id is required")
		return
	}

	img, err := h.imageStore.GetByID(r.Context(), req.ImageID)
	if err != nil {
		WriteError(w, http.StatusNotFound, err.Error())
		return
	}

	if req.Monitor == "" {
		req.Monitor = "*"
	}
	if req.Mode == "" {
		req.Mode = monitor.ModeIndividual
	}

	target := monitor.MonitorTarget{ID: req.Monitor, Mode: req.Mode}

	if err := h.applyWallpaper(r.Context(), img, target, "manual"); err != nil {
		WriteError(w, http.StatusInternalServerError, err.Error())
		return
	}

	WriteJSON(w, http.StatusOK, map[string]any{
		"status":   "set",
		"image_id": img.ID,
		"monitor":  req.Monitor,
		"mode":     req.Mode,
	})
}

// Random handles POST /wallpaper/random.
func (h *WallpaperHandler) Random(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Monitor string              `json:"monitor"`
		Mode    monitor.MonitorMode `json:"mode"`
	}
	if err := ParseBody(r, &req); err != nil {
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
		WriteError(w, http.StatusNotFound, "no images in gallery")
		return
	}

	// Pick a random image.
	result, err := h.imageStore.GetAll(r.Context(), store.ImageQueryOpts{
		Page:    rand.Intn(count) + 1,
		PerPage: 1,
	})
	if err != nil || len(result.Data) == 0 {
		WriteError(w, http.StatusInternalServerError, "failed to pick random image")
		return
	}

	img := &result.Data[0]
	target := monitor.MonitorTarget{ID: req.Monitor, Mode: req.Mode}

	if err := h.applyWallpaper(r.Context(), img, target, "random"); err != nil {
		WriteError(w, http.StatusInternalServerError, err.Error())
		return
	}

	WriteJSON(w, http.StatusOK, map[string]any{
		"status":   "set",
		"image_id": img.ID,
		"monitor":  req.Monitor,
		"mode":     req.Mode,
	})
}

// HistoryNext handles POST /wallpaper/history/next.
func (h *WallpaperHandler) HistoryNext(w http.ResponseWriter, r *http.Request) {
	WriteError(w, http.StatusNotImplemented, "history navigation not yet implemented")
}

// HistoryPrevious handles POST /wallpaper/history/previous.
func (h *WallpaperHandler) HistoryPrevious(w http.ResponseWriter, r *http.Request) {
	WriteError(w, http.StatusNotImplemented, "history navigation not yet implemented")
}

// GetHistory handles GET /wallpaper/history.
func (h *WallpaperHandler) GetHistory(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query()
	opts := store.HistoryQueryOpts{
		Monitor: q.Get("monitor"),
	}

	if limit, err := ParseIntParam(q.Get("limit")); err == nil {
		opts.Limit = limit
	}
	if sinceID, err := ParseIntParam(q.Get("since_id")); err == nil {
		opts.SinceID = sinceID
	}

	entries, err := h.historyStore.GetRecent(r.Context(), opts)
	if err != nil {
		WriteError(w, http.StatusInternalServerError, err.Error())
		return
	}

	WriteJSON(w, http.StatusOK, entries)
}

// applyWallpaper is the core wallpaper setting flow shared by Set and Random.
func (h *WallpaperHandler) applyWallpaper(ctx context.Context, img *store.Image, target monitor.MonitorTarget, source string) error {
	// Resolve monitors.
	var monitors []monitor.Monitor
	var err error
	if target.ID == "*" {
		monitors, err = h.monitorManager.GetMonitors(ctx)
	} else {
		mon, e := h.monitorManager.GetMonitorByName(ctx, target.ID)
		if e != nil {
			return e
		}
		monitors = []monitor.Monitor{mon}
		err = nil
	}
	if err != nil {
		return err
	}

	activeBackend := h.registry.Active()
	caps := activeBackend.Capabilities()

	// Handle extend mode: split image if backend doesn't support native extend.
	if target.Mode == monitor.ModeExtend && !caps.NativeExtend && h.splitter != nil && len(monitors) > 1 {
		splitPaths, err := h.splitter.Split(img.Path, img.ID, monitors)
		if err != nil {
			return err
		}

		for _, mon := range monitors {
			if splitPath, ok := splitPaths[mon.Name]; ok {
				req := backend.WallpaperRequest{
					ImagePath: splitPath,
					Monitors:  []monitor.Monitor{mon},
					Mode:      monitor.ModeIndividual,
				}
				if err := activeBackend.SetWallpaper(ctx, req); err != nil {
					return err
				}
			}
		}
	} else {
		req := backend.WallpaperRequest{
			ImagePath: img.Path,
			Monitors:  monitors,
			Mode:      target.Mode,
		}
		if err := activeBackend.SetWallpaper(ctx, req); err != nil {
			return err
		}
	}

	// Record history.
	monNames := make([]string, len(monitors))
	for i, mon := range monitors {
		monNames[i] = mon.Name
	}

	entry := store.ImageHistoryEntry{
		ImageID:   img.ID,
		ImageName: img.Name,
		Monitors:  monNames,
		Mode:      string(target.Mode),
		SetAt:     time.Now(),
		Source:    store.HistorySource{Type: source},
		Backend:   activeBackend.Name(),
	}
	_, _ = h.historyStore.Append(ctx, entry)

	// Update current wallpaper state.
	for _, mon := range monitors {
		h.stateStore.SetCurrentWallpaper(mon.Name, entry)
	}

	// Publish event.
	h.bus.Publish(events.Event{
		Type: events.WallpaperChanged,
		Data: map[string]any{
			"image_id":  img.ID,
			"monitors":  monNames,
			"mode":      target.Mode,
			"source":    source,
			"backend":   activeBackend.Name(),
		},
	})

	return nil
}
