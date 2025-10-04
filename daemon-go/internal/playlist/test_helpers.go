package playlist

import (
	"context"
	"log/slog"
	"os"
	"sync"
)

// MockBackendManager mocks the backend.BackendManager for testing
type MockBackendManager struct {
	setWallpaperCalls []SetWallpaperCall
	mu                sync.Mutex
}

// SetWallpaperCall records a call to SetWallpaper
type SetWallpaperCall struct {
	ImagePath   string
	MonitorName string
}

// SetWallpaper mocks the SetWallpaper method
func (m *MockBackendManager) SetWallpaper(ctx context.Context, imagePath, monitorName string) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	m.setWallpaperCalls = append(m.setWallpaperCalls, SetWallpaperCall{
		ImagePath:   imagePath,
		MonitorName: monitorName,
	})

	return nil
}

// GetSetWallpaperCalls returns the recorded calls (thread-safe)
func (m *MockBackendManager) GetSetWallpaperCalls() []SetWallpaperCall {
	m.mu.Lock()
	defer m.mu.Unlock()

	// Return a copy to avoid data races
	calls := make([]SetWallpaperCall, len(m.setWallpaperCalls))
	copy(calls, m.setWallpaperCalls)
	return calls
}

// ResetCalls clears all recorded calls
func (m *MockBackendManager) ResetCalls() {
	m.mu.Lock()
	defer m.mu.Unlock()

	m.setWallpaperCalls = make([]SetWallpaperCall, 0)
}

// testLogger is a simple logger for tests (only show errors)
var testLogger = slog.New(slog.NewTextHandler(os.Stdout, &slog.HandlerOptions{
	Level: slog.LevelError, // Only show errors in tests
}))
