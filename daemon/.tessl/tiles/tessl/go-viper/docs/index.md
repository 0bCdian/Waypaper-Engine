# Viper

Viper is a complete configuration solution for Go applications including 12-Factor apps. It handles all types of configuration needs and formats, providing a prioritized configuration registry that manages multiple configuration sources.

## Package Information

- **Package Name**: viper
- **Package Manager**: go
- **Language**: Go
- **Installation**: `go get github.com/spf13/viper`
- **Import Path**: `github.com/spf13/viper`

## Core Imports

```go { .api }
import "github.com/spf13/viper"
```

For remote configuration features:

```go { .api }
import _ "github.com/spf13/viper/remote"
```

## Basic Usage

```go
package main

import (
    "fmt"
    "github.com/spf13/viper"
)

func main() {
    // Set defaults
    viper.SetDefault("port", 8080)
    viper.SetDefault("host", "localhost")

    // Read from config file
    viper.SetConfigName("config")
    viper.SetConfigType("yaml")
    viper.AddConfigPath(".")

    if err := viper.ReadInConfig(); err != nil {
        if _, ok := err.(viper.ConfigFileNotFoundError); !ok {
            panic(err)
        }
    }

    // Read from environment
    viper.AutomaticEnv()

    // Get values
    port := viper.GetInt("port")
    host := viper.GetString("host")

    fmt.Printf("Server: %s:%d\n", host, port)
}
```

## Configuration Priority Order

Viper uses the following precedence order (highest to lowest priority):

1. Explicit calls to `Set()`
2. Command line flags (via BindPFlag)
3. Environment variables
4. Configuration files
5. Remote key/value stores
6. Default values (via SetDefault)

**Important**: Viper configuration keys are case-insensitive.

## Key Concepts

### Viper Instance

```go { .api }
type Viper struct {
    // Has unexported fields
}
```

The main configuration management type. Maintains a set of configuration sources and provides values according to priority order.

**Note**: Viper instances are NOT safe for concurrent Get() and Set() operations.

**Constructor Functions**:

```go { .api }
func New() *Viper
func NewWithOptions(opts ...Option) *Viper
func GetViper() *Viper
```

- `New()` - Creates a new independent Viper instance
- `NewWithOptions(opts)` - Creates a new Viper instance with configuration options
- `GetViper()` - Returns the global Viper instance

### Global vs Instance Methods

Viper provides both package-level functions (operating on a global instance) and methods on `*Viper` instances. For example:

```go
// Using global instance
viper.Set("key", "value")
value := viper.GetString("key")

// Using custom instance
v := viper.New()
v.Set("key", "value")
value := v.GetString("key")
```

### Supported Configuration Formats

```go { .api }
var SupportedExts = []string{
    "json", "toml", "yaml", "yml",
    "properties", "props", "prop",
    "hcl", "tfvars", "dotenv", "env", "ini"
}
```

Viper supports JSON, TOML, YAML, HCL, INI, dotenv, envfile, and Java properties files.

### Supported Remote Providers

```go { .api }
var SupportedRemoteProviders = []string{
    "etcd", "etcd3", "consul", "firestore", "nats"
}
```

## Capabilities

### Configuration File Management

Read, write, watch, and merge configuration files in multiple formats.

```go { .api }
func AddConfigPath(in string)
func SetConfigFile(in string)
func SetConfigName(in string)
func SetConfigType(in string)
func ReadInConfig() error
func WriteConfig() error
func SafeWriteConfig() error
```

**Key Functions**:
- `AddConfigPath` - Adds search paths for config files
- `SetConfigFile` - Sets explicit config file path
- `SetConfigName` - Sets config file name (without extension)
- `SetConfigType` - Sets config file type (json, yaml, etc.)
- `ReadInConfig` - Discovers and loads config file
- `WriteConfig` - Writes current config to file
- `SafeWriteConfig` - Writes only if file doesn't exist

[Configuration Management](./configuration-management.md)

### Value Management

Set defaults, override values, and retrieve configuration values with type-safe getters.

```go { .api }
func SetDefault(key string, value any)
func Set(key string, value any)
func Get(key string) any
func GetString(key string) string
func GetInt(key string) int
func GetBool(key string) bool
```

**Key Functions**:
- `SetDefault` - Sets default value for a key
- `Set` - Sets override value (highest priority)
- `Get` - Retrieves any value
- `GetString`, `GetInt`, `GetBool`, etc. - Type-safe getters
- `AllKeys` - Returns all keys
- `AllSettings` - Returns all settings as map

[Value Management](./value-management.md)

### Environment Variables and Flags

Bind environment variables and command-line flags to configuration keys.

```go { .api }
func AutomaticEnv()
func BindEnv(input ...string) error
func SetEnvPrefix(in string)
func BindPFlag(key string, flag *pflag.Flag) error
```

**Key Functions**:
- `AutomaticEnv` - Automatically check env vars for all keys
- `BindEnv` - Bind specific env var to key
- `SetEnvPrefix` - Set prefix for env var names
- `BindPFlag` - Bind pflag to key
- `BindPFlags` - Bind entire FlagSet

[Environment Variables and Flags](./environment-flags.md)

### Remote Configuration

Read configuration from remote key/value stores like etcd, Consul, Firestore, and NATS.

```go { .api }
func AddRemoteProvider(provider, endpoint, path string) error
func AddSecureRemoteProvider(provider, endpoint, path, secretkeyring string) error
func ReadRemoteConfig() error
func WatchRemoteConfig() error
```

**Note**: Requires importing the remote package: `import _ "github.com/spf13/viper/remote"`

[Remote Configuration](./remote-config.md)

### Advanced Features

Options for customization, codec registration, unmarshaling to structs, and more.

```go { .api }
type Option interface {
    // Has unexported methods
}

func KeyDelimiter(d string) Option
func WithLogger(l *slog.Logger) Option
func WithFinder(f Finder) Option
func WithEncoderRegistry(r EncoderRegistry) Option
func WithDecoderRegistry(r DecoderRegistry) Option
func Unmarshal(rawVal any, opts ...DecoderConfigOption) error
func UnmarshalKey(key string, rawVal any, opts ...DecoderConfigOption) error
```

**Key Features**:
- Configuration options (key delimiter, logger, codecs)
- Custom encoders/decoders for file formats
- Unmarshal configuration to Go structs
- Sub-trees (hierarchical configs)
- Finder interface for custom config discovery

[Advanced Features](./advanced-features.md)

### Error Types

```go { .api }
type ConfigFileNotFoundError struct {
    // Has unexported fields
}

type ConfigParseError struct {
    // Has unexported fields
}

type UnsupportedConfigError string
type RemoteConfigError string
```

[Error Types](./error-types.md)

## Common Patterns

### Reading Multiple Config Files

```go
viper.SetConfigName("config")
viper.SetConfigType("yaml")
viper.AddConfigPath("/etc/myapp/")
viper.AddConfigPath("$HOME/.myapp")
viper.AddConfigPath(".")

err := viper.ReadInConfig()
if err != nil {
    if _, ok := err.(viper.ConfigFileNotFoundError); ok {
        // Config file not found; use defaults
    } else {
        // Config file found but error occurred
        panic(err)
    }
}
```

### Combining Multiple Sources

```go
// 1. Set defaults
viper.SetDefault("port", 8080)
viper.SetDefault("log_level", "info")

// 2. Read config file
viper.SetConfigName("config")
viper.AddConfigPath(".")
viper.ReadInConfig()

// 3. Bind environment variables
viper.SetEnvPrefix("MYAPP")
viper.AutomaticEnv()

// 4. Bind flags
viper.BindPFlag("port", cmd.Flags().Lookup("port"))

// Values retrieved with precedence: flags > env > config > defaults
port := viper.GetInt("port")
```

### Watching for Config Changes

```go
viper.OnConfigChange(func(e fsnotify.Event) {
    fmt.Println("Config file changed:", e.Name)
})
viper.WatchConfig()
```

### Unmarshaling to Structs

```go
type Config struct {
    Port     int    `mapstructure:"port"`
    Host     string `mapstructure:"host"`
    LogLevel string `mapstructure:"log_level"`
}

var config Config
err := viper.Unmarshal(&config)
```

## Thread Safety

Viper instances are NOT safe for concurrent Get() and Set() operations. If you need concurrent access, use appropriate synchronization mechanisms or separate Viper instances per goroutine.
