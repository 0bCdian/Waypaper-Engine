// Package server provides the HTTP server, routing, middleware, and SSE broker
// for the daemon's Unix socket API.
package server

import (
	"encoding/json"
	"fmt"
	"log/slog"
	"net/http"
	"strings"
	"time"

	"waypaper-engine/daemon/internal/events"
)

// heartbeatInterval is how often the SSE broker sends a keep-alive comment
// to detect dead client connections.
const heartbeatInterval = 30 * time.Second

// SSEBroker is an http.Handler that streams daemon events to clients as
// Server-Sent Events (SSE).
//
// Clients connect via GET /events and optionally filter by event type using
// the `?types=` query parameter (comma-separated list, or "*" for all).
//
// The broker subscribes to the daemon's event bus on behalf of each connected
// client and relays events as SSE frames:
//
//	event: <event_type>
//	data: <json_payload>
//
// A heartbeat comment (`: keepalive`) is sent every 30 seconds to keep the
// connection alive and detect disconnected clients.
type SSEBroker struct {
	bus events.Bus
}

// NewSSEBroker creates a new SSE broker backed by the given event bus.
func NewSSEBroker(bus events.Bus) *SSEBroker {
	return &SSEBroker{bus: bus}
}

// ServeHTTP handles a single SSE client connection.
//
// The connection stays open until the client disconnects or the server shuts down.
// Each client gets its own subscription on the event bus, filtered by the
// requested event types.
func (b *SSEBroker) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	// SSE requires streaming, so the ResponseWriter must support flushing.
	flusher, ok := w.(http.Flusher)
	if !ok {
		http.Error(w, "streaming not supported", http.StatusInternalServerError)
		return
	}

	// Parse the ?types= query parameter to determine which events to subscribe to.
	typeFilter := parseTypeFilter(r)

	// Subscribe to the event bus with the requested filter.
	var ch <-chan events.Event
	if len(typeFilter) == 0 {
		ch = b.bus.Subscribe() // wildcard: all events
	} else {
		ch = b.bus.Subscribe(typeFilter...)
	}
	defer b.bus.Unsubscribe(ch)

	// Set SSE response headers.
	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Connection", "keep-alive")
	w.Header().Set("X-Accel-Buffering", "no") // disable nginx buffering if proxied
	w.WriteHeader(http.StatusOK)
	flusher.Flush()

	slog.Info("SSE client connected",
		"remote", r.RemoteAddr,
		"types", typeFilterString(typeFilter),
	)

	ctx := r.Context()
	heartbeat := time.NewTicker(heartbeatInterval)
	defer heartbeat.Stop()

	for {
		select {
		case <-ctx.Done():
			// Client disconnected.
			slog.Info("SSE client disconnected", "remote", r.RemoteAddr)
			return

		case evt, ok := <-ch:
			if !ok {
				// Bus closed (daemon shutting down).
				slog.Info("SSE bus closed, ending stream", "remote", r.RemoteAddr)
				return
			}
			if err := writeSSEEvent(w, evt); err != nil {
				slog.Warn("SSE write failed, closing connection",
					"remote", r.RemoteAddr,
					"error", err,
				)
				return
			}
			flusher.Flush()

		case <-heartbeat.C:
			// Send a keep-alive comment to detect dead connections.
			if _, err := fmt.Fprint(w, ": keepalive\n\n"); err != nil {
				slog.Debug("SSE heartbeat failed, closing connection",
					"remote", r.RemoteAddr,
					"error", err,
				)
				return
			}
			flusher.Flush()
		}
	}
}

// ssePayload is the JSON structure written to the SSE "data:" field.
// It wraps the event's own data and always includes a timestamp.
type ssePayload struct {
	// Embed the event data at the top level.
	Data any `json:"data,omitempty"`
	// Timestamp is always present in every SSE event.
	Timestamp time.Time `json:"timestamp"`
}

// writeSSEEvent writes a single SSE frame to the writer.
//
// Format:
//
//	event: <event_type>
//	data: <json>
//	\n
func writeSSEEvent(w http.ResponseWriter, evt events.Event) error {
	// Build the data payload: the event's Data with timestamp injected.
	// If Data is already a map or struct, we marshal it and merge timestamp.
	// For simplicity, we wrap in an envelope that always has timestamp.
	dataBytes := marshalEventData(evt)

	if _, err := fmt.Fprintf(w, "event: %s\n", evt.Type); err != nil {
		return err
	}
	if _, err := fmt.Fprintf(w, "data: %s\n\n", dataBytes); err != nil {
		return err
	}
	return nil
}

// marshalEventData produces the JSON for the SSE "data:" field.
//
// The spec requires that every event's data payload includes a "timestamp" field.
// If the event Data is a map, we inject the timestamp into it. If it's a struct
// or anything else, we marshal it and inject timestamp at the JSON level.
func marshalEventData(evt events.Event) []byte {
	ts := evt.Timestamp
	if ts.IsZero() {
		ts = time.Now()
	}

	// Fast path: if Data is nil, just return {"timestamp":"..."}
	if evt.Data == nil {
		b, _ := json.Marshal(map[string]any{
			"timestamp": ts,
		})
		return b
	}

	// Try to treat Data as a map so we can inject the timestamp key.
	switch d := evt.Data.(type) {
	case map[string]any:
		d["timestamp"] = ts
		b, err := json.Marshal(d)
		if err != nil {
			slog.Warn("failed to marshal event data map", "type", evt.Type, "error", err)
			return fallbackPayload(ts)
		}
		return b
	default:
		// Marshal the Data, then re-parse as map to inject timestamp.
		raw, err := json.Marshal(d)
		if err != nil {
			slog.Warn("failed to marshal event data", "type", evt.Type, "error", err)
			return fallbackPayload(ts)
		}
		var m map[string]any
		if err := json.Unmarshal(raw, &m); err != nil {
			// Data marshaled to something that isn't an object (e.g. a string or array).
			// Wrap it under a "data" key alongside timestamp.
			b, _ := json.Marshal(map[string]any{
				"data":      json.RawMessage(raw),
				"timestamp": ts,
			})
			return b
		}
		m["timestamp"] = ts
		b, err := json.Marshal(m)
		if err != nil {
			return fallbackPayload(ts)
		}
		return b
	}
}

// fallbackPayload returns a minimal JSON object with just a timestamp.
func fallbackPayload(ts time.Time) []byte {
	b, _ := json.Marshal(map[string]any{"timestamp": ts})
	return b
}

// parseTypeFilter extracts the event types from the ?types= query parameter.
// Returns nil (wildcard) if the parameter is absent, empty, or "*".
func parseTypeFilter(r *http.Request) []events.EventType {
	raw := r.URL.Query().Get("types")
	if raw == "" || raw == "*" {
		return nil // wildcard
	}

	parts := strings.Split(raw, ",")
	types := make([]events.EventType, 0, len(parts))
	for _, p := range parts {
		p = strings.TrimSpace(p)
		if p != "" {
			types = append(types, events.EventType(p))
		}
	}

	if len(types) == 0 {
		return nil
	}
	return types
}

// typeFilterString returns a human-readable description of the type filter for logging.
func typeFilterString(types []events.EventType) string {
	if len(types) == 0 {
		return "*"
	}
	parts := make([]string, len(types))
	for i, t := range types {
		parts[i] = string(t)
	}
	return strings.Join(parts, ",")
}
