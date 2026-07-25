package config

import (
	"encoding/json"

	"github.com/spf13/viper"
)

type ConfigManager interface {
	GetConfig() (*Config, error)
	UpdateConfig(section string, values map[string]any) error
	GetSection(section string) (map[string]any, error)
	GetBackendConfig(backendName string) (json.RawMessage, error)
	SetBackendConfig(backendName string, raw json.RawMessage) error
	GetActiveBackendType() string
	SetActiveBackendType(name string) error
	GetSelectionMode() string
	GetAutoPriorities() AutoPriorities
	OnConfigChange(callback func(section string))
	GetSocketPath() string
	GetImagesDir() string
	GetThumbnailsDir() string
	GetDatabaseDir() string
	GetLogFile() string
	ResetToFactoryDefaults(registerBackendDefaults func(*viper.Viper)) error
	ReplaceBackendNamedConfig(backendName string, values map[string]any) error
}
