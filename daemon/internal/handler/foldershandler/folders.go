package foldershandler

import (
	"context"
	"log/slog"
	"net/http"
	"strconv"
	"strings"
	"waypaper-engine/daemon/internal/events"
	"waypaper-engine/daemon/internal/handler/httpjson"
	"waypaper-engine/daemon/internal/store"

	"github.com/go-chi/chi/v5"
)

type FolderHandler struct {
	folderStore store.FolderStore
	imageStore  store.ImageStore
	bus         events.Bus
}

func NewFolderHandler(folderStore store.FolderStore, imageStore store.ImageStore, bus events.Bus) *FolderHandler {
	return &FolderHandler{
		folderStore: folderStore,
		imageStore:  imageStore,
		bus:         bus,
	}
}

func (h *FolderHandler) List(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query()

	var parentID *int
	if pidStr := q.Get("parent_id"); pidStr != "" {
		if pidStr == "root" || pidStr == "null" {
			parentID = nil
		} else {
			pid, err := strconv.Atoi(pidStr)
			if err != nil {
				httpjson.WriteError(w, http.StatusBadRequest, "invalid parent_id")
				return
			}
			parentID = &pid
		}
	}

	if searchQuery := q.Get("search"); searchQuery != "" {
		folders, err := h.folderStore.Search(r.Context(), searchQuery)
		if err != nil {
			httpjson.WriteError(w, http.StatusInternalServerError, err.Error())
			return
		}
		if folders == nil {
			folders = []store.Folder{}
		}
		httpjson.WriteJSON(w, http.StatusOK, FolderListResponse{Data: folders})
		return
	}

	folders, err := h.folderStore.GetAll(r.Context(), parentID)
	if err != nil {
		httpjson.WriteError(w, http.StatusInternalServerError, err.Error())
		return
	}
	if folders == nil {
		folders = []store.Folder{}
	}

	httpjson.WriteJSON(w, http.StatusOK, FolderListResponse{Data: folders})
}

func (h *FolderHandler) Get(w http.ResponseWriter, r *http.Request) {
	id, err := httpjson.ParseIntParam(chi.URLParam(r, "id"))
	if err != nil {
		httpjson.WriteError(w, http.StatusBadRequest, err.Error())
		return
	}

	folder, err := h.folderStore.GetByID(r.Context(), id)
	if err != nil {
		httpjson.WriteError(w, http.StatusNotFound, err.Error())
		return
	}

	httpjson.WriteJSON(w, http.StatusOK, folder)
}

func (h *FolderHandler) GetPath(w http.ResponseWriter, r *http.Request) {
	id, err := httpjson.ParseIntParam(chi.URLParam(r, "id"))
	if err != nil {
		httpjson.WriteError(w, http.StatusBadRequest, err.Error())
		return
	}

	path, err := h.folderStore.GetPath(r.Context(), id)
	if err != nil {
		httpjson.WriteError(w, http.StatusNotFound, err.Error())
		return
	}

	httpjson.WriteJSON(w, http.StatusOK, FolderPathResponse{Data: path})
}

type createFolderRequest struct {
	Name     string `json:"name"`
	ParentID *int   `json:"parent_id"`
}

func (h *FolderHandler) Create(w http.ResponseWriter, r *http.Request) {
	var req createFolderRequest
	if err := httpjson.ParseBody(r, &req); err != nil {
		httpjson.WriteError(w, http.StatusBadRequest, err.Error())
		return
	}

	name := strings.TrimSpace(req.Name)
	if name == "" {
		httpjson.WriteError(w, http.StatusBadRequest, "name is required")
		return
	}

	folder, err := h.folderStore.Create(r.Context(), store.Folder{
		Name:     name,
		ParentID: req.ParentID,
	})
	if err != nil {
		httpjson.WriteError(w, http.StatusInternalServerError, err.Error())
		return
	}

	h.bus.Publish(events.Event{
		Type: events.GalleryChanged,
		Data: map[string]any{"domain": "folders"},
	})

	httpjson.WriteJSON(w, http.StatusCreated, folder)
}

func (h *FolderHandler) Update(w http.ResponseWriter, r *http.Request) {
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

	allowed := map[string]bool{"name": true, "parent_id": true}
	for key := range updates {
		if !allowed[key] {
			httpjson.WriteErrorf(w, http.StatusBadRequest, "field %q is not updatable", key)
			return
		}
	}

	folder, err := h.folderStore.Update(r.Context(), id, updates)
	if err != nil {
		httpjson.WriteError(w, http.StatusNotFound, err.Error())
		return
	}

	h.bus.Publish(events.Event{
		Type: events.GalleryChanged,
		Data: map[string]any{"domain": "folders"},
	})

	httpjson.WriteJSON(w, http.StatusOK, folder)
}

// Delete handles DELETE /folders/{id}.
func (h *FolderHandler) Delete(w http.ResponseWriter, r *http.Request) {
	id, err := httpjson.ParseIntParam(chi.URLParam(r, "id"))
	if err != nil {
		httpjson.WriteError(w, http.StatusBadRequest, err.Error())
		return
	}

	folder, err := h.folderStore.GetByID(r.Context(), id)
	if err != nil {
		httpjson.WriteError(w, http.StatusNotFound, err.Error())
		return
	}

	mode := r.URL.Query().Get("mode")
	if mode == "" {
		mode = "keep_contents"
	}

	ctx := r.Context()

	switch mode {
	case "keep_contents":
		if err := h.reparentContents(ctx, id, folder.ParentID); err != nil {
			httpjson.WriteError(w, http.StatusInternalServerError, err.Error())
			return
		}
	case "delete_all":
		if err := h.deleteAllContents(ctx, id); err != nil {
			httpjson.WriteError(w, http.StatusInternalServerError, err.Error())
			return
		}
	default:
		httpjson.WriteError(w, http.StatusBadRequest, "mode must be keep_contents or delete_all")
		return
	}

	if err := h.folderStore.Delete(ctx, id); err != nil {
		httpjson.WriteError(w, http.StatusInternalServerError, err.Error())
		return
	}

	h.bus.Publish(events.Event{
		Type: events.GalleryChanged,
		Data: map[string]any{"domain": "folders"},
	})

	h.bus.Publish(events.Event{
		Type: events.GalleryChanged,
		Data: map[string]any{"domain": "images"},
	})

	httpjson.WriteJSON(w, http.StatusOK, DeleteFolderResponse{Deleted: true, Mode: mode})
}

func (h *FolderHandler) reparentContents(ctx context.Context, folderID int, newParentID *int) error {
	var parentVal any
	if newParentID != nil {
		parentVal = *newParentID
	} else {
		parentVal = nil
	}

	if err := h.reparentImagesRecursive(ctx, folderID, parentVal); err != nil {
		return err
	}

	return h.deleteSubfoldersRecursive(ctx, folderID)
}

func (h *FolderHandler) reparentImagesRecursive(ctx context.Context, folderID int, targetParent any) error {
	for {
		page, err := h.imageStore.GetAll(ctx, store.ImageQueryOpts{
			FolderID: &folderID,
			Page:     1,
			PerPage:  200,
		})
		if err != nil {
			return err
		}
		if len(page.Data) == 0 {
			break
		}
		for _, img := range page.Data {
			if _, err := h.imageStore.Update(ctx, img.ID, map[string]any{"folder_id": targetParent}); err != nil {
				slog.Warn("reparent image failed", "image_id", img.ID, "error", err)
			}
		}
	}

	subfolders, err := h.folderStore.GetAll(ctx, &folderID)
	if err != nil {
		return err
	}
	for _, sub := range subfolders {
		if err := h.reparentImagesRecursive(ctx, sub.ID, targetParent); err != nil {
			return err
		}
	}

	return nil
}

func (h *FolderHandler) deleteSubfoldersRecursive(ctx context.Context, folderID int) error {
	subfolders, err := h.folderStore.GetAll(ctx, &folderID)
	if err != nil {
		return err
	}
	for _, sub := range subfolders {
		if err := h.deleteSubfoldersRecursive(ctx, sub.ID); err != nil {
			return err
		}
		if err := h.folderStore.Delete(ctx, sub.ID); err != nil {
			slog.Warn("delete subfolder failed", "folder_id", sub.ID, "error", err)
		}
	}
	return nil
}

func (h *FolderHandler) deleteAllContents(ctx context.Context, folderID int) error {
	for {
		allImages, err := h.imageStore.GetAll(ctx, store.ImageQueryOpts{
			FolderID: &folderID,
			Page:     1,
			PerPage:  200,
		})
		if err != nil {
			return err
		}
		if len(allImages.Data) == 0 {
			break
		}
		ids := make([]int, len(allImages.Data))
		for i, img := range allImages.Data {
			ids[i] = img.ID
		}
		if _, err := h.imageStore.Delete(ctx, ids); err != nil {
			return err
		}
	}

	subfolders, err := h.folderStore.GetAll(ctx, &folderID)
	if err != nil {
		return err
	}
	for _, sub := range subfolders {
		if err := h.deleteAllContents(ctx, sub.ID); err != nil {
			return err
		}
		if err := h.folderStore.Delete(ctx, sub.ID); err != nil {
			return err
		}
	}

	return nil
}

type moveImagesRequest struct {
	ImageIDs []int `json:"image_ids"`
	FolderID *int  `json:"folder_id"`
}

func (h *FolderHandler) MoveImages(w http.ResponseWriter, r *http.Request) {
	var req moveImagesRequest
	if err := httpjson.ParseBody(r, &req); err != nil {
		httpjson.WriteError(w, http.StatusBadRequest, err.Error())
		return
	}

	if len(req.ImageIDs) == 0 {
		httpjson.WriteError(w, http.StatusBadRequest, "image_ids is required")
		return
	}

	var folderVal any
	if req.FolderID != nil {
		folderVal = *req.FolderID
	} else {
		folderVal = nil
	}

	for _, imgID := range req.ImageIDs {
		if _, err := h.imageStore.Update(r.Context(), imgID, map[string]any{"folder_id": folderVal}); err != nil {
			slog.Warn("move image failed", "image_id", imgID, "error", err)
		}
	}

	h.bus.Publish(events.Event{
		Type: events.GalleryChanged,
		Data: map[string]any{"domain": "images"},
	})

	httpjson.WriteJSON(w, http.StatusOK, MoveImagesResponse{Moved: len(req.ImageIDs)})
}
