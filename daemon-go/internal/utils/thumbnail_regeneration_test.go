package utils

import (
	"os"
	"path/filepath"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestRegenerateThumbnails_EmptyRegistry(t *testing.T) {
	// Create temporary directories
	tempDir := t.TempDir()
	jsonDir := filepath.Join(tempDir, "json_store")
	tomlPath := filepath.Join(tempDir, "config.toml")
	thumbnailsDir := filepath.Join(tempDir, "thumbnails")

	// Create JSON store directory
	err := os.MkdirAll(jsonDir, 0755)
	require.NoError(t, err)

	// Create empty JSON registry
	jsonPath := filepath.Join(jsonDir, "images.json")
	err = os.WriteFile(jsonPath, []byte(`{"images": []}`), 0644)
	require.NoError(t, err)

	// Create minimal config
	configContent := `
[daemon]
thumbnails_dir = "` + thumbnailsDir + `"
`
	err = os.WriteFile(tomlPath, []byte(configContent), 0644)
	require.NoError(t, err)

	// Test with empty registry
	err = RegenerateThumbnails(jsonDir, tomlPath, nil)
	assert.NoError(t, err)
}

func TestRegenerateThumbnails_InvalidJSONPath(t *testing.T) {
	tempDir := t.TempDir()
	tomlPath := filepath.Join(tempDir, "config.toml")

	// Create minimal config
	configContent := `
[daemon]
thumbnails_dir = "/tmp/thumbnails"
`
	err := os.WriteFile(tomlPath, []byte(configContent), 0644)
	require.NoError(t, err)

	// Test with non-existent JSON directory
	err = RegenerateThumbnails("/nonexistent/path", tomlPath, nil)
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "failed to initialize JSON store")
}

func TestRegenerateThumbnails_InvalidTOMLPath(t *testing.T) {
	tempDir := t.TempDir()
	jsonDir := filepath.Join(tempDir, "json_store")

	// Create JSON store directory
	err := os.MkdirAll(jsonDir, 0755)
	require.NoError(t, err)

	// Test with non-existent TOML path
	err = RegenerateThumbnails(jsonDir, "/nonexistent/config.toml", nil)
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "failed to load configuration")
}

func TestRegenerateThumbnails_InvalidJSONContent(t *testing.T) {
	tempDir := t.TempDir()
	jsonDir := filepath.Join(tempDir, "json_store")
	tomlPath := filepath.Join(tempDir, "config.toml")
	thumbnailsDir := filepath.Join(tempDir, "thumbnails")

	// Create JSON store directory
	err := os.MkdirAll(jsonDir, 0755)
	require.NoError(t, err)

	// Create invalid JSON content
	jsonPath := filepath.Join(jsonDir, "images.json")
	err = os.WriteFile(jsonPath, []byte(`invalid json content`), 0644)
	require.NoError(t, err)

	// Create minimal config
	configContent := `
[daemon]
thumbnails_dir = "` + thumbnailsDir + `"
`
	err = os.WriteFile(tomlPath, []byte(configContent), 0644)
	require.NoError(t, err)

	// Test with invalid JSON
	err = RegenerateThumbnails(jsonDir, tomlPath, nil)
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "failed to load image registry")
}

func TestRegenerateThumbnails_InvalidTOMLContent(t *testing.T) {
	tempDir := t.TempDir()
	jsonDir := filepath.Join(tempDir, "json_store")
	tomlPath := filepath.Join(tempDir, "config.toml")

	// Create JSON store directory
	err := os.MkdirAll(jsonDir, 0755)
	require.NoError(t, err)

	// Create empty JSON registry
	jsonPath := filepath.Join(jsonDir, "images.json")
	err = os.WriteFile(jsonPath, []byte(`{"images": []}`), 0644)
	require.NoError(t, err)

	// Create invalid TOML content
	err = os.WriteFile(tomlPath, []byte(`invalid toml content`), 0644)
	require.NoError(t, err)

	// Test with invalid TOML
	err = RegenerateThumbnails(jsonDir, tomlPath, nil)
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "failed to load configuration")
}

func TestRegenerateThumbnails_MissingThumbnailsDir(t *testing.T) {
	tempDir := t.TempDir()
	jsonDir := filepath.Join(tempDir, "json_store")
	tomlPath := filepath.Join(tempDir, "config.toml")
	thumbnailsDir := filepath.Join(tempDir, "nonexistent", "thumbnails")

	// Create JSON store directory
	err := os.MkdirAll(jsonDir, 0755)
	require.NoError(t, err)

	// Create empty JSON registry
	jsonPath := filepath.Join(jsonDir, "images.json")
	err = os.WriteFile(jsonPath, []byte(`{"images": []}`), 0644)
	require.NoError(t, err)

	// Create config with non-existent thumbnails directory
	configContent := `
[daemon]
thumbnails_dir = "` + thumbnailsDir + `"
`
	err = os.WriteFile(tomlPath, []byte(configContent), 0644)
	require.NoError(t, err)

	// Test with missing thumbnails directory
	err = RegenerateThumbnails(jsonDir, tomlPath, nil)
	assert.NoError(t, err) // Should create the directory
}

func TestRegenerateThumbnails_NilLogger(t *testing.T) {
	tempDir := t.TempDir()
	jsonDir := filepath.Join(tempDir, "json_store")
	tomlPath := filepath.Join(tempDir, "config.toml")
	thumbnailsDir := filepath.Join(tempDir, "thumbnails")

	// Create JSON store directory
	err := os.MkdirAll(jsonDir, 0755)
	require.NoError(t, err)

	// Create empty JSON registry
	jsonPath := filepath.Join(jsonDir, "images.json")
	err = os.WriteFile(jsonPath, []byte(`{"images": []}`), 0644)
	require.NoError(t, err)

	// Create minimal config
	configContent := `
[daemon]
thumbnails_dir = "` + thumbnailsDir + `"
`
	err = os.WriteFile(tomlPath, []byte(configContent), 0644)
	require.NoError(t, err)

	// Test with nil logger
	err = RegenerateThumbnails(jsonDir, tomlPath, nil)
	assert.NoError(t, err)
}

func TestRegenerateThumbnails_EmptyPaths(t *testing.T) {
	// Test with empty paths
	err := RegenerateThumbnails("", "", nil)
	assert.Error(t, err)
}

func TestRegenerateThumbnails_ConcurrentAccess(t *testing.T) {
	tempDir := t.TempDir()
	jsonDir := filepath.Join(tempDir, "json_store")
	tomlPath := filepath.Join(tempDir, "config.toml")
	thumbnailsDir := filepath.Join(tempDir, "thumbnails")

	// Create JSON store directory
	err := os.MkdirAll(jsonDir, 0755)
	require.NoError(t, err)

	// Create empty JSON registry
	jsonPath := filepath.Join(jsonDir, "images.json")
	err = os.WriteFile(jsonPath, []byte(`{"images": []}`), 0644)
	require.NoError(t, err)

	// Create minimal config
	configContent := `
[daemon]
thumbnails_dir = "` + thumbnailsDir + `"
`
	err = os.WriteFile(tomlPath, []byte(configContent), 0644)
	require.NoError(t, err)

	// Test concurrent access (should not panic)
	done := make(chan error, 2)

	go func() {
		done <- RegenerateThumbnails(jsonDir, tomlPath, nil)
	}()

	go func() {
		done <- RegenerateThumbnails(jsonDir, tomlPath, nil)
	}()

	// Wait for both goroutines to complete
	err1 := <-done
	err2 := <-done

	// Both should succeed or fail gracefully
	assert.NoError(t, err1)
	assert.NoError(t, err2)
}
