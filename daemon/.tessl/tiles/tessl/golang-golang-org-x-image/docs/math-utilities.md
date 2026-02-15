# Math Utilities

The golang.org/x/image module provides mathematical utilities for graphics programming, including fixed-point arithmetic for precise positioning and layout, and floating-point vector and matrix types for 3D graphics transformations.

## Fixed-Point Arithmetic

The `fixed` package provides fixed-point arithmetic types for sub-pixel precision in text layout and graphics positioning.

### Import

```go { .api }
import "golang.org/x/image/math/fixed"
```

### Fixed-Point Types

```go { .api }
// Int26_6 is a 26.6 fixed-point number
// 26 bits for the integer part, 6 bits for the fractional part (1/64 pixel precision)
type Int26_6 int32

// Int52_12 is a 52.12 fixed-point number
// 52 bits for the integer part, 12 bits for the fractional part (higher precision)
type Int52_12 int64
```

### Conversion Functions

```go { .api }
// I converts an integer to Int26_6 fixed-point
func I(i int) Int26_6

// P creates a Point26_6 from integer coordinates
func P(x, y int) Point26_6

// R creates a Rectangle26_6 from integer coordinates
func R(x0, y0, x1, y1 int) Rectangle26_6
```

### Int26_6 Methods

```go { .api }
// Floor returns the greatest integer value less than or equal to x
func (x Int26_6) Floor() int

// Round returns the nearest integer value to x
func (x Int26_6) Round() int

// Ceil returns the least integer value greater than or equal to x
func (x Int26_6) Ceil() int

// Mul performs fixed-point multiplication
func (x Int26_6) Mul(y Int26_6) Int26_6

// String returns a human-readable representation (e.g., "10.25")
func (x Int26_6) String() string
```

Int52_12 has the same methods but with Int52_12 types.

### Point Types

```go { .api }
// Point26_6 is a 2D point with fixed-point coordinates
type Point26_6 struct {
    X, Y Int26_6
}

// Point52_12 is a 2D point with higher precision fixed-point coordinates
type Point52_12 struct {
    X, Y Int52_12
}
```

### Point Methods

```go { .api }
// Add returns the vector p+q
func (p Point26_6) Add(q Point26_6) Point26_6

// Sub returns the vector p-q
func (p Point26_6) Sub(q Point26_6) Point26_6

// Mul returns the vector p*k (scalar multiplication)
func (p Point26_6) Mul(k Int26_6) Point26_6

// Div returns the vector p/k (scalar division)
func (p Point26_6) Div(k Int26_6) Point26_6

// In reports whether p is in r
func (p Point26_6) In(r Rectangle26_6) bool

// String returns a human-readable representation (e.g., "(10.5,20.25)")
func (p Point26_6) String() string
```

Point52_12 has the same methods but with Point52_12 and Int52_12 types.

### Rectangle Types

```go { .api }
// Rectangle26_6 is a rectangle with fixed-point coordinates
type Rectangle26_6 struct {
    Min, Max Point26_6
}

// Rectangle52_12 is a rectangle with higher precision fixed-point coordinates
type Rectangle52_12 struct {
    Min, Max Point52_12
}
```

### Rectangle Methods

```go { .api }
// Add returns the rectangle r translated by p
func (r Rectangle26_6) Add(p Point26_6) Rectangle26_6

// Sub returns the rectangle r translated by -p
func (r Rectangle26_6) Sub(p Point26_6) Rectangle26_6

// Intersect returns the largest rectangle contained by both r and s
func (r Rectangle26_6) Intersect(s Rectangle26_6) Rectangle26_6

// Union returns the smallest rectangle containing both r and s
func (r Rectangle26_6) Union(s Rectangle26_6) Rectangle26_6

// Empty reports whether the rectangle contains no points
func (r Rectangle26_6) Empty() bool

// In reports whether every point in r is in s
func (r Rectangle26_6) In(s Rectangle26_6) bool

// String returns a human-readable representation
func (r Rectangle26_6) String() string
```

Rectangle52_12 has the same methods but with Rectangle52_12 and Point52_12 types.

### Fixed-Point Examples

```go
import "golang.org/x/image/math/fixed"

// Basic conversions
func fixedPointBasics() {
    // Convert integer to fixed-point
    x := fixed.I(10)  // 10.0 in 26.6 format
    y := fixed.I(20)  // 20.0

    // Create point
    p := fixed.P(100, 200)  // Point at (100.0, 200.0)

    // Create rectangle
    r := fixed.R(0, 0, 640, 480)  // Rectangle from (0,0) to (640,480)

    // Convert back to integers
    xInt := x.Floor()   // 10
    xRound := x.Round() // 10
    xCeil := x.Ceil()   // 10
}

// Sub-pixel positioning
func subPixelPositioning() {
    // Create position with fractional part
    // 26.6 format: 1 unit = 1/64 pixel
    x := fixed.Int26_6(640)  // 10 pixels (10 * 64)
    x += 32                  // Add 0.5 pixels (32/64)
    // Now x = 10.5 pixels

    // Convert to pixels
    pixels := x.Ceil()  // 11 (rounds up)
    pixels = x.Floor()  // 10 (rounds down)
    pixels = x.Round()  // 11 (rounds to nearest, 0.5 rounds up in Go)
}

// Fixed-point arithmetic
func fixedPointArithmetic() {
    a := fixed.I(10)  // 10.0
    b := fixed.I(3)   // 3.0

    // Multiplication
    c := a.Mul(b)     // 30.0
    pixels := c.Round() // 30

    // Point arithmetic
    p1 := fixed.P(100, 200)
    p2 := fixed.P(50, 75)

    sum := p1.Add(p2)  // (150, 275)
    diff := p1.Sub(p2) // (50, 125)

    // Scalar multiplication
    scaled := p1.Mul(fixed.I(2))  // (200, 400)
}

// Font positioning example
func positionText() {
    // Start at pixel position (10, 20)
    dot := fixed.P(10, 20)

    // Advance by character width (e.g., 8.5 pixels)
    advance := fixed.I(8) + 32  // 8.5 pixels
    dot.X += advance

    // Now dot.X is at 18.5 pixels
}
```

## Floating-Point Vectors and Matrices

The `f32` and `f64` packages provide vector and matrix types for 3D graphics transformations.

### Float32 Types

```go { .api }
import "golang.org/x/image/math/f32"

// Vector types
type Vec2 [2]float32  // 2D vector
type Vec3 [3]float32  // 3D vector
type Vec4 [4]float32  // 4D vector (homogeneous coordinates)

// Matrix types (row-major order)
type Mat3 [9]float32   // 3x3 matrix (9 elements)
type Mat4 [16]float32  // 4x4 matrix (16 elements)

// Affine transformation types
type Aff3 [6]float32   // 3x3 affine matrix (bottom row implicit [0 0 1])
type Aff4 [12]float32  // 4x4 affine matrix (bottom row implicit [0 0 0 1])
```

### Float64 Types

```go { .api }
import "golang.org/x/image/math/f64"

// Same structure as f32 but with float64 precision
type Vec2 [2]float64
type Vec3 [3]float64
type Vec4 [4]float64
type Mat3 [9]float64
type Mat4 [16]float64
type Aff3 [6]float64
type Aff4 [12]float64
```

### Vector Examples

```go
import "golang.org/x/image/math/f32"

// 2D vector operations
func vector2DExample() {
    // Create vectors
    v1 := f32.Vec2{3.0, 4.0}
    v2 := f32.Vec2{1.0, 2.0}

    // Access components
    x := v1[0]  // 3.0
    y := v1[1]  // 4.0

    // Manual vector arithmetic
    sum := f32.Vec2{v1[0] + v2[0], v1[1] + v2[1]}  // {4.0, 6.0}
    diff := f32.Vec2{v1[0] - v2[0], v1[1] - v2[1]} // {2.0, 2.0}
}

// 3D vector operations
func vector3DExample() {
    v1 := f32.Vec3{1.0, 2.0, 3.0}
    v2 := f32.Vec3{4.0, 5.0, 6.0}

    // Component access
    x, y, z := v1[0], v1[1], v1[2]

    // Manual vector arithmetic
    sum := f32.Vec3{v1[0] + v2[0], v1[1] + v2[1], v1[2] + v2[2]}

    // Scalar multiplication
    scaled := f32.Vec3{v1[0] * 2, v1[1] * 2, v1[2] * 2}

    // Dot product
    dot := v1[0]*v2[0] + v1[1]*v2[1] + v1[2]*v2[2]

    // Cross product
    cross := f32.Vec3{
        v1[1]*v2[2] - v1[2]*v2[1],
        v1[2]*v2[0] - v1[0]*v2[2],
        v1[0]*v2[1] - v1[1]*v2[0],
    }
}

// 4D homogeneous coordinates
func vector4DExample() {
    // 3D point in homogeneous coordinates
    point := f32.Vec4{10.0, 20.0, 30.0, 1.0}

    // 3D direction vector in homogeneous coordinates
    direction := f32.Vec4{1.0, 0.0, 0.0, 0.0}
}
```

### Matrix Examples

```go
import (
    "math"
    "golang.org/x/image/math/f32"
)

// 3x3 matrix (row-major order)
func matrix3x3Example() {
    // Identity matrix
    identity := f32.Mat3{
        1, 0, 0,
        0, 1, 0,
        0, 0, 1,
    }

    // Rotation matrix (rotate around Z axis)
    angle := math.Pi / 4  // 45 degrees
    cos := float32(math.Cos(angle))
    sin := float32(math.Sin(angle))

    rotation := f32.Mat3{
        cos, -sin, 0,
        sin, cos, 0,
        0, 0, 1,
    }

    // Scale matrix
    scaleX, scaleY := float32(2.0), float32(3.0)
    scale := f32.Mat3{
        scaleX, 0, 0,
        0, scaleY, 0,
        0, 0, 1,
    }
}

// 4x4 matrix for 3D transformations
func matrix4x4Example() {
    // Identity matrix
    identity := f32.Mat4{
        1, 0, 0, 0,
        0, 1, 0, 0,
        0, 0, 1, 0,
        0, 0, 0, 1,
    }

    // Translation matrix
    tx, ty, tz := float32(10), float32(20), float32(30)
    translation := f32.Mat4{
        1, 0, 0, tx,
        0, 1, 0, ty,
        0, 0, 1, tz,
        0, 0, 0, 1,
    }

    // Scale matrix
    sx, sy, sz := float32(2), float32(2), float32(2)
    scale := f32.Mat4{
        sx, 0, 0, 0,
        0, sy, 0, 0,
        0, 0, sz, 0,
        0, 0, 0, 1,
    }
}

// Matrix-vector multiplication (manual)
func matrixVectorMultiply() {
    m := f32.Mat3{
        1, 0, 2,
        0, 1, 3,
        0, 0, 1,
    }

    v := f32.Vec3{5, 10, 1}

    // result = m * v (treating v as column vector)
    result := f32.Vec3{
        m[0]*v[0] + m[1]*v[1] + m[2]*v[2],
        m[3]*v[0] + m[4]*v[1] + m[5]*v[2],
        m[6]*v[0] + m[7]*v[1] + m[8]*v[2],
    }
}
```

### Affine Transformations

Affine matrices represent common transformations (translation, rotation, scale, shear) with the bottom row implicit.

```go
import (
    "math"
    "golang.org/x/image/math/f64"
)

// 2D affine transformation (used by draw.Transform)
func affine2DExample() {
    // Aff3 represents a 3x3 matrix with bottom row [0 0 1]
    // Layout: [m00, m01, m02, m10, m11, m12]

    // Identity transform
    identity := f64.Aff3{
        1, 0, 0,
        0, 1, 0,
    }

    // Translation by (tx, ty)
    tx, ty := 100.0, 50.0
    translation := f64.Aff3{
        1, 0, tx,
        0, 1, ty,
    }

    // Scale by (sx, sy)
    sx, sy := 2.0, 2.0
    scale := f64.Aff3{
        sx, 0, 0,
        0, sy, 0,
    }

    // Rotation around origin
    angle := math.Pi / 4  // 45 degrees
    cos := math.Cos(angle)
    sin := math.Sin(angle)
    rotation := f64.Aff3{
        cos, -sin, 0,
        sin, cos, 0,
    }

    // Rotation around point (cx, cy)
    cx, cy := 100.0, 100.0
    rotationAroundPoint := f64.Aff3{
        cos, -sin, cx - cos*cx + sin*cy,
        sin, cos, cy - sin*cx - cos*cy,
    }

    // Shear transformation
    shearX, shearY := 0.5, 0.0
    shear := f64.Aff3{
        1, shearX, 0,
        shearY, 1, 0,
    }
}

// 3D affine transformation
func affine3DExample() {
    // Aff4 represents a 4x4 matrix with bottom row [0 0 0 1]
    // Layout: [m00, m01, m02, m03, m10, m11, m12, m13, m20, m21, m22, m23]

    // Translation in 3D
    tx, ty, tz := 10.0, 20.0, 30.0
    translation := f64.Aff4{
        1, 0, 0, tx,
        0, 1, 0, ty,
        0, 0, 1, tz,
    }

    // Scale in 3D
    sx, sy, sz := 2.0, 2.0, 2.0
    scale := f64.Aff4{
        sx, 0, 0, 0,
        0, sy, 0, 0,
        0, 0, sz, 0,
    }

    // Rotation around Z axis
    angle := math.Pi / 6
    cos := math.Cos(angle)
    sin := math.Sin(angle)
    rotationZ := f64.Aff4{
        cos, -sin, 0, 0,
        sin, cos, 0, 0,
        0, 0, 1, 0,
    }
}
```

### Using Affine Transformations with draw.Transform

```go
import (
    "image"
    "math"
    "golang.org/x/image/draw"
    "golang.org/x/image/math/f64"
)

// Rotate image using affine transformation
func rotateImageWithAffine(src image.Image, angleDegrees float64) *image.RGBA {
    bounds := src.Bounds()
    dst := image.NewRGBA(bounds)

    // Calculate center
    centerX := float64(bounds.Dx()) / 2
    centerY := float64(bounds.Dy()) / 2

    // Create rotation matrix around center
    angleRad := angleDegrees * math.Pi / 180.0
    cos := math.Cos(angleRad)
    sin := math.Sin(angleRad)

    m := f64.Aff3{
        cos, -sin, centerX - cos*centerX + sin*centerY,
        sin, cos, centerY - sin*centerX - cos*centerY,
    }

    // Apply transformation
    draw.BiLinear.Transform(dst, m, src, src.Bounds(), draw.Src, nil)

    return dst
}

// Scale and translate
func scaleAndTranslate(src image.Image, scale, tx, ty float64) *image.RGBA {
    bounds := src.Bounds()
    dstW := int(float64(bounds.Dx()) * scale)
    dstH := int(float64(bounds.Dy()) * scale)
    dst := image.NewRGBA(image.Rect(0, 0, dstW, dstH))

    m := f64.Aff3{
        scale, 0, tx,
        0, scale, ty,
    }

    draw.BiLinear.Transform(dst, m, src, src.Bounds(), draw.Src, nil)

    return dst
}
```

## Practical Applications

### Text Layout with Fixed-Point

```go
import (
    "golang.org/x/image/font"
    "golang.org/x/image/math/fixed"
)

// Layout text with precise positioning
func layoutText(lines []string, face font.Face, lineSpacing int) []fixed.Point26_6 {
    positions := make([]fixed.Point26_6, len(lines))

    metrics := face.Metrics()
    baseY := metrics.Ascent

    for i := range lines {
        positions[i] = fixed.Point26_6{
            X: fixed.I(0),
            Y: baseY + fixed.I(i*lineSpacing),
        }
    }

    return positions
}
```

### 3D Graphics Pipeline

```go
import "golang.org/x/image/math/f32"

// Simple 3D to 2D projection
func projectPoint(point3D f32.Vec3, fov, aspectRatio float32) f32.Vec2 {
    // Simple perspective projection
    z := point3D[2]
    if z == 0 {
        z = 0.001  // Avoid division by zero
    }

    factor := fov / z

    return f32.Vec2{
        point3D[0] * factor * aspectRatio,
        point3D[1] * factor,
    }
}
```

## Performance Considerations

### Fixed-Point vs. Floating-Point

**Fixed-Point (Int26_6, Int52_12)**:
- Faster integer arithmetic
- Exact representation of fractional pixels (no rounding errors)
- Used internally by font rendering
- Best for text layout and pixel-precise positioning

**Floating-Point (f32, f64)**:
- More flexible range
- Standard math library support
- Used for 3D transformations
- Better for geometric calculations

### Choosing Precision

**Int26_6**:
- 1/64 pixel precision (sufficient for most text and 2D graphics)
- Faster operations
- Used by font package

**Int52_12**:
- 1/4096 precision (higher precision for complex calculations)
- Slower operations
- Use when Int26_6 range or precision is insufficient

**f32 vs f64**:
- f32: Faster, less memory, sufficient for most graphics
- f64: Higher precision, use for scientific calculations or when precision matters

## Matrix Layout

All matrices use row-major order:

```go
// Mat3: 3x3 matrix
// [0  1  2]    [m00 m01 m02]
// [3  4  5] =  [m10 m11 m12]
// [6  7  8]    [m20 m21 m22]

// Mat4: 4x4 matrix
// [0  1  2  3]     [m00 m01 m02 m03]
// [4  5  6  7]  =  [m10 m11 m12 m13]
// [8  9  10 11]    [m20 m21 m22 m23]
// [12 13 14 15]    [m30 m31 m32 m33]

// Aff3: 3x3 affine (bottom row implicit [0 0 1])
// [0 1 2]    [m00 m01 m02]
// [3 4 5] =  [m10 m11 m12]
//            [  0   0   1]

// Aff4: 4x4 affine (bottom row implicit [0 0 0 1])
// [0 1 2  3]     [m00 m01 m02 m03]
// [4 5 6  7]  =  [m10 m11 m12 m13]
// [8 9 10 11]    [m20 m21 m22 m23]
//                [  0   0   0   1]
```
