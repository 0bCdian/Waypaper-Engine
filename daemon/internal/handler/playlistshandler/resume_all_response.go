package playlistshandler

// ResumeAllResponse is the JSON body for POST /playlists/active/resume.
type ResumeAllResponse struct {
	Message string `json:"message"`
	Resumed int    `json:"resumed"`
}
