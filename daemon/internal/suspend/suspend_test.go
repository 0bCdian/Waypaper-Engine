package suspend

import (
	"context"
	"errors"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/godbus/dbus/v5"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// fakeConn is a test double for the conn interface, standing in for a real
// D-Bus system bus connection so watchLoop's reaction logic can be exercised
// without logind/elogind actually running.
type fakeConn struct {
	mu       sync.Mutex
	sigCh    chan<- *dbus.Signal
	matchErr error
	closed   atomic.Bool
}

func (f *fakeConn) AddMatchSignal(_ ...dbus.MatchOption) error {
	return f.matchErr
}

func (f *fakeConn) Signal(ch chan<- *dbus.Signal) {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.sigCh = ch
}

func (f *fakeConn) Close() error {
	f.closed.Store(true)
	return nil
}

func (f *fakeConn) hasSigCh() bool {
	f.mu.Lock()
	defer f.mu.Unlock()
	return f.sigCh != nil
}

func (f *fakeConn) send(sig *dbus.Signal) {
	f.mu.Lock()
	ch := f.sigCh
	f.mu.Unlock()
	ch <- sig
}

func TestWatchLoopFiresOnResumeSignal(t *testing.T) {
	fc := &fakeConn{}
	var calls atomic.Int32
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	done := make(chan error, 1)
	go func() { done <- watchLoop(ctx, fc, func() { calls.Add(1) }) }()

	require.Eventually(t, fc.hasSigCh, time.Second, time.Millisecond,
		"watchLoop must register a signal channel before it can receive events")

	fc.send(&dbus.Signal{Name: prepareForSleepSignal, Body: []any{false}})

	require.Eventually(t, func() bool { return calls.Load() == 1 }, time.Second, time.Millisecond,
		"onResume must fire for a PrepareForSleep(false) signal")

	cancel()
	assert.ErrorIs(t, <-done, context.Canceled)
}

func TestWatchLoopIgnoresSleepSignal(t *testing.T) {
	fc := &fakeConn{}
	var calls atomic.Int32
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	go func() { _ = watchLoop(ctx, fc, func() { calls.Add(1) }) }()
	require.Eventually(t, fc.hasSigCh, time.Second, time.Millisecond)

	fc.send(&dbus.Signal{Name: prepareForSleepSignal, Body: []any{true}})
	time.Sleep(50 * time.Millisecond)
	assert.Equal(t, int32(0), calls.Load(),
		"PrepareForSleep(true) (about to sleep) must not fire onResume")
}

func TestWatchLoopFiresOncePerResumeSignal(t *testing.T) {
	fc := &fakeConn{}
	var calls atomic.Int32
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	go func() { _ = watchLoop(ctx, fc, func() { calls.Add(1) }) }()
	require.Eventually(t, fc.hasSigCh, time.Second, time.Millisecond)

	fc.send(&dbus.Signal{Name: prepareForSleepSignal, Body: []any{true}})
	fc.send(&dbus.Signal{Name: prepareForSleepSignal, Body: []any{false}})
	fc.send(&dbus.Signal{Name: prepareForSleepSignal, Body: []any{true}})
	fc.send(&dbus.Signal{Name: prepareForSleepSignal, Body: []any{false}})

	require.Eventually(t, func() bool { return calls.Load() == 2 }, time.Second, time.Millisecond,
		"each sleep/resume pair must fire onResume exactly once, on the resume half")
}

func TestWatchLoopIgnoresUnrelatedOrMalformedSignals(t *testing.T) {
	fc := &fakeConn{}
	var calls atomic.Int32
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	go func() { _ = watchLoop(ctx, fc, func() { calls.Add(1) }) }()
	require.Eventually(t, fc.hasSigCh, time.Second, time.Millisecond)

	fc.send(&dbus.Signal{Name: "org.freedesktop.DBus.NameOwnerChanged", Body: []any{"x"}})
	fc.send(&dbus.Signal{Name: prepareForSleepSignal, Body: []any{}})
	fc.send(&dbus.Signal{Name: prepareForSleepSignal, Body: []any{"not-a-bool"}})

	time.Sleep(50 * time.Millisecond)
	assert.Equal(t, int32(0), calls.Load(), "unrelated or malformed signals must never fire onResume")
}

func TestWatchLoopReturnsAddMatchSignalError(t *testing.T) {
	fc := &fakeConn{matchErr: errors.New("bus refused match rule")}

	err := watchLoop(context.Background(), fc, func() {})

	require.Error(t, err)
	assert.False(t, fc.closed.Load(), "watchLoop does not own closing the connection")
}

func TestWatchLoopStopsOnContextCancel(t *testing.T) {
	fc := &fakeConn{}
	ctx, cancel := context.WithCancel(context.Background())

	done := make(chan error, 1)
	go func() { done <- watchLoop(ctx, fc, func() {}) }()
	require.Eventually(t, fc.hasSigCh, time.Second, time.Millisecond)

	cancel()
	select {
	case err := <-done:
		assert.ErrorIs(t, err, context.Canceled)
	case <-time.After(time.Second):
		t.Fatal("watchLoop did not stop after context cancellation")
	}
}
