package healthhandler

// CapabilitiesResponse is the JSON body for GET /capabilities.
type CapabilitiesResponse struct {
	FfmpegAvailable bool `json:"ffmpeg_available"`
}
