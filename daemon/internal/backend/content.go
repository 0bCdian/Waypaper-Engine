package backend

import "encoding/json"

type Content interface {
	isContent()
	Path() string
}

type StaticImage struct{ Path_ string }

func (StaticImage) isContent()     {}
func (s StaticImage) Path() string { return s.Path_ }

type GIF struct{ Path_ string }

func (GIF) isContent()     {}
func (g GIF) Path() string { return g.Path_ }

type Video struct {
	Path_        string
	AudioEnabled bool
}

func (Video) isContent()     {}
func (v Video) Path() string { return v.Path_ }

type WebWallpaper struct {
	ManifestPath      string
	PackageRoot       string
	Config            json.RawMessage
	ParallaxDirection string
}

func (WebWallpaper) isContent()     {}
func (w WebWallpaper) Path() string { return w.ManifestPath }
