// Package server provides the HTTP server, routing, middleware, and SSE broker
// for the daemon's Unix socket API.
package server

import (
	"encoding/json"
	"fmt"
	"log/slog"
	"maps"
	"net/http"
	"strings"
	"time"

	"waypaper-engine/daemon/internal/events"
)

// heartbeatInterval is how often the SSE broker sends a keep-alive comment
// to detect dead client connections.
const heartbeatInterval = 30 * time.Second

// SSEBroker streams daemon events to GET /events clients, filtered by the
// `?types=` query parameter (comma-separated, or "*").
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

// writeSSEEvent writes a single SSE frame to the writer.
//
// Format:
//
//	event: <event_type>
//	data: <json>
//	\n
func writeSSEEvent(w http.ResponseWriter, evt events.Event) error {
	dataBytes := marshalEventData(evt)

	if _, err := fmt.Fprintf(w, "event: %s\n", evt.Type); err != nil {
		return err
	}
	if _, err := fmt.Fprintf(w, "data: %s\n\n", dataBytes); err != nil {
		return err
	}
	return nil
}

// marshalEventData returns the event's Data as JSON with a "timestamp" field added,
// which every SSE payload must carry. The shared map is cloned, never mutated.
func marshalEventData(evt events.Event) []byte {
	ts := evt.Timestamp
	if ts.IsZero() {
		ts = time.Now()
	}
	payload := make(map[string]any, len(evt.Data)+1)
	maps.Copy(payload, evt.Data)
	payload["timestamp"] = ts
	b, err := json.Marshal(payload)
	if err != nil {
		slog.Warn("failed to marshal event data", "type", evt.Type, "error", err)
		b, _ = json.Marshal(map[string]any{"timestamp": ts})
	}
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
