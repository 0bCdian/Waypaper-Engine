package image

import (
	"context"
	"fmt"
	"math"
	"strings"
	"sync"

	"golang.org/x/sync/errgroup"
)

const (
	// videoPaletteFrameCount — evenly spaced timestamps; each frame is decoded at high resolution (see videoPaletteLongEdgeCap).
	videoPaletteFrameCount = 12
	// maxVideoPalettePixels caps pooled RGB samples before LAB k-means (after stacking hi-res frames).
	maxVideoPalettePixels   = 40000
	videoPaletteParallelism = 6
)

func videoPaletteLongEdgeCap(width, height int) int {
	long := width
	if height > long {
		long = height
	}
	if long <= 0 {
		return sampleSize
	}
	const hardCap = 2160 // avoid decoding full 4K+ into RAM when probing modest caps still yields huge buffers
	if long > hardCap {
		return hardCap
	}
	return long
}

func clampVideoSeekSeconds(seek, duration float64) float64 {
	if seek < 0 {
		return 0
	}
	if duration > 0 {
		const eps = 0.001
		if seek >= duration {
			return math.Max(0, duration-eps)
		}
	}
	return seek
}

func videoPaletteSeekTimes(duration float64, n int) []float64 {
	if n < 1 {
		n = 1
	}
	if duration <= 0 {
		return []float64{0}
	}
	if n == 1 {
		return []float64{clampVideoSeekSeconds(0, duration)}
	}
	out := make([]float64, n)
	for i := 0; i < n; i++ {
		t := float64(i) / float64(n-1) * duration
		out[i] = clampVideoSeekSeconds(t, duration)
	}
	return out
}

func subsamplePixelsForVideoPalette(pixels []rgbPixel) []rgbPixel {
	if len(pixels) <= maxVideoPalettePixels {
		return pixels
	}
	step := len(pixels) / maxVideoPalettePixels
	if step < 1 {
		step = 1
	}
	out := make([]rgbPixel, 0, maxVideoPalettePixels)
	for i := 0; i < len(pixels); i += step {
		out = append(out, pixels[i])
		if len(out) >= maxVideoPalettePixels {
			break
		}
	}
	return out
}

// extractVideoPaletteColors pools hi-res samples from several timestamps, subsamples, then one k-means in LAB.
func extractVideoPaletteColors(ctx context.Context, videoPath string, duration float64, videoW, videoH int) ([]string, error) {
	if resolveFFmpeg() == "" {
		return nil, fmt.Errorf("ffmpeg not available")
	}
	maxEdge := videoPaletteLongEdgeCap(videoW, videoH)
	seeks := videoPaletteSeekTimes(duration, videoPaletteFrameCount)

	var mu sync.Mutex
	var pooled []rgbPixel
	g, gctx := errgroup.WithContext(ctx)
	g.SetLimit(videoPaletteParallelism)

	for _, t := range seeks {
		t := t
		g.Go(func() error {
			framePath, cleanup, err := FFmpegExtractFrameAt(gctx, videoPath, t)
			if err != nil {
				return nil
			}
			defer func() {
				if cleanup != nil {
					cleanup()
				}
			}()
			px, err := decodeVideoFramePixelsForPalette(framePath, maxEdge)
			if err != nil || len(px) == 0 {
				return nil
			}
			mu.Lock()
			pooled = append(pooled, px...)
			mu.Unlock()
			return nil
		})
	}

	if err := g.Wait(); err != nil {
		return nil, err
	}
	if len(pooled) == 0 {
		return nil, fmt.Errorf("palette: no pixels from video frames")
	}
	pooled = subsamplePixelsForVideoPalette(pooled)
	return paletteHexFromPixels(pooled, defaultNumColors)
}

// ExtractVideoPalette captures the frame at timeSeconds at gallery resolution (capped), subsamples, then k-means.
func (p *Processor) ExtractVideoPalette(ctx context.Context, imageID int, timeSeconds float64) ([]string, error) {
	if resolveFFmpeg() == "" {
		return nil, fmt.Errorf("ffmpeg not available")
	}
	imgRow, err := p.imageStore.GetByID(ctx, imageID)
	if err != nil {
		return nil, err
	}
	if !strings.EqualFold(strings.TrimSpace(imgRow.MediaType), "video") {
		return nil, fmt.Errorf("not a video")
	}
	meta, err := probeVideo(imgRow.Path)
	if err != nil {
		return nil, fmt.Errorf("probe video: %w", err)
	}
	seek := clampVideoSeekSeconds(timeSeconds, meta.Duration)

	framePath, cleanup, err := FFmpegExtractFrameAt(ctx, imgRow.Path, seek)
	if err != nil {
		return nil, err
	}
	if cleanup != nil {
		defer cleanup()
	}

	maxEdge := videoPaletteLongEdgeCap(meta.Width, meta.Height)
	pixels, err := decodeVideoFramePixelsForPalette(framePath, maxEdge)
	if err != nil {
		return nil, fmt.Errorf("palette: decode frame: %w", err)
	}
	pixels = subsamplePixelsForVideoPalette(pixels)
	colors, err := paletteHexFromPixels(pixels, defaultNumColors)
	if err != nil {
		return nil, fmt.Errorf("palette: %w", err)
	}

	if _, err := p.imageStore.Update(ctx, imageID, map[string]any{"colors": colors}); err != nil {
		return nil, err
	}

	return colors, nil
}

// PersistPaletteFromVideoSample extracts dominant colors after loop export (same multi-frame path as import).
func (p *Processor) PersistPaletteFromVideoSample(ctx context.Context, imageID int, videoPath string) error {
	if resolveFFmpeg() == "" {
		return nil
	}
	meta, err := probeVideo(videoPath)
	if err != nil {
		return err
	}
	colors, err := extractVideoPaletteColors(ctx, videoPath, meta.Duration, meta.Width, meta.Height)
	if err != nil {
		return err
	}
	_, err = p.imageStore.Update(ctx, imageID, map[string]any{"colors": colors})
	return err
}
