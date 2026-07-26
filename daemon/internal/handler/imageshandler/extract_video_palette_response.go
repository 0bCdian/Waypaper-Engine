package imageshandler

// ExtractVideoPaletteResponse is the JSON body for POST /images/{id}/extract-video-palette.
type ExtractVideoPaletteResponse struct {
	Colors  []string `json:"colors"`
	ImageID int      `json:"image_id"`
}
