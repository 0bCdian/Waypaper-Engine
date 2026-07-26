package playlistshandler

// StopAllResponse is the JSON body for POST /playlists/active/stop.
type StopAllResponse struct {
	Message string `json:"message"`
	Stopped int    `json:"stopped"`
}
