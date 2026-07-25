package playlistshandler

// PreviousAllResponse is the JSON body for POST /playlists/active/previous.
type PreviousAllResponse struct {
	Message  string `json:"message"`
	Reversed int    `json:"reversed"`
}
