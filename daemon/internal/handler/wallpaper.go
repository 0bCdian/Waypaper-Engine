package handler

import (
	"context"
	"fmt"
	"log/slog"
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
	imageStore        store.ImageStore
	historyStore      store.HistoryStore
	stateStore        store.StateStore
	monitorStateStore store.MonitorStateStore
	registry          backend.Registry
	monitorManager    monitor.MonitorManager
	splitter          *image.Splitter
	bus               events.Bus
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

	if req.Mode == "" {
		req.Mode = monitor.ModeIndividual
	}

	monitors, err := h.resolveMonitors(r.Context(), req.Monitors, req.Monitor)
	if err != nil {
		WriteError(w, http.StatusBadRequest, err.Error())
		return
	}

	if err := h.applyWallpaper(r.Context(), img, monitors, req.Mode, "manual"); err != nil {
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

	monitors, err := h.resolveMonitors(r.Context(), nil, req.Monitor)
	if err != nil {
		WriteError(w, http.StatusBadRequest, err.Error())
		return
	}

	if err := h.applyWallpaper(r.Context(), img, monitors, req.Mode, "random"); err != nil {
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

// GetCurrent handles GET /wallpaper/current.
// Returns the persisted per-monitor wallpaper state from monitorStateStore,
// which is independent of the history collection and survives history clearing.
func (h *WallpaperHandler) GetCurrent(w http.ResponseWriter, r *http.Request) {
	states, err := h.monitorStateStore.GetAll(r.Context())
	if err != nil {
		WriteError(w, http.StatusInternalServerError, err.Error())
		return
	}
	WriteJSON(w, http.StatusOK, states)
}

// ClearHistory handles DELETE /images/history.
func (h *WallpaperHandler) ClearHistory(w http.ResponseWriter, r *http.Request) {
	if err := h.historyStore.Clear(r.Context()); err != nil {
		WriteError(w, http.StatusInternalServerError, err.Error())
		return
	}

	h.bus.Publish(events.Event{
		Type: events.HistoryCleared,
		Data: map[string]any{},
	})

	WriteJSON(w, http.StatusOK, map[string]any{"status": "cleared"})
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

// applyWallpaper is the core wallpaper setting flow shared by Set and Random.
// Callers resolve monitors beforehand via resolveMonitors.
func (h *WallpaperHandler) applyWallpaper(ctx context.Context, img *store.Image, monitors []monitor.Monitor, mode monitor.MonitorMode, source string) error {
	activeBackend := h.registry.Active()
	caps := activeBackend.Capabilities()

	// Handle extend mode: split image if backend doesn't support native extend.
	if mode == monitor.ModeExtend && !caps.NativeExtend && h.splitter != nil && len(monitors) > 1 {
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
			Mode:      mode,
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
		Mode:      string(mode),
		SetAt:     time.Now(),
		Source:    store.HistorySource{Type: source},
		Backend:   activeBackend.Name(),
	}
	_, _ = h.historyStore.Append(ctx, entry)

	// Update current wallpaper state (in-memory + persisted).
	for _, mon := range monitors {
		h.stateStore.SetCurrentWallpaper(mon.Name, entry)

		// Persist to CloverDB for restore on restart.
		if err := h.monitorStateStore.Set(ctx, store.MonitorState{
			MonitorName: mon.Name,
			ImageID:     img.ID,
			ImageName:   img.Name,
			ImagePath:   img.Path,
			Mode:        string(mode),
			Backend:     activeBackend.Name(),
			SetAt:       entry.SetAt,
		}); err != nil {
			slog.Warn("failed to persist monitor state", "monitor", mon.Name, "error", err)
		}
	}

	// Publish event.
	h.bus.Publish(events.Event{
		Type: events.WallpaperChanged,
		Data: map[string]any{
			"image_id": img.ID,
			"monitors": monNames,
			"mode":     mode,
			"source":   source,
			"backend":  activeBackend.Name(),
		},
	})

	return nil
}
