# Remote Configuration

This document covers reading configuration from remote key/value stores such as etcd, Consul, Firestore, and NATS.

## Overview

Viper supports reading configuration from remote key/value stores and watching for changes. This enables centralized configuration management for distributed systems.

**Important**: Remote configuration requires importing the remote package:

```go { .api }
import _ "github.com/spf13/viper/remote"
```

This import initializes the remote provider functionality.

## Supported Remote Providers

```go { .api }
var SupportedRemoteProviders = []string{
    "etcd",      // etcd v2
    "etcd3",     // etcd v3
    "consul",    // HashiCorp Consul
    "firestore", // Google Cloud Firestore
    "nats",      // NATS
}
```

## Remote Provider Interface

```go { .api }
type RemoteProvider interface {
    Provider() string
    Endpoint() string
    Path() string
    SecretKeyring() string
}
```

Stores the configuration necessary to connect to a remote key/value store. Optional secretKeyring to unencrypt encrypted values can be provided.

## Adding Remote Providers

### Unencrypted Remote Provider

```go { .api }
func AddRemoteProvider(provider, endpoint, path string) error
func (*Viper) AddRemoteProvider(provider, endpoint, path string) error
```

Adds a remote configuration source. Remote providers are searched in the order they are added.

**Parameters**:
- `provider`: String value - "etcd", "etcd3", "consul", "firestore", or "nats"
- `endpoint`: The URL
  - etcd requires `http://ip:port`
  - consul requires `ip:port`
  - nats requires `nats://ip:port`
  - firestore requires `project-id`
- `path`: The path in the k/v store to retrieve configuration

To retrieve a config file called `myapp.json` from `/configs/myapp.json`, set path to `/configs` and set config name to "myapp" with `SetConfigName()`.

**Example**:
```go
import _ "github.com/spf13/viper/remote"

viper.AddRemoteProvider("consul", "localhost:8500", "/config/myapp")
viper.SetConfigType("json")
err := viper.ReadRemoteConfig()
```

### Encrypted Remote Provider

```go { .api }
func AddSecureRemoteProvider(provider, endpoint, path, secretkeyring string) error
func (*Viper) AddSecureRemoteProvider(provider, endpoint, path, secretkeyring string) error
```

Adds a remote configuration source with encryption support. Secure remote providers are searched in the order they are added.

**Parameters**:
- `provider`: String value - "etcd", "etcd3", "consul", "firestore", or "nats"
- `endpoint`: The URL (same format as AddRemoteProvider)
- `path`: The path in the k/v store
- `secretkeyring`: Filepath to your openpgp secret keyring (e.g., `/etc/secrets/myring.gpg`)

Secure remote providers are implemented with `github.com/sagikazarmark/crypt`.

**Example**:
```go
import _ "github.com/spf13/viper/remote"

err := viper.AddSecureRemoteProvider(
    "consul",
    "localhost:8500",
    "/config/myapp",
    "/etc/secrets/keyring.gpg",
)
viper.SetConfigType("json")
err = viper.ReadRemoteConfig()
```

## Reading Remote Configuration

### Reading Once

```go { .api }
func ReadRemoteConfig() error
func (*Viper) ReadRemoteConfig() error
```

Attempts to get configuration from a remote source and read it in the remote configuration registry. Returns the first successfully read configuration from the list of remote providers.

**Example**:
```go
import _ "github.com/spf13/viper/remote"

// Add one or more remote providers
viper.AddRemoteProvider("etcd", "http://127.0.0.1:2379", "/config/myapp")
viper.AddRemoteProvider("consul", "127.0.0.1:8500", "/config/myapp")

viper.SetConfigType("json")

err := viper.ReadRemoteConfig()
if err != nil {
    if remoteErr, ok := err.(viper.RemoteConfigError); ok {
        // Handle remote config error
        fmt.Println("Remote config error:", remoteErr)
    }
}

// Use configuration
dbHost := viper.GetString("database.host")
```

### Watching Remote Configuration

```go { .api }
func WatchRemoteConfig() error
func (*Viper) WatchRemoteConfig() error
```

Watches remote configuration for changes. When the configuration changes, it will be automatically reloaded.

```go { .api }
func (*Viper) WatchRemoteConfigOnChannel() error
```

Watches remote configuration on a channel. Available only on *Viper instances (not package-level function).

**Example**:
```go
import _ "github.com/spf13/viper/remote"

viper.AddRemoteProvider("consul", "localhost:8500", "/config/myapp")
viper.SetConfigType("json")

// Initial read
err := viper.ReadRemoteConfig()
if err != nil {
    panic(err)
}

// Watch for changes
go func() {
    for {
        time.Sleep(time.Second * 5)
        err := viper.WatchRemoteConfig()
        if err != nil {
            log.Println("Error watching remote config:", err)
            continue
        }
        // Config has been updated
        fmt.Println("Config updated from remote")
    }
}()
```

## Remote Response Type

```go { .api }
type RemoteResponse struct {
    Value []byte  // The configuration data as bytes
    Error error   // Any error that occurred during retrieval
}
```

Response structure for remote configuration operations.

## Error Handling

### RemoteConfigError

```go { .api }
type RemoteConfigError string

func (RemoteConfigError) Error() string
```

Denotes encountering an error while trying to pull the configuration from the remote provider.

**Common errors**:
- "Enable the remote features by doing a blank import of the viper/remote package" - Forgot to import remote package
- "No Remote Providers" - No remote providers have been added
- "No Files Found" - Configuration not found in any remote provider

### UnsupportedRemoteProviderError

```go { .api }
type UnsupportedRemoteProviderError string

func (UnsupportedRemoteProviderError) Error() string
```

Denotes encountering an unsupported remote provider. Currently only etcd, etcd3, consul, firestore, and nats are supported.

## Complete Examples

### Using etcd

```go
package main

import (
    "fmt"
    "log"

    "github.com/spf13/viper"
    _ "github.com/spf13/viper/remote"
)

func main() {
    // Configure remote provider
    err := viper.AddRemoteProvider("etcd", "http://127.0.0.1:2379", "/config/myapp")
    if err != nil {
        log.Fatal(err)
    }

    viper.SetConfigType("json")

    // Read configuration
    err = viper.ReadRemoteConfig()
    if err != nil {
        log.Fatal(err)
    }

    // Use configuration
    fmt.Println("App name:", viper.GetString("app_name"))
    fmt.Println("Port:", viper.GetInt("port"))
}
```

### Using Consul with Watching

```go
package main

import (
    "fmt"
    "log"
    "time"

    "github.com/spf13/viper"
    _ "github.com/spf13/viper/remote"
)

func main() {
    // Configure Consul
    err := viper.AddRemoteProvider("consul", "127.0.0.1:8500", "/config/myapp")
    if err != nil {
        log.Fatal(err)
    }

    viper.SetConfigType("json")

    // Initial read
    err = viper.ReadRemoteConfig()
    if err != nil {
        log.Fatal(err)
    }

    fmt.Println("Initial config loaded")
    fmt.Println("Port:", viper.GetInt("port"))

    // Watch for changes
    go func() {
        for {
            time.Sleep(time.Second * 5)
            err := viper.WatchRemoteConfig()
            if err != nil {
                log.Println("Error watching remote config:", err)
                continue
            }
            fmt.Println("Config updated! New port:", viper.GetInt("port"))
        }
    }()

    // Keep application running
    select {}
}
```

### Using Encrypted Configuration

```go
package main

import (
    "fmt"
    "log"

    "github.com/spf13/viper"
    _ "github.com/spf13/viper/remote"
)

func main() {
    // Configure secure remote provider
    err := viper.AddSecureRemoteProvider(
        "consul",
        "127.0.0.1:8500",
        "/config/myapp",
        "/etc/secrets/keyring.gpg",
    )
    if err != nil {
        log.Fatal(err)
    }

    viper.SetConfigType("json")

    // Read encrypted configuration
    err = viper.ReadRemoteConfig()
    if err != nil {
        if remoteErr, ok := err.(viper.RemoteConfigError); ok {
            log.Fatal("Remote config error:", remoteErr)
        }
        log.Fatal(err)
    }

    // Use decrypted configuration
    fmt.Println("Database password:", viper.GetString("database.password"))
}
```

### Multiple Remote Providers with Fallback

```go
package main

import (
    "fmt"
    "log"

    "github.com/spf13/viper"
    _ "github.com/spf13/viper/remote"
)

func main() {
    // Add multiple providers (tried in order)
    viper.AddRemoteProvider("consul", "consul.prod.example.com:8500", "/config/myapp")
    viper.AddRemoteProvider("consul", "consul.backup.example.com:8500", "/config/myapp")
    viper.AddRemoteProvider("etcd", "http://etcd.example.com:2379", "/config/myapp")

    viper.SetConfigType("json")

    // Will try each provider in order until successful
    err := viper.ReadRemoteConfig()
    if err != nil {
        log.Fatal("Failed to read from any remote provider:", err)
    }

    fmt.Println("Configuration loaded successfully")
    fmt.Println("Provider:", viper.GetString("provider"))
}
```

### Combining Local and Remote Configuration

```go
package main

import (
    "fmt"

    "github.com/spf13/viper"
    _ "github.com/spf13/viper/remote"
)

func main() {
    // 1. Set defaults
    viper.SetDefault("port", 8080)
    viper.SetDefault("host", "localhost")

    // 2. Read local config file
    viper.SetConfigName("config")
    viper.AddConfigPath(".")
    viper.ReadInConfig() // Ignore errors

    // 3. Read remote config (overrides local)
    viper.AddRemoteProvider("consul", "127.0.0.1:8500", "/config/myapp")
    viper.SetConfigType("json")
    err := viper.ReadRemoteConfig()
    if err != nil {
        fmt.Println("No remote config, using local")
    }

    // 4. Environment variables (highest priority)
    viper.AutomaticEnv()

    // Final values use priority: env > remote > local > defaults
    fmt.Println("Host:", viper.GetString("host"))
    fmt.Println("Port:", viper.GetInt("port"))
}
```

## Remote Provider Configuration

### Provider-Specific Endpoint Formats

**etcd (v2)**:
```go
viper.AddRemoteProvider("etcd", "http://127.0.0.1:2379", "/config/myapp")
```

**etcd3 (v3)**:
```go
viper.AddRemoteProvider("etcd3", "http://127.0.0.1:2379", "/config/myapp")
```

**Consul**:
```go
viper.AddRemoteProvider("consul", "127.0.0.1:8500", "/config/myapp")
```

**Firestore**:
```go
viper.AddRemoteProvider("firestore", "project-id", "collection/document")
```

**NATS**:
```go
viper.AddRemoteProvider("nats", "nats://127.0.0.1:4222", "config.myapp")
```

### Multiple Endpoints

You can add multiple providers for redundancy:

```go
viper.AddRemoteProvider("consul", "consul1.example.com:8500", "/config/myapp")
viper.AddRemoteProvider("consul", "consul2.example.com:8500", "/config/myapp")
viper.AddRemoteProvider("consul", "consul3.example.com:8500", "/config/myapp")
```

Viper will try each provider in order until one succeeds.
