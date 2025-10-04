# Robust Logging Implementation for Waypaper Engine Daemon

## Table of Contents
1. [Executive Summary](#executive-summary)
2. [Current Logging Analysis](#current-logging-analysis)
3. [Enhanced Logging Architecture](#enhanced-logging-architecture)
4. [Implementation Plan](#implementation-plan)
5. [Configuration Options](#configuration-options)
6. [Performance Considerations](#performance-considerations)
7. [Testing Strategy](#testing-strategy)

---

## Executive Summary

This document outlines the implementation of a robust logging system for the Waypaper Engine daemon that provides comprehensive debugging capabilities, user-friendly error reporting, and flexible output options.

### Key Features
- 🎛️ **Environment-based verbosity control** (DEBUG, INFO, WARN, ERROR levels)
- 💾 **Flexible log output** (stdout, file, both, or disabled)
- 📊 **Structured logging** with context and metadata
- 🔍 **Easy debugging** with request tracing and performance metrics
- 📤 **User-friendly error reports** for issue reporting
- ⚡ **Performance optimized** with async logging and log rotation

---

## Current Logging Analysis

### Current State
The daemon currently uses Go's `log/slog` package with basic functionality:

```go
// Current logging in main.go
log := logger.New(slog.LevelDebug)
log.Info("Configuration loaded successfully", "databasePath", cfg.Daemon.DatabasePath)
```

### Limitations
- ❌ **Fixed verbosity**: Cannot adjust log levels at runtime
- ❌ **Limited output options**: Only stdout logging
- ❌ **No persistence**: Logs lost on restart/crash
- ❌ **Limited context**: Missing request traces, timestamps, performance data
- ❌ **Debugging difficulty**: Hard to trace issues across components
- ❌ **User support**: No way for users to share logs easily

---

## Enhanced Logging Architecture

### Logging Levels

| Level | Use Case | Example |
|-------|-----------|---------|
| **DEBUG** | Detailed execution flow | `backend.go:45: Selecting backend 'swww' for media type 'image'` |
| **INFO** | Normal operations | `playlist_manager.go:120: Starting playlist 'nature-images' on DP-1` |
| **WARN** | Non-critical issues | `backend.go:78: Backend 'mpv' not available, falling back to 'swww'` |
| **ERROR** | Errors that don't crash daemon | `image_processor.go:95: Failed to resize image: permission denied` |
| **FATAL** | Critical errors (daemon exit) | `database.go:23: Cannot initialize database: corrupted file` |

### Structured Logging Format

#### JSON Log Entry Structure
```json
{
  "timestamp": "2024-01-15T16:45:23.123Z",
  "level": "INFO",
  "component": "playlist_manager",
  "function": "StartPlaylist",
  "message": "Starting playlist",
  "requestId": "req-7f8a2b1c-4d5e-6f7g-8h9i-0j1k2l3m4n5o",
  "sessionId": "session-abc-123",
  "metadata": {
    "playlistName": "nature-images",
    "monitorName": "DP-1",
    "playlistType": "timer",
    "totalImages": 47,
    "backend": "swww"
  },
  "performance": {
    "duration": "12ms",
    "memoryUsage": "45MB"
  }
}
```

#### Human-Readable Format
```
2024-01-15 16:45:23.123 [INFO] [playlist_manager.StartPlaylist] Starting playlist
    Request: req-7f8a2b1c-4d5e-6f7g-8h9i-0j1k2l3m4n5o
    Playlist: nature-images | Monitor: DP-1 | Backend: swww | Images: 47
    Duration: 12ms | Memory: 45MB
```

### Component-Based Logging

```go
// Enhanced logger with component tracking
type ComponentLogger struct {
    component   string
    requestID   string
    sessionID   string
    baseLogger  func(string, ...any)
}

// Usage example
func (pm *PlaylistManager) StartPlaylist(ctx context.Context, playlistName string, monitor *Monitor) error {
    log := pm.logger.WithComponent("playlist_manager").
                     WithRequest(reqID).
                     WithMetadata(map[string]any{
                         "playlistName": playlistName,
                         "monitorName": monitor.Name,
                     })
    
    log.Info("Starting playlist")
    
    // Select backend
    backend, err := pm.selectBackend(playlistName)
    if err != nil {
        log.Error("Failed to select backend", "error", err)
        return err
    }
    
    log.Info("Backend selected", "backend", backend.GetType())
    
    // Implementation...
    log.Info("Playlist started successfully", "duration", time.Since(start))
    
    return nil
}
```

---

## Implementation Plan

### Phase 1: Enhanced Logger Infrastructure

#### 1. Create Advanced Logger Interface
```go
// internal/logger/advanced_logger.go
package logger

import (
    "context"
    "encoding/json"
    "fmt"
    "os"
    "path/filepath"
    "sync"
    "time"
    
    "log/slog"
)

type LogLevel string
const (
    LevelDebug LogLevel = "DEBUG"
    LevelInfo  LogLevel = "INFO"
    LevelWarn  LogLevel = "WARN"
    LevelError LogLevel = "ERROR"
    LevelFatal LogLevel = "FATAL"
)

type LogOutput int
const (
    OutputStdout LogOutput = iota
    OutputFile
    OutputBoth
    OutputDisabled
)

type AdvancedLogger struct {
    level       LogLevel
    output      LogOutput
    filePath    string
    components  map[string]*ComponentLogger
    mu          sync.RWMutex
    
    // Performance tracking
    metrics     *LogMetrics
    
    // Async writing
    logQueue    chan LogEntry
    quit        chan bool
    wg          sync.WaitGroup
}

type ComponentLogger struct {
    component string
    logger    *AdvancedLogger
    baseMeta  map[string]any
}

func NewAdvancedLogger(config LogConfig) (*AdvancedLogger, error) {
    logger := &AdvancedLogger{
        level:      config.Level,
        output:     config.Output,
        filePath:   config.FilePath,
        components: make(map[string]*ComponentLogger),
        metrics:    NewLogMetrics(),
        logQueue:   make(chan LogEntry, 1000),
        quit:       make(chan bool),
    }
    
    // Start async log writer
    go logger.startAsyncWriter()
    
    return logger, nil
}

func (l *AdvancedLogger) WithComponent(component string) *ComponentLogger {
    l.mu.RLock()
    if cl, exists := l.components[component]; exists {
        l.mu.RUnlock()
        return cl
    }
    l.mu.RUnlock()
    
    l.mu.Lock()
    defer l.mu.Unlock()
    
    cl := &ComponentLogger{
        component: component,
        logger:    l,
        baseMeta:  make(map[string]any),
    }
    l.components[component] = cl
    
    return cl
}

func (cl *ComponentLogger) Info(msg string, meta ...any) {
    cl.log(LevelInfo, msg, meta...)
}

func (cl *ComponentLogger) Warn(msg string, meta ...any) {
    cl.log(LevelWarn, msg, meta...)
}

func (cl *ComponentLogger) Error(msg string, meta ...any) {
    cl.log(LevelError, msg, meta...)
}

func (cl *ComponentLogger) Debug(msg string, meta ...any) {
    cl.log(LevelDebug, msg, meta...)
}

func (cl *ComponentLogger) Fatal(msg string, meta ...any) {
    cl.log(LevelFatal, msg, meta...)
    os.Exit(1)
}

func (cl *ComponentLogger) log(level LogLevel, msg string, meta ...any) {
    // Build metadata from component + provided metadata
    metadata := make(map[string]any)
    for k, v := range cl.baseMeta {
        metadata[k] = v
    }
    
    // Add provided metadata
    for i := 0; i < len(meta); i += 2 {
        if i+1 < len(meta) {
            metadata[fmt.Sprintf("%v", meta[i])] = meta[i+1]
        }
    }
    
    entry := LogEntry{
        Timestamp: time.Now(),
        Level:     level,
        Component: cl.component,
        Message:   msg,
        Metadata:  metadata,
    }
    
    cl.logger.enqueue(entry)
}
```

#### 2. Environment Variable Configuration
```go
// Configuration from environment variables
type LogConfig struct {
    Level      LogLevel   `env:"WAYPAPER_LOG_LEVEL" default:"INFO"`
    Output     LogOutput  `env:"WAYPAPER_LOG_OUTPUT" default:"stdout"`
    FilePath   string     `env:"WAYPAPER_LOG_FILE" default:""`
    MaxSize    string     `env:"WAYPAPER_LOG_MAX_SIZE" default:"100MB"`
    MaxAge     string     `env:"WAYPAPER_LOG_MAX_AGE" default:"7d"`
    Compress   bool       `env:"WAYPAPER_COMMPRESS" default:"true"`
}

// Environment variable mapping
func LoadLogConfig() LogConfig {
    config := LogConfig{
        Level:    LogLevel(os.Getenv("WAYPAPER_LOG_LEVEL")),
        Output:   parseOutput(os.Getenv("WAYPAPER_LOG_OUTPUT")),
        FilePath: config.validateLogFilePath(),
        MaxSize:  os.Getenv("WAYPAPER_LOG_MAX_SIZE"),
        MaxAge:   os.Getenv("WAYPAPER_LOG_MAX_AGE"),
        Compress: strings.ToLower(os.Getenv("WAYPAPER_LOG_COMPRESS")) == "true",
    }
    
    config.validate()
    return config
}
```

### Phase 2: Backend Detection and Logging

#### 1. Backend Scanner
```go
// internal/backend/scanner.go
package backend

import (
    "log/slog"
    "os/exec"
    "strings"
)

type BackendScanner struct {
    logger *slog.Logger
    cache  map[BackendType]bool
}

func NewBackendScanner(logger *slog.Logger) *BackendScanner {
    return &BackendScanner{
        logger: logger,
        cache:  make(map[BackendType]bool),
    }
}

func (bs *BackendScanner) ScanAvailableBackends() map[BackendType]BackendInfo {
    available := make(map[BackendType]BackendInfo)
    
    backendsToCheck := []BackendType{
        BackendSwww,
        BackendFeh,
        BackendNitrogen,
        BackendMpv,
        BackendElectron,
        BackendWebGL,
    }
    
    for _, backendType := range backendsToCheck {
        info := bs.checkBackend(backendType)
        if info.Available {
            available[backendType] = info
            bs.logger.Info("Backend available", 
                "backend", backendType, 
                "version", info.Version,
                "features", info.Features)
        } else {
            bs.logger.Debug("Backend not available", 
                "backend", backendType, 
                "reason", info.UnavailableReason)
        }
    }
    
    // Log critical errors if no suitable backends found
    bs.validateMinimumBackends(available)
    
    return available
}

func (bs *BackendScanner) checkBackend(backendType BackendType) BackendInfo {
    cmd, args := bs.getBackendCommand(backendType)
    
    info := BackendInfo{
        Type:      backendType,
        Available: false,
    }
    
    // Check if command exists in PATH
    if _, err := exec.LookPath(cmd); err != nil {
        info.UnavailableReason = fmt.Sprintf("Command '%s' not found in PATH", cmd)
        return info
    }
    
    // Try to get version info
    versionCmd := exec.Command(cmd, args...)
    output, err := versionCmd.Output()
    if err != nil {
        info.UnavailableReason = fmt.Sprintf("Command failed: %v", err)
        return info
    }
    
    info.Available = true
    info.Version = strings.TrimSpace(string(output))
    info.Features = bs.detectFeatures(backendType)
    
    return info
}

func (bs *BackendScanner) validateMinimumBackends(available map[BackendType]BackendInfo) {
    // Check for minimum requirements
    hasImageBackend := false
    hasVideoBackend := false
    
    for backendType, info := range available {
        caps := info.Capabilities
        for _, mediaType := range caps.MediaCapabilities.SupportedTypes {
            if mediaType == "image" {
                hasImageBackend = true
            }
            if mediaType == "video" {
                hasVideoBackend = true
            }
        }
    }
    
    if !hasImageBackend {
        bs.logger.Error("No image backend available! Unable to display wallpapers",
            "available", getAvailableBackendNames(available),
            "help", "Install swww, feh, or nitrogen")
    }
    
    if !hasVideoBackend {
        bs.logger.Warn("No video backend available - video wallpapers will not work",
            "help", "Install mpv or vlc for video support")
    }
}
```

#### 2. Startup Validation with Detailed Logging
```go
// Enhanced main.go startup sequence
func main() {
    // Initialize advanced logger first
    logConfig := logger.LoadLogConfig()
    advLogger, err := logger.NewAdvancedLogger(logConfig)
    if err != nil {
        fmt.Fprintf(os.Stderr, "Failed to initialize logger: %v\n", err)
        os.Exit(1)
    }
    
    log := advLogger.WithComponent("daemon")
    log.Info("Starting Waypaper Engine Daemon", 
        "version", version.Version,
        "commit", version.Commit,
        "buildTime", version.BuildTime)
    
    // Scan available backends
    scanner := backend.NewBackendScanner(advLogger.WithComponent("backend_scanner").logger)
    availableBackends := scanner.ScanAvailableBackends()
    
    log.Info("Backend scan complete", 
        "available", len(availableBackends),
        "total_checked", len(allBackendTypes),
        "backends", getAvailableBackendNames(availableBackends))
    
    // Validate configuration with logs
    if err := validateConfig(cfg, availableBackends, log); err != nil {
        log.Error("Configuration validation failed", "error", err)
        os.Exit(1)
    }
    
    // Continue with normal startup...
}
```

### Phase 3: Debug and Support Features

#### 1. Debug Mode Enhancement
```go
// Debug mode with enhanced logging
func enableDebugMode(logger *AdvancedLogger) {
    if os.Getenv("WAYPAPER_DEBUG") == "true" {
        logger.SetLevel(logger.LevelDebug)
        logger.EnablePerformanceMetrics(true)
        
        // Add debug-specific metadata to all logs
        logger.AddGlobalMetadata(map[string]any{
            "debug_mode": true,
            "debug_session": uuid.New().String(),
            "system_info": getSystemInfo(),
        })
    }
}

func (logger *AdvancedLogger) EnablePerformanceMetrics(enabled bool) {
    logger.metrics.Enabled = enabled
    if enabled {
        logger.AddGlobalMetadata(map[string]any{
            "performance_tracking": true,
        })
    }
}
```

#### 2. User Support Features
```go
// Generate user-friendly error reports
func (logger *AdvancedLogger) GenerateSupportReport() (*SupportReport, error) {
    report := &SupportReport{
        GeneratedAt: time.Now(),
        Version:     version.Version,
        SystemInfo:  getSystemInfo(),
        Logs:        logger.getRecentLogs(500), // Last 500 log entries
        Config:      getSanitizedConfig(),
        Backends:    scanner.GetAvailableBackends(),
        Errors:      logger.metrics.GetErrorSummary(),
    }
    
    return report, nil
}

// Function to save logs for user support
func (logger *AdvancedLogger) SaveLogsForSupport(outputPath string) error {
    report, err := logger.GenerateSupportReport()
    if err != nil {
        return err
    }
    
    data, err := json.MarshalIndent(report, "", "  ")
    if err != nil {
        return err
    }
    
    return os.WriteFile(outputPath, data, 0644)
}
```

---

## Configuration Options

### Environment Variables

| Variable | Values | Default | Description |
|----------|---------|---------|-------------|
| `WAYPAPER_LOG_LEVEL` | DEBUG, INFO, WARN, ERROR, FATAL | INFO | Logging verbosity level |
| `WAYPAPER_LOG_OUTPUT` | stdout, file, both, disabled | stdout | Where to output logs |
| `WAYPAPER_LOG_FILE` | `/path/to/logfile` | "" | Log file path (used if output=file/both) |
| `WAYPAPER_LOG_MAX_SIZE` | 100MB, 50GB, etc. | 100MB | Maximum log file size |
| `WAYPAPER_LOG_MAX_AGE` | 7d, 30d, etc. | 7d | How long to keep log files |
| `WAYPAPER_LOG_COMPRESS` | true, false | true | Compress rotated log files |
| `WAYPAPER_DEBUG` | true, false | false | Enable debug mode (sets verbose logging) |
| `WAYPAPER_PERFORMANCE_LOGGING` | true, false | false | Enable performance metrics |

### Command Line Flags

```bash
# Environment variable approach (recommended)
WAYPAPER_LOG_LEVEL=DEBUG WAYPAPER_LOG_FILE=/tmp/waypaper.log waypaper-daemon

# Direct logging flags (alternative)
waypaper-daemon --log-level=DEBUG --log-file=/tmp/waypaper.log --log-stdout=true

# Debug mode with comprehensive logging
WAYPAPER_DEBUG=true WAYPAPER_LOG_OUTPUT=both WAYPAPER_LOG_FILE=/tmp/debug.log waypaper-daemon
```

### Example Usage Scenarios

#### Development/Debugging
```bash
export WAYPAPER_LOG_LEVEL=DEBUG
export WAYPAPER_LOG_OUTPUT=both
export WAYPAPER_LOG_FILE=/tmp/waypaper-debug.log
export WAYPAPER_PERFORMANCE_LOGGING=true
waypaper-daemon
```

#### Production
```bash
export WAYPAPER_LOG_LEVEL=INFO
export WAYPAPER_LOG_OUTPUT=file
export WAYPAPER_LOG_FILE=/var/log/waypaper-daemon.log
export WAYPAPER_LOG_MAX_SIZE=50MB
export WAYPAPER_LOG_MAX_AGE=30d
waypaper-daemon
```

#### User Support
```bash
# Generate comprehensive support report
waypaper-daemon --generate-support-report=/tmp/support-report.json

# Run with verbose logging for issue reproduction
WAYPAPER_LOG_LEVEL=DEBUG WAYPAPER_LOG_FILE=/tmp/support-logs.json waypaper-daemon
```

---

## Performance Considerations

### Asynchronous Logging
- ✅ **Non-blocking**: Log writes don't block main operations
- ✅ **Buffered**: Batch writes for better performance
- ✅ **Queue-based**: Prevent log writes from impacting daemon speed

### Log Rotation
- 📦 **Size-based**: Rotate when file exceeds max size
- 📅 **Time-based**: Rotate daily/weekly/monthly
- 🗜️ **Compression**: Compress old logs to save space
- 🗑️ **Cleanup**: Remove logs older than max age

### Memory Management
- 🎯 **Bounded queue**: Prevent memory leaks from unbounded logging
- 📊 **Metadata limits**: Limit metadata size per log entry
- 🔄 **Streaming**: Stream large logs without loading into memory

---

## Testing Strategy

### Unit Tests
```go
func TestAdvancedLogger(t *testing.T) {
    // Test different log levels
    // Test component separation  
    // Test metadata handling
    // Test async writing
    // Test log rotation
}

func TestBackendScanner(t *testing.T) {
    // Test backend detection
    // Test capability reporting
    // Test fallback mechanisms
    // Test error handling
}
```

### Integration Tests
```go
func TestLoggingIntegration(t *testing.T) {
    // Test full startup sequence with logging
    // Test error scenarios and logging
    // Test support report generation
    // Test log rotation under load
}
```

### Performance Tests
```go
func BenchmarkLoggingPerformance(t *testing.B) {
    // Benchmark async logging performance
    // Benchmark log rotation overhead
    // Benchmark memory usage
    // Benchmark with large metadata
}
```

---

## Implementation Timeline

| Week | Phase | Deliverables |
|------|-------|--------------|
| **1** | Core Logger | Advanced logger infrastructure, async writing |
| **2** | Backend Detection | Backend scanner, startup validation |
| **3** | Configuration | Environment variables, command flags |
| **4** | Performance | Log rotation, optimization, testing |
| **5** | Support Features | Support reports, debug modes |
| **6** | Documentation | User guides, troubleshooting tips |

---

## Conclusion

This robust logging implementation provides:

✅ **Comprehensive debugging** with structured, contextual logs
✅ **User-friendly support** with easy log sharing and issue reporting  
✅ **Performance optimized** with async logging and rotation
✅ **Flexible configuration** via environment variables
✅ **Backend validation** with startup checking and fallback detection
✅ **Production ready** with proper error handling and monitoring

The enhanced logging will be invaluable for debugging the multi-media backend system and SQLite-to-JSON migration, providing clear visibility into system behavior and making user support much more effective.
