package healthhandler

// InfoResponse is the JSON body for GET /info.
type InfoResponse struct {
	Version   string `json:"version"`
	PID       int    `json:"pid"`
	Hostname  string `json:"hostname"`
	Uptime    string `json:"uptime"`
	GoVersion string `json:"go_version"`
	OS        string `json:"os"`
	Arch      string `json:"arch"`
}
