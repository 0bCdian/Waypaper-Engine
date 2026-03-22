package waylandutauri

import (
	"errors"
	"fmt"
	"net"
	"syscall"
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestClassifyHTTPError_Mapping(t *testing.T) {
	assert.ErrorIs(t, classifyHTTPError(400, "bad"), errBadRequest)
	assert.ErrorIs(t, classifyHTTPError(404, "missing"), errContract)
	assert.ErrorIs(t, classifyHTTPError(409, "conflict"), errConflict)
	assert.ErrorIs(t, classifyHTTPError(504, "timeout"), errTimeout)
	assert.ErrorIs(t, classifyHTTPError(500, "boom"), errInternal)
}

func TestIsTransientHTTPStatus(t *testing.T) {
	assert.True(t, isTransientHTTPStatus(409))
	assert.True(t, isTransientHTTPStatus(500))
	assert.True(t, isTransientHTTPStatus(503))
	assert.False(t, isTransientHTTPStatus(400))
	assert.False(t, isTransientHTTPStatus(404))
	assert.False(t, isTransientHTTPStatus(504))
}

func TestIsRetryableError(t *testing.T) {
	assert.True(t, isRetryableError(errInternal))
	assert.True(t, isRetryableError(errConflict))
	assert.False(t, isRetryableError(errBadRequest))

	netErr := &net.DNSError{IsTimeout: true}
	assert.True(t, isRetryableError(netErr))

	assert.False(t, isRetryableError(errors.New("plain error")))
}

func TestIsRetryableUnixSocketDial(t *testing.T) {
	refused := &net.OpError{Op: "dial", Net: "unix", Err: syscall.ECONNREFUSED}
	assert.True(t, isRetryableUnixSocketDial(refused))

	wrappedUnavailable := fmt.Errorf("%w: %v", errUnavailable, refused)
	assert.True(t, isRetryableUnixSocketDial(wrappedUnavailable))

	assert.True(t, isRetryableUnixSocketDial(errors.New("dial unix /tmp/x.sock: connect: connection refused")))

	assert.False(t, isRetryableUnixSocketDial(errors.New("bad request")))
	assert.False(t, isRetryableUnixSocketDial(nil))
}

func TestIsRetryableControlStatusErr(t *testing.T) {
	timeoutAwait := errors.New(`Get "http://wayland-utauri.local/wallpaper/status": context deadline exceeded (Client.Timeout exceeded while awaiting headers)`)
	assert.True(t, isRetryableControlStatusErr(timeoutAwait))

	refused := &net.OpError{Op: "dial", Net: "unix", Err: syscall.ECONNREFUSED}
	assert.True(t, isRetryableControlStatusErr(refused))

	assert.False(t, isRetryableControlStatusErr(errors.New("bad request")))
	assert.False(t, isRetryableControlStatusErr(nil))
}
