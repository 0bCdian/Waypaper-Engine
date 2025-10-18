package errors

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestErrorType(t *testing.T) {
	tests := []struct {
		name      string
		errorType ErrorType
		expected  string
	}{
		{
			name:      "SystemError",
			errorType: SystemError,
			expected:  "system",
		},
		{
			name:      "DatabaseError",
			errorType: DatabaseError,
			expected:  "database",
		},
		{
			name:      "ImageError",
			errorType: ImageError,
			expected:  "image",
		},
		{
			name:      "IPCError",
			errorType: IPCError,
			expected:  "ipc",
		},
		{
			name:      "ConfigError",
			errorType: ConfigError,
			expected:  "config",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			assert.Equal(t, tt.expected, string(tt.errorType))
		})
	}
}

func TestNew(t *testing.T) {
	tests := []struct {
		name        string
		errorType   ErrorType
		message     string
		expectedErr string
	}{
		{
			name:        "SystemError",
			errorType:   SystemError,
			message:     "System failure",
			expectedErr: "[system] System failure",
		},
		{
			name:        "DatabaseError",
			errorType:   DatabaseError,
			message:     "Connection failed",
			expectedErr: "[database] Connection failed",
		},
		{
			name:        "ImageError",
			errorType:   ImageError,
			message:     "Invalid format",
			expectedErr: "[image] Invalid format",
		},
		{
			name:        "IPCError",
			errorType:   IPCError,
			message:     "Invalid message",
			expectedErr: "[ipc] Invalid message",
		},
		{
			name:        "ConfigError",
			errorType:   ConfigError,
			message:     "Missing setting",
			expectedErr: "[config] Missing setting",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := New(tt.errorType, tt.message)

			require.NotNil(t, err)
			assert.Equal(t, tt.errorType, err.Type)
			assert.Equal(t, tt.message, err.Message)
			assert.Equal(t, tt.expectedErr, err.Error())
			assert.Equal(t, 0, err.Code)
			assert.Nil(t, err.Details)
		})
	}
}

func TestError_Error(t *testing.T) {
	err := New(SystemError, "Test error message")
	expected := "[system] Test error message"

	assert.Equal(t, expected, err.Error())
}

func TestError_WithCode(t *testing.T) {
	err := New(SystemError, "Test error")
	err = err.WithCode(404)

	assert.Equal(t, 404, err.Code)
	assert.Equal(t, err, err.WithCode(404)) // Should return self for chaining
}

func TestError_WithDetails(t *testing.T) {
	err := New(SystemError, "Test error")
	details := map[string]any{
		"file":   "test.go",
		"line":   42,
		"action": "read",
	}

	err = err.WithDetails(details)

	assert.Equal(t, details, err.Details)
	assert.Equal(t, err, err.WithDetails(details)) // Should return self for chaining
}

func TestError_Chaining(t *testing.T) {
	err := New(SystemError, "Test error").
		WithCode(500).
		WithDetails(map[string]any{
			"component": "database",
			"operation": "connect",
		})

	assert.Equal(t, SystemError, err.Type)
	assert.Equal(t, "Test error", err.Message)
	assert.Equal(t, 500, err.Code)
	assert.Equal(t, "database", err.Details["component"])
	assert.Equal(t, "connect", err.Details["operation"])
	assert.Equal(t, "[system] Test error", err.Error())
}

func TestError_EmptyMessage(t *testing.T) {
	err := New(SystemError, "")

	assert.Equal(t, SystemError, err.Type)
	assert.Equal(t, "", err.Message)
	assert.Equal(t, "[system] ", err.Error())
}

func TestError_NilDetails(t *testing.T) {
	err := New(SystemError, "Test error")
	err = err.WithDetails(nil)

	assert.Nil(t, err.Details)
}

func TestError_EmptyDetails(t *testing.T) {
	err := New(SystemError, "Test error")
	err = err.WithDetails(map[string]any{})

	assert.NotNil(t, err.Details)
	assert.Empty(t, err.Details)
}

func TestError_ZeroCode(t *testing.T) {
	err := New(SystemError, "Test error")
	err = err.WithCode(0)

	assert.Equal(t, 0, err.Code)
}

func TestError_NegativeCode(t *testing.T) {
	err := New(SystemError, "Test error")
	err = err.WithCode(-1)

	assert.Equal(t, -1, err.Code)
}

func TestError_ComplexDetails(t *testing.T) {
	err := New(ImageError, "Processing failed")
	details := map[string]any{
		"image_path": "/path/to/image.jpg",
		"format":     "JPEG",
		"size":       int64(1024000),
		"dimensions": map[string]int{
			"width":  1920,
			"height": 1080,
		},
		"errors": []string{
			"Invalid header",
			"Corrupted data",
		},
	}

	err = err.WithDetails(details)

	assert.Equal(t, details, err.Details)
	assert.Equal(t, "/path/to/image.jpg", err.Details["image_path"])
	assert.Equal(t, "JPEG", err.Details["format"])
	assert.Equal(t, int64(1024000), err.Details["size"])

	dimensions := err.Details["dimensions"].(map[string]int)
	assert.Equal(t, 1920, dimensions["width"])
	assert.Equal(t, 1080, dimensions["height"])

	errors := err.Details["errors"].([]string)
	assert.Equal(t, 2, len(errors))
	assert.Equal(t, "Invalid header", errors[0])
	assert.Equal(t, "Corrupted data", errors[1])
}

func TestError_AllErrorTypes(t *testing.T) {
	errorTypes := []ErrorType{
		SystemError,
		DatabaseError,
		ImageError,
		IPCError,
		ConfigError,
	}

	for _, errorType := range errorTypes {
		t.Run(string(errorType), func(t *testing.T) {
			err := New(errorType, "Test message")
			assert.Equal(t, errorType, err.Type)
			assert.Equal(t, "Test message", err.Message)
			assert.Contains(t, err.Error(), string(errorType))
		})
	}
}

func TestError_ImplementsErrorInterface(t *testing.T) {
	err := New(SystemError, "Test error")

	// This test ensures that our Error type implements the error interface
	var _ error = err

	// Test that it can be used as an error
	assert.Error(t, err)
	assert.Equal(t, "[system] Test error", err.Error())
}

func TestError_StringRepresentation(t *testing.T) {
	err := New(ImageError, "Failed to process image").
		WithCode(422).
		WithDetails(map[string]any{
			"file": "test.jpg",
		})

	// Test string representation
	str := err.Error()
	assert.Equal(t, "[image] Failed to process image", str)

	// Test that details don't affect Error() method
	assert.NotContains(t, str, "file")
	assert.NotContains(t, str, "test.jpg")
	assert.NotContains(t, str, "422")
}
