package backendshandler

// ActivateBackendResponse is the JSON body for POST /backends/{name}/activate.
type ActivateBackendResponse struct {
	Status  string `json:"status"`
	Backend string `json:"backend"`
}
