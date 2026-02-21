package events

import (
	"sync"
	"testing"
	"time"
)

func TestNewBus(t *testing.T) {
	bus := NewBus()
	if bus == nil {
		t.Fatal("NewBus() returned nil")
	}
	bus.Close()
}

func TestPublishAndSubscribeWildcard(t *testing.T) {
	bus := NewBus()
	defer bus.Close()

	ch := bus.Subscribe() // wildcard: receives all events

	bus.Publish(Event{Type: WallpaperChanged, Data: map[string]any{"image_id": 42}})

	select {
	case evt := <-ch:
		if evt.Type != WallpaperChanged {
			t.Errorf("expected type %q, got %q", WallpaperChanged, evt.Type)
		}
		if evt.Timestamp.IsZero() {
			t.Error("expected Timestamp to be set automatically")
		}
		data, ok := evt.Data.(map[string]any)
		if !ok {
			t.Fatal("expected Data to be map[string]any")
		}
		if data["image_id"] != 42 {
			t.Errorf("expected image_id=42, got %v", data["image_id"])
		}
	case <-time.After(time.Second):
		t.Fatal("timed out waiting for event")
	}
}

func TestSubscribeWithTypeFilter(t *testing.T) {
	bus := NewBus()
	defer bus.Close()

	ch := bus.Subscribe(PlaylistStarted, PlaylistStopped)

	// Publish a matching event.
	bus.Publish(Event{Type: PlaylistStarted, Data: "started"})
	// Publish a non-matching event.
	bus.Publish(Event{Type: WallpaperChanged, Data: "changed"})
	// Publish another matching event.
	bus.Publish(Event{Type: PlaylistStopped, Data: "stopped"})

	// Should receive PlaylistStarted.
	select {
	case evt := <-ch:
		if evt.Type != PlaylistStarted {
			t.Errorf("expected %q, got %q", PlaylistStarted, evt.Type)
		}
	case <-time.After(time.Second):
		t.Fatal("timed out waiting for PlaylistStarted")
	}

	// Should receive PlaylistStopped (WallpaperChanged was filtered out).
	select {
	case evt := <-ch:
		if evt.Type != PlaylistStopped {
			t.Errorf("expected %q, got %q", PlaylistStopped, evt.Type)
		}
	case <-time.After(time.Second):
		t.Fatal("timed out waiting for PlaylistStopped")
	}

	// Channel should be empty now.
	select {
	case evt := <-ch:
		t.Errorf("unexpected event: %+v", evt)
	default:
		// good
	}
}

func TestMultipleSubscribers(t *testing.T) {
	bus := NewBus()
	defer bus.Close()

	ch1 := bus.Subscribe(WallpaperChanged)
	ch2 := bus.Subscribe(WallpaperChanged)
	ch3 := bus.Subscribe(PlaylistStarted) // different filter

	bus.Publish(Event{Type: WallpaperChanged, Data: "test"})

	// ch1 and ch2 should both receive the event.
	for _, ch := range []<-chan Event{ch1, ch2} {
		select {
		case evt := <-ch:
			if evt.Type != WallpaperChanged {
				t.Errorf("expected %q, got %q", WallpaperChanged, evt.Type)
			}
		case <-time.After(time.Second):
			t.Fatal("timed out waiting for event")
		}
	}

	// ch3 should NOT receive it.
	select {
	case evt := <-ch3:
		t.Errorf("ch3 should not have received event, got: %+v", evt)
	default:
		// good
	}
}

func TestUnsubscribe(t *testing.T) {
	bus := NewBus()
	defer bus.Close()

	ch := bus.Subscribe()
	bus.Unsubscribe(ch)

	// Channel should be closed.
	select {
	case _, ok := <-ch:
		if ok {
			t.Error("expected channel to be closed after Unsubscribe")
		}
	default:
		t.Error("expected closed channel to be readable (return zero value)")
	}

	// Publishing after unsubscribe should not panic.
	bus.Publish(Event{Type: WallpaperChanged, Data: "test"})
}

func TestUnsubscribeIdempotent(t *testing.T) {
	bus := NewBus()
	defer bus.Close()

	ch := bus.Subscribe()

	// Calling Unsubscribe twice should not panic.
	bus.Unsubscribe(ch)
	bus.Unsubscribe(ch)
}

func TestClose(t *testing.T) {
	bus := NewBus()

	ch1 := bus.Subscribe()
	ch2 := bus.Subscribe(WallpaperChanged)

	bus.Close()

	// All channels should be closed.
	for i, ch := range []<-chan Event{ch1, ch2} {
		select {
		case _, ok := <-ch:
			if ok {
				t.Errorf("channel %d: expected closed after Close()", i)
			}
		default:
			t.Errorf("channel %d: expected closed channel to be readable", i)
		}
	}

	// Publish after Close should not panic.
	bus.Publish(Event{Type: WallpaperChanged, Data: "test"})

	// Subscribe after Close should return a closed channel.
	ch3 := bus.Subscribe()
	select {
	case _, ok := <-ch3:
		if ok {
			t.Error("expected closed channel from Subscribe after Close")
		}
	default:
		t.Error("expected Subscribe-after-Close channel to be immediately readable (closed)")
	}
}

func TestCloseIdempotent(t *testing.T) {
	bus := NewBus()
	bus.Close()
	bus.Close() // should not panic
}

func TestPublishSetsTimestamp(t *testing.T) {
	bus := NewBus()
	defer bus.Close()

	ch := bus.Subscribe()

	before := time.Now()
	bus.Publish(Event{Type: WallpaperChanged, Data: nil})
	after := time.Now()

	evt := <-ch
	if evt.Timestamp.Before(before) || evt.Timestamp.After(after) {
		t.Errorf("timestamp %v not between %v and %v", evt.Timestamp, before, after)
	}
}

func TestPublishPreservesExplicitTimestamp(t *testing.T) {
	bus := NewBus()
	defer bus.Close()

	ch := bus.Subscribe()

	explicit := time.Date(2026, 1, 1, 0, 0, 0, 0, time.UTC)
	bus.Publish(Event{Type: WallpaperChanged, Data: nil, Timestamp: explicit})

	evt := <-ch
	if !evt.Timestamp.Equal(explicit) {
		t.Errorf("expected explicit timestamp %v, got %v", explicit, evt.Timestamp)
	}
}

func TestNonBlockingPublish(t *testing.T) {
	bus := NewBus()
	defer bus.Close()

	ch := bus.Subscribe()

	// Fill the subscriber buffer completely.
	for i := 0; i < subscriberBufferSize; i++ {
		bus.Publish(Event{Type: WallpaperChanged, Data: i})
	}

	// The next publish should NOT block (event is dropped for this subscriber).
	done := make(chan struct{})
	go func() {
		bus.Publish(Event{Type: WallpaperChanged, Data: "overflow"})
		close(done)
	}()

	select {
	case <-done:
		// good — publish did not block
	case <-time.After(time.Second):
		t.Fatal("Publish blocked on full subscriber buffer")
	}

	// Drain the channel and verify we got the buffered events.
	count := 0
	for range subscriberBufferSize {
		<-ch
		count++
	}
	if count != subscriberBufferSize {
		t.Errorf("expected %d events, got %d", subscriberBufferSize, count)
	}

	// The overflow event was dropped, channel should be empty.
	select {
	case evt := <-ch:
		t.Errorf("expected empty channel after drain, got: %+v", evt)
	default:
		// good
	}
}

func TestConcurrentPublishSubscribe(t *testing.T) {
	bus := NewBus()
	defer bus.Close()

	const numPublishers = 10
	const numEventsPerPublisher = 100
	const numSubscribers = 5

	var wg sync.WaitGroup

	// Start subscribers.
	channels := make([]<-chan Event, numSubscribers)
	counts := make([]int, numSubscribers)
	for i := range numSubscribers {
		channels[i] = bus.Subscribe()
	}

	// Drain subscribers in goroutines.
	for i := range numSubscribers {
		wg.Add(1)
		go func(idx int) {
			defer wg.Done()
			for range channels[idx] {
				counts[idx]++
			}
		}(i)
	}

	// Publish concurrently.
	var pubWg sync.WaitGroup
	for range numPublishers {
		pubWg.Add(1)
		go func() {
			defer pubWg.Done()
			for range numEventsPerPublisher {
				bus.Publish(Event{Type: WallpaperChanged, Data: "concurrent"})
			}
		}()
	}

	pubWg.Wait()

	// Close the bus to signal subscribers to finish.
	bus.Close()
	wg.Wait()

	totalExpected := numPublishers * numEventsPerPublisher
	for i, c := range counts {
		// Due to non-blocking publish, some events may be dropped if a subscriber
		// is slow. But we should get a reasonable number.
		if c == 0 {
			t.Errorf("subscriber %d received 0 events (expected up to %d)", i, totalExpected)
		}
		t.Logf("subscriber %d received %d/%d events", i, c, totalExpected)
	}
}
