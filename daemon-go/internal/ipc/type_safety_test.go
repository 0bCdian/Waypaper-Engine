package ipc

import (
	"testing"
)

func TestTypeValidator_ValidateStringArray(t *testing.T) {
	tests := []struct {
		name    string
		value   any
		wantErr bool
	}{
		{
			name:    "valid string array",
			value:   []any{"DP-1", "HDMI-1", "eDP-1"},
			wantErr: false,
		},
		{
			name:    "empty string array",
			value:   []any{},
			wantErr: false,
		},
		{
			name:    "not an array",
			value:   "not an array",
			wantErr: true,
		},
		{
			name:    "array with non-string elements",
			value:   []any{"DP-1", 123, "HDMI-1"},
			wantErr: true,
		},
		{
			name:    "array with nil elements",
			value:   []any{"DP-1", nil, "HDMI-1"},
			wantErr: true,
		},
		{
			name:    "nil value",
			value:   nil,
			wantErr: true,
		},
	}

	tv := NewTypeValidator()
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := tv.validateStringArray(tt.value, "test_field")
			if (err != nil) != tt.wantErr {
				t.Errorf("validateStringArray() error = %v, wantErr %v", err, tt.wantErr)
			}
		})
	}
}

func TestTypeValidator_ValidateStringEnum(t *testing.T) {
	allowedValues := []string{"individual", "extend", "clone"}

	tests := []struct {
		name    string
		value   any
		wantErr bool
	}{
		{
			name:    "valid enum value - individual",
			value:   "individual",
			wantErr: false,
		},
		{
			name:    "valid enum value - extend",
			value:   "extend",
			wantErr: false,
		},
		{
			name:    "valid enum value - clone",
			value:   "clone",
			wantErr: false,
		},
		{
			name:    "invalid enum value",
			value:   "invalid_mode",
			wantErr: true,
		},
		{
			name:    "not a string",
			value:   123,
			wantErr: true,
		},
		{
			name:    "nil value",
			value:   nil,
			wantErr: true,
		},
		{
			name:    "empty string",
			value:   "",
			wantErr: true,
		},
	}

	tv := NewTypeValidator()
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := tv.validateStringEnum(tt.value, allowedValues, "test_field")
			if (err != nil) != tt.wantErr {
				t.Errorf("validateStringEnum() error = %v, wantErr %v", err, tt.wantErr)
			}
		})
	}
}

func TestTypeValidator_ValidateBool(t *testing.T) {
	tests := []struct {
		name    string
		value   any
		wantErr bool
	}{
		{
			name:    "valid boolean - true",
			value:   true,
			wantErr: false,
		},
		{
			name:    "valid boolean - false",
			value:   false,
			wantErr: false,
		},
		{
			name:    "not a boolean",
			value:   "true",
			wantErr: true,
		},
		{
			name:    "not a boolean - number",
			value:   1,
			wantErr: true,
		},
		{
			name:    "nil value",
			value:   nil,
			wantErr: true,
		},
	}

	tv := NewTypeValidator()
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := tv.validateBool(tt.value, "test_field")
			if (err != nil) != tt.wantErr {
				t.Errorf("validateBool() error = %v, wantErr %v", err, tt.wantErr)
			}
		})
	}
}

func TestTypeValidator_ValidatePositiveInt(t *testing.T) {
	tests := []struct {
		name    string
		value   any
		wantErr bool
	}{
		{
			name:    "valid positive int",
			value:   25,
			wantErr: false,
		},
		{
			name:    "valid positive float64",
			value:   25.0,
			wantErr: false,
		},
		{
			name:    "zero value",
			value:   0,
			wantErr: true,
		},
		{
			name:    "negative int",
			value:   -5,
			wantErr: true,
		},
		{
			name:    "negative float64",
			value:   -5.0,
			wantErr: true,
		},
		{
			name:    "not a number",
			value:   "25",
			wantErr: true,
		},
		{
			name:    "nil value",
			value:   nil,
			wantErr: true,
		},
		{
			name:    "float with decimal",
			value:   25.5,
			wantErr: true,
		},
	}

	tv := NewTypeValidator()
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := tv.validatePositiveInt(tt.value, "test_field")
			if (err != nil) != tt.wantErr {
				t.Errorf("validatePositiveInt() error = %v, wantErr %v", err, tt.wantErr)
			}
		})
	}
}

func TestTypeValidator_ValidateByPath(t *testing.T) {
	tests := []struct {
		name    string
		path    string
		value   any
		wantErr bool
	}{
		// Monitor validations
		{
			name:    "valid selected_monitors",
			path:    "monitors.selected_monitors",
			value:   []any{"DP-1", "HDMI-1"},
			wantErr: false,
		},
		{
			name:    "invalid selected_monitors - not array",
			path:    "monitors.selected_monitors",
			value:   "not an array",
			wantErr: true,
		},
		{
			name:    "valid image_set_type",
			path:    "monitors.image_set_type",
			value:   "extend",
			wantErr: false,
		},
		{
			name:    "invalid image_set_type",
			path:    "monitors.image_set_type",
			value:   "invalid_mode",
			wantErr: true,
		},

		// App config validations
		{
			name:    "valid theme",
			path:    "app.theme",
			value:   "dark",
			wantErr: false,
		},
		{
			name:    "invalid theme",
			path:    "app.theme",
			value:   "purple",
			wantErr: true,
		},
		{
			name:    "valid notifications",
			path:    "app.notifications",
			value:   true,
			wantErr: false,
		},
		{
			name:    "invalid notifications",
			path:    "app.notifications",
			value:   "true",
			wantErr: true,
		},
		{
			name:    "valid images_per_page",
			path:    "app.images_per_page",
			value:   25,
			wantErr: false,
		},
		{
			name:    "invalid images_per_page - negative",
			path:    "app.images_per_page",
			value:   -5,
			wantErr: true,
		},

		// Backend config validations
		{
			name:    "valid transition_duration",
			path:    "backend.swww.transition_duration",
			value:   300,
			wantErr: false,
		},
		{
			name:    "invalid transition_duration",
			path:    "backend.swww.transition_duration",
			value:   0,
			wantErr: true,
		},
		{
			name:    "valid transition_type",
			path:    "backend.swww.transition_type",
			value:   "fade",
			wantErr: false,
		},
		{
			name:    "invalid transition_type",
			path:    "backend.swww.transition_type",
			value:   "invalid_type",
			wantErr: true,
		},

		// Unknown path
		{
			name:    "unknown path",
			path:    "unknown.section.field",
			value:   "anything",
			wantErr: false, // Unknown paths should not error
		},
	}

	tv := NewTypeValidator()
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := tv.validateByPath(tt.path, tt.value)
			if (err != nil) != tt.wantErr {
				t.Errorf("validateByPath() error = %v, wantErr %v", err, tt.wantErr)
			}
		})
	}
}

func TestConfigTypeRegistry_ValidateSection(t *testing.T) {
	registry := NewConfigTypeRegistry()

	tests := []struct {
		name     string
		section  string
		config   map[string]any
		wantErr  bool
		errorMsg string
	}{
		{
			name:    "valid app config",
			section: "app",
			config: map[string]any{
				"theme":           "dark",
				"notifications":   true,
				"images_per_page": 25,
			},
			wantErr: false,
		},
		{
			name:    "invalid app config - bad theme",
			section: "app",
			config: map[string]any{
				"theme": "purple",
			},
			wantErr:  true,
			errorMsg: "validation failed for app.theme: theme must be one of: light, dark, auto",
		},
		{
			name:    "invalid app config - bad images_per_page",
			section: "app",
			config: map[string]any{
				"images_per_page": -5,
			},
			wantErr:  true,
			errorMsg: "validation failed for app.images_per_page: images_per_page must be a positive integer",
		},
		{
			name:    "valid monitors config",
			section: "monitors",
			config: map[string]any{
				"selected_monitors": []any{"DP-1", "HDMI-1"},
				"image_set_type":    "extend",
			},
			wantErr: false,
		},
		{
			name:    "invalid monitors config - bad image_set_type",
			section: "monitors",
			config: map[string]any{
				"image_set_type": "invalid_mode",
			},
			wantErr:  true,
			errorMsg: "validation failed for monitors.image_set_type: image_set_type must be one of: individual, extend, clone",
		},
		{
			name:    "invalid monitors config - bad selected_monitors",
			section: "monitors",
			config: map[string]any{
				"selected_monitors": "not an array",
			},
			wantErr:  true,
			errorMsg: "validation failed for monitors.selected_monitors: selected_monitors must be an array",
		},
		{
			name:    "valid backend config",
			section: "backend",
			config: map[string]any{
				"swww": map[string]any{
					"transition_duration": 300,
					"transition_type":     "fade",
				},
			},
			wantErr: false,
		},
		{
			name:    "invalid backend config - bad transition_duration",
			section: "backend",
			config: map[string]any{
				"swww": map[string]any{
					"transition_duration": 0,
				},
			},
			wantErr:  true,
			errorMsg: "validation failed for backend.swww.transition_duration: transition_duration must be a positive integer",
		},
		{
			name:    "unknown section",
			section: "unknown",
			config: map[string]any{
				"any_field": "any_value",
			},
			wantErr:  true,
			errorMsg: "no validator registered for section: unknown",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := registry.ValidateSection(tt.section, tt.config)
			if (err != nil) != tt.wantErr {
				t.Errorf("ValidateSection() error = %v, wantErr %v", err, tt.wantErr)
				return
			}

			if tt.wantErr && tt.errorMsg != "" {
				if err == nil || err.Error() != tt.errorMsg {
					t.Errorf("ValidateSection() error = %v, want error message %v", err, tt.errorMsg)
				}
			}
		})
	}
}

func TestTypeValidator_ValidateConfig(t *testing.T) {
	tests := []struct {
		name    string
		config  map[string]any
		wantErr bool
	}{
		{
			name: "valid complete config",
			config: map[string]any{
				"app": map[string]any{
					"theme":           "dark",
					"notifications":   true,
					"images_per_page": 25,
				},
				"monitors": map[string]any{
					"selected_monitors": []any{"DP-1", "HDMI-1"},
					"image_set_type":    "extend",
				},
				"backend": map[string]any{
					"swww": map[string]any{
						"transition_duration": 300,
						"transition_type":     "fade",
					},
				},
			},
			wantErr: false,
		},
		{
			name: "invalid config - bad theme",
			config: map[string]any{
				"app": map[string]any{
					"theme": "purple",
				},
			},
			wantErr: true,
		},
		{
			name: "invalid config - bad selected_monitors",
			config: map[string]any{
				"monitors": map[string]any{
					"selected_monitors": "not an array",
				},
			},
			wantErr: true,
		},
		{
			name: "invalid config - section not a map",
			config: map[string]any{
				"app": "not a map",
			},
			wantErr: true,
		},
		{
			name:    "empty config",
			config:  map[string]any{},
			wantErr: false,
		},
	}

	tv := NewTypeValidator()
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := tv.ValidateConfig(tt.config)
			if (err != nil) != tt.wantErr {
				t.Errorf("ValidateConfig() error = %v, wantErr %v", err, tt.wantErr)
			}
		})
	}
}

func TestConfigTypeRegistry_GetExpectedType(t *testing.T) {
	registry := NewConfigTypeRegistry()

	tests := []struct {
		name     string
		path     string
		expected string
	}{
		{
			name:     "selected_monitors path",
			path:     "monitors.selected_monitors",
			expected: "[]string",
		},
		{
			name:     "image_set_type path",
			path:     "monitors.image_set_type",
			expected: "string",
		},
		{
			name:     "theme path",
			path:     "app.theme",
			expected: "string",
		},
		{
			name:     "notifications path",
			path:     "app.notifications",
			expected: "bool",
		},
		{
			name:     "images_per_page path",
			path:     "app.images_per_page",
			expected: "int",
		},
		{
			name:     "unknown path",
			path:     "unknown.field",
			expected: "interface {}",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := registry.GetExpectedType(tt.path)
			if got.String() != tt.expected {
				t.Errorf("GetExpectedType() = %v, want %v", got.String(), tt.expected)
			}
		})
	}
}

// Benchmark tests
func BenchmarkTypeValidator_ValidateStringArray(b *testing.B) {
	tv := NewTypeValidator()
	validArray := []any{"DP-1", "HDMI-1", "eDP-1"}

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		tv.validateStringArray(validArray, "test_field")
	}
}

func BenchmarkConfigTypeRegistry_ValidateSection(b *testing.B) {
	registry := NewConfigTypeRegistry()
	validConfig := map[string]any{
		"theme":           "dark",
		"notifications":   true,
		"images_per_page": 25,
	}

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		registry.ValidateSection("app", validConfig)
	}
}

// Test edge cases and error messages
func TestTypeValidator_ErrorMessages(t *testing.T) {
	tv := NewTypeValidator()

	tests := []struct {
		name        string
		validator   func(any) error
		value       any
		expectedMsg string
	}{
		{
			name:        "string array with non-string element",
			validator:   func(v any) error { return tv.validateStringArray(v, "test") },
			value:       []any{"valid", 123},
			expectedMsg: "test[1] must be a string",
		},
		{
			name:        "string enum with invalid value",
			validator:   func(v any) error { return tv.validateStringEnum(v, []string{"a", "b"}, "test") },
			value:       "c",
			expectedMsg: "test must be one of: a, b",
		},
		{
			name:        "positive int with negative value",
			validator:   func(v any) error { return tv.validatePositiveInt(v, "test") },
			value:       -5,
			expectedMsg: "test must be a positive integer",
		},
		{
			name:        "bool with string value",
			validator:   func(v any) error { return tv.validateBool(v, "test") },
			value:       "true",
			expectedMsg: "test must be a boolean",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := tt.validator(tt.value)
			if err == nil {
				t.Errorf("Expected error but got none")
				return
			}
			if err.Error() != tt.expectedMsg {
				t.Errorf("Error message = %v, want %v", err.Error(), tt.expectedMsg)
			}
		})
	}
}
