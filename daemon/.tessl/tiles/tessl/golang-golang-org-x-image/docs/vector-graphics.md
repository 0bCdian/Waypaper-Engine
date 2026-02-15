# Vector Graphics

The `vector` package provides 2D vector graphics rasterization with anti-aliasing support. It allows you to draw paths composed of lines and Bézier curves and render them to raster images with high-quality anti-aliasing.

## Import

```go { .api }
import "golang.org/x/image/vector"
```

## Rasterizer

The `Rasterizer` type is the core component for vector graphics rendering.

```go { .api }
// Rasterizer rasterizes vector graphics paths to raster images
type Rasterizer struct {
    DrawOp draw.Op  // Porter-Duff composition operator (Over or Src)
}

// NewRasterizer creates a new Rasterizer for images of width w and height h
func NewRasterizer(w, h int) *Rasterizer
```

### Configuration

```go { .api }
// Reset resets the Rasterizer for a new image size
// This clears the current path and prepares for new dimensions
func (z *Rasterizer) Reset(w, h int)

// Size returns the current rasterizer dimensions
func (z *Rasterizer) Size() image.Point

// Bounds returns the current rasterizer bounds as a rectangle
func (z *Rasterizer) Bounds() image.Rectangle
```

## Path Construction

Build vector paths using a pen metaphor. The current pen position tracks where the next path segment starts.

### Position Management

```go { .api }
// Pen returns the current pen position
func (z *Rasterizer) Pen() (x, y float32)

// MoveTo moves the pen to point (ax, ay) without drawing
// This starts a new sub-path
func (z *Rasterizer) MoveTo(ax, ay float32)
```

### Drawing Primitives

```go { .api }
// LineTo draws a straight line from the current pen position to (bx, by)
// Updates the pen position to (bx, by)
func (z *Rasterizer) LineTo(bx, by float32)

// QuadTo draws a quadratic Bézier curve
// Control point: (bx, by), end point: (cx, cy)
// Updates the pen position to (cx, cy)
func (z *Rasterizer) QuadTo(bx, by, cx, cy float32)

// CubeTo draws a cubic Bézier curve
// Control points: (bx, by) and (cx, cy), end point: (dx, dy)
// Updates the pen position to (dx, dy)
func (z *Rasterizer) CubeTo(bx, by, cx, cy, dx, dy float32)

// ClosePath closes the current sub-path by drawing a line to the start point
func (z *Rasterizer) ClosePath()
```

## Rendering

```go { .api }
// Draw rasterizes the accumulated path to the destination image
// dst: destination image
// r: destination rectangle to render into
// src: source color or image for filling
// sp: source image offset point
func (z *Rasterizer) Draw(dst draw.Image, r image.Rectangle, src image.Image, sp image.Point)
```

After calling `Draw`, the path is cleared and you can start building a new path.

## Basic Examples

### Drawing a Triangle

```go
import (
    "image"
    "image/color"
    "golang.org/x/image/vector"
)

func drawTriangle() *image.RGBA {
    // Create image
    width, height := 200, 200
    dst := image.NewRGBA(image.Rect(0, 0, width, height))

    // Create rasterizer
    z := vector.NewRasterizer(width, height)

    // Build triangle path
    z.MoveTo(100, 20)   // Top vertex
    z.LineTo(180, 180)  // Bottom-right vertex
    z.LineTo(20, 180)   // Bottom-left vertex
    z.ClosePath()       // Close the triangle

    // Render with red color
    src := image.NewUniform(color.RGBA{255, 0, 0, 255})
    z.Draw(dst, dst.Bounds(), src, image.Point{})

    return dst
}
```

### Drawing a Rectangle

```go
func drawRectangle(x, y, width, height float32) *image.RGBA {
    imgWidth, imgHeight := 200, 200
    dst := image.NewRGBA(image.Rect(0, 0, imgWidth, imgHeight))

    z := vector.NewRasterizer(imgWidth, imgHeight)

    // Draw rectangle
    z.MoveTo(x, y)
    z.LineTo(x+width, y)
    z.LineTo(x+width, y+height)
    z.LineTo(x, y+height)
    z.ClosePath()

    src := image.NewUniform(color.RGBA{0, 0, 255, 255})
    z.Draw(dst, dst.Bounds(), src, image.Point{})

    return dst
}
```

### Drawing a Circle (using QuadTo)

```go
import (
    "math"
    "image"
    "image/color"
    "golang.org/x/image/vector"
)

func drawCircle(centerX, centerY, radius float32) *image.RGBA {
    imgSize := int(radius * 2.5)
    dst := image.NewRGBA(image.Rect(0, 0, imgSize, imgSize))

    z := vector.NewRasterizer(imgSize, imgSize)

    // Approximate circle with quadratic Bézier curves
    // Magic number for circular approximation with quadratics
    k := (4.0 / 3.0) * (math.Sqrt2 - 1)
    c := radius * float32(k)

    // Start at top of circle
    z.MoveTo(centerX, centerY-radius)

    // Top-right quadrant
    z.QuadTo(centerX+c, centerY-radius, centerX+radius, centerY-c)
    z.QuadTo(centerX+radius, centerY+c, centerX+c, centerY+radius)

    // Bottom half
    z.QuadTo(centerX-c, centerY+radius, centerX-radius, centerY+c)
    z.QuadTo(centerX-radius, centerY-c, centerX, centerY-radius)

    z.ClosePath()

    src := image.NewUniform(color.RGBA{0, 255, 0, 255})
    z.Draw(dst, dst.Bounds(), src, image.Point{})

    return dst
}
```

## Advanced Examples

### Drawing Smooth Curves

```go
func drawSmoothCurve() *image.RGBA {
    width, height := 400, 300
    dst := image.NewRGBA(image.Rect(0, 0, width, height))

    z := vector.NewRasterizer(width, height)

    // Draw smooth S-curve using cubic Bézier
    z.MoveTo(50, 250)
    z.CubeTo(150, 250, 150, 50, 250, 50)
    z.CubeTo(350, 50, 350, 250, 350, 250)

    // Note: This is a stroke, not a fill, so we need to create a path
    // For actual stroking, you'd trace both sides of the path

    src := image.NewUniform(color.RGBA{128, 0, 128, 255})
    z.Draw(dst, dst.Bounds(), src, image.Point{})

    return dst
}
```

### Drawing Multiple Shapes

```go
func drawMultipleShapes() *image.RGBA {
    width, height := 400, 400
    dst := image.NewRGBA(image.Rect(0, 0, width, height))

    z := vector.NewRasterizer(width, height)

    // First shape: triangle
    z.MoveTo(50, 50)
    z.LineTo(150, 50)
    z.LineTo(100, 150)
    z.ClosePath()

    // Second shape: rectangle (separate sub-path)
    z.MoveTo(200, 50)
    z.LineTo(350, 50)
    z.LineTo(350, 200)
    z.LineTo(200, 200)
    z.ClosePath()

    // Render both shapes at once
    src := image.NewUniform(color.RGBA{255, 128, 0, 255})
    z.Draw(dst, dst.Bounds(), src, image.Point{})

    return dst
}
```

### Drawing with Pattern Fill

```go
import (
    "image"
    "image/color"
    "golang.org/x/image/vector"
)

func drawWithPattern() *image.RGBA {
    width, height := 200, 200
    dst := image.NewRGBA(image.Rect(0, 0, width, height))

    // Create pattern image
    pattern := image.NewRGBA(image.Rect(0, 0, 20, 20))
    for y := 0; y < 20; y++ {
        for x := 0; x < 20; x++ {
            if (x+y)%2 == 0 {
                pattern.Set(x, y, color.RGBA{255, 0, 0, 255})
            } else {
                pattern.Set(x, y, color.RGBA{0, 0, 255, 255})
            }
        }
    }

    z := vector.NewRasterizer(width, height)

    // Draw circle
    z.MoveTo(100, 50)
    for i := 0; i < 8; i++ {
        angle := float64(i) * math.Pi / 4
        x := 100 + float32(50*math.Cos(angle))
        y := 100 + float32(50*math.Sin(angle))
        z.LineTo(x, y)
    }
    z.ClosePath()

    // Fill with pattern
    z.Draw(dst, dst.Bounds(), pattern, image.Point{})

    return dst
}
```

## Porter-Duff Composition

Control how shapes blend using the `DrawOp` field:

```go
import (
    "image"
    "image/color"
    "image/draw"
    "golang.org/x/image/vector"
)

func drawWithComposition() *image.RGBA {
    width, height := 200, 200
    dst := image.NewRGBA(image.Rect(0, 0, width, height))

    // Fill background
    draw.Draw(dst, dst.Bounds(), image.NewUniform(color.White), image.Point{}, draw.Src)

    z := vector.NewRasterizer(width, height)

    // First shape with Over (alpha blending)
    z.DrawOp = draw.Over
    z.MoveTo(50, 50)
    z.LineTo(150, 50)
    z.LineTo(150, 150)
    z.LineTo(50, 150)
    z.ClosePath()

    z.Draw(dst, dst.Bounds(), image.NewUniform(color.RGBA{255, 0, 0, 128}), image.Point{})

    // Second shape with Src (replaces destination)
    z.DrawOp = draw.Src
    z.MoveTo(100, 100)
    z.LineTo(200, 100)
    z.LineTo(200, 200)
    z.LineTo(100, 200)
    z.ClosePath()

    z.Draw(dst, dst.Bounds(), image.NewUniform(color.RGBA{0, 0, 255, 128}), image.Point{})

    return dst
}
```

## Rendering to Partial Region

```go
func drawToRegion() *image.RGBA {
    width, height := 400, 400
    dst := image.NewRGBA(image.Rect(0, 0, width, height))

    z := vector.NewRasterizer(width, height)

    // Build path
    z.MoveTo(50, 50)
    z.LineTo(350, 50)
    z.LineTo(350, 350)
    z.LineTo(50, 350)
    z.ClosePath()

    // Render only to specific region (clips the output)
    renderRegion := image.Rect(100, 100, 300, 300)
    src := image.NewUniform(color.RGBA{255, 0, 255, 255})
    z.Draw(dst, renderRegion, src, image.Point{})

    return dst
}
```

## Building Complex Shapes

### Star Shape

```go
func drawStar(centerX, centerY, outerRadius, innerRadius float32, points int) *image.RGBA {
    imgSize := int(outerRadius * 2.5)
    dst := image.NewRGBA(image.Rect(0, 0, imgSize, imgSize))

    z := vector.NewRasterizer(imgSize, imgSize)

    // Calculate star points
    angleStep := 2 * math.Pi / float64(points*2)

    // Start at first outer point
    angle := -math.Pi / 2 // Start at top
    x := centerX + float32(math.Cos(angle))*outerRadius
    y := centerY + float32(math.Sin(angle))*outerRadius
    z.MoveTo(x, y)

    // Alternate between outer and inner points
    for i := 1; i < points*2; i++ {
        angle += angleStep
        var radius float32
        if i%2 == 0 {
            radius = outerRadius
        } else {
            radius = innerRadius
        }
        x := centerX + float32(math.Cos(angle))*radius
        y := centerY + float32(math.Sin(angle))*radius
        z.LineTo(x, y)
    }

    z.ClosePath()

    src := image.NewUniform(color.RGBA{255, 215, 0, 255}) // Gold
    z.Draw(dst, dst.Bounds(), src, image.Point{})

    return dst
}

// Usage
func example() {
    star := drawStar(100, 100, 80, 40, 5) // 5-pointed star
}
```

### Rounded Rectangle

```go
func drawRoundedRect(x, y, width, height, radius float32) *image.RGBA {
    imgWidth := int(x + width + 10)
    imgHeight := int(y + height + 10)
    dst := image.NewRGBA(image.Rect(0, 0, imgWidth, imgHeight))

    z := vector.NewRasterizer(imgWidth, imgHeight)

    // Top edge
    z.MoveTo(x+radius, y)
    z.LineTo(x+width-radius, y)

    // Top-right corner (quadratic Bézier)
    z.QuadTo(x+width, y, x+width, y+radius)

    // Right edge
    z.LineTo(x+width, y+height-radius)

    // Bottom-right corner
    z.QuadTo(x+width, y+height, x+width-radius, y+height)

    // Bottom edge
    z.LineTo(x+radius, y+height)

    // Bottom-left corner
    z.QuadTo(x, y+height, x, y+height-radius)

    // Left edge
    z.LineTo(x, y+radius)

    // Top-left corner
    z.QuadTo(x, y, x+radius, y)

    z.ClosePath()

    src := image.NewUniform(color.RGBA{100, 149, 237, 255}) // Cornflower blue
    z.Draw(dst, dst.Bounds(), src, image.Point{})

    return dst
}
```

## Performance Considerations

### Optimization Tips

1. **Reuse Rasterizer**: Create one `Rasterizer` and use `Reset()` for multiple images of the same size
2. **Minimize Path Complexity**: Simpler paths rasterize faster
3. **Appropriate Image Size**: Match rasterizer size to output image for best performance
4. **Batch Rendering**: Build multiple sub-paths before calling `Draw()` when possible

### Efficient Batch Rendering

```go
func drawMultipleShapesEfficiently(shapes [][]image.Point) *image.RGBA {
    width, height := 400, 400
    dst := image.NewRGBA(image.Rect(0, 0, width, height))

    z := vector.NewRasterizer(width, height)

    // Build all paths before rendering
    for _, shape := range shapes {
        if len(shape) < 2 {
            continue
        }

        z.MoveTo(float32(shape[0].X), float32(shape[0].Y))
        for _, pt := range shape[1:] {
            z.LineTo(float32(pt.X), float32(pt.Y))
        }
        z.ClosePath()
    }

    // Render all shapes at once
    src := image.NewUniform(color.RGBA{0, 128, 255, 255})
    z.Draw(dst, dst.Bounds(), src, image.Point{})

    return dst
}
```

## Implementation Notes

- The rasterizer uses fixed-point or floating-point arithmetic internally depending on image size
- Anti-aliasing is automatic and produces high-quality results
- SIMD optimizations are used on supported platforms
- The non-zero winding rule is used for filling (standard for most vector graphics)
- Coordinates are in pixels with sub-pixel precision

## Use Cases

- **Icons and Shapes**: Render scalable icons and UI elements
- **Charts and Graphs**: Draw charts, plots, and diagrams
- **Custom UI Elements**: Create buttons, progress bars, and other UI components
- **Artistic Graphics**: Generate procedural art and patterns
- **CAD Applications**: Render technical drawings and blueprints
- **Logo Rendering**: Render vector logos at any size
