package ipc

import (
	"net"
	"sync"
)

// ClientSubscriptions manages client event subscriptions
type ClientSubscriptions struct {
	subscriptions map[net.Conn]map[string]bool // client -> event types
	mu            sync.RWMutex
}

// NewClientSubscriptions creates a new subscription manager
func NewClientSubscriptions() *ClientSubscriptions {
	return &ClientSubscriptions{
		subscriptions: make(map[net.Conn]map[string]bool),
	}
}

// Subscribe adds event type subscriptions for a client
func (cs *ClientSubscriptions) Subscribe(client net.Conn, eventTypes []string) {
	cs.mu.Lock()
	defer cs.mu.Unlock()

	if cs.subscriptions[client] == nil {
		cs.subscriptions[client] = make(map[string]bool)
	}

	for _, eventType := range eventTypes {
		cs.subscriptions[client][eventType] = true
	}
}

// Unsubscribe removes event type subscriptions for a client
func (cs *ClientSubscriptions) Unsubscribe(client net.Conn, eventTypes []string) {
	cs.mu.Lock()
	defer cs.mu.Unlock()

	if cs.subscriptions[client] == nil {
		return
	}

	for _, eventType := range eventTypes {
		delete(cs.subscriptions[client], eventType)
	}
}

// UnsubscribeAll removes all subscriptions for a client
func (cs *ClientSubscriptions) UnsubscribeAll(client net.Conn) {
	cs.mu.Lock()
	defer cs.mu.Unlock()

	delete(cs.subscriptions, client)
}

// IsSubscribed checks if a client is subscribed to an event type
func (cs *ClientSubscriptions) IsSubscribed(client net.Conn, eventType string) bool {
	cs.mu.RLock()
	defer cs.mu.RUnlock()

	subs, exists := cs.subscriptions[client]
	if !exists {
		return false
	}

	// Check for wildcard or specific subscription
	return subs["*"] || subs[eventType]
}

// GetSubscribedClients returns all clients subscribed to an event type
func (cs *ClientSubscriptions) GetSubscribedClients(eventType string) []net.Conn {
	cs.mu.RLock()
	defer cs.mu.RUnlock()

	var clients []net.Conn
	for client, subs := range cs.subscriptions {
		if subs["*"] || subs[eventType] {
			clients = append(clients, client)
		}
	}

	return clients
}

// GetClientSubscriptions returns all event types a client is subscribed to
func (cs *ClientSubscriptions) GetClientSubscriptions(client net.Conn) []string {
	cs.mu.RLock()
	defer cs.mu.RUnlock()

	subs, exists := cs.subscriptions[client]
	if !exists {
		return nil
	}

	var eventTypes []string
	for eventType := range subs {
		eventTypes = append(eventTypes, eventType)
	}

	return eventTypes
}

// GetSubscriptionCount returns the number of clients subscribed to an event type
func (cs *ClientSubscriptions) GetSubscriptionCount(eventType string) int {
	cs.mu.RLock()
	defer cs.mu.RUnlock()

	count := 0
	for _, subs := range cs.subscriptions {
		if subs["*"] || subs[eventType] {
			count++
		}
	}

	return count
}
