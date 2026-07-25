package events

import (
	"log/slog"
	"sync"
	"time"
)

type Event struct {
	Type      EventType `json:"type"`
	Data      any       `json:"data"`
	Timestamp time.Time `json:"timestamp"`
}

type Bus interface {
	Publish(event Event)
	Subscribe(types ...EventType) <-chan Event
	Unsubscribe(ch <-chan Event)
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

func (s *subscription) matches(t EventType) bool {
	if len(s.types) == 0 {
		return true
	}
	_, ok := s.types[t]
	return ok
}

type eventBus struct {
	mu     sync.RWMutex
	subs   map[<-chan Event]*subscription
	closed bool
}

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

	b.subs[ch] = sub
	return ch
}

func (b *eventBus) Unsubscribe(ch <-chan Event) {
	b.mu.Lock()
	defer b.mu.Unlock()

	sub, ok := b.subs[ch]
	if !ok {
		return
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
