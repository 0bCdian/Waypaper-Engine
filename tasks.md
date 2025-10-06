# TODO Tasks from TypeScript Codebase

## Found TODOs

### 1. Restore Last Wallpaper (electron/main.ts)
- **File**: `electron/main.ts:38, 281`
- **Description**: Implement restore last wallpaper functionality in Go daemon
- **Status**: Not Implemented
- **Priority**: High
- **Context**: Currently has placeholder comments but no actual implementation

### 2. Image Error Toast Notifications (src/hooks/useRealTimeImageProcessing.tsx)
- **File**: `src/hooks/useRealTimeImageProcessing.tsx:115`
- **Description**: Show a toast notification or update a specific UI element for image processing errors
- **Status**: Not Implemented
- **Priority**: Medium
- **Context**: Error is currently only logged to console

### 3. Add Selected Images to Playlist (src/hooks/useContextMenuEvents.tsx)
- **File**: `src/hooks/useContextMenuEvents.tsx:13`
- **Description**: Implement add selected images to playlist functionality (should open a modal to select which playlist to add to)
- **Status**: Not Implemented
- **Priority**: High
- **Context**: Function exists but has no implementation

### 4. Remove Selected Images from Playlist (src/hooks/useContextMenuEvents.tsx)
- **File**: `src/hooks/useContextMenuEvents.tsx:19`
- **Description**: Implement remove selected images from current playlist functionality
- **Status**: Not Implemented
- **Priority**: High
- **Context**: Function exists but has no implementation

### 5. Set Images Per Page (src/hooks/useContextMenuEvents.tsx)
- **File**: `src/hooks/useContextMenuEvents.tsx:71`
- **Description**: Implement set images per page functionality (should update the app config)
- **Status**: Not Implemented
- **Priority**: Medium
- **Context**: Function exists but has no implementation

### 6. Window Bounds Saving (src/hooks/useWindowBounds.tsx)
- **File**: `src/hooks/useWindowBounds.tsx:7`
- **Description**: Implement window bounds saving when electron API is available
- **Status**: Not Implemented
- **Priority**: Low
- **Context**: Hook exists but has no actual implementation

### 7. Frontend Config Persistence - Load (src/utils/frontendConfig.ts)
- **File**: `src/utils/frontendConfig.ts:27`
- **Description**: Implement proper IPC-based config persistence for loading config
- **Status**: Not Implemented
- **Priority**: Medium
- **Context**: Currently uses in-memory config only

### 8. Frontend Config Persistence - Save (src/utils/frontendConfig.ts)
- **File**: `src/utils/frontendConfig.ts:40`
- **Description**: Implement proper IPC-based config persistence for saving config
- **Status**: Not Implemented
- **Priority**: Medium
- **Context**: Currently only logs what would be saved

## Implementation Plan

1. Start with high-priority items (1, 3, 4)
2. Then medium-priority items (2, 5, 7, 8)
3. Finally low-priority items (6)

