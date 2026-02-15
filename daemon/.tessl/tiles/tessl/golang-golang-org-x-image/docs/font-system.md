# Font System

The font package provides core interfaces and utilities for font rendering and text layout in Go. It defines the `Face` interface that all font implementations must satisfy, and provides high-level text drawing capabilities through the `Drawer` type.

## Import

```go { .api }
import "golang.org/x/image/font"
```

## Core Font Interface

### Face Interface

The `Face` interface represents a font face at a specific size and style. All font implementations (OpenType, bitmap, Plan 9, etc.) implement this interface.

```go { .api }
type Face interface {
    // Close closes the font face and releases resources
    Close() error

    // Glyph returns the glyph rendering data for rune r at position dot
    // Returns: draw rectangle, mask image, mask point, advance width, and success flag
    Glyph(dot fixed.Point26_6, r rune) (
        dr image.Rectangle,
        mask image.Image,
        maskp image.Point,
        advance fixed.Int26_6,
        ok bool,
    )

    // GlyphBounds returns the bounding box and advance width for rune r
    GlyphBounds(r rune) (bounds fixed.Rectangle26_6, advance fixed.Int26_6, ok bool)

    // GlyphAdvance returns the advance width for rune r
    GlyphAdvance(r rune) (advance fixed.Int26_6, ok bool)

    // Kern returns the horizontal adjustment for the kerning pair (r0, r1)
    // A positive kern means to move the glyphs closer together
    Kern(r0, r1 rune) fixed.Int26_6

    // Metrics returns the font metrics
    Metrics() Metrics
}
```

### Font Metrics

Font metrics describe the overall dimensions and characteristics of a font.

```go { .api }
type Metrics struct {
    Height     fixed.Int26_6  // Recommended line height (vertical distance between baselines)
    Ascent     fixed.Int26_6  // Distance from baseline to top of line
    Descent    fixed.Int26_6  // Distance from baseline to bottom of line (typically negative)
    XHeight    fixed.Int26_6  // Height of lowercase 'x'
    CapHeight  fixed.Int26_6  // Height of uppercase letters
    CaretSlope image.Point    // Slope of the caret for italic fonts (X, Y offset)
}
```

**Example**:
```go
face := /* obtain font face */
metrics := face.Metrics()

// Calculate line height in pixels
lineHeight := metrics.Height.Ceil()

// Calculate baseline position from top
baseline := metrics.Ascent.Ceil()
```

## Text Drawing

### Drawer

The `Drawer` type provides high-level text rendering capabilities. It maintains state for drawing position and allows progressive text rendering.

```go { .api }
type Drawer struct {
    Dst  draw.Image       // Destination image to draw on
    Src  image.Image      // Source color or pattern for glyphs
    Face Face             // Font face to use
    Dot  fixed.Point26_6  // Current pen position (baseline, left edge of next glyph)
}
```

### Drawing Methods

```go { .api }
// DrawBytes draws text from a byte slice, updating Dot position
func (d *Drawer) DrawBytes(s []byte)

// DrawString draws text from a string, updating Dot position
func (d *Drawer) DrawString(s string)

// MeasureBytes returns the advance width of text in bytes without drawing
func (d *Drawer) MeasureBytes(s []byte) fixed.Int26_6

// MeasureString returns the advance width of text in string without drawing
func (d *Drawer) MeasureString(s string) fixed.Int26_6
```

### Text Drawing Example

```go
import (
    "image"
    "image/color"
    "golang.org/x/image/font"
    "golang.org/x/image/font/basicfont"
    "golang.org/x/image/math/fixed"
)

// Draw text on image
func drawText(dst *image.RGBA, text string, x, y int, c color.Color) {
    d := &font.Drawer{
        Dst:  dst,
        Src:  image.NewUniform(c),
        Face: basicfont.Face7x13,
        Dot:  fixed.P(x, y),
    }
    d.DrawString(text)
    // After drawing, d.Dot contains the position after the last character
}

// Measure text width
func measureText(text string, face font.Face) int {
    d := &font.Drawer{
        Face: face,
    }
    width := d.MeasureString(text)
    return width.Ceil()  // Convert to pixels
}

// Draw centered text
func drawCentered(dst *image.RGBA, text string, y int, face font.Face, c color.Color) {
    d := &font.Drawer{
        Dst:  dst,
        Src:  image.NewUniform(c),
        Face: face,
    }

    // Measure text width
    width := d.MeasureString(text)

    // Calculate centered X position
    centerX := (dst.Bounds().Dx() - width.Ceil()) / 2

    // Set position and draw
    d.Dot = fixed.P(centerX, y)
    d.DrawString(text)
}

// Draw multi-line text
func drawMultiLine(dst *image.RGBA, lines []string, x, y int, face font.Face, c color.Color) {
    d := &font.Drawer{
        Dst:  dst,
        Src:  image.NewUniform(c),
        Face: face,
    }

    metrics := face.Metrics()
    lineHeight := metrics.Height.Ceil()

    for i, line := range lines {
        d.Dot = fixed.P(x, y+i*lineHeight)
        d.DrawString(line)
    }
}
```

## Package-Level Text Functions

The font package provides package-level convenience functions for measuring and bounding text without creating a Drawer.

```go { .api }
// MeasureString returns the advance width of a string
func MeasureString(f Face, s string) fixed.Int26_6

// MeasureBytes returns the advance width of a byte slice
func MeasureBytes(f Face, s []byte) fixed.Int26_6

// BoundString returns the bounding box and advance width of a string
func BoundString(f Face, s string) (bounds fixed.Rectangle26_6, advance fixed.Int26_6)

// BoundBytes returns the bounding box and advance width of a byte slice
func BoundBytes(f Face, s []byte) (bounds fixed.Rectangle26_6, advance fixed.Int26_6)
```

These functions are useful when you need to measure text without setting up a full Drawer context.

**Example**:
```go
import (
    "golang.org/x/image/font"
    "golang.org/x/image/font/basicfont"
)

func getTextDimensions(text string) (width, height int) {
    face := basicfont.Face7x13

    // Measure text
    advance := font.MeasureString(face, text)
    width = advance.Ceil()

    // Get bounding box
    bounds, _ := font.BoundString(face, text)
    height = (bounds.Max.Y - bounds.Min.Y).Ceil()

    return width, height
}
```

## Font Attributes

The font package defines standard constants for font weight, style, and stretch.

### Font Weight

```go { .api }
type Weight int

const (
    WeightThin       Weight = -3  // CSS font-weight value 100
    WeightExtraLight Weight = -2  // CSS font-weight value 200
    WeightLight      Weight = -1  // CSS font-weight value 300
    WeightNormal     Weight = +0  // CSS font-weight value 400
    WeightMedium     Weight = +1  // CSS font-weight value 500
    WeightSemiBold   Weight = +2  // CSS font-weight value 600
    WeightBold       Weight = +3  // CSS font-weight value 700
    WeightExtraBold  Weight = +4  // CSS font-weight value 800
    WeightBlack      Weight = +5  // CSS font-weight value 900
)
```

### Font Style

```go { .api }
type Style int

const (
    StyleNormal  Style = 0  // Normal (upright, roman)
    StyleItalic  Style = 1  // Italic (cursive)
    StyleOblique Style = 2  // Oblique (slanted)
)
```

### Font Stretch

```go { .api }
type Stretch int

const (
    StretchUltraCondensed Stretch = -4  // Ultra-condensed (50%)
    StretchExtraCondensed Stretch = -3  // Extra-condensed (62.5%)
    StretchCondensed      Stretch = -2  // Condensed (75%)
    StretchSemiCondensed  Stretch = -1  // Semi-condensed (87.5%)
    StretchNormal         Stretch = +0  // Normal (100%)
    StretchSemiExpanded   Stretch = +1  // Semi-expanded (112.5%)
    StretchExpanded       Stretch = +2  // Expanded (125%)
    StretchExtraExpanded  Stretch = +3  // Extra-expanded (150%)
    StretchUltraExpanded  Stretch = +4  // Ultra-expanded (200%)
)
```

These constants are primarily used when querying or selecting fonts, though not all font implementations support all variations.

## Font Hinting

Font hinting improves glyph rendering at small sizes by aligning features to pixel boundaries.

```go { .api }
type Hinting int

const (
    HintingNone     Hinting = 0  // No hinting (highest quality at large sizes)
    HintingVertical Hinting = 1  // Hint vertical stems only
    HintingFull     Hinting = 2  // Full hinting (best for small sizes)
)
```

**Usage**:
- `HintingNone`: Best for large text or high-DPI displays
- `HintingVertical`: Good balance for most use cases
- `HintingFull`: Best for small text on low-DPI displays

## Advanced Text Layout

### Kerning

Kerning adjusts the spacing between specific character pairs to improve visual appearance.

```go
face := /* obtain font face */

// Get kerning adjustment between 'A' and 'V'
kern := face.Kern('A', 'V')

// Apply kerning when drawing
d := &font.Drawer{
    Dst:  dst,
    Src:  src,
    Face: face,
    Dot:  fixed.P(x, y),
}

for i, r := range text {
    if i > 0 {
        prevRune := rune(text[i-1])
        d.Dot.X += face.Kern(prevRune, r)
    }
    d.DrawString(string(r))
}
```

Note: The `Drawer` type automatically applies kerning when using `DrawString` or `DrawBytes`, so manual kerning is typically not needed.

### Glyph-Level Rendering

For advanced use cases requiring direct glyph access:

```go
face := /* obtain font face */

// Get glyph rendering data
dot := fixed.P(100, 200)
dr, mask, maskp, advance, ok := face.Glyph(dot, 'A')
if !ok {
    // Glyph not available in font
    return
}

// Draw glyph manually
draw.Draw(dst, dr, mask, maskp, draw.Over)

// Update position for next glyph
dot.X += advance
```

### Measuring Text Bounds

```go
func measureTextBounds(text string, face font.Face) fixed.Rectangle26_6 {
    var bounds fixed.Rectangle26_6
    dot := fixed.Point26_6{}

    for _, r := range text {
        glyphBounds, advance, ok := face.GlyphBounds(r)
        if !ok {
            continue
        }

        // Translate glyph bounds to current position
        glyphBounds.Min.X += dot.X
        glyphBounds.Max.X += dot.X
        glyphBounds.Min.Y += dot.Y
        glyphBounds.Max.Y += dot.Y

        // Union with total bounds
        if bounds.Empty() {
            bounds = glyphBounds
        } else {
            bounds = bounds.Union(glyphBounds)
        }

        // Advance position
        dot.X += advance
    }

    return bounds
}
```

## Working with Fixed-Point Coordinates

Font rendering uses fixed-point arithmetic for sub-pixel positioning. See the [Math Utilities](./math-utilities.md) documentation for details on fixed-point types.

Common conversions:

```go
import "golang.org/x/image/math/fixed"

// Integer to fixed-point
x := fixed.I(10)  // 10.0 in 26.6 format

// Fixed-point to integer
pixels := x.Ceil()   // Round up
pixels := x.Floor()  // Round down
pixels := x.Round()  // Round to nearest

// Create point from integers
p := fixed.P(100, 200)

// Sub-pixel positioning
p := fixed.Point26_6{
    X: fixed.I(100) + 32,  // 100.5 pixels (32 = 0.5 * 64)
    Y: fixed.I(200),
}
```
