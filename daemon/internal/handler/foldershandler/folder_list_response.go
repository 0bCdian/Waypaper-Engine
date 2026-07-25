package foldershandler

import "waypaper-engine/daemon/internal/store"

// FolderListResponse is the JSON body for GET /folders.
type FolderListResponse struct {
	Data []store.Folder `json:"data"`
}
