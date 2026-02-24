package system

import (
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// ---------------------------------------------------------------------------
// ExpandPath
// ---------------------------------------------------------------------------

func TestExpandPath_Empty(t *testing.T) {
	assert.Equal(t, "", ExpandPath(""))
}

func TestExpandPath_Tilde(t *testing.T) {
	home, err := os.UserHomeDir()
	require.NoError(t, err)

	got := ExpandPath("~/foo")

	assert.True(t, strings.HasPrefix(got, home), "expected prefix %q, got %q", home, got)
	assert.True(t, strings.HasSuffix(got, "/foo"), "expected suffix /foo, got %q", got)
}

func TestExpandPath_TildeAlone(t *testing.T) {
	home, err := os.UserHomeDir()
	require.NoError(t, err)

	assert.Equal(t, home, ExpandPath("~"))
}

func TestExpandPath_EnvVar(t *testing.T) {
	t.Setenv("TEST_WP_DIR", "/tmp/test")

	got := ExpandPath("$TEST_WP_DIR/sub")

	assert.Equal(t, "/tmp/test/sub", got)
}

func TestExpandPath_CleansDots(t *testing.T) {
	assert.Equal(t, "/foo/baz", ExpandPath("/foo/bar/../baz"))
}

// ---------------------------------------------------------------------------
// EnsureDir
// ---------------------------------------------------------------------------

func TestEnsureDir_Creates(t *testing.T) {
	dir := filepath.Join(t.TempDir(), "newdir")

	err := EnsureDir(dir)

	require.NoError(t, err)
	info, statErr := os.Stat(dir)
	require.NoError(t, statErr)
	assert.True(t, info.IsDir())
}

func TestEnsureDir_Nested(t *testing.T) {
	dir := filepath.Join(t.TempDir(), "a", "b", "c")

	err := EnsureDir(dir)

	require.NoError(t, err)
	info, statErr := os.Stat(dir)
	require.NoError(t, statErr)
	assert.True(t, info.IsDir())
}

func TestEnsureDir_ExistingIsNoop(t *testing.T) {
	dir := t.TempDir()

	assert.NoError(t, EnsureDir(dir))
	assert.NoError(t, EnsureDir(dir))
}

// ---------------------------------------------------------------------------
// UniquePath
// ---------------------------------------------------------------------------

func TestUniquePath_NoConflict(t *testing.T) {
	p := filepath.Join(t.TempDir(), "nonexistent.png")

	assert.Equal(t, p, UniquePath(p))
}

func TestUniquePath_Conflict(t *testing.T) {
	dir := t.TempDir()
	p := filepath.Join(dir, "file.png")
	require.NoError(t, os.WriteFile(p, []byte("x"), 0644))

	got := UniquePath(p)

	expected := filepath.Join(dir, "file_1.png")
	assert.Equal(t, expected, got)
}

func TestUniquePath_MultipleConflicts(t *testing.T) {
	dir := t.TempDir()
	p := filepath.Join(dir, "file.png")
	require.NoError(t, os.WriteFile(p, []byte("x"), 0644))
	require.NoError(t, os.WriteFile(filepath.Join(dir, "file_1.png"), []byte("x"), 0644))

	got := UniquePath(p)

	expected := filepath.Join(dir, "file_2.png")
	assert.Equal(t, expected, got)
}

// ---------------------------------------------------------------------------
// RuntimeDir / DataHome / DefaultSocketPath
// ---------------------------------------------------------------------------

func TestRuntimeDir_WithEnv(t *testing.T) {
	t.Setenv("XDG_RUNTIME_DIR", "/run/user/test")

	assert.Equal(t, "/run/user/test", RuntimeDir())
}

func TestRuntimeDir_Fallback(t *testing.T) {
	t.Setenv("XDG_RUNTIME_DIR", "")

	got := RuntimeDir()

	assert.Contains(t, got, "waypaper-engine-")
}

func TestDataHome_WithEnv(t *testing.T) {
	t.Setenv("XDG_DATA_HOME", "/custom/data")

	got := DataHome()

	assert.Equal(t, "/custom/data/waypaper-engine", got)
}

func TestDefaultSocketPath_Format(t *testing.T) {
	got := DefaultSocketPath()

	assert.Contains(t, got, "waypaper-engine.sock")
}
