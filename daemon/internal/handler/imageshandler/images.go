package imageshandler

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"

	"waypaper-engine/daemon/internal/backend"
	"waypaper-engine/daemon/internal/events"
	"waypaper-engine/daemon/internal/handler/httpjson"
	img "waypaper-engine/daemon/internal/image"
	"waypaper-engine/daemon/internal/store"
	"waypaper-engine/daemon/internal/system"
	"waypaper-engine/daemon/internal/wallpaper"
)

// ImageHandler handles all /images endpoints.
type ImageHandler struct {
	store     store.ImageStore
	processor *img.Processor
	bus       events.Bus
	registry  backend.Registry
}

// NewImageHandler creates an ImageHandler.
func NewImageHandler(
	store store.ImageStore,
	processor *img.Processor,
	bus events.Bus,
	registry backend.Registry,
) *ImageHandler {
	return &ImageHandler{
		store:     store,
		processor: processor,
		bus:       bus,
		registry:  registry,
	}
}

// List handles GET /images.
//
// @Summary      List images
// @Tags         images
// @Param        page        query     int     false  "Page number"
// @Param        per_page    query     int     false  "Items per page"
// @Param        sort_by     query     string  false  "Sort field"
// @Param        sort_order  query     string  false  "asc or desc"
// @Param        media_type  query     string  false  "Filter by media type"
// @Param        search      query     string  false  "Search query"
// @Param        tags        query     string  false  "Comma-separated tags"
// @Param        folder_id   query     string  false  "Folder ID or 'root'"
// @Success      200         {object}  store.PaginatedResult[store.Image]
// @Failure      500         {object}  httpjson.APIError
// @Router       /images [get]
func (h *ImageHandler) List(w http.ResponseWriter, r *http.Request) {
	p := httpjson.ParsePagination(r)
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

	if cn := strings.TrimSpace(q.Get("colors_near")); cn != "" {
		opts.ColorsNear = parseColorsNearQuery(cn)
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
		httpjson.WriteError(w, http.StatusInternalServerError, err.Error())
		return
	}

	httpjson.WriteJSON(w, http.StatusOK, result)
}

// Get handles GET /images/{id}.
//
// @Summary      Get an image
// @Tags         images
// @Param        id   path      int  true  "Image ID"
// @Success      200  {object}  store.Image
// @Failure      400  {object}  httpjson.APIError
// @Failure      404  {object}  httpjson.APIError
// @Router       /images/{id} [get]
func (h *ImageHandler) Get(w http.ResponseWriter, r *http.Request) {
	id, err := httpjson.ParseIntParam(chi.URLParam(r, "id"))
	if err != nil {
		httpjson.WriteError(w, http.StatusBadRequest, err.Error())
		return
	}

	image, err := h.store.GetByID(r.Context(), id)
	if err != nil {
		httpjson.WriteError(w, http.StatusNotFound, err.Error())
		return
	}

	httpjson.WriteJSON(w, http.StatusOK, image)
}

// addRequest is the JSON body for POST /images.
type addRequest struct {
	Paths    []string `json:"paths"`
	FolderID *int     `json:"folder_id,omitempty"`
}

type importWebRequest struct {
	Path     string `json:"path"`
	FolderID *int   `json:"folder_id,omitempty"`
}

// Add handles POST /images.
//
// @Summary      Import images from filesystem paths
// @Tags         images
// @Param        body  body      addRequest  true  "Paths to import"
// @Success      202   {object}  map[string]any
// @Failure      400   {object}  httpjson.APIError
// @Router       /images [post]
func (h *ImageHandler) Add(w http.ResponseWriter, r *http.Request) {
	var req addRequest
	if err := httpjson.ParseBody(r, &req); err != nil {
		httpjson.WriteError(w, http.StatusBadRequest, err.Error())
		return
	}

	if len(req.Paths) == 0 {
		httpjson.WriteError(w, http.StatusBadRequest, "paths array is required and must not be empty")
		return
	}

	// Process asynchronously; respond immediately with accepted status.
	// Use context.Background() instead of r.Context() because the request
	// context is cancelled as soon as we send the response, which would
	// abort the background goroutine immediately.
	batchID := h.processor.ProcessBatchWithFolder(context.Background(), req.Paths, req.FolderID)

	httpjson.WriteJSON(w, http.StatusAccepted, map[string]any{
		"status":   "processing",
		"total":    len(req.Paths),
		"batch_id": batchID,
	})
}

// ImportWeb handles POST /images/import-web.
//
// @Summary      Import a web wallpaper
// @Tags         images
// @Param        body  body      importWebRequest  true  "Web wallpaper path"
// @Success      200   {object}  store.Image
// @Failure      400   {object}  httpjson.APIError
// @Router       /images/import-web [post]
func (h *ImageHandler) ImportWeb(w http.ResponseWriter, r *http.Request) {
	var req importWebRequest
	if err := httpjson.ParseBody(r, &req); err != nil {
		httpjson.WriteError(w, http.StatusBadRequest, err.Error())
		return
	}
	if strings.TrimSpace(req.Path) == "" {
		httpjson.WriteError(w, http.StatusBadRequest, "path is required")
		return
	}
	record, err := h.processor.ImportWebWallpaper(r.Context(), req.Path, req.FolderID)
	if err != nil {
		httpjson.WriteError(w, http.StatusBadRequest, err.Error())
		return
	}
	h.bus.Publish(events.Event{
		Type: events.GalleryChanged,
		Data: map[string]any{"domain": "images"},
	})
	httpjson.WriteJSON(w, http.StatusOK, record)
}

// cancelImportRequest is the JSON body for POST /images/cancel-import.
type cancelImportRequest struct {
	BatchID string `json:"batch_id"`
}

// CancelImport handles POST /images/cancel-import.
//
// @Summary      Cancel an in-progress import batch
// @Tags         images
// @Param        body  body      cancelImportRequest  true  "Batch ID"
// @Success      200   {object}  map[string]any
// @Failure      400   {object}  httpjson.APIError
// @Failure      404   {object}  httpjson.APIError
// @Router       /images/cancel-import [post]
func (h *ImageHandler) CancelImport(w http.ResponseWriter, r *http.Request) {
	var req cancelImportRequest
	if err := httpjson.ParseBody(r, &req); err != nil {
		httpjson.WriteError(w, http.StatusBadRequest, err.Error())
		return
	}

	if req.BatchID == "" {
		httpjson.WriteError(w, http.StatusBadRequest, "batch_id is required")
		return
	}

	if !h.processor.CancelBatch(req.BatchID) {
		httpjson.WriteError(w, http.StatusNotFound, "batch not found or already completed")
		return
	}

	httpjson.WriteJSON(w, http.StatusOK, map[string]any{
		"status":   "cancelled",
		"batch_id": req.BatchID,
	})
}

// Update handles PATCH /images/{id}.
//
// @Summary      Update image metadata
// @Tags         images
// @Param        id    path      int             true  "Image ID"
// @Param        body  body      map[string]any  true  "Fields: name, tags, colors, is_selected, folder_id, wallpaper_config_overrides, web_capabilities"
// @Success      200   {object}  store.Image
// @Failure      400   {object}  httpjson.APIError
// @Failure      404   {object}  httpjson.APIError
// @Failure      500   {object}  httpjson.APIError
// @Router       /images/{id} [patch]
func (h *ImageHandler) Update(w http.ResponseWriter, r *http.Request) {
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

	// Only allow mutable fields.
	allowed := map[string]bool{
		"name":                       true,
		"tags":                       true,
		"colors":                     true,
		"is_selected":                true,
		"folder_id":                  true,
		"wallpaper_config_overrides": true,
		"web_capabilities":           true,
	}
	for key := range updates {
		if !allowed[key] {
			httpjson.WriteErrorf(w, http.StatusBadRequest, "field %q is not updatable", key)
			return
		}
	}

	if raw, ok := updates["web_capabilities"]; ok {
		cur, gerr := h.store.GetByID(r.Context(), id)
		if gerr != nil {
			httpjson.WriteError(w, http.StatusNotFound, gerr.Error())
			return
		}
		if !strings.EqualFold(strings.TrimSpace(cur.MediaType), "web") || cur.WebMeta == nil {
			httpjson.WriteError(w, http.StatusBadRequest, "web_capabilities applies only to web wallpapers with metadata")
			return
		}
		patch, ok := raw.(map[string]any)
		if !ok {
			httpjson.WriteError(w, http.StatusBadRequest, "web_capabilities must be a JSON object")
			return
		}
		merged := wallpaper.MergeWebCapabilitiesJSON(cur.WebMeta.Capabilities, patch)
		cur.WebMeta.Capabilities = merged
		wmJSON, mErr := json.Marshal(cur.WebMeta)
		if mErr != nil {
			httpjson.WriteError(w, http.StatusInternalServerError, mErr.Error())
			return
		}
		var wmMap map[string]any
		if err := json.Unmarshal(wmJSON, &wmMap); err != nil {
			httpjson.WriteError(w, http.StatusInternalServerError, err.Error())
			return
		}
		// Replace client key with full web_meta document for the store layer.
		delete(updates, "web_capabilities")
		updates["web_meta"] = wmMap
	}

	for key := range updates {
		if key == "web_meta" {
			continue // injected by web_capabilities merge above
		}
		if !allowed[key] {
			httpjson.WriteErrorf(w, http.StatusBadRequest, "field %q is not updatable", key)
			return
		}
	}

	if tagsRaw, ok := updates["tags"]; ok {
		if tags := httpjson.NormalizeStringSlice(tagsRaw); tags != nil {
			updates["tags"] = tags
		}
	}
	if colorsRaw, ok := updates["colors"]; ok {
		if colors := httpjson.NormalizeStringSlice(colorsRaw); colors != nil {
			updates["colors"] = colors
		}
	}

	// If name is being patched, perform the filesystem rename atomically with the DB update.
	if rawName, ok := updates["name"]; ok {
		name, _ := rawName.(string)
		name = strings.TrimSpace(name)
		if err := validateImageName(name); err != nil {
			httpjson.WriteError(w, http.StatusBadRequest, err.Error())
			return
		}

		current, err := h.store.GetByID(r.Context(), id)
		if err != nil {
			httpjson.WriteError(w, http.StatusNotFound, err.Error())
			return
		}

		// Strip extension if user supplied one matching the image's format.
		for _, ext := range []string{"." + current.Format, ".jpeg"} {
			if strings.EqualFold(filepath.Ext(name), ext) {
				name = strings.TrimSuffix(name, filepath.Ext(name))
				break
			}
		}

		if name != current.Name {
			// Auto-suffix for uniqueness.
			finalName := name
			for i := 1; ; i++ {
				taken, err := h.store.IsNameTaken(r.Context(), finalName, id)
				if err != nil {
					httpjson.WriteError(w, http.StatusInternalServerError, err.Error())
					return
				}
				if !taken {
					break
				}
				finalName = fmt.Sprintf("%s_%d", name, i)
			}

			ext := filepath.Ext(current.Path)
			newPath := filepath.Join(filepath.Dir(current.Path), finalName+ext)
			newPath = system.UniquePath(newPath)

			if err := os.Rename(current.Path, newPath); err != nil {
				httpjson.WriteErrorf(w, http.StatusInternalServerError, "rename file: %v", err)
				return
			}

			// Carry the resolved name and new path into the store update.
			updates["name"] = finalName
			updates["path"] = newPath
		} else {
			// Name unchanged — remove to avoid a no-op write.
			delete(updates, "name")
		}
	}

	image, err := h.store.Update(r.Context(), id, updates)
	if err != nil {
		httpjson.WriteError(w, http.StatusNotFound, err.Error())
		return
	}

	if strings.EqualFold(strings.TrimSpace(image.MediaType), "web") {
		wallpaper.SyncWebImageToRenderer(r.Context(), h.registry, image)
	}

	h.bus.Publish(events.Event{
		Type: events.GalleryChanged,
		Data: map[string]any{"domain": "images"},
	})

	httpjson.WriteJSON(w, http.StatusOK, image)
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
//
// @Summary      Delete images
// @Tags         images
// @Param        body  body      deleteRequest  true  "Image IDs to delete"
// @Success      200   {object}  map[string]any
// @Failure      400   {object}  httpjson.APIError
// @Failure      500   {object}  httpjson.APIError
// @Router       /images [delete]
func (h *ImageHandler) Delete(w http.ResponseWriter, r *http.Request) {
	var req deleteRequest
	if err := httpjson.ParseBody(r, &req); err != nil {
		httpjson.WriteError(w, http.StatusBadRequest, err.Error())
		return
	}

	if len(req.IDs) == 0 {
		httpjson.WriteError(w, http.StatusBadRequest, "ids array is required and must not be empty")
		return
	}

	// Collect file paths before deletion so we can clean up disk afterward.
	var paths []string
	for _, id := range req.IDs {
		img, err := h.store.GetByID(r.Context(), id)
		if err != nil {
			continue
		}
		paths = append(paths, img.Path)
		for _, thumbPath := range img.Thumbnails {
			if thumbPath != "" {
				paths = append(paths, thumbPath)
			}
		}
		if img.WebMeta != nil && img.WebMeta.PackageRoot != "" {
			paths = append(paths, img.WebMeta.PackageRoot)
		}
	}

	count, err := h.store.Delete(r.Context(), req.IDs)
	if err != nil {
		httpjson.WriteError(w, http.StatusInternalServerError, err.Error())
		return
	}

	for _, p := range paths {
		_ = os.RemoveAll(p)
	}

	h.bus.Publish(events.Event{
		Type: events.GalleryChanged,
		Data: map[string]any{"domain": "images"},
	})

	httpjson.WriteJSON(w, http.StatusOK, map[string]any{"deleted": count})
}

// SelectAll handles POST /images/select-all.
//
// @Summary      Select or deselect all images
// @Tags         images
// @Param        body  body      map[string]bool  true  "selected: true/false"
// @Success      200   {object}  map[string]any
// @Failure      400   {object}  httpjson.APIError
// @Failure      500   {object}  httpjson.APIError
// @Router       /images/select-all [post]
func (h *ImageHandler) SelectAll(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Selected bool `json:"selected"`
	}
	if err := httpjson.ParseBody(r, &body); err != nil {
		httpjson.WriteError(w, http.StatusBadRequest, err.Error())
		return
	}

	updated, err := h.store.UpdateAll(r.Context(), map[string]any{"is_selected": body.Selected})
	if err != nil {
		httpjson.WriteError(w, http.StatusInternalServerError, err.Error())
		return
	}

	httpjson.WriteJSON(w, http.StatusOK, map[string]any{
		"updated":  updated,
		"selected": body.Selected,
	})
}

// Tags handles GET /images/tags — returns all unique tags across images.
//
// @Summary      List all tags
// @Tags         images
// @Success      200  {object}  map[string]any
// @Failure      500  {object}  httpjson.APIError
// @Router       /images/tags [get]
func (h *ImageHandler) Tags(w http.ResponseWriter, r *http.Request) {
	tags, err := h.store.GetAllTags(r.Context())
	if err != nil {
		httpjson.WriteError(w, http.StatusInternalServerError, err.Error())
		return
	}
	if tags == nil {
		tags = []string{}
	}
	httpjson.WriteJSON(w, http.StatusOK, map[string]any{"tags": tags})
}

// resolveThumbnail looks up an image and returns the thumbnail path for the
// requested resolution. Writes an HTTP error and returns ("", false) on failure.
func (h *ImageHandler) resolveThumbnail(w http.ResponseWriter, r *http.Request) (string, bool) {
	id, err := httpjson.ParseIntParam(chi.URLParam(r, "id"))
	if err != nil {
		httpjson.WriteError(w, http.StatusBadRequest, err.Error())
		return "", false
	}

	resolution := r.URL.Query().Get("resolution")
	if resolution == "" {
		resolution = "default"
	}

	image, err := h.store.GetByID(r.Context(), id)
	if err != nil {
		httpjson.WriteError(w, http.StatusNotFound, err.Error())
		return "", false
	}

	if image.Thumbnails == nil {
		httpjson.WriteError(w, http.StatusNotFound, "no thumbnails available")
		return "", false
	}

	thumbPath, ok := image.Thumbnails[resolution]
	if !ok {
		httpjson.WriteErrorf(w, http.StatusNotFound, "thumbnail resolution %q not found", resolution)
		return "", false
	}

	return thumbPath, true
}

// Thumbnail handles GET /images/{id}/thumbnail.
//
// @Summary      Get thumbnail path for an image
// @Tags         images
// @Param        id          path      int     true   "Image ID"
// @Param        resolution  query     string  false  "Thumbnail resolution (default: default)"
// @Success      200         {object}  map[string]string
// @Failure      400         {object}  httpjson.APIError
// @Failure      404         {object}  httpjson.APIError
// @Router       /images/{id}/thumbnail [get]
func (h *ImageHandler) Thumbnail(w http.ResponseWriter, r *http.Request) {
	thumbPath, ok := h.resolveThumbnail(w, r)
	if !ok {
		return
	}
	httpjson.WriteJSON(w, http.StatusOK, map[string]string{"path": thumbPath})
}

type videoLoopExportRequest struct {
	InSeconds   float64 `json:"in_seconds"`
	OutSeconds  float64 `json:"out_seconds"`
	Preset      string  `json:"preset"`
	Action      string  `json:"action"`
	FolderID    *int    `json:"folder_id,omitempty"`
	BlendHalves bool    `json:"blend_halves"`
}

// VideoLoopExport handles POST /images/{id}/video-loop-export — FFmpeg trim/re-encode for seamless native loop playback.
//
// @Summary      Export a video loop segment
// @Tags         images
// @Param        id    path      int                    true  "Image ID"
// @Param        body  body      videoLoopExportRequest true  "Export parameters"
// @Success      200   {object}  map[string]any
// @Failure      400   {object}  httpjson.APIError
// @Failure      404   {object}  httpjson.APIError
// @Failure      503   {object}  httpjson.APIError
// @Failure      500   {object}  httpjson.APIError
// @Router       /images/{id}/video-loop-export [post]
func (h *ImageHandler) VideoLoopExport(w http.ResponseWriter, r *http.Request) {
	id, err := httpjson.ParseIntParam(chi.URLParam(r, "id"))
	if err != nil {
		httpjson.WriteError(w, http.StatusBadRequest, err.Error())
		return
	}
	var req videoLoopExportRequest
	if err := httpjson.ParseBody(r, &req); err != nil {
		httpjson.WriteError(w, http.StatusBadRequest, err.Error())
		return
	}
	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Minute)
	defer cancel()
	out, err := h.processor.VideoLoopExport(ctx, id, req.InSeconds, req.OutSeconds, req.Preset, req.Action, req.FolderID, req.BlendHalves)
	if err != nil {
		if errors.Is(err, store.ErrNotFound) {
			httpjson.WriteError(w, http.StatusNotFound, err.Error())
			return
		}
		msg := err.Error()
		switch {
		case strings.Contains(msg, "not a video"),
			strings.Contains(msg, "invalid trim"),
			strings.Contains(msg, "invalid trim range"),
			strings.Contains(msg, "invalid action"),
			strings.Contains(msg, "unsupported preset"):
			httpjson.WriteError(w, http.StatusBadRequest, msg)
		case strings.Contains(msg, "ffmpeg not"),
			strings.Contains(msg, "ffprobe not"):
			httpjson.WriteError(w, http.StatusServiceUnavailable, msg)
		default:
			httpjson.WriteError(w, http.StatusInternalServerError, msg)
		}
		return
	}
	httpjson.WriteJSON(w, http.StatusOK, out)
}

// RawImage handles GET /images/{id}/raw — serves the actual image file.
//
// @Summary      Serve raw image file
// @Tags         images
// @Param        id  path  int  true  "Image ID"
// @Produce      application/octet-stream
// @Success      200  {file}    binary
// @Failure      400  {object}  httpjson.APIError
// @Failure      404  {object}  httpjson.APIError
// @Router       /images/{id}/raw [get]
func (h *ImageHandler) RawImage(w http.ResponseWriter, r *http.Request) {
	id, err := httpjson.ParseIntParam(chi.URLParam(r, "id"))
	if err != nil {
		httpjson.WriteError(w, http.StatusBadRequest, err.Error())
		return
	}

	image, err := h.store.GetByID(r.Context(), id)
	if err != nil {
		httpjson.WriteError(w, http.StatusNotFound, err.Error())
		return
	}

	// Detect content type from format.
	contentType := "image/" + image.Format
	if image.Format == "jpg" {
		contentType = "image/jpeg"
	} else if image.MediaType == "video" {
		contentType = "video/" + image.Format
	} else if image.MediaType == "web" || image.Format == "html" {
		contentType = "text/html"
	}

	w.Header().Set("Content-Type", contentType)
	http.ServeFile(w, r, image.Path)
}

// EnsureBrowserPreview handles POST /images/{id}/ensure-browser-preview — generates an H.264
// proxy when preview_path is missing and the file needs it, or when force=1 after decode failure.
//
// @Summary      Ensure browser-compatible video preview exists
// @Tags         images
// @Param        id     path   int     true   "Image ID"
// @Param        force  query  string  false  "Set to 1 to force regeneration"
// @Success      200    {object}  store.Image
// @Failure      400    {object}  httpjson.APIError
// @Failure      404    {object}  httpjson.APIError
// @Failure      500    {object}  httpjson.APIError
// @Router       /images/{id}/ensure-browser-preview [post]
func (h *ImageHandler) EnsureBrowserPreview(w http.ResponseWriter, r *http.Request) {
	id, err := httpjson.ParseIntParam(chi.URLParam(r, "id"))
	if err != nil {
		httpjson.WriteError(w, http.StatusBadRequest, err.Error())
		return
	}
	force := r.URL.Query().Get("force") == "1" || r.URL.Query().Get("force") == "true"
	img, err := h.processor.EnsureBrowserVideoPreview(r.Context(), id, force)
	if err != nil {
		if errors.Is(err, store.ErrNotFound) {
			httpjson.WriteError(w, http.StatusNotFound, err.Error())
			return
		}
		msg := err.Error()
		switch {
		case strings.Contains(msg, "not a video"):
			httpjson.WriteError(w, http.StatusBadRequest, msg)
		case strings.Contains(msg, "browser preview not required"):
			httpjson.WriteError(w, http.StatusConflict, msg)
		default:
			httpjson.WriteError(w, http.StatusInternalServerError, msg)
		}
		return
	}
	httpjson.WriteJSON(w, http.StatusOK, img)
}

// parseColorsNearQuery parses comma-separated "#hex~maxDeltaE" items (CIE76).
func parseColorsNearQuery(raw string) []store.ColorNearConstraint {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return nil
	}
	parts := strings.Split(raw, ",")
	var out []store.ColorNearConstraint
	for _, part := range parts {
		part = strings.TrimSpace(part)
		if part == "" {
			continue
		}
		idx := strings.LastIndex(part, "~")
		if idx <= 0 || idx >= len(part)-1 {
			continue
		}
		hex := strings.TrimSpace(part[:idx])
		num := strings.TrimSpace(part[idx+1:])
		maxDE, err := strconv.ParseFloat(num, 64)
		if err != nil || maxDE < 0 {
			continue
		}
		if hex == "" {
			continue
		}
		out = append(out, store.ColorNearConstraint{Hex: hex, MaxDeltaE: maxDE})
	}
	return out
}
