# Environment Variables and Command-Line Flags

This document covers binding environment variables and command-line flags to configuration keys.

## Environment Variables

### Automatic Environment Variable Binding

```go { .api }
func AutomaticEnv()
func (*Viper) AutomaticEnv()
```

Makes Viper check if environment variables match any of the existing keys (config, default or flags). If matching env vars are found, they are loaded into Viper.

When enabled, Viper will check for an environment variable any time a `Get` request is made. The env variable name will be the key uppercased and prefixed with the EnvPrefix if set.

**Important**: Environment variables are case sensitive.

**Example**:
```go
viper.SetDefault("port", 8080)
viper.AutomaticEnv()

os.Setenv("PORT", "9090")
port := viper.GetInt("port") // Returns 9090
```

### Manual Environment Variable Binding

```go { .api }
func BindEnv(input ...string) error
func (*Viper) BindEnv(input ...string) error
```

Binds a Viper key to an ENV variable. ENV variables are case sensitive.

- If only a key is provided, it will use the env key matching the key, uppercased
- If more arguments are provided, they represent the env variable names that should bind to this key
- They will be taken in the specified order
- EnvPrefix will be used when env name is not explicitly provided

**Example**:
```go
// Bind key to env var with same name (uppercased)
viper.BindEnv("port")           // Looks for PORT env var
os.Setenv("PORT", "8080")
port := viper.GetInt("port")    // Returns 8080

// Bind key to explicitly named env var
viper.BindEnv("database_url", "DB_CONNECTION_STRING")
os.Setenv("DB_CONNECTION_STRING", "postgres://...")
url := viper.GetString("database_url")

// Bind with multiple env var names (first one wins)
viper.BindEnv("host", "SERVER_HOST", "HOST")
```

```go { .api }
func MustBindEnv(input ...string)
func (*Viper) MustBindEnv(input ...string)
```

Wraps BindEnv in a panic. If there is an error binding an environment variable, MustBindEnv will panic.

### Environment Variable Prefix

```go { .api }
func SetEnvPrefix(in string)
func (*Viper) SetEnvPrefix(in string)
```

Defines a prefix that ENVIRONMENT variables will use. For example, if your prefix is "spf", the env registry will look for env variables that start with "SPF_".

```go { .api }
func GetEnvPrefix() string
func (*Viper) GetEnvPrefix() string
```

Returns the environment variable prefix.

**Example**:
```go
viper.SetEnvPrefix("myapp")
viper.AutomaticEnv()

os.Setenv("MYAPP_PORT", "8080")
os.Setenv("MYAPP_HOST", "localhost")

port := viper.GetInt("port")       // Looks for MYAPP_PORT
host := viper.GetString("host")     // Looks for MYAPP_HOST
```

### Environment Key Replacer

```go { .api }
func SetEnvKeyReplacer(r *strings.Replacer)
func (*Viper) SetEnvKeyReplacer(r *strings.Replacer)
```

Sets the strings.Replacer on the viper object. Useful for mapping an environmental variable to a key that does not match it.

**Example**:
```go
// Replace dashes with underscores in env var names
viper.SetEnvKeyReplacer(strings.NewReplacer(".", "_", "-", "_"))
viper.AutomaticEnv()

os.Setenv("LOG_LEVEL", "debug")
level := viper.GetString("log.level")  // Reads from LOG_LEVEL
```

### Empty Environment Variables

```go { .api }
func AllowEmptyEnv(allowEmptyEnv bool)
func (*Viper) AllowEmptyEnv(allowEmptyEnv bool)
```

Tells Viper to consider set, but empty environment variables as valid values instead of falling back to the next configuration source.

By default, empty environment variables are considered unset and will fall back. Setting this to true treats empty values as set.

**Example**:
```go
viper.SetDefault("api_key", "default_key")
viper.AllowEmptyEnv(true)
viper.AutomaticEnv()

os.Setenv("API_KEY", "")

// With AllowEmptyEnv(true): returns ""
// With AllowEmptyEnv(false): returns "default_key"
key := viper.GetString("api_key")
```

## Command-Line Flags

Viper provides integration with the pflag library (used by Cobra).

### Flag Binding Interfaces

```go { .api }
type FlagValue interface {
    HasChanged() bool
    Name() string
    ValueString() string
    ValueType() string
}
```

Interface that users can implement to bind different flags to viper.

```go { .api }
type FlagValueSet interface {
    VisitAll(fn func(FlagValue))
}
```

Interface that users can implement to bind a set of flags to viper.

### Binding pflag Flags

```go { .api }
func BindPFlag(key string, flag *pflag.Flag) error
func (*Viper) BindPFlag(key string, flag *pflag.Flag) error
```

Binds a specific key to a pflag (as used by cobra).

**Example**:
```go
import (
    "github.com/spf13/cobra"
    "github.com/spf13/pflag"
    "github.com/spf13/viper"
)

var rootCmd = &cobra.Command{
    Use: "myapp",
    Run: func(cmd *cobra.Command, args []string) {
        port := viper.GetInt("port")
        fmt.Println("Port:", port)
    },
}

func init() {
    rootCmd.Flags().Int("port", 8080, "Server port")
    viper.BindPFlag("port", rootCmd.Flags().Lookup("port"))
}
```

```go { .api }
func BindPFlags(flags *pflag.FlagSet) error
func (*Viper) BindPFlags(flags *pflag.FlagSet) error
```

Binds a full flag set to the configuration, using each flag's long name as the config key.

**Example**:
```go
flags := pflag.NewFlagSet("myapp", pflag.ContinueOnError)
flags.Int("port", 8080, "Server port")
flags.String("host", "localhost", "Server host")
flags.Bool("debug", false, "Enable debug mode")

viper.BindPFlags(flags)
flags.Parse(os.Args[1:])
```

### Binding Generic Flags

```go { .api }
func BindFlagValue(key string, flag FlagValue) error
func (*Viper) BindFlagValue(key string, flag FlagValue) error
```

Binds a specific key to a FlagValue.

```go { .api }
func BindFlagValues(flags FlagValueSet) error
func (*Viper) BindFlagValues(flags FlagValueSet) error
```

Binds a full FlagValue set to the configuration, using each flag's long name as the config key.

## Configuration Options

When creating a Viper instance with options, you can customize environment variable behavior:

### StringReplacer Interface

```go { .api }
type StringReplacer interface {
    Replace(s string) string
}
```

Applies a set of replacements to a string.

### EnvKeyReplacer Option

```go { .api }
func EnvKeyReplacer(r StringReplacer) Option
```

Sets a replacer used for mapping environment variables to internal keys. This is more flexible than SetEnvKeyReplacer as it accepts the StringReplacer interface.

**Example**:
```go
type customReplacer struct{}

func (c customReplacer) Replace(s string) string {
    return strings.ReplaceAll(strings.ToUpper(s), ".", "_")
}

v := viper.NewWithOptions(viper.EnvKeyReplacer(customReplacer{}))
```

## Complete Example

### Combining Environment Variables and Flags

```go
package main

import (
    "fmt"
    "os"

    "github.com/spf13/pflag"
    "github.com/spf13/viper"
)

func main() {
    // 1. Set defaults
    viper.SetDefault("port", 8080)
    viper.SetDefault("host", "localhost")
    viper.SetDefault("debug", false)

    // 2. Setup environment variables
    viper.SetEnvPrefix("myapp")
    viper.SetEnvKeyReplacer(strings.NewReplacer(".", "_"))
    viper.AutomaticEnv()

    // 3. Setup command-line flags
    pflag.Int("port", 8080, "Server port")
    pflag.String("host", "localhost", "Server host")
    pflag.Bool("debug", false, "Enable debug mode")
    pflag.Parse()
    viper.BindPFlags(pflag.CommandLine)

    // 4. Read config file (optional)
    viper.SetConfigName("config")
    viper.AddConfigPath(".")
    viper.ReadInConfig() // Ignore errors

    // 5. Get values (priority: flags > env > config > defaults)
    port := viper.GetInt("port")
    host := viper.GetString("host")
    debug := viper.GetBool("debug")

    fmt.Printf("Server: %s:%d (debug: %v)\n", host, port, debug)
}
```

### Priority Example

```go
// Demonstrate priority order
viper.SetDefault("value", "default")
fmt.Println(viper.GetString("value")) // "default"

// Config file sets it to "from-config"
viper.ReadInConfig()
fmt.Println(viper.GetString("value")) // "from-config"

// Environment variable overrides
os.Setenv("VALUE", "from-env")
viper.AutomaticEnv()
fmt.Println(viper.GetString("value")) // "from-env"

// Flag overrides (if bound)
// Assume flag was set to "from-flag"
fmt.Println(viper.GetString("value")) // "from-flag"

// Explicit Set overrides everything
viper.Set("value", "explicit")
fmt.Println(viper.GetString("value")) // "explicit"
```

### Environment Variable Patterns

```go
// Pattern 1: Automatic binding with prefix
viper.SetEnvPrefix("app")
viper.AutomaticEnv()
os.Setenv("APP_DATABASE_HOST", "db.example.com")
host := viper.GetString("database.host") // "db.example.com"

// Pattern 2: Explicit binding
viper.BindEnv("db_url", "DATABASE_URL")
os.Setenv("DATABASE_URL", "postgres://...")
url := viper.GetString("db_url")

// Pattern 3: Multiple env var names
viper.BindEnv("port", "SERVER_PORT", "PORT", "HTTP_PORT")
// Will use first env var that is set

// Pattern 4: Empty values
viper.AllowEmptyEnv(true)
viper.BindEnv("optional_value")
os.Setenv("OPTIONAL_VALUE", "")
value := viper.GetString("optional_value") // "" (not fallback)
```
