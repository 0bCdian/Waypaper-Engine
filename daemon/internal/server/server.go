package server

import (
	"context"
	"fmt"
	"log/slog"
	"net"
	"net/http"
	"os"
)

// Server wraps an HTTP server listening on a Unix domain socket.
type Server struct {
	socketPath string
	httpServer *http.Server
	listener   net.Listener
}

// NewServer creates a new Server.
func NewServer(socketPath string, handler http.Handler) *Server {
	return &Server{
		socketPath: socketPath,
		httpServer: &http.Server{
			Handler: handler,
		},
	}
}

// Serve starts the server. It removes any stale socket file before binding.
// This blocks until the server is shut down.
func (s *Server) Serve() error {
	// Remove stale socket file if it exists.
	if err := os.Remove(s.socketPath); err != nil && !os.IsNotExist(err) {
		return fmt.Errorf("server: remove stale socket: %w", err)
	}

	var err error
	s.listener, err = net.Listen("unix", s.socketPath)
	if err != nil {
		return fmt.Errorf("server: listen on %s: %w", s.socketPath, err)
	}

	// Set socket permissions to allow the current user.
	if err := os.Chmod(s.socketPath, 0o700); err != nil {
		slog.Warn("failed to set socket permissions", "error", err)
	}

	slog.Info("server listening", "socket", s.socketPath)

	if err := s.httpServer.Serve(s.listener); err != nil && err != http.ErrServerClosed {
		return fmt.Errorf("server: serve: %w", err)
	}
	return nil
}

// Shutdown gracefully shuts down the server.
func (s *Server) Shutdown(ctx context.Context) error {
	slog.Info("server shutting down")
	return s.httpServer.Shutdown(ctx)
}
