package logger

import (
	"io"
	"log/slog"
	"os"
)

// New creates a new structured logger.
func New(level slog.Level) *slog.Logger {
	// Check if we're in development mode
	if os.Getenv("DEV") == "true" {
		// In dev mode, write to both stdout and a log file
		logFile, err := os.OpenFile("/tmp/daemon.log", os.O_CREATE|os.O_WRONLY|os.O_APPEND, 0644)
		if err != nil {
			// If we can't open the log file, fall back to stdout only
			return slog.New(slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{
				Level: level,
			}))
		}
		
		// Create a multi-writer that writes to both stdout and file
		multiWriter := io.MultiWriter(os.Stdout, logFile)
		
		return slog.New(slog.NewJSONHandler(multiWriter, &slog.HandlerOptions{
			Level: level,
		}))
	}
	
	// In production mode, write to stdout only
	return slog.New(slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{
		Level: level,
	}))
}
