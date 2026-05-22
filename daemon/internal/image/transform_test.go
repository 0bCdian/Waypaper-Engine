package image

import (
	"image"
	"image/color"
	"testing"
)

// synthImage returns an opaque w x h test image with a simple gradient so
// resampling has non-uniform content to work with.
func synthImage(w, h int) image.Image {
	img := image.NewRGBA(image.Rect(0, 0, w, h))
	for y := 0; y < h; y++ {
		for x := 0; x < w; x++ {
			img.Set(x, y, color.RGBA{R: uint8(x % 256), G: uint8(y % 256), B: 128, A: 255})
		}
	}
	return img
}

func TestNewRGBA_DimensionsAndFill(t *testing.T) {
	img := newRGBA(64, 48, color.NRGBA{R: 32, G: 32, B: 32, A: 255})
	if got := img.Bounds(); got.Dx() != 64 || got.Dy() != 48 {
		t.Fatalf("bounds = %v, want 64x48", got)
	}
	r, g, b, a := img.At(10, 10).RGBA()
	if r>>8 != 32 || g>>8 != 32 || b>>8 != 32 || a>>8 != 255 {
		t.Errorf("pixel = (%d,%d,%d,%d), want (32,32,32,255)", r>>8, g>>8, b>>8, a>>8)
	}
}

func TestResizeImage_PreservesAspectRatio(t *testing.T) {
	src := synthImage(800, 400) // 2:1

	// Width given, height derived.
	got := resizeImage(src, 200, 0)
	if b := got.Bounds(); b.Dx() != 200 || b.Dy() != 100 {
		t.Errorf("resize w=200: got %dx%d, want 200x100", b.Dx(), b.Dy())
	}

	// Height given, width derived.
	got = resizeImage(src, 0, 100)
	if b := got.Bounds(); b.Dx() != 200 || b.Dy() != 100 {
		t.Errorf("resize h=100: got %dx%d, want 200x100", b.Dx(), b.Dy())
	}
}

func TestFitImage_NeverUpscalesWithBothBounds(t *testing.T) {
	src := synthImage(400, 300)

	// Larger bounds than the source: must not upscale.
	got := fitImage(src, 4000, 3000)
	if b := got.Bounds(); b.Dx() != 400 || b.Dy() != 300 {
		t.Errorf("fit larger bounds: got %dx%d, want unchanged 400x300", b.Dx(), b.Dy())
	}

	// Smaller bounds: scales down preserving aspect, constrained by width.
	got = fitImage(src, 200, 600)
	if b := got.Bounds(); b.Dx() != 200 || b.Dy() != 150 {
		t.Errorf("fit smaller bounds: got %dx%d, want 200x150", b.Dx(), b.Dy())
	}
}

func TestFitImage_ZeroHeightUsesWidthOnly(t *testing.T) {
	src := synthImage(400, 200)
	got := fitImage(src, 100, 0)
	if b := got.Bounds(); b.Dx() != 100 || b.Dy() != 50 {
		t.Errorf("fit maxHeight=0: got %dx%d, want 100x50", b.Dx(), b.Dy())
	}
}

func TestFillImage_CoversExactTargetSize(t *testing.T) {
	src := synthImage(400, 400) // square source

	// Wide target: source is scaled to cover, then center-cropped.
	got := fillImage(src, 600, 200)
	if b := got.Bounds(); b.Dx() != 600 || b.Dy() != 200 {
		t.Errorf("fill 600x200: got %dx%d, want exact 600x200", b.Dx(), b.Dy())
	}

	// Tall target larger than source: upscales to cover.
	got = fillImage(src, 100, 800)
	if b := got.Bounds(); b.Dx() != 100 || b.Dy() != 800 {
		t.Errorf("fill 100x800: got %dx%d, want exact 100x800", b.Dx(), b.Dy())
	}
}

func TestCropImage_ExtractsRegionAtZeroOrigin(t *testing.T) {
	src := synthImage(100, 100)
	got := cropImage(src, image.Rect(20, 30, 70, 90))
	b := got.Bounds()
	if b.Min.X != 0 || b.Min.Y != 0 {
		t.Errorf("crop origin = %v, want (0,0)", b.Min)
	}
	if b.Dx() != 50 || b.Dy() != 60 {
		t.Errorf("crop size = %dx%d, want 50x60", b.Dx(), b.Dy())
	}
	// Pixel (0,0) of the crop should equal src pixel (20,30).
	wantR, wantG, wantB, wantA := src.At(20, 30).RGBA()
	gotR, gotG, gotB, gotA := got.At(0, 0).RGBA()
	if gotR != wantR || gotG != wantG || gotB != wantB || gotA != wantA {
		t.Errorf("crop pixel (0,0) = (%d,%d,%d,%d), want (%d,%d,%d,%d)",
			gotR, gotG, gotB, gotA, wantR, wantG, wantB, wantA)
	}
}

func TestCropImage_ClampsRectToBounds(t *testing.T) {
	src := synthImage(100, 100)
	// Rect partially outside the source; result is clamped to the overlap.
	got := cropImage(src, image.Rect(80, 80, 200, 200))
	if b := got.Bounds(); b.Dx() != 20 || b.Dy() != 20 {
		t.Errorf("clamped crop = %dx%d, want 20x20", b.Dx(), b.Dy())
	}
}
