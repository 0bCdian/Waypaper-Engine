# Font Implementations

The golang.org/x/image module provides multiple font format implementations, including OpenType/TrueType fonts, bitmap fonts, Plan 9 fonts, and embedded font families. Each implementation provides a `font.Face` compatible interface for text rendering.

## OpenType and TrueType Fonts

The `opentype` package provides support for parsing and rendering OpenType (.otf) and TrueType (.ttf) fonts.

### Import

```go { .api }
import "golang.org/x/image/font/opentype"
```

### Parsing Fonts

```go { .api }
// Font represents an OpenType or TrueType font (alias for sfnt.Font)
type Font = sfnt.Font

// Collection represents an OpenType font collection file (.ttc)
type Collection = sfnt.Collection

// Parse parses an OpenType or TrueType font from binary data
func Parse(src []byte) (*Font, error)

// ParseReaderAt parses an OpenType or TrueType font from an io.ReaderAt
func ParseReaderAt(src io.ReaderAt) (*Font, error)

// ParseCollection parses an OpenType font collection (.ttc file)
func ParseCollection(src []byte) (*Collection, error)

// ParseCollectionReaderAt parses an OpenType font collection from an io.ReaderAt
func ParseCollectionReaderAt(src io.ReaderAt) (*Collection, error)
```

### Creating Font Faces

```go { .api }
// FaceOptions specifies options for creating a font face
type FaceOptions struct {
    Size    float64      // Font size in points (required)
    DPI     float64      // Dots per inch (default: 72)
    Hinting font.Hinting // Hinting mode (default: HintingNone)
}

// NewFace creates a font.Face from an OpenType font with specified options
func NewFace(f *Font, opts *FaceOptions) (font.Face, error)
```

### OpenType Example

```go
import (
    "io/ioutil"
    "golang.org/x/image/font"
    "golang.org/x/image/font/opentype"
)

// Load and parse TrueType font file
func loadFont(filename string) (font.Face, error) {
    // Read font file
    fontData, err := ioutil.ReadFile(filename)
    if err != nil {
        return nil, err
    }

    // Parse OpenType/TrueType font
    f, err := opentype.Parse(fontData)
    if err != nil {
        return nil, err
    }

    // Create face at specific size
    face, err := opentype.NewFace(f, &opentype.FaceOptions{
        Size:    12,
        DPI:     72,
        Hinting: font.HintingFull,
    })
    if err != nil {
        return nil, err
    }

    return face, nil
}

// Load from font collection
func loadFromCollection(filename string, index int) (font.Face, error) {
    fontData, err := ioutil.ReadFile(filename)
    if err != nil {
        return nil, err
    }

    coll, err := opentype.ParseCollection(fontData)
    if err != nil {
        return nil, err
    }

    // Get specific font from collection
    f, err := coll.Font(index)
    if err != nil {
        return nil, err
    }

    return opentype.NewFace(f, &opentype.FaceOptions{
        Size: 12,
        DPI:  72,
    })
}
```

## Low-Level SFNT Font Parsing

The `sfnt` package provides low-level access to SFNT (TrueType/OpenType) font tables and glyph data. This is typically used internally by the `opentype` package but can be used directly for advanced font manipulation.

### Import

```go { .api }
import "golang.org/x/image/font/sfnt"
```

### Core Types

```go { .api }
// Font represents an SFNT font
type Font struct { /* opaque */ }

// Collection represents a collection of fonts (.ttc file)
type Collection struct { /* opaque */ }

// GlyphIndex identifies a glyph within a font
type GlyphIndex uint16

// NameID identifies entries in the name table
type NameID uint16

// Units represents font design units
type Units int32

// Buffer is a reusable scratch buffer for loading glyphs
type Buffer struct { /* opaque */ }
```

### Parsing Functions

```go { .api }
// Parse parses an SFNT font from binary data
func Parse(src []byte) (*Font, error)

// ParseReaderAt parses an SFNT font from an io.ReaderAt
func ParseReaderAt(src io.ReaderAt) (*Font, error)

// ParseCollection parses an SFNT font collection (.ttc file)
func ParseCollection(src []byte) (*Collection, error)

// ParseCollectionReaderAt parses an SFNT font collection from an io.ReaderAt
func ParseCollectionReaderAt(src io.ReaderAt) (*Collection, error)
```

### Font Methods

```go { .api }
// Load parses SFNT font data
func (f *Font) Load(b []byte) error

// NumGlyphs returns the number of glyphs in the font
func (f *Font) NumGlyphs() int

// UnitsPerEm returns the units per em value
func (f *Font) UnitsPerEm() Units

// GlyphIndex returns the glyph index for a rune
func (f *Font) GlyphIndex(b *Buffer, r rune) (GlyphIndex, error)

// LoadGlyph loads glyph outline data into the buffer
func (f *Font) LoadGlyph(b *Buffer, x GlyphIndex, opts *LoadGlyphOptions) error

// Bounds returns the bounding box for a glyph at a given size
func (f *Font) Bounds(b *Buffer, x GlyphIndex, ppem fixed.Int26_6) (fixed.Rectangle26_6, error)

// Kern returns kerning adjustment between two glyphs
func (f *Font) Kern(b *Buffer, x0, x1 GlyphIndex, ppem fixed.Int26_6) (fixed.Int26_6, error)

// Name returns a string from the name table
func (f *Font) Name(b *Buffer, id NameID) (string, error)
```

### Name Table IDs

```go { .api }
const (
    NameIDCopyright              NameID = 0   // Copyright notice
    NameIDFamily                 NameID = 1   // Font family name
    NameIDSubfamily              NameID = 2   // Font subfamily (style) name
    NameIDUniqueIdentifier       NameID = 3   // Unique font identifier
    NameIDFull                   NameID = 4   // Full font name
    NameIDVersion                NameID = 5   // Version string
    NameIDPostScript             NameID = 6   // PostScript name
    NameIDTrademark              NameID = 7   // Trademark notice
    NameIDManufacturer           NameID = 8   // Manufacturer name
    NameIDDesigner               NameID = 9   // Designer name
    NameIDDescription            NameID = 10  // Description
    NameIDVendorURL              NameID = 11  // Vendor URL
    NameIDDesignerURL            NameID = 12  // Designer URL
    NameIDLicense                NameID = 13  // License description
    NameIDLicenseURL             NameID = 14  // License URL
    NameIDTypographicFamily      NameID = 16  // Typographic family name
    NameIDTypographicSubfamily   NameID = 17  // Typographic subfamily name
    NameIDCompatibleFull         NameID = 18  // Compatible full name (Mac only)
    NameIDSampleText             NameID = 19  // Sample text
    NameIDPostScriptCID          NameID = 20  // PostScript CID name
    NameIDWWSFamily              NameID = 21  // WWS family name
    NameIDWWSSubfamily           NameID = 22  // WWS subfamily name
    NameIDLightBackgroundPalette NameID = 23  // Light background palette
    NameIDDarkBackgroundPalette  NameID = 24  // Dark background palette
    NameIDVariationsPostScript   NameID = 25  // Variations PostScript name prefix
)
```

### Glyph Vector Data

```go { .api }
// Segment represents a path segment in a glyph outline
type Segment struct {
    Op   SegmentOp          // Operation type
    Args [6]fixed.Int26_6   // Arguments (usage depends on Op)
}

// SegmentOp defines the type of path operation
type SegmentOp uint32

const (
    SegmentOpMoveTo SegmentOp = 0  // Move to point (Args[0], Args[1])
    SegmentOpLineTo SegmentOp = 1  // Line to point (Args[0], Args[1])
    SegmentOpQuadTo SegmentOp = 2  // Quadratic Bézier to (Args[2], Args[3]) via (Args[0], Args[1])
    SegmentOpCubeTo SegmentOp = 3  // Cubic Bézier to (Args[4], Args[5]) via (Args[0], Args[1]) and (Args[2], Args[3])
)

// Segments is a slice of path segments
type Segments []Segment

// Bounds returns the bounding box of the segments
func (s Segments) Bounds() fixed.Rectangle26_6
```

### SFNT Example

```go
import (
    "golang.org/x/image/font/sfnt"
    "golang.org/x/image/math/fixed"
)

// Extract font metadata
func getFontInfo(fontData []byte) (string, string, error) {
    var font sfnt.Font
    if err := font.Load(fontData); err != nil {
        return "", "", err
    }

    var buf sfnt.Buffer

    // Get font family name
    family, err := font.Name(&buf, sfnt.NameIDFamily)
    if err != nil {
        return "", "", err
    }

    // Get font version
    version, err := font.Name(&buf, sfnt.NameIDVersion)
    if err != nil {
        return "", "", err
    }

    return family, version, nil
}

// Get glyph outline
func getGlyphOutline(font *sfnt.Font, r rune, ppem fixed.Int26_6) (sfnt.Segments, error) {
    var buf sfnt.Buffer

    // Map rune to glyph index
    glyphIndex, err := font.GlyphIndex(&buf, r)
    if err != nil {
        return nil, err
    }

    // Load glyph outline
    err = font.LoadGlyph(&buf, glyphIndex, &sfnt.LoadGlyphOptions{
        GlyphIndex: glyphIndex,
        Scale:      ppem,
    })
    if err != nil {
        return nil, err
    }

    // Get segments from buffer
    segments, err := buf.Segments()
    return segments, err
}
```

## Bitmap Fonts

The `basicfont` package provides fixed-size bitmap fonts.

### Import

```go { .api }
import "golang.org/x/image/font/basicfont"
```

### Basic Font Face

```go { .api }
// Face represents a basic bitmap font face
type Face struct {
    Advance int          // Fixed advance width for all glyphs
    Width   int          // Glyph width in pixels
    Height  int          // Glyph height in pixels
    Ascent  int          // Baseline to top distance in pixels
    Descent int          // Baseline to bottom distance in pixels
    Mask    *image.Alpha // Glyph bitmap atlas
    Ranges  []Range      // Rune range mappings
}

// Range maps a range of runes to positions in the glyph atlas
type Range struct {
    Low    rune  // First rune in range (inclusive)
    High   rune  // Last rune in range (inclusive)
    Offset int   // Byte offset into Mask image
}
```

### Pre-rendered Fonts

```go { .api }
// Face7x13 is a 7x13 pixel fixed-width font (from X11 misc-fixed fonts)
var Face7x13 *Face
```

### Bitmap Font Example

```go
import (
    "image"
    "image/color"
    "golang.org/x/image/font"
    "golang.org/x/image/font/basicfont"
    "golang.org/x/image/math/fixed"
)

func drawWithBitmapFont(dst *image.RGBA, text string, x, y int) {
    d := &font.Drawer{
        Dst:  dst,
        Src:  image.NewUniform(color.Black),
        Face: basicfont.Face7x13,
        Dot:  fixed.P(x, y),
    }
    d.DrawString(text)
}
```

## Embedded Go Fonts

The `gofont` package family provides embedded TrueType fonts in various styles. Each font is provided as a separate subpackage with the font data embedded as a byte slice.

### Available Fonts

```go { .api }
import (
    "golang.org/x/image/font/gofont/goregular"
    "golang.org/x/image/font/gofont/gobold"
    "golang.org/x/image/font/gofont/goitalic"
    "golang.org/x/image/font/gofont/gobolditalic"
    "golang.org/x/image/font/gofont/gomedium"
    "golang.org/x/image/font/gofont/gomediumitalic"
    "golang.org/x/image/font/gofont/gomono"
    "golang.org/x/image/font/gofont/gomonobold"
    "golang.org/x/image/font/gofont/gomonoitalic"
    "golang.org/x/image/font/gofont/gomonobolditalic"
    "golang.org/x/image/font/gofont/gosmallcaps"
    "golang.org/x/image/font/gofont/gosmallcapsitalic"
)

// Each package exports a TTF variable containing the font data
var TTF []byte
```

### Using Go Fonts

```go
import (
    "golang.org/x/image/font"
    "golang.org/x/image/font/opentype"
    "golang.org/x/image/font/gofont/goregular"
)

func createGoFontFace() (font.Face, error) {
    // Parse the embedded TTF data
    f, err := opentype.Parse(goregular.TTF)
    if err != nil {
        return nil, err
    }

    // Create face at desired size
    return opentype.NewFace(f, &opentype.FaceOptions{
        Size:    12,
        DPI:     72,
        Hinting: font.HintingFull,
    })
}
```

## Inconsolata Fonts

The `inconsolata` package provides embedded Inconsolata monospace bitmap fonts.

### Import

```go { .api }
import "golang.org/x/image/font/inconsolata"
```

### Available Fonts

```go { .api }
// Regular8x16 is an 8x16 pixel Inconsolata Regular bitmap font
var Regular8x16 *basicfont.Face

// Bold8x16 is an 8x16 pixel Inconsolata Bold bitmap font
var Bold8x16 *basicfont.Face
```

### Inconsolata Example

```go
import (
    "image"
    "image/color"
    "golang.org/x/image/font"
    "golang.org/x/image/font/inconsolata"
    "golang.org/x/image/math/fixed"
)

func drawMonospace(dst *image.RGBA, text string, x, y int, bold bool) {
    face := inconsolata.Regular8x16
    if bold {
        face = inconsolata.Bold8x16
    }

    d := &font.Drawer{
        Dst:  dst,
        Src:  image.NewUniform(color.White),
        Face: face,
        Dot:  fixed.P(x, y),
    }
    d.DrawString(text)
}
```

## Plan 9 Fonts

The `plan9font` package provides support for Plan 9 bitmap font format.

### Import

```go { .api }
import "golang.org/x/image/font/plan9font"
```

### Parsing Plan 9 Fonts

```go { .api }
// ParseFont parses a Plan 9 font file
// readFile is called to load referenced subfont files
func ParseFont(data []byte, readFile func(relFilename string) ([]byte, error)) (font.Face, error)

// ParseSubfont parses a Plan 9 subfont file
// firstRune specifies the first rune code in the subfont
func ParseSubfont(data []byte, firstRune rune) (font.Face, error)
```

### Plan 9 Font Example

```go
import (
    "io/ioutil"
    "path/filepath"
    "golang.org/x/image/font"
    "golang.org/x/image/font/plan9font"
)

func loadPlan9Font(fontFile string) (font.Face, error) {
    // Read main font file
    data, err := ioutil.ReadFile(fontFile)
    if err != nil {
        return nil, err
    }

    // Create readFile callback for loading subfonts
    fontDir := filepath.Dir(fontFile)
    readFile := func(relFilename string) ([]byte, error) {
        subfontPath := filepath.Join(fontDir, relFilename)
        return ioutil.ReadFile(subfontPath)
    }

    // Parse Plan 9 font
    return plan9font.ParseFont(data, readFile)
}

// Load standalone subfont
func loadPlan9Subfont(subfontFile string, firstRune rune) (font.Face, error) {
    data, err := ioutil.ReadFile(subfontFile)
    if err != nil {
        return nil, err
    }

    return plan9font.ParseSubfont(data, firstRune)
}
```

## Font Selection Guide

Choose the appropriate font implementation based on your needs:

| Font Type | Package | Use Case | Pros | Cons |
|-----------|---------|----------|------|------|
| OpenType/TrueType | `opentype` | Professional typography, scalable text | High quality, scalable, kerning support | Larger file size, slower |
| Bitmap (basicfont) | `basicfont` | Simple fixed-size text, terminals | Very fast, minimal memory | Fixed size, limited glyphs |
| Go Fonts | `gofont/*` | Embedded fonts without external files | No external dependencies, good quality | Increases binary size |
| Inconsolata | `inconsolata` | Monospace code display | Good for code, embedded | Fixed size, bitmap only |
| Plan 9 | `plan9font` | Legacy Plan 9 systems | Lightweight bitmap format | Obscure format, limited use |

## Performance Considerations

**OpenType/TrueType Rendering**:
- Glyph rendering is cached internally
- Use `HintingFull` for small text on low-DPI displays
- Use `HintingNone` for large text or high-DPI displays

**Bitmap Fonts**:
- Fastest rendering
- No scaling overhead
- Best for fixed-size text (terminals, fixed UI elements)

**Embedded Fonts**:
- Include only needed font styles to minimize binary size
- Consider bitmap fonts for simple, fixed-size text
- Use TrueType fonts when scalability is required
