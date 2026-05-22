package walqt

import (
	"context"
	"errors"
	"fmt"
	"net"
	"net/http"
	"strings"
	"syscall"
)

var (
	errUnavailable = errors.New("wal-qt: backend unavailable")
	errBadRequest  = errors.New("wal-qt: bad request")
	errContract    = errors.New("wal-qt: contract mismatch")
	errTimeout     = errors.New("wal-qt: request timeout")
	errConflict    = errors.New("wal-qt: request conflict")
	errInternal    = errors.New("wal-qt: backend internal error")
)

func classifyHTTPError(status int, body string) error {
	switch {
	case status == http.StatusBadRequest:
		return fmt.Errorf("%w: %s", errBadRequest, body)
	case status == http.StatusNotFound:
		return fmt.Errorf("%w: %s", errContract, body)
	case status == http.StatusConflict:
		return fmt.Errorf("%w: %s", errConflict, body)
	case status == http.StatusGatewayTimeout:
		return fmt.Errorf("%w: %s", errTimeout, body)
	case status >= 500:
		return fmt.Errorf("%w: status %d: %s", errInternal, status, body)
	default:
		return fmt.Errorf("%w: status %d: %s", errInternal, status, body)
	}
}

func isTransientHTTPStatus(status int) bool {
	return status == http.StatusConflict || (status >= 500 && status != http.StatusGatewayTimeout)
}

func isRetryableError(err error) bool {
	if err == nil {
		return false
	}
	var netErr net.Error
	return errors.As(err, &netErr) || errors.Is(err, errInternal) || errors.Is(err, errConflict)
}

// isRetryableUnixSocketDial reports transient control-socket failures: child process
// not listening yet, or a short restart race. Used to backoff before wallpaper load/restore.
func isRetryableUnixSocketDial(err error) bool {
	if err == nil {
		return false
	}
	if errors.Is(err, errUnavailable) {
		return true
	}
	var opErr *net.OpError
	if errors.As(err, &opErr) && opErr.Err != nil {
		if errors.Is(opErr.Err, syscall.ECONNREFUSED) ||
			errors.Is(opErr.Err, syscall.ENOENT) ||
			errors.Is(opErr.Err, syscall.ECONNRESET) {
			return true
		}
	}
	// http.Client sometimes wraps differently across platforms
	msg := strings.ToLower(err.Error())
	return strings.Contains(msg, "connection refused") || strings.Contains(msg, "no such file or directory")
}

// isRetryableControlStatusErr is true for dial races and for hung/slow control
// HTTP (e.g. http.Client Timeout while awaiting headers) so getStatus can backoff
// or SetWallpaper can re-Initialize.
func isRetryableControlStatusErr(err error) bool {
	if err == nil {
		return false
	}
	if isRetryableUnixSocketDial(err) {
		return true
	}
	if errors.Is(err, context.DeadlineExceeded) {
		return true
	}
	var netErr net.Error
	if errors.As(err, &netErr) && netErr.Timeout() {
		return true
	}
	msg := strings.ToLower(err.Error())
	return strings.Contains(msg, "deadline exceeded") ||
		strings.Contains(msg, "awaiting headers") ||
		strings.Contains(msg, "i/o timeout") ||
		strings.Contains(msg, "client.timeout")
}
