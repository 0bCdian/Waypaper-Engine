# Type Validation and Safety Implementation Plan

## Overview
This document outlines the comprehensive plan to implement type safety and validation in the Waypaper Engine daemon, align types across the entire stack (Go daemon, Electron, React), and establish a single source of truth for data contracts.

## Current State Analysis

### 1. Unimplemented Handlers in Daemon
After analyzing the daemon code, the following handlers are **fully implemented**:
- ✅ `ping` - Basic connectivity test
- ✅ `start_playlist` - Start playlist on monitor
- ✅ `stop_playlist` - Stop playlist (supports multiple modes)
- ✅ `pause_playlist` - Pause playlist
- ✅ `resume_playlist` - Resume playlist
- ✅ `next_image` - Advance to next image
- ✅ `previous_image` - Go to previous image
- ✅ `set_image` - Set specific image
- ✅ `random_image` - Set random image
- ✅ `get_info` - Get system information
- ✅ `get_diagnostics` - Get diagnostic information
- ✅ `get_images` - Get image list from JSON store
- ✅ `get_playlists` - Get playlist list
- ✅ `get_active_playlist` - Get active playlist info
- ✅ `save_playlist` - Save playlist to JSON store
- ✅ `process_for_monitors` - Process image for multiple monitors
- ✅ `set_image_across_monitors` - Set image across monitors
- ✅ `duplicate_image_across_monitors` - Duplicate image across monitors
- ✅ `delete_images` - Delete images (redirects to delete_image_from_gallery)
- ✅ `get_image_history` - Get image history
- ✅ `get_config` - Get configuration
- ✅ `set_config` - Set configuration (supports partial updates)
- ✅ `get_swww_config` - Get swww configuration
- ✅ `stop_daemon` - Stop daemon
- ✅ `kill_daemon` - Kill daemon
- ✅ `get_daemon_status` - Get daemon status
- ✅ `get_monitors` - Get monitor list
- ✅ `set_selected_monitor` - Set selected monitor configuration
- ✅ `get_selected_monitor` - Get selected monitor configuration
- ✅ `get_playlist_images` - Get images in playlist
- ✅ `get_running_playlists` - Get running playlists
- ✅ `delete_playlist` - Delete playlist
- ✅ `delete_image_from_gallery` - Delete images from gallery
- ✅ `process_images` - Process images with parallel processing

**All handlers are implemented!** No unimplemented handlers found.

### 2. Type Safety Issues Identified

#### Current Problems:
1. **Mixed `interface{}` and `any` usage** - Need to standardize on `any`
2. **No payload validation** - Messages are unmarshaled without validation
3. **Type mismatches** between Go daemon and TypeScript clients
4. **Fragmented type definitions** across multiple files
5. **No runtime type checking** for IPC messages
6. **Inconsistent error handling** across handlers

#### Specific Issues:
- `ConfigData.FrontendConfig` uses `any` without validation
- `Message` struct has many optional fields without validation
- Type conversion between `models.ActiveMonitor` and `monitor.ActiveMonitor`
- No validation for playlist configuration types
- Image processing parameters not validated

### 3. Type Alignment Issues

#### Go Daemon Types:
- `models.ActiveMonitor` - Has `ImageSetType` field
- `models.Image` - Basic image structure
- `models.Playlist` - Playlist with configuration
- `ConfigData` - Configuration data structure

#### TypeScript Client Types:
- `MonitorSelection` - Newer, more semantic API
- `ActiveMonitor` - Legacy interface
- `JsonStoreImage` - Complex image structure
- `UnifiedConfig` - Complete configuration structure

#### Misalignments:
1. **Monitor Types**: Go uses `models.ActiveMonitor`, TS uses `MonitorSelection`
2. **Image Types**: Go uses simple `models.Image`, TS uses complex `JsonStoreImage`
3. **Config Types**: Different field names and structures
4. **Playlist Types**: Different configuration structures

## Implementation Plan

### Phase 1: Type Safety Foundation (Priority: HIGH)

#### 1.1 Replace `interface{}` with `any`
- [ ] Update all Go files to use `any` instead of `interface{}`
- [ ] Update type safety validation code
- [ ] Update tests to use `any`

#### 1.2 Implement Comprehensive Message Validation
- [ ] Create `MessageValidator` struct for each action type
- [ ] Implement payload validation for all handlers
- [ ] Add validation tags to message structs
- [ ] Create validation error types

#### 1.3 Enhance Type Safety System
- [ ] Extend `ConfigTypeRegistry` to handle all message types
- [ ] Add validation for playlist configurations
- [ ] Add validation for image processing parameters
- [ ] Add validation for monitor configurations

### Phase 2: Type Alignment (Priority: HIGH)

#### 2.1 Create Shared Type Contracts
- [ ] Create `shared/types/contracts/` directory
- [ ] Define canonical types for all data structures
- [ ] Create type generation scripts (Go → TypeScript)
- [ ] Establish naming conventions

#### 2.2 Align Monitor Types
- [ ] Standardize on `MonitorSelection` API
- [ ] Update Go daemon to use consistent monitor types
- [ ] Update TypeScript clients to use aligned types
- [ ] Create migration path for `ActiveMonitor` → `MonitorSelection`

#### 2.3 Align Image Types
- [ ] Standardize on `JsonStoreImage` structure
- [ ] Update Go daemon image handling
- [ ] Ensure consistent image metadata
- [ ] Align thumbnail handling

#### 2.4 Align Configuration Types
- [ ] Use `UnifiedConfig` as single source of truth
- [ ] Update Go daemon configuration handling
- [ ] Ensure consistent field names
- [ ] Align validation rules

### Phase 3: Enhanced Validation (Priority: MEDIUM)

#### 3.1 Implement Zod-like Validation
- [ ] Create validation DSL for Go
- [ ] Implement schema-based validation
- [ ] Add custom validation rules
- [ ] Create validation middleware

#### 3.2 Add Runtime Type Checking
- [ ] Implement type guards for all message types
- [ ] Add runtime type assertions
- [ ] Create type-safe message handlers
- [ ] Add comprehensive error reporting

#### 3.3 Improve Error Handling
- [ ] Standardize error types across handlers
- [ ] Add detailed validation error messages
- [ ] Implement error recovery strategies
- [ ] Add error logging and monitoring

### Phase 4: Testing and Documentation (Priority: MEDIUM)

#### 4.1 Comprehensive Testing
- [ ] Add validation tests for all message types
- [ ] Add integration tests for type alignment
- [ ] Add performance tests for validation
- [ ] Add error handling tests

#### 4.2 Documentation
- [ ] Document type contracts
- [ ] Create API documentation
- [ ] Add validation rules documentation
- [ ] Create migration guides

## Detailed Implementation Steps

### Step 1: Replace `interface{}` with `any`

```bash
# Find all interface{} usage
find daemon-go -name "*.go" -exec grep -l "interface{}" {} \;

# Replace interface{} with any
sed -i 's/interface{}/any/g' daemon-go/**/*.go
```

### Step 2: Create Message Validation System

```go
// Create daemon-go/internal/ipc/validation.go
type MessageValidator struct {
    validators map[string]func(*Message) error
}

func NewMessageValidator() *MessageValidator {
    return &MessageValidator{
        validators: map[string]func(*Message) error{
            "set_config": validateSetConfigMessage,
            "start_playlist": validateStartPlaylistMessage,
            // ... all handlers
        },
    }
}
```

### Step 3: Create Shared Type Contracts

```typescript
// Create shared/types/contracts/monitor.ts
export interface MonitorContract {
  name: string;
  width: number;
  height: number;
  position: { x: number; y: number };
  currentImage: string;
}

export interface MonitorSelectionContract {
  id: string;
  monitors: MonitorContract[];
  mode: 'individual' | 'extend' | 'clone';
  metadata?: {
    createdAt?: string;
    lastUsed?: string;
    userLabel?: string;
  };
}
```

### Step 4: Implement Type Generation

```bash
# Create scripts/generate-types.sh
#!/bin/bash
# Generate TypeScript types from Go structs
go run scripts/type-generator.go > shared/types/generated.ts
```

## File Structure Changes

```
daemon-go/
├── internal/
│   ├── ipc/
│   │   ├── validation.go          # Message validation
│   │   ├── types.go               # IPC-specific types
│   │   └── handlers/
│   │       ├── config.go          # Config handlers
│   │       ├── playlist.go         # Playlist handlers
│   │       ├── image.go           # Image handlers
│   │       └── monitor.go         # Monitor handlers
│   └── types/
│       ├── contracts.go           # Shared contracts
│       └── validation.go          # Validation rules

shared/
├── types/
│   ├── contracts/                 # Shared type contracts
│   │   ├── monitor.ts
│   │   ├── image.ts
│   │   ├── playlist.ts
│   │   └── config.ts
│   └── generated.ts               # Generated types

scripts/
├── generate-types.sh              # Type generation script
└── validate-contracts.sh          # Contract validation
```

## Success Criteria

1. **Type Safety**: All IPC messages are validated before processing
2. **Type Alignment**: Go daemon and TypeScript clients use identical types
3. **Error Handling**: Clear, actionable error messages for validation failures
4. **Performance**: Validation adds <1ms overhead per message
5. **Maintainability**: Single source of truth for all type definitions
6. **Testing**: 100% test coverage for validation logic

## Timeline

- **Week 1**: Phase 1 (Type Safety Foundation)
- **Week 2**: Phase 2 (Type Alignment)
- **Week 3**: Phase 3 (Enhanced Validation)
- **Week 4**: Phase 4 (Testing and Documentation)

## Risk Mitigation

1. **Breaking Changes**: Implement gradual migration with backward compatibility
2. **Performance Impact**: Benchmark validation overhead and optimize
3. **Type Mismatches**: Create comprehensive test suite for type alignment
4. **Error Handling**: Implement graceful degradation for validation failures

## Next Steps

1. Review and approve this plan
2. Create detailed implementation tasks
3. Set up development environment
4. Begin Phase 1 implementation
5. Establish testing and validation processes
