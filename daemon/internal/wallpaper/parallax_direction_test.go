package wallpaper

import (
	"os"
	"path/filepath"
	"testing"

	"waypaper-engine/daemon/internal/store"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestParallaxDirectionOverrideFromImage(t *testing.T) {
	assert.Equal(t, "", ParallaxDirectionOverrideFromImage(nil))

	dir := t.TempDir()
	manifest := filepath.Join(dir, "waypaper.json")
	require.NoError(t, os.WriteFile(manifest, []byte(`{"waypaper":"1","parallax_direction":"vertical"}`), 0o644))

	img := &store.Image{
		WebMeta: &store.WebMeta{
			ManifestPath: manifest,
		},
	}
	assert.Equal(t, "vertical", ParallaxDirectionOverrideFromImage(img))

	require.NoError(t, os.WriteFile(manifest, []byte(`{"waypaper":"1"}`), 0o644))
	assert.Equal(t, "", ParallaxDirectionOverrideFromImage(img))
}
