package image

import (
	"context"
	"fmt"
	"math"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"time"

	"log/slog"

	"waypaper-engine/daemon/internal/events"
	"waypaper-engine/daemon/internal/store"
	"waypaper-engine/daemon/internal/system"
)

// VideoLoopExportPreset selects output encoding.
const (
	VideoLoopPresetWebMVP9 = "webm_vp9"
	VideoLoopPresetMP4H264 = "mp4_h264"
)

// VideoLoopExportAction is how the result is applied to the gallery.
const (
	VideoLoopActionReplace   = "replace"
	VideoLoopActionImportNew = "import_new"
)

func presetOutputExt(preset string) (string, string, error) {
	switch strings.TrimSpace(strings.ToLower(preset)) {
	case VideoLoopPresetWebMVP9, "webm":
		return ".webm", "webm", nil
	case VideoLoopPresetMP4H264, "mp4":
		return ".mp4", "mp4", nil
	default:
		return "", "", fmt.Errorf("unsupported preset %q (use %q or %q)", preset, VideoLoopPresetWebMVP9, VideoLoopPresetMP4H264)
	}
}

// BuildVideoLoopFFmpegArgs returns argv for ffmpeg (excluding the leading "ffmpeg").
// Trims [inSec, outSec] on the input timeline and re-encodes for seamless native looping in WebKit.
func BuildVideoLoopFFmpegArgs(srcPath, dstPath string, inSec, outSec float64, preset string) ([]string, error) {
	if inSec < 0 || outSec <= inSec {
		return nil, fmt.Errorf("invalid trim range: in=%v out=%v", inSec, outSec)
	}
	_, _, err := presetOutputExt(preset)
	if err != nil {
		return nil, err
	}
	// Accurate trim: -ss/-to after -i (slower than input seek but frame-accurate for loop authoring).
	args := []string{
		"-hide_banner", "-loglevel", "error", "-y",
		"-i", srcPath,
		"-ss", fmt.Sprintf("%.6f", inSec),
		"-to", fmt.Sprintf("%.6f", outSec),
	}
	switch strings.TrimSpace(strings.ToLower(preset)) {
	case VideoLoopPresetWebMVP9, "webm":
		args = append(args,
			"-an",
			"-c:v", "libvpx-vp9", "-crf", "32", "-b:v", "0", "-row-mt", "1",
			dstPath,
		)
	case VideoLoopPresetMP4H264, "mp4":
		args = append(args,
			"-an",
			"-c:v", "libx264", "-preset", "fast", "-crf", "20", "-pix_fmt", "yuv420p",
			"-movflags", "+faststart",
			dstPath,
		)
	default:
		return nil, fmt.Errorf("unsupported preset %q", preset)
	}
	return args, nil
}

// xfadeHalvesFilterGraph builds a filter_complex that splits [inSec,outSec] at the midpoint,
// then crossfades the join (same idea as trimming two halves and xfading). Output duration is
// (outSec-inSec) minus the fade duration.
func xfadeHalvesFilterGraph(inSec, outSec float64) (graph string, fadeDur float64, err error) {
	L := outSec - inSec
	if L <= 0 {
		return "", 0, fmt.Errorf("invalid span for xfade")
	}
	// Fade length: ~10% of span, clamped so both halves stay longer than the fade.
	fd := math.Min(0.45, math.Max(0.05, L*0.10))
	if fd*2 >= L-1e-3 {
		return "", 0, fmt.Errorf("span too short for midpoint crossfade")
	}
	mid := inSec + L/2
	offset := L/2 - fd
	graph = fmt.Sprintf(
		"[0:v]trim=start=%.6f:end=%.6f,setpts=PTS-STARTPTS,format=yuv420p[v0];"+
			"[0:v]trim=start=%.6f:end=%.6f,setpts=PTS-STARTPTS,format=yuv420p[v1];"+
			"[v0][v1]xfade=transition=fade:duration=%.6f:offset=%.6f:format=yuv420p[outv]",
		inSec, mid, mid, outSec, fd, offset,
	)
	return graph, fd, nil
}

// BuildVideoLoopFFmpegXfadeHalvesArgs returns argv for a single-input midpoint xfade export.
func BuildVideoLoopFFmpegXfadeHalvesArgs(srcPath, dstPath string, inSec, outSec float64, preset string) ([]string, error) {
	if _, _, err := presetOutputExt(preset); err != nil {
		return nil, err
	}
	g, _, err := xfadeHalvesFilterGraph(inSec, outSec)
	if err != nil {
		return nil, err
	}
	args := []string{
		"-hide_banner", "-loglevel", "error", "-y",
		"-i", srcPath,
		"-filter_complex", g,
		"-map", "[outv]",
	}
	switch strings.TrimSpace(strings.ToLower(preset)) {
	case VideoLoopPresetWebMVP9, "webm":
		args = append(args,
			"-an",
			"-c:v", "libvpx-vp9", "-crf", "32", "-b:v", "0", "-row-mt", "1",
			dstPath,
		)
	case VideoLoopPresetMP4H264, "mp4":
		args = append(args,
			"-an",
			"-c:v", "libx264", "-preset", "fast", "-crf", "20", "-pix_fmt", "yuv420p",
			"-movflags", "+faststart",
			dstPath,
		)
	default:
		return nil, fmt.Errorf("unsupported preset %q", preset)
	}
	return args, nil
}

func runFFmpeg(ctx context.Context, argv []string) error {
	bin := resolveFFmpeg()
	if bin == "" {
		return fmt.Errorf("ffmpeg not found in PATH or standard locations")
	}
	cmd := exec.CommandContext(ctx, bin, argv...)
	out, err := cmd.CombinedOutput()
	if err != nil {
		if len(out) > 0 {
			return fmt.Errorf("ffmpeg: %w: %s", err, strings.TrimSpace(string(out)))
		}
		return fmt.Errorf("ffmpeg: %w", err)
	}
	return nil
}

// VideoLoopExport transcodes a trim of a library video for seamless native looping, then either
// replaces the row's media file in place (updating derived assets) or imports the result as a new row.
func (p *Processor) VideoLoopExport(
	ctx context.Context,
	imageID int,
	inSec, outSec float64,
	preset, action string,
	folderID *int,
	blendHalves bool,
) (map[string]any, error) {
	action = strings.TrimSpace(strings.ToLower(action))
	if action != VideoLoopActionReplace && action != VideoLoopActionImportNew {
		return nil, fmt.Errorf("invalid action %q (use %q or %q)", action, VideoLoopActionReplace, VideoLoopActionImportNew)
	}

	img, err := p.imageStore.GetByID(ctx, imageID)
	if err != nil {
		return nil, err
	}
	if !strings.EqualFold(strings.TrimSpace(img.MediaType), "video") {
		return nil, fmt.Errorf("not a video")
	}
	if resolveFFmpeg() == "" {
		return nil, fmt.Errorf("ffmpeg not available")
	}
	if resolveFFprobe() == "" {
		return nil, fmt.Errorf("ffprobe not available")
	}

	meta, err := probeVideo(img.Path)
	if err != nil {
		return nil, fmt.Errorf("probe video: %w", err)
	}
	if meta.Duration > 0 && outSec > meta.Duration+0.05 {
		outSec = meta.Duration
	}
	if inSec >= outSec {
		return nil, fmt.Errorf("invalid trim: in must be less than out")
	}

	outExt, format, err := presetOutputExt(preset)
	if err != nil {
		return nil, err
	}

	tmpDir := os.TempDir()
	staging := filepath.Join(tmpDir, fmt.Sprintf("waypaper-loop-%d-%d%s", imageID, time.Now().UnixNano(), outExt))
	defer func() { _ = os.Remove(staging) }()

	var argv []string
	var argvErr error
	if blendHalves {
		argv, argvErr = BuildVideoLoopFFmpegXfadeHalvesArgs(img.Path, staging, inSec, outSec, preset)
		if argvErr != nil {
			slog.Info("loop export: midpoint xfade unavailable, using plain trim", "error", argvErr)
			argv, argvErr = BuildVideoLoopFFmpegArgs(img.Path, staging, inSec, outSec, preset)
		}
	} else {
		argv, argvErr = BuildVideoLoopFFmpegArgs(img.Path, staging, inSec, outSec, preset)
	}
	if argvErr != nil {
		return nil, argvErr
	}
	if runErr := runFFmpeg(ctx, argv); runErr != nil {
		if blendHalves {
			slog.Warn("loop export: xfade ffmpeg failed, retrying plain trim", "error", runErr)
			trimArgs, trimErr := BuildVideoLoopFFmpegArgs(img.Path, staging, inSec, outSec, preset)
			if trimErr != nil {
				return nil, trimErr
			}
			if err := runFFmpeg(ctx, trimArgs); err != nil {
				return nil, err
			}
		} else {
			return nil, runErr
		}
	}

	// Move encoded bytes into gallery with a same-filesystem atomic rename when possible.
	atomicReplace := func(dst string) error {
		tmp := dst + ".wpe-new"
		if err := copyFile(staging, tmp); err != nil {
			return fmt.Errorf("write new media: %w", err)
		}
		_ = os.Remove(dst)
		if err := os.Rename(tmp, dst); err != nil {
			_ = os.Remove(tmp)
			return fmt.Errorf("activate new media: %w", err)
		}
		return nil
	}

	switch action {
	case VideoLoopActionImportNew:
		if err := os.MkdirAll(p.imagesDir, 0o755); err != nil {
			return nil, fmt.Errorf("images dir: %w", err)
		}
		destPath := system.UniquePath(filepath.Join(p.imagesDir, strings.TrimSuffix(filepath.Base(img.Path), filepath.Ext(img.Path))+"-loop"+outExt))
		if err := copyFile(staging, destPath); err != nil {
			return nil, fmt.Errorf("copy export to gallery: %w", err)
		}

		created, err := p.ingestSingleExportedVideo(ctx, destPath, filepath.Base(destPath), outExt, format, folderID)
		if err != nil {
			_ = os.Remove(destPath)
			return nil, err
		}
		p.bus.Publish(events.Event{
			Type: events.GalleryChanged,
			Data: map[string]any{"domain": "images"},
		})
		return map[string]any{
			"action":   VideoLoopActionImportNew,
			"image_id": created.ID,
			"path":     created.Path,
		}, nil

	case VideoLoopActionReplace:
		dir := filepath.Dir(img.Path)
		stem := strings.TrimSuffix(filepath.Base(img.Path), filepath.Ext(img.Path))
		finalPath := filepath.Join(dir, stem+outExt)
		if filepath.Clean(finalPath) != filepath.Clean(img.Path) {
			finalPath = system.UniquePath(finalPath)
		}
		if err := atomicReplace(finalPath); err != nil {
			return nil, err
		}
		if filepath.Clean(finalPath) != filepath.Clean(img.Path) {
			_ = os.Remove(img.Path)
		}

		if err := p.refreshVideoAfterReplace(ctx, imageID, finalPath, format); err != nil {
			return nil, err
		}
		updated, gerr := p.imageStore.GetByID(ctx, imageID)
		if gerr != nil {
			return nil, gerr
		}
		p.bus.Publish(events.Event{
			Type: events.GalleryChanged,
			Data: map[string]any{"domain": "images"},
		})
		return map[string]any{
			"action":   VideoLoopActionReplace,
			"image_id": imageID,
			"path":     updated.Path,
		}, nil
	default:
		return nil, fmt.Errorf("invalid action %q", action)
	}
}

func (p *Processor) ingestSingleExportedVideo(
	ctx context.Context,
	destPath, baseName, ext, format string,
	folderID *int,
) (*store.Image, error) {
	info, err := os.Stat(destPath)
	if err != nil {
		return nil, err
	}
	sum, err := computeChecksum(destPath)
	if err != nil {
		return nil, err
	}
	meta, err := probeVideo(destPath)
	if err != nil {
		return nil, err
	}
	imgs, err := p.imageStore.Create(ctx, []store.Image{{
		Name:         strings.TrimSuffix(baseName, ext),
		Path:         destPath,
		MediaType:    "video",
		Duration:     meta.Duration,
		AudioEnabled: meta.HasAudio,
		Width:        meta.Width,
		Height:       meta.Height,
		Format:       format,
		FileSize:     info.Size(),
		Checksum:     "sha256:" + sum,
		Tags:         []string{},
		Colors:       []string{},
		ImportedAt:   time.Now(),
		SourcePath:   destPath,
		IsSelected:   false,
		FolderID:     folderID,
	}})
	if err != nil {
		return nil, err
	}
	created := &imgs[0]
	if err := p.generateVideoThumbnailsAndPreview(ctx, created); err != nil {
		slog.Warn("loop export import: thumbnail/preview failed", "image_id", created.ID, "error", err)
	}
	return created, nil
}

func (p *Processor) generateVideoThumbnailsAndPreview(ctx context.Context, img *store.Image) error {
	if img.MediaType != "video" {
		return nil
	}
	meta, probeErr := probeVideo(img.Path)
	if probeErr != nil {
		slog.Warn("video probe failed after export", "image_id", img.ID, "error", probeErr)
	} else if meta.NeedsBrowserPreview {
		ppath, transErr := p.thumbnailer.WriteBrowserVideoPreview(img.Path, img.ID)
		if transErr != nil {
			slog.Warn("browser video preview transcode failed", "image_id", img.ID, "error", transErr)
		} else {
			img.PreviewPath = ppath
			if _, upErr := p.imageStore.Update(ctx, img.ID, map[string]any{"preview_path": ppath}); upErr != nil {
				slog.Warn("persist video preview path failed", "image_id", img.ID, "error", upErr)
			}
		}
	}
	thumbnails, err := p.thumbnailer.Generate(img.Path, img.ID, img.MediaType, img.PreviewPath)
	if err != nil {
		return fmt.Errorf("thumbnails: %w", err)
	}
	img.Thumbnails = thumbnails
	_, err = p.imageStore.Update(ctx, img.ID, map[string]any{"thumbnails": thumbnails})
	return err
}

func (p *Processor) refreshVideoAfterReplace(ctx context.Context, id int, newPath, format string) error {
	img, err := p.imageStore.GetByID(ctx, id)
	if err != nil {
		return err
	}
	if img.PreviewPath != "" {
		_ = os.Remove(img.PreviewPath)
	}
	info, err := os.Stat(newPath)
	if err != nil {
		return err
	}
	sum, err := computeChecksum(newPath)
	if err != nil {
		return err
	}
	meta, err := probeVideo(newPath)
	if err != nil {
		return err
	}
	updates := map[string]any{
		"path":          newPath,
		"format":        format,
		"file_size":     info.Size(),
		"checksum":      "sha256:" + sum,
		"duration":      meta.Duration,
		"width":         meta.Width,
		"height":        meta.Height,
		"audio_enabled": meta.HasAudio,
		"preview_path":  "",
		"thumbnails":    map[string]string{},
	}
	if _, err := p.imageStore.Update(ctx, id, updates); err != nil {
		return err
	}
	img.Path = newPath
	img.Format = format
	img.FileSize = info.Size()
	img.Checksum = "sha256:" + sum
	img.Duration = meta.Duration
	img.Width = meta.Width
	img.Height = meta.Height
	img.AudioEnabled = meta.HasAudio
	img.PreviewPath = ""
	img.Thumbnails = nil
	return p.generateVideoThumbnailsAndPreview(ctx, img)
}
