# Monitor Migration - Actionable Tasks

## Task Overview
This document provides specific, executable tasks for migrating to the new Wayland-based monitor implementation. Each task includes clear acceptance criteria and test cases.

## Phase 1: Model Updates and Adapter Layer

### Task 1.1: Update Monitor Models
**Objective**: Extend the Monitor model to include new fields from MonitorInfo

**Actions**:
1. Update `daemon-go/internal/models/models.go` Monitor struct
2. Add backward compatibility for existing JSON data
3. Update JSON tags for proper serialization

**Acceptance Criteria**:
- [ ] Monitor struct includes all new fields (Make, Model, RefreshRate, Scale, Transform, PhysicalWidth, PhysicalHeight)
- [ ] JSON serialization/deserialization works with both old and new formats
- [ ] Existing monitor configurations continue to work
- [ ] All tests pass

**Test Cases**:
```go
// Test backward compatibility
func TestMonitorBackwardCompatibility(t *testing.T) {
    // Test old JSON format still works
    oldJSON := `{"name":"HDMI-A-1","width":1920,"height":1080,"currentImage":"","position":{"x":0,"y":0}}`
    var monitor models.Monitor
    err := json.Unmarshal([]byte(oldJSON), &monitor)
    assert.NoError(t, err)
    assert.Equal(t, "HDMI-A-1", monitor.Name)
    assert.Equal(t, 1920, monitor.Width)
    assert.Equal(t, 1080, monitor.Height)
}

// Test new JSON format
func TestMonitorNewFormat(t *testing.T) {
    newJSON := `{
        "name":"HDMI-A-1",
        "make":"Samsung",
        "model":"U28E590D",
        "width":1920,
        "height":1080,
        "refreshRate":60.0,
        "scale":1,
        "transform":0,
        "physicalWidth":620,
        "physicalHeight":340,
        "currentImage":"",
        "position":{"x":0,"y":0}
    }`
    var monitor models.Monitor
    err := json.Unmarshal([]byte(newJSON), &monitor)
    assert.NoError(t, err)
    assert.Equal(t, "Samsung", monitor.Make)
    assert.Equal(t, "U28E590D", monitor.Model)
    assert.Equal(t, 60.0, monitor.RefreshRate)
}
```

### Task 1.2: Create Adapter Functions
**Objective**: Create conversion functions between MonitorInfo and models.Monitor

**Actions**:
1. Create `daemon-go/internal/monitor/adapter.go`
2. Implement bidirectional conversion functions
3. Add validation and error handling

**Acceptance Criteria**:
- [ ] MonitorInfoToModel() converts correctly
- [ ] ModelToMonitorInfo() converts correctly
- [ ] Round-trip conversion preserves data
- [ ] Handles edge cases (missing fields, invalid data)

**Test Cases**:
```go
func TestMonitorInfoToModel(t *testing.T) {
    info := MonitorInfo{
        Name:           "HDMI-A-1",
        Make:           "Samsung",
        Model:          "U28E590D",
        Width:          1920,
        Height:         1080,
        RefreshRate:    60.0,
        Scale:          1,
        Transform:      0,
        PhysicalWidth:  620,
        PhysicalHeight: 340,
        X:              0,
        Y:              0,
    }
    
    model := MonitorInfoToModel(info)
    
    assert.Equal(t, "HDMI-A-1", model.Name)
    assert.Equal(t, "Samsung", model.Make)
    assert.Equal(t, "U28E590D", model.Model)
    assert.Equal(t, 1920, model.Width)
    assert.Equal(t, 1080, model.Height)
    assert.Equal(t, 60.0, model.RefreshRate)
    assert.Equal(t, int32(1), model.Scale)
    assert.Equal(t, int32(0), model.Transform)
    assert.Equal(t, int32(620), model.PhysicalWidth)
    assert.Equal(t, int32(340), model.PhysicalHeight)
    assert.Equal(t, 0, model.Position.X)
    assert.Equal(t, 0, model.Position.Y)
}

func TestModelToMonitorInfo(t *testing.T) {
    model := models.Monitor{
        Name:           "HDMI-A-1",
        Make:           "Samsung",
        Model:          "U28E590D",
        Width:          1920,
        Height:         1080,
        RefreshRate:    60.0,
        Scale:          1,
        Transform:      0,
        PhysicalWidth:  620,
        PhysicalHeight: 340,
        Position:       models.Position{X: 0, Y: 0},
    }
    
    info := ModelToMonitorInfo(model)
    
    assert.Equal(t, "HDMI-A-1", info.Name)
    assert.Equal(t, "Samsung", info.Make)
    assert.Equal(t, "U28E590D", info.Model)
    assert.Equal(t, int32(1920), info.Width)
    assert.Equal(t, int32(1080), info.Height)
    assert.Equal(t, 60.0, info.RefreshRate)
    assert.Equal(t, int32(1), info.Scale)
    assert.Equal(t, int32(0), info.Transform)
    assert.Equal(t, int32(620), info.PhysicalWidth)
    assert.Equal(t, int32(340), info.PhysicalHeight)
    assert.Equal(t, int32(0), info.X)
    assert.Equal(t, int32(0), info.Y)
}

func TestRoundTripConversion(t *testing.T) {
    original := MonitorInfo{
        Name:           "DP-1",
        Make:           "Dell",
        Model:          "U2720Q",
        Width:          2560,
        Height:         1440,
        RefreshRate:    60.0,
        Scale:          2,
        Transform:      0,
        PhysicalWidth:  597,
        PhysicalHeight: 336,
        X:              1920,
        Y:              0,
    }
    
    model := MonitorInfoToModel(original)
    converted := ModelToMonitorInfo(model)
    
    assert.Equal(t, original, converted)
}
```

## Phase 2: Core Implementation Migration

### Task 2.1: Integrate New MonitorManager
**Objective**: Integrate the new MonitorManager into the existing Manager

**Actions**:
1. Update `daemon-go/internal/monitor/manager.go`
2. Add new MonitorManager field
3. Implement initialization and cleanup
4. Add event handling system

**Acceptance Criteria**:
- [ ] Manager can initialize with new MonitorManager
- [ ] Event system works correctly
- [ ] Proper cleanup on shutdown
- [ ] Fallback to old system if Wayland fails

**Test Cases**:
```go
func TestManagerWithWayland(t *testing.T) {
    manager := NewManager(nil, slog.Default())
    
    // Test initialization
    err := manager.StartWithWayland(context.Background(), "/tmp/images", "/tmp/thumbnails", "/tmp/monitors.json")
    assert.NoError(t, err)
    
    // Test monitor retrieval
    monitors := manager.GetMonitors()
    assert.NotNil(t, monitors)
    
    // Test cleanup
    manager.Stop()
}

func TestManagerEventHandling(t *testing.T) {
    manager := NewManager(nil, slog.Default())
    
    var receivedEvents []MonitorEvent
    manager.SetEventCallback(func(event MonitorEvent) {
        receivedEvents = append(receivedEvents, event)
    })
    
    err := manager.StartWithWayland(context.Background(), "/tmp/images", "/tmp/thumbnails", "/tmp/monitors.json")
    assert.NoError(t, err)
    
    // Simulate monitor events
    // (This would need to be mocked or tested with actual monitor changes)
    
    manager.Stop()
}

func TestManagerFallback(t *testing.T) {
    manager := NewManager(nil, slog.Default())
    
    // Test fallback when Wayland is not available
    err := manager.StartWithFallback(context.Background(), "/tmp/images", "/tmp/thumbnails", "/tmp/monitors.json")
    assert.NoError(t, err)
    
    monitors := manager.GetMonitors()
    assert.NotNil(t, monitors)
    
    manager.Stop()
}
```

### Task 2.2: Update Monitor Refresh Logic
**Objective**: Replace polling-based refresh with event-driven system

**Actions**:
1. Remove polling timer from manager
2. Implement event-driven monitor updates
3. Update change detection logic
4. Add proper event cleanup

**Acceptance Criteria**:
- [ ] No more polling timer
- [ ] Monitor changes trigger events immediately
- [ ] Event cleanup works properly
- [ ] Performance is improved

**Test Cases**:
```go
func TestEventDrivenUpdates(t *testing.T) {
    manager := NewManager(nil, slog.Default())
    
    var updateCount int
    manager.SetChangeCallback(func(monitors []models.Monitor) {
        updateCount++
    })
    
    err := manager.StartWithWayland(context.Background(), "/tmp/images", "/tmp/thumbnails", "/tmp/monitors.json")
    assert.NoError(t, err)
    
    // Wait for initial update
    time.Sleep(100 * time.Millisecond)
    assert.Greater(t, updateCount, 0)
    
    manager.Stop()
}

func TestNoPollingTimer(t *testing.T) {
    manager := NewManager(nil, slog.Default())
    
    // Verify no polling timer is created
    // This would need to be checked in the implementation
    err := manager.StartWithWayland(context.Background(), "/tmp/images", "/tmp/thumbnails", "/tmp/monitors.json")
    assert.NoError(t, err)
    
    // Verify no timer-based updates occur
    // (Implementation-specific test)
    
    manager.Stop()
}
```

### Task 2.3: Implement Monitor Name Generation
**Objective**: Create enhanced monitor name generation using make/model

**Actions**:
1. Create `generateMonitorName()` function
2. Update monitor creation to use new naming
3. Add fallback naming strategies
4. Update existing monitor name handling

**Acceptance Criteria**:
- [ ] Monitor names use make/model when available
- [ ] Fallback naming works for monitors without make/model
- [ ] Existing monitor names are preserved
- [ ] Name conflicts are handled

**Test Cases**:
```go
func TestMonitorNameGeneration(t *testing.T) {
    tests := []struct {
        name     string
        info     MonitorInfo
        expected string
    }{
        {
            name: "Make and model available",
            info: MonitorInfo{
                Make:  "Samsung",
                Model: "U28E590D",
            },
            expected: "Samsung U28E590D",
        },
        {
            name: "Only make available",
            info: MonitorInfo{
                Make: "Dell",
            },
            expected: "Dell Monitor",
        },
        {
            name: "No make/model",
            info: MonitorInfo{
                Width:  1920,
                Height: 1080,
            },
            expected: "Monitor-1920x1080",
        },
        {
            name: "Empty make/model",
            info: MonitorInfo{
                Make:   "",
                Model:  "",
                Width:  2560,
                Height: 1440,
            },
            expected: "Monitor-2560x1440",
        },
    }
    
    for _, tt := range tests {
        t.Run(tt.name, func(t *testing.T) {
            result := generateMonitorName(tt.info)
            assert.Equal(t, tt.expected, result)
        })
    }
}

func TestMonitorNameUniqueness(t *testing.T) {
    // Test handling of duplicate names
    info1 := MonitorInfo{Make: "Samsung", Model: "U28E590D"}
    info2 := MonitorInfo{Make: "Samsung", Model: "U28E590D"}
    
    name1 := generateMonitorName(info1)
    name2 := generateMonitorName(info2)
    
    // Should handle duplicates appropriately
    // Implementation depends on strategy (suffix, index, etc.)
    assert.NotEqual(t, name1, name2)
}
```

## Phase 3: Testing and Validation

### Task 3.1: Integration Tests
**Objective**: Test the complete integration with different compositors

**Actions**:
1. Create integration test suite
2. Test with different Wayland compositors
3. Test X11 fallback
4. Test monitor hotplugging scenarios

**Acceptance Criteria**:
- [ ] Tests pass with Hyprland
- [ ] Tests pass with Sway
- [ ] Tests pass with GNOME
- [ ] Tests pass with KDE
- [ ] X11 fallback works
- [ ] Monitor hotplugging works

**Test Cases**:
```go
func TestHyprlandIntegration(t *testing.T) {
    if !isHyprlandRunning() {
        t.Skip("Hyprland not running")
    }
    
    manager := NewManager(nil, slog.Default())
    err := manager.StartWithWayland(context.Background(), "/tmp/images", "/tmp/thumbnails", "/tmp/monitors.json")
    assert.NoError(t, err)
    
    monitors := manager.GetMonitors()
    assert.NotEmpty(t, monitors)
    
    // Verify monitor data quality
    for _, monitor := range monitors {
        assert.NotEmpty(t, monitor.Name)
        assert.Greater(t, monitor.Width, 0)
        assert.Greater(t, monitor.Height, 0)
    }
    
    manager.Stop()
}

func TestSwayIntegration(t *testing.T) {
    if !isSwayRunning() {
        t.Skip("Sway not running")
    }
    
    manager := NewManager(nil, slog.Default())
    err := manager.StartWithWayland(context.Background(), "/tmp/images", "/tmp/thumbnails", "/tmp/monitors.json")
    assert.NoError(t, err)
    
    monitors := manager.GetMonitors()
    assert.NotEmpty(t, monitors)
    
    manager.Stop()
}

func TestX11Fallback(t *testing.T) {
    if !isX11Running() {
        t.Skip("X11 not running")
    }
    
    // Test X11 fallback when Wayland is not available
    manager := NewManager(nil, slog.Default())
    err := manager.StartWithFallback(context.Background(), "/tmp/images", "/tmp/thumbnails", "/tmp/monitors.json")
    assert.NoError(t, err)
    
    monitors := manager.GetMonitors()
    assert.NotEmpty(t, monitors)
    
    manager.Stop()
}

func TestMonitorHotplugging(t *testing.T) {
    manager := NewManager(nil, slog.Default())
    
    var events []MonitorEvent
    manager.SetEventCallback(func(event MonitorEvent) {
        events = append(events, event)
    })
    
    err := manager.StartWithWayland(context.Background(), "/tmp/images", "/tmp/thumbnails", "/tmp/monitors.json")
    assert.NoError(t, err)
    
    initialCount := len(manager.GetMonitors())
    
    // Simulate monitor hotplugging
    // (This would need actual hardware or simulation)
    
    // Wait for events
    time.Sleep(2 * time.Second)
    
    // Verify events were received
    // Implementation depends on test environment
    
    manager.Stop()
}
```

### Task 3.2: Performance Tests
**Objective**: Verify performance improvements

**Actions**:
1. Create performance benchmark tests
2. Compare old vs new implementation
3. Test with multiple monitors
4. Measure memory usage

**Acceptance Criteria**:
- [ ] New implementation is faster than old
- [ ] Memory usage is reasonable
- [ ] Performance scales with monitor count
- [ ] No memory leaks

**Test Cases**:
```go
func BenchmarkMonitorDetection(b *testing.B) {
    manager := NewManager(nil, slog.Default())
    
    b.Run("OldImplementation", func(b *testing.B) {
        for i := 0; i < b.N; i++ {
            err := manager.refreshMonitorsWithCompositor(context.Background())
            if err != nil {
                b.Fatal(err)
            }
        }
    })
    
    b.Run("NewImplementation", func(b *testing.B) {
        err := manager.StartWithWayland(context.Background(), "/tmp/images", "/tmp/thumbnails", "/tmp/monitors.json")
        if err != nil {
            b.Fatal(err)
        }
        defer manager.Stop()
        
        b.ResetTimer()
        for i := 0; i < b.N; i++ {
            monitors := manager.GetMonitors()
            _ = monitors
        }
    })
}

func TestMemoryUsage(t *testing.T) {
    manager := NewManager(nil, slog.Default())
    
    err := manager.StartWithWayland(context.Background(), "/tmp/images", "/tmp/thumbnails", "/tmp/monitors.json")
    assert.NoError(t, err)
    
    var m runtime.MemStats
    runtime.ReadMemStats(&m)
    initialAlloc := m.Alloc
    
    // Run some operations
    for i := 0; i < 100; i++ {
        monitors := manager.GetMonitors()
        _ = monitors
    }
    
    runtime.ReadMemStats(&m)
    finalAlloc := m.Alloc
    
    // Verify no significant memory leak
    memoryIncrease := finalAlloc - initialAlloc
    assert.Less(t, memoryIncrease, uint64(1024*1024)) // Less than 1MB increase
    
    manager.Stop()
}

func TestScalability(t *testing.T) {
    // Test performance with different numbers of monitors
    monitorCounts := []int{1, 2, 4, 8, 16}
    
    for _, count := range monitorCounts {
        t.Run(fmt.Sprintf("Monitors_%d", count), func(t *testing.T) {
            manager := NewManager(nil, slog.Default())
            
            // Mock multiple monitors
            // Implementation depends on test setup
            
            start := time.Now()
            err := manager.StartWithWayland(context.Background(), "/tmp/images", "/tmp/thumbnails", "/tmp/monitors.json")
            duration := time.Since(start)
            
            assert.NoError(t, err)
            assert.Less(t, duration, 5*time.Second) // Should start within 5 seconds
            
            manager.Stop()
        })
    }
}
```

### Task 3.3: Compatibility Tests
**Objective**: Ensure backward compatibility

**Actions**:
1. Test existing configurations work
2. Test JSON file migration
3. Test API compatibility
4. Test database migration

**Acceptance Criteria**:
- [ ] Existing monitor configurations load correctly
- [ ] JSON files migrate properly
- [ ] API remains compatible
- [ ] No data loss during migration

**Test Cases**:
```go
func TestExistingConfigurationCompatibility(t *testing.T) {
    // Test loading existing monitor configurations
    oldConfig := `{
        "monitors": [
            {
                "name": "HDMI-A-1",
                "width": 1920,
                "height": 1080,
                "currentImage": "wallpaper1.jpg",
                "position": {"x": 0, "y": 0}
            }
        ]
    }`
    
    var config struct {
        Monitors []models.Monitor `json:"monitors"`
    }
    
    err := json.Unmarshal([]byte(oldConfig), &config)
    assert.NoError(t, err)
    assert.Len(t, config.Monitors, 1)
    assert.Equal(t, "HDMI-A-1", config.Monitors[0].Name)
    assert.Equal(t, "wallpaper1.jpg", config.Monitors[0].CurrentImage)
}

func TestJSONFileMigration(t *testing.T) {
    // Test migration of existing JSON files
    oldFile := "/tmp/old_monitors.json"
    newFile := "/tmp/new_monitors.json"
    
    // Create old format file
    oldData := `[
        {
            "name": "HDMI-A-1",
            "width": 1920,
            "height": 1080,
            "currentImage": "wallpaper1.jpg",
            "position": {"x": 0, "y": 0}
        }
    ]`
    
    err := os.WriteFile(oldFile, []byte(oldData), 0644)
    assert.NoError(t, err)
    
    // Test migration
    manager := NewManager(nil, slog.Default())
    err = manager.MigrateJSONFile(oldFile, newFile)
    assert.NoError(t, err)
    
    // Verify new file exists and is valid
    newData, err := os.ReadFile(newFile)
    assert.NoError(t, err)
    
    var monitors []models.Monitor
    err = json.Unmarshal(newData, &monitors)
    assert.NoError(t, err)
    assert.Len(t, monitors, 1)
    assert.Equal(t, "HDMI-A-1", monitors[0].Name)
    
    // Cleanup
    os.Remove(oldFile)
    os.Remove(newFile)
}

func TestAPICompatibility(t *testing.T) {
    // Test that existing API calls still work
    manager := NewManager(nil, slog.Default())
    
    err := manager.StartWithWayland(context.Background(), "/tmp/images", "/tmp/thumbnails", "/tmp/monitors.json")
    assert.NoError(t, err)
    
    // Test existing API methods
    monitors := manager.GetMonitors()
    assert.NotNil(t, monitors)
    
    activeMonitor := manager.GetActiveMonitor()
    // activeMonitor might be nil initially
    
    // Test setting active monitor
    testActiveMonitor := &models.ActiveMonitor{
        Name: "Test",
        Monitors: monitors,
        ExtendAcrossMonitors: false,
    }
    
    err = manager.SetActiveMonitor(testActiveMonitor)
    assert.NoError(t, err)
    
    manager.Stop()
}
```

## Implementation Checklist

### Phase 1: Model Updates
- [ ] **Task 1.1**: Update Monitor struct in `models/models.go`
- [ ] **Task 1.2**: Create adapter functions in `monitor/adapter.go`
- [ ] **Tests**: Write unit tests for model updates and adapters

### Phase 2: Core Implementation
- [ ] **Task 2.1**: Integrate MonitorManager into Manager
- [ ] **Task 2.2**: Replace polling with event-driven updates
- [ ] **Task 2.3**: Implement enhanced monitor naming
- [ ] **Tests**: Write integration tests for core functionality

### Phase 3: Testing and Validation
- [ ] **Task 3.1**: Create comprehensive integration tests
- [ ] **Task 3.2**: Implement performance benchmarks
- [ ] **Task 3.3**: Test backward compatibility
- [ ] **Tests**: Run all tests across different environments

## Success Metrics

### Functional Metrics
- [ ] Monitor detection works with all supported compositors
- [ ] Monitor hotplugging works correctly
- [ ] Wallpaper setting works across all configurations
- [ ] No regression in existing functionality

### Performance Metrics
- [ ] Monitor detection is 50% faster than old implementation
- [ ] Memory usage increase is less than 10%
- [ ] Event response time is under 100ms
- [ ] No memory leaks detected

### Quality Metrics
- [ ] Test coverage is above 90%
- [ ] All integration tests pass
- [ ] Performance benchmarks meet targets
- [ ] No critical bugs in testing

## Risk Mitigation

### High Risk Items
- [ ] **Breaking Changes**: Monitor name changes might break existing configs
- [ ] **Compositor Compatibility**: Edge cases in compositor detection
- [ ] **Performance Regression**: New implementation might be slower

### Mitigation Strategies
- [ ] **Feature Flags**: Allow easy rollback
- [ ] **Comprehensive Testing**: Test with multiple compositors
- [ ] **Gradual Rollout**: Deploy to subset of users first
- [ ] **Monitoring**: Track success metrics and error rates

## Next Steps

1. **Start with Task 1.1**: Update the Monitor model
2. **Create adapter functions**: Task 1.2
3. **Write unit tests**: For all model changes
4. **Integrate MonitorManager**: Task 2.1
5. **Implement event system**: Task 2.2
6. **Add comprehensive tests**: Tasks 3.1-3.3
7. **Performance validation**: Ensure improvements
8. **Deploy with feature flags**: Gradual rollout

Each task should be completed and tested before moving to the next one. This ensures a stable migration with minimal risk.
