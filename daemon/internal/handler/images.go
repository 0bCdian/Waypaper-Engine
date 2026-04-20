package handler

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"

	"waypaper-engine/daemon/internal/backend"
	"waypaper-engine/daemon/internal/events"
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

type importWebRequest struct {
	Path     string `json:"path"`
	FolderID *int   `json:"folder_id,omitempty"`
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

// ImportWeb handles POST /images/import-web.
func (h *ImageHandler) ImportWeb(w http.ResponseWriter, r *http.Request) {
	var req importWebRequest
	if err := ParseBody(r, &req); err != nil {
		WriteError(w, http.StatusBadRequest, err.Error())
		return
	}
	if strings.TrimSpace(req.Path) == "" {
		WriteError(w, http.StatusBadRequest, "path is required")
		return
	}
	record, err := h.processor.ImportWebWallpaper(r.Context(), req.Path, req.FolderID)
	if err != nil {
		WriteError(w, http.StatusBadRequest, err.Error())
		return
	}
	h.bus.Publish(events.Event{
		Type: events.ImagesUpdated,
		Data: map[string]any{
			"action": "added",
			"count":  1,
		},
	})
	WriteJSON(w, http.StatusOK, record)
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
			WriteErrorf(w, http.StatusBadRequest, "field %q is not updatable", key)
			return
		}
	}

	syncCapsToManifest := false
	if raw, ok := updates["web_capabilities"]; ok {
		cur, gerr := h.store.GetByID(r.Context(), id)
		if gerr != nil {
			WriteError(w, http.StatusNotFound, gerr.Error())
			return
		}
		if !strings.EqualFold(strings.TrimSpace(cur.MediaType), "web") || cur.WebMeta == nil {
			WriteError(w, http.StatusBadRequest, "web_capabilities applies only to web wallpapers with metadata")
			return
		}
		patch, ok := raw.(map[string]any)
		if !ok {
			WriteError(w, http.StatusBadRequest, "web_capabilities must be a JSON object")
			return
		}
		merged := wallpaper.MergeWebCapabilitiesJSON(cur.WebMeta.Capabilities, patch)
		cur.WebMeta.Capabilities = merged
		wmJSON, mErr := json.Marshal(cur.WebMeta)
		if mErr != nil {
			WriteError(w, http.StatusInternalServerError, mErr.Error())
			return
		}
		var wmMap map[string]any
		if err := json.Unmarshal(wmJSON, &wmMap); err != nil {
			WriteError(w, http.StatusInternalServerError, err.Error())
			return
		}
		// Replace client key with full web_meta document for the store layer.
		delete(updates, "web_capabilities")
		updates["web_meta"] = wmMap
		syncCapsToManifest = true
	}

	for key := range updates {
		if key == "web_meta" {
			continue // injected by web_capabilities merge above
		}
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

	if _, touched := updates["wallpaper_config_overrides"]; touched && image != nil {
		if strings.EqualFold(strings.TrimSpace(image.MediaType), "web") && image.WebMeta != nil {
			mp := strings.TrimSpace(image.WebMeta.ManifestPath)
			if mp != "" {
				if err := wallpaper.WriteWallpaperConfigOverridesToManifest(mp, image.WallpaperConfigOverrides); err != nil {
					slog.Warn("sync wallpaper_config_overrides to manifest failed", "image_id", id, "error", err)
				}
			}
		}
		if h.registry != nil && strings.EqualFold(strings.TrimSpace(image.MediaType), "web") {
			merged := wallpaper.MergedWallpaperConfigForImage(image)
			target := wallpaper.WebConfigPushSourceTarget(image)
			if err := wallpaper.PushWallpaperConfigToRenderer(r.Context(), h.registry, target, merged); err != nil {
				slog.Warn("push web wallpaper config to renderer failed", "image_id", id, "error", err)
			}
		}
	}

	if syncCapsToManifest && image != nil && strings.EqualFold(strings.TrimSpace(image.MediaType), "web") && image.WebMeta != nil {
		mp := strings.TrimSpace(image.WebMeta.ManifestPath)
		if mp != "" {
			if err := wallpaper.WriteWebCapabilitiesToManifest(mp, image.WebMeta.Capabilities); err != nil {
				slog.Warn("sync web capabilities to manifest failed", "image_id", id, "error", err)
			}
		}
		if h.registry != nil {
			capsJSON, mErr := json.Marshal(image.WebMeta.Capabilities)
			if mErr != nil {
				slog.Warn("marshal web capabilities for renderer push failed", "image_id", id, "error", mErr)
			} else {
				target := wallpaper.WebConfigPushSourceTarget(image)
				if err := wallpaper.PushWebCapabilitiesToRenderer(r.Context(), h.registry, target, capsJSON); err != nil {
					slog.Warn("push web capabilities to renderer failed", "image_id", id, "error", err)
				}
			}
		}
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
		WriteError(w, http.StatusInternalServerError, err.Error())
		return
	}

	for _, p := range paths {
		_ = os.RemoveAll(p)
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

type videoLoopExportRequest struct {
	InSeconds  float64 `json:"in_seconds"`
	OutSeconds float64 `json:"out_seconds"`
	Preset     string  `json:"preset"`
	Action     string  `json:"action"`
	FolderID   *int    `json:"folder_id,omitempty"`
}

// VideoLoopExport handles POST /images/{id}/video-loop-export — FFmpeg trim/re-encode for seamless native loop playback.
func (h *ImageHandler) VideoLoopExport(w http.ResponseWriter, r *http.Request) {
	id, err := ParseIntParam(chi.URLParam(r, "id"))
	if err != nil {
		WriteError(w, http.StatusBadRequest, err.Error())
		return
	}
	var req videoLoopExportRequest
	if err := ParseBody(r, &req); err != nil {
		WriteError(w, http.StatusBadRequest, err.Error())
		return
	}
	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Minute)
	defer cancel()
	out, err := h.processor.VideoLoopExport(ctx, id, req.InSeconds, req.OutSeconds, req.Preset, req.Action, req.FolderID)
	if err != nil {
		if errors.Is(err, store.ErrNotFound) {
			WriteError(w, http.StatusNotFound, err.Error())
			return
		}
		msg := err.Error()
		switch {
		case strings.Contains(msg, "not a video"),
			strings.Contains(msg, "invalid trim"),
			strings.Contains(msg, "invalid trim range"),
			strings.Contains(msg, "invalid action"),
			strings.Contains(msg, "unsupported preset"):
			WriteError(w, http.StatusBadRequest, msg)
		case strings.Contains(msg, "ffmpeg not"),
			strings.Contains(msg, "ffprobe not"):
			WriteError(w, http.StatusServiceUnavailable, msg)
		default:
			WriteError(w, http.StatusInternalServerError, msg)
		}
		return
	}
	WriteJSON(w, http.StatusOK, out)
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
func (h *ImageHandler) EnsureBrowserPreview(w http.ResponseWriter, r *http.Request) {
	id, err := ParseIntParam(chi.URLParam(r, "id"))
	if err != nil {
		WriteError(w, http.StatusBadRequest, err.Error())
		return
	}
	force := r.URL.Query().Get("force") == "1" || r.URL.Query().Get("force") == "true"
	img, err := h.processor.EnsureBrowserVideoPreview(r.Context(), id, force)
	if err != nil {
		if errors.Is(err, store.ErrNotFound) {
			WriteError(w, http.StatusNotFound, err.Error())
			return
		}
		msg := err.Error()
		switch {
		case strings.Contains(msg, "not a video"):
			WriteError(w, http.StatusBadRequest, msg)
		case strings.Contains(msg, "browser preview not required"):
			WriteError(w, http.StatusConflict, msg)
		default:
			WriteError(w, http.StatusInternalServerError, msg)
		}
		return
	}
	WriteJSON(w, http.StatusOK, img)
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
