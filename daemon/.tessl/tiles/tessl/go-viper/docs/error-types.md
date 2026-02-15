# Error Types

This document covers all error types in Viper and how to handle them.

## Configuration File Errors

### ConfigFileNotFoundError

```go { .api }
type ConfigFileNotFoundError struct {
    // Has unexported fields
}

func (ConfigFileNotFoundError) Error() string
```

Denotes failing to find configuration file. Returned by `ReadInConfig()` when the config file cannot be found in any of the configured search paths.

**Example**:
```go
err := viper.ReadInConfig()
if err != nil {
    if _, ok := err.(viper.ConfigFileNotFoundError); ok {
        // Config file not found; can use defaults or handle accordingly
        fmt.Println("Config file not found, using defaults")
    } else {
        // Other error occurred
        log.Fatal("Error reading config:", err)
    }
}
```

### ConfigParseError

```go { .api }
type ConfigParseError struct {
    // Has unexported fields
}

func (ConfigParseError) Error() string
func (ConfigParseError) Unwrap() error
```

Denotes failing to parse configuration file. Returned when the config file exists but contains invalid syntax or cannot be parsed as the specified format.

**Methods**:
- `Error()` - Returns the formatted configuration error
- `Unwrap()` - Returns the wrapped error for error chain inspection

**Example**:
```go
err := viper.ReadInConfig()
if err != nil {
    if parseErr, ok := err.(viper.ConfigParseError); ok {
        fmt.Println("Parse error:", parseErr)
        // Get underlying error
        if innerErr := parseErr.Unwrap(); innerErr != nil {
            fmt.Println("Caused by:", innerErr)
        }
    }
}
```

### ConfigMarshalError

```go { .api }
type ConfigMarshalError struct {
    // Has unexported fields
}

func (ConfigMarshalError) Error() string
```

Happens when failing to marshal the configuration. Typically returned by write operations like `WriteConfig()` or `WriteConfigAs()` when the configuration cannot be serialized to the target format.

**Example**:
```go
err := viper.WriteConfig()
if err != nil {
    if _, ok := err.(viper.ConfigMarshalError); ok {
        fmt.Println("Failed to marshal config for writing")
    }
}
```

### ConfigFileAlreadyExistsError

```go { .api }
type ConfigFileAlreadyExistsError string

func (ConfigFileAlreadyExistsError) Error() string
```

Denotes failure to write new configuration file. Returned by `SafeWriteConfig()` and `SafeWriteConfigAs()` when the target file already exists.

**Example**:
```go
err := viper.SafeWriteConfig()
if err != nil {
    if _, ok := err.(viper.ConfigFileAlreadyExistsError); ok {
        fmt.Println("Config file already exists, not overwriting")
    } else {
        log.Fatal("Error writing config:", err)
    }
}
```

### UnsupportedConfigError

```go { .api }
type UnsupportedConfigError string

func (UnsupportedConfigError) Error() string
```

Denotes encountering an unsupported configuration filetype. Returned when trying to read or write a config file with an unsupported extension or format.

**Supported formats**: json, toml, yaml, yml, properties, props, prop, hcl, tfvars, dotenv, env, ini

**Example**:
```go
viper.SetConfigType("xml")  // Unsupported format
err := viper.ReadInConfig()
if err != nil {
    if _, ok := err.(viper.UnsupportedConfigError); ok {
        fmt.Println("Unsupported config format")
    }
}
```

## Remote Configuration Errors

### RemoteConfigError

```go { .api }
type RemoteConfigError string

func (RemoteConfigError) Error() string
```

Denotes encountering an error while trying to pull the configuration from the remote provider.

**Common error messages**:
- "Enable the remote features by doing a blank import of the viper/remote package: '_ github.com/spf13/viper/remote'" - Remote package not imported
- "No Remote Providers" - No remote providers have been added
- "No Files Found" - Configuration not found in any of the configured remote providers

**Example**:
```go
import _ "github.com/spf13/viper/remote"

viper.AddRemoteProvider("consul", "localhost:8500", "/config/myapp")
err := viper.ReadRemoteConfig()
if err != nil {
    if remoteErr, ok := err.(viper.RemoteConfigError); ok {
        fmt.Println("Remote config error:", remoteErr)
        // Handle remote-specific errors
    }
}
```

### UnsupportedRemoteProviderError

```go { .api }
type UnsupportedRemoteProviderError string

func (UnsupportedRemoteProviderError) Error() string
```

Denotes encountering an unsupported remote provider. Returned by `AddRemoteProvider()` or `AddSecureRemoteProvider()` when an unsupported provider type is specified.

**Supported providers**: etcd, etcd3, consul, firestore, nats

**Example**:
```go
err := viper.AddRemoteProvider("redis", "localhost:6379", "/config")
if err != nil {
    if _, ok := err.(viper.UnsupportedRemoteProviderError); ok {
        fmt.Println("Unsupported remote provider")
        fmt.Println("Supported:", viper.SupportedRemoteProviders)
    }
}
```

## Error Handling Patterns

### Comprehensive Error Handling

```go
func loadConfig() error {
    viper.SetConfigName("config")
    viper.SetConfigType("yaml")
    viper.AddConfigPath(".")

    err := viper.ReadInConfig()
    if err != nil {
        switch err.(type) {
        case viper.ConfigFileNotFoundError:
            // Config file not found; use defaults
            fmt.Println("No config file found, using defaults")
            return nil

        case viper.ConfigParseError:
            // Config file found but malformed
            fmt.Println("Config file is malformed:", err)
            return err

        case viper.UnsupportedConfigError:
            // Unsupported config format
            fmt.Println("Unsupported config format:", err)
            return err

        default:
            // Other error (e.g., permission denied)
            fmt.Println("Error reading config:", err)
            return err
        }
    }

    fmt.Println("Config loaded from:", viper.ConfigFileUsed())
    return nil
}
```

### Graceful Degradation

```go
func initConfig() {
    // Try to read config file
    viper.SetConfigName("config")
    viper.AddConfigPath("/etc/myapp/")
    viper.AddConfigPath("$HOME/.myapp")
    viper.AddConfigPath(".")

    if err := viper.ReadInConfig(); err != nil {
        if _, ok := err.(viper.ConfigFileNotFoundError); ok {
            // Gracefully handle missing config
            log.Println("Config file not found, using defaults and environment")
        } else {
            // Other errors are fatal
            log.Fatal("Fatal error config file:", err)
        }
    } else {
        log.Println("Using config file:", viper.ConfigFileUsed())
    }

    // Always enable environment variables as fallback
    viper.AutomaticEnv()
}
```

### Safe Writing with Error Handling

```go
func saveConfig() error {
    // Try safe write first (won't overwrite)
    err := viper.SafeWriteConfig()
    if err != nil {
        if _, ok := err.(viper.ConfigFileAlreadyExistsError); ok {
            // File exists, ask user if they want to overwrite
            fmt.Print("Config file exists. Overwrite? (y/n): ")
            var response string
            fmt.Scanln(&response)

            if response == "y" || response == "yes" {
                // Overwrite existing file
                return viper.WriteConfig()
            }
            return fmt.Errorf("config file exists, not overwriting")
        }

        // Other error (e.g., marshal error, permission error)
        return fmt.Errorf("error writing config: %w", err)
    }

    fmt.Println("Config file written successfully")
    return nil
}
```

### Remote Config Error Handling

```go
import _ "github.com/spf13/viper/remote"

func loadRemoteConfig() error {
    // Add remote providers
    viper.AddRemoteProvider("consul", "localhost:8500", "/config/myapp")

    viper.SetConfigType("json")

    err := viper.ReadRemoteConfig()
    if err != nil {
        if remoteErr, ok := err.(viper.RemoteConfigError); ok {
            errStr := remoteErr.Error()

            if strings.Contains(errStr, "No Remote Providers") {
                return fmt.Errorf("no remote providers configured")
            }

            if strings.Contains(errStr, "No Files Found") {
                // Try fallback to local config
                log.Println("Remote config not found, trying local")
                return viper.ReadInConfig()
            }

            if strings.Contains(errStr, "Enable the remote features") {
                return fmt.Errorf("remote package not imported")
            }

            return fmt.Errorf("remote config error: %w", remoteErr)
        }

        return fmt.Errorf("error reading remote config: %w", err)
    }

    return nil
}
```

### Type-Safe Error Checking

```go
func handleConfigError(err error) {
    if err == nil {
        return
    }

    // Type assertion with explicit checks
    switch e := err.(type) {
    case viper.ConfigFileNotFoundError:
        log.Printf("Config file not found: %v", e)
        // Use defaults

    case viper.ConfigParseError:
        log.Printf("Config parse error: %v", e)
        if innerErr := e.Unwrap(); innerErr != nil {
            log.Printf("Underlying error: %v", innerErr)
        }
        os.Exit(1)

    case viper.ConfigMarshalError:
        log.Printf("Config marshal error: %v", e)
        os.Exit(1)

    case viper.ConfigFileAlreadyExistsError:
        log.Printf("Config file exists: %v", e)

    case viper.UnsupportedConfigError:
        log.Printf("Unsupported config format: %v", e)
        os.Exit(1)

    case viper.RemoteConfigError:
        log.Printf("Remote config error: %v", e)
        // Fall back to local config

    case viper.UnsupportedRemoteProviderError:
        log.Printf("Unsupported remote provider: %v", e)
        log.Printf("Supported: %v", viper.SupportedRemoteProviders)
        os.Exit(1)

    default:
        log.Printf("Unknown error: %v", err)
        os.Exit(1)
    }
}
```

## Error Prevention

### Best Practices

**1. Always handle ConfigFileNotFoundError gracefully**:
```go
if err := viper.ReadInConfig(); err != nil {
    if _, ok := err.(viper.ConfigFileNotFoundError); !ok {
        // Only panic on non-"not found" errors
        panic(err)
    }
}
```

**2. Validate config type before reading**:
```go
supportedExts := viper.SupportedExts
configType := "myformat"

found := false
for _, ext := range supportedExts {
    if ext == configType {
        found = true
        break
    }
}

if !found {
    log.Fatalf("Unsupported config type: %s", configType)
}

viper.SetConfigType(configType)
```

**3. Validate remote provider before adding**:
```go
provider := "redis"

found := false
for _, p := range viper.SupportedRemoteProviders {
    if p == provider {
        found = true
        break
    }
}

if !found {
    log.Fatalf("Unsupported remote provider: %s", provider)
}

viper.AddRemoteProvider(provider, endpoint, path)
```

**4. Use SafeWrite functions to prevent accidental overwrites**:
```go
// Use SafeWriteConfig instead of WriteConfig when appropriate
if err := viper.SafeWriteConfig(); err != nil {
    if _, ok := err.(viper.ConfigFileAlreadyExistsError); ok {
        // Handle existing file case
    }
}
```
