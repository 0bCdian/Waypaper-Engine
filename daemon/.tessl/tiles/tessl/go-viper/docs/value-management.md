# Value Management

This document covers setting and retrieving configuration values, including defaults, overrides, and type-safe getters.

## Setting Values

### Setting Defaults

```go { .api }
func SetDefault(key string, value any)
func (*Viper) SetDefault(key string, value any)
```

Sets the default value for a key. Default is only used when no value is provided by the user via flag, config file, environment variable, or key/value store. SetDefault is case-insensitive for a key.

**Example**:
```go
viper.SetDefault("port", 8080)
viper.SetDefault("host", "localhost")
viper.SetDefault("database", map[string]any{
    "host": "localhost",
    "port": 5432,
})
```

### Setting Override Values

```go { .api }
func Set(key string, value any)
func (*Viper) Set(key string, value any)
```

Sets the value for the key in the override register. Set is case-insensitive for a key. Will be used instead of values obtained via flags, config file, ENV, default, or key/value store.

**Example**:
```go
viper.Set("app_name", "myapp")
viper.Set("version", "1.0.0")
viper.Set("database.host", "db.example.com")
```

## Retrieving Values

### Get Any Value

```go { .api }
func Get(key string) any
func (*Viper) Get(key string) any
```

Retrieves any value given the key to use. Get is case-insensitive for a key. Get checks in the following order: override, flag, env, config file, key/value store, default. Returns an interface{} value.

### Type-Safe Getters

#### String Values

```go { .api }
func GetString(key string) string
func (*Viper) GetString(key string) string
```

Returns the value associated with the key as a string.

#### Boolean Values

```go { .api }
func GetBool(key string) bool
func (*Viper) GetBool(key string) bool
```

Returns the value associated with the key as a boolean.

#### Integer Values

```go { .api }
func GetInt(key string) int
func (*Viper) GetInt(key string) int
```

Returns the value associated with the key as an integer.

```go { .api }
func GetInt32(key string) int32
func (*Viper) GetInt32(key string) int32
```

Returns the value associated with the key as int32.

```go { .api }
func GetInt64(key string) int64
func (*Viper) GetInt64(key string) int64
```

Returns the value associated with the key as int64.

#### Unsigned Integer Values

```go { .api }
func GetUint(key string) uint
func (*Viper) GetUint(key string) uint
```

Returns the value associated with the key as an unsigned integer.

```go { .api }
func GetUint8(key string) uint8
func (*Viper) GetUint8(key string) uint8
```

Returns the value associated with the key as uint8.

```go { .api }
func GetUint16(key string) uint16
func (*Viper) GetUint16(key string) uint16
```

Returns the value associated with the key as uint16.

```go { .api }
func GetUint32(key string) uint32
func (*Viper) GetUint32(key string) uint32
```

Returns the value associated with the key as uint32.

```go { .api }
func GetUint64(key string) uint64
func (*Viper) GetUint64(key string) uint64
```

Returns the value associated with the key as uint64.

#### Floating Point Values

```go { .api }
func GetFloat64(key string) float64
func (*Viper) GetFloat64(key string) float64
```

Returns the value associated with the key as a float64.

#### Time Values

```go { .api }
func GetDuration(key string) time.Duration
func (*Viper) GetDuration(key string) time.Duration
```

Returns the value associated with the key as a time.Duration.

```go { .api }
func GetTime(key string) time.Time
func (*Viper) GetTime(key string) time.Time
```

Returns the value associated with the key as time.Time.

#### Slice Values

```go { .api }
func GetIntSlice(key string) []int
func (*Viper) GetIntSlice(key string) []int
```

Returns the value associated with the key as a slice of int values.

```go { .api }
func GetStringSlice(key string) []string
func (*Viper) GetStringSlice(key string) []string
```

Returns the value associated with the key as a slice of strings.

#### Map Values

```go { .api }
func GetStringMap(key string) map[string]any
func (*Viper) GetStringMap(key string) map[string]any
```

Returns the value associated with the key as a map of interfaces.

```go { .api }
func GetStringMapString(key string) map[string]string
func (*Viper) GetStringMapString(key string) map[string]string
```

Returns the value associated with the key as a map of strings.

```go { .api }
func GetStringMapStringSlice(key string) map[string][]string
func (*Viper) GetStringMapStringSlice(key string) map[string][]string
```

Returns the value associated with the key as a map to a slice of strings.

#### Size Values

```go { .api }
func GetSizeInBytes(key string) uint
func (*Viper) GetSizeInBytes(key string) uint
```

Returns the size of the value associated with the given key in bytes.

## Getting All Keys and Settings

```go { .api }
func AllKeys() []string
func (*Viper) AllKeys() []string
```

Returns all keys holding a value, regardless of where they are set. Nested keys are returned with a key delimiter separator (default ".").

```go { .api }
func AllSettings() map[string]any
func (*Viper) AllSettings() map[string]any
```

Merges all settings and returns them as a map[string]any.

**Example**:
```go
// Get all keys
keys := viper.AllKeys()
fmt.Println("All configuration keys:", keys)

// Get all settings as a map
settings := viper.AllSettings()
for key, value := range settings {
    fmt.Printf("%s: %v\n", key, value)
}
```

## Checking Key Existence

```go { .api }
func IsSet(key string) bool
func (*Viper) IsSet(key string) bool
```

Checks to see if the key has been set in any of the data locations (override, flag, env, config file, key/value store, or default). IsSet is case-insensitive for a key.

```go { .api }
func InConfig(key string) bool
func (*Viper) InConfig(key string) bool
```

Checks to see if the given key (or an alias) is in the config file.

**Example**:
```go
if viper.IsSet("database.host") {
    host := viper.GetString("database.host")
    fmt.Println("Database host:", host)
}

if viper.InConfig("secret_key") {
    // Key is explicitly in config file
}
```

## Key Aliases

```go { .api }
func RegisterAlias(alias, key string)
func (*Viper) RegisterAlias(alias, key string)
```

Creates an alias that provides another accessor for the same key. This enables one to change a name without breaking the application.

**Example**:
```go
viper.RegisterAlias("verbose", "log_level")

viper.Set("log_level", "debug")

// Both return the same value
level1 := viper.GetString("log_level")   // "debug"
level2 := viper.GetString("verbose")     // "debug"
```

## Type Inference by Default Value

```go { .api }
func SetTypeByDefaultValue(enable bool)
func (*Viper) SetTypeByDefaultValue(enable bool)
```

Enables or disables the inference of a key value's type when the Get function is used based upon a key's default value as opposed to the value returned based on the normal fetch logic.

When enabled, if a key has a default value of `[]string{}` and the same key is set via an environment variable to "a b c", a call to `Get()` would return `[]string{"a", "b", "c"}` instead of the string `"a b c"`.

**Example**:
```go
viper.SetTypeByDefaultValue(true)

viper.SetDefault("tags", []string{})
os.Setenv("TAGS", "foo bar baz")

tags := viper.Get("tags")
// With SetTypeByDefaultValue(true): []string{"foo", "bar", "baz"}
// With SetTypeByDefaultValue(false): "foo bar baz"
```

## Working with Nested Keys

Viper supports nested keys using a delimiter (default is "."):

```go
viper.Set("database.host", "localhost")
viper.Set("database.port", 5432)
viper.Set("database.credentials.username", "admin")

host := viper.GetString("database.host")
port := viper.GetInt("database.port")
username := viper.GetString("database.credentials.username")
```

## Sub-Trees

```go { .api }
func Sub(key string) *Viper
func (*Viper) Sub(key string) *Viper
```

Returns a new Viper instance representing a sub tree of the current instance. Sub is case-insensitive for a key.

**Example**:
```go
viper.Set("database.host", "localhost")
viper.Set("database.port", 5432)
viper.Set("cache.host", "localhost")
viper.Set("cache.port", 6379)

// Get database config as a sub-tree
dbConfig := viper.Sub("database")
if dbConfig != nil {
    host := dbConfig.GetString("host")      // "localhost"
    port := dbConfig.GetInt("port")         // 5432
}
```

## Example Usage

### Basic Value Operations

```go
// Set defaults
viper.SetDefault("app_name", "myapp")
viper.SetDefault("port", 8080)

// Read config file
viper.ReadInConfig()

// Override specific value
viper.Set("port", 9090)

// Get values with type safety
appName := viper.GetString("app_name")
port := viper.GetInt("port")
debug := viper.GetBool("debug")
```

### Working with Complex Types

```go
// Set complex default
viper.SetDefault("server", map[string]any{
    "host": "localhost",
    "port": 8080,
    "tls": map[string]any{
        "enabled": false,
        "cert": "",
        "key": "",
    },
})

// Get nested values
host := viper.GetString("server.host")
tlsEnabled := viper.GetBool("server.tls.enabled")

// Get entire sub-section as map
serverConfig := viper.GetStringMap("server")
```

### Checking Values

```go
if viper.IsSet("optional_feature") {
    enabled := viper.GetBool("optional_feature")
    if enabled {
        // Enable optional feature
    }
}

// Check if key is in config file (vs env, flag, etc)
if viper.InConfig("production_mode") {
    production := viper.GetBool("production_mode")
}
```
