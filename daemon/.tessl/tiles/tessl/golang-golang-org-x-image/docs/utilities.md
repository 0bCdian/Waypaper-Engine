# Utilities

The golang.org/x/image module provides several utility packages for color manipulation, file format parsing, and compression.

## Color Names

The `colornames` package provides a mapping of SVG 1.1 color names to RGBA values.

### Import

```go { .api }
import "golang.org/x/image/colornames"
```

### Color Variables

```go { .api }
// Map contains 147 named colors from the SVG 1.1 specification
var Map map[string]color.RGBA

// Names contains an ordered list of all color names
var Names []string
```

The package also exports individual color variables for each SVG 1.1 named color:

```go { .api }
// Individual color variables (147 total)
var (
    Aliceblue, Antiquewhite, Aqua, Aquamarine, Azure color.RGBA
    Beige, Bisque, Black, Blanchedalmond, Blue, Blueviolet, Brown, Burlywood color.RGBA
    Cadetblue, Chartreuse, Chocolate, Coral, Cornflowerblue, Cornsilk, Crimson, Cyan color.RGBA
    Darkblue, Darkcyan, Darkgoldenrod, Darkgray, Darkgreen, Darkgrey, Darkkhaki, Darkmagenta color.RGBA
    Darkolivegreen, Darkorange, Darkorchid, Darkred, Darksalmon, Darkseagreen color.RGBA
    Darkslateblue, Darkslategray, Darkslategrey, Darkturquoise, Darkviolet color.RGBA
    Deeppink, Deepskyblue, Dimgray, Dimgrey, Dodgerblue color.RGBA
    Firebrick, Floralwhite, Forestgreen, Fuchsia color.RGBA
    Gainsboro, Ghostwhite, Gold, Goldenrod, Gray, Green, Greenyellow, Grey color.RGBA
    Honeydew, Hotpink color.RGBA
    Indianred, Indigo, Ivory color.RGBA
    Khaki color.RGBA
    Lavender, Lavenderblush, Lawngreen, Lemonchiffon color.RGBA
    Lightblue, Lightcoral, Lightcyan, Lightgoldenrodyellow, Lightgray, Lightgreen color.RGBA
    Lightgrey, Lightpink, Lightsalmon, Lightseagreen, Lightskyblue color.RGBA
    Lightslategray, Lightslategrey, Lightsteelblue, Lightyellow color.RGBA
    Lime, Limegreen, Linen color.RGBA
    Magenta, Maroon, Mediumaquamarine, Mediumblue, Mediumorchid, Mediumpurple color.RGBA
    Mediumseagreen, Mediumslateblue, Mediumspringgreen, Mediumturquoise color.RGBA
    Mediumvioletred, Midnightblue, Mintcream, Mistyrose, Moccasin color.RGBA
    Navajowhite, Navy color.RGBA
    Oldlace, Olive, Olivedrab, Orange, Orangered, Orchid color.RGBA
    Palegoldenrod, Palegreen, Paleturquoise, Palevioletred color.RGBA
    Papayawhip, Peachpuff, Peru, Pink, Plum, Powderblue, Purple color.RGBA
    Red, Rosybrown, Royalblue color.RGBA
    Saddlebrown, Salmon, Sandybrown, Seagreen, Seashell, Sienna, Silver, Skyblue color.RGBA
    Slateblue, Slategray, Slategrey, Snow, Springgreen, Steelblue color.RGBA
    Tan, Teal, Thistle, Tomato, Turquoise color.RGBA
    Violet color.RGBA
    Wheat, White, Whitesmoke color.RGBA
    Yellow, Yellowgreen color.RGBA
)
```

### Available Colors

The package includes all standard web colors such as:
- Basic colors: "black", "white", "red", "green", "blue", "yellow", "cyan", "magenta"
- Extended colors: "aliceblue", "antiquewhite", "aqua", "aquamarine", "azure", "beige", "bisque", "blanchedalmond", "blueviolet", "brown", "burlywood"
- Grays: "darkgray", "darkgrey", "dimgray", "dimgrey", "gray", "grey", "lightgray", "lightgrey", "slategray", "slategrey"
- And many more...

### Color Names Example

```go
import (
    "image"
    "image/draw"
    "golang.org/x/image/colornames"
)

// Use named colors
func useNamedColors() {
    // Create image with named color background
    img := image.NewRGBA(image.Rect(0, 0, 100, 100))

    // Fill with cornflowerblue
    blue := colornames.Map["cornflowerblue"]
    draw.Draw(img, img.Bounds(), &image.Uniform{blue}, image.Point{}, draw.Src)

    // Access other colors
    red := colornames.Map["crimson"]
    gold := colornames.Map["gold"]
    lime := colornames.Map["lime"]

    // Set individual pixels
    img.Set(10, 10, red)
    img.Set(20, 20, gold)
    img.Set(30, 30, lime)
}

// Get color by name with fallback
func getColorByName(name string) color.RGBA {
    if c, ok := colornames.Map[name]; ok {
        return c
    }
    // Return default color if name not found
    return color.RGBA{0, 0, 0, 255}  // black
}

// List all available colors
func listColors() []string {
    names := make([]string, 0, len(colornames.Map))
    for name := range colornames.Map {
        names = append(names, name)
    }
    return names
}

// Create color palette from names
func createPalette(names []string) []color.RGBA {
    palette := make([]color.RGBA, len(names))
    for i, name := range names {
        if c, ok := colornames.Map[name]; ok {
            palette[i] = c
        }
    }
    return palette
}
```

## RIFF File Format

The `riff` package provides parsing for Resource Interchange File Format (RIFF) containers, used by WebP, AVI, and WAVE files.

### Import

```go { .api }
import "golang.org/x/image/riff"
```

### RIFF Types

```go { .api }
// FourCC is a four-character code that identifies chunk types
type FourCC [4]byte

// LIST is the standard "LIST" four-character code
var LIST FourCC = FourCC{'L', 'I', 'S', 'T'}

// Reader provides sequential access to RIFF chunks
type Reader struct { /* opaque */ }
```

### RIFF Functions

```go { .api }
// NewReader creates a RIFF file reader
// Returns the form type (e.g., "WEBP", "AVI ", "WAVE") and a chunk reader
func NewReader(r io.Reader) (formType FourCC, data *Reader, err error)

// NewListReader creates a reader for a LIST chunk
// Returns the list type and a reader for nested chunks
func NewListReader(chunkLen uint32, chunkData io.Reader) (listType FourCC, data *Reader, err error)
```

### Reader Methods

```go { .api }
// Next returns the next chunk's ID, length, and data reader
// Returns io.EOF when no more chunks
func (r *Reader) Next() (chunkID FourCC, chunkLen uint32, chunkData io.Reader, err error)
```

### RIFF Examples

```go
import (
    "fmt"
    "io"
    "os"
    "golang.org/x/image/riff"
)

// Parse RIFF file and list chunks
func parseRIFFFile(filename string) error {
    f, err := os.Open(filename)
    if err != nil {
        return err
    }
    defer f.Close()

    // Read RIFF header
    formType, riffReader, err := riff.NewReader(f)
    if err != nil {
        return err
    }

    fmt.Printf("RIFF Form Type: %s\n", formType)

    // Iterate through chunks
    for {
        chunkID, chunkLen, chunkData, err := riffReader.Next()
        if err == io.EOF {
            break
        }
        if err != nil {
            return err
        }

        fmt.Printf("Chunk: %s, Length: %d bytes\n", chunkID, chunkLen)

        // Handle LIST chunks specially
        if chunkID == riff.LIST {
            listType, listReader, err := riff.NewListReader(chunkLen, chunkData)
            if err != nil {
                return err
            }

            fmt.Printf("  LIST Type: %s\n", listType)

            // Iterate through list items
            for {
                subID, subLen, subData, err := listReader.Next()
                if err == io.EOF {
                    break
                }
                if err != nil {
                    return err
                }
                fmt.Printf("    Sub-chunk: %s, Length: %d\n", subID, subLen)

                // Consume subchunk data
                io.Copy(io.Discard, subData)
            }
        } else {
            // Consume chunk data
            io.Copy(io.Discard, chunkData)
        }
    }

    return nil
}

// Parse WebP file structure
func parseWebPStructure(filename string) error {
    f, err := os.Open(filename)
    if err != nil {
        return err
    }
    defer f.Close()

    formType, riffReader, err := riff.NewReader(f)
    if err != nil {
        return err
    }

    // Verify it's a WebP file
    expectedForm := riff.FourCC{'W', 'E', 'B', 'P'}
    if formType != expectedForm {
        return fmt.Errorf("not a WebP file, got form type: %s", formType)
    }

    // Read WebP chunks
    for {
        chunkID, chunkLen, chunkData, err := riffReader.Next()
        if err == io.EOF {
            break
        }
        if err != nil {
            return err
        }

        switch chunkID {
        case riff.FourCC{'V', 'P', '8', ' '}:
            fmt.Println("Found VP8 lossy image data")
        case riff.FourCC{'V', 'P', '8', 'L'}:
            fmt.Println("Found VP8L lossless image data")
        case riff.FourCC{'V', 'P', '8', 'X'}:
            fmt.Println("Found VP8X extended format")
        case riff.FourCC{'A', 'L', 'P', 'H'}:
            fmt.Println("Found ALPH alpha channel data")
        case riff.FourCC{'E', 'X', 'I', 'F'}:
            fmt.Println("Found EXIF metadata")
        case riff.FourCC{'X', 'M', 'P', ' '}:
            fmt.Println("Found XMP metadata")
        }

        // Consume chunk data
        io.Copy(io.Discard, chunkData)
    }

    return nil
}

// Extract specific chunk from RIFF file
func extractChunk(r io.Reader, targetChunkID riff.FourCC) ([]byte, error) {
    formType, riffReader, err := riff.NewReader(r)
    if err != nil {
        return nil, err
    }

    for {
        chunkID, chunkLen, chunkData, err := riffReader.Next()
        if err == io.EOF {
            return nil, fmt.Errorf("chunk not found")
        }
        if err != nil {
            return nil, err
        }

        if chunkID == targetChunkID {
            // Found target chunk, read all data
            data := make([]byte, chunkLen)
            _, err := io.ReadFull(chunkData, data)
            return data, err
        }

        // Skip this chunk
        io.Copy(io.Discard, chunkData)
    }
}
```

### FourCC Utilities

```go
import "golang.org/x/image/riff"

// Create FourCC from string
func makeFourCC(s string) riff.FourCC {
    if len(s) != 4 {
        panic("FourCC must be exactly 4 characters")
    }
    return riff.FourCC{s[0], s[1], s[2], s[3]}
}

// Convert FourCC to string
func fourCCToString(fcc riff.FourCC) string {
    return string(fcc[:])
}

// Compare FourCC values
func compareFourCC(a, b riff.FourCC) bool {
    return a[0] == b[0] && a[1] == b[1] && a[2] == b[2] && a[3] == b[3]
}

// Common FourCC values for WebP
var (
    WebPForm = riff.FourCC{'W', 'E', 'B', 'P'}
    VP8Chunk = riff.FourCC{'V', 'P', '8', ' '}
    VP8LChunk = riff.FourCC{'V', 'P', '8', 'L'}
    VP8XChunk = riff.FourCC{'V', 'P', '8', 'X'}
    ALPHChunk = riff.FourCC{'A', 'L', 'P', 'H'}
)
```

## CCITT Compression

The `ccitt` package implements CCITT Group 3 and Group 4 fax compression, commonly used in TIFF and PDF files for bi-level (black and white) images.

### Import

```go { .api }
import "golang.org/x/image/ccitt"
```

### CCITT Types

```go { .api }
// Order specifies bit ordering
type Order int

const (
    LSB Order = 0  // Least significant bit first
    MSB Order = 1  // Most significant bit first
)

// SubFormat specifies compression format
type SubFormat int

const (
    Group3 SubFormat = 0  // CCITT T.4 (Group 3) compression
    Group4 SubFormat = 1  // CCITT T.6 (Group 4) compression
)

// AutoDetectHeight is a special value for automatic height detection
const AutoDetectHeight = -1

// Options specifies decoding options
type Options struct {
    Invert bool  // Invert black and white pixels
    Align  bool  // Align each row to a byte boundary
}
```

### CCITT Functions

```go { .api }
// NewReader returns an io.Reader that decodes CCITT-compressed data
// width and height specify image dimensions (use AutoDetectHeight for height if unknown)
func NewReader(r io.Reader, order Order, sf SubFormat, width int, height int, opts *Options) io.Reader

// DecodeIntoGray decodes CCITT data directly into a grayscale image
func DecodeIntoGray(dst *image.Gray, r io.Reader, order Order, sf SubFormat, opts *Options) error
```

### CCITT Examples

```go
import (
    "image"
    "io"
    "golang.org/x/image/ccitt"
)

// Decode CCITT Group 4 compressed data
func decodeCCITTGroup4(compressedData io.Reader, width, height int) (*image.Gray, error) {
    // Create destination image
    img := image.NewGray(image.Rect(0, 0, width, height))

    // Decode directly into image
    err := ccitt.DecodeIntoGray(img, compressedData, ccitt.MSB, ccitt.Group4, nil)
    if err != nil {
        return nil, err
    }

    return img, nil
}

// Decode with auto-detect height
func decodeCCITTAutoHeight(compressedData io.Reader, width int) (*image.Gray, error) {
    // Read compressed data
    reader := ccitt.NewReader(compressedData, ccitt.MSB, ccitt.Group4, width, ccitt.AutoDetectHeight, nil)

    // Read decompressed data to determine height
    var rows [][]byte
    rowSize := (width + 7) / 8  // Bytes per row

    for {
        row := make([]byte, rowSize)
        _, err := io.ReadFull(reader, row)
        if err == io.EOF {
            break
        }
        if err != nil {
            return nil, err
        }
        rows = append(rows, row)
    }

    height := len(rows)

    // Create image
    img := image.NewGray(image.Rect(0, 0, width, height))

    // Copy decompressed data to image
    for y, row := range rows {
        for x := 0; x < width; x++ {
            byteIdx := x / 8
            bitIdx := 7 - (x % 8)
            bit := (row[byteIdx] >> bitIdx) & 1

            // CCITT: 1 = white, 0 = black
            if bit == 1 {
                img.SetGray(x, y, color.Gray{255})
            } else {
                img.SetGray(x, y, color.Gray{0})
            }
        }
    }

    return img, nil
}

// Decode Group 3 with options
func decodeCCITTGroup3WithOptions(compressedData io.Reader, width, height int, invert bool) (*image.Gray, error) {
    opts := &ccitt.Options{
        Invert: invert,
        Align:  false,
    }

    img := image.NewGray(image.Rect(0, 0, width, height))
    err := ccitt.DecodeIntoGray(img, compressedData, ccitt.MSB, ccitt.Group3, opts)
    if err != nil {
        return nil, err
    }

    return img, nil
}

// Decode fax page (typical dimensions)
func decodeFaxPage(compressedData io.Reader) (*image.Gray, error) {
    // Standard fax dimensions
    const (
        faxWidth  = 1728  // Standard fax width (8.5" at 204 DPI)
        faxHeight = 2200  // Approximate A4 height (11" at 200 DPI)
    )

    return decodeCCITTGroup4(compressedData, faxWidth, faxHeight)
}
```

### CCITT Format Details

**Group 3 (T.4)**:
- One-dimensional compression (each row compressed independently)
- Optional two-dimensional compression (rows can reference previous row)
- Used in fax transmission
- Error recovery: if one row is corrupted, others may still be readable

**Group 4 (T.6)**:
- Two-dimensional compression only (better compression than Group 3)
- Each row references the previous row
- More efficient but less error tolerant
- Used in document storage

**Bit Ordering**:
- LSB: Least significant bit first (less common)
- MSB: Most significant bit first (more common, standard for TIFF)

**Color Convention**:
- 0 = black pixel
- 1 = white pixel
- Use `Invert` option to flip this

## Common Use Cases

### Creating a Color Picker UI

```go
import (
    "golang.org/x/image/colornames"
    "sort"
)

// Get sorted list of color names
func getSortedColorNames() []string {
    names := make([]string, 0, len(colornames.Map))
    for name := range colornames.Map {
        names = append(names, name)
    }
    sort.Strings(names)
    return names
}

// Get color with name
func getColorSample(name string) (color.RGBA, bool) {
    c, ok := colornames.Map[name]
    return c, ok
}
```

### Processing Scanned Fax Documents

```go
import (
    "image"
    "golang.org/x/image/ccitt"
)

// Process multi-page fax document
func processFaxDocument(pages []io.Reader) ([]*image.Gray, error) {
    results := make([]*image.Gray, len(pages))

    for i, pageData := range pages {
        img, err := decodeFaxPage(pageData)
        if err != nil {
            return nil, err
        }
        results[i] = img
    }

    return results, nil
}
```

### Analyzing WebP File Structure

```go
import (
    "fmt"
    "golang.org/x/image/riff"
)

// Analyze WebP file features
func analyzeWebP(r io.Reader) (map[string]bool, error) {
    features := make(map[string]bool)

    formType, riffReader, err := riff.NewReader(r)
    if err != nil {
        return nil, err
    }

    if formType != riff.FourCC{'W', 'E', 'B', 'P'} {
        return nil, fmt.Errorf("not a WebP file")
    }

    for {
        chunkID, _, chunkData, err := riffReader.Next()
        if err == io.EOF {
            break
        }
        if err != nil {
            return nil, err
        }

        switch chunkID {
        case riff.FourCC{'V', 'P', '8', ' '}:
            features["lossy"] = true
        case riff.FourCC{'V', 'P', '8', 'L'}:
            features["lossless"] = true
        case riff.FourCC{'V', 'P', '8', 'X'}:
            features["extended"] = true
        case riff.FourCC{'A', 'L', 'P', 'H'}:
            features["alpha"] = true
        case riff.FourCC{'E', 'X', 'I', 'F'}:
            features["exif"] = true
        case riff.FourCC{'X', 'M', 'P', ' '}:
            features["xmp"] = true
        case riff.FourCC{'I', 'C', 'C', 'P'}:
            features["icc_profile"] = true
        }

        io.Copy(io.Discard, chunkData)
    }

    return features, nil
}
```

## Performance Considerations

**Color Names**:
- Map lookup is O(1)
- Map is pre-built at package initialization
- Consider caching frequently used colors

**RIFF Parsing**:
- Sequential access only (no random seeking)
- Memory efficient (streams chunk data)
- Consider buffering input for better performance

**CCITT Decompression**:
- Memory efficient (streaming decompression)
- Group 4 generally faster than Group 3
- Use `DecodeIntoGray` for best performance (avoids intermediate buffers)
