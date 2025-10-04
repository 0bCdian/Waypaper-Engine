package backend

import "errors"

var (
	ErrBackendNotRegistered = errors.New("backend not registered")
	ErrNoActiveBackend      = errors.New("no active backend")
	ErrBackendNotAvailable  = errors.New("backend not available")
	ErrUnsupportedOperation = errors.New("unsupported operation")
	ErrInvalidConfig        = errors.New("invalid configuration")
)
