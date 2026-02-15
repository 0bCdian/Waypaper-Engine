package server

import (
	"bufio"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"waypaper-engine/daemon/internal/events"
)

// readSSEEvent reads a single SSE event from a bufio.Reader.
// Returns the event type and the raw data line.
func readSSEEvent(scanner *bufio.Scanner) (eventType, data string) {
	for scanner.Scan() {
		line := scanner.Text()
		if line == "" {
			// End of SSE frame.
			return eventType, data
		}
		if strings.HasPrefix(line, "event: ") {
			eventType = strings.TrimPrefix(line, "event: ")
		} else if strings.HasPrefix(line, "data: ") {
			data = strings.TrimPrefix(line, "data: ")
		}
	}
	return eventType, data
}

func TestSSEBroker_BasicEvent(t *testing.T) {
	bus := events.NewBus()
	defer bus.Close()

	broker := NewSSEBroker(bus)

	// Create a cancellable context so we can stop the handler.
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	req := httptest.NewRequest("GET", "/events", nil)
	req = req.WithContext(ctx)
	w := httptest.NewRecorder()

	// Run the SSE handler in a goroutine since it blocks.
	done := make(chan struct{})
	go func() {
		broker.ServeHTTP(w, req)
		close(done)
	}()

	// Give the handler time to subscribe and set headers.
	time.Sleep(50 * time.Millisecond)

	// Publish an event.
	bus.Publish(events.Event{
		Type: events.WallpaperChanged,
		Data: map[string]any{"image_id": 42, "monitor": "HDMI-A-1"},
	})

	// Give time for the event to be written.
	time.Sleep(50 * time.Millisecond)

	// Cancel context to stop the handler.
	cancel()
	<-done

	// Parse the response.
	body := w.Body.String()

	if w.Header().Get("Content-Type") != "text/event-stream" {
		t.Errorf("expected Content-Type text/event-stream, got %q", w.Header().Get("Content-Type"))
	}
	if w.Header().Get("Cache-Control") != "no-cache" {
		t.Errorf("expected Cache-Control no-cache, got %q", w.Header().Get("Cache-Control"))
	}

	// The body should contain our event.
	if !strings.Contains(body, "event: wallpaper_changed") {
		t.Errorf("body missing event type line, got:\n%s", body)
	}
	if !strings.Contains(body, `"image_id"`) {
		t.Errorf("body missing image_id in data, got:\n%s", body)
	}
	if !strings.Contains(body, `"timestamp"`) {
		t.Errorf("body missing timestamp in data, got:\n%s", body)
	}
}

func TestSSEBroker_TypeFilter(t *testing.T) {
	bus := events.NewBus()
	defer bus.Close()

	broker := NewSSEBroker(bus)

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	// Request only playlist events.
	req := httptest.NewRequest("GET", "/events?types=playlist_started,playlist_stopped", nil)
	req = req.WithContext(ctx)
	w := httptest.NewRecorder()

	done := make(chan struct{})
	go func() {
		broker.ServeHTTP(w, req)
		close(done)
	}()

	time.Sleep(50 * time.Millisecond)

	// Publish a filtered-out event.
	bus.Publish(events.Event{
		Type: events.WallpaperChanged,
		Data: map[string]any{"image_id": 1},
	})
	// Publish a matching event.
	bus.Publish(events.Event{
		Type: events.PlaylistStarted,
		Data: map[string]any{"playlist_id": 3},
	})

	time.Sleep(50 * time.Millisecond)
	cancel()
	<-done

	body := w.Body.String()

	// Should contain the playlist event.
	if !strings.Contains(body, "event: playlist_started") {
		t.Errorf("body should contain playlist_started, got:\n%s", body)
	}
	// Should NOT contain the wallpaper event.
	if strings.Contains(body, "event: wallpaper_changed") {
		t.Errorf("body should not contain wallpaper_changed (filtered), got:\n%s", body)
	}
}

func TestSSEBroker_WildcardFilter(t *testing.T) {
	bus := events.NewBus()
	defer bus.Close()

	broker := NewSSEBroker(bus)

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	// types=* means all events (wildcard).
	req := httptest.NewRequest("GET", "/events?types=*", nil)
	req = req.WithContext(ctx)
	w := httptest.NewRecorder()

	done := make(chan struct{})
	go func() {
		broker.ServeHTTP(w, req)
		close(done)
	}()

	time.Sleep(50 * time.Millisecond)

	bus.Publish(events.Event{Type: events.WallpaperChanged, Data: map[string]any{}})
	bus.Publish(events.Event{Type: events.PlaylistStarted, Data: map[string]any{}})

	time.Sleep(50 * time.Millisecond)
	cancel()
	<-done

	body := w.Body.String()
	if !strings.Contains(body, "event: wallpaper_changed") {
		t.Errorf("wildcard should include wallpaper_changed")
	}
	if !strings.Contains(body, "event: playlist_started") {
		t.Errorf("wildcard should include playlist_started")
	}
}

func TestSSEBroker_DataIncludesTimestamp(t *testing.T) {
	bus := events.NewBus()
	defer bus.Close()

	broker := NewSSEBroker(bus)

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	req := httptest.NewRequest("GET", "/events", nil)
	req = req.WithContext(ctx)
	w := httptest.NewRecorder()

	done := make(chan struct{})
	go func() {
		broker.ServeHTTP(w, req)
		close(done)
	}()

	time.Sleep(50 * time.Millisecond)

	bus.Publish(events.Event{
		Type: events.ConfigChanged,
		Data: map[string]any{"section": "app"},
	})

	time.Sleep(50 * time.Millisecond)
	cancel()
	<-done

	// Parse the SSE data field.
	body := w.Body.String()
	scanner := bufio.NewScanner(strings.NewReader(body))
	eventType, data := readSSEEvent(scanner)

	if eventType != "config_changed" {
		t.Errorf("expected event type 'config_changed', got %q", eventType)
	}

	// Parse the JSON data.
	var payload map[string]any
	if err := json.Unmarshal([]byte(data), &payload); err != nil {
		t.Fatalf("failed to parse SSE data as JSON: %v\nraw: %s", err, data)
	}

	if _, ok := payload["timestamp"]; !ok {
		t.Error("SSE data payload missing 'timestamp' field")
	}
	if payload["section"] != "app" {
		t.Errorf("expected section='app', got %v", payload["section"])
	}
}

func TestSSEBroker_NilData(t *testing.T) {
	bus := events.NewBus()
	defer bus.Close()

	broker := NewSSEBroker(bus)

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	req := httptest.NewRequest("GET", "/events", nil)
	req = req.WithContext(ctx)
	w := httptest.NewRecorder()

	done := make(chan struct{})
	go func() {
		broker.ServeHTTP(w, req)
		close(done)
	}()

	time.Sleep(50 * time.Millisecond)

	// Publish an event with nil Data.
	bus.Publish(events.Event{Type: events.ProcessingStarted, Data: nil})

	time.Sleep(50 * time.Millisecond)
	cancel()
	<-done

	body := w.Body.String()
	if !strings.Contains(body, "event: processing_started") {
		t.Errorf("body should contain processing_started event")
	}

	// The data should still be valid JSON with at least a timestamp.
	scanner := bufio.NewScanner(strings.NewReader(body))
	_, data := readSSEEvent(scanner)

	var payload map[string]any
	if err := json.Unmarshal([]byte(data), &payload); err != nil {
		t.Fatalf("failed to parse nil-data SSE payload as JSON: %v\nraw: %s", err, data)
	}
	if _, ok := payload["timestamp"]; !ok {
		t.Error("nil-data SSE payload missing timestamp")
	}
}

func TestSSEBroker_BusCloseEndsStream(t *testing.T) {
	bus := events.NewBus()
	broker := NewSSEBroker(bus)

	req := httptest.NewRequest("GET", "/events", nil)
	w := httptest.NewRecorder()

	done := make(chan struct{})
	go func() {
		broker.ServeHTTP(w, req)
		close(done)
	}()

	time.Sleep(50 * time.Millisecond)

	// Close the bus -- the handler should exit gracefully.
	bus.Close()

	select {
	case <-done:
		// good
	case <-time.After(2 * time.Second):
		t.Fatal("SSE handler did not exit after bus.Close()")
	}
}

func TestSSEBroker_MultipleEvents(t *testing.T) {
	bus := events.NewBus()
	defer bus.Close()

	broker := NewSSEBroker(bus)

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	req := httptest.NewRequest("GET", "/events", nil)
	req = req.WithContext(ctx)
	w := httptest.NewRecorder()

	done := make(chan struct{})
	go func() {
		broker.ServeHTTP(w, req)
		close(done)
	}()

	time.Sleep(50 * time.Millisecond)

	// Publish 3 events.
	for i := range 3 {
		bus.Publish(events.Event{
			Type: events.ImageProcessed,
			Data: map[string]any{"image_id": i + 1},
		})
	}

	time.Sleep(100 * time.Millisecond)
	cancel()
	<-done

	body := w.Body.String()
	count := strings.Count(body, "event: image_processed")
	if count != 3 {
		t.Errorf("expected 3 image_processed events, got %d\nbody:\n%s", count, body)
	}
}

func TestParseTypeFilter(t *testing.T) {
	tests := []struct {
		name     string
		query    string
		wantNil  bool
		wantLen  int
		wantType events.EventType
	}{
		{"empty", "", true, 0, ""},
		{"wildcard star", "types=*", true, 0, ""},
		{"single type", "types=wallpaper_changed", false, 1, events.WallpaperChanged},
		{"multiple types", "types=playlist_started,playlist_stopped", false, 2, events.PlaylistStarted},
		{"with spaces", "types=+playlist_started+,+playlist_stopped+", false, 2, events.PlaylistStarted},
		{"no types param", "other=value", true, 0, ""},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			req := httptest.NewRequest("GET", "/events?"+tt.query, nil)
			result := parseTypeFilter(req)

			if tt.wantNil {
				if result != nil {
					t.Errorf("expected nil, got %v", result)
				}
				return
			}

			if result == nil {
				t.Fatal("expected non-nil result")
			}
			if len(result) != tt.wantLen {
				t.Errorf("expected %d types, got %d: %v", tt.wantLen, len(result), result)
			}
			if len(result) > 0 && result[0] != tt.wantType {
				t.Errorf("expected first type %q, got %q", tt.wantType, result[0])
			}
		})
	}
}

func TestMarshalEventData_MapInjectsTimestamp(t *testing.T) {
	evt := events.Event{
		Type:      events.WallpaperChanged,
		Data:      map[string]any{"image_id": 42},
		Timestamp: time.Date(2026, 2, 15, 21, 0, 0, 0, time.UTC),
	}

	result := marshalEventData(evt)

	var m map[string]any
	if err := json.Unmarshal(result, &m); err != nil {
		t.Fatalf("failed to unmarshal: %v", err)
	}
	if m["image_id"] != float64(42) {
		t.Errorf("expected image_id=42, got %v", m["image_id"])
	}
	if _, ok := m["timestamp"]; !ok {
		t.Error("expected timestamp in data")
	}
}

func TestMarshalEventData_StructInjectsTimestamp(t *testing.T) {
	type payload struct {
		PlaylistID int    `json:"playlist_id"`
		Monitor    string `json:"monitor"`
	}

	evt := events.Event{
		Type:      events.PlaylistStarted,
		Data:      payload{PlaylistID: 3, Monitor: "HDMI-A-1"},
		Timestamp: time.Date(2026, 2, 15, 21, 0, 0, 0, time.UTC),
	}

	result := marshalEventData(evt)

	var m map[string]any
	if err := json.Unmarshal(result, &m); err != nil {
		t.Fatalf("failed to unmarshal: %v", err)
	}
	if m["playlist_id"] != float64(3) {
		t.Errorf("expected playlist_id=3, got %v", m["playlist_id"])
	}
	if m["monitor"] != "HDMI-A-1" {
		t.Errorf("expected monitor=HDMI-A-1, got %v", m["monitor"])
	}
	if _, ok := m["timestamp"]; !ok {
		t.Error("expected timestamp in struct data")
	}
}

func TestMarshalEventData_NilData(t *testing.T) {
	evt := events.Event{
		Type:      events.ProcessingStarted,
		Data:      nil,
		Timestamp: time.Date(2026, 2, 15, 21, 0, 0, 0, time.UTC),
	}

	result := marshalEventData(evt)

	var m map[string]any
	if err := json.Unmarshal(result, &m); err != nil {
		t.Fatalf("failed to unmarshal: %v", err)
	}
	if _, ok := m["timestamp"]; !ok {
		t.Error("expected timestamp even with nil data")
	}
}

func TestWriteSSEEvent_Format(t *testing.T) {
	w := httptest.NewRecorder()

	evt := events.Event{
		Type:      events.WallpaperChanged,
		Data:      map[string]any{"image_id": 1},
		Timestamp: time.Date(2026, 2, 15, 21, 0, 0, 0, time.UTC),
	}

	if err := writeSSEEvent(w, evt); err != nil {
		t.Fatalf("writeSSEEvent failed: %v", err)
	}

	body := w.Body.String()

	// Must start with "event: "
	if !strings.HasPrefix(body, "event: wallpaper_changed\n") {
		t.Errorf("SSE frame should start with event line, got:\n%s", body)
	}

	// Must end with double newline (end of SSE frame).
	if !strings.HasSuffix(body, "\n\n") {
		t.Errorf("SSE frame should end with \\n\\n, got:\n%q", body)
	}

	// Must contain a data: line.
	if !strings.Contains(body, "data: ") {
		t.Errorf("SSE frame should contain data line, got:\n%s", body)
	}

	// The data line should be valid JSON.
	lines := strings.Split(body, "\n")
	for _, line := range lines {
		if strings.HasPrefix(line, "data: ") {
			jsonStr := strings.TrimPrefix(line, "data: ")
			var m map[string]any
			if err := json.Unmarshal([]byte(jsonStr), &m); err != nil {
				t.Errorf("data line is not valid JSON: %v\nraw: %s", err, jsonStr)
			}
		}
	}
}

func TestSSEBroker_NoStreamingSupport(t *testing.T) {
	bus := events.NewBus()
	defer bus.Close()

	broker := NewSSEBroker(bus)

	req := httptest.NewRequest("GET", "/events", nil)

	// Use a custom ResponseWriter that does NOT implement http.Flusher.
	w := &noFlushResponseWriter{header: make(http.Header)}

	broker.ServeHTTP(w, req)

	if w.statusCode != http.StatusInternalServerError {
		t.Errorf("expected 500 for non-flusher, got %d", w.statusCode)
	}
}

// noFlushResponseWriter is an http.ResponseWriter that does NOT implement http.Flusher.
type noFlushResponseWriter struct {
	header     http.Header
	statusCode int
	body       []byte
}

func (w *noFlushResponseWriter) Header() http.Header        { return w.header }
func (w *noFlushResponseWriter) WriteHeader(code int)        { w.statusCode = code }
func (w *noFlushResponseWriter) Write(b []byte) (int, error) { w.body = append(w.body, b...); return len(b), nil }
