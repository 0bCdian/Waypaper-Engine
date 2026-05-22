// Package media defines media type classification for wallpaper files.
package media

// MediaType classifies the kind of media a file represents.
// Used by backend Capabilities to declare which media types a backend supports.
type MediaType string

const (
	MediaTypeImage MediaType = "image"
	MediaTypeVideo MediaType = "video"
	MediaTypeGIF   MediaType = "gif"
	MediaTypeWeb   MediaType = "web"
)
