package system

import (
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func lockPath(t *testing.T) string {
	t.Helper()
	return filepath.Join(t.TempDir(), "test.pid")
}

func TestLockFile_AcquireRelease(t *testing.T) {
	p := lockPath(t)
	lf := NewLockFile(p)

	require.NoError(t, lf.Acquire())

	data, err := os.ReadFile(p)
	require.NoError(t, err)
	pid, err := strconv.Atoi(strings.TrimSpace(string(data)))
	require.NoError(t, err)
	assert.Equal(t, os.Getpid(), pid)

	require.NoError(t, lf.Release())
	_, err = os.Stat(p)
	assert.True(t, os.IsNotExist(err), "lock file should be removed after Release")
}

func TestLockFile_Path(t *testing.T) {
	p := "/some/path/test.pid"
	lf := NewLockFile(p)

	assert.Equal(t, p, lf.Path())
}

func TestLockFile_AcquireTwice(t *testing.T) {
	p := lockPath(t)
	lf := NewLockFile(p)

	require.NoError(t, lf.Acquire())
	err := lf.Acquire()
	require.Error(t, err)
	assert.ErrorIs(t, err, ErrAlreadyRunning)
}

func TestLockFile_ReleaseWithoutAcquire(t *testing.T) {
	p := filepath.Join(t.TempDir(), "nonexistent.pid")
	lf := NewLockFile(p)

	assert.NoError(t, lf.Release())
}

func TestLockFile_ReleaseIdempotent(t *testing.T) {
	p := lockPath(t)
	lf := NewLockFile(p)

	require.NoError(t, lf.Acquire())
	require.NoError(t, lf.Release())
	assert.NoError(t, lf.Release(), "second Release should not error")
}

func TestLockFile_StaleCleanup(t *testing.T) {
	p := lockPath(t)

	require.NoError(t, os.WriteFile(p, []byte("999999\n"), 0600))

	lf := NewLockFile(p)
	require.NoError(t, lf.Acquire(), "Acquire should succeed after removing stale lock")

	data, err := os.ReadFile(p)
	require.NoError(t, err)
	pid, err := strconv.Atoi(strings.TrimSpace(string(data)))
	require.NoError(t, err)
	assert.Equal(t, os.Getpid(), pid, "lock should contain our PID")
}
