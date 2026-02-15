# Advanced Features

This document covers advanced Viper features including configuration options, custom codecs, finders, unmarshaling, and experimental features.

## Configuration Options

### Option Type

```go { .api }
type Option interface {
    // Has unexported methods
}
```

Configures Viper using the functional options paradigm. Options are passed to `NewWithOptions()` to customize Viper instance behavior.

### Creating Viper with Options

```go { .api }
func NewWithOptions(opts ...Option) *Viper
```

Creates a new Viper instance with configuration options.

```go { .api }
func SetOptions(opts ...Option)
func (*Viper) SetOptions(opts ...Option)
```

Sets options on an existing Viper instance (or the global instance).

**Warning**: Subsequent calls may override previously set options. It's better to use a local Viper instance with NewWithOptions.

### Available Options

#### Key Delimiter

```go { .api }
func KeyDelimiter(d string) Option
```

Sets the delimiter used for determining key parts. By default the value is ".".

**Example**:
```go
v := viper.NewWithOptions(viper.KeyDelimiter("::"))
v.Set("database::host", "localhost")
host := v.GetString("database::host")
```

#### Environment Key Replacer

```go { .api }
func EnvKeyReplacer(r StringReplacer) Option
```

Sets a replacer used for mapping environment variables to internal keys.

```go { .api }
type StringReplacer interface {
    // Replace returns a copy of s with all replacements performed
    Replace(s string) string
}
```

**Example**:
```go
type customReplacer struct{}

func (c customReplacer) Replace(s string) string {
    return strings.ReplaceAll(s, "-", "_")
}

v := viper.NewWithOptions(viper.EnvKeyReplacer(customReplacer{}))
```

#### Custom Logger

```go { .api }
func WithLogger(l *slog.Logger) Option
```

Sets a custom logger for Viper to use.

**Example**:
```go
import "log/slog"

logger := slog.New(slog.NewJSONHandler(os.Stdout, nil))
v := viper.NewWithOptions(viper.WithLogger(logger))
```

#### Custom Finder

```go { .api }
func WithFinder(f Finder) Option
```

Sets a custom Finder for locating configuration files.

```go { .api }
type Finder interface {
    Find(fsys afero.Fs) ([]string, error)
}
```

```go { .api }
func Finders(finders ...Finder) Finder
```

Combines multiple finders into one.

#### Custom Codecs

```go { .api }
func WithCodecRegistry(r CodecRegistry) Option
```

Sets a custom EncoderRegistry and DecoderRegistry.

```go { .api }
func WithEncoderRegistry(r EncoderRegistry) Option
```

Sets a custom EncoderRegistry.

```go { .api }
func WithDecoderRegistry(r DecoderRegistry) Option
```

Sets a custom DecoderRegistry.

#### Decode Hook

```go { .api }
func WithDecodeHook(h mapstructure.DecodeHookFunc) Option
```

Sets a default decode hook for mapstructure (used in unmarshaling).

## Codec System

The codec system allows customization of how configuration files are encoded and decoded.

### Encoder Interface

```go { .api }
type Encoder interface {
    Encode(v map[string]any) ([]byte, error)
}
```

Encodes Viper's internal data structures into a byte representation. Primarily used for encoding a map[string]any into a file format.

### Decoder Interface

```go { .api }
type Decoder interface {
    Decode(b []byte, v map[string]any) error
}
```

Decodes the contents of a byte slice into Viper's internal data structures. Primarily used for decoding contents of a file into a map[string]any.

### Codec Interface

```go { .api }
type Codec interface {
    Encoder
    Decoder
}
```

Combines Encoder and Decoder interfaces.

### Encoder Registry

```go { .api }
type EncoderRegistry interface {
    Encoder(format string) (Encoder, error)
}
```

Returns an Encoder for a given format. Format is case-insensitive. Returns an error if no Encoder is registered for the format.

### Decoder Registry

```go { .api }
type DecoderRegistry interface {
    Decoder(format string) (Decoder, error)
}
```

Returns a Decoder for a given format. Format is case-insensitive. Returns an error if no Decoder is registered for the format.

### Codec Registry

```go { .api }
type CodecRegistry interface {
    EncoderRegistry
    DecoderRegistry
}
```

Combines EncoderRegistry and DecoderRegistry interfaces.

### Default Codec Registry

```go { .api }
type DefaultCodecRegistry struct {
    // Has unexported fields
}
```

Simple implementation of CodecRegistry that allows registering custom Codecs.

```go { .api }
func NewCodecRegistry() *DefaultCodecRegistry
```

Returns a new CodecRegistry, ready to accept custom Codecs.

```go { .api }
func (*DefaultCodecRegistry) RegisterCodec(format string, codec Codec) error
```

Registers a custom Codec. Format is case-insensitive.

```go { .api }
func (*DefaultCodecRegistry) Encoder(format string) (Encoder, error)
```

Implements the EncoderRegistry interface. Format is case-insensitive.

```go { .api }
func (*DefaultCodecRegistry) Decoder(format string) (Decoder, error)
```

Implements the DecoderRegistry interface. Format is case-insensitive.

**Example**:
```go
// Custom codec for a special format
type MyCodec struct{}

func (c MyCodec) Encode(v map[string]any) ([]byte, error) {
    // Custom encoding logic
    return json.Marshal(v)
}

func (c MyCodec) Decode(b []byte, v map[string]any) error {
    // Custom decoding logic
    return json.Unmarshal(b, &v)
}

// Register custom codec
registry := viper.NewCodecRegistry()
registry.RegisterCodec("myformat", MyCodec{})

v := viper.NewWithOptions(viper.WithCodecRegistry(registry))
v.SetConfigType("myformat")
```

## Unmarshaling

Viper can unmarshal configuration into Go structs.

### Unmarshal Functions

```go { .api }
func Unmarshal(rawVal any, opts ...DecoderConfigOption) error
func (*Viper) Unmarshal(rawVal any, opts ...DecoderConfigOption) error
```

Unmarshals the config into a Struct. Make sure that the tags on the fields of the structure are properly set.

```go { .api }
func UnmarshalExact(rawVal any, opts ...DecoderConfigOption) error
func (*Viper) UnmarshalExact(rawVal any, opts ...DecoderConfigOption) error
```

Unmarshals the config into a Struct, erroring if a field is nonexistent in the destination struct.

```go { .api }
func UnmarshalKey(key string, rawVal any, opts ...DecoderConfigOption) error
func (*Viper) UnmarshalKey(key string, rawVal any, opts ...DecoderConfigOption) error
```

Takes a single key and unmarshals it into a Struct.

### Decoder Config Options

```go { .api }
type DecoderConfigOption func(*mapstructure.DecoderConfig)
```

A function type that can be passed to Unmarshal methods to configure mapstructure.DecoderConfig options.

```go { .api }
func DecodeHook(hook mapstructure.DecodeHookFunc) DecoderConfigOption
```

Returns a DecoderConfigOption which overrides the default DecodeHook value.

**Default decode hook**:
```go
mapstructure.ComposeDecodeHookFunc(
    mapstructure.StringToTimeDurationHookFunc(),
    mapstructure.StringToSliceHookFunc(","),
)
```

### Unmarshal Examples

**Basic unmarshaling**:
```go
type Config struct {
    Host     string `mapstructure:"host"`
    Port     int    `mapstructure:"port"`
    Username string `mapstructure:"username"`
}

var config Config
err := viper.Unmarshal(&config)
if err != nil {
    log.Fatal("Unable to unmarshal config:", err)
}

fmt.Printf("Host: %s, Port: %d\n", config.Host, config.Port)
```

**Unmarshaling nested structures**:
```go
type DatabaseConfig struct {
    Host     string `mapstructure:"host"`
    Port     int    `mapstructure:"port"`
    Username string `mapstructure:"username"`
    Password string `mapstructure:"password"`
}

type AppConfig struct {
    Name     string          `mapstructure:"name"`
    Debug    bool            `mapstructure:"debug"`
    Database DatabaseConfig  `mapstructure:"database"`
}

var config AppConfig
viper.Unmarshal(&config)
```

**Unmarshaling a specific key**:
```go
type DatabaseConfig struct {
    Host     string `mapstructure:"host"`
    Port     int    `mapstructure:"port"`
}

var dbConfig DatabaseConfig
err := viper.UnmarshalKey("database", &dbConfig)
```

**Using custom decode hooks**:
```go
import "github.com/go-viper/mapstructure/v2"

type Config struct {
    Timeout time.Duration `mapstructure:"timeout"`
}

hook := mapstructure.ComposeDecodeHookFunc(
    mapstructure.StringToTimeDurationHookFunc(),
    mapstructure.StringToSliceHookFunc(","),
)

var config Config
err := viper.Unmarshal(&config, viper.DecodeHook(hook))
```

**Using UnmarshalExact for strict validation**:
```go
type Config struct {
    Host string `mapstructure:"host"`
    Port int    `mapstructure:"port"`
}

// Config file has extra fields: host, port, debug
// UnmarshalExact will error because 'debug' is not in the struct
var config Config
err := viper.UnmarshalExact(&config)
if err != nil {
    // Error: 'debug' is not a field in Config
}
```

## Experimental Features

### Experimental Bind Struct

```go { .api }
func ExperimentalBindStruct() Option
```

Tells Viper to use the new bind struct feature. This is an experimental feature that may change in future versions.

**Example**:
```go
v := viper.NewWithOptions(viper.ExperimentalBindStruct())
```

### Experimental Finder

```go { .api }
func ExperimentalFinder() Option
```

Tells Viper to use the new Finder interface for finding configuration files. This is an experimental feature.

**Example**:
```go
v := viper.NewWithOptions(viper.ExperimentalFinder())
```

## Sub-Trees

```go { .api }
func Sub(key string) *Viper
func (*Viper) Sub(key string) *Viper
```

Returns a new Viper instance representing a sub tree of the current instance. Sub is case-insensitive for a key.

**Example**:
```go
// Configuration:
// {
//   "database": {
//     "host": "localhost",
//     "port": 5432,
//     "credentials": {
//       "username": "admin",
//       "password": "secret"
//     }
//   }
// }

// Get database config as sub-tree
dbViper := viper.Sub("database")
if dbViper == nil {
    log.Fatal("Database config not found")
}

host := dbViper.GetString("host")
port := dbViper.GetInt("port")

// Get credentials as nested sub-tree
credsViper := dbViper.Sub("credentials")
username := credsViper.GetString("username")
password := credsViper.GetString("password")
```

**Use cases**:
- Passing configuration subsections to different components
- Isolating configuration for modular applications
- Cleaner code when working with nested configurations

## Debug Functions

```go { .api }
func Debug()
func (*Viper) Debug()
```

Prints all configuration registries for debugging purposes.

```go { .api }
func DebugTo(w io.Writer)
func (*Viper) DebugTo(w io.Writer)
```

Prints debug information to the specified writer.

**Example**:
```go
// Print to stdout
viper.Debug()

// Print to file
f, _ := os.Create("debug.txt")
defer f.Close()
viper.DebugTo(f)

// Print to buffer
var buf bytes.Buffer
viper.DebugTo(&buf)
fmt.Println(buf.String())
```

## Reset Function

```go { .api }
func Reset()
```

Resets all configuration to default settings. Intended for testing. Available in the public interface so applications can use it in their testing as well.

**Example**:
```go
func TestConfig(t *testing.T) {
    // Set up test configuration
    viper.Set("test_key", "test_value")

    // Run test
    // ...

    // Clean up
    viper.Reset()
}
```

## Complete Advanced Example

```go
package main

import (
    "fmt"
    "log"
    "log/slog"
    "os"
    "time"

    "github.com/go-viper/mapstructure/v2"
    "github.com/spf13/viper"
)

// Custom configuration struct
type AppConfig struct {
    Name         string          `mapstructure:"name"`
    Debug        bool            `mapstructure:"debug"`
    Timeout      time.Duration   `mapstructure:"timeout"`
    Database     DatabaseConfig  `mapstructure:"database"`
    Features     []string        `mapstructure:"features"`
}

type DatabaseConfig struct {
    Host         string `mapstructure:"host"`
    Port         int    `mapstructure:"port"`
    MaxConns     int    `mapstructure:"max_connections"`
}

// Custom string replacer
type dashToUnderscore struct{}

func (dashToUnderscore) Replace(s string) string {
    return strings.ReplaceAll(s, "-", "_")
}

func main() {
    // Create custom logger
    logger := slog.New(slog.NewTextHandler(os.Stdout, &slog.HandlerOptions{
        Level: slog.LevelDebug,
    }))

    // Custom decode hook for durations
    durationHook := mapstructure.StringToTimeDurationHookFunc()

    // Create Viper with options
    v := viper.NewWithOptions(
        viper.WithLogger(logger),
        viper.KeyDelimiter("."),
        viper.EnvKeyReplacer(dashToUnderscore{}),
        viper.WithDecodeHook(durationHook),
    )

    // Set defaults
    v.SetDefault("name", "myapp")
    v.SetDefault("debug", false)
    v.SetDefault("timeout", "30s")
    v.SetDefault("database.max_connections", 10)

    // Read configuration
    v.SetConfigName("config")
    v.SetConfigType("yaml")
    v.AddConfigPath(".")

    if err := v.ReadInConfig(); err != nil {
        if _, ok := err.(viper.ConfigFileNotFoundError); !ok {
            log.Fatal(err)
        }
    }

    // Enable environment variables
    v.SetEnvPrefix("app")
    v.AutomaticEnv()

    // Unmarshal into struct
    var config AppConfig
    if err := v.Unmarshal(&config); err != nil {
        log.Fatal("Unable to unmarshal config:", err)
    }

    fmt.Printf("App: %s (debug: %v)\n", config.Name, config.Debug)
    fmt.Printf("Timeout: %v\n", config.Timeout)
    fmt.Printf("Database: %s:%d (max conns: %d)\n",
        config.Database.Host,
        config.Database.Port,
        config.Database.MaxConns,
    )

    // Work with sub-trees
    dbViper := v.Sub("database")
    if dbViper != nil {
        fmt.Println("Database host from sub-tree:", dbViper.GetString("host"))
    }

    // Debug output
    v.Debug()
}
```
