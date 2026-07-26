package walqt

import (
	"errors"
	"fmt"
	"net"
	"net/http"
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
