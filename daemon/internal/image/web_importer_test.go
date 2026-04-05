package image_test

import (
	"context"
	"os"
	"path/filepath"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"waypaper-engine/daemon/internal/image"
	"waypaper-engine/daemon/internal/testutil"
)

// 1×1 PNG (valid image for thumbnail pipeline).
var tinyPNG = []byte{
	0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
	0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, 0x08, 0x06, 0x00, 0x00, 0x00, 0x1f, 0x15, 0xc4,
	0x89, 0x00, 0x00, 0x00, 0x0a, 0x49, 0x44, 0x41, 0x54, 0x78, 0x9c, 0x63, 0x00, 0x01, 0x00, 0x00,
	0x05, 0x00, 0x01, 0x0d, 0x0a, 0x2d, 0xb4, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4e, 0x44, 0xae,
	0x42, 0x60, 0x82,
}

func TestImportWebWallpaper_RequiresPreview(t *testing.T) {
	ctx := context.Background()
	tmpSrc := t.TempDir()
	require.NoError(t, os.WriteFile(filepath.Join(tmpSrc, "index.html"), []byte("<html></html>"), 0o644))
	require.NoError(t, os.WriteFile(filepath.Join(tmpSrc, "waypaper.json"), []byte(`{"entry":"index.html","title":"t"}`), 0o644))

	db := testutil.OpenTestDB(t)
	p := image.NewProcessor(db.ImageStore(), nil, t.TempDir(), t.TempDir(), nil)

	_, err := p.ImportWebWallpaper(ctx, tmpSrc, nil)
	require.Error(t, err)
	assert.Contains(t, err.Error(), "preview")
}

func TestImportWebWallpaper_RejectsAbsoluteEntryFixture(t *testing.T) {
	ctx := context.Background()
	fixture := filepath.Join("testdata", "malicious_path_traversal", "abs_entry")
	db := testutil.OpenTestDB(t)
	p := image.NewProcessor(db.ImageStore(), nil, t.TempDir(), t.TempDir(), nil)

	_, err := p.ImportWebWallpaper(ctx, fixture, nil)
	require.Error(t, err)
	assert.Contains(t, err.Error(), "web entry")
	assert.Contains(t, err.Error(), "absolute")
}

func TestImportWebWallpaper_RejectsPreviewTraversalFixture(t *testing.T) {
	ctx := context.Background()
	fixture := filepath.Join("testdata", "malicious_path_traversal", "bad_preview")
	db := testutil.OpenTestDB(t)
	p := image.NewProcessor(db.ImageStore(), nil, t.TempDir(), t.TempDir(), nil)

	_, err := p.ImportWebWallpaper(ctx, fixture, nil)
	require.Error(t, err)
	assert.Contains(t, err.Error(), "web preview")
	assert.Contains(t, err.Error(), "escapes")
}

func TestImportWebWallpaper_WithPreview(t *testing.T) {
	ctx := context.Background()
	tmpSrc := t.TempDir()
	require.NoError(t, os.WriteFile(filepath.Join(tmpSrc, "index.html"), []byte("<html></html>"), 0o644))
	require.NoError(t, os.WriteFile(filepath.Join(tmpSrc, "thumb.png"), tinyPNG, 0o644))
	manifest := `{"entry":"index.html","preview":"thumb.png","title":"WebPkg"}`
	require.NoError(t, os.WriteFile(filepath.Join(tmpSrc, "waypaper.json"), []byte(manifest), 0o644))

	db := testutil.OpenTestDB(t)
	imagesDir := t.TempDir()
	thumbsDir := t.TempDir()
	p := image.NewProcessor(db.ImageStore(), nil, imagesDir, thumbsDir, nil)

	img, err := p.ImportWebWallpaper(ctx, tmpSrc, nil)
	require.NoError(t, err)
	require.NotNil(t, img)
	assert.Equal(t, "web", img.MediaType)
	assert.NotEmpty(t, img.PreviewPath)
}
