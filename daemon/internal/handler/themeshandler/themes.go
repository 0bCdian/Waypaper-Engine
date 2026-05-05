// Package themeshandler provides HTTP handlers for user-provided palette CSS files.
package themeshandler

import (
	"io"
	"net/http"

	"github.com/go-chi/chi/v5"

	"waypaper-engine/daemon/internal/handler/httpjson"
	"waypaper-engine/daemon/internal/themes"
)

// ThemesHandler handles /api/themes endpoints.
type ThemesHandler struct {
	dir string
}

// NewThemesHandler creates a ThemesHandler that serves themes from dir.
func NewThemesHandler(dir string) *ThemesHandler {
	return &ThemesHandler{dir: dir}
}

// List handles GET /api/themes and returns all user theme metadata as JSON.
func (h *ThemesHandler) List(w http.ResponseWriter, r *http.Request) {
	list, err := themes.List(h.dir)
	if err != nil {
		httpjson.WriteError(w, http.StatusInternalServerError, err.Error())
		return
	}
	httpjson.WriteJSON(w, http.StatusOK, list)
}

// Get handles GET /api/themes/{name}.css and streams the CSS file.
func (h *ThemesHandler) Get(w http.ResponseWriter, r *http.Request) {
	name := chi.URLParam(r, "name")
	f, err := themes.Open(h.dir, name)
	if err != nil {
		http.Error(w, "not found", http.StatusNotFound)
		return
	}
	defer f.Close()
	w.Header().Set("Content-Type", "text/css; charset=utf-8")
	io.Copy(w, f) //nolint:errcheck
}
