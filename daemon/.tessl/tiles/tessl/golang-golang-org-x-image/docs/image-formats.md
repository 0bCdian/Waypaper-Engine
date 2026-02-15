# Image Formats

The golang.org/x/image module provides support for additional image formats beyond the standard library, including BMP (Windows Bitmap), TIFF with multiple compression options, and WebP (both lossy and lossless). Each format includes decoders and (where applicable) encoders that work with Go's standard image interfaces.

## BMP (Windows Bitmap)

The `bmp` package provides encoding and decoding of Windows Bitmap images.

### Import

```go { .api }
import "golang.org/x/image/bmp"
```

### BMP Errors

```go { .api }
// ErrUnsupported is returned when a BMP image uses an unsupported feature
var ErrUnsupported error
```

### Decoding BMP Images

```go { .api }
// Decode reads a BMP image from r and returns an image.Image
func Decode(r io.Reader) (image.Image, error)

// DecodeConfig returns the color model and dimensions of a BMP image without decoding the entire image
func DecodeConfig(r io.Reader) (image.Config, error)
```

**Supported reading formats**:
- 1, 4, 8, 24, and 32 bits per pixel
- Uncompressed only

**Example**:
```go
f, err := os.Open("image.bmp")
if err != nil {
    return err
}
defer f.Close()

img, err := bmp.Decode(f)
if err != nil {
    return err
}
```

### Encoding BMP Images

```go { .api }
// Encode writes the image m to w in BMP format
func Encode(w io.Writer, m image.Image) error
```

**Encoding format**:
- 24-bit RGB only
- Uncompressed

**Example**:
```go
f, err := os.Create("output.bmp")
if err != nil {
    return err
}
defer f.Close()

err = bmp.Encode(f, img)
```

## TIFF (Tagged Image File Format)

The `tiff` package provides encoding and decoding of TIFF images with support for multiple compression formats.

### Import

```go { .api }
import "golang.org/x/image/tiff"
```

### Decoding TIFF Images

```go { .api }
// Decode reads a TIFF image from r and returns an image.Image
func Decode(r io.Reader) (image.Image, error)

// DecodeConfig returns the color model and dimensions of a TIFF image without decoding the entire image
func DecodeConfig(r io.Reader) (image.Config, error)
```

**Supported reading features**:
- Compression: None, LZW, Deflate, PackBits, CCITT Group 3, CCITT Group 4
- Color modes: Grayscale, paletted, RGB, RGBA, NRGBA
- Bits per sample: 1, 8, and 16
- Organization: Strips and tiles
- Byte order: Little-endian and big-endian

**Example**:
```go
f, err := os.Open("image.tif")
if err != nil {
    return err
}
defer f.Close()

img, err := tiff.Decode(f)
if err != nil {
    return err
}
```

### Encoding TIFF Images

```go { .api }
// Encode writes the image m to w in TIFF format
// The opt parameter specifies encoding options; a nil *Options uses default settings
func Encode(w io.Writer, m image.Image, opt *Options) error
```

**Encoding Options**:
```go { .api }
type Options struct {
    Compression CompressionType // Compression method (default: Uncompressed)
    Predictor   bool            // Use differencing predictor to improve compression (default: false)
}

type CompressionType int

const (
    Uncompressed  CompressionType = 1  // No compression
    Deflate       CompressionType = 2  // zlib/Deflate compression
    LZW           CompressionType = 3  // LZW compression
    CCITTGroup3   CompressionType = 4  // CCITT T.4 (Group 3) fax compression
    CCITTGroup4   CompressionType = 5  // CCITT T.6 (Group 4) fax compression
)
```

**Encoding features**:
- Compression: Uncompressed and Deflate
- Byte order: Little-endian only

**Example**:
```go
f, err := os.Create("output.tif")
if err != nil {
    return err
}
defer f.Close()

opts := &tiff.Options{
    Compression: tiff.Deflate,
    Predictor:   true,
}

err = tiff.Encode(f, img, opts)
```

### TIFF Errors

```go { .api }
// FormatError reports that the input is not a valid TIFF image
type FormatError string

func (e FormatError) Error() string

// UnsupportedError reports that the input uses a feature not currently supported
type UnsupportedError string

func (e UnsupportedError) Error() string
```

### TIFF LZW Compression

The `tiff/lzw` package provides TIFF-specific LZW decompression. This differs from `compress/lzw` by an "off by one" error in the TIFF specification.

```go { .api }
import "golang.org/x/image/tiff/lzw"

type Order int

const (
    LSB Order = 0  // Least significant bit first
    MSB Order = 1  // Most significant bit first
)

// NewReader returns a new LZW decompressor that reads from r
// order specifies the bit ordering, litWidth is the literal code width in bits (typically 8)
func NewReader(r io.Reader, order Order, litWidth int) io.ReadCloser
```

## WebP

The `webp` package provides decoding of WebP images, supporting both lossy (VP8) and lossless (VP8L) compression, with optional alpha channel.

### Import

```go { .api }
import "golang.org/x/image/webp"
```

### Decoding WebP Images

```go { .api }
// Decode reads a WebP image from r and returns an image.Image
func Decode(r io.Reader) (image.Image, error)

// DecodeConfig returns the color model and dimensions of a WebP image without decoding the entire image
func DecodeConfig(r io.Reader) (image.Config, error)
```

**Supported features**:
- Lossy WebP (VP8 codec)
- Lossless WebP (VP8L codec)
- Alpha channel (ALPH chunk)
- Extended format (VP8X chunk)

**Return types**:
- `*image.YCbCr` - Lossy without alpha
- `*image.NYCbCrA` - Lossy with alpha
- `*image.NRGBA` - Lossless

**Example**:
```go
f, err := os.Open("image.webp")
if err != nil {
    return err
}
defer f.Close()

img, err := webp.Decode(f)
if err != nil {
    return err
}

// Check actual image type
switch v := img.(type) {
case *image.YCbCr:
    // Lossy without alpha
case *image.NYCbCrA:
    // Lossy with alpha
case *image.NRGBA:
    // Lossless
}
```

### WebP Codec Details

WebP decoding relies on two underlying codecs:

#### VP8 (Lossy Codec)

The `vp8` package provides the VP8 video codec decoder used for lossy WebP images.

```go { .api }
import "golang.org/x/image/vp8"

type Decoder struct { /* opaque */ }

func NewDecoder() *Decoder

// Init initializes the decoder to read from r
// n is the number of bytes to read from r
func (d *Decoder) Init(r io.Reader, n int)

// DecodeFrameHeader decodes the VP8 frame header
func (d *Decoder) DecodeFrameHeader() (FrameHeader, error)

// DecodeFrame decodes the frame to a YCbCr image
func (d *Decoder) DecodeFrame() (*image.YCbCr, error)

type FrameHeader struct {
    KeyFrame          bool   // True if this is a keyframe
    VersionNumber     uint8  // VP8 version number
    ShowFrame         bool   // True if frame should be displayed
    FirstPartitionLen uint32 // Length of first data partition
    Width             int    // Frame width in pixels
    Height            int    // Frame height in pixels
    XScale            uint8  // Horizontal scaling factor
    YScale            uint8  // Vertical scaling factor
}
```

#### VP8L (Lossless Codec)

The `vp8l` package provides the VP8L codec decoder used for lossless WebP images.

```go { .api }
import "golang.org/x/image/vp8l"

// Decode reads a VP8L lossless image from r and returns an NRGBA image
func Decode(r io.Reader) (image.Image, error)

// DecodeConfig returns the color model and dimensions of a VP8L image
func DecodeConfig(r io.Reader) (image.Config, error)
```

## CCITT Fax Compression

The `ccitt` package implements CCITT Group 3 and Group 4 fax image compression, commonly used in TIFF and PDF files.

### Import

```go { .api }
import "golang.org/x/image/ccitt"
```

### CCITT Decoder

```go { .api }
// NewReader returns an io.Reader that decodes CCITT-compressed data from r
func NewReader(r io.Reader, order Order, sf SubFormat, width int, height int, opts *Options) io.Reader

// DecodeIntoGray decodes CCITT-compressed data from r directly into dst
func DecodeIntoGray(dst *image.Gray, r io.Reader, order Order, sf SubFormat, opts *Options) error
```

### CCITT Types

```go { .api }
type Order int

const (
    LSB Order = 0  // Least significant bit first
    MSB Order = 1  // Most significant bit first
)

type SubFormat int

const (
    Group3 SubFormat = 0  // CCITT T.4 (Group 3) compression
    Group4 SubFormat = 1  // CCITT T.6 (Group 4) compression
)

const AutoDetectHeight = -1  // Special height value for auto-detection

type Options struct {
    Invert bool  // Invert black and white pixels
    Align  bool  // Align each row to a byte boundary
}
```

### CCITT Example

```go
import (
    "image"
    "golang.org/x/image/ccitt"
)

// Decode CCITT Group 4 compressed data
width, height := 1728, 2200  // Typical fax page dimensions
reader := ccitt.NewReader(compressedData, ccitt.MSB, ccitt.Group4, width, height, nil)

// Read decompressed data
img := image.NewGray(image.Rect(0, 0, width, height))
err := ccitt.DecodeIntoGray(img, compressedData, ccitt.MSB, ccitt.Group4, nil)
```

## RIFF File Format

The `riff` package parses Resource Interchange File Format (RIFF) containers, used by WebP, AVI, and WAVE files.

### Import

```go { .api }
import "golang.org/x/image/riff"
```

### RIFF Parser

```go { .api }
// FourCC is a four-character code that identifies chunk types
type FourCC [4]byte

var LIST FourCC = FourCC{'L', 'I', 'S', 'T'}  // The "LIST" four-character code

// NewReader returns a Reader that reads RIFF chunks from r
// The returned formType identifies the RIFF form type (e.g., "WEBP")
func NewReader(r io.Reader) (formType FourCC, data *Reader, err error)

// NewListReader returns a Reader for a LIST chunk
func NewListReader(chunkLen uint32, chunkData io.Reader) (listType FourCC, data *Reader, err error)

type Reader struct { /* opaque */ }

// Next returns the next chunk's ID, length, and data reader
func (r *Reader) Next() (chunkID FourCC, chunkLen uint32, chunkData io.Reader, err error)
```

### RIFF Example

```go
import (
    "io"
    "golang.org/x/image/riff"
)

// Parse RIFF file
formType, riffReader, err := riff.NewReader(file)
if err != nil {
    return err
}

// Iterate through chunks
for {
    chunkID, chunkLen, chunkData, err := riffReader.Next()
    if err == io.EOF {
        break
    }
    if err != nil {
        return err
    }

    // Process chunk based on chunkID
    switch chunkID {
    case riff.FourCC{'V', 'P', '8', ' '}:
        // Process VP8 lossy image data
    case riff.FourCC{'V', 'P', '8', 'L'}:
        // Process VP8L lossless image data
    }
}
```
