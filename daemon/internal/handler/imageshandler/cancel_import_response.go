package imageshandler

// CancelImportResponse is the JSON body for POST /images/cancel-import.
type CancelImportResponse struct {
	Status  string `json:"status"`
	BatchID string `json:"batch_id"`
}
