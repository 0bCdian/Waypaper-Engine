# Configuration File Management

This document covers all operations related to configuration files: reading, writing, merging, watching, and path management.

## Configuration File Setup

### Setting Config File Location

```go { .api }
func AddConfigPath(in string)
func (*Viper) AddConfigPath(in string)
```

Adds a path for Viper to search for the config file. Can be called multiple times to define multiple search paths.

```go { .api }
func SetConfigFile(in string)
func (*Viper) SetConfigFile(in string)
```

Explicitly defines the path, name and extension of the config file. Viper will use this and not check any of the config paths.

```go { .api }
func SetConfigName(in string)
func (*Viper) SetConfigName(in string)
```

Sets name for the config file. Does not include extension.

```go { .api }
func SetConfigType(in string)
func (*Viper) SetConfigType(in string)
```

Sets the type of the configuration returned by the remote source, e.g. "json", "yaml", "toml".

```go { .api }
func SetConfigPermissions(perm os.FileMode)
func (*Viper) SetConfigPermissions(perm os.FileMode)
```

Sets the permissions for the config file.

### Getting Config File Info

```go { .api }
func ConfigFileUsed() string
func (*Viper) ConfigFileUsed() string
```

Returns the file used to populate the config registry.

## Reading Configuration Files

### Reading from Disk

```go { .api }
func ReadInConfig() error
func (*Viper) ReadInConfig() error
```

Discovers and loads the configuration file from disk, searching in the defined paths.

**Returns**:
- `ConfigFileNotFoundError` if config file not found in any search path
- `ConfigParseError` if config file found but cannot be parsed
- `UnsupportedConfigError` if config format is unsupported

**Example**:
```go
viper.SetConfigName("config")
viper.SetConfigType("yaml")
viper.AddConfigPath("/etc/myapp/")
viper.AddConfigPath("$HOME/.myapp")
viper.AddConfigPath(".")

err := viper.ReadInConfig()
if err != nil {
    if _, ok := err.(viper.ConfigFileNotFoundError); ok {
        // Config file not found; ignore or use defaults
    } else {
        // Config file was found but error occurred
        panic(fmt.Errorf("fatal error config file: %w", err))
    }
}
```

### Reading from io.Reader

```go { .api }
func ReadConfig(in io.Reader) error
func (*Viper) ReadConfig(in io.Reader) error
```

Reads a configuration file from an io.Reader, setting existing keys to nil if the key does not exist in the file.

**Example**:
```go
viper.SetConfigType("yaml")

yamlConfig := []byte(`
host: localhost
port: 8080
debug: true
`)

viper.ReadConfig(bytes.NewBuffer(yamlConfig))
```

## Merging Configuration Files

### Merging from Disk

```go { .api }
func MergeInConfig() error
func (*Viper) MergeInConfig() error
```

Merges a new configuration from disk with an existing config. Unlike ReadInConfig, this preserves existing keys.

### Merging from io.Reader

```go { .api }
func MergeConfig(in io.Reader) error
func (*Viper) MergeConfig(in io.Reader) error
```

Merges a new configuration from an io.Reader with an existing config.

### Merging from Map

```go { .api }
func MergeConfigMap(cfg map[string]any) error
func (*Viper) MergeConfigMap(cfg map[string]any) error
```

Merges the configuration from a map with an existing config. Note that the map given may be modified.

**Example**:
```go
// Read base config
viper.SetConfigName("config")
viper.ReadInConfig()

// Merge with environment-specific config
viper.SetConfigName("config.production")
viper.MergeInConfig()

// Or merge from a map
overrides := map[string]any{
    "debug": false,
    "log_level": "error",
}
viper.MergeConfigMap(overrides)
```

## Writing Configuration Files

### Writing to Predefined Path

```go { .api }
func WriteConfig() error
func (*Viper) WriteConfig() error
```

Writes the current viper configuration to the predefined path (set by SetConfigFile or AddConfigPath + SetConfigName). Errors if no predefined path. Will overwrite the current config file if it exists.

```go { .api }
func SafeWriteConfig() error
func (*Viper) SafeWriteConfig() error
```

Writes the current viper configuration to the predefined path. Errors if no predefined path. Will NOT overwrite the current config file if it exists.

### Writing to Specific File

```go { .api }
func WriteConfigAs(filename string) error
func (*Viper) WriteConfigAs(filename string) error
```

Writes the current viper configuration to the given filepath. Will overwrite the given file if it exists.

```go { .api }
func SafeWriteConfigAs(filename string) error
func (*Viper) SafeWriteConfigAs(filename string) error
```

Writes the current viper configuration to the given filepath. Will NOT overwrite the given file if it exists.

### Writing to io.Writer

```go { .api }
func WriteConfigTo(w io.Writer) error
func (*Viper) WriteConfigTo(w io.Writer) error
```

Writes the current configuration to an io.Writer.

**Example**:
```go
// Set some config values
viper.Set("app_name", "myapp")
viper.Set("version", "1.0.0")

// Write to predefined path
viper.WriteConfig()

// Write to specific file
viper.WriteConfigAs("/path/to/config.yaml")

// Safe write (won't overwrite)
err := viper.SafeWriteConfigAs("/path/to/config.yaml")
if err != nil {
    if _, ok := err.(viper.ConfigFileAlreadyExistsError); ok {
        // File already exists
    }
}

// Write to stdout
viper.WriteConfigTo(os.Stdout)
```

## Watching Configuration Files

### Watching for Changes

```go { .api }
func WatchConfig()
func (*Viper) WatchConfig()
```

Starts watching a config file for changes. The config will be automatically reloaded when the file changes.

**Important**: Add all configPaths before calling WatchConfig.

```go { .api }
func OnConfigChange(run func(in fsnotify.Event))
func (*Viper) OnConfigChange(run func(in fsnotify.Event))
```

Sets the event handler that is called when a config file changes.

**Example**:
```go
viper.SetConfigName("config")
viper.AddConfigPath(".")
viper.ReadInConfig()

// Set up change handler
viper.OnConfigChange(func(e fsnotify.Event) {
    fmt.Println("Config file changed:", e.Name)
    // Reload application config here
})

// Start watching
viper.WatchConfig()
```

## Filesystem Abstraction

```go { .api }
func SetFs(fs afero.Fs)
func (*Viper) SetFs(fs afero.Fs)
```

Sets the filesystem to use to read configuration. Uses the afero filesystem abstraction for testing and custom filesystem implementations.

**Example**:
```go
import "github.com/spf13/afero"

// Use in-memory filesystem for testing
memFs := afero.NewMemMapFs()
viper.SetFs(memFs)

// Write config to memory
afero.WriteFile(memFs, "config.yaml", []byte("port: 8080"), 0644)

// Read it with viper
viper.SetConfigName("config")
viper.SetConfigType("yaml")
viper.AddConfigPath("/")
viper.ReadInConfig()
```

## Supported File Formats

Viper supports the following configuration file formats:

```go { .api }
var SupportedExts = []string{
    "json",       // JSON
    "toml",       // TOML
    "yaml",       // YAML
    "yml",        // YAML
    "properties", // Java properties
    "props",      // Java properties
    "prop",       // Java properties
    "hcl",        // HashiCorp Configuration Language
    "tfvars",     // Terraform variables
    "dotenv",     // Dotenv
    "env",        // Environment file
    "ini",        // INI
}
```

## Error Handling

Configuration file operations can return several error types.

For comprehensive error handling patterns and examples, see [Error Types](./error-types.md).

### ConfigFileNotFoundError

```go { .api }
type ConfigFileNotFoundError struct {
    // Has unexported fields
}

func (ConfigFileNotFoundError) Error() string
```

Returned when the config file cannot be found in any of the search paths.

### ConfigParseError

```go { .api }
type ConfigParseError struct {
    // Has unexported fields
}

func (ConfigParseError) Error() string
func (ConfigParseError) Unwrap() error
```

Returned when the config file exists but cannot be parsed.

### UnsupportedConfigError

```go { .api }
type UnsupportedConfigError string

func (UnsupportedConfigError) Error() string
```

Returned when an unsupported configuration file type is encountered.

### ConfigMarshalError

```go { .api }
type ConfigMarshalError struct {
    // Has unexported fields
}

func (ConfigMarshalError) Error() string
```

Returned when failing to marshal the configuration (e.g., during Write operations).

### ConfigFileAlreadyExistsError

```go { .api }
type ConfigFileAlreadyExistsError string

func (ConfigFileAlreadyExistsError) Error() string
```

Returned by SafeWriteConfig operations when the target file already exists.
