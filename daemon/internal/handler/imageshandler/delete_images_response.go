package imageshandler

// DeleteImagesResponse is the JSON body for DELETE /images.
type DeleteImagesResponse struct {
	Deleted int `json:"deleted"`
}
