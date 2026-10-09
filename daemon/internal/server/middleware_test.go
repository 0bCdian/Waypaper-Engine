package server

import (
	"context"
	"net/http"
	"net/http/httptest"
	"sync/atomic"
	"testing"
	"time"

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

func gatedRequest(ready <-chan struct{}, req *http.Request) (*httptest.ResponseRecorder, <-chan struct{}, *atomic.Bool) {
	var called atomic.Bool
	handler := RequireReady(ready)(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		called.Store(true)
		w.WriteHeader(http.StatusOK)
	}))
	w := httptest.NewRecorder()
	done := make(chan struct{})
	go func() {
		handler.ServeHTTP(w, req)
		close(done)
	}()
	return w, done, &called
}

func TestRequireReady_WaitsUntilReady(t *testing.T) {
	ready := make(chan struct{})
	w, done, called := gatedRequest(ready, httptest.NewRequest("POST", "/wallpaper/set", nil))

	select {
	case <-done:
		t.Fatal("request completed before the backend was ready")
	case <-time.After(50 * time.Millisecond):
	}
	assert.False(t, called.Load())

	close(ready)
	<-done
	assert.True(t, called.Load())
	assert.Equal(t, http.StatusOK, w.Code)
}

func TestRequireReady_AbandonsCancelledRequest(t *testing.T) {
	ctx, cancel := context.WithCancel(context.Background())
	req := httptest.NewRequest("POST", "/wallpaper/set", nil).WithContext(ctx)
	_, done, called := gatedRequest(make(chan struct{}), req)

	cancel()
	select {
	case <-done:
	case <-time.After(time.Second):
		t.Fatal("cancelled request was not abandoned")
	}
	assert.False(t, called.Load())
}

func TestRequireReady_NilChannelMeansReady(t *testing.T) {
	_, done, called := gatedRequest(nil, httptest.NewRequest("POST", "/wallpaper/set", nil))
	select {
	case <-done:
	case <-time.After(time.Second):
		t.Fatal("nil ready channel should not block")
	}
	assert.True(t, called.Load())
}
