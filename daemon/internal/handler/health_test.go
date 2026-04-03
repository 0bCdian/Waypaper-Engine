package handler

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"sync/atomic"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestHealthHandler_Healthz(t *testing.T) {
	h := NewHealthHandler("1.0.0", nil)

	w := httptest.NewRecorder()
	r := httptest.NewRequest(http.MethodGet, "/healthz", nil)
	h.Healthz(w, r)

	assert.Equal(t, http.StatusOK, w.Code)
	var body map[string]any
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &body))
	assert.Equal(t, "ok", body["status"])
	assert.EqualValues(t, MonitorStackVersion, body["monitor_stack_version"])
	order, ok := body["monitor_provider_order"].([]any)
	require.True(t, ok)
	require.GreaterOrEqual(t, len(order), 1)
	assert.Equal(t, "wayland-utauri", order[0])
}

func TestHealthHandler_Info(t *testing.T) {
	h := NewHealthHandler("1.0.0", nil)

	w := httptest.NewRecorder()
	r := httptest.NewRequest(http.MethodGet, "/info", nil)
	h.Info(w, r)

	assert.Equal(t, http.StatusOK, w.Code)

	var body map[string]any
	require.NoError(t, json.NewDecoder(w.Body).Decode(&body))
	assert.Equal(t, "1.0.0", body["version"])
	assert.Contains(t, body, "pid")
	assert.Contains(t, body, "go_version")
}

func TestHealthHandler_Shutdown(t *testing.T) {
	var called atomic.Bool
	shutdownFn := func() { called.Store(true) }

	h := NewHealthHandler("1.0.0", shutdownFn)

	w := httptest.NewRecorder()
	r := httptest.NewRequest(http.MethodPost, "/shutdown", nil)
	h.Shutdown(w, r)

	assert.Equal(t, http.StatusOK, w.Code)
	assert.JSONEq(t, `{"status":"shutting_down"}`, w.Body.String())

	require.Eventually(t, func() bool { return called.Load() }, 500*time.Millisecond, 10*time.Millisecond)
}
