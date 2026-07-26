package imageshandler

// AddImagesResponse is the JSON body for POST /images.
type AddImagesResponse struct {
	Status  string `json:"status"`
	Total   int    `json:"total"`
	BatchID string `json:"batch_id"`
}
