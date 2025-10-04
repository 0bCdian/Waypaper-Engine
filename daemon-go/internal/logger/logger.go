
package logger

import (
	"log/slog"
	"os"
)

// New creates a new structured logger.
func New(level slog.Level) *slog.Logger {
	return slog.New(slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{
		Level: level,
	}))
}
