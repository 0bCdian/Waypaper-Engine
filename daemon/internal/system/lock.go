package system

import (
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"syscall"
)

// ErrAlreadyRunning is returned when another daemon instance holds the lock.
var ErrAlreadyRunning = errors.New("another daemon instance is already running")

// LockFile manages a PID-based lock file to prevent multiple daemon instances.
type LockFile struct {
	path string
}

// NewLockFile creates a LockFile that will be stored at the given path.
// The parent directory is created automatically.
func NewLockFile(path string) *LockFile {
	return &LockFile{path: path}
}

// DefaultLockPath returns the default lock file location:
// $XDG_RUNTIME_DIR/<appName>.pid
func DefaultLockPath() string {
	return filepath.Join(RuntimeDir(), appName+".pid")
}

// Acquire attempts to create the PID file. If a lock file already exists
// and the process it references is still alive, ErrAlreadyRunning is returned.
// Stale lock files (where the referenced process no longer exists) are removed
// automatically before creating a new one.
func (l *LockFile) Acquire() error {
	if err := EnsureParentDir(l.path); err != nil {
		return fmt.Errorf("lock: ensure parent dir: %w", err)
	}

	// Check for existing lock file.
	data, err := os.ReadFile(l.path)
	if err == nil {
		pidStr := strings.TrimSpace(string(data))
		if pid, parseErr := strconv.Atoi(pidStr); parseErr == nil {
			if processAlive(pid) {
				return fmt.Errorf("%w (pid %d, lock file %s)", ErrAlreadyRunning, pid, l.path)
			}
		}
		// Stale lock — remove it.
		_ = os.Remove(l.path)
	}

	// Write our PID.
	pid := os.Getpid()
	if err := os.WriteFile(l.path, []byte(strconv.Itoa(pid)+"\n"), 0600); err != nil {
		return fmt.Errorf("lock: write pid file %s: %w", l.path, err)
	}

	return nil
}

// Release removes the lock file. It is safe to call multiple times.
// Only removes the file if it contains our own PID, to avoid race conditions.
func (l *LockFile) Release() error {
	data, err := os.ReadFile(l.path)
	if err != nil {
		if errors.Is(err, os.ErrNotExist) {
			return nil
		}
		return fmt.Errorf("lock: read pid file for release: %w", err)
	}

	pidStr := strings.TrimSpace(string(data))
	pid, parseErr := strconv.Atoi(pidStr)
	if parseErr != nil || pid != os.Getpid() {
		// Not our lock file — don't remove it.
		return nil
	}

	if err := os.Remove(l.path); err != nil && !errors.Is(err, os.ErrNotExist) {
		return fmt.Errorf("lock: remove pid file %s: %w", l.path, err)
	}
	return nil
}

// Path returns the absolute path to the lock file.
func (l *LockFile) Path() string {
	return l.path
}

// processAlive checks whether a process with the given PID is currently running.
// Sends signal 0 which doesn't actually deliver a signal but checks if the
// process exists and we have permission to signal it.
func processAlive(pid int) bool {
	proc, err := os.FindProcess(pid)
	if err != nil {
		return false
	}
	err = proc.Signal(syscall.Signal(0))
	return err == nil
}
