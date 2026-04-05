package pathsecure

import (
	"os"
	"path/filepath"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestMustResolveUnder_ok(t *testing.T) {
	root := t.TempDir()
	f := filepath.Join(root, "a.html")
	require.NoError(t, os.WriteFile(f, []byte("x"), 0o644))

	got, err := MustResolveUnder(root, "a.html")
	require.NoError(t, err)
	assert.Equal(t, f, got)
}

func TestMustResolveUnder_rejectsAbsolute(t *testing.T) {
	root := t.TempDir()
	_, err := MustResolveUnder(root, "/etc/passwd")
	require.Error(t, err)
	assert.Contains(t, err.Error(), "relative")
}

func TestMustResolveUnder_rejectsLexicalEscape(t *testing.T) {
	root := t.TempDir()
	out := filepath.Join(t.TempDir(), "outside.txt")
	require.NoError(t, os.WriteFile(out, []byte("x"), 0o644))

	rel, err := filepath.Rel(root, out)
	require.NoError(t, err)
	_, err = MustResolveUnder(root, rel)
	require.Error(t, err)
	assert.Contains(t, err.Error(), "escapes")
}

func TestMustResolveUnder_rejectsSymlinkOutside(t *testing.T) {
	root := t.TempDir()
	outside := filepath.Join(t.TempDir(), "target.html")
	require.NoError(t, os.WriteFile(outside, []byte("x"), 0o644))
	link := filepath.Join(root, "link.html")
	require.NoError(t, os.Symlink(outside, link))

	_, err := MustResolveUnder(root, "link.html")
	require.Error(t, err)
	assert.Contains(t, err.Error(), "symlink")
}
