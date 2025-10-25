package events

import (
	"fmt"
	"log/slog"
	"sync"
	"time"
)

// EventBus manages event publishing and subscription
type EventBus struct {
	subscribers map[string][]EventHandler
	mu          sync.RWMutex
	logger      *slog.Logger
}

// EventHandler is a function that handles events
type EventHandler func(event *Event) error

// Event represents an event in the system
type Event struct {
	Type      string                 `json:"type"`
	Timestamp time.Time              `json:"timestamp"`
	Source    string                 `json:"source"`
	Payload   map[string]interface{} `json:"payload"`
}

// NewEventBus creates a new event bus
func NewEventBus(logger *slog.Logger) *EventBus {
	return &EventBus{
		subscribers: make(map[string][]EventHandler),
		logger:      logger,
	}
}

// Publish publishes an event to all subscribers
func (eb *EventBus) Publish(event *Event) error {
	eb.mu.RLock()
	handlers, exists := eb.subscribers[event.Type]
	if !exists {
		eb.mu.RUnlock()
		eb.logger.Debug("no subscribers for event type", "eventType", event.Type)
		return nil
	}

	// Create a copy of handlers to avoid holding the lock during execution
	handlerCopy := make([]EventHandler, len(handlers))
	copy(handlerCopy, handlers)
	eb.mu.RUnlock()

	// Execute handlers asynchronously
	go func() {
		for _, handler := range handlerCopy {
			if err := handler(event); err != nil {
				eb.logger.Error("event handler failed", "eventType", event.Type, "error", err)
			}
		}
	}()

	eb.logger.Debug("published event", "eventType", event.Type, "source", event.Source)
	return nil
}

// Subscribe subscribes to events of a specific type
func (eb *EventBus) Subscribe(eventType string, handler EventHandler) error {
	eb.mu.Lock()
	defer eb.mu.Unlock()

	eb.subscribers[eventType] = append(eb.subscribers[eventType], handler)
	eb.logger.Debug("subscribed to event type", "eventType", eventType)
	return nil
}

// Unsubscribe removes a handler from event subscriptions
func (eb *EventBus) Unsubscribe(eventType string, handler EventHandler) error {
	eb.mu.Lock()
	defer eb.mu.Unlock()

	handlers, exists := eb.subscribers[eventType]
	if !exists {
		return fmt.Errorf("no subscribers for event type: %s", eventType)
	}

	// Find and remove the handler
	for i, h := range handlers {
		if &h == &handler {
			eb.subscribers[eventType] = append(handlers[:i], handlers[i+1:]...)
			eb.logger.Debug("unsubscribed from event type", "eventType", eventType)
			return nil
		}
	}

	return fmt.Errorf("handler not found for event type: %s", eventType)
}

// GetSubscriberCount returns the number of subscribers for an event type
func (eb *EventBus) GetSubscriberCount(eventType string) int {
	eb.mu.RLock()
	defer eb.mu.RUnlock()

	handlers, exists := eb.subscribers[eventType]
	if !exists {
		return 0
	}

	return len(handlers)
}

// GetEventTypes returns all event types that have subscribers
func (eb *EventBus) GetEventTypes() []string {
	eb.mu.RLock()
	defer eb.mu.RUnlock()

	types := make([]string, 0, len(eb.subscribers))
	for eventType := range eb.subscribers {
		types = append(types, eventType)
	}

	return types
}
