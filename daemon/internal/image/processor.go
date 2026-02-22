package image

import (
	"context"
	"crypto/sha256"
	"fmt"
	"image"
	_ "image/gif"
	_ "image/jpeg"
	_ "image/png"
	"io"
	"log/slog"
	"os"
	"path/filepath"
	"runtime"
	"strings"
	"sync"
	"sync/atomic"
	"time"

	"golang.org/x/sync/errgroup"

	_ "golang.org/x/image/webp"

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
}

// Processor handles importing images into the gallery: validation, copying,
// metadata extraction, thumbnail generation, and SSE event publishing.
type Processor struct {
	imageStore  store.ImageStore
	bus         events.Bus
	imagesDir   string
	thumbnailer *Thumbnailer

	mu            sync.Mutex
	activeBatches map[string]context.CancelFunc
}

// NewProcessor creates a new image Processor.
func NewProcessor(imageStore store.ImageStore, bus events.Bus, imagesDir string, thumbnailsDir string) *Processor {
	return &Processor{
		imageStore:    imageStore,
		bus:           bus,
		imagesDir:     imagesDir,
		thumbnailer:   NewThumbnailer(thumbnailsDir),
		activeBatches: make(map[string]context.CancelFunc),
	}
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

// ProcessBatch imports a batch of images asynchronously. It publishes SSE events
// for progress tracking. Returns the batch ID that identifies this import in
// all emitted events.
func (p *Processor) ProcessBatch(ctx context.Context, paths []string) string {
	return p.ProcessBatchWithFolder(ctx, paths, nil)
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

	for i, r := range results {
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

		mediaType := "image"
		if validPaths[i].format == "gif" {
			mediaType = "gif"
		}

		imgs, err := p.imageStore.Create(ctx, []store.Image{{
			Name:       strings.TrimSuffix(r.name, r.ext),
			Path:       r.destPath,
			MediaType:  mediaType,
			Width:      r.width,
			Height:     r.height,
			Format:     r.format,
			FileSize:   r.fileSize,
			Checksum:   "sha256:" + r.checksum,
			Tags:       []string{},
			Colors:     r.colors,
			ImportedAt: time.Now(),
			SourcePath: r.sourcePath,
			IsSelected: false,
			FolderID:   folderID,
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

			thumbnails, err := p.thumbnailer.Generate(img.Path, img.ID)
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
			Type: events.ImagesUpdated,
			Data: map[string]any{
				"action": "added",
				"count":  succeeded,
			},
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

	width, height, err := getImageDimensions(sourcePath)
	if err != nil {
		r.err = fmt.Errorf("dimensions: %w", err)
		return r
	}
	r.width = width
	r.height = height

	if err := copyFile(sourcePath, destPath); err != nil {
		r.err = fmt.Errorf("copy file: %w", err)
		return r
	}

	colors, err := ExtractPalette(destPath, 5)
	if err != nil {
		slog.Warn("color palette extraction failed, continuing without colors",
			"path", destPath, "error", err)
		colors = []string{}
	}
	r.colors = colors

	r.mediaType = "image"
	if format == "gif" {
		r.mediaType = "gif"
	}

	return r
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
