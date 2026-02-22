package handler

import (
	"context"
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"

	"github.com/go-chi/chi/v5"

	"waypaper-engine/daemon/internal/events"
	img "waypaper-engine/daemon/internal/image"
	"waypaper-engine/daemon/internal/store"
	"waypaper-engine/daemon/internal/system"
)

// ImageHandler handles all /images endpoints.
type ImageHandler struct {
	store     store.ImageStore
	processor *img.Processor
	bus       events.Bus
}

// NewImageHandler creates an ImageHandler.
func NewImageHandler(store store.ImageStore, processor *img.Processor, bus events.Bus) *ImageHandler {
	return &ImageHandler{
		store:     store,
		processor: processor,
		bus:       bus,
	}
}

// List handles GET /images.
func (h *ImageHandler) List(w http.ResponseWriter, r *http.Request) {
	p := ParsePagination(r)
	q := r.URL.Query()

	opts := store.ImageQueryOpts{
		Page:      p.Page,
		PerPage:   p.PerPage,
		SortBy:    p.SortBy,
		SortOrder: p.SortOrder,
		MediaType: q.Get("media_type"),
		Search:    q.Get("search"),
	}

	if tags := q.Get("tags"); tags != "" {
		opts.Tags = strings.Split(tags, ",")
	}

	if colors := q.Get("colors"); colors != "" {
		opts.Colors = strings.Split(colors, ",")
	}

	if folderID := q.Get("folder_id"); folderID != "" {
		if folderID == "root" || folderID == "0" {
			zero := 0
			opts.FolderID = &zero
		} else {
			fid, err := strconv.Atoi(folderID)
			if err == nil {
				opts.FolderID = &fid
			}
		}
	}

	result, err := h.store.GetAll(r.Context(), opts)
	if err != nil {
		WriteError(w, http.StatusInternalServerError, err.Error())
		return
	}

	WriteJSON(w, http.StatusOK, result)
}

// Get handles GET /images/{id}.
func (h *ImageHandler) Get(w http.ResponseWriter, r *http.Request) {
	id, err := ParseIntParam(chi.URLParam(r, "id"))
	if err != nil {
		WriteError(w, http.StatusBadRequest, err.Error())
		return
	}

	image, err := h.store.GetByID(r.Context(), id)
	if err != nil {
		WriteError(w, http.StatusNotFound, err.Error())
		return
	}

	WriteJSON(w, http.StatusOK, image)
}

// addRequest is the JSON body for POST /images.
type addRequest struct {
	Paths    []string `json:"paths"`
	FolderID *int     `json:"folder_id,omitempty"`
}

// Add handles POST /images.
func (h *ImageHandler) Add(w http.ResponseWriter, r *http.Request) {
	var req addRequest
	if err := ParseBody(r, &req); err != nil {
		WriteError(w, http.StatusBadRequest, err.Error())
		return
	}

	if len(req.Paths) == 0 {
		WriteError(w, http.StatusBadRequest, "paths array is required and must not be empty")
		return
	}

	// Process asynchronously; respond immediately with accepted status.
	// Use context.Background() instead of r.Context() because the request
	// context is cancelled as soon as we send the response, which would
	// abort the background goroutine immediately.
	batchID := h.processor.ProcessBatchWithFolder(context.Background(), req.Paths, req.FolderID)

	WriteJSON(w, http.StatusAccepted, map[string]any{
		"status":   "processing",
		"total":    len(req.Paths),
		"batch_id": batchID,
	})
}

// cancelImportRequest is the JSON body for POST /images/cancel-import.
type cancelImportRequest struct {
	BatchID string `json:"batch_id"`
}

// CancelImport handles POST /images/cancel-import.
func (h *ImageHandler) CancelImport(w http.ResponseWriter, r *http.Request) {
	var req cancelImportRequest
	if err := ParseBody(r, &req); err != nil {
		WriteError(w, http.StatusBadRequest, err.Error())
		return
	}

	if req.BatchID == "" {
		WriteError(w, http.StatusBadRequest, "batch_id is required")
		return
	}

	if !h.processor.CancelBatch(req.BatchID) {
		WriteError(w, http.StatusNotFound, "batch not found or already completed")
		return
	}

	WriteJSON(w, http.StatusOK, map[string]any{
		"status":   "cancelled",
		"batch_id": req.BatchID,
	})
}

// Update handles PATCH /images/{id}.
func (h *ImageHandler) Update(w http.ResponseWriter, r *http.Request) {
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

	// Only allow mutable fields.
	allowed := map[string]bool{"name": true, "tags": true, "colors": true, "is_selected": true, "folder_id": true}
	for key := range updates {
		if !allowed[key] {
			WriteErrorf(w, http.StatusBadRequest, "field %q is not updatable", key)
			return
		}
	}

	if tagsRaw, ok := updates["tags"]; ok {
		if tags := normalizeStringSlice(tagsRaw); tags != nil {
			updates["tags"] = tags
		}
	}
	if colorsRaw, ok := updates["colors"]; ok {
		if colors := normalizeStringSlice(colorsRaw); colors != nil {
			updates["colors"] = colors
		}
	}

	image, err := h.store.Update(r.Context(), id, updates)
	if err != nil {
		WriteError(w, http.StatusNotFound, err.Error())
		return
	}

	h.bus.Publish(events.Event{
		Type: events.ImagesUpdated,
		Data: map[string]any{"action": "updated", "image_id": id},
	})

	WriteJSON(w, http.StatusOK, image)
}

// renameRequest is the JSON body for POST /images/{id}/rename.
type renameRequest struct {
	Name string `json:"name"`
}

// RenameImage handles POST /images/{id}/rename.
// It renames the display name, the physical file on disk, and ensures name uniqueness.
func (h *ImageHandler) RenameImage(w http.ResponseWriter, r *http.Request) {
	id, err := ParseIntParam(chi.URLParam(r, "id"))
	if err != nil {
		WriteError(w, http.StatusBadRequest, err.Error())
		return
	}

	var req renameRequest
	if err := ParseBody(r, &req); err != nil {
		WriteError(w, http.StatusBadRequest, err.Error())
		return
	}

	name := strings.TrimSpace(req.Name)
	if err := validateImageName(name); err != nil {
		WriteError(w, http.StatusBadRequest, err.Error())
		return
	}

	current, err := h.store.GetByID(r.Context(), id)
	if err != nil {
		WriteError(w, http.StatusNotFound, err.Error())
		return
	}

	// Strip extension if user supplied one matching the image's format.
	for _, ext := range []string{"." + current.Format, ".jpeg"} {
		if strings.EqualFold(filepath.Ext(name), ext) {
			name = strings.TrimSuffix(name, filepath.Ext(name))
			break
		}
	}

	// No-op if the name hasn't changed.
	if name == current.Name {
		WriteJSON(w, http.StatusOK, current)
		return
	}

	// Ensure uniqueness, auto-suffix if taken.
	finalName := name
	for i := 1; ; i++ {
		taken, err := h.store.IsNameTaken(r.Context(), finalName, id)
		if err != nil {
			WriteError(w, http.StatusInternalServerError, err.Error())
			return
		}
		if !taken {
			break
		}
		finalName = fmt.Sprintf("%s_%d", name, i)
	}

	// Build new file path and rename on disk.
	ext := filepath.Ext(current.Path)
	newPath := filepath.Join(filepath.Dir(current.Path), finalName+ext)
	newPath = system.UniquePath(newPath)

	if err := os.Rename(current.Path, newPath); err != nil {
		WriteErrorf(w, http.StatusInternalServerError, "rename file: %v", err)
		return
	}

	image, err := h.store.Update(r.Context(), id, map[string]any{
		"name": finalName,
		"path": newPath,
	})
	if err != nil {
		// Best-effort rollback of the filesystem rename.
		_ = os.Rename(newPath, current.Path)
		WriteError(w, http.StatusInternalServerError, err.Error())
		return
	}

	h.bus.Publish(events.Event{
		Type: events.ImagesUpdated,
		Data: map[string]any{"action": "renamed", "image_id": id},
	})

	WriteJSON(w, http.StatusOK, image)
}

// validateImageName rejects empty names and names with path-separator or control characters.
func validateImageName(name string) error {
	if name == "" {
		return fmt.Errorf("name must not be empty")
	}
	if len(name) > 255 {
		return fmt.Errorf("name must not exceed 255 characters")
	}
	if strings.ContainsAny(name, "/\\\x00") {
		return fmt.Errorf("name must not contain path separators or null bytes")
	}
	return nil
}

// deleteRequest is the JSON body for DELETE /images.
type deleteRequest struct {
	IDs []int `json:"ids"`
}

// Delete handles DELETE /images.
func (h *ImageHandler) Delete(w http.ResponseWriter, r *http.Request) {
	var req deleteRequest
	if err := ParseBody(r, &req); err != nil {
		WriteError(w, http.StatusBadRequest, err.Error())
		return
	}

	if len(req.IDs) == 0 {
		WriteError(w, http.StatusBadRequest, "ids array is required and must not be empty")
		return
	}

	count, err := h.store.Delete(r.Context(), req.IDs)
	if err != nil {
		WriteError(w, http.StatusInternalServerError, err.Error())
		return
	}

	h.bus.Publish(events.Event{
		Type: events.ImagesUpdated,
		Data: map[string]any{"action": "deleted", "count": count},
	})

	WriteJSON(w, http.StatusOK, map[string]any{"deleted": count})
}

// SelectAll handles POST /images/select-all.
func (h *ImageHandler) SelectAll(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Selected bool `json:"selected"`
	}
	if err := ParseBody(r, &body); err != nil {
		WriteError(w, http.StatusBadRequest, err.Error())
		return
	}

	updated, err := h.store.UpdateAll(r.Context(), map[string]any{"is_selected": body.Selected})
	if err != nil {
		WriteError(w, http.StatusInternalServerError, err.Error())
		return
	}

	WriteJSON(w, http.StatusOK, map[string]any{
		"updated":  updated,
		"selected": body.Selected,
	})
}

// Count handles GET /images/count.
func (h *ImageHandler) Count(w http.ResponseWriter, r *http.Request) {
	count, err := h.store.Count(r.Context())
	if err != nil {
		WriteError(w, http.StatusInternalServerError, err.Error())
		return
	}

	WriteJSON(w, http.StatusOK, map[string]any{"count": count})
}

// Tags handles GET /images/tags — returns all unique tags across images.
func (h *ImageHandler) Tags(w http.ResponseWriter, r *http.Request) {
	tags, err := h.store.GetAllTags(r.Context())
	if err != nil {
		WriteError(w, http.StatusInternalServerError, err.Error())
		return
	}
	if tags == nil {
		tags = []string{}
	}
	WriteJSON(w, http.StatusOK, map[string]any{"tags": tags})
}

// resolveThumbnail looks up an image and returns the thumbnail path for the
// requested resolution. Writes an HTTP error and returns ("", false) on failure.
func (h *ImageHandler) resolveThumbnail(w http.ResponseWriter, r *http.Request) (string, bool) {
	id, err := ParseIntParam(chi.URLParam(r, "id"))
	if err != nil {
		WriteError(w, http.StatusBadRequest, err.Error())
		return "", false
	}

	resolution := r.URL.Query().Get("resolution")
	if resolution == "" {
		resolution = "default"
	}

	image, err := h.store.GetByID(r.Context(), id)
	if err != nil {
		WriteError(w, http.StatusNotFound, err.Error())
		return "", false
	}

	if image.Thumbnails == nil {
		WriteError(w, http.StatusNotFound, "no thumbnails available")
		return "", false
	}

	thumbPath, ok := image.Thumbnails[resolution]
	if !ok {
		WriteErrorf(w, http.StatusNotFound, "thumbnail resolution %q not found", resolution)
		return "", false
	}

	return thumbPath, true
}

// Thumbnail handles GET /images/{id}/thumbnail.
func (h *ImageHandler) Thumbnail(w http.ResponseWriter, r *http.Request) {
	thumbPath, ok := h.resolveThumbnail(w, r)
	if !ok {
		return
	}
	WriteJSON(w, http.StatusOK, map[string]string{"path": thumbPath})
}

// RawThumbnail handles GET /images/{id}/thumbnail/raw — serves the actual image file.
func (h *ImageHandler) RawThumbnail(w http.ResponseWriter, r *http.Request) {
	thumbPath, ok := h.resolveThumbnail(w, r)
	if !ok {
		return
	}
	w.Header().Set("Content-Type", "image/webp")
	http.ServeFile(w, r, thumbPath)
}

// RawImage handles GET /images/{id}/raw — serves the actual image file.
func (h *ImageHandler) RawImage(w http.ResponseWriter, r *http.Request) {
	id, err := ParseIntParam(chi.URLParam(r, "id"))
	if err != nil {
		WriteError(w, http.StatusBadRequest, err.Error())
		return
	}

	image, err := h.store.GetByID(r.Context(), id)
	if err != nil {
		WriteError(w, http.StatusNotFound, err.Error())
		return
	}

	// Detect content type from format.
	contentType := "image/" + image.Format
	if image.Format == "jpg" {
		contentType = "image/jpeg"
	}

	w.Header().Set("Content-Type", contentType)
	http.ServeFile(w, r, image.Path)
}
