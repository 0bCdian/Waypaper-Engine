# golang.org/x/image

The golang.org/x/image module provides extended image processing capabilities for Go, including additional image format support (BMP, TIFF, WebP), comprehensive font rendering and typography, advanced image composition with high-quality scaling, 2D vector graphics rasterization, and mathematical utilities for graphics programming. It fills gaps in Go's standard library while maintaining compatibility with standard image interfaces.

## Package Information

- **Package Name**: golang.org/x/image
- **Package Type**: Go module
- **Language**: Go
- **Version**: v0.33.0
- **Installation**: `go get golang.org/x/image@v0.33.0`
- **Import Path**: `golang.org/x/image/<subpackage>`

## Core Imports

```go { .api }
import (
    // Image format support
    "golang.org/x/image/bmp"
    "golang.org/x/image/tiff"
    "golang.org/x/image/webp"

    // Font rendering
    "golang.org/x/image/font"
    "golang.org/x/image/font/opentype"

    // Advanced drawing
    "golang.org/x/image/draw"

    // Vector graphics
    "golang.org/x/image/vector"

    // Math utilities
    "golang.org/x/image/math/fixed"
)
```

## Basic Usage

### Decoding an Image Format

```go
import (
    "image"
    "os"
    "golang.org/x/image/webp"
)

func decodeWebP(filename string) (image.Image, error) {
    f, err := os.Open(filename)
    if err != nil {
        return nil, err
    }
    defer f.Close()

    return webp.Decode(f)
}
```

### Rendering Text

```go
import (
    "image"
    "image/draw"
    "image/color"
    "golang.org/x/image/font"
    "golang.org/x/image/font/basicfont"
    "golang.org/x/image/math/fixed"
)

func drawText(dst draw.Image, text string, x, y int) {
    d := &font.Drawer{
        Dst:  dst,
        Src:  image.NewUniform(color.Black),
        Face: basicfont.Face7x13,
        Dot:  fixed.P(x, y),
    }
    d.DrawString(text)
}
```

### Scaling an Image

```go
import (
    "image"
    "golang.org/x/image/draw"
)

func scaleImage(src image.Image, width, height int) *image.RGBA {
    dst := image.NewRGBA(image.Rect(0, 0, width, height))
    draw.CatmullRom.Scale(dst, dst.Bounds(), src, src.Bounds(), draw.Over, nil)
    return dst
}
```

## Architecture

The module is organized into six major functional areas:

1. **Image Formats** - Decoders and encoders for BMP, TIFF, and WebP formats, with supporting codecs (VP8, VP8L, CCITT)
2. **Font System** - Core font interfaces, text rendering, and font face implementations
3. **Font Implementations** - Support for multiple font formats (OpenType, TrueType, Plan 9, bitmap) and embedded font families
4. **Drawing and Composition** - Extended drawing operations with high-quality scaling algorithms
5. **Vector Graphics** - 2D path rasterization with anti-aliasing support
6. **Math Utilities** - Fixed-point arithmetic and floating-point vector/matrix operations for graphics programming

## Capabilities

### Image Format Support

Read and write additional image formats beyond the standard library, including BMP (Windows Bitmap), TIFF with multiple compression options, and WebP (lossy and lossless).

```go { .api }
// BMP decoder/encoder
func bmp.Decode(r io.Reader) (image.Image, error)
func bmp.Encode(w io.Writer, m image.Image) error

// TIFF decoder/encoder with options
func tiff.Decode(r io.Reader) (image.Image, error)
func tiff.Encode(w io.Writer, m image.Image, opt *tiff.Options) error

// WebP decoder (supports lossy, lossless, and alpha)
func webp.Decode(r io.Reader) (image.Image, error)
```

**TIFF Options**:
```go { .api }
type tiff.Options struct {
    Compression tiff.CompressionType // Uncompressed, Deflate, LZW, CCITTGroup3, CCITTGroup4
    Predictor   bool                 // Use differencing predictor
}

type tiff.CompressionType int

const (
    tiff.Uncompressed  tiff.CompressionType = 0
    tiff.Deflate       tiff.CompressionType = 1
    tiff.LZW           tiff.CompressionType = 2
    tiff.CCITTGroup3   tiff.CompressionType = 3
    tiff.CCITTGroup4   tiff.CompressionType = 4
)
```

[Image Formats](./image-formats.md)

### Font Rendering and Typography

Render text with support for multiple font formats including TrueType, OpenType, Plan 9 bitmap fonts, and embedded font families. The font system provides precise glyph positioning, kerning, and font metrics.

```go { .api }
// Core font interface
type font.Face interface {
    Close() error
    Glyph(dot fixed.Point26_6, r rune) (dr image.Rectangle, mask image.Image, maskp image.Point, advance fixed.Int26_6, ok bool)
    GlyphBounds(r rune) (bounds fixed.Rectangle26_6, advance fixed.Int26_6, ok bool)
    GlyphAdvance(r rune) (advance fixed.Int26_6, ok bool)
    Kern(r0, r1 rune) fixed.Int26_6
    Metrics() font.Metrics
}

// High-level text rendering
type font.Drawer struct {
    Dst  draw.Image       // Destination image
    Src  image.Image      // Source color/pattern
    Face font.Face        // Font face
    Dot  fixed.Point26_6  // Current position
}

func (d *font.Drawer) DrawString(s string)
func (d *font.Drawer) MeasureString(s string) fixed.Int26_6

// Parse OpenType/TrueType fonts
func opentype.Parse(src []byte) (*opentype.Font, error)
func opentype.NewFace(f *opentype.Font, opts *opentype.FaceOptions) (font.Face, error)
```

**Font Options**:
```go { .api }
type opentype.FaceOptions struct {
    Size    float64       // Font size in points
    DPI     float64       // Dots per inch (default: 72)
    Hinting font.Hinting  // HintingNone, HintingVertical, HintingFull
}
```

[Font System](./font-system.md)

[Font Implementations](./font-implementations.md)

### Advanced Image Composition

Perform high-quality image scaling and transformation using various interpolation algorithms, including nearest neighbor, bilinear, and Catmull-Rom bicubic interpolation.

```go { .api }
// Interpolator interface for scaling and transformation
type draw.Interpolator interface {
    Scale(dst draw.Image, dr image.Rectangle, src image.Image, sr image.Rectangle, op draw.Op, opts *draw.Options)
    Transform(dst draw.Image, m f64.Aff3, src image.Image, sr image.Rectangle, op draw.Op, opts *draw.Options)
}

// Available interpolators (fastest to highest quality)
var draw.NearestNeighbor draw.Interpolator  // Fastest, lowest quality
var draw.ApproxBiLinear draw.Interpolator   // Fast approximation
var draw.BiLinear draw.Interpolator         // Good balance
var draw.CatmullRom draw.Interpolator       // Highest quality, slower

// Drawing options for masking
type draw.Options struct {
    SrcMask  image.Image  // Source mask
    SrcMaskP image.Point  // Source mask offset
    DstMask  image.Image  // Destination mask
    DstMaskP image.Point  // Destination mask offset
}
```

[Drawing and Composition](./drawing.md)

### Vector Graphics Rasterization

Rasterize 2D vector paths with anti-aliasing, supporting lines, quadratic Bézier curves, and cubic Bézier curves.

```go { .api }
// 2D vector graphics rasterizer
type vector.Rasterizer struct {
    DrawOp draw.Op  // Drawing operation (Over or Src)
}

func vector.NewRasterizer(w, h int) *vector.Rasterizer

// Path drawing methods
func (z *vector.Rasterizer) MoveTo(ax, ay float32)
func (z *vector.Rasterizer) LineTo(bx, by float32)
func (z *vector.Rasterizer) QuadTo(bx, by, cx, cy float32)
func (z *vector.Rasterizer) CubeTo(bx, by, cx, cy, dx, dy float32)
func (z *vector.Rasterizer) ClosePath()

// Render to image
func (z *vector.Rasterizer) Draw(dst draw.Image, r image.Rectangle, src image.Image, sp image.Point)
```

[Vector Graphics](./vector-graphics.md)

### Fixed-Point and Floating-Point Math

Perform precise positioning and layout calculations using fixed-point arithmetic, and handle 3D graphics transformations with floating-point vector and matrix operations.

```go { .api }
// Fixed-point types (26.6 format: 26 integer bits, 6 fractional bits)
type fixed.Int26_6 int32
type fixed.Point26_6 struct { X, Y fixed.Int26_6 }
type fixed.Rectangle26_6 struct { Min, Max fixed.Point26_6 }

// Conversion functions
func fixed.I(i int) fixed.Int26_6
func fixed.P(x, y int) fixed.Point26_6
func fixed.R(x0, y0, x1, y1 int) fixed.Rectangle26_6

// Floating-point vectors and matrices (f32 and f64 variants)
type f32.Vec2 [2]float32
type f32.Vec3 [3]float32
type f32.Vec4 [4]float32
type f32.Mat3 [9]float32   // 3x3 matrix (row-major)
type f32.Mat4 [16]float32  // 4x4 matrix (row-major)
type f32.Aff3 [6]float32   // 3x3 affine (bottom row implicit [0 0 1])
type f32.Aff4 [12]float32  // 4x4 affine (bottom row implicit [0 0 0 1])
```

[Math Utilities](./math-utilities.md)

### Color and Format Utilities

Access named colors from the SVG 1.1 specification, parse RIFF file containers, and handle CCITT fax compression.

```go { .api }
// Named colors from SVG 1.1 (147 colors)
var colornames.Map map[string]color.RGBA

// RIFF file format parsing (used by WebP, AVI, WAVE)
func riff.NewReader(r io.Reader) (formType riff.FourCC, data *riff.Reader, err error)

// CCITT fax compression decoder
func ccitt.NewReader(r io.Reader, order ccitt.Order, sf ccitt.SubFormat, width int, height int, opts *ccitt.Options) io.Reader
```

[Utilities](./utilities.md)

## Common Patterns

### Image Registration

To automatically support decoding formats when using `image.Decode()`, import packages with side effects:

```go
import (
    "image"
    _ "golang.org/x/image/bmp"
    _ "golang.org/x/image/tiff"
    _ "golang.org/x/image/webp"
)

// Now image.Decode() automatically supports BMP, TIFF, and WebP
img, format, err := image.Decode(reader)
```

### Fixed-Point Arithmetic

Use fixed-point types for sub-pixel positioning and layout:

```go
import "golang.org/x/image/math/fixed"

// Convert integer to fixed-point
x := fixed.I(10)  // 10.0 in 26.6 format

// Create point from integers
p := fixed.P(100, 200)  // Point at (100.0, 200.0)

// Fixed-point arithmetic
x = x.Mul(fixed.I(2))  // x *= 2

// Convert back to integer
intValue := x.Round()  // Round to nearest integer
```

### High-Quality Image Scaling

```go
import (
    "image"
    "golang.org/x/image/draw"
)

// Scale image with Catmull-Rom interpolation (high quality)
dst := image.NewRGBA(dstBounds)
draw.CatmullRom.Scale(dst, dst.Bounds(), src, src.Bounds(), draw.Over, nil)
```

## Error Handling

Functions follow Go conventions, returning errors for invalid input or unsupported features:

```go
img, err := webp.Decode(reader)
if err != nil {
    // Handle decode error
}

face, err := opentype.NewFace(font, &opentype.FaceOptions{Size: 12})
if err != nil {
    // Handle font face creation error
}
```

Some packages define specific error types:

```go { .api }
// TIFF-specific errors
type tiff.FormatError string      // Invalid format
type tiff.UnsupportedError string // Unsupported feature
```
