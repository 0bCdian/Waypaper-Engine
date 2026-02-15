# Drawing and Composition

The `draw` package extends Go's standard `image/draw` package with high-quality image scaling, transformation, and composition operations. It provides multiple interpolation algorithms ranging from fast nearest-neighbor to high-quality bicubic interpolation.

## Import

```go { .api }
import "golang.org/x/image/draw"
```

## Re-exported Standard Library Types

The package re-exports key types from `image/draw` for convenience:

```go { .api }
// Drawer interface from stdlib
type Drawer = draw.Drawer

// Image interface combining image.Image and draw.Image
type Image = draw.Image

// RGBA64Image interface for 16-bit color images
type RGBA64Image = draw.RGBA64Image

// Op defines Porter-Duff composition operators
type Op = draw.Op

const (
    Over Op = draw.Over  // Alpha blending (default)
    Src  Op = draw.Src   // Source replaces destination
)

// Quantizer interface for color quantization
type Quantizer = draw.Quantizer
```

## Interpolation Algorithms

The package provides several interpolation algorithms as implementations of the `Interpolator` interface.

### Interpolator Interface

```go { .api }
// Interpolator defines an interpolation algorithm for scaling and transformation
type Interpolator interface {
    // Scale scales src to fit dst rectangle
    Scale(dst Image, dr image.Rectangle, src image.Image, sr image.Rectangle, op Op, opts *Options)

    // Transform applies affine transformation m to src
    Transform(dst Image, m f64.Aff3, src image.Image, sr image.Rectangle, op Op, opts *Options)
}

// Scaler interface for scaling-only operations
type Scaler interface {
    Scale(dst Image, dr image.Rectangle, src image.Image, sr image.Rectangle, op Op, opts *Options)
}

// Transformer interface for transformation-only operations
type Transformer interface {
    Transform(dst Image, m f64.Aff3, src image.Image, sr image.Rectangle, op Op, opts *Options)
}
```

### Available Interpolators

```go { .api }
// NearestNeighbor is the fastest interpolator with lowest quality
// Best for pixel art or when speed is critical
var NearestNeighbor Interpolator

// ApproxBiLinear is a fast approximation of bilinear interpolation
// Good balance of speed and quality for most use cases
var ApproxBiLinear Interpolator

// BiLinear provides standard bilinear interpolation
// Higher quality than ApproxBiLinear with moderate performance
var BiLinear Interpolator

// CatmullRom provides high-quality bicubic interpolation
// Highest quality with slower performance
// Best for photo scaling and high-quality graphics
var CatmullRom Interpolator
```

### Interpolator Comparison

| Interpolator | Quality | Speed | Use Case |
|--------------|---------|-------|----------|
| NearestNeighbor | Lowest | Fastest | Pixel art, thumbnails, real-time scaling |
| ApproxBiLinear | Good | Fast | General purpose, UI scaling |
| BiLinear | Better | Moderate | Photo thumbnails, smooth scaling |
| CatmullRom | Best | Slowest | High-quality photo processing, print |

## Image Scaling

### Basic Scaling

```go { .api }
// Scale using any interpolator
func (q Interpolator) Scale(dst Image, dr image.Rectangle, src image.Image, sr image.Rectangle, op Op, opts *Options)
```

**Parameters**:
- `dst`: Destination image
- `dr`: Destination rectangle to fill
- `src`: Source image
- `sr`: Source rectangle to read from
- `op`: Porter-Duff composition operator (Over or Src)
- `opts`: Optional masking options (can be nil)

### Scaling Examples

```go
import (
    "image"
    "golang.org/x/image/draw"
)

// Scale image to specific dimensions
func scaleImage(src image.Image, width, height int) *image.RGBA {
    dst := image.NewRGBA(image.Rect(0, 0, width, height))
    draw.CatmullRom.Scale(dst, dst.Bounds(), src, src.Bounds(), draw.Over, nil)
    return dst
}

// Scale to fit within maximum dimensions while preserving aspect ratio
func scaleToFit(src image.Image, maxWidth, maxHeight int) *image.RGBA {
    srcBounds := src.Bounds()
    srcW := srcBounds.Dx()
    srcH := srcBounds.Dy()

    // Calculate scale factor
    scaleX := float64(maxWidth) / float64(srcW)
    scaleY := float64(maxHeight) / float64(srcH)
    scale := scaleX
    if scaleY < scaleX {
        scale = scaleY
    }

    // Calculate new dimensions
    dstW := int(float64(srcW) * scale)
    dstH := int(float64(srcH) * scale)

    dst := image.NewRGBA(image.Rect(0, 0, dstW, dstH))
    draw.BiLinear.Scale(dst, dst.Bounds(), src, src.Bounds(), draw.Over, nil)
    return dst
}

// Create thumbnail (fast, lower quality)
func createThumbnail(src image.Image, size int) *image.RGBA {
    dst := image.NewRGBA(image.Rect(0, 0, size, size))
    draw.ApproxBiLinear.Scale(dst, dst.Bounds(), src, src.Bounds(), draw.Over, nil)
    return dst
}

// Scale portion of image
func scaleCrop(src image.Image, srcCrop image.Rectangle, width, height int) *image.RGBA {
    dst := image.NewRGBA(image.Rect(0, 0, width, height))
    draw.CatmullRom.Scale(dst, dst.Bounds(), src, srcCrop, draw.Over, nil)
    return dst
}
```

## Image Transformation

Apply affine transformations (rotation, scaling, shearing, translation) using 3x3 transformation matrices.

### Transformation Interface

```go { .api }
// Transform applies affine transformation matrix m to source image
func (q Interpolator) Transform(dst Image, m f64.Aff3, src image.Image, sr image.Rectangle, op Op, opts *Options)
```

**Parameters**:
- `dst`: Destination image
- `m`: 3x3 affine transformation matrix (from math/f64 package)
- `src`: Source image
- `sr`: Source rectangle to transform
- `op`: Porter-Duff composition operator
- `opts`: Optional masking options

### Transformation Examples

```go
import (
    "image"
    "math"
    "golang.org/x/image/draw"
    "golang.org/x/image/math/f64"
)

// Rotate image around center
func rotateImage(src image.Image, angleDegrees float64) *image.RGBA {
    srcBounds := src.Bounds()
    srcW := float64(srcBounds.Dx())
    srcH := float64(srcBounds.Dy())

    // Create destination image (same size)
    dst := image.NewRGBA(srcBounds)

    // Calculate center point
    centerX := srcW / 2
    centerY := srcH / 2

    // Create rotation matrix
    angleRad := angleDegrees * math.Pi / 180.0
    cosA := math.Cos(angleRad)
    sinA := math.Sin(angleRad)

    // Transformation matrix: translate to origin, rotate, translate back
    m := f64.Aff3{
        cosA, -sinA, centerX - cosA*centerX + sinA*centerY,
        sinA, cosA, centerY - sinA*centerX - cosA*centerY,
    }

    draw.BiLinear.Transform(dst, m, src, src.Bounds(), draw.Src, nil)
    return dst
}

// Scale with transformation matrix
func scaleTransform(src image.Image, scaleX, scaleY float64) *image.RGBA {
    srcBounds := src.Bounds()
    dstW := int(float64(srcBounds.Dx()) * scaleX)
    dstH := int(float64(srcBounds.Dy()) * scaleY)

    dst := image.NewRGBA(image.Rect(0, 0, dstW, dstH))

    // Scaling matrix
    m := f64.Aff3{
        scaleX, 0, 0,
        0, scaleY, 0,
    }

    draw.BiLinear.Transform(dst, m, src, src.Bounds(), draw.Src, nil)
    return dst
}

// Shear image
func shearImage(src image.Image, shearX, shearY float64) *image.RGBA {
    srcBounds := src.Bounds()
    dst := image.NewRGBA(srcBounds)

    // Shearing matrix
    m := f64.Aff3{
        1, shearX, 0,
        shearY, 1, 0,
    }

    draw.BiLinear.Transform(dst, m, src, src.Bounds(), draw.Src, nil)
    return dst
}
```

## Drawing with Masks

Use masks to control which parts of the image are affected by drawing operations.

### Options

```go { .api }
// Options specifies optional parameters for drawing operations
type Options struct {
    SrcMask  image.Image  // Source mask (alpha channel controls source contribution)
    SrcMaskP image.Point  // Source mask offset point
    DstMask  image.Image  // Destination mask (alpha channel controls destination contribution)
    DstMaskP image.Point  // Destination mask offset point
}
```

### Masking Examples

```go
import (
    "image"
    "image/color"
    "golang.org/x/image/draw"
)

// Create circular mask
func createCircleMask(radius int) *image.Alpha {
    size := radius * 2
    mask := image.NewAlpha(image.Rect(0, 0, size, size))

    centerX, centerY := radius, radius
    radiusSq := radius * radius

    for y := 0; y < size; y++ {
        for x := 0; x < size; x++ {
            dx := x - centerX
            dy := y - centerY
            distSq := dx*dx + dy*dy

            if distSq <= radiusSq {
                mask.SetAlpha(x, y, color.Alpha{255})
            }
        }
    }

    return mask
}

// Scale with circular mask
func scaleWithMask(src image.Image, width, height int) *image.RGBA {
    dst := image.NewRGBA(image.Rect(0, 0, width, height))

    // Create circular mask
    mask := createCircleMask(width / 2)

    opts := &draw.Options{
        DstMask:  mask,
        DstMaskP: image.Point{},
    }

    draw.CatmullRom.Scale(dst, dst.Bounds(), src, src.Bounds(), draw.Over, opts)
    return dst
}

// Blend two images with mask
func blendWithMask(dst, src, mask image.Image) *image.RGBA {
    result := image.NewRGBA(dst.Bounds())

    // Copy destination
    draw.Draw(result, result.Bounds(), dst, image.Point{}, draw.Src)

    // Blend source with mask
    opts := &draw.Options{
        SrcMask:  mask,
        SrcMaskP: image.Point{},
    }

    draw.BiLinear.Scale(result, result.Bounds(), src, src.Bounds(), draw.Over, opts)
    return result
}
```

## Extended Drawing Functions

The package also provides extended versions of standard drawing functions.

### Basic Drawing

```go { .api }
// Draw composites src onto dst using Porter-Duff composition
func Draw(dst Image, r image.Rectangle, src image.Image, sp image.Point, op Op)

// DrawMask composites src onto dst using mask and Porter-Duff composition
func DrawMask(dst Image, r image.Rectangle, src image.Image, sp image.Point, mask image.Image, mp image.Point, op Op)

// Copy copies a source image to a destination image
func Copy(dst Image, dp image.Point, src image.Image, sr image.Rectangle, op Op, opts *Options)
```

### Drawing Examples

```go
import (
    "image"
    "golang.org/x/image/draw"
)

// Copy region from one image to another
func copyRegion(dst, src image.Image, srcRect image.Rectangle, dstPoint image.Point) {
    if dstImg, ok := dst.(draw.Image); ok {
        draw.Copy(dstImg, dstPoint, src, srcRect, draw.Src, nil)
    }
}

// Composite with alpha blending
func composite(bottom, top image.Image) *image.RGBA {
    result := image.NewRGBA(bottom.Bounds())

    // Draw bottom layer
    draw.Draw(result, result.Bounds(), bottom, image.Point{}, draw.Src)

    // Composite top layer with alpha blending
    draw.Draw(result, result.Bounds(), top, image.Point{}, draw.Over)

    return result
}
```

## Custom Interpolation Kernels

For advanced use cases, you can create custom interpolation kernels.

### Kernel Type

```go { .api }
// Kernel defines an interpolation kernel
type Kernel struct {
    Support float64              // Radius of kernel support
    At      func(float64) float64  // Kernel function
}
```

### Custom Kernel Example

```go
import (
    "math"
    "golang.org/x/image/draw"
)

// Create custom kernel (example: Box filter)
func createBoxKernel() *draw.Kernel {
    return &draw.Kernel{
        Support: 0.5,
        At: func(t float64) float64 {
            if t >= -0.5 && t <= 0.5 {
                return 1.0
            }
            return 0.0
        },
    }
}

// Create custom kernel (example: Triangle filter)
func createTriangleKernel() *draw.Kernel {
    return &draw.Kernel{
        Support: 1.0,
        At: func(t float64) float64 {
            t = math.Abs(t)
            if t < 1.0 {
                return 1.0 - t
            }
            return 0.0
        },
    }
}
```

## Performance Considerations

### Choosing Interpolation Algorithm

- **NearestNeighbor**: Use when performance is critical, or for pixel art where you want sharp edges
- **ApproxBiLinear**: Good default choice for UI and general purpose scaling
- **BiLinear**: Use for better quality when performance allows
- **CatmullRom**: Use for highest quality photo processing, printing, or when quality matters most

### Optimization Tips

1. **Reuse destination images**: Pre-allocate and reuse destination image buffers
2. **Match image types**: Use RGBA images for best performance with most operations
3. **Avoid unnecessary conversions**: Keep images in their native format when possible
4. **Scale in steps**: For large downscaling (>2x), scale in multiple steps for better quality
5. **Use source rectangles**: Crop before scaling when possible to reduce processing

### Batch Operations

```go
// Scale multiple images efficiently
func scaleMultiple(images []image.Image, width, height int) []*image.RGBA {
    results := make([]*image.RGBA, len(images))

    for i, img := range images {
        dst := image.NewRGBA(image.Rect(0, 0, width, height))
        draw.ApproxBiLinear.Scale(dst, dst.Bounds(), img, img.Bounds(), draw.Over, nil)
        results[i] = dst
    }

    return results
}
```

## Working with Different Image Types

```go
import (
    "image"
    "golang.org/x/image/draw"
)

// Scale any image type
func scaleAnyImage(src image.Image, width, height int) image.Image {
    dst := image.NewRGBA(image.Rect(0, 0, width, height))
    draw.CatmullRom.Scale(dst, dst.Bounds(), src, src.Bounds(), draw.Over, nil)
    return dst
}

// Scale preserving color model
func scalePreserveType(src image.Image, width, height int) image.Image {
    var dst draw.Image

    // Create destination with same type as source
    switch src.(type) {
    case *image.RGBA:
        dst = image.NewRGBA(image.Rect(0, 0, width, height))
    case *image.RGBA64:
        dst = image.NewRGBA64(image.Rect(0, 0, width, height))
    case *image.NRGBA:
        dst = image.NewNRGBA(image.Rect(0, 0, width, height))
    case *image.Gray:
        dst = image.NewGray(image.Rect(0, 0, width, height))
    default:
        dst = image.NewRGBA(image.Rect(0, 0, width, height))
    }

    draw.CatmullRom.Scale(dst, dst.Bounds(), src, src.Bounds(), draw.Over, nil)
    return dst
}
```
