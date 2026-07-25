package foldershandler

// MoveImagesResponse is the JSON body for POST /folders/move-images.
type MoveImagesResponse struct {
	Moved int `json:"moved"`
}
