package handler

import (
	"encoding/json"
	"log/slog"
	"net/http"
	"net/url"

	"github.com/go-chi/chi/v5"

	"waypaper-engine/daemon/internal/backend"
	"waypaper-engine/daemon/internal/config"
	"waypaper-engine/daemon/internal/events"
)

// ConfigHandler handles /config endpoints.
type ConfigHandler struct {
	cfg      config.ConfigManager
	registry backend.Registry
	bus      events.Bus
}

// NewConfigHandler creates a ConfigHandler.
func NewConfigHandler(cfg config.ConfigManager, registry backend.Registry, bus events.Bus) *ConfigHandler {
	return &ConfigHandler{
		cfg:      cfg,
		registry: registry,
		bus:      bus,
	}
}

// GetConfig handles GET /config.
func (h *ConfigHandler) GetConfig(w http.ResponseWriter, r *http.Request) {
	cfg, err := h.cfg.GetConfig()
	if err != nil {
		WriteError(w, http.StatusInternalServerError, err.Error())
		return
	}

	WriteJSON(w, http.StatusOK, cfg)
}

// PatchConfig handles PATCH /config.
func (h *ConfigHandler) PatchConfig(w http.ResponseWriter, r *http.Request) {
	var body map[string]map[string]any
	if err := ParseBody(r, &body); err != nil {
		WriteError(w, http.StatusBadRequest, err.Error())
		return
	}

	for section, values := range body {
		if err := h.cfg.UpdateConfig(section, values); err != nil {
			WriteErrorf(w, http.StatusBadRequest, "update section %s: %s", section, err.Error())
			return
		}
	}

	h.bus.Publish(events.Event{
		Type: events.ConfigChanged,
		Data: map[string]any{"sections": sectionNames(body)},
	})

	cfg, err := h.cfg.GetConfig()
	if err != nil {
		WriteError(w, http.StatusInternalServerError, err.Error())
		return
	}

	WriteJSON(w, http.StatusOK, cfg)
}

// GetSection handles GET /config/{section}.
func (h *ConfigHandler) GetSection(w http.ResponseWriter, r *http.Request) {
	section := chi.URLParam(r, "section")

	// Special handling for backend-specific config.
	if section == "backend" {
		backendType := h.cfg.GetActiveBackendType()
		raw, err := h.cfg.GetBackendConfig(backendType)
		if err != nil {
			WriteError(w, http.StatusInternalServerError, err.Error())
			return
		}
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write(raw)
		return
	}

	data, err := h.cfg.GetSection(section)
	if err != nil {
		WriteErrorf(w, http.StatusNotFound, "unknown section: %s", section)
		return
	}

	WriteJSON(w, http.StatusOK, data)
}

// PatchSection handles PATCH /config/{section}.
func (h *ConfigHandler) PatchSection(w http.ResponseWriter, r *http.Request) {
	section := chi.URLParam(r, "section")

	// Legacy: PATCH /config/backend updates the active backend only.
	if section == "backend" {
		h.patchNamedBackend(w, r, h.cfg.GetActiveBackendType())
		return
	}

	h.patchSectionNonBackend(w, r, section)
}

// GetNamedBackendConfig handles GET /config/backends/{backend}.
func (h *ConfigHandler) GetNamedBackendConfig(w http.ResponseWriter, r *http.Request) {
	name := namedBackendFromRequest(r)
	if name == "" {
		WriteError(w, http.StatusBadRequest, "backend name is required")
		return
	}
	if _, ok := h.registry.Get(name); !ok {
		WriteErrorf(w, http.StatusNotFound, "unknown backend: %s", name)
		return
	}
	raw, err := h.cfg.GetBackendConfig(name)
	if err != nil {
		WriteError(w, http.StatusInternalServerError, err.Error())
		return
	}
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write(raw)
}

// PatchNamedBackendConfig handles PATCH /config/backends/{backend}.
func (h *ConfigHandler) PatchNamedBackendConfig(w http.ResponseWriter, r *http.Request) {
	name := namedBackendFromRequest(r)
	if name == "" {
		WriteError(w, http.StatusBadRequest, "backend name is required")
		return
	}
	h.patchNamedBackend(w, r, name)
}

func namedBackendFromRequest(r *http.Request) string {
	raw := chi.URLParam(r, "backend")
	if raw == "" {
		return ""
	}
	name, err := url.PathUnescape(raw)
	if err != nil {
		return raw
	}
	return name
}

func (h *ConfigHandler) patchNamedBackend(w http.ResponseWriter, r *http.Request, backendName string) {
	var raw json.RawMessage
	if err := ParseBody(r, &raw); err != nil {
		WriteError(w, http.StatusBadRequest, err.Error())
		return
	}

	b, ok := h.registry.Get(backendName)
	if !ok {
		WriteErrorf(w, http.StatusNotFound, "unknown backend: %s", backendName)
		return
	}

	if err := b.ValidateConfig(raw); err != nil {
		WriteErrorf(w, http.StatusBadRequest, "invalid backend config: %s", err.Error())
		return
	}

	if err := h.cfg.SetBackendConfig(backendName, raw); err != nil {
		WriteError(w, http.StatusInternalServerError, err.Error())
		return
	}

	active := h.cfg.GetActiveBackendType()
	if backendName == active {
		if syncer, ok := b.(backend.RuntimeConfigSync); ok {
			if err := syncer.SyncRuntimeFromConfig(r.Context()); err != nil {
				slog.Warn("backend runtime sync after config save failed", "backend", backendName, "error", err)
			}
		}
	}

	h.bus.Publish(events.Event{
		Type: events.ConfigChanged,
		Data: map[string]any{"sections": []string{"backend." + backendName}},
	})

	WriteJSON(w, http.StatusOK, map[string]string{"status": "updated"})
}

func (h *ConfigHandler) patchSectionNonBackend(w http.ResponseWriter, r *http.Request, section string) {
	var values map[string]any
	if err := ParseBody(r, &values); err != nil {
		WriteError(w, http.StatusBadRequest, err.Error())
		return
	}

	if err := h.cfg.UpdateConfig(section, values); err != nil {
		WriteErrorf(w, http.StatusBadRequest, "update section %s: %s", section, err.Error())
		return
	}

	h.bus.Publish(events.Event{
		Type: events.ConfigChanged,
		Data: map[string]any{"sections": []string{section}},
	})

	data, err := h.cfg.GetSection(section)
	if err != nil {
		WriteError(w, http.StatusInternalServerError, err.Error())
		return
	}

	WriteJSON(w, http.StatusOK, data)
}

func sectionNames(body map[string]map[string]any) []string {
	names := make([]string, 0, len(body))
	for k := range body {
		names = append(names, k)
	}
	return names
}
