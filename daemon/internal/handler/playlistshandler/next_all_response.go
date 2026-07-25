package playlistshandler

// NextAllResponse is the JSON body for POST /playlists/active/next.
type NextAllResponse struct {
	Message  string `json:"message"`
	Advanced int    `json:"advanced"`
}
