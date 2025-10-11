# Monitor Implementation Migration Plan

## Overview

This document outlines the migration from the current compositor-specific monitor detection system to the new low-level Wayland protocol implementation in `monitor_new.go`.

## Current Implementation Issues

### Problems with Current System
- **Compositor Dependency**: Relies on specific compositor commands (`hyprctl`, `swaymsg`, `xrandr`)
- **Fragility**: Breaks when compositors change their APIs or output format
- **Limited Coverage**: Only supports Hyprland, Sway, GNOME, KDE, and X11
- **Performance**: Spawns external processes for each monitor query
- **Limited Data**: Only gets basic resolution and position information
- **No Real-time Events**: Polls every 5 seconds instead of event-driven updates

### Benefits of New Implementation
- **Compositor Agnostic**: Works with any Wayland compositor
- **Rich Data**: Gets make, model, refresh rate, scale, transform, physical dimensions
- **Performance**: Direct protocol access, no external processes
- **Real-time Events**: Event-driven monitor change detection
- **Reliability**: Direct Wayland protocol access vs. parsing command output

## Migration Strategy

### Phase 1: Model Updates
1. **Update Monitor Models**
   - Extend `models.Monitor` to include new fields from `MonitorInfo`
   - Add backward compatibility for existing data
   - Update JSON serialization/deserialization

2. **Create Adapter Layer**
   - Create conversion functions between old and new monitor types
   - Ensure existing code continues to work during transition

### Phase 2: Core Implementation Migration
1. **Replace Compositor Detection**
   - Remove `compositor.go` dependency
   - Update `manager.go` to use new `MonitorManager`
   - Implement fallback for X11 systems

2. **Integrate Event System**
   - Replace polling-based monitor detection with event-driven system
   - Update monitor change callbacks to use new event system
   - Implement proper cleanup and resource management

### Phase 3: Testing and Validation
1. **Compatibility Testing**
   - Test with different Wayland compositors
   - Verify backward compatibility with existing configurations
   - Performance testing and optimization

2. **Integration Testing**
   - Test monitor selection functionality
   - Verify wallpaper setting across different monitor configurations
   - Test monitor hotplugging scenarios

## Detailed Implementation Steps

### Step 1: Update Models (`models/monitor.go`)

```go
// Enhanced Monitor struct with new fields
type Monitor struct {
    Name           string   `json:"name"`
    Make           string   `json:"make,omitempty"`
    Model          string   `json:"model,omitempty"`
    Width          int      `json:"width"`
    Height         int      `json:"height"`
    RefreshRate    float64  `json:"refreshRate,omitempty"`
    Scale          int32    `json:"scale,omitempty"`
    Transform      int32    `json:"transform,omitempty"`
    PhysicalWidth  int32    `json:"physicalWidth,omitempty"`
    PhysicalHeight int32    `json:"physicalHeight,omitempty"`
    CurrentImage   string   `json:"currentImage"`
    Position       Position `json:"position"`
}
```

### Step 2: Create Adapter Functions

```go
// Convert MonitorInfo to models.Monitor
func MonitorInfoToModel(info MonitorInfo) models.Monitor {
    return models.Monitor{
        Name:          info.Name,
        Make:          info.Make,
        Model:         info.Model,
        Width:         int(info.Width),
        Height:        int(info.Height),
        RefreshRate:   info.RefreshRate,
        Scale:         info.Scale,
        Transform:     info.Transform,
        PhysicalWidth: info.PhysicalWidth,
        PhysicalHeight: info.PhysicalHeight,
        Position:      models.Position{X: int(info.X), Y: int(info.Y)},
    }
}

// Convert models.Monitor to MonitorInfo
func ModelToMonitorInfo(model models.Monitor) MonitorInfo {
    return MonitorInfo{
        Name:           model.Name,
        Make:           model.Make,
        Model:          model.Model,
        Width:          int32(model.Width),
        Height:         int32(model.Height),
        RefreshRate:    model.RefreshRate,
        Scale:          model.Scale,
        Transform:      model.Transform,
        PhysicalWidth:  model.PhysicalWidth,
        PhysicalHeight: model.PhysicalHeight,
        X:              int32(model.Position.X),
        Y:              int32(model.Position.Y),
    }
}
```

### Step 3: Update Manager Implementation

```go
// Enhanced Manager with new MonitorManager integration
type Manager struct {
    // ... existing fields ...
    
    // New Wayland-based monitor manager
    waylandManager *MonitorManager
    
    // Event handling
    monitorEvents chan MonitorEvent
    eventHandler  func([]models.Monitor)
}

// New initialization method
func (m *Manager) StartWithWayland(ctx context.Context, imagesDir, thumbnailsDir, monitorsStateFile string) error {
    // Initialize Wayland monitor manager
    waylandManager, err := NewMonitorManager()
    if err != nil {
        return fmt.Errorf("failed to create Wayland monitor manager: %w", err)
    }
    
    m.waylandManager = waylandManager
    
    // Set up event handling
    m.monitorEvents = make(chan MonitorEvent, 10)
    go m.handleMonitorEvents(ctx)
    
    // Start monitoring
    m.waylandManager.Start()
    
    // Get initial monitors
    monitors := m.waylandManager.GetMonitors()
    m.updateMonitorsFromWayland(monitors)
    
    return nil
}

// Event handler for monitor changes
func (m *Manager) handleMonitorEvents(ctx context.Context) {
    for {
        select {
        case <-ctx.Done():
            return
        case event := <-m.waylandManager.Events():
            m.processMonitorEvent(event)
        }
    }
}

// Process individual monitor events
func (m *Manager) processMonitorEvent(event MonitorEvent) {
    m.mutex.Lock()
    defer m.mutex.Unlock()
    
    switch event.Type {
    case MonitorAdded:
        m.logger.Info("Monitor added", "name", event.Monitor.Name)
        m.addMonitor(event.Monitor)
    case MonitorRemoved:
        m.logger.Info("Monitor removed", "name", event.Monitor.Name)
        m.removeMonitor(event.Monitor.Name)
    case MonitorChanged:
        m.logger.Info("Monitor changed", "name", event.Monitor.Name)
        m.updateMonitor(event.Monitor)
    }
    
    // Notify callback if set
    if m.eventHandler != nil {
        monitors := m.GetMonitors()
        go m.eventHandler(monitors)
    }
}
```

### Step 4: Fallback Implementation

```go
// Fallback for X11 or when Wayland is not available
func (m *Manager) refreshMonitorsWithFallback(ctx context.Context) error {
    // Try Wayland first
    if m.waylandManager != nil {
        monitors := m.waylandManager.GetMonitors()
        if len(monitors) > 0 {
            m.updateMonitorsFromWayland(monitors)
            return nil
        }
    }
    
    // Fallback to compositor-specific detection
    return m.refreshMonitors(ctx) // Existing implementation
}
```

### Step 5: Update Monitor Name Generation

```go
// Enhanced monitor name generation
func generateMonitorName(info MonitorInfo) string {
    if info.Make != "" && info.Model != "" {
        return fmt.Sprintf("%s %s", info.Make, info.Model)
    }
    
    // Fallback to existing naming scheme
    return fmt.Sprintf("Monitor-%dx%d", info.Width, info.Height)
}
```

## Testing Strategy

### Unit Tests
1. **MonitorInfo Conversion Tests**
   - Test conversion between old and new monitor types
   - Verify data integrity during conversion
   - Test edge cases (missing fields, invalid data)

2. **Event System Tests**
   - Test monitor add/remove/change events
   - Verify event ordering and timing
   - Test event cleanup and resource management

### Integration Tests
1. **Compositor Compatibility**
   - Test with Hyprland, Sway, GNOME, KDE
   - Verify fallback to X11 works correctly
   - Test with multiple monitor configurations

2. **Real-world Scenarios**
   - Monitor hotplugging during daemon runtime
   - Resolution changes
   - Monitor reordering
   - Mixed monitor types (different scales, refresh rates)

### Performance Tests
1. **Monitor Detection Performance**
   - Compare startup time: old vs new implementation
   - Measure memory usage
   - Test with many monitors (10+)

2. **Event Response Time**
   - Measure time from monitor change to event delivery
   - Test event throughput under load

## Rollback Plan

### If Issues Arise
1. **Feature Flag**: Add configuration option to use old implementation
2. **Gradual Rollout**: Deploy to subset of users first
3. **Monitoring**: Add metrics to track success/failure rates
4. **Quick Rollback**: Keep old implementation as fallback

### Rollback Implementation
```go
type Manager struct {
    // ... existing fields ...
    useNewImplementation bool
}

func (m *Manager) refreshMonitors(ctx context.Context) error {
    if m.useNewImplementation {
        return m.refreshMonitorsWithWayland(ctx)
    }
    return m.refreshMonitorsWithCompositor(ctx) // Old implementation
}
```

## Configuration Changes

### New Configuration Options
```toml
[monitor]
# Use new Wayland-based monitor detection
use_wayland_detection = true

# Fallback to compositor-specific detection if Wayland fails
fallback_to_compositor = true

# Event polling rate (for fallback mode)
poll_rate = "5s"

# Monitor name generation strategy
name_strategy = "make_model" # "make_model" | "resolution" | "custom"
```

## Migration Timeline

### Week 1: Preparation
- [ ] Update models and create adapter functions
- [ ] Create unit tests for conversion functions
- [ ] Set up feature flag system

### Week 2: Core Implementation
- [ ] Integrate new MonitorManager into existing Manager
- [ ] Implement event handling system
- [ ] Add fallback mechanisms

### Week 3: Testing
- [ ] Comprehensive testing with different compositors
- [ ] Performance testing and optimization
- [ ] Integration testing with existing functionality

### Week 4: Deployment
- [ ] Deploy with feature flag disabled
- [ ] Gradual rollout to subset of users
- [ ] Monitor metrics and user feedback
- [ ] Full rollout if successful

## Success Criteria

### Functional Requirements
- [ ] Monitor detection works with all supported compositors
- [ ] Monitor hotplugging works correctly
- [ ] Wallpaper setting works across all monitor configurations
- [ ] Performance is equal or better than current implementation

### Non-Functional Requirements
- [ ] No regression in existing functionality
- [ ] Improved monitor information (make, model, refresh rate)
- [ ] Faster monitor change detection
- [ ] Reduced external process dependencies

## Risk Assessment

### High Risk
- **Breaking Changes**: New monitor names might break existing configurations
- **Compositor Compatibility**: Some edge cases might not be handled

### Medium Risk
- **Performance**: Event system might have overhead
- **Resource Usage**: CGO might increase memory usage

### Low Risk
- **Testing**: Comprehensive test coverage reduces risk
- **Fallback**: Old implementation remains as backup

## Mitigation Strategies

1. **Comprehensive Testing**: Test with multiple compositors and configurations
2. **Feature Flags**: Allow easy rollback if issues arise
3. **Gradual Rollout**: Deploy to subset of users first
4. **Monitoring**: Track success metrics and error rates
5. **Documentation**: Clear migration guide for users

## Conclusion

This migration will significantly improve the reliability and performance of monitor detection while providing richer monitor information. The phased approach with fallback mechanisms ensures minimal risk while maximizing benefits.

The new implementation addresses all current issues:
- ✅ Compositor independence
- ✅ Better performance
- ✅ Richer monitor data
- ✅ Real-time event system
- ✅ Improved reliability

This migration is essential for the long-term success and maintainability of the Waypaper Engine monitor system.
