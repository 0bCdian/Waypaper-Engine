package backendshandler

type ActivateBackendResponse struct {
	Status  string `json:"status"`
	Backend string `json:"backend"`
}
