package walqt

import (
	"errors"
	"net"
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
