# Post-Migration Improvements Plan

**Author:** AI Assistant  
**Date:** 2025-09-28  
**Status:** Proposed  

## Overview

This document outlines the improvements and enhancements to be made to the Go daemon after the initial migration is complete. These changes will make the daemon more ergonomic, scalable, and production-ready.

## 1. API Design Improvements

### Current API Issues

The current IPC API has several ergonomic problems:

1. **Inconsistent Command Structure**: Some commands require `playlistId`, others require `activeMonitor`, creating confusion
2. **Mixed Responsibilities**: Commands like `get_images` and `get_playlists` are data queries, not actions
3. **No Bulk Operations**: Missing "all monitors" variants of commands
4. **Poor Error Handling**: Generic error responses without context
5. **No Request/Response Correlation**: Hard to match responses to requests

### Proposed API Redesign

#### 1.1 RESTful Command Structure

```json
{
  "id": "req-123",
  "method": "playlist.start",
  "params": {
    "playlistId": 123,
    "monitor": "DP-1"
  }
}
```

#### 1.2 Method Categories

**Playlist Management:**
- `playlist.start` - Start playlist on monitor
- `playlist.stop` - Stop playlist on monitor
- `playlist.pause` - Pause playlist on monitor
- `playlist.resume` - Resume playlist on monitor
- `playlist.stopAll` - Stop all playlists
- `playlist.pauseAll` - Pause all playlists
- `playlist.resumeAll` - Resume all playlists

**Image Navigation:**
- `image.next` - Next image on monitor
- `image.previous` - Previous image on monitor
- `image.random` - Random image on monitor
- `image.set` - Set specific image on monitor
- `image.nextAll` - Next image on all monitors
- `image.previousAll` - Previous image on all monitors
- `image.randomAll` - Random image on all monitors

**Data Queries:**
- `data.getImages` - Get all images with optional filters
- `data.getPlaylists` - Get all playlists with images
- `data.getMonitors` - Get available monitors
- `data.getInfo` - Get system information
- `data.getImageHistory` - Get image history

**Configuration:**
- `config.get` - Get configuration value
- `config.set` - Set configuration value
- `config.reload` - Reload configuration from files

#### 1.3 Response Structure

```json
{
  "id": "req-123",
  "result": {
    "success": true,
    "data": { /* response data */ }
  },
  "error": null
}
```

#### 1.4 Event Structure

```json
{
  "type": "playlist.started",
  "data": {
    "playlistId": 123,
    "playlistName": "My Playlist",
    "monitor": "DP-1",
    "timestamp": "2025-09-28T17:00:00Z"
  }
}
```

### 1.5 Implementation Plan

1. **Phase 1**: Redesign IPC protocol with new command structure
2. **Phase 2**: Implement request/response correlation
3. **Phase 3**: Add bulk operations
4. **Phase 4**: Improve error handling and validation
5. **Phase 5**: Add API versioning support

## 2. Configuration Management Overhaul

### 2.1 Move Configuration to JSON Files

**Current State**: Configuration stored in database  
**Target State**: Configuration in JSON files with database as cache

#### 2.1.1 Configuration File Structure

```
~/.waypaper-engine/
├── config/
│   ├── app.json          # Application settings
│   ├── swww.json         # Swww daemon settings
│   ├── monitors.json     # Monitor configurations
│   └── playlists.json    # Playlist configurations
├── data/
│   └── waypaper.db       # SQLite database (images, history only)
└── cache/
    ├── thumbnails/       # Generated thumbnails
    └── processed/        # Processed images
```

#### 2.1.2 App Configuration (`app.json`)

```json
{
  "version": "1.0.0",
  "daemon": {
    "socketPath": "/tmp/waypaper-engine.sock",
    "lockFile": "/tmp/waypaper-daemon.lock",
    "pidFile": "/tmp/waypaper-daemon.pid",
    "logLevel": "info",
    "logFile": "~/.waypaper-engine/logs/daemon.log"
  },
  "ui": {
    "notifications": true,
    "startMinimized": false,
    "minimizeInsteadOfClose": true,
    "imagesPerPage": 20,
    "showMonitorModalOnStart": true
  },
  "playlists": {
    "defaultInterval": 5,
    "defaultOrder": "ordered",
    "showAnimations": true,
    "alwaysStartOnFirstImage": false
  },
  "images": {
    "supportedFormats": ["jpg", "jpeg", "png", "gif", "webp", "bmp"],
    "maxFileSize": "50MB",
    "thumbnailSize": 256,
    "cacheSize": "1GB"
  },
  "scripts": {
    "enabled": true,
    "directory": "~/.waypaper-engine/scripts",
    "timeout": 30
  }
}
```

#### 2.1.3 Swww Configuration (`swww.json`)

```json
{
  "version": "1.0.0",
  "resizeType": "fit",
  "fillColor": "#000000",
  "filterType": "Lanczos3",
  "transitionType": "fade",
  "transitionStep": 90,
  "transitionDuration": 200,
  "transitionFPS": 60,
  "transitionAngle": 0,
  "transitionPositionType": "alias",
  "transitionPosition": "center",
  "transitionPositionIntX": 0,
  "transitionPositionIntY": 0,
  "transitionPositionFloatX": 0.5,
  "transitionPositionFloatY": 0.5,
  "invertY": false,
  "transitionBezier": "0.25,0.1,0.25,1",
  "transitionWaveX": 20,
  "transitionWaveY": 20
}
```

#### 2.1.4 Monitor Configuration (`monitors.json`)

```json
{
  "version": "1.0.0",
  "monitors": [
    {
      "name": "DP-1",
      "enabled": true,
      "primary": true,
      "extendAcrossMonitors": false,
      "duplicateOnAllMonitors": false,
      "customSettings": {
        "resizeType": "crop",
        "transitionType": "simple"
      }
    }
  ],
  "defaultBehavior": {
    "extendAcrossMonitors": false,
    "duplicateOnAllMonitors": false
  }
}
```

### 2.2 Configuration Management Features

#### 2.2.1 Hot Reloading
- Watch configuration files for changes
- Reload configuration without restarting daemon
- Validate configuration before applying
- Rollback on validation errors

#### 2.2.2 Configuration Validation
- JSON schema validation
- Value range checking
- Dependency validation
- Migration support for version changes

#### 2.2.3 Configuration API
```json
{
  "method": "config.get",
  "params": {
    "key": "daemon.logLevel"
  }
}

{
  "method": "config.set", 
  "params": {
    "key": "daemon.logLevel",
    "value": "debug"
  }
}

{
  "method": "config.reload",
  "params": {}
}
```

## 3. Database Import/Export System

### 3.1 Export Format

```json
{
  "version": "1.0.0",
  "exportedAt": "2025-09-28T17:00:00Z",
  "data": {
    "images": [
      {
        "id": 1,
        "name": "image1.jpg",
        "path": "/path/to/image1.jpg",
        "width": 1920,
        "height": 1080,
        "format": "jpeg",
        "rating": 5,
        "isChecked": true,
        "isSelected": false,
        "time": null
      }
    ],
    "playlists": [
      {
        "id": 1,
        "name": "My Playlist",
        "type": "timer",
        "interval": 5,
        "showAnimations": true,
        "alwaysStartOnFirstImage": false,
        "order": "ordered",
        "currentImageIndex": 0,
        "images": [1, 2, 3]
      }
    ],
    "imageHistory": [
      {
        "imageId": 1,
        "monitor": "DP-1",
        "setAt": "2025-09-28T16:30:00Z"
      }
    ]
  }
}
```

### 3.2 Import/Export API

```json
{
  "method": "data.export",
  "params": {
    "format": "json",
    "includeImages": true,
    "includePlaylists": true,
    "includeHistory": true
  }
}

{
  "method": "data.import",
  "params": {
    "data": { /* export data */ },
    "merge": true,
    "backup": true
  }
}
```

### 3.3 Implementation Features

- **Incremental Export**: Export only changed data since last export
- **Compression**: Support for compressed exports
- **Validation**: Validate import data before applying
- **Backup**: Automatic backup before import
- **Merge Strategy**: Handle conflicts during import
- **Progress Tracking**: Real-time import/export progress

## 4. Daemon Locking Mechanism

### 4.1 Lock File Implementation

```go
type DaemonLock struct {
    PID     int       `json:"pid"`
    Started time.Time `json:"started"`
    Version string    `json:"version"`
    Socket  string    `json:"socket"`
}
```

### 4.2 Lock Management Features

- **PID Validation**: Check if locked PID is still running
- **Stale Lock Cleanup**: Remove locks from dead processes
- **Lock Timeout**: Automatic lock expiration
- **Graceful Shutdown**: Proper lock cleanup on exit
- **Lock Status API**: Check daemon status

### 4.3 Lock API

```json
{
  "method": "daemon.status",
  "params": {}
}

{
  "method": "daemon.lock",
  "params": {
    "timeout": 30
  }
}

{
  "method": "daemon.unlock",
  "params": {}
}
```

## 5. Additional Improvements

### 5.1 Logging and Monitoring

- **Structured Logging**: JSON-formatted logs
- **Log Rotation**: Automatic log file rotation
- **Log Levels**: Configurable log levels
- **Metrics**: Performance and usage metrics
- **Health Checks**: Daemon health monitoring

### 5.2 Performance Optimizations

- **Connection Pooling**: Database connection pooling
- **Image Caching**: Intelligent image caching
- **Lazy Loading**: Load images on demand
- **Memory Management**: Efficient memory usage
- **Concurrent Processing**: Parallel image processing

### 5.3 Security Enhancements

- **Socket Permissions**: Secure socket file permissions
- **Input Validation**: Comprehensive input validation
- **Rate Limiting**: API rate limiting
- **Audit Logging**: Security event logging

### 5.4 Developer Experience

- **API Documentation**: OpenAPI/Swagger documentation
- **SDK Generation**: Generate client SDKs
- **Testing Tools**: Built-in testing utilities
- **Debug Mode**: Enhanced debugging capabilities

## 6. Implementation Timeline

### Phase 1: API Redesign (Week 1)
- [ ] Implement new command structure
- [ ] Add request/response correlation
- [ ] Update all existing commands
- [ ] Add comprehensive error handling

### Phase 2: Configuration Management (Week 2)
- [ ] Move configuration to JSON files
- [ ] Implement hot reloading
- [ ] Add configuration validation
- [ ] Create configuration API

### Phase 3: Database Import/Export (Week 3)
- [ ] Implement export functionality
- [ ] Implement import functionality
- [ ] Add validation and backup
- [ ] Create import/export API

### Phase 4: Daemon Locking (Week 4)
- [ ] Implement lock file mechanism
- [ ] Add PID validation
- [ ] Implement graceful shutdown
- [ ] Add lock status API

### Phase 5: Additional Features (Week 5-6)
- [ ] Enhanced logging and monitoring
- [ ] Performance optimizations
- [ ] Security enhancements
- [ ] Developer experience improvements

## 7. Migration Strategy

### 7.1 Backward Compatibility
- Maintain old API during transition period
- Provide migration tools for existing clients
- Gradual deprecation of old endpoints

### 7.2 Configuration Migration
- Create migration script for database configs
- Validate migrated configurations
- Provide rollback mechanism

### 7.3 Testing Strategy
- Comprehensive integration tests
- Performance benchmarking
- Security testing
- User acceptance testing

## 8. Success Metrics

- **API Usability**: Reduced client code complexity
- **Performance**: 50% faster response times
- **Reliability**: 99.9% uptime
- **Maintainability**: Reduced configuration complexity
- **Developer Experience**: Faster development cycles

---

This post-migration plan will transform the Go daemon from a basic replacement into a robust, scalable, and user-friendly system that exceeds the capabilities of the original Node.js implementation.
