package image

import (
	"fmt"
	"image"
	"image/color"
	_ "image/gif"  // register GIF decoder for openImage
	_ "image/jpeg" // register JPEG decoder for openImage
	_ "image/png"  // register PNG decoder for openImage
	"math"
	"os"

	"golang.org/x/image/draw"
	_ "golang.org/x/image/webp" // register WebP decoder for openImage
)

// scaleKernel is the interpolator used for all resampling. CatmullRom is the
// highest-quality kernel x/image/draw offers and is the closest available
// substitute for the Lanczos filter previously used via disintegration/imaging.
var scaleKernel = draw.CatmullRom

// openImage decodes an image file into memory.
//
// Unlike the previous imaging.Open, EXIF orientation metadata is not applied;
// this matches how the rest of this package decodes images (see palette.go).
func openImage(path string) (image.Image, error) {
	f, err := os.Open(path)
	if err != nil {
		return nil, err
	}
	defer func() { _ = f.Close() }()

	img, _, err := image.Decode(f)
	if err != nil {
		return nil, fmt.Errorf("decode %s: %w", path, err)
	}
	return img, nil
}

// newRGBA returns a new opaque w x h image filled with the given color.
func newRGBA(w, h int, c color.Color) *image.RGBA {
	dst := image.NewRGBA(image.Rect(0, 0, w, h))
	draw.Draw(dst, dst.Bounds(), image.NewUniform(c), image.Point{}, draw.Src)
	return dst
}

// scaleTo resamples src into a new image of exactly w x h pixels.
func scaleTo(src image.Image, w, h int) *image.RGBA {
	dst := image.NewRGBA(image.Rect(0, 0, w, h))
	scaleKernel.Scale(dst, dst.Bounds(), src, src.Bounds(), draw.Over, nil)
	return dst
}

// resizeImage resizes src to w x h. If either dimension is <= 0 it is derived
// from the other to preserve the source aspect ratio. Upscaling is permitted.
func resizeImage(src image.Image, w, h int) image.Image {
	b := src.Bounds()
	sw, sh := b.Dx(), b.Dy()
	if sw == 0 || sh == 0 {
		return src
	}
	if w <= 0 && h <= 0 {
		return src
	}
	if w <= 0 {
		w = int(math.Round(float64(sw) * float64(h) / float64(sh)))
	}
	if h <= 0 {
		h = int(math.Round(float64(sh) * float64(w) / float64(sw)))
	}
	if w < 1 {
		w = 1
	}
	if h < 1 {
		h = 1
	}
	return scaleTo(src, w, h)
}

// fitImage scales src down to fit within maxWidth x maxHeight while preserving
// the aspect ratio. If maxHeight is 0 only maxWidth constrains the result (and
// the image may be scaled up, matching the previous imaging.Resize behaviour).
// Otherwise the image is never upscaled (matching imaging.Fit).
func fitImage(src image.Image, maxWidth, maxHeight int) image.Image {
	if maxHeight == 0 {
		return resizeImage(src, maxWidth, 0)
	}
	b := src.Bounds()
	sw, sh := b.Dx(), b.Dy()
	if sw == 0 || sh == 0 {
		return src
	}
	scale := math.Min(float64(maxWidth)/float64(sw), float64(maxHeight)/float64(sh))
	if scale >= 1.0 {
		return src // already fits; do not upscale
	}
	w := int(math.Round(float64(sw) * scale))
	h := int(math.Round(float64(sh) * scale))
	if w < 1 {
		w = 1
	}
	if h < 1 {
		h = 1
	}
	return scaleTo(src, w, h)
}

// fillImage scales src to cover w x h (preserving aspect ratio, upscaling if
// needed) and then center-crops the excess. Equivalent to imaging.Fill with the
// Center anchor.
func fillImage(src image.Image, w, h int) image.Image {
	b := src.Bounds()
	sw, sh := b.Dx(), b.Dy()
	if sw == 0 || sh == 0 || w <= 0 || h <= 0 {
		return src
	}
	scale := math.Max(float64(w)/float64(sw), float64(h)/float64(sh))
	scaledW := int(math.Round(float64(sw) * scale))
	scaledH := int(math.Round(float64(sh) * scale))
	if scaledW < w {
		scaledW = w
	}
	if scaledH < h {
		scaledH = h
	}
	scaled := scaleTo(src, scaledW, scaledH)

	offX := (scaledW - w) / 2
	offY := (scaledH - h) / 2
	return cropImage(scaled, image.Rect(offX, offY, offX+w, offY+h))
}

// cropImage extracts rectangle r from src and returns it as a new image whose
// bounds start at (0,0). r is interpreted in src's coordinate space.
func cropImage(src image.Image, r image.Rectangle) image.Image {
	r = r.Intersect(src.Bounds())
	dst := image.NewRGBA(image.Rect(0, 0, r.Dx(), r.Dy()))
	draw.Draw(dst, dst.Bounds(), src, r.Min, draw.Src)
	return dst
}
