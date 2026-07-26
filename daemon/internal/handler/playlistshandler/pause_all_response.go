package playlistshandler

// PauseAllResponse is the JSON body for POST /playlists/active/pause.
type PauseAllResponse struct {
	Message string `json:"message"`
	Paused  int    `json:"paused"`
}
