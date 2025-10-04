package system

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"strconv"
	"syscall"
	"time"
)

// DaemonLock represents the daemon lock information
type DaemonLock struct {
	PID     int       `json:"pid"`
	Started time.Time `json:"started"`
	Version string    `json:"version"`
	Socket  string    `json:"socket"`
}

// LockManager handles daemon process locking
type LockManager struct {
	lockFile string
	pidFile  string
}

// NewLockManager creates a new lock manager
func NewLockManager(lockFile, pidFile string) *LockManager {
	return &LockManager{
		lockFile: lockFile,
		pidFile:  pidFile,
	}
}

// AcquireLock attempts to acquire the daemon lock
func (lm *LockManager) AcquireLock(version, socket string) error {
	// Check if lock file exists
	if lm.isLocked() {
		// Check if the existing lock is valid
		if lm.isLockValid() {
			return fmt.Errorf("daemon is already running (PID: %d)", lm.getLockedPID())
		}
		// Remove stale lock
		lm.removeStaleLock()
	}

	// Create lock file
	lock := DaemonLock{
		PID:     os.Getpid(),
		Started: time.Now(),
		Version: version,
		Socket:  socket,
	}

	// Write lock file
	if err := lm.writeLockFile(lock); err != nil {
		return fmt.Errorf("failed to write lock file: %w", err)
	}

	// Write PID file
	if err := lm.writePIDFile(); err != nil {
		// Clean up lock file if PID file creation fails
		lm.removeLock()
		return fmt.Errorf("failed to write PID file: %w", err)
	}

	return nil
}

// ReleaseLock releases the daemon lock
func (lm *LockManager) ReleaseLock() error {
	// Remove both lock and PID files
	lm.removeLock()
	lm.removePIDFile()
	return nil
}

// IsLocked checks if the daemon is locked
func (lm *LockManager) IsLocked() bool {
	return lm.isLocked() && lm.isLockValid()
}

// GetLockInfo returns information about the current lock
func (lm *LockManager) GetLockInfo() (*DaemonLock, error) {
	if !lm.isLocked() {
		return nil, fmt.Errorf("no lock file found")
	}

	if !lm.isLockValid() {
		return nil, fmt.Errorf("lock file is stale")
	}

	return lm.readLockFile()
}

// isLocked checks if a lock file exists
func (lm *LockManager) isLocked() bool {
	_, err := os.Stat(lm.lockFile)
	return !os.IsNotExist(err)
}

// isLockValid checks if the existing lock is valid
func (lm *LockManager) isLockValid() bool {
	lock, err := lm.readLockFile()
	if err != nil {
		return false
	}

	// Check if the process is still running
	if !lm.isProcessRunning(lock.PID) {
		return false
	}

	// Check if the lock is not too old (e.g., 24 hours)
	if time.Since(lock.Started) > 24*time.Hour {
		return false
	}

	return true
}

// getLockedPID returns the PID from the lock file
func (lm *LockManager) getLockedPID() int {
	lock, err := lm.readLockFile()
	if err != nil {
		return 0
	}
	return lock.PID
}

// removeStaleLock removes a stale lock file
func (lm *LockManager) removeStaleLock() {
	lm.removeLock()
	lm.removePIDFile()
}

// writeLockFile writes the lock information to file
func (lm *LockManager) writeLockFile(lock DaemonLock) error {
	// Create directory if it doesn't exist
	dir := filepath.Dir(lm.lockFile)
	if err := os.MkdirAll(dir, 0755); err != nil {
		return err
	}

	data, err := json.Marshal(lock)
	if err != nil {
		return err
	}

	return os.WriteFile(lm.lockFile, data, 0644)
}

// readLockFile reads the lock information from file
func (lm *LockManager) readLockFile() (*DaemonLock, error) {
	data, err := os.ReadFile(lm.lockFile)
	if err != nil {
		return nil, err
	}

	var lock DaemonLock
	if err := json.Unmarshal(data, &lock); err != nil {
		return nil, err
	}

	return &lock, nil
}

// writePIDFile writes the PID to file
func (lm *LockManager) writePIDFile() error {
	// Create directory if it doesn't exist
	dir := filepath.Dir(lm.pidFile)
	if err := os.MkdirAll(dir, 0755); err != nil {
		return err
	}

	pid := strconv.Itoa(os.Getpid())
	return os.WriteFile(lm.pidFile, []byte(pid), 0644)
}

// removeLock removes the lock file
func (lm *LockManager) removeLock() {
	os.Remove(lm.lockFile)
}

// removePIDFile removes the PID file
func (lm *LockManager) removePIDFile() {
	os.Remove(lm.pidFile)
}

// isProcessRunning checks if a process with the given PID is running
func (lm *LockManager) isProcessRunning(pid int) bool {
	// Try to send signal 0 to check if process exists
	process, err := os.FindProcess(pid)
	if err != nil {
		return false
	}

	// Send signal 0 to check if process is running
	err = process.Signal(syscall.Signal(0))
	return err == nil
}
