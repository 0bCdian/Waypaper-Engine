package backend

import (
	"waypaper-engine/daemon/internal/media"
	"waypaper-engine/daemon/internal/monitor"
)

// Snapshot is the complete wallpaper state to apply across all outputs.
type Snapshot struct {
	Outputs []Output
}

// Output pairs one monitor with the content to display on it.
type Output struct {
	Monitor monitor.Monitor
	Content Content
}

// ContentKind identifies the variant of Content a backend can handle.
type ContentKind string

const (
	KindStaticImage  ContentKind = "static_image"
	KindGIF          ContentKind = "gif"
	KindVideo        ContentKind = "video"
	KindWebWallpaper ContentKind = "web_wallpaper"
)

// Mode describes how a single source image is mapped to one or more monitors.
// Used by the storage layer — not present in Snapshot or on the wire.
type Mode string

const (
	ModeClone  Mode = "clone"  // same image on N≥1 monitors
	ModeExtend Mode = "extend" // image split across N≥2 monitors
)

// ContentToMediaType maps a Content variant to the legacy media.MediaType value.
func ContentToMediaType(c Content) media.MediaType {
	switch c.(type) {
	case GIF:
		return media.MediaTypeGIF
	case Video:
		return media.MediaTypeVideo
	case WebWallpaper:
		return media.MediaTypeWeb
	default:
		return media.MediaTypeImage
	}
}
