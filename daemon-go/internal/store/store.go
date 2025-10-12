package store

import (
	"encoding/json"
	"fmt"
	"log/slog"
	"os"
	"path/filepath"
	"sync"
	"time"

	"waypaper-engine/daemon-go/internal/media"
)

// Store handles JSON-based file storage for the Waypaper Engine daemon
type Store struct {
	basePath   string
	cache      map[string]interface{}
	cacheMutex sync.RWMutex
	logger     *slog.Logger
	config     *StoreConfig

	// Transactional safety
	writeMutex sync.Mutex

	// Media detector for enhanced backend selection
	mediaDetector *media.Detector

	// Sequential ID manager for consistent image ordering
	sequentialIDManager *SequentialIDManager

	// Store components
	imageStore *ImageStore
}

// StoreConfig holds configuration for the JSON store
type StoreConfig struct {
	BasePath              string `toml:"base_path"`
	CacheEnabled          bool   `toml:"cache_enabled"`
	CacheSize             int    `toml:"cache_size"`
	AtomicWrites          bool   `toml:"atomic_writes"`
	BackupEnabled         bool   `toml:"backup_enabled"`
	BackupDirectory       string `toml:"backup_directory"`
	MaxBackups            int    `toml:"max_backups"`
	AutoCreateDirectories bool   `toml:"auto_create_directories"`
	ThumbnailsDir         string `toml:"thumbnails_dir"`
}

// DefaultStoreConfig returns a default store configuration
func DefaultStoreConfig() StoreConfig {
	return StoreConfig{
		BasePath:              "~/.waypaper-engine/data",
		CacheEnabled:          true,
		CacheSize:             100,
		AtomicWrites:          true,
		BackupEnabled:         true,
		BackupDirectory:       "~/.waypaper-engine/backups",
		MaxBackups:            5,
		AutoCreateDirectories: true,
		ThumbnailsDir:         "~/.waypaper-engine/data/cache/thumbnails",
	}
}

// NewStore creates a new JSON store with the specified configuration
func NewStore(config StoreConfig, logger *slog.Logger) (*Store, error) {
	// Expand tilde in paths
	basePath, err := expandPath(config.BasePath)
	if err != nil {
		return nil, fmt.Errorf("failed to expand base path: %w", err)
	}

	store := &Store{
		basePath: basePath,
		cache:    make(map[string]interface{}),
		logger:   logger,
		config:   &config,
	}

	// Create media detector for enhanced backend selection
	store.mediaDetector = media.NewDetector()

	// Initialize sequential ID manager
	store.sequentialIDManager = NewSequentialIDManager(store)

	// Initialize store components
	store.imageStore = NewImageStore(store)

	// Create base directory structure if needed
	if config.AutoCreateDirectories {
		if err := store.createDirectoryStructure(); err != nil {
			return nil, fmt.Errorf("failed to create directory structure: %w", err)
		}
	}

	// Initialize sequential ID manager from existing images
	if err := store.sequentialIDManager.InitializeFromRegistry(); err != nil {
		if logger != nil {
			logger.Warn("Failed to initialize sequential ID manager from registry", "error", err)
		}
		// Don't fail store creation for this
	}

	return store, nil
}

// createDirectoryStructure creates the required directory structure
func (s *Store) createDirectoryStructure() error {
	directories := []string{
		s.basePath,
		filepath.Join(s.basePath, "playlists"),
		filepath.Join(s.basePath, "config"),
		filepath.Join(s.basePath, "cache"),
		filepath.Join(s.basePath, "cache", "thumbnails"),
		filepath.Join(s.basePath, "cache", "processed"),
	}

	for _, dir := range directories {
		if err := os.MkdirAll(dir, 0755); err != nil {
			return fmt.Errorf("failed to create directory %s: %w", dir, err)
		}
	}

	return nil
}

// getFilePath returns the full file path for a given file name
func (s *Store) getFilePath(fileName string) string {
	return filepath.Join(s.basePath, fileName)
}

// loadJSON loads JSON data from a file into the target interface
func (s *Store) loadJSON(filePath string, target interface{}) error {
	data, err := os.ReadFile(filePath)
	if err != nil {
		if os.IsNotExist(err) {
			return fmt.Errorf("file not found: %s", filePath)
		}
		return fmt.Errorf("failed to read file %s: %w", filePath, err)
	}

	if err := json.Unmarshal(data, target); err != nil {
		return fmt.Errorf("failed to unmarshal JSON from %s: %w", filePath, err)
	}

	return nil
}

// saveJSON saves data to a JSON file with atomic operations
func (s *Store) saveJSON(filePath string, data interface{}) error {
	s.writeMutex.Lock()
	defer s.writeMutex.Unlock()

	// Ensure directory exists
	if err := os.MkdirAll(filepath.Dir(filePath), 0755); err != nil {
		return fmt.Errorf("failed to create directory: %w", err)
	}

	// Marshal to JSON with pretty printing
	jsonData, err := json.MarshalIndent(data, "", "  ")
	if err != nil {
		return fmt.Errorf("failed to marshal JSON: %w", err)
	}

	// Write to temporary file first for atomicity
	tempPath := filePath + ".tmp"
	if err := os.WriteFile(tempPath, jsonData, 0644); err != nil {
		return fmt.Errorf("failed to write temporary file: %w", err)
	}

	// Atomic rename
	if err := os.Rename(tempPath, filePath); err != nil {
		// Cleanup temp file if rename failed
		os.Remove(tempPath)
		return fmt.Errorf("failed to rename temporary file: %w", err)
	}

	return nil
}

// cachedLoad loads data with caching support
func (s *Store) cachedLoad(cacheKey string, filePath string, target interface{}) error {
	// Check cache first
	s.cacheMutex.RLock()
	if cached, exists := s.cache[cacheKey]; exists {
		s.cacheMutex.RUnlock()
		return copyInterface(cached, target)
	}
	s.cacheMutex.RUnlock()

	// Load from file
	if err := s.loadJSON(filePath, target); err != nil {
		return err
	}

	// Cache the result
	s.cacheMutex.Lock()
	s.cache[cacheKey] = target
	s.cacheMutex.Unlock()

	return nil
}

// HealthIssue represents a health check issue
type HealthIssue struct {
	Component string `json:"component"`
	Severity  string `json:"severity"` // "error", "warning", "info"
	Message   string `json:"message"`
	Timestamp string `json:"timestamp"`
}

// ValidateHealth performs health checks on the store
func (s *Store) ValidateHealth() []HealthIssue {
	var issues []HealthIssue
	now := time.Now().Format(time.RFC3339)

	// Check if base directory exists and is writable
	if err := s.checkDirectoryPermissions(); err != nil {
		issues = append(issues, HealthIssue{
			Component: "filesystem",
			Severity:  "error",
			Message:   err.Error(),
			Timestamp: now,
		})
	}

	// Check for required files
	requiredFiles := []string{
		"images.json",
		"runtime.json",
		"history.json",
	}

	for _, fileName := range requiredFiles {
		filePath := s.getFilePath(fileName)
		if _, err := os.Stat(filePath); err != nil {
			if os.IsNotExist(err) {
				issues = append(issues, HealthIssue{
					Component: "files",
					Severity:  "warning",
					Message:   fmt.Sprintf("Required file missing: %s", fileName),
					Timestamp: now,
				})
			} else {
				issues = append(issues, HealthIssue{
					Component: "files",
					Severity:  "error",
					Message:   fmt.Sprintf("Error accessing %s: %v", fileName, err),
					Timestamp: now,
				})
			}
		}
	}

	// Check JSON file integrity
	if err := s.validateJSONIntegrity(); err != nil {
		issues = append(issues, HealthIssue{
			Component: "integrity",
			Severity:  "error",
			Message:   err.Error(),
			Timestamp: now,
		})
	}

	return issues
}

// checkDirectoryPermissions verifies directory permissions
func (s *Store) checkDirectoryPermissions() error {
	// Check if base directory exists
	if _, err := os.Stat(s.basePath); err != nil {
		return fmt.Errorf("base directory does not exist: %s", s.basePath)
	}

	// Try to create a test file to check write permissions
	testFile := filepath.Join(s.basePath, ".write_test")
	f, err := os.Create(testFile)
	if err != nil {
		return fmt.Errorf("directory is not writable: %w", err)
	}
	f.Close()
	os.Remove(testFile)

	return nil
}

// validateJSONIntegrity checks the integrity of JSON files
func (s *Store) validateJSONIntegrity() error {
	files := []string{"images.json", "runtime.json", "history.json"}

	for _, fileName := range files {
		filePath := s.getFilePath(fileName)
		if _, err := os.Stat(filePath); err != nil {
			continue // Skip if file doesn't exist
		}

		var temp interface{}
		if err := s.loadJSON(filePath, &temp); err != nil {
			return fmt.Errorf("invalid JSON in %s: %w", fileName, err)
		}
	}

	return nil
}

// ClearCache clears the in-memory cache
func (s *Store) ClearCache() {
	s.cacheMutex.Lock()
	defer s.cacheMutex.Unlock()
	s.cache = make(map[string]interface{})
}

// GetCacheStats returns cache statistics
func (s *Store) GetCacheStats() map[string]interface{} {
	s.cacheMutex.RLock()
	defer s.cacheMutex.RUnlock()

	return map[string]interface{}{
		"size":      len(s.cache),
		"keys":      getCacheKeys(s.cache),
		"timestamp": time.Now().Format(time.RFC3339),
	}
}

// Helper functions

// expandPath expands tilde to home directory
func expandPath(path string) (string, error) {
	if len(path) > 0 && path[0] == '~' {
		home, err := os.UserHomeDir()
		if err != nil {
			return "", err
		}
		return filepath.Join(home, path[1:]), nil
	}
	return filepath.Clean(path), nil
}

// copyInterface copies data between interfaces (simplified implementation)
func copyInterface(src, dst interface{}) error {
	// For now, we'll use JSON marshalling/unmarshalling
	// In a production system, you might want to use reflection or type assertions
	data, err := json.Marshal(src)
	if err != nil {
		return err
	}
	return json.Unmarshal(data, dst)
}

// getCacheKeys returns all cache keys
func getCacheKeys(cache map[string]interface{}) []string {
	keys := make([]string, 0, len(cache))
	for k := range cache {
		keys = append(keys, k)
	}
	return keys
}

// LoadImageRegistry loads the image registry using the image store
func (s *Store) LoadImageRegistry() (*ImageRegistry, error) {
	return s.imageStore.LoadImageRegistry()
}
