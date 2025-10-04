package ipc

import (
	"bufio"
	"encoding/json"
	"fmt"
	"log/slog"
	"net"
	"os"
	"sync"
)

const (
	SocketPath = "/tmp/waypaper_engine.sock"
)

// Server is the IPC server.
type Server struct {
	listener net.Listener
	handler  MessageHandler
	logger   *slog.Logger
	clients  map[net.Conn]bool
	mu       sync.RWMutex
}

// MessageHandler is an interface for handling IPC messages.
type MessageHandler interface {
	HandleMessage(msg *Message) *Response
	SetServer(server *Server)
}

// NewServer creates a new IPC server.
func NewServer(handler MessageHandler, logger *slog.Logger) (*Server, error) {
	if err := os.RemoveAll(SocketPath); err != nil {
		return nil, fmt.Errorf("failed to remove old socket: %w", err)
	}

	listener, err := net.Listen("unix", SocketPath)
	if err != nil {
		return nil, fmt.Errorf("failed to listen on socket: %w", err)
	}

	server := &Server{
		listener: listener,
		handler:  handler,
		logger:   logger,
		clients:  make(map[net.Conn]bool),
	}

	// Set the server reference in the handler
	handler.SetServer(server)

	return server, nil
}

// Listen starts the server and listens for connections.
func (s *Server) Listen() {
	s.logger.Info("IPC server listening on", "socket", SocketPath)
	for {
		conn, err := s.listener.Accept()
		if err != nil {
			s.logger.Error("failed to accept connection", "error", err)
			continue
		}

		go s.handleConnection(conn)
	}
}

// Close closes the server listener.
func (s *Server) Close() {
	s.listener.Close()
}

// BroadcastEvent broadcasts an event to all connected clients.
func (s *Server) BroadcastEvent(event *Event) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	eventBytes, err := json.Marshal(event)
	if err != nil {
		s.logger.Error("failed to marshal event", "error", err)
		return
	}

	for conn := range s.clients {
		if _, err := conn.Write(eventBytes); err != nil {
			s.logger.Error("failed to send event to client", "error", err)
			// Remove the client from the map
			delete(s.clients, conn)
			conn.Close()
		}
	}
}

func (s *Server) handleConnection(conn net.Conn) {
	defer func() {
		s.mu.Lock()
		delete(s.clients, conn)
		s.mu.Unlock()
		conn.Close()
	}()

	s.logger.Info("new connection", "remote_addr", conn.RemoteAddr().String())

	// Add client to the map for event broadcasting
	s.mu.Lock()
	s.clients[conn] = true
	s.mu.Unlock()

	scanner := bufio.NewScanner(conn)
	for scanner.Scan() {
		var msg Message
		if err := json.Unmarshal(scanner.Bytes(), &msg); err != nil {
			s.logger.Error("failed to unmarshal message", "error", err)
			// Send error response
			continue
		}

		resp := s.handler.HandleMessage(&msg)

		respBytes, err := json.Marshal(resp)
		if err != nil {
			s.logger.Error("failed to marshal response", "error", err)
			continue
		}

		if _, err := conn.Write(respBytes); err != nil {
			s.logger.Error("failed to write response", "error", err)
			continue
		}
	}
}
