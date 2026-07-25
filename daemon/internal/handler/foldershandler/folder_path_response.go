package foldershandler

import "waypaper-engine/daemon/internal/store"

// FolderPathResponse is the JSON body for GET /folders/{id}/path.
type FolderPathResponse struct {
	Data []store.Folder `json:"data"`
}
