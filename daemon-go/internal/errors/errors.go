
package errors

import "fmt"

// ErrorType is the type of an error.
type ErrorType string

const (
	SystemError   ErrorType = "system"
	DatabaseError ErrorType = "database"
	ImageError    ErrorType = "image"
	IPCError      ErrorType = "ipc"
	ConfigError   ErrorType = "config"
)

// Error is a custom error type.
type Error struct {
	Type    ErrorType
	Message string
	Code    int
	Details map[string]interface{}
}

// New creates a new custom error.
func New(t ErrorType, msg string) *Error {
	return &Error{
		Type:    t,
		Message: msg,
	}
}

// Error returns the error message.
func (e *Error) Error() string {
	return fmt.Sprintf("[%s] %s", e.Type, e.Message)
}

// WithCode adds a code to the error.
func (e *Error) WithCode(code int) *Error {
	e.Code = code
	return e
}

// WithDetails adds details to the error.
func (e *Error) WithDetails(details map[string]interface{}) *Error {
	e.Details = details
	return e
}
