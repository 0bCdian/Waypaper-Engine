package logger

import (
	"io"
	"log/slog"
	"os"
	"path/filepath"
	"strings"

	"waypaper-engine/daemon-go/internal/config"
)

// LoggerConfig holds configuration for the logger
type LoggerConfig struct {
	Level      slog.Level
	LogFile    string
	MaxSize    int // MB
	MaxAge     int // days
	MaxBackups int
}

// New creates a new structured logger with configuration from config manager.
// Configuration hierarchy: environment variables > config manager > default values
func New(configManager *config.ConfigManager) (*slog.Logger, error) {
	// Get configuration from config manager
	cfg, err := configManager.GetConfig()
	if err != nil {
		return nil, err
	}

	// Parse log level from config
	level := parseLogLevel(cfg.Daemon.LogLevel)

	// Get log file path from config
	logFile := cfg.Daemon.LogFile
	if logFile == "" {
		// Default log file path if not specified
		logFile = getDefaultLogFile()
	}

	// Create logger configuration
	loggerConfig := LoggerConfig{
		Level:      level,
		LogFile:    logFile,
		MaxSize:    cfg.Daemon.LogMaxSize,
		MaxAge:     cfg.Daemon.LogMaxAge,
		MaxBackups: cfg.Daemon.LogMaxBackups,
	}

	return createLogger(loggerConfig)
}

// NewWithConfig creates a logger with explicit configuration
func NewWithConfig(config LoggerConfig) (*slog.Logger, error) {
	return createLogger(config)
}

// parseLogLevel converts string log level to slog.Level
func parseLogLevel(levelStr string) slog.Level {
	switch strings.ToLower(levelStr) {
	case "debug":
		return slog.LevelDebug
	case "info":
		return slog.LevelInfo
	case "warn", "warning":
		return slog.LevelWarn
	case "error":
		return slog.LevelError
	default:
		return slog.LevelInfo // Default to info level
	}
}

// getDefaultLogFile returns the default log file path
func getDefaultLogFile() string {
	// Check if we're in development mode
	if os.Getenv("DEV") == "true" {
		return "/tmp/waypaper-daemon.log"
	}

	// In production, use user's cache directory
	cacheDir := os.Getenv("XDG_CACHE_HOME")
	if cacheDir == "" {
		homeDir, err := os.UserHomeDir()
		if err != nil {
			return "/tmp/waypaper-daemon.log" // Fallback
		}
		cacheDir = filepath.Join(homeDir, ".cache")
	}

	return filepath.Join(cacheDir, "waypaper-engine", "daemon.log")
}

// createLogger creates the actual logger with the given configuration
func createLogger(config LoggerConfig) (*slog.Logger, error) {
	var writers []io.Writer

	// Always write to stdout/stderr
	writers = append(writers, os.Stdout)

	// Add file logging if log file is specified
	if config.LogFile != "" {
		// Ensure log directory exists
		logDir := filepath.Dir(config.LogFile)
		if err := os.MkdirAll(logDir, 0755); err != nil {
			// If we can't create the directory, fall back to stdout only
			return slog.New(slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{
				Level: config.Level,
			})), nil
		}

		// Open log file
		logFile, err := os.OpenFile(config.LogFile, os.O_CREATE|os.O_WRONLY|os.O_APPEND, 0644)
		if err != nil {
			// If we can't open the log file, fall back to stdout only
			return slog.New(slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{
				Level: config.Level,
			})), nil
		}

		writers = append(writers, logFile)
	}

	// Create multi-writer if we have multiple outputs
	var output io.Writer
	if len(writers) == 1 {
		output = writers[0]
	} else {
		output = io.MultiWriter(writers...)
	}

	// Create logger with JSON handler
	return slog.New(slog.NewJSONHandler(output, &slog.HandlerOptions{
		Level: config.Level,
	})), nil
}
