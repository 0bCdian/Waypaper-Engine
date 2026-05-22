package events

import (
	"log/slog"
	"sync"
	"time"
)

// Event is a single event published through the bus.
// All fields are populated by the publisher except Timestamp, which is set
// automatically by Bus.Publish if zero.
type Event struct {
	// Type identifies the event kind (matches SSE "event:" field).
	Type EventType `json:"type"`

	// Data is the event payload. It must be JSON-serializable.
	// The SSE broker marshals this to JSON for the "data:" field.
	Data any `json:"data"`

	// Timestamp is when the event was published.
	// Set automatically by Publish() if zero.
	Timestamp time.Time `json:"timestamp"`
}

// Bus is the interface for the daemon's in-process pub/sub event system.
//
// Components publish events (e.g. playlist manager publishes PlaylistStarted),
// and subscribers receive them on a channel (e.g. SSE broker fans out to HTTP clients).
//
// Subscribe returns a channel that receives events matching the requested types.
// Passing no types subscribes to ALL events (wildcard).
// Channels are buffered; if a subscriber is too slow, events are dropped for that
// subscriber (non-blocking publish).
type Bus interface {
	// Publish sends an event to all matching subscribers.
	// If event.Timestamp is zero, it is set to time.Now().
	// Non-blocking: if a subscriber's channel is full, the event is dropped for
	// that subscriber and a warning is logged.
	Publish(event Event)

	// Subscribe returns a channel that will receive events matching any of the
	// given types. If no types are specified, the channel receives ALL events.
	// The caller must eventually call Unsubscribe to free resources.
	Subscribe(types ...EventType) <-chan Event

	// Unsubscribe removes a previously subscribed channel and closes it.
	// Safe to call multiple times with the same channel (subsequent calls are no-ops).
	Unsubscribe(ch <-chan Event)

	// Close shuts down the bus: closes all subscriber channels and rejects
	// future Publish/Subscribe calls. Safe to call multiple times.
	Close()
}

// subscriberBufferSize is the capacity of each subscriber's buffered channel.
// If a subscriber doesn't drain fast enough, events are dropped (non-blocking send).
const subscriberBufferSize = 64

// subscription tracks a single subscriber: its channel and the event types it
// cares about (empty means wildcard — all events).
type subscription struct {
	ch    chan Event
	types map[EventType]struct{} // empty map = wildcard (all events)
}

// matches returns true if this subscription should receive the given event type.
func (s *subscription) matches(t EventType) bool {
	if len(s.types) == 0 {
		return true // wildcard
	}
	_, ok := s.types[t]
	return ok
}

// eventBus is the concrete implementation of Bus.
type eventBus struct {
	mu     sync.RWMutex
	subs   map[<-chan Event]*subscription // keyed by the read-only channel (the one returned to callers)
	closed bool
}

// NewBus creates a new event bus ready for use.
func NewBus() Bus {
	return &eventBus{
		subs: make(map[<-chan Event]*subscription),
	}
}

func (b *eventBus) Publish(event Event) {
	if event.Timestamp.IsZero() {
		event.Timestamp = time.Now()
	}

	b.mu.RLock()
	defer b.mu.RUnlock()

	if b.closed {
		return
	}

	for _, sub := range b.subs {
		if !sub.matches(event.Type) {
			continue
		}
		// Non-blocking send: drop event for slow subscribers.
		select {
		case sub.ch <- event:
		default:
			slog.Warn("dropping event for slow subscriber",
				"type", event.Type,
				"buffer_size", subscriberBufferSize,
			)
		}
	}
}

func (b *eventBus) Subscribe(types ...EventType) <-chan Event {
	ch := make(chan Event, subscriberBufferSize)

	typeSet := make(map[EventType]struct{}, len(types))
	for _, t := range types {
		typeSet[t] = struct{}{}
	}

	sub := &subscription{
		ch:    ch,
		types: typeSet,
	}

	b.mu.Lock()
	defer b.mu.Unlock()

	if b.closed {
		close(ch)
		return ch
	}

	// Key the subscription by the read-only channel so Unsubscribe can look it up.
	b.subs[ch] = sub
	return ch
}

func (b *eventBus) Unsubscribe(ch <-chan Event) {
	b.mu.Lock()
	defer b.mu.Unlock()

	sub, ok := b.subs[ch]
	if !ok {
		return // already unsubscribed or never subscribed
	}

	delete(b.subs, ch)
	close(sub.ch)
}

func (b *eventBus) Close() {
	b.mu.Lock()
	defer b.mu.Unlock()

	if b.closed {
		return
	}
	b.closed = true

	for key, sub := range b.subs {
		close(sub.ch)
		delete(b.subs, key)
	}
}
