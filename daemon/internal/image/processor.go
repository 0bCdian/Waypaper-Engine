package image

import (
	"context"
	"crypto/sha256"
	"encoding/json"
	"fmt"
	"image"
	_ "image/gif"
	_ "image/jpeg"
	_ "image/png"
	"io"
	"log/slog"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strings"
	"sync"
	"sync/atomic"
	"time"

	"golang.org/x/sync/errgroup"

	_ "golang.org/x/image/webp"

	"github.com/spf13/viper"

	"waypaper-engine/daemon/internal/events"
	"waypaper-engine/daemon/internal/store"
	"waypaper-engine/daemon/internal/system"
)

// supportedExtensions lists file extensions the processor accepts.
var supportedExtensions = map[string]string{
	".jpg":  "jpg",
	".jpeg": "jpg",
	".png":  "png",
	".gif":  "gif",
	".webp": "webp",
	".bmp":  "bmp",
	".tiff": "tiff",
	".tif":  "tiff",
	".mp4":  "mp4",
	".webm": "webm",
	".mkv":  "mkv",
	".avi":  "avi",
	".mov":  "mov",
}

// Processor handles importing images into the gallery: validation, copying,
// metadata extraction, thumbnail generation, and SSE event publishing.
type Processor struct {
	imageStore  store.ImageStore
	bus         events.Bus
	imagesDir   string
	thumbnailer *Thumbnailer
	configViper *viper.Viper

	mu            sync.Mutex
	activeBatches map[string]context.CancelFunc
}

// NewProcessor creates a new image Processor.
func NewProcessor(
	imageStore store.ImageStore,
	bus events.Bus,
	imagesDir string,
	thumbnailsDir string,
	configViper *viper.Viper,
) *Processor {
	return &Processor{
		imageStore:    imageStore,
		bus:           bus,
		imagesDir:     imagesDir,
		thumbnailer:   NewThumbnailer(thumbnailsDir),
		configViper:   configViper,
		activeBatches: make(map[string]context.CancelFunc),
	}
}

// BackfillMissingVideoBrowserPreviews walks existing video rows with no preview_path,
// ffprobes each file, and transcodes to H.264 when the codec is not reliably playable
// in Chromium (e.g. HEVC). Idempotent: skips rows that already have preview_path set.
func (p *Processor) BackfillMissingVideoBrowserPreviews(ctx context.Context) {
	if resolveFFmpeg() == "" {
		slog.Warn("video preview backfill skipped: ffmpeg not found (PATH and standard locations)")
		return
	}
	wrotePreview := false
	defer func() {
		if !wrotePreview {
			return
		}
		p.bus.Publish(events.Event{
			Type: events.GalleryChanged,
			Data: map[string]any{"domain": "images"},
		})
	}()

	page := 1
	for {
		if ctx.Err() != nil {
			return
		}
		res, err := p.imageStore.GetAll(ctx, store.ImageQueryOpts{
			Page:      page,
			PerPage:   200,
			MediaType: "video",
			SortBy:    "imported_at",
			SortOrder: "asc",
		})
		if err != nil {
			slog.Warn("video preview backfill: list failed", "error", err)
			return
		}
		if len(res.Data) == 0 {
			return
		}
		for _, img := range res.Data {
			if img.PreviewPath != "" {
				continue
			}
			if _, err := os.Stat(img.Path); err != nil {
				continue
			}
			meta, err := probeVideo(img.Path)
			if err != nil {
				slog.Debug("video preview backfill: probe failed", "image_id", img.ID, "error", err)
				continue
			}
			if strings.TrimSpace(meta.CodecName) == "" {
				slog.Debug("video preview backfill: empty codec_name, skipping", "image_id", img.ID)
				continue
			}
			if !meta.NeedsBrowserPreview {
				continue
			}
			ppath, err := p.thumbnailer.WriteBrowserVideoPreview(img.Path, img.ID)
			if err != nil {
				slog.Warn("video preview backfill: transcode failed", "image_id", img.ID, "codec", meta.CodecName, "error", err)
				continue
			}
			if _, err := p.imageStore.Update(ctx, img.ID, map[string]any{"preview_path": ppath}); err != nil {
				slog.Warn("video preview backfill: persist failed", "image_id", img.ID, "error", err)
				continue
			}
			wrotePreview = true
			slog.Info("video preview backfill: wrote H.264 browser proxy", "image_id", img.ID, "codec", meta.CodecName)
		}
		if res.Pagination.TotalPages == 0 || page >= res.Pagination.TotalPages {
			return
		}
		page++
	}
}

// EnsureBrowserVideoPreview writes an H.264 browser proxy when preview_path is empty
// and ffprobe reports Chromium needs it, or when force is true (e.g. after <video> decode error).
func (p *Processor) EnsureBrowserVideoPreview(ctx context.Context, id int, force bool) (*store.Image, error) {
	img, err := p.imageStore.GetByID(ctx, id)
	if err != nil {
		return nil, err
	}
	if img.MediaType != "video" {
		return nil, fmt.Errorf("not a video")
	}
	if strings.TrimSpace(img.PreviewPath) != "" {
		return img, nil
	}
	if _, err := os.Stat(img.Path); err != nil {
		return nil, fmt.Errorf("source file missing: %w", err)
	}
	if resolveFFmpeg() == "" {
		return nil, fmt.Errorf("ffmpeg not available")
	}
	meta, err := probeVideo(img.Path)
	if err != nil {
		return nil, fmt.Errorf("probe: %w", err)
	}
	if !force && !meta.NeedsBrowserPreview {
		return nil, fmt.Errorf("browser preview not required")
	}
	ppath, err := p.thumbnailer.WriteBrowserVideoPreview(img.Path, img.ID)
	if err != nil {
		return nil, err
	}
	updated, err := p.imageStore.Update(ctx, img.ID, map[string]any{"preview_path": ppath})
	if err != nil {
		return nil, err
	}
	p.bus.Publish(events.Event{
		Type: events.GalleryChanged,
		Data: map[string]any{"domain": "images"},
	})
	return updated, nil
}

// CancelBatch cancels a running batch import. Returns true if the batch was
// found and cancelled, false if the batch ID was not active.
func (p *Processor) CancelBatch(batchID string) bool {
	p.mu.Lock()
	defer p.mu.Unlock()
	cancel, ok := p.activeBatches[batchID]
	if !ok {
		return false
	}
	cancel()
	return true
}

// ProcessBatchWithFolder imports a batch of images asynchronously, assigning them
// to the given folder. Returns the batch ID.
func (p *Processor) ProcessBatchWithFolder(ctx context.Context, paths []string, folderID *int) string {
	batchID := fmt.Sprintf("%d", time.Now().UnixNano())
	ctx, cancel := context.WithCancel(ctx)

	p.mu.Lock()
	p.activeBatches[batchID] = cancel
	p.mu.Unlock()

	go func() {
		defer func() {
			p.mu.Lock()
			delete(p.activeBatches, batchID)
			p.mu.Unlock()
			cancel()
		}()
		p.processBatchSync(ctx, paths, batchID, folderID)
	}()
	return batchID
}

// preProcessResult holds the metadata extracted during phase 1 (parallel pre-processing).
type preProcessResult struct {
	sourcePath string
	destPath   string
	name       string
	ext        string
	format     string
	mediaType  string
	width      int
	height     int
	fileSize   int64
	checksum   string
	colors     []string
	duration   float64
	audio      bool
	err        error
}

func (p *Processor) processBatchSync(ctx context.Context, paths []string, batchID string, folderID *int) ([]store.Image, error) {
	startTime := time.Now()
	total := len(paths)

	p.bus.Publish(events.Event{
		Type: events.ProcessingStarted,
		Data: map[string]any{
			"batch_id": batchID,
			"total":    total,
		},
	})

	if err := os.MkdirAll(p.imagesDir, 0o755); err != nil {
		return nil, fmt.Errorf("processor: create images dir: %w", err)
	}

	// Allocate dest paths sequentially to avoid TOCTOU races with UniquePath.
	type validated struct {
		sourcePath string
		destPath   string
		name       string
		ext        string
		format     string
		mediaType  string
	}
	validPaths := make([]validated, 0, total)
	preErrors := make(map[int]string) // index -> error message

	for i, path := range paths {
		ext := strings.ToLower(filepath.Ext(path))
		format, ok := supportedExtensions[ext]
		if !ok {
			preErrors[i] = fmt.Sprintf("unsupported file format: %s", ext)
			continue
		}
		name := filepath.Base(path)
		destPath := system.UniquePath(filepath.Join(p.imagesDir, name))
		validPaths = append(validPaths, validated{
			sourcePath: path,
			destPath:   destPath,
			name:       name,
			ext:        ext,
			format:     format,
			mediaType:  mediaTypeForExt(ext, format),
		})
	}

	// Emit errors for paths that failed validation up front.
	errCount := len(preErrors)
	for i, errMsg := range preErrors {
		slog.Warn("failed to process image", "path", paths[i], "error", errMsg)
		p.bus.Publish(events.Event{
			Type: events.ImageError,
			Data: map[string]any{
				"batch_id":   batchID,
				"path":       paths[i],
				"error":      errMsg,
				"current":    i + 1,
				"total":      total,
				"elapsed_ms": time.Since(startTime).Milliseconds(),
			},
		})
	}

	if ctx.Err() != nil {
		return nil, p.emitTerminal(ctx, batchID, total, 0, errCount, startTime)
	}

	// --- Phase 1: parallel pre-processing (checksum, stat, copy, dimensions, palette) ---
	workers := runtime.NumCPU()
	results := make([]preProcessResult, len(validPaths))

	g, gctx := errgroup.WithContext(ctx)
	g.SetLimit(workers)

	for i, v := range validPaths {
		i, v := i, v
		g.Go(func() error {
			if gctx.Err() != nil {
				return gctx.Err()
			}
			results[i] = p.preProcessOne(v.sourcePath, v.destPath, v.name, v.ext, v.format)
			return nil
		})
	}

	_ = g.Wait() // individual errors are captured in results[i].err

	if ctx.Err() != nil {
		return nil, p.emitTerminal(ctx, batchID, total, 0, errCount, startTime)
	}

	// --- Phase 2: fast sequential DB inserts (ordered, consistent IDs) ---
	var created []store.Image
	progressCounter := errCount

	for _, r := range results {
		if ctx.Err() != nil {
			break
		}
		progressCounter++

		if r.err != nil {
			errCount++
			slog.Warn("failed to process image", "path", r.sourcePath, "error", r.err)
			p.bus.Publish(events.Event{
				Type: events.ImageError,
				Data: map[string]any{
					"batch_id":   batchID,
					"path":       r.sourcePath,
					"error":      r.err.Error(),
					"current":    progressCounter,
					"total":      total,
					"elapsed_ms": time.Since(startTime).Milliseconds(),
				},
			})
			continue
		}

		imgs, err := p.imageStore.Create(ctx, []store.Image{{
			Name:         strings.TrimSuffix(r.name, r.ext),
			Path:         r.destPath,
			MediaType:    r.mediaType,
			Duration:     r.duration,
			AudioEnabled: r.audio,
			Width:        r.width,
			Height:       r.height,
			Format:       r.format,
			FileSize:     r.fileSize,
			Checksum:     "sha256:" + r.checksum,
			Tags:         []string{},
			Colors:       r.colors,
			ImportedAt:   time.Now(),
			SourcePath:   r.sourcePath,
			IsSelected:   false,
			FolderID:     folderID,
		}})
		if err != nil {
			errCount++
			slog.Warn("failed to create image record", "path", r.sourcePath, "error", err)
			p.bus.Publish(events.Event{
				Type: events.ImageError,
				Data: map[string]any{
					"batch_id":   batchID,
					"path":       r.sourcePath,
					"error":      err.Error(),
					"current":    progressCounter,
					"total":      total,
					"elapsed_ms": time.Since(startTime).Milliseconds(),
				},
			})
			continue
		}

		created = append(created, imgs[0])
	}

	if ctx.Err() != nil {
		return created, p.emitTerminal(ctx, batchID, total, len(created), errCount, startTime)
	}

	// --- Phase 3: parallel thumbnail generation + per-image event emission ---
	// Thumbnails are generated in parallel for speed. Each goroutine generates
	// thumbnails, updates the DB, then emits image_processed. Events arrive
	// out of order but the progress counter is correct via atomic increment.
	var progress atomic.Int64
	progress.Store(int64(errCount))

	tg, tgctx := errgroup.WithContext(ctx)
	tg.SetLimit(workers)

	for i := range created {
		i := i
		tg.Go(func() error {
			if tgctx.Err() != nil {
				return tgctx.Err()
			}
			img := &created[i]

			if img.MediaType == "video" {
				meta, probeErr := probeVideo(img.Path)
				if probeErr != nil {
					slog.Warn("video codec probe failed, skipping browser preview transcode",
						"image_id", img.ID, "error", probeErr)
				} else if meta.NeedsBrowserPreview {
					ppath, transErr := p.thumbnailer.WriteBrowserVideoPreview(img.Path, img.ID)
					if transErr != nil {
						slog.Warn("browser video preview transcode failed",
							"image_id", img.ID, "codec", meta.CodecName, "error", transErr)
					} else {
						img.PreviewPath = ppath
						if _, upErr := p.imageStore.Update(tgctx, img.ID, map[string]any{"preview_path": ppath}); upErr != nil {
							slog.Warn("persist video preview path failed", "image_id", img.ID, "error", upErr)
						}
					}
				}
			}

			thumbnails, err := p.thumbnailer.Generate(img.Path, img.ID, img.MediaType, img.PreviewPath)
			if err != nil {
				slog.Warn("thumbnail generation failed, continuing without thumbnails",
					"image_id", img.ID, "error", err)
			} else {
				img.Thumbnails = thumbnails
				_, _ = p.imageStore.Update(ctx, img.ID, map[string]any{"thumbnails": thumbnails})
			}

			current := int(progress.Add(1))
			p.bus.Publish(events.Event{
				Type: events.ImageProcessed,
				Data: map[string]any{
					"batch_id":   batchID,
					"image":      img,
					"current":    current,
					"total":      total,
					"elapsed_ms": time.Since(startTime).Milliseconds(),
				},
			})
			return nil
		})
	}

	_ = tg.Wait()

	return created, p.emitTerminal(ctx, batchID, total, len(created), errCount, startTime)
}

// emitTerminal publishes the final batch event (complete or cancelled) and images_updated.
func (p *Processor) emitTerminal(ctx context.Context, batchID string, total, succeeded, failed int, startTime time.Time) error {
	cancelled := ctx.Err() != nil
	elapsed := time.Since(startTime).Milliseconds()

	if cancelled {
		p.bus.Publish(events.Event{
			Type: events.ProcessingCancelled,
			Data: map[string]any{
				"batch_id":   batchID,
				"total":      total,
				"succeeded":  succeeded,
				"failed":     failed,
				"elapsed_ms": elapsed,
			},
		})
	} else {
		p.bus.Publish(events.Event{
			Type: events.ProcessingComplete,
			Data: map[string]any{
				"batch_id":   batchID,
				"total":      total,
				"succeeded":  succeeded,
				"failed":     failed,
				"elapsed_ms": elapsed,
			},
		})
	}

	if succeeded > 0 {
		p.bus.Publish(events.Event{
			Type: events.GalleryChanged,
			Data: map[string]any{"domain": "images"},
		})
	}

	return ctx.Err()
}

// preProcessOne handles the CPU/IO-bound work for a single file: stat, checksum,
// copy, dimensions, and palette extraction. Does not touch the database.
func (p *Processor) preProcessOne(sourcePath, destPath, name, ext, format string) preProcessResult {
	r := preProcessResult{
		sourcePath: sourcePath,
		destPath:   destPath,
		name:       name,
		ext:        ext,
		format:     format,
	}

	info, err := os.Stat(sourcePath)
	if err != nil {
		r.err = fmt.Errorf("stat source: %w", err)
		return r
	}
	r.fileSize = info.Size()

	checksum, err := computeChecksum(sourcePath)
	if err != nil {
		r.err = fmt.Errorf("checksum: %w", err)
		return r
	}
	r.checksum = checksum

	if err := copyFile(sourcePath, destPath); err != nil {
		r.err = fmt.Errorf("copy file: %w", err)
		return r
	}

	r.mediaType = mediaTypeForExt(ext, format)
	if r.mediaType == "video" {
		if resolveFFmpeg() == "" {
			r.err = fmt.Errorf("video import requires ffmpeg (install ffmpeg or ensure it is in PATH)")
			return r
		}
		if resolveFFprobe() == "" {
			r.err = fmt.Errorf("video import requires ffprobe (install ffmpeg or ensure it is in PATH)")
			return r
		}
		meta, err := probeVideo(sourcePath)
		if err != nil {
			r.err = fmt.Errorf("probe video: %w", err)
			return r
		}
		r.width = meta.Width
		r.height = meta.Height
		r.duration = meta.Duration
		r.audio = meta.HasAudio
		colors, perr := extractVideoPaletteColors(context.Background(), destPath, meta.Duration, meta.Width, meta.Height)
		if perr != nil {
			slog.Warn("video palette extraction failed, continuing without colors",
				"path", destPath, "error", perr)
			r.colors = []string{}
		} else {
			r.colors = colors
		}
		return r
	}

	width, height, err := getImageDimensions(sourcePath)
	if err != nil {
		r.err = fmt.Errorf("dimensions: %w", err)
		return r
	}
	r.width = width
	r.height = height

	colors, err := ExtractPalette(destPath, 5)
	if err != nil {
		slog.Warn("color palette extraction failed, continuing without colors",
			"path", destPath, "error", err)
		colors = []string{}
	}
	r.colors = colors

	return r
}

func mediaTypeForExt(ext, format string) string {
	if isVideoExtension(ext) {
		return "video"
	}
	if format == "gif" {
		return "gif"
	}
	return "image"
}

func isVideoExtension(ext string) bool {
	switch strings.ToLower(ext) {
	case ".mp4", ".webm", ".mkv", ".avi", ".mov":
		return true
	default:
		return false
	}
}

type probedVideo struct {
	Width     int
	Height    int
	Duration  float64
	HasAudio  bool
	CodecName string
	// Profile of the primary (largest-area) video stream from ffprobe (e.g. "Main", "Constrained Baseline").
	Profile string
	// NeedsBrowserPreview is true if any video stream needs an H.264 proxy for Chromium
	// (not only the primary/largest stream — multi-track MP4s may mix H.264 + HEVC).
	NeedsBrowserPreview bool
}

// needsBrowserVideoPreviewTranscode is true when the Electron/Chromium <video> tag
// often cannot decode the source (HEVC on Linux, etc.); we serve an H.264 proxy in preview_path.
func needsBrowserVideoPreviewTranscode(codec string) bool {
	switch strings.ToLower(strings.TrimSpace(codec)) {
	case "h264", "avc1", "avc", "vp8", "vp9":
		return false
	default:
		return true
	}
}

// h264Baseline4KChromiumIssue: Chromium/Electron often fails <video> decode (MEDIA_ERR_SRC_NOT_SUPPORTED)
// for H.264 Constrained Baseline at 4K even though ffprobe reports a "normal" h264 stream. A scaled
// libx264 Main proxy matches what luna-style encodes play reliably.
func h264Baseline4KChromiumIssue(codec, profile string, width, height int) bool {
	if strings.ToLower(strings.TrimSpace(codec)) != "h264" {
		return false
	}
	if width < 1920 && height < 1080 {
		return false
	}
	p := strings.ToLower(strings.TrimSpace(profile))
	return strings.Contains(p, "baseline") || strings.Contains(p, "constrained")
}

func probeVideo(path string) (probedVideo, error) {
	ffprobe := resolveFFprobe()
	if ffprobe == "" {
		return probedVideo{}, fmt.Errorf("ffprobe not found in PATH or standard locations")
	}
	cmd := exec.Command(
		ffprobe,
		"-v", "error",
		"-print_format", "json",
		"-show_format",
		"-show_streams",
		path,
	)
	out, err := cmd.Output()
	if err != nil {
		return probedVideo{}, fmt.Errorf("ffprobe not available or failed: %w", err)
	}

	var parsed struct {
		Streams []struct {
			CodecType string `json:"codec_type"`
			CodecName string `json:"codec_name"`
			Profile   string `json:"profile"`
			Width     int    `json:"width"`
			Height    int    `json:"height"`
		} `json:"streams"`
		Format struct {
			Duration string `json:"duration"`
		} `json:"format"`
	}
	if err := json.Unmarshal(out, &parsed); err != nil {
		return probedVideo{}, fmt.Errorf("decode ffprobe output: %w", err)
	}

	// Use the largest video stream by pixel area for codec/dimensions. Some MP4s list a
	// small embedded preview/cover track (often H.264) before the main feature (e.g. HEVC);
	// taking only the first stream made needsBrowserVideoPreviewTranscode false and skipped
	// generating preview_path while Chromium still decoded the main unsupported codec.
	result := probedVideo{}
	bestArea := -1
	for _, s := range parsed.Streams {
		if s.CodecType == "video" {
			area := s.Width * s.Height
			if area > bestArea {
				bestArea = area
				result.CodecName = s.CodecName
				result.Profile = s.Profile
				result.Width = s.Width
				result.Height = s.Height
			}
		}
		if s.CodecType == "audio" {
			result.HasAudio = true
		}
	}
	if bestArea <= 0 {
		for _, s := range parsed.Streams {
			if s.CodecType != "video" {
				continue
			}
			if s.CodecName != "" && result.CodecName == "" {
				result.CodecName = s.CodecName
				result.Profile = s.Profile
			}
			if result.Width == 0 && result.Height == 0 && s.Width > 0 && s.Height > 0 {
				result.Width = s.Width
				result.Height = s.Height
			}
		}
	}
	if parsed.Format.Duration != "" {
		var duration float64
		_, _ = fmt.Sscanf(parsed.Format.Duration, "%f", &duration)
		result.Duration = duration
	}
	if result.Width == 0 || result.Height == 0 {
		return probedVideo{}, fmt.Errorf("video stream dimensions not found")
	}
	for _, s := range parsed.Streams {
		if s.CodecType != "video" || strings.TrimSpace(s.CodecName) == "" {
			continue
		}
		if needsBrowserVideoPreviewTranscode(s.CodecName) {
			result.NeedsBrowserPreview = true
			break
		}
	}
	if !result.NeedsBrowserPreview {
		result.NeedsBrowserPreview = h264Baseline4KChromiumIssue(result.CodecName, result.Profile, result.Width, result.Height)
	}
	return result, nil
}

// computeChecksum returns the hex-encoded SHA-256 of a file.
func computeChecksum(path string) (string, error) {
	f, err := os.Open(path)
	if err != nil {
		return "", err
	}
	defer f.Close()

	h := sha256.New()
	if _, err := io.Copy(h, f); err != nil {
		return "", err
	}
	return fmt.Sprintf("%x", h.Sum(nil)), nil
}

// getImageDimensions decodes the image config to get width and height.
func getImageDimensions(path string) (int, int, error) {
	f, err := os.Open(path)
	if err != nil {
		return 0, 0, err
	}
	defer f.Close()

	cfg, _, err := image.DecodeConfig(f)
	if err != nil {
		return 0, 0, err
	}
	return cfg.Width, cfg.Height, nil
}

// copyFile copies a file from src to dst, removing dst on error.
func copyFile(src, dst string) error {
	in, err := os.Open(src)
	if err != nil {
		return err
	}
	defer in.Close()

	out, err := os.Create(dst)
	if err != nil {
		return err
	}
	defer out.Close()

	if _, err := io.Copy(out, in); err != nil {
		os.Remove(dst)
		return err
	}
	if err := out.Sync(); err != nil {
		os.Remove(dst)
		return err
	}
	return nil
}
