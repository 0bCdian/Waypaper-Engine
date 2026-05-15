package backend

import "encoding/json"

// Content is a sealed interface representing what is displayed on one monitor output.
// Only the four variants defined in this package implement Content.
type Content interface {
	isContent()
	Path() string
}

// StaticImage is a static raster image (jpg, png, etc.).
type StaticImage struct{ Path_ string }

func (StaticImage) isContent()     {}
func (s StaticImage) Path() string { return s.Path_ }

// GIF is an animated GIF file.
type GIF struct{ Path_ string }

func (GIF) isContent()     {}
func (g GIF) Path() string { return g.Path_ }

// Video is a video file.
type Video struct {
	Path_        string
	AudioEnabled bool
}

func (Video) isContent()     {}
func (v Video) Path() string { return v.Path_ }

// WebWallpaper is an HTML/web wallpaper package.
type WebWallpaper struct {
	ManifestPath      string
	PackageRoot       string
	Config            json.RawMessage // merged manifest defaults and user overrides
	ParallaxDirection string          // empty means no override
}

func (WebWallpaper) isContent()     {}
func (w WebWallpaper) Path() string { return w.ManifestPath }
