package handler

import (
	"encoding/json"
	"errors"
	"net/http"
	"net/url"

	"github.com/go-chi/chi/v5"

	"waypaper-engine/daemon/internal/control"
)

// ConfigHandler handles /config endpoints.
type ConfigHandler struct {
	control *control.Controller
}

// NewConfigHandler creates a ConfigHandler.
func NewConfigHandler(ctrl *control.Controller) *ConfigHandler {
	return &ConfigHandler{control: ctrl}
}

// GetConfig handles GET /config.
func (h *ConfigHandler) GetConfig(w http.ResponseWriter, r *http.Request) {
	cfg, err := h.control.GetConfig()
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
		if err := h.control.UpdateConfig(section, values); err != nil {
			WriteErrorf(w, http.StatusBadRequest, "update section %s: %s", section, err.Error())
			return
		}
	}

	cfg, err := h.control.GetConfig()
	if err != nil {
		WriteError(w, http.StatusInternalServerError, err.Error())
		return
	}

	WriteJSON(w, http.StatusOK, cfg)
}

// GetSection handles GET /config/{section}.
func (h *ConfigHandler) GetSection(w http.ResponseWriter, r *http.Request) {
	section := chi.URLParam(r, "section")
	if section == "backend" {
		WriteErrorf(w, http.StatusNotFound, "unknown section: %s", section)
		return
	}

	data, err := h.control.GetSection(section)
	if err != nil {
		WriteErrorf(w, http.StatusNotFound, "unknown section: %s", section)
		return
	}

	WriteJSON(w, http.StatusOK, data)
}

// PatchSection handles PATCH /config/{section}.
func (h *ConfigHandler) PatchSection(w http.ResponseWriter, r *http.Request) {
	section := chi.URLParam(r, "section")
	if section == "backend" {
		WriteErrorf(w, http.StatusNotFound, "unknown section: %s", section)
		return
	}
	h.patchSection(w, r, section)
}

// GetNamedBackendConfig handles GET /config/backends/{backend}.
func (h *ConfigHandler) GetNamedBackendConfig(w http.ResponseWriter, r *http.Request) {
	name := namedBackendFromRequest(r)
	if name == "" {
		WriteError(w, http.StatusBadRequest, "backend name is required")
		return
	}
	if !h.control.NamedBackendExists(name) {
		WriteErrorf(w, http.StatusNotFound, "unknown backend: %s", name)
		return
	}
	raw, err := h.control.GetBackendConfig(name)
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
	var raw json.RawMessage
	if err := ParseBody(r, &raw); err != nil {
		WriteError(w, http.StatusBadRequest, err.Error())
		return
	}
	if err := h.control.UpdateBackendConfig(r.Context(), name, raw); err != nil {
		var inv *control.InvalidBackendConfigError
		switch {
		case errors.As(err, &inv):
			WriteErrorf(w, http.StatusBadRequest, "%s", err.Error())
		case errors.Is(err, control.ErrUnknownBackend):
			WriteErrorf(w, http.StatusNotFound, "unknown backend: %s", name)
		default:
			WriteError(w, http.StatusInternalServerError, err.Error())
		}
		return
	}
	WriteJSON(w, http.StatusOK, map[string]string{"status": "updated"})
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

func (h *ConfigHandler) patchSection(w http.ResponseWriter, r *http.Request, section string) {
	var values map[string]any
	if err := ParseBody(r, &values); err != nil {
		WriteError(w, http.StatusBadRequest, err.Error())
		return
	}

	if err := h.control.UpdateConfig(section, values); err != nil {
		WriteErrorf(w, http.StatusBadRequest, "update section %s: %s", section, err.Error())
		return
	}

	data, err := h.control.GetSection(section)
	if err != nil {
		WriteError(w, http.StatusInternalServerError, err.Error())
		return
	}

	WriteJSON(w, http.StatusOK, data)
}
