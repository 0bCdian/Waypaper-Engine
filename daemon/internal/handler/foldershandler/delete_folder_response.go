package foldershandler

// DeleteFolderResponse is the JSON body for DELETE /folders/{id}.
type DeleteFolderResponse struct {
	Deleted bool   `json:"deleted"`
	Mode    string `json:"mode"`
}
