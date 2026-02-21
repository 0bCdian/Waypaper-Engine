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
	"strings"
	"time"

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
}

// NewProcessor creates a new image Processor.
func NewProcessor(imageStore store.ImageStore, bus events.Bus, imagesDir string, thumbnailsDir string) *Processor {
	return &Processor{
		imageStore:  imageStore,
		bus:         bus,
		imagesDir:   imagesDir,
		thumbnailer: NewThumbnailer(thumbnailsDir),
	}
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
	go p.processBatchSync(ctx, paths, batchID, folderID)
	return batchID
}

func (p *Processor) processBatchSync(ctx context.Context, paths []string, batchID string, folderID *int) ([]store.Image, error) {
	startTime := time.Now()

	p.bus.Publish(events.Event{
		Type: events.ProcessingStarted,
		Data: map[string]any{
			"batch_id": batchID,
			"total":    len(paths),
		},
	})

	if err := os.MkdirAll(p.imagesDir, 0o755); err != nil {
		return nil, fmt.Errorf("processor: create images dir: %w", err)
	}

	var created []store.Image
	var errCount int

	for i, path := range paths {
		select {
		case <-ctx.Done():
			return created, ctx.Err()
		default:
		}

		img, err := p.processOne(ctx, path, folderID)
		if err != nil {
			errCount++
			slog.Warn("failed to process image", "path", path, "error", err)
			p.bus.Publish(events.Event{
				Type: events.ImageError,
				Data: map[string]any{
					"batch_id":   batchID,
					"path":       path,
					"error":      err.Error(),
					"current":    i + 1,
					"total":      len(paths),
					"elapsed_ms": time.Since(startTime).Milliseconds(),
				},
			})
			continue
		}

		created = append(created, *img)
		p.bus.Publish(events.Event{
			Type: events.ImageProcessed,
			Data: map[string]any{
				"batch_id":   batchID,
				"image":      img,
				"current":    i + 1,
				"total":      len(paths),
				"elapsed_ms": time.Since(startTime).Milliseconds(),
			},
		})
	}

	p.bus.Publish(events.Event{
		Type: events.ProcessingComplete,
		Data: map[string]any{
			"batch_id":   batchID,
			"total":      len(paths),
			"succeeded":  len(created),
			"failed":     errCount,
			"elapsed_ms": time.Since(startTime).Milliseconds(),
		},
	})

	p.bus.Publish(events.Event{
		Type: events.ImagesUpdated,
		Data: map[string]any{
			"action": "added",
			"count":  len(created),
		},
	})

	return created, nil
}

// processOne handles a single file: validate, copy, extract metadata, generate thumbnails.
func (p *Processor) processOne(ctx context.Context, sourcePath string, folderID *int) (*store.Image, error) {
	// Validate extension.
	ext := strings.ToLower(filepath.Ext(sourcePath))
	format, ok := supportedExtensions[ext]
	if !ok {
		return nil, fmt.Errorf("unsupported file format: %s", ext)
	}

	// Validate file exists.
	info, err := os.Stat(sourcePath)
	if err != nil {
		return nil, fmt.Errorf("stat source: %w", err)
	}

	// Compute checksum.
	checksum, err := computeChecksum(sourcePath)
	if err != nil {
		return nil, fmt.Errorf("checksum: %w", err)
	}

	// Extract dimensions.
	width, height, err := getImageDimensions(sourcePath)
	if err != nil {
		return nil, fmt.Errorf("dimensions: %w", err)
	}

	// Determine media type.
	mediaType := "image"
	if format == "gif" {
		mediaType = "gif"
	}

	// Copy file to images dir.
	name := filepath.Base(sourcePath)
	destPath := filepath.Join(p.imagesDir, name)

	// Handle filename collisions.
	destPath = system.UniquePath(destPath)

	if err := copyFile(sourcePath, destPath); err != nil {
		return nil, fmt.Errorf("copy file: %w", err)
	}

	// Extract dominant colors (non-fatal if it fails).
	colors, err := ExtractPalette(destPath, 5)
	if err != nil {
		slog.Warn("color palette extraction failed, continuing without colors",
			"path", destPath, "error", err)
		colors = []string{}
	}

	// Create the image record (without thumbnails first to get an ID).
	imgs, err := p.imageStore.Create(ctx, []store.Image{{
		Name:       strings.TrimSuffix(name, ext),
		Path:       destPath,
		MediaType:  mediaType,
		Width:      width,
		Height:     height,
		Format:     format,
		FileSize:   info.Size(),
		Checksum:   "sha256:" + checksum,
		Tags:       []string{},
		Colors:     colors,
		ImportedAt: time.Now(),
		SourcePath: sourcePath,
		IsSelected: false,
		FolderID:   folderID,
	}})
	if err != nil {
		return nil, fmt.Errorf("create record: %w", err)
	}
	img := &imgs[0]

	// Generate thumbnails.
	thumbnails, err := p.thumbnailer.Generate(destPath, img.ID)
	if err != nil {
		slog.Warn("thumbnail generation failed, continuing without thumbnails",
			"image_id", img.ID, "error", err)
	} else {
		img.Thumbnails = thumbnails
		_, _ = p.imageStore.Update(ctx, img.ID, map[string]any{"thumbnails": thumbnails})
	}

	return img, nil
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
