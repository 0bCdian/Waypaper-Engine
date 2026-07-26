package foldershandler

import "waypaper-engine/daemon/internal/store"

type DeleteFolderResponse struct {
	Deleted bool   `json:"deleted"`
	Mode    string `json:"mode"`
}

type MoveImagesResponse struct {
	Moved int `json:"moved"`
}

type FolderListResponse struct {
	Data []store.Folder `json:"data"`
}

type FolderPathResponse struct {
	Data []store.Folder `json:"data"`
}
