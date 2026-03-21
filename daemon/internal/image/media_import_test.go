package image

import (
	"os"
	"path/filepath"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestMediaTypeForExt(t *testing.T) {
	assert.Equal(t, "video", mediaTypeForExt(".mp4", "mp4"))
	assert.Equal(t, "gif", mediaTypeForExt(".gif", "gif"))
	assert.Equal(t, "image", mediaTypeForExt(".png", "png"))
}

func TestResolveManifestPath_Directory(t *testing.T) {
	tmpDir := t.TempDir()
	manifest := filepath.Join(tmpDir, "waypaper.json")
	require.NoError(t, os.WriteFile(manifest, []byte(`{"entry":"index.html"}`), 0o644))

	root, resolvedManifest, err := resolveManifestPath(tmpDir)
	require.NoError(t, err)
	assert.Equal(t, tmpDir, root)
	assert.Equal(t, manifest, resolvedManifest)
}

func TestResolveManifestPath_ManifestFile(t *testing.T) {
	tmpDir := t.TempDir()
	manifest := filepath.Join(tmpDir, "project.json")
	require.NoError(t, os.WriteFile(manifest, []byte(`{"entry":"index.html"}`), 0o644))

	root, resolvedManifest, err := resolveManifestPath(manifest)
	require.NoError(t, err)
	assert.Equal(t, tmpDir, root)
	assert.Equal(t, manifest, resolvedManifest)
}

func TestResolveManifestPath_MissingManifest(t *testing.T) {
	tmpDir := t.TempDir()
	_, _, err := resolveManifestPath(tmpDir)
	require.Error(t, err)
	assert.Contains(t, err.Error(), "no waypaper.json or project.json")
}
