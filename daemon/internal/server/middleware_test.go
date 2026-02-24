package server

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestRequestID_SetsHeader(t *testing.T) {
	handler := RequestID(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))

	req := httptest.NewRequest("GET", "/test", nil)
	w := httptest.NewRecorder()

	handler.ServeHTTP(w, req)

	id := w.Header().Get("X-Request-ID")
	assert.NotEmpty(t, id)
	assert.Len(t, id, 36)
	assert.Contains(t, id, "-")
}

func TestRequestID_InjectsContext(t *testing.T) {
	var ctxID string
	handler := RequestID(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		ctxID = GetRequestID(r.Context())
		w.WriteHeader(http.StatusOK)
	}))

	req := httptest.NewRequest("GET", "/test", nil)
	w := httptest.NewRecorder()

	handler.ServeHTTP(w, req)

	headerID := w.Header().Get("X-Request-ID")
	require.NotEmpty(t, ctxID)
	assert.Equal(t, headerID, ctxID)
}

func TestRequestID_UniquePerRequest(t *testing.T) {
	handler := RequestID(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))

	w1 := httptest.NewRecorder()
	handler.ServeHTTP(w1, httptest.NewRequest("GET", "/a", nil))

	w2 := httptest.NewRecorder()
	handler.ServeHTTP(w2, httptest.NewRequest("GET", "/b", nil))

	id1 := w1.Header().Get("X-Request-ID")
	id2 := w2.Header().Get("X-Request-ID")

	require.NotEmpty(t, id1)
	require.NotEmpty(t, id2)
	assert.NotEqual(t, id1, id2)
}

func TestRecoverer_CatchesPanic(t *testing.T) {
	handler := Recoverer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		panic("test panic")
	}))

	req := httptest.NewRequest("GET", "/test", nil)
	w := httptest.NewRecorder()

	handler.ServeHTTP(w, req)

	assert.Equal(t, http.StatusInternalServerError, w.Code)
	assert.Contains(t, w.Body.String(), "internal server error")
}

func TestRecoverer_NormalRequest(t *testing.T) {
	handler := Recoverer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		w.Write([]byte("all good"))
	}))

	req := httptest.NewRequest("GET", "/test", nil)
	w := httptest.NewRecorder()

	handler.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)
	assert.Equal(t, "all good", w.Body.String())
}

func TestStatusWriter_Flush(t *testing.T) {
	rec := httptest.NewRecorder()
	sw := &statusWriter{ResponseWriter: rec, status: http.StatusOK}

	sw.WriteHeader(http.StatusCreated)
	assert.Equal(t, http.StatusCreated, sw.status)
	assert.Equal(t, http.StatusCreated, rec.Code)

	assert.NotPanics(t, func() {
		sw.Flush()
	})
}
