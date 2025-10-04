# Environment Variable Configuration

This document outlines the predictable environment variable naming scheme for overriding TOML configuration settings.

## 🎯 **Design Philosophy**

Environment variables should only override **critical daemon settings** that are needed for:
- **Debugging** (`WP_ENGINE_DAEMON_LOG_*`)
- **Compositor detection issues** (`WP_ENGINE_DAEMON_COMPOSITOR`)
- **Path troubleshooting** (`WP_ENGINE_DAEMON_*_PATH`)

**App-level settings are NOT overrideable** via environment variables to prevent confusion and maintain a clean separation between system-level and user-level configuration.

## 📋 **Predictable Naming Pattern**

Environment variables follow this hierarchical pattern:
```
WP_ENGINE_[SECTION]_[SUBSECTION]_[FIELD]
```

## 🔧 **Available Environment Variables**

### **Daemon Configuration Section**

| Config Path | Environment Variable | Purpose | Example |
|-------------|---------------------|---------|---------|
| `daemon.log_level` | `WP_ENGINE_DAEMON_LOG_LEVEL` | Debug log verbosity | `debug`, `info`, `warn`, `error` |
| `daemon.log_file` | `WP_ENGINE_DAEMON_LOG_FILE` | Log file path | `/tmp/waypaper-debug.log` |
| `daemon.log_max_size` | `WP_ENGINE_DAEMON_LOG_MAX_SIZE` | Max log file size (MB) | `100` |
| `daemon.log_max_age` | `WP_ENGINE_DAEMON_LOG_MAX_AGE` | Log retention days | `7` |
| `daemon.log_max_backups` | `WP_ENGINE_DAEMON_LOG_MAX_BACKUPS` | Number of backup files | `5` |
| `daemon.compositor` | `WP_ENGINE_DAEMON_COMPOSITOR` | Force compositor type | `x11`, `wayland`, `auto` |
| `daemon.database_path` | `WP_ENGINE_DAEMON_DATABASE_PATH` | Custom database location | `/tmp/debug-db.sqlite` |
| `daemon.socket_path` | `WP_ENGINE_DAEMON_SOCKET_PATH` | Custom socket location | `/tmp/debug-sock` |
| `daemon.images_dir` | `WP_ENGINE_DAEMON_IMAGES_DIR` | Custom images directory | `/tmp/test-images` |

### **Backend Configuration Section (Limited)**

| Config Path | Environment Variable | Purpose | Example |
|-------------|---------------------|---------|---------|
| `daemon.backend.type` | `WP_ENGINE_DAEMON_BACKEND_TYPE` | Override backend type | `feh`, `swww`, `nitrogen` |
| `daemon.backend.swww.transition_duration` | `WP_ENGINE_DAEMON_BACKEND_SWW_TRANSITION_DURATION` | SWW transition speed (ms) | `500` |
| `daemon.backend.swww.transition_type` | `WP_ENGINE_DAEMON_BACKEND_SWW_TRANSITION_TYPE` | SWW transition style | `fade`, `slide`, `zoom` |
| `daemon.backend.swww.resize_type` | `WP_ENGINE_DAEMON_BACKEND_SWW_RESIZE_TYPE` | SWW resize mode | `fit`, `crop` |

## 🚫 **NOT Overrideable via Environment**

The following settings **cannot** be overridden via environment variables:
- **App preferences** (`app.theme`, `app.notifications`, etc.)
- **User interface settings** (`app.images_per_page`, `app.sort_by`, etc.)
- **Most backend settings** (only critical SWW settings are exception)

This ensures that:
- ✅ **Environment overrides for system debugging only**
- ✅ **User preferences remain in TOML configuration**
- ✅ **Clean separation of concerns**

## 🎮 **Usage Examples**

### **1. Debugging Compositor Issues**

```bash
# Force Wayland compositor (bypass auto-detection)
export WP_ENGINE_DAEMON_COMPOSITOR=wayland
export WP_ENGINE_DAEMON_LOG_LEVEL=debug
waypaper-daemon
```

### **2. Backend Troubleshooting**

```bash
# Force FEH backend for X11 debugging
export WP_ENGINE_DAEMON_COMPOSITOR=x11
export WP_ENGINE_DAEMON_BACKEND_TYPE=feh
export WP_ENGINE_DAEMON_LOG_LEVEL=debug
waypaper-daemon
```

### **3. Fast Disable Transitions**

```bash
# Minimal SWW transitions for fast testing
export WP_ENGINE_DAEMON_BACKEND_SWW_TRANSITION_DURATION=50
export WP_ENGINE_DAEMON_BACKEND_SWW_TRANSITION_TYPE=fade
waypaper-daemon
```

### **4. Comprehensive Logging**

```bash
# Detailed logging to file
export WP_ENGINE_DAEMON_LOG_FILE=/tmp/waypaper-debug.log
export WP_ENGINE_DAEMON_LOG_LEVEL=debug
export WP_ENGINE_DAEMON_LOG_MAX_SIZE=100
export WP_ENGINE_DAEMON_LOG_MAX_BACKUPS=5
waypaper-daemon
```

### **5. Temporary Configuration**

```bash
# Use temporary paths for testing
export WP_ENGINE_DAEMON_DATABASE_PATH=/tmp/test-db.sqlite
export WP_ENGINE_DAEMON_SOCKET_PATH=/tmp/test-sock
export WP_ENGINE_DAEMON_IMAGES_DIR=/tmp/test-images
waypaper-daemon
```

## 🔍 **Compositor Awareness**

### **Backend Compatibility Matrix**

| Backend | X11 | Wayland | Notes |
|---------|-----|---------|-------|
| **SWW** | ❌ | ✅ | Wayland-only |
| **FEH** | ✅ | ❌ | X11-only |
| **Nitrogen** | ✅ | ❌ | X11-only |
| **MPV** | ✅ | ✅ | Both compositors |
| **Electron** | ✅ | ✅ | Both compositors |
| **WebGL** | ✅ | ✅ | Both compositors |

### **Automatic Backend Selection**

The daemon automatically selects compatible backends based on detected compositor:

```bash
# Force Wayland compositor → will auto-select SWW for images
export WP_ENGINE_DAEMON_COMPOSITOR=wayland

# Force X11 compositor → will auto-select FEH/Nitrogen for images  
export WP_ENGINE_DAEMON_COMPOSITOR=x11

# Auto-detection → use system defaults
export WP_ENGINE_DAEMON_COMPOSITOR=auto
```

### **Compositor Detection Logic**

1. **Environment Override**: Check `WP_ENGINE_DAEMON_COMPOSITOR`
2. **Auto-Detection**: Use `$WAYLAND_DISPLAY` and `$DISPLAY`
3. **Validation**: Verify backend compatibility
4. **Fallback**: Use compatible backend or error with clear message

## ⚠️ **Error Handling**

### **Backend-Compositor Incompatibility**

```bash
# This will fail gracefully with clear error message:
export WP_ENGINE_DAEMON_COMPOSITOR=x11
export WP_ENGINE_DAEMON_BACKEND_TYPE=swww
waypaper-daemon
# Error: backend 'swww' does not support X11 compositor

export WP_ENGINE_DAEMON_COMPOSITOR=wayland  
export WP_ENGINE_DAEMON_BACKEND_TYPE=feh
waypaper-daemon
# Error: backend 'feh' does not support Wayland compositor
```

### **Invalid Environment Variables**

- **Unknown variables**: Ignored silently
- **Invalid values**: Use TOML defaults as fallback
- **Type mismatches**: Converted with validation

## 🎯 **Best Practices**

### **Development/Debugging**

```bash
export WP_ENGINE_DAEMON_LOG_LEVEL=debug
export WP_ENGINE_DAEMON_COMPOSITOR=wayland
export WP_ENGINE_DAEMON_BACKEND_SWW_TRANSITION_DURATION=100
```

### **Production Troubleshooting**

```bash
export WP_ENGINE_DAEMON_LOG_FILE=/var/log/waypaper-daemon.log
export WP_ENGINE_DAEMON_LOG_MAX_SIZE=50
export WP_ENGINE_DAEMON_LOG_MAX_AGE=30
```

### **Testing Different Configurations**

```bash
export WP_ENGINE_DAEMON_DATABASE_PATH=/tmp/test-config.sqlite
export WP_ENGINE_DAEMON_SOCKET_PATH=/tmp/test-socket
export WP_ENGINE_DAEMON_IMAGES_DIR=/tmp/test-images
```

## 📁 **Configuration Precedence**

**Final precedence order:**
1. **Environment Variables** (highest precedence)
2. **Playlist-specific backend configuration**  
3. **TOML configuration file**
4. **Backend defaults** (lowest precedence)

This ensures:
- ✅ **Environment overrides for critical system settings**
- ✅ **TOML remains primary user configuration**  
- ✅ **Playlist overrides for specific use cases**
- ✅ **Backend defaults as safety net**

## 🔧 **Implementation Details**

### **Environment Variable Detection**

```go
// GetCompositorEnvironmentVariables returns all valid env vars
envVars := map[string]string{
    "DAEMON_COMPOSITOR":         "WP_ENGINE_DAEMON_COMPOSITOR",
    "DAEMON_LOG_LEVEL":          "WP_ENGINE_DAEMON_LOG_LEVEL", 
    "DAEMON_LOG_FILE":           "WP_ENGINE_DAEMON_LOG_FILE",
    "DAEMON_BACKEND_SWW_TRANSITION_DURATION": "WP_ENGINE_DAEMON_BACKEND_SWW_TRANSITION_DURATION",
    // ... etc
}

// Only these specific variables are honored
func GetCompositorEnvironmentOverrides() map[string]string {
    envOverrides := make(map[string]string)
    for configKey, envName := range envVars {
        if value := os.Getenv(envName); value != "" {
            envOverrides[configKey] = value
        }
    }
    return envOverrides
}
```

### **Backend Compatibility Checking**

```go
backend := backendManager.GetBackend("swww")
capabilities := backend.GetCapabilities()

// Check compositor compatibility
canUseSwww := capabilities.Compositor.Wayland && currentCompositor == "wayland"

if !canUseSwww {
    return fmt.Errorf("backend 'swww' does not support %s compositor", currentCompositor)
}
```

This configuration system provides powerful debugging capabilities while maintaining clean separation between system-level environment overrides and user-level TOML preferences.
