package ipc

import (
	"bufio"
	"encoding/json"
	"fmt"
	"log/slog"
	"net"
	"os"
	"sync"

	"waypaper-engine/daemon-go/internal/events"
)

// Server is the IPC server.
type Server struct {
	listener      net.Listener
	handler       MessageHandler
	logger        *slog.Logger
	clients       map[net.Conn]bool
	mu            sync.RWMutex
	socketPath    string
	eventBus      *events.EventBus
	subscriptions *ClientSubscriptions
}

// MessageHandler is an interface for handling IPC messages.
type MessageHandler interface {
	HandleMessage(msg *Message, conn net.Conn) *Response
	SetServer(server *Server)
}

// SetEventBus sets the event bus for the server
func (s *Server) SetEventBus(eventBus *events.EventBus) {
	s.eventBus = eventBus
}
func NewServerWithSocket(handler MessageHandler, socketPath string, logger *slog.Logger) (*Server, error) {
	if err := os.RemoveAll(socketPath); err != nil {
		return nil, fmt.Errorf("failed to remove old socket: %w", err)
	}

	listener, err := net.Listen("unix", socketPath)
	if err != nil {
		return nil, fmt.Errorf("failed to listen on socket: %w", err)
	}

	server := &Server{
		listener:      listener,
		handler:       handler,
		logger:        logger,
		clients:       make(map[net.Conn]bool),
		socketPath:    socketPath,
		subscriptions: NewClientSubscriptions(),
	}

	// Set the server reference in the handler
	handler.SetServer(server)

	return server, nil
}

// Listen starts the server and listens for connections.
func (s *Server) Listen() {
	s.logger.Info("IPC server listening on", "socket", s.socketPath)
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
func (s *Server) BroadcastEvent(event *events.Event) error {
	s.mu.RLock()
	defer s.mu.RUnlock()

	eventBytes, err := json.Marshal(event)
	if err != nil {
		s.logger.Error("failed to marshal event", "error", err)
		return err
	}

	// Get clients subscribed to this event type
	subscribedClients := s.subscriptions.GetSubscribedClients(string(event.Type))

	for _, conn := range subscribedClients {
		if _, err := conn.Write(append(eventBytes, '\n')); err != nil {
			s.logger.Error("failed to send event to client", "error", err)
			// Remove the client from the map
			delete(s.clients, conn)
			conn.Close()
		}
	}

	return nil
}

func (s *Server) handleConnection(conn net.Conn) {
	defer func() {
		s.mu.Lock()
		delete(s.clients, conn)
		s.subscriptions.UnsubscribeAll(conn)
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

		resp := s.handler.HandleMessage(&msg, conn)

		respBytes, err := json.Marshal(resp)
		if err != nil {
			s.logger.Error("failed to marshal response", "error", err)
			continue
		}

		if _, err := conn.Write(append(respBytes, '\n')); err != nil {
			s.logger.Error("failed to write response", "error", err)
			continue
		}
	}
}
