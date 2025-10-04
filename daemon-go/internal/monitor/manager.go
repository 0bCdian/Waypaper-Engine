package monitor

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log/slog"
	"os"
	"os/exec"
	"path/filepath"
	"sort"
	"strings"
	"sync"
	"time"

	"waypaper-engine/daemon-go/internal/backend"
	"waypaper-engine/daemon-go/internal/db"
	"waypaper-engine/daemon-go/internal/models"
)

var (
	ErrMonitorNotFound = errors.New("monitor not found")
)

// Manager handles all monitor state and operations
type Manager struct {
	backendManager *backend.BackendManager
	monitors       map[string]*models.Monitor
	activeMonitor  *models.ActiveMonitor
	mutex          sync.RWMutex
	logger         *slog.Logger
	db             *db.Queries

	// Monitor change detection
	lastKnownMonitors map[string]*models.Monitor
	changeCallback    func([]models.Monitor)

	// Configuration paths
	imagesDir         string
	thumbnailsDir     string
	monitorsStateFile string
}

// NewManager creates a new monitor manager
func NewManager(backendManager *backend.BackendManager, db *db.Queries, logger *slog.Logger) *Manager {
	return &Manager{
		backendManager:    backendManager,
		monitors:          make(map[string]*models.Monitor),
		lastKnownMonitors: make(map[string]*models.Monitor),
		logger:            logger,
		db:                db,
	}
}

// Start begins monitoring for display changes
func (m *Manager) Start(ctx context.Context) error {
	m.logger.Info("Starting monitor manager")

	// Load active monitor configuration from database
	err := m.loadActiveMonitorFromDB()
	if err != nil {
		m.logger.Warn("Failed to load active monitor from database", "error", err)
		// Continue without active monitor - it will be set when user selects one
	}

	// Load monitor state from JSON file if it exists (before refresh to preserve state)
	if err := m.loadMonitorStateFromFile(); err != nil {
		m.logger.Warn("Failed to load monitor state from file", "error", err)
		// Continue without monitor state - it will be created as images are set
	}

	// Initial monitor discovery
	if err := m.refreshMonitors(ctx); err != nil {
		return err
	}

	// Start periodic monitoring
	go m.monitorLoop(ctx)

	return nil
}

// StartWithConfig starts the monitor manager with custom paths from configuration
func (m *Manager) StartWithConfig(ctx context.Context, imagesDir, thumbnailsDir, monitorsStateFile string) error {
	m.logger.Info("Starting monitor manager with config", "imagesDir", imagesDir, "thumbnailsDir", thumbnailsDir, "monitorsStateFile", monitorsStateFile)

	// Set custom paths
	m.imagesDir = imagesDir
	m.thumbnailsDir = thumbnailsDir
	m.monitorsStateFile = monitorsStateFile

	// Load active monitor configuration from database
	err := m.loadActiveMonitorFromDB()
	if err != nil {
		m.logger.Warn("Failed to load active monitor from database", "error", err)
		// Continue without active monitor - it will be set when user selects one
	}

	// Load monitor state from JSON file if it exists (before refresh to preserve state)
	if err := m.loadMonitorStateFromFile(); err != nil {
		m.logger.Warn("Failed to load monitor state from file", "error", err)
		// Continue without monitor state - it will be created as images are set
	}

	// Initial monitor discovery
	if err := m.refreshMonitors(ctx); err != nil {
		return err
	}

	// Start periodic monitoring
	go m.monitorLoop(ctx)

	return nil
}

// GetMonitors returns all known monitors
func (m *Manager) GetMonitors() []models.Monitor {
	m.mutex.RLock()
	defer m.mutex.RUnlock()

	monitors := make([]models.Monitor, 0, len(m.monitors))
	for _, monitor := range m.monitors {
		monitors = append(monitors, *monitor)
	}

	// Sort monitors by position (left to right, top to bottom)
	sort.Slice(monitors, func(i, j int) bool {
		if monitors[i].Position.Y != monitors[j].Position.Y {
			return monitors[i].Position.Y < monitors[j].Position.Y
		}
		return monitors[i].Position.X < monitors[j].Position.X
	})

	return monitors
}

// GetActiveMonitor returns the current active monitor configuration
func (m *Manager) GetActiveMonitor() *models.ActiveMonitor {
	m.mutex.RLock()
	defer m.mutex.RUnlock()

	if m.activeMonitor == nil {
		return nil
	}

	// Create a copy of the active monitor and populate currentImage from monitor state
	activeMonitorCopy := *m.activeMonitor
	activeMonitorCopy.Monitors = make([]models.Monitor, len(m.activeMonitor.Monitors))

	for i, monitor := range m.activeMonitor.Monitors {
		activeMonitorCopy.Monitors[i] = monitor
		// Update currentImage from the in-memory monitor state
		if existingMonitor, exists := m.monitors[monitor.Name]; exists {
			activeMonitorCopy.Monitors[i].CurrentImage = existingMonitor.CurrentImage
		}
	}

	return &activeMonitorCopy
}

// loadActiveMonitorFromDB loads the active monitor configuration from the database
func (m *Manager) loadActiveMonitorFromDB() error {
	// Skip database loading if using JSON store mode
	if m.db == nil {
		m.logger.Info("Using JSON store mode, skipping database monitor loading")
		return nil
	}

	ctx := context.Background()

	// Try to get the selected monitor from database
	monitorConfig, err := m.db.GetSelectedMonitor(ctx)
	if err != nil {
		// No active monitor configured yet - this is normal on first run
		return nil
	}

	// Deserialize the active monitor configuration
	var activeMonitor models.ActiveMonitor
	err = json.Unmarshal([]byte(monitorConfig), &activeMonitor)
	if err != nil {
		return fmt.Errorf("failed to deserialize active monitor config: %w", err)
	}

	// Set the active monitor in memory
	m.activeMonitor = &activeMonitor
	m.logger.Info("Loaded active monitor configuration from database",
		"name", activeMonitor.Name,
		"monitors", len(activeMonitor.Monitors),
		"extend", activeMonitor.ExtendAcrossMonitors)

	return nil
}

// SetActiveMonitor sets the active monitor configuration
func (m *Manager) SetActiveMonitor(activeMonitor *models.ActiveMonitor) error {
	m.mutex.Lock()
	defer m.mutex.Unlock()

	// Serialize the active monitor configuration to JSON
	configJSON, err := json.Marshal(activeMonitor)
	if err != nil {
		return fmt.Errorf("failed to serialize active monitor config: %w", err)
	}

	// Store in database (skip if using JSON store mode)
	if m.db != nil {
		ctx := context.Background()
		err = m.db.SetSelectedMonitor(ctx, string(configJSON))
		if err != nil {
			return fmt.Errorf("failed to persist active monitor config: %w", err)
		}
	} else {
		m.logger.Info("Using JSON store mode, skipping database monitor persistence")
	}

	// Update in-memory state
	m.activeMonitor = activeMonitor
	m.logger.Info("Active monitor configuration updated",
		"name", activeMonitor.Name,
		"monitors", len(activeMonitor.Monitors),
		"extend", activeMonitor.ExtendAcrossMonitors)

	return nil
}

// SetWallpaper sets a wallpaper on a specific monitor
func (m *Manager) SetWallpaper(monitorName, imagePath string) error {
	m.mutex.Lock()
	defer m.mutex.Unlock()

	monitor, exists := m.monitors[monitorName]
	if !exists {
		return ErrMonitorNotFound
	}

	// Update the monitor's current image
	monitor.CurrentImage = imagePath

	// Use the backend to actually set the wallpaper
	ctx := context.Background()
	return m.backendManager.SetWallpaper(ctx, imagePath, monitorName)
}

// SetWallpaperAll sets a wallpaper on all monitors
func (m *Manager) SetWallpaperAll(imagePath string) error {
	m.mutex.Lock()
	defer m.mutex.Unlock()

	// Update all monitors' current image
	for _, monitor := range m.monitors {
		monitor.CurrentImage = imagePath
	}

	// Use the backend to set wallpaper on all monitors
	ctx := context.Background()
	return m.backendManager.SetWallpaperAll(ctx, imagePath)
}

// refreshMonitors queries the compositor for current monitor information
func (m *Manager) refreshMonitors(ctx context.Context) error {
	// Detect compositor and get monitors
	detector := NewCompositorDetector()
	compositorInfo, err := detector.DetectCompositor()
	if err != nil {
		return err
	}

	var monitors []models.Monitor
	switch compositorInfo.Type {
	case CompositorWayland:
		provider := NewWaylandMonitorProvider(compositorInfo.Name)
		monitors, err = provider.GetMonitors(ctx)
	case CompositorX11:
		provider := NewX11MonitorProvider()
		monitors, err = provider.GetMonitors(ctx)
	default:
		return fmt.Errorf("unsupported compositor type: %s", compositorInfo.Type)
	}

	if err != nil {
		return err
	}

	m.mutex.Lock()
	defer m.mutex.Unlock()

	// Update monitors map
	newMonitors := make(map[string]*models.Monitor)
	for _, monitor := range monitors {
		// Preserve current image if monitor already exists
		if existing, exists := m.monitors[monitor.Name]; exists {
			monitor.CurrentImage = existing.CurrentImage
		}
		newMonitors[monitor.Name] = &monitor
	}

	// Preserve monitors that were loaded from file but are not currently detected
	for name, existingMonitor := range m.monitors {
		if _, exists := newMonitors[name]; !exists {
			// This monitor was loaded from file but is not currently detected
			// Keep it in the map to preserve its state
			newMonitors[name] = existingMonitor
		}
	}

	m.monitors = newMonitors

	// Check for changes
	if m.hasMonitorChanges() {
		m.logger.Info("Monitor configuration changed", "count", len(monitors))
		if m.changeCallback != nil {
			monitorList := make([]models.Monitor, 0, len(monitors))
			for _, monitor := range monitors {
				monitorList = append(monitorList, monitor)
			}
			go m.changeCallback(monitorList)
		}
	}

	// Update last known state
	m.lastKnownMonitors = make(map[string]*models.Monitor)
	for name, monitor := range m.monitors {
		m.lastKnownMonitors[name] = &models.Monitor{
			Name:         monitor.Name,
			Width:        monitor.Width,
			Height:       monitor.Height,
			CurrentImage: monitor.CurrentImage,
			Position:     monitor.Position,
		}
	}

	return nil
}

// hasMonitorChanges checks if monitor configuration has changed
func (m *Manager) hasMonitorChanges() bool {
	if len(m.monitors) != len(m.lastKnownMonitors) {
		return true
	}

	for name, monitor := range m.monitors {
		lastKnown, exists := m.lastKnownMonitors[name]
		if !exists {
			return true
		}

		if monitor.Width != lastKnown.Width ||
			monitor.Height != lastKnown.Height ||
			monitor.Position.X != lastKnown.Position.X ||
			monitor.Position.Y != lastKnown.Position.Y {
			return true
		}
	}

	return false
}

// monitorLoop periodically checks for monitor changes
func (m *Manager) monitorLoop(ctx context.Context) {
	ticker := time.NewTicker(5 * time.Second)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			if err := m.refreshMonitors(ctx); err != nil {
				m.logger.Error("Failed to refresh monitors", "error", err)
			}
		}
	}
}

// SetChangeCallback sets a callback for monitor changes
func (m *Manager) SetChangeCallback(callback func([]models.Monitor)) {
	m.mutex.Lock()
	defer m.mutex.Unlock()
	m.changeCallback = callback
}

// GetMonitor returns a specific monitor by name
func (m *Manager) GetMonitor(name string) (*models.Monitor, bool) {
	m.mutex.RLock()
	defer m.mutex.RUnlock()

	monitor, exists := m.monitors[name]
	if !exists {
		return nil, false
	}

	// Return a copy to avoid race conditions
	monitorCopy := *monitor
	return &monitorCopy, true
}

// SetWallpaperForMonitor sets a wallpaper for a specific monitor using image data
func (m *Manager) SetWallpaperForMonitor(ctx context.Context, imageData []byte, monitorName string) error {
	// For now, we'll save the image data to a temporary file and use the existing SetWallpaper method
	// In a more sophisticated implementation, we could pass the image data directly to the backend

	// Create a temporary file for the processed image
	tempDir := "/tmp/waypaper-engine"
	if err := os.MkdirAll(tempDir, 0755); err != nil {
		return fmt.Errorf("failed to create temp directory: %w", err)
	}

	tempFile := fmt.Sprintf("%s/%s_processed_%d.jpg", tempDir, monitorName, time.Now().UnixNano())

	// Write the image data to the temporary file
	if err := os.WriteFile(tempFile, imageData, 0644); err != nil {
		return fmt.Errorf("failed to write temp image file: %w", err)
	}

	// Use the existing SetWallpaper method
	return m.SetWallpaper(monitorName, tempFile)
}

// SetWallpaperForMonitorWithName sets a wallpaper for a specific monitor using image data and tracks the image name
func (m *Manager) SetWallpaperForMonitorWithName(ctx context.Context, imageData []byte, monitorName string, imageName string) error {
	// Create a temporary file for the processed image
	tempDir := "/tmp/waypaper-engine"
	if err := os.MkdirAll(tempDir, 0755); err != nil {
		return fmt.Errorf("failed to create temp directory: %w", err)
	}

	tempFile := fmt.Sprintf("%s/%s_processed_%d.jpg", tempDir, monitorName, time.Now().UnixNano())

	// Write the image data to the temporary file
	if err := os.WriteFile(tempFile, imageData, 0644); err != nil {
		return fmt.Errorf("failed to write temp image file: %w", err)
	}

	// Set wallpaper using the backend
	ctx2 := context.Background()
	err := m.backendManager.SetWallpaper(ctx2, tempFile, monitorName)
	if err != nil {
		return fmt.Errorf("failed to set wallpaper: %w", err)
	}

	// Update the monitor's current image with the actual image name
	m.mutex.Lock()
	defer m.mutex.Unlock()

	if monitor, exists := m.monitors[monitorName]; exists {
		monitor.CurrentImage = imageName
	}

	// Persist the monitor state to JSON file
	if err := m.persistMonitorState(); err != nil {
		m.logger.Error("failed to persist monitor state", "error", err)
		// Don't fail the operation if we can't persist state
	}

	return nil
}

// UpdateMonitorState updates the monitor state after setting wallpapers
func (m *Manager) UpdateMonitorState(ctx context.Context, activeMonitor *models.ActiveMonitor) error {
	m.mutex.Lock()
	defer m.mutex.Unlock()

	// The current image should already be set by SetWallpaperForMonitorWithName calls
	// We just need to persist the current state
	return m.persistMonitorState()
}

// persistMonitorState saves the current monitor state to a JSON file
func (m *Manager) persistMonitorState() error {
	homeDir, err := os.UserHomeDir()
	if err != nil {
		return fmt.Errorf("failed to get home directory: %w", err)
	}

	cacheDir := fmt.Sprintf("%s/.cache/waypaper_engine", homeDir)
	if err := os.MkdirAll(cacheDir, 0755); err != nil {
		return fmt.Errorf("failed to create cache directory: %w", err)
	}

	monitorsFile := fmt.Sprintf("%s/monitors.json", cacheDir)

	// Get all monitors
	monitors := make([]models.Monitor, 0, len(m.monitors))
	for _, monitor := range m.monitors {
		monitors = append(monitors, *monitor)
	}

	// Write to JSON file
	data, err := json.MarshalIndent(monitors, "", "  ")
	if err != nil {
		return fmt.Errorf("failed to marshal monitors: %w", err)
	}

	if err := os.WriteFile(monitorsFile, data, 0644); err != nil {
		return fmt.Errorf("failed to write monitors file: %w", err)
	}

	m.logger.Info("Monitor state persisted", "file", monitorsFile)
	return nil
}

// loadMonitorStateFromFile loads the monitor state from the JSON file
func (m *Manager) loadMonitorStateFromFile() error {
	homeDir, err := os.UserHomeDir()
	if err != nil {
		return fmt.Errorf("failed to get home directory: %w", err)
	}

	monitorsFile := fmt.Sprintf("%s/.cache/waypaper_engine/monitors.json", homeDir)

	// Check if file exists
	if _, err := os.Stat(monitorsFile); os.IsNotExist(err) {
		// File doesn't exist, nothing to load
		return nil
	}

	// Read the JSON file
	data, err := os.ReadFile(monitorsFile)
	if err != nil {
		return fmt.Errorf("failed to read monitors file: %w", err)
	}

	// Parse the JSON data
	var monitors []models.Monitor
	if err := json.Unmarshal(data, &monitors); err != nil {
		return fmt.Errorf("failed to unmarshal monitors: %w", err)
	}

	// Update the monitor state with the loaded data
	m.mutex.Lock()
	defer m.mutex.Unlock()

	for _, loadedMonitor := range monitors {
		if existingMonitor, exists := m.monitors[loadedMonitor.Name]; exists {
			// Update the current image from the loaded state
			existingMonitor.CurrentImage = loadedMonitor.CurrentImage
		} else {
			// Create the monitor if it doesn't exist
			m.monitors[loadedMonitor.Name] = &loadedMonitor
		}
	}

	m.logger.Info("Monitor state loaded from file", "file", monitorsFile)
	return nil
}

// GetMonitorImagePath returns the appropriate image path for a monitor
// In extend mode, this returns a monitor-specific cropped image
// In individual mode, this returns the full image path
func (m *Manager) GetMonitorImagePath(monitorName string) (string, error) {
	m.mutex.RLock()
	defer m.mutex.RUnlock()

	monitor, exists := m.monitors[monitorName]
	if !exists {
		return "", fmt.Errorf("monitor %s not found", monitorName)
	}

	// If no current image is set, return empty
	if monitor.CurrentImage == "" {
		return "", nil
	}

	homeDir, err := os.UserHomeDir()
	if err != nil {
		return "", fmt.Errorf("failed to get home directory: %w", err)
	}

	// Check if we're in extend mode
	if m.activeMonitor != nil && m.activeMonitor.ExtendAcrossMonitors {
		// In extend mode, we need to generate a monitor-specific cropped image
		// Check if we already have a monitor-specific image cached
		cacheDir := filepath.Join(homeDir, ".cache", "waypaper_engine", "monitor_images")
		os.MkdirAll(cacheDir, 0755)

		// Create a filename for this monitor's portion of the image
		baseName := strings.TrimSuffix(monitor.CurrentImage, filepath.Ext(monitor.CurrentImage))
		monitorImageName := fmt.Sprintf("%s_%s.webp", baseName, monitorName)
		monitorImagePath := filepath.Join(cacheDir, monitorImageName)

		// Check if the monitor-specific image already exists
		if _, err := os.Stat(monitorImagePath); err == nil {
			return monitorImagePath, nil
		}

		// Generate the monitor-specific image
		fullImagePath := filepath.Join(homeDir, ".waypaper-engine", "images", monitor.CurrentImage)
		err = m.generateMonitorSpecificImage(fullImagePath, monitorImagePath, monitor)
		if err != nil {
			// If generation fails, fall back to the full image
			m.logger.Warn("failed to generate monitor-specific image, using full image", "monitor", monitorName, "error", err)
			return fullImagePath, nil
		}

		return monitorImagePath, nil
	}

	// In individual mode, return the full image path
	imagePath := filepath.Join(homeDir, ".waypaper-engine", "images", monitor.CurrentImage)
	return imagePath, nil
}

// generateMonitorSpecificImage creates a cropped image for a specific monitor in extend mode
func (m *Manager) generateMonitorSpecificImage(sourcePath, destPath string, monitor *models.Monitor) error {
	// Get the total resolution of all monitors in extend mode
	var totalWidth, totalHeight int
	var minX, minY int = 999999, 999999

	for _, activeMonitor := range m.activeMonitor.Monitors {
		totalWidth += activeMonitor.Width
		totalHeight += activeMonitor.Height
		if activeMonitor.Position.X < minX {
			minX = activeMonitor.Position.X
		}
		if activeMonitor.Position.Y < minY {
			minY = activeMonitor.Position.Y
		}
	}

	// Calculate the relative position of this monitor within the total area
	relativeX := monitor.Position.X - minX
	relativeY := monitor.Position.Y - minY

	// Use ImageMagick to crop the image
	cmd := exec.Command("magick",
		sourcePath,
		"-crop", fmt.Sprintf("%dx%d+%d+%d", monitor.Width, monitor.Height, relativeX, relativeY),
		"-resize", fmt.Sprintf("%dx%d!", monitor.Width, monitor.Height),
		destPath)

	output, err := cmd.CombinedOutput()
	if err != nil {
		return fmt.Errorf("failed to crop image: %w, output: %s", err, string(output))
	}

	return nil
}

// WatchConfigChanges watches for configuration changes (placeholder implementation)
func (m *Manager) WatchConfigChanges(ctx context.Context) {
	m.logger.Info("starting config watcher")

	// This is a placeholder implementation
	// In a real implementation, this would watch for actual config changes
	// and refresh monitors when necessary

	select {
	case <-ctx.Done():
		m.logger.Info("config watcher stopping due to context cancellation")
		return
		// In real implementation: case <-configWatcher.Notify():
		//    m.logger.Info("config change detected, refreshing monitors")
		//    m.refreshMonitors(ctx)
	}
}

// PersistCurrentWallpaperState persists the current wallpaper state for restoration
func (m *Manager) PersistCurrentWallpaperState(ctx context.Context) error {
	m.mutex.Lock()
	defer m.mutex.Unlock()

	m.logger.Info("persisting current wallpaper state")

	// Persist the monitor state (which includes current images)
	if err := m.persistMonitorState(); err != nil {
		return fmt.Errorf("failed to persist monitor state: %w", err)
	}

	m.logger.Info("wallpaper state persisted successfully")
	return nil
}
