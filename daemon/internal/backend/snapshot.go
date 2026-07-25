package backend

import (
	"waypaper-engine/daemon/internal/monitor"
)

type Snapshot struct {
	Outputs []Output
}

type Output struct {
	Monitor monitor.Monitor
	Content Content
}

type ContentKind string

const (
	KindStaticImage  ContentKind = "static_image"
	KindGIF          ContentKind = "gif"
	KindVideo        ContentKind = "video"
	KindWebWallpaper ContentKind = "web_wallpaper"
)

type Mode string

const (
	ModeClone  Mode = "clone"  // same image on N≥1 monitors
	ModeExtend Mode = "extend" // image split across N≥2 monitors
)
