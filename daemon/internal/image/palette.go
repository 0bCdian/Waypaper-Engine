package image

import (
	"fmt"
	"image"
	_ "image/gif"
	_ "image/jpeg"
	_ "image/png"
	"math"
	"math/rand"
	"os"
	"sort"

	"golang.org/x/image/draw"
	_ "golang.org/x/image/webp"
)

const (
	defaultNumColors = 5
	sampleSize       = 64
	maxIterations    = 20
	convergenceEps   = 1.0
)

// ExtractPalette extracts the dominant colors from an image file using k-means
// clustering in CIELAB color space. Returns hex color strings (e.g. "#ab12cd").
func ExtractPalette(imagePath string, numColors int) ([]string, error) {
	if numColors <= 0 {
		numColors = defaultNumColors
	}

	f, err := os.Open(imagePath)
	if err != nil {
		return nil, fmt.Errorf("palette: open: %w", err)
	}
	defer f.Close()

	src, _, err := image.Decode(f)
	if err != nil {
		return nil, fmt.Errorf("palette: decode: %w", err)
	}

	sampled := downsample(src, sampleSize)
	pixels := extractPixels(sampled)
	if len(pixels) == 0 {
		return nil, fmt.Errorf("palette: no pixels extracted")
	}

	labs := make([]labColor, len(pixels))
	for i, p := range pixels {
		labs[i] = rgbToLab(p)
	}

	centroids := kmeansLab(labs, numColors, maxIterations, convergenceEps)

	type centroidWithCount struct {
		lab   labColor
		count int
	}
	counts := make([]centroidWithCount, len(centroids))
	for i, c := range centroids {
		counts[i] = centroidWithCount{lab: c, count: 0}
	}
	for _, l := range labs {
		nearest := 0
		bestDist := math.MaxFloat64
		for ci, c := range centroids {
			d := labDistance(l, c)
			if d < bestDist {
				bestDist = d
				nearest = ci
			}
		}
		counts[nearest].count++
	}
	sort.Slice(counts, func(i, j int) bool {
		return counts[i].count > counts[j].count
	})

	hexColors := make([]string, len(counts))
	for i, cc := range counts {
		r, g, b := labToRGB(cc.lab)
		hexColors[i] = fmt.Sprintf("#%02x%02x%02x", r, g, b)
	}

	return hexColors, nil
}

func downsample(src image.Image, size int) image.Image {
	bounds := src.Bounds()
	w, h := bounds.Dx(), bounds.Dy()
	if w <= size && h <= size {
		return src
	}

	newW, newH := size, size
	if w > h {
		newH = int(float64(h) / float64(w) * float64(size))
		if newH < 1 {
			newH = 1
		}
	} else {
		newW = int(float64(w) / float64(h) * float64(size))
		if newW < 1 {
			newW = 1
		}
	}

	dst := image.NewRGBA(image.Rect(0, 0, newW, newH))
	draw.BiLinear.Scale(dst, dst.Bounds(), src, bounds, draw.Over, nil)
	return dst
}

type rgbPixel struct {
	r, g, b uint8
}

func extractPixels(img image.Image) []rgbPixel {
	bounds := img.Bounds()
	pixels := make([]rgbPixel, 0, bounds.Dx()*bounds.Dy())

	for y := bounds.Min.Y; y < bounds.Max.Y; y++ {
		for x := bounds.Min.X; x < bounds.Max.X; x++ {
			r, g, b, a := img.At(x, y).RGBA()
			if a < 128<<8 {
				continue
			}
			pixels = append(pixels, rgbPixel{
				r: uint8(r >> 8),
				g: uint8(g >> 8),
				b: uint8(b >> 8),
			})
		}
	}
	return pixels
}

// --- CIELAB color space ---

type labColor struct {
	l, a, b float64
}

func rgbToLab(p rgbPixel) labColor {
	x, y, z := rgbToXYZ(p)
	return xyzToLab(x, y, z)
}

func labToRGB(lab labColor) (uint8, uint8, uint8) {
	x, y, z := labToXYZ(lab)
	return xyzToRGB(x, y, z)
}

func rgbToXYZ(p rgbPixel) (float64, float64, float64) {
	r := linearize(float64(p.r) / 255.0)
	g := linearize(float64(p.g) / 255.0)
	b := linearize(float64(p.b) / 255.0)

	x := r*0.4124564 + g*0.3575761 + b*0.1804375
	y := r*0.2126729 + g*0.7151522 + b*0.0721750
	z := r*0.0193339 + g*0.1191920 + b*0.9503041
	return x, y, z
}

func xyzToLab(x, y, z float64) labColor {
	const (
		xn = 0.950470
		yn = 1.0
		zn = 1.088830
	)
	fx := labF(x / xn)
	fy := labF(y / yn)
	fz := labF(z / zn)

	return labColor{
		l: 116.0*fy - 16.0,
		a: 500.0 * (fx - fy),
		b: 200.0 * (fy - fz),
	}
}

func labToXYZ(lab labColor) (float64, float64, float64) {
	const (
		xn = 0.950470
		yn = 1.0
		zn = 1.088830
	)
	fy := (lab.l + 16.0) / 116.0
	fx := lab.a/500.0 + fy
	fz := fy - lab.b/200.0

	x := xn * labFInv(fx)
	y := yn * labFInv(fy)
	z := zn * labFInv(fz)
	return x, y, z
}

func xyzToRGB(x, y, z float64) (uint8, uint8, uint8) {
	r := x*3.2404542 + y*-1.5371385 + z*-0.4985314
	g := x*-0.9692660 + y*1.8760108 + z*0.0415560
	b := x*0.0556434 + y*-0.2040259 + z*1.0572252

	return gammaCorrect(r), gammaCorrect(g), gammaCorrect(b)
}

func linearize(v float64) float64 {
	if v <= 0.04045 {
		return v / 12.92
	}
	return math.Pow((v+0.055)/1.055, 2.4)
}

func gammaCorrect(v float64) uint8 {
	if v <= 0.0031308 {
		v = 12.92 * v
	} else {
		v = 1.055*math.Pow(v, 1.0/2.4) - 0.055
	}
	c := int(math.Round(v * 255))
	if c < 0 {
		c = 0
	}
	if c > 255 {
		c = 255
	}
	return uint8(c)
}

func labF(t float64) float64 {
	const delta = 6.0 / 29.0
	if t > delta*delta*delta {
		return math.Cbrt(t)
	}
	return t/(3*delta*delta) + 4.0/29.0
}

func labFInv(t float64) float64 {
	const delta = 6.0 / 29.0
	if t > delta {
		return t * t * t
	}
	return 3 * delta * delta * (t - 4.0/29.0)
}

func labDistance(a, b labColor) float64 {
	dl := a.l - b.l
	da := a.a - b.a
	db := a.b - b.b
	return dl*dl + da*da + db*db
}

// --- k-means clustering ---

func kmeansLab(points []labColor, k, maxIter int, eps float64) []labColor {
	if k > len(points) {
		k = len(points)
	}

	centroids := make([]labColor, k)
	perm := rand.Perm(len(points))
	for i := 0; i < k; i++ {
		centroids[i] = points[perm[i]]
	}

	assignments := make([]int, len(points))

	for iter := 0; iter < maxIter; iter++ {
		for i, p := range points {
			nearest := 0
			bestDist := math.MaxFloat64
			for ci, c := range centroids {
				d := labDistance(p, c)
				if d < bestDist {
					bestDist = d
					nearest = ci
				}
			}
			assignments[i] = nearest
		}

		newCentroids := make([]labColor, k)
		counts := make([]int, k)

		for i, p := range points {
			ci := assignments[i]
			newCentroids[ci].l += p.l
			newCentroids[ci].a += p.a
			newCentroids[ci].b += p.b
			counts[ci]++
		}

		maxShift := 0.0
		for ci := range newCentroids {
			if counts[ci] > 0 {
				n := float64(counts[ci])
				newCentroids[ci].l /= n
				newCentroids[ci].a /= n
				newCentroids[ci].b /= n
			} else {
				newCentroids[ci] = centroids[ci]
			}
			shift := labDistance(centroids[ci], newCentroids[ci])
			if shift > maxShift {
				maxShift = shift
			}
		}

		centroids = newCentroids
		if maxShift < eps {
			break
		}
	}

	return centroids
}
