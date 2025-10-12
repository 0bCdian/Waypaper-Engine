package logger

import (
	"os"
	"path/filepath"
	"testing"

	"waypaper-engine/daemon-go/internal/config"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestNew(t *testing.T) {
	// Create temporary config file
	tempDir := t.TempDir()
	configPath := filepath.Join(tempDir, "config.toml")

	configContent := `
[daemon]
log_level = "info"
log_file = ""
log_max_size = 100
log_max_age = 7
log_max_backups = 3
`
	err := os.WriteFile(configPath, []byte(configContent), 0644)
	require.NoError(t, err)

	// Create config manager
	configManager := config.NewConfigManager(configPath)
	_, err = configManager.LoadConfig()
	require.NoError(t, err)

	// Test logger creation
	logger, err := New(configManager)
	require.NoError(t, err)
	assert.NotNil(t, logger)
}

func TestNewWithConfig(t *testing.T) {
	config := LoggerConfig{
		Level:      0, // Debug level
		LogFile:    "",
		MaxSize:    100,
		MaxAge:     7,
		MaxBackups: 3,
	}

	logger, err := NewWithConfig(config)
	require.NoError(t, err)
	assert.NotNil(t, logger)
}

func TestParseLogLevel(t *testing.T) {
	tests := []struct {
		name     string
		levelStr string
		expected int
	}{
		{
			name:     "Debug level",
			levelStr: "debug",
			expected: -4, // slog.LevelDebug
		},
		{
			name:     "Info level",
			levelStr: "info",
			expected: 0, // slog.LevelInfo
		},
		{
			name:     "Warn level",
			levelStr: "warn",
			expected: 4, // slog.LevelWarn
		},
		{
			name:     "Warning level",
			levelStr: "warning",
			expected: 4, // slog.LevelWarn
		},
		{
			name:     "Error level",
			levelStr: "error",
			expected: 8, // slog.LevelError
		},
		{
			name:     "Unknown level",
			levelStr: "unknown",
			expected: 0, // Default to info
		},
		{
			name:     "Empty level",
			levelStr: "",
			expected: 0, // Default to info
		},
		{
			name:     "Case insensitive",
			levelStr: "DEBUG",
			expected: -4, // slog.LevelDebug
		},
		{
			name:     "Mixed case",
			levelStr: "Info",
			expected: 0, // slog.LevelInfo
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := parseLogLevel(tt.levelStr)
			assert.Equal(t, tt.expected, int(result))
		})
	}
}

func TestGetDefaultLogFile(t *testing.T) {
	// Test development mode
	os.Setenv("DEV", "true")
	defer os.Unsetenv("DEV")

	logFile := getDefaultLogFile()
	assert.Equal(t, "/tmp/waypaper-daemon.log", logFile)

	// Test production mode
	os.Unsetenv("DEV")
	os.Setenv("XDG_CACHE_HOME", "/custom/cache")
	defer os.Unsetenv("XDG_CACHE_HOME")

	logFile = getDefaultLogFile()
	assert.Equal(t, "/custom/cache/waypaper-engine/daemon.log", logFile)

	// Test production mode with home directory
	os.Unsetenv("XDG_CACHE_HOME")
	homeDir, err := os.UserHomeDir()
	require.NoError(t, err)

	logFile = getDefaultLogFile()
	expectedPath := filepath.Join(homeDir, ".cache", "waypaper-engine", "daemon.log")
	assert.Equal(t, expectedPath, logFile)
}

func TestCreateLogger(t *testing.T) {
	tests := []struct {
		name   string
		config LoggerConfig
	}{
		{
			name: "Stdout only",
			config: LoggerConfig{
				Level:   0,
				LogFile: "",
			},
		},
		{
			name: "With log file",
			config: LoggerConfig{
				Level:   0,
				LogFile: filepath.Join(t.TempDir(), "test.log"),
			},
		},
		{
			name: "With invalid log file path",
			config: LoggerConfig{
				Level:   0,
				LogFile: "/nonexistent/path/test.log",
			},
		},
		{
			name: "Debug level",
			config: LoggerConfig{
				Level:   -4, // Debug
				LogFile: "",
			},
		},
		{
			name: "Error level",
			config: LoggerConfig{
				Level:   8, // Error
				LogFile: "",
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			logger, err := createLogger(tt.config)
			require.NoError(t, err)
			assert.NotNil(t, logger)
		})
	}
}

func TestCreateLogger_InvalidLogFile(t *testing.T) {
	config := LoggerConfig{
		Level:   0,
		LogFile: "/root/nonexistent/test.log", // Should fail to create
	}

	logger, err := createLogger(config)
	require.NoError(t, err) // Should fallback to stdout
	assert.NotNil(t, logger)
}

func TestCreateLogger_ReadOnlyLogFile(t *testing.T) {
	tempDir := t.TempDir()
	logFile := filepath.Join(tempDir, "readonly.log")

	// Create read-only file
	err := os.WriteFile(logFile, []byte(""), 0444)
	require.NoError(t, err)

	config := LoggerConfig{
		Level:   0,
		LogFile: logFile,
	}

	logger, err := createLogger(config)
	require.NoError(t, err) // Should fallback to stdout
	assert.NotNil(t, logger)
}

func TestCreateLogger_LogDirectoryCreation(t *testing.T) {
	tempDir := t.TempDir()
	logFile := filepath.Join(tempDir, "nested", "path", "test.log")

	config := LoggerConfig{
		Level:   0,
		LogFile: logFile,
	}

	logger, err := createLogger(config)
	require.NoError(t, err)
	assert.NotNil(t, logger)

	// Verify directory was created
	assert.DirExists(t, filepath.Dir(logFile))
}

func TestCreateLogger_MultiWriter(t *testing.T) {
	tempDir := t.TempDir()
	logFile := filepath.Join(tempDir, "test.log")

	config := LoggerConfig{
		Level:   0,
		LogFile: logFile,
	}

	logger, err := createLogger(config)
	require.NoError(t, err)
	assert.NotNil(t, logger)

	// Test that we can write to the logger
	logger.Info("Test message")

	// Verify log file was created and contains content
	assert.FileExists(t, logFile)
	content, err := os.ReadFile(logFile)
	require.NoError(t, err)
	assert.Contains(t, string(content), "Test message")
}

func TestCreateLogger_LogRotation(t *testing.T) {
	tempDir := t.TempDir()
	logFile := filepath.Join(tempDir, "test.log")

	config := LoggerConfig{
		Level:      0,
		LogFile:    logFile,
		MaxSize:    1, // 1 MB
		MaxAge:     7, // 7 days
		MaxBackups: 3, // 3 backups
	}

	logger, err := createLogger(config)
	require.NoError(t, err)
	assert.NotNil(t, logger)

	// Test that rotation settings are applied
	logger.Info("Test rotation message")

	// Verify log file was created
	assert.FileExists(t, logFile)
}

func TestCreateLogger_ConcurrentAccess(t *testing.T) {
	tempDir := t.TempDir()
	logFile := filepath.Join(tempDir, "concurrent.log")

	config := LoggerConfig{
		Level:   0,
		LogFile: logFile,
	}

	logger, err := createLogger(config)
	require.NoError(t, err)
	assert.NotNil(t, logger)

	// Test concurrent logging
	done := make(chan bool, 10)

	for i := 0; i < 10; i++ {
		go func(id int) {
			logger.Info("Concurrent message", "id", id)
			done <- true
		}(i)
	}

	// Wait for all goroutines to complete
	for i := 0; i < 10; i++ {
		<-done
	}

	// Verify log file contains messages
	assert.FileExists(t, logFile)
	content, err := os.ReadFile(logFile)
	require.NoError(t, err)
	assert.Contains(t, string(content), "Concurrent message")
}

func TestCreateLogger_DifferentLevels(t *testing.T) {
	tempDir := t.TempDir()
	logFile := filepath.Join(tempDir, "levels.log")

	config := LoggerConfig{
		Level:   8, // Error level only
		LogFile: logFile,
	}

	logger, err := createLogger(config)
	require.NoError(t, err)
	assert.NotNil(t, logger)

	// Test different log levels
	logger.Debug("Debug message") // Should not appear
	logger.Info("Info message")   // Should not appear
	logger.Warn("Warn message")   // Should not appear
	logger.Error("Error message") // Should appear

	// Verify only error message appears
	assert.FileExists(t, logFile)
	content, err := os.ReadFile(logFile)
	require.NoError(t, err)

	assert.NotContains(t, string(content), "Debug message")
	assert.NotContains(t, string(content), "Info message")
	assert.NotContains(t, string(content), "Warn message")
	assert.Contains(t, string(content), "Error message")
}

func TestCreateLogger_JSONFormat(t *testing.T) {
	tempDir := t.TempDir()
	logFile := filepath.Join(tempDir, "json.log")

	config := LoggerConfig{
		Level:   0,
		LogFile: logFile,
	}

	logger, err := createLogger(config)
	require.NoError(t, err)
	assert.NotNil(t, logger)

	// Test structured logging
	logger.Info("Structured message", "key1", "value1", "key2", "value2")

	// Verify JSON format
	assert.FileExists(t, logFile)
	content, err := os.ReadFile(logFile)
	require.NoError(t, err)

	// Should contain JSON-like structure
	assert.Contains(t, string(content), "Structured message")
	assert.Contains(t, string(content), "key1")
	assert.Contains(t, string(content), "value1")
	assert.Contains(t, string(content), "key2")
	assert.Contains(t, string(content), "value2")
}

func TestCreateLogger_EmptyConfig(t *testing.T) {
	config := LoggerConfig{}

	logger, err := createLogger(config)
	require.NoError(t, err)
	assert.NotNil(t, logger)
}

func TestCreateLogger_ZeroValues(t *testing.T) {
	config := LoggerConfig{
		Level:      0,
		LogFile:    "",
		MaxSize:    0,
		MaxAge:     0,
		MaxBackups: 0,
	}

	logger, err := createLogger(config)
	require.NoError(t, err)
	assert.NotNil(t, logger)
}

func TestCreateLogger_NegativeValues(t *testing.T) {
	config := LoggerConfig{
		Level:      -10,
		LogFile:    "",
		MaxSize:    -1,
		MaxAge:     -1,
		MaxBackups: -1,
	}

	logger, err := createLogger(config)
	require.NoError(t, err)
	assert.NotNil(t, logger)
}

func TestCreateLogger_LargeValues(t *testing.T) {
	config := LoggerConfig{
		Level:      100,
		LogFile:    "",
		MaxSize:    1000000,
		MaxAge:     365,
		MaxBackups: 100,
	}

	logger, err := createLogger(config)
	require.NoError(t, err)
	assert.NotNil(t, logger)
}
