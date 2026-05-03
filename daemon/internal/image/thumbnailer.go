package image

import (
	"context"
	"fmt"
	"image"
	"image/color"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"sync"

	"github.com/chai2010/webp"
	"github.com/disintegration/imaging"
)

// ThumbnailResolution defines a named thumbnail size.
type ThumbnailResolution struct {
	Label     string
	MaxWidth  int
	MaxHeight int
}

// DefaultThumbnailResolutions is the set of thumbnail sizes generated for each image.
var DefaultThumbnailResolutions = []ThumbnailResolution{
	{Label: "default", MaxWidth: 300, MaxHeight: 0},
	{Label: "720p", MaxWidth: 1280, MaxHeight: 720},
	{Label: "1080p", MaxWidth: 1920, MaxHeight: 1080},
	{Label: "1440p", MaxWidth: 2560, MaxHeight: 1440},
	{Label: "4k", MaxWidth: 3840, MaxHeight: 2160},
}

// Thumbnailer generates multi-resolution WebP thumbnails from source images.
type Thumbnailer struct {
	thumbnailsDir string
	resolutions   []ThumbnailResolution
}

// NewThumbnailer creates a Thumbnailer that saves thumbnails to the given directory.
func NewThumbnailer(thumbnailsDir string) *Thumbnailer {
	return &Thumbnailer{
		thumbnailsDir: thumbnailsDir,
		resolutions:   DefaultThumbnailResolutions,
	}
}

// Generate creates thumbnails for the given source media.
// All resolutions are generated concurrently from a single decoded source.
// Returns a map of resolution label to thumbnail absolute path.
func (t *Thumbnailer) Generate(sourcePath string, imageID int, mediaType string, previewPath string) (map[string]string, error) {
	srcPath, cleanup, err := t.prepareThumbnailSource(sourcePath, mediaType, previewPath)
	if err != nil {
		return nil, err
	}
	if cleanup != nil {
		defer cleanup()
	}

	src, err := imaging.Open(srcPath)
	if err != nil {
		return nil, fmt.Errorf("thumbnailer: open source: %w", err)
	}

	// Ensure all resolution directories exist before spawning goroutines.
	for _, res := range t.resolutions {
		resDir := filepath.Join(t.thumbnailsDir, res.Label)
		if err := os.MkdirAll(resDir, 0o755); err != nil {
			return nil, fmt.Errorf("thumbnailer: create dir %s: %w", res.Label, err)
		}
	}

	type thumbEntry struct {
		label   string
		outPath string
		err     error
	}

	entries := make([]thumbEntry, len(t.resolutions))
	var wg sync.WaitGroup
	wg.Add(len(t.resolutions))

	for i, res := range t.resolutions {
		go func(idx int, res ThumbnailResolution) {
			defer wg.Done()
			outPath := filepath.Join(t.thumbnailsDir, res.Label, fmt.Sprintf("%d.webp", imageID))
			thumb := fitImage(src, res.MaxWidth, res.MaxHeight)
			err := writeWebP(outPath, thumb)
			entries[idx] = thumbEntry{label: res.Label, outPath: outPath, err: err}
		}(i, res)
	}

	wg.Wait()

	thumbnails := make(map[string]string, len(t.resolutions))
	for _, e := range entries {
		if e.err != nil {
			return nil, fmt.Errorf("thumbnailer: %s: %w", e.label, e.err)
		}
		thumbnails[e.label] = e.outPath
	}

	return thumbnails, nil
}

func isRasterWebPreviewFile(path string) bool {
	ext := strings.ToLower(filepath.Ext(path))
	switch ext {
	case ".mp4", ".webm", ".mkv", ".mov", ".avi":
		return false
	default:
		return true
	}
}

// videoSeekSecondsForThumbnail picks a timestamp less likely to be black / wrong vs always using 1s.
func videoSeekSecondsForThumbnail(videoPath string) string {
	ffprobe := resolveFFprobe()
	if ffprobe == "" {
		return "1"
	}
	cmd := exec.Command(
		ffprobe, "-v", "error",
		"-show_entries", "format=duration",
		"-of", "default=noprint_wrappers=1:nokey=1",
		videoPath,
	)
	out, err := cmd.Output()
	if err != nil {
		return "1"
	}
	var dur float64
	_, _ = fmt.Sscanf(strings.TrimSpace(string(out)), "%f", &dur)
	if dur <= 0 {
		return "0.25"
	}
	if dur < 0.5 {
		return "0"
	}
	if dur < 2 {
		return fmt.Sprintf("%.3f", dur*0.2)
	}
	return "1"
}

// ffmpegExtractFrame writes one PNG frame from a video file and returns its path + cleanup.
func ffmpegExtractFrame(videoPath string) (string, func(), error) {
	tmp, err := os.CreateTemp("", "waypaper-video-thumb-*.png")
	if err != nil {
		return "", nil, fmt.Errorf("thumbnailer: create temp file: %w", err)
	}
	tmpPath := tmp.Name()
	_ = tmp.Close()
	seek := videoSeekSecondsForThumbnail(videoPath)
	ffmpeg := resolveFFmpeg()
	if ffmpeg == "" {
		return "", nil, fmt.Errorf("thumbnailer: ffmpeg not found in PATH or standard locations")
	}
	cmd := exec.Command(
		ffmpeg,
		"-hide_banner",
		"-loglevel", "error",
		"-y",
		"-ss", seek,
		"-i", videoPath,
		"-frames:v", "1",
		tmpPath,
	)
	if err := cmd.Run(); err != nil {
		_ = os.Remove(tmpPath)
		return "", nil, fmt.Errorf("thumbnailer: ffmpeg frame extract failed: %w", err)
	}
	return tmpPath, func() { _ = os.Remove(tmpPath) }, nil
}

// FFmpegExtractFrameAt writes one PNG frame at seekSeconds on the timeline. Uses -ss after -i
// so the timestamp matches loop authoring / UI scrub positions.
func FFmpegExtractFrameAt(ctx context.Context, videoPath string, seekSeconds float64) (string, func(), error) {
	if ctx == nil {
		ctx = context.Background()
	}
	tmp, err := os.CreateTemp("", "waypaper-video-palette-*.png")
	if err != nil {
		return "", nil, fmt.Errorf("thumbnailer: create temp file: %w", err)
	}
	tmpPath := tmp.Name()
	_ = tmp.Close()
	ffmpeg := resolveFFmpeg()
	if ffmpeg == "" {
		_ = os.Remove(tmpPath)
		return "", nil, fmt.Errorf("thumbnailer: ffmpeg not found in PATH or standard locations")
	}
	cmd := exec.CommandContext(ctx, ffmpeg,
		"-hide_banner",
		"-loglevel", "error",
		"-y",
		"-i", videoPath,
		"-ss", fmt.Sprintf("%.6f", seekSeconds),
		"-frames:v", "1",
		tmpPath,
	)
	if err := cmd.Run(); err != nil {
		_ = os.Remove(tmpPath)
		return "", nil, fmt.Errorf("thumbnailer: ffmpeg frame extract failed: %w", err)
	}
	return tmpPath, func() { _ = os.Remove(tmpPath) }, nil
}

// WriteBrowserVideoPreview transcodes the file to H.264/AAC-less MP4 for Chromium/Electron
// gallery preview when the source codec is not reliably playable (e.g. HEVC on Linux).
func (t *Thumbnailer) WriteBrowserVideoPreview(sourcePath string, imageID int) (string, error) {
	dir := filepath.Join(t.thumbnailsDir, "video_preview")
	if err := os.MkdirAll(dir, 0o755); err != nil {
		return "", fmt.Errorf("thumbnailer: video_preview dir: %w", err)
	}
	outPath := filepath.Join(dir, fmt.Sprintf("%d.mp4", imageID))
	_ = os.Remove(outPath)
	ffmpeg := resolveFFmpeg()
	if ffmpeg == "" {
		return "", fmt.Errorf("thumbnailer: ffmpeg not found in PATH or standard locations")
	}
	cmd := exec.Command(
		ffmpeg,
		"-hide_banner",
		"-loglevel", "error",
		"-y",
		"-i", sourcePath,
		"-an",
		"-c:v", "libx264",
		"-preset", "veryfast",
		"-crf", "26",
		"-pix_fmt", "yuv420p",
		"-movflags", "+faststart",
		"-vf", "scale=min(1920\\,iw):-2",
		outPath,
	)
	if err := cmd.Run(); err != nil {
		return "", fmt.Errorf("thumbnailer: browser preview transcode: %w", err)
	}
	return outPath, nil
}

func (t *Thumbnailer) prepareThumbnailSource(sourcePath, mediaType, previewPath string) (string, func(), error) {
	switch mediaType {
	case "video":
		return ffmpegExtractFrame(sourcePath)
	case "web":
		if previewPath != "" {
			if _, err := os.Stat(previewPath); err == nil {
				if !isRasterWebPreviewFile(previewPath) {
					return ffmpegExtractFrame(previewPath)
				}
				return previewPath, nil, nil
			}
		}
		// Placeholder for web wallpapers without preview assets.
		placeholder := imaging.New(1280, 720, color.NRGBA{R: 32, G: 32, B: 32, A: 255})
		tmp, err := os.CreateTemp("", "waypaper-web-thumb-*.webp")
		if err != nil {
			return "", nil, fmt.Errorf("thumbnailer: create temp file: %w", err)
		}
		tmpPath := tmp.Name()
		_ = tmp.Close()
		if err := writeWebP(tmpPath, placeholder); err != nil {
			return "", nil, fmt.Errorf("thumbnailer: write web placeholder: %w", err)
		}
		return tmpPath, func() { _ = os.Remove(tmpPath) }, nil
	default:
		return sourcePath, nil, nil
	}
}

func writeWebP(path string, img image.Image) (err error) {
	f, err := os.Create(path)
	if err != nil {
		return err
	}
	defer func() {
		if cerr := f.Close(); err == nil {
			err = cerr
		}
	}()
	return webp.Encode(f, img, &webp.Options{Quality: 80})
}

// fitImage resizes the image to fit within maxWidth x maxHeight, preserving aspect ratio.
// If maxHeight is 0, only maxWidth is used.
func fitImage(src image.Image, maxWidth, maxHeight int) image.Image {
	if maxHeight == 0 {
		return imaging.Resize(src, maxWidth, 0, imaging.Lanczos)
	}
	return imaging.Fit(src, maxWidth, maxHeight, imaging.Lanczos)
}
