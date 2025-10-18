package ipc

import (
	"fmt"
	"reflect"
	"strings"
)

// TypeValidator provides runtime type validation for IPC messages
type TypeValidator struct {
	validators map[string]func(any) error
}

// NewTypeValidator creates a new type validator with predefined validators
func NewTypeValidator() *TypeValidator {
	return &TypeValidator{
		validators: make(map[string]func(any) error),
	}
}

// RegisterValidator registers a type validator for a specific path
func (tv *TypeValidator) RegisterValidator(path string, validator func(any) error) {
	tv.validators[path] = validator
}

// ValidateConfig validates a configuration object using reflection
func (tv *TypeValidator) ValidateConfig(config map[string]any) error {
	for sectionName, sectionData := range config {
		sectionMap, ok := sectionData.(map[string]any)
		if !ok {
			return fmt.Errorf("section %s must be a map", sectionName)
		}

		if err := tv.validateMap(sectionMap, sectionName); err != nil {
			return err
		}
	}
	return nil
}

// validateMap recursively validates a map structure
func (tv *TypeValidator) validateMap(m map[string]any, path string) error {
	for key, value := range m {
		currentPath := key
		if path != "" {
			currentPath = path + "." + key
		}

		// Check if we have a specific validator for this path
		if validator, exists := tv.validators[currentPath]; exists {
			if err := validator(value); err != nil {
				return fmt.Errorf("validation failed for %s: %w", currentPath, err)
			}
			continue
		}

		// Recursively validate nested maps
		if nestedMap, ok := value.(map[string]any); ok {
			if err := tv.validateMap(nestedMap, currentPath); err != nil {
				return err
			}
			continue
		}

		// Validate based on path patterns
		if err := tv.validateByPath(currentPath, value); err != nil {
			return fmt.Errorf("validation failed for %s: %w", currentPath, err)
		}
	}

	return nil
}

// validateByPath validates values based on their path patterns
func (tv *TypeValidator) validateByPath(path string, value any) error {
	// Monitor-related validations
	if strings.HasSuffix(path, "selected_monitors") {
		return tv.validateStringArray(value, "selected_monitors")
	}
	if strings.HasSuffix(path, "image_set_type") {
		return tv.validateStringEnum(value, []string{"individual", "extend", "clone"}, "image_set_type")
	}

	// App config validations
	if strings.HasSuffix(path, "theme") {
		return tv.validateStringEnum(value, []string{"light", "dark", "auto"}, "theme")
	}
	if strings.HasSuffix(path, "notifications") {
		return tv.validateBool(value, "notifications")
	}
	if strings.HasSuffix(path, "images_per_page") {
		return tv.validatePositiveInt(value, "images_per_page")
	}

	// Backend config validations
	if strings.HasSuffix(path, "transition_duration") {
		return tv.validatePositiveInt(value, "transition_duration")
	}
	if strings.HasSuffix(path, "transition_type") {
		return tv.validateStringEnum(value, []string{"simple", "fade", "wipe", "grow"}, "transition_type")
	}

	return nil
}

// validateStringArray validates that value is a string array
func (tv *TypeValidator) validateStringArray(value any, fieldName string) error {
	arr, ok := value.([]any)
	if !ok {
		return fmt.Errorf("%s must be an array", fieldName)
	}

	for i, item := range arr {
		if _, ok := item.(string); !ok {
			return fmt.Errorf("%s[%d] must be a string", fieldName, i)
		}
	}

	return nil
}

// validateStringEnum validates that value is a string from allowed values
func (tv *TypeValidator) validateStringEnum(value any, allowedValues []string, fieldName string) error {
	str, ok := value.(string)
	if !ok {
		return fmt.Errorf("%s must be a string", fieldName)
	}

	for _, allowed := range allowedValues {
		if str == allowed {
			return nil
		}
	}

	return fmt.Errorf("%s must be one of: %s", fieldName, strings.Join(allowedValues, ", "))
}

// validateBool validates that value is a boolean
func (tv *TypeValidator) validateBool(value any, fieldName string) error {
	if _, ok := value.(bool); !ok {
		return fmt.Errorf("%s must be a boolean", fieldName)
	}
	return nil
}

// validatePositiveInt validates that value is a positive integer
func (tv *TypeValidator) validatePositiveInt(value any, fieldName string) error {
	switch v := value.(type) {
	case int:
		if v <= 0 {
			return fmt.Errorf("%s must be a positive integer", fieldName)
		}
	case float64:
		if v != float64(int(v)) || v <= 0 {
			return fmt.Errorf("%s must be a positive integer", fieldName)
		}
	default:
		return fmt.Errorf("%s must be a positive integer", fieldName)
	}
	return nil
}

// ConfigTypeRegistry provides type-safe configuration handling
type ConfigTypeRegistry struct {
	validators map[string]*TypeValidator
}

// NewConfigTypeRegistry creates a new configuration type registry
func NewConfigTypeRegistry() *ConfigTypeRegistry {
	registry := &ConfigTypeRegistry{
		validators: make(map[string]*TypeValidator),
	}

	// Register validators for different config sections
	registry.registerAppValidator()
	registry.registerMonitorsValidator()
	registry.registerBackendValidator()

	return registry
}

// registerAppValidator registers validators for app configuration
func (ctr *ConfigTypeRegistry) registerAppValidator() {
	validator := NewTypeValidator()

	// Register specific validators
	validator.RegisterValidator("app.theme", func(value any) error {
		return validator.validateStringEnum(value, []string{"light", "dark", "auto"}, "theme")
	})

	validator.RegisterValidator("app.notifications", func(value any) error {
		return validator.validateBool(value, "notifications")
	})

	validator.RegisterValidator("app.images_per_page", func(value any) error {
		return validator.validatePositiveInt(value, "images_per_page")
	})

	ctr.validators["app"] = validator
}

// registerMonitorsValidator registers validators for monitor configuration
func (ctr *ConfigTypeRegistry) registerMonitorsValidator() {
	validator := NewTypeValidator()

	validator.RegisterValidator("monitors.selected_monitors", func(value any) error {
		return validator.validateStringArray(value, "selected_monitors")
	})

	validator.RegisterValidator("monitors.image_set_type", func(value any) error {
		return validator.validateStringEnum(value, []string{"individual", "extend", "clone"}, "image_set_type")
	})

	ctr.validators["monitors"] = validator
}

// registerBackendValidator registers validators for backend configuration
func (ctr *ConfigTypeRegistry) registerBackendValidator() {
	validator := NewTypeValidator()

	validator.RegisterValidator("backend.swww.transition_duration", func(value any) error {
		return validator.validatePositiveInt(value, "transition_duration")
	})

	validator.RegisterValidator("backend.swww.transition_type", func(value any) error {
		return validator.validateStringEnum(value, []string{"simple", "fade", "wipe", "grow"}, "transition_type")
	})

	ctr.validators["backend"] = validator
}

// ValidateSection validates a specific configuration section
func (ctr *ConfigTypeRegistry) ValidateSection(section string, config map[string]any) error {
	validator, exists := ctr.validators[section]
	if !exists {
		return fmt.Errorf("no validator registered for section: %s", section)
	}

	// Validate each field in the section, handling nested structures
	return validator.validateMap(config, section)
}

// GetExpectedType returns the expected Go type for a given path
func (ctr *ConfigTypeRegistry) GetExpectedType(path string) reflect.Type {
	// This could be expanded to return actual Go types
	// For now, we'll return basic types based on path patterns
	if strings.HasSuffix(path, "selected_monitors") {
		return reflect.TypeOf([]string{})
	}
	if strings.HasSuffix(path, "image_set_type") || strings.HasSuffix(path, "theme") {
		return reflect.TypeOf("")
	}
	if strings.HasSuffix(path, "notifications") {
		return reflect.TypeOf(true)
	}
	if strings.HasSuffix(path, "images_per_page") || strings.HasSuffix(path, "transition_duration") {
		return reflect.TypeOf(0)
	}

	// Return any type for unknown paths
	return reflect.TypeOf((*any)(nil)).Elem()
}
