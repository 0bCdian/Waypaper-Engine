package image

import (
	"context"
	"crypto/sha256"
	"encoding/json"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"strings"
	"time"

	"waypaper-engine/daemon/internal/store"
	"waypaper-engine/daemon/internal/system"
)

type webManifest struct {
	Title        string          `json:"title"`
	Description  string          `json:"description"`
	Author       string          `json:"author"`
	Entry        string          `json:"entry"`
	Preview      string          `json:"preview"`
	Capabilities webCapabilities `json:"capabilities"`
	Properties   json.RawMessage `json:"properties"`
}

type webCapabilities struct {
	Network       bool `json:"network"`
	Keyboard      bool `json:"keyboard"`
	AudioReactive bool `json:"audio_reactive"`
	ParallaxAware bool `json:"parallax_aware"`
}

// ImportWebWallpaper imports a web wallpaper package from a directory or manifest path.
func (p *Processor) ImportWebWallpaper(ctx context.Context, sourcePath string, folderID *int) (*store.Image, error) {
	resolvedPath, manifestPath, err := resolveManifestPath(sourcePath)
	if err != nil {
		return nil, err
	}

	manifestRaw, err := os.ReadFile(manifestPath)
	if err != nil {
		return nil, fmt.Errorf("read web manifest: %w", err)
	}

	var manifest webManifest
	if err := json.Unmarshal(manifestRaw, &manifest); err != nil {
		return nil, fmt.Errorf("parse web manifest: %w", err)
	}
	if strings.TrimSpace(manifest.Entry) == "" {
		return nil, fmt.Errorf("web manifest entry is required")
	}

	entryPath := filepath.Join(resolvedPath, manifest.Entry)
	if _, err := os.Stat(entryPath); err != nil {
		return nil, fmt.Errorf("web entry file not found: %w", err)
	}

	if err := os.MkdirAll(p.imagesDir, 0o755); err != nil {
		return nil, fmt.Errorf("create images dir: %w", err)
	}

	targetDir := system.UniquePath(filepath.Join(p.imagesDir, filepath.Base(resolvedPath)))
	if err := copyDirectory(resolvedPath, targetDir); err != nil {
		return nil, fmt.Errorf("copy web package: %w", err)
	}

	copiedEntryPath := filepath.Join(targetDir, manifest.Entry)
	previewPath := ""
	if strings.TrimSpace(manifest.Preview) != "" {
		candidate := filepath.Join(targetDir, manifest.Preview)
		if _, err := os.Stat(candidate); err == nil {
			previewPath = candidate
		}
	}

	checksumBytes := sha256.Sum256(manifestRaw)
	imageName := strings.TrimSpace(manifest.Title)
	if imageName == "" {
		imageName = filepath.Base(targetDir)
	}

	created, err := p.imageStore.Create(ctx, []store.Image{{
		Name:        imageName,
		Path:        copiedEntryPath,
		MediaType:   "web",
		Width:       0,
		Height:      0,
		Format:      "html",
		FileSize:    dirSize(targetDir),
		Checksum:    "sha256:" + fmt.Sprintf("%x", checksumBytes[:]),
		Tags:        []string{},
		Colors:      []string{},
		ImportedAt:  time.Now(),
		SourcePath:  sourcePath,
		IsSelected:  false,
		Thumbnails:  map[string]string{},
		PreviewPath: previewPath,
		FolderID:    folderID,
		WebMeta: &store.WebMeta{
			PackageRoot:  targetDir,
			ManifestPath: filepath.Join(targetDir, filepath.Base(manifestPath)),
			EntryPath:    copiedEntryPath,
			Title:        manifest.Title,
			Description:  manifest.Description,
			Author:       manifest.Author,
			Capabilities: store.WebCapabilities{
				Network:       manifest.Capabilities.Network,
				Keyboard:      manifest.Capabilities.Keyboard,
				AudioReactive: manifest.Capabilities.AudioReactive,
				ParallaxAware: manifest.Capabilities.ParallaxAware,
			},
			Properties: manifest.Properties,
		},
	}})
	if err != nil {
		return nil, fmt.Errorf("create web image record: %w", err)
	}

	record := created[0]
	thumbs, thumbErr := p.thumbnailer.Generate(record.Path, record.ID, record.MediaType, record.PreviewPath)
	if thumbErr == nil {
		record.Thumbnails = thumbs
		if _, err := p.imageStore.Update(ctx, record.ID, map[string]any{"thumbnails": thumbs}); err != nil {
			return nil, fmt.Errorf("persist web thumbnails: %w", err)
		}
	}

	return &record, nil
}

func resolveManifestPath(sourcePath string) (packageRoot string, manifestPath string, err error) {
	info, err := os.Stat(sourcePath)
	if err != nil {
		return "", "", fmt.Errorf("stat source path: %w", err)
	}
	if !info.IsDir() {
		base := strings.ToLower(filepath.Base(sourcePath))
		if base == "waypaper.json" || base == "project.json" {
			return filepath.Dir(sourcePath), sourcePath, nil
		}
		return "", "", fmt.Errorf("web import path must be a directory or waypaper.json/project.json")
	}

	for _, manifest := range []string{"waypaper.json", "project.json"} {
		candidate := filepath.Join(sourcePath, manifest)
		if _, err := os.Stat(candidate); err == nil {
			return sourcePath, candidate, nil
		}
	}
	return "", "", fmt.Errorf("no waypaper.json or project.json found in %s", sourcePath)
}

func copyDirectory(src, dst string) error {
	return filepath.Walk(src, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return err
		}
		rel, err := filepath.Rel(src, path)
		if err != nil {
			return err
		}
		targetPath := filepath.Join(dst, rel)
		if info.IsDir() {
			return os.MkdirAll(targetPath, 0o755)
		}
		if err := os.MkdirAll(filepath.Dir(targetPath), 0o755); err != nil {
			return err
		}
		in, err := os.Open(path)
		if err != nil {
			return err
		}
		defer in.Close()
		out, err := os.Create(targetPath)
		if err != nil {
			return err
		}
		defer out.Close()
		if _, err := io.Copy(out, in); err != nil {
			return err
		}
		return out.Sync()
	})
}

func dirSize(root string) int64 {
	var total int64
	_ = filepath.Walk(root, func(path string, info os.FileInfo, err error) error {
		if err != nil || info == nil || info.IsDir() {
			return nil
		}
		total += info.Size()
		return nil
	})
	return total
}
