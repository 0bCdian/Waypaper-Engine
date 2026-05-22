package confighandler

import (
	"encoding/json"
	"errors"
	"net/http"
	"net/url"

	"github.com/go-chi/chi/v5"

	"waypaper-engine/daemon/internal/control"
	"waypaper-engine/daemon/internal/handler/httpjson"
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
//
// @Summary      Get full config
// @Tags         config
// @Success      200  {object}  map[string]any
// @Failure      500  {object}  httpjson.APIError
// @Router       /config [get]
func (h *ConfigHandler) GetConfig(w http.ResponseWriter, r *http.Request) {
	merged, err := h.control.MergedConfigJSON()
	if err != nil {
		httpjson.WriteError(w, http.StatusInternalServerError, err.Error())
		return
	}

	httpjson.WriteJSON(w, http.StatusOK, merged)
}

// PatchConfig handles PATCH /config.
//
// @Summary      Patch config sections
// @Tags         config
// @Param        body  body      map[string]map[string]any  true  "Section patches"
// @Success      200   {object}  map[string]any
// @Failure      400   {object}  httpjson.APIError
// @Failure      500   {object}  httpjson.APIError
// @Router       /config [patch]
func (h *ConfigHandler) PatchConfig(w http.ResponseWriter, r *http.Request) {
	var body map[string]map[string]any
	if err := httpjson.ParseBody(r, &body); err != nil {
		httpjson.WriteError(w, http.StatusBadRequest, err.Error())
		return
	}

	for section, values := range body {
		if err := h.control.UpdateConfig(section, values); err != nil {
			httpjson.WriteErrorf(w, http.StatusBadRequest, "update section %s: %s", section, err.Error())
			return
		}
	}

	merged, err := h.control.MergedConfigJSON()
	if err != nil {
		httpjson.WriteError(w, http.StatusInternalServerError, err.Error())
		return
	}

	httpjson.WriteJSON(w, http.StatusOK, merged)
}

// PostResetAll handles POST /config/reset — factory-reset every section and backend subtree.
func (h *ConfigHandler) PostResetAll(w http.ResponseWriter, r *http.Request) {
	if err := h.control.ResetAllConfigToDefaults(r.Context()); err != nil {
		httpjson.WriteError(w, http.StatusInternalServerError, err.Error())
		return
	}
	merged, err := h.control.MergedConfigJSON()
	if err != nil {
		httpjson.WriteError(w, http.StatusInternalServerError, err.Error())
		return
	}
	httpjson.WriteJSON(w, http.StatusOK, merged)
}

// GetSection handles GET /config/{section}.
//
// @Summary      Get a config section
// @Tags         config
// @Param        section  path      string  true  "Section name"
// @Success      200      {object}  map[string]any
// @Failure      404      {object}  httpjson.APIError
// @Router       /config/{section} [get]
func (h *ConfigHandler) GetSection(w http.ResponseWriter, r *http.Request) {
	section := chi.URLParam(r, "section")
	if section == "backend" {
		httpjson.WriteErrorf(w, http.StatusNotFound, "unknown section: %s", section)
		return
	}

	data, err := h.control.GetSection(section)
	if err != nil {
		httpjson.WriteErrorf(w, http.StatusNotFound, "unknown section: %s", section)
		return
	}

	httpjson.WriteJSON(w, http.StatusOK, data)
}

// PatchSection handles PATCH /config/{section}.
//
// @Summary      Patch a config section
// @Tags         config
// @Param        section  path      string          true  "Section name"
// @Param        body     body      map[string]any  true  "Section values"
// @Success      200      {object}  map[string]any
// @Failure      400      {object}  httpjson.APIError
// @Failure      404      {object}  httpjson.APIError
// @Router       /config/{section} [patch]
func (h *ConfigHandler) PatchSection(w http.ResponseWriter, r *http.Request) {
	section := chi.URLParam(r, "section")
	if section == "backend" {
		httpjson.WriteErrorf(w, http.StatusNotFound, "unknown section: %s", section)
		return
	}
	h.patchSection(w, r, section)
}

// GetNamedBackendConfig handles GET /config/backends/{backend}.
//
// @Summary      Get backend config
// @Tags         config
// @Param        backend  path      string  true  "Backend name"
// @Success      200      {object}  map[string]any
// @Failure      400      {object}  httpjson.APIError
// @Failure      404      {object}  httpjson.APIError
// @Failure      500      {object}  httpjson.APIError
// @Router       /config/backends/{backend} [get]
func (h *ConfigHandler) GetNamedBackendConfig(w http.ResponseWriter, r *http.Request) {
	name := namedBackendFromRequest(r)
	if name == "" {
		httpjson.WriteError(w, http.StatusBadRequest, "backend name is required")
		return
	}
	if !h.control.NamedBackendExists(name) {
		httpjson.WriteErrorf(w, http.StatusNotFound, "unknown backend: %s", name)
		return
	}
	raw, err := h.control.GetBackendConfig(name)
	if err != nil {
		httpjson.WriteError(w, http.StatusInternalServerError, err.Error())
		return
	}
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write(raw)
}

// PatchNamedBackendConfig handles PATCH /config/backends/{backend}.
//
// @Summary      Patch backend config
// @Tags         config
// @Param        backend  path      string          true  "Backend name"
// @Param        body     body      map[string]any  true  "Backend config patch"
// @Success      200      {object}  map[string]string
// @Failure      400      {object}  httpjson.APIError
// @Failure      404      {object}  httpjson.APIError
// @Failure      500      {object}  httpjson.APIError
// @Router       /config/backends/{backend} [patch]
func (h *ConfigHandler) PatchNamedBackendConfig(w http.ResponseWriter, r *http.Request) {
	name := namedBackendFromRequest(r)
	if name == "" {
		httpjson.WriteError(w, http.StatusBadRequest, "backend name is required")
		return
	}
	var raw json.RawMessage
	if err := httpjson.ParseBody(r, &raw); err != nil {
		httpjson.WriteError(w, http.StatusBadRequest, err.Error())
		return
	}
	if err := h.control.UpdateBackendConfig(r.Context(), name, raw); err != nil {
		var inv *control.InvalidBackendConfigError
		switch {
		case errors.As(err, &inv):
			httpjson.WriteErrorf(w, http.StatusBadRequest, "%s", err.Error())
		case errors.Is(err, control.ErrUnknownBackend):
			httpjson.WriteErrorf(w, http.StatusNotFound, "unknown backend: %s", name)
		default:
			httpjson.WriteError(w, http.StatusInternalServerError, err.Error())
		}
		return
	}
	httpjson.WriteJSON(w, http.StatusOK, map[string]string{"status": "updated"})
}

// PostResetNamedBackendConfig handles POST /config/backends/{backend}/reset.
func (h *ConfigHandler) PostResetNamedBackendConfig(w http.ResponseWriter, r *http.Request) {
	name := namedBackendFromRequest(r)
	if name == "" {
		httpjson.WriteError(w, http.StatusBadRequest, "backend name is required")
		return
	}
	if !h.control.NamedBackendExists(name) {
		httpjson.WriteErrorf(w, http.StatusNotFound, "unknown backend: %s", name)
		return
	}
	if err := h.control.ResetBackendConfigToDefaults(r.Context(), name); err != nil {
		var inv *control.InvalidBackendConfigError
		switch {
		case errors.As(err, &inv):
			httpjson.WriteErrorf(w, http.StatusBadRequest, "%s", err.Error())
		case errors.Is(err, control.ErrUnknownBackend):
			httpjson.WriteErrorf(w, http.StatusNotFound, "unknown backend: %s", name)
		default:
			httpjson.WriteError(w, http.StatusInternalServerError, err.Error())
		}
		return
	}
	httpjson.WriteJSON(w, http.StatusOK, map[string]string{"status": "reset"})
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
	if err := httpjson.ParseBody(r, &values); err != nil {
		httpjson.WriteError(w, http.StatusBadRequest, err.Error())
		return
	}

	if err := h.control.UpdateConfig(section, values); err != nil {
		httpjson.WriteErrorf(w, http.StatusBadRequest, "update section %s: %s", section, err.Error())
		return
	}

	data, err := h.control.GetSection(section)
	if err != nil {
		httpjson.WriteError(w, http.StatusInternalServerError, err.Error())
		return
	}

	httpjson.WriteJSON(w, http.StatusOK, data)
}
