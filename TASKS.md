# Waypaper Engine - Thumbnail Pipeline Refactor Plan

## Problem Analysis

The current thumbnail pipeline has several critical issues:

1. **Infinite Loop**: Thumbnail failures trigger recreation requests that create more failures
2. **Complex Frontend Queue**: The frontend manages a complex thumbnail request queue with retry logic
3. **Multiple IPC Methods**: Too many individual IPC methods for image/thumbnail operations
4. **Skeleton System**: Complex skeleton loading system that's error-prone
5. **Race Conditions**: Multiple components requesting thumbnails simultaneously

## Current Architecture Analysis

### Frontend Components
- **`src/stores/thumbnailStore.ts`**: Complex thumbnail management with queues, retries, and concurrent request limiting
- **`src/components/ImageCard.tsx`**: Uses `useThumbnail` hook to request thumbnails on-demand
- **`src/components/EnhancedImageCard.tsx`**: Alternative image card with different thumbnail loading logic
- **`src/hooks/useRealTimeImageProcessing.tsx`**: Handles real-time events from daemon
- **`src/hooks/useImageState.tsx`**: Manages image processing state
- **`src/hooks/useOpenImages.tsx`**: Handles image adding workflow
- **`src/stores/images.tsx`**: Main image store with skeleton management

### Electron Components
- **`electron/main.ts`**: IPC handlers for `get_image_src`, `get_thumbnail_src`, `create_thumbnail`
- **`electron/goDaemonClient.ts`**: Go daemon client with thumbnail methods
- **`electron/goDaemonRendererClient.ts`**: Renderer client interface
- **`electron/exposedApi.ts`**: Exposed API methods
- **`electron/appFunctions.ts`**: File dialog and image discovery

### Daemon Components
- **`daemon-go/internal/ipc/handler.go`**: Main IPC handler with `handleAddImages` and `handleCreateThumbnail`
- **`daemon-go/internal/image/operations.go`**: Thumbnail creation operations
- **`daemon-go/internal/image/batch_processor.go`**: Batch image processing
- **`daemon-go/internal/types/events.go`**: Event type definitions
- **`daemon-go/internal/ipc/protocol.go`**: Event constants

## Proposed New Architecture

### Core Principle
**Event-Driven Processing**: The daemon processes images completely (copy, thumbnail generation, metadata extraction, database storage) and broadcasts complete image data via events. The frontend receives these events and displays images immediately.

### New Workflow
1. **User Action**: User selects images/folders via UI
2. **Electron Discovery**: Electron handles file dialog and discovers image files
3. **Daemon Processing**: Daemon receives image list and processes each image:
   - Copies image to cache directory
   - Generates multi-resolution thumbnails
   - Extracts metadata
   - Stores in database
   - Broadcasts `image_processed` event with complete image data
4. **Frontend Updates**: Frontend receives events and:
   - Updates progress bar
   - Adds completed images to gallery immediately
   - No skeleton system needed

## Detailed Implementation Plan

### Phase 1: Daemon Event Enhancement

#### 1.1 Enhance `image_processed` Event Payload
**File**: `daemon-go/internal/ipc/handler.go`
**Location**: Around line 1590-1602

**Current Event**:
```go
h.server.BroadcastEvent(&Event{
    Type: EventImageProcessed,
    Payload: map[string]interface{}{
        "id":               imageID,
        "originalFileName": originalFileName,
        "uniqueFileName":   uniqueFileName,
        "width":            metadata.Width,
        "height":           metadata.Height,
        "format":           metadata.Format,
    },
})
```

**New Event** (include complete image data):
```go
h.server.BroadcastEvent(&Event{
    Type: EventImageProcessed,
    Payload: map[string]interface{}{
        "id":               imageID,
        "originalFileName": originalFileName,
        "uniqueFileName":   uniqueFileName,
        "width":            metadata.Width,
        "height":           metadata.Height,
        "format":           metadata.Format,
        "path":             filepath.Join(cacheDir, uniqueFileName),
        "thumbnails":       thumbnailPaths, // map[string]string
        "size":             metadata.Size,
        "createdAt":        time.Now().Unix(),
    },
})
```

#### 1.2 Add Progress Tracking Events
**File**: `daemon-go/internal/ipc/handler.go`
**Location**: Before the main processing loop (around line 1410)

**Add new event types**:
```go
// Add to daemon-go/internal/types/events.go
const (
    EventProcessingStarted types.EventType = "processing_started"
    EventImageProgress     types.EventType = "image_progress"
)
```

**Broadcast processing start**:
```go
// Before processing loop
if h.server != nil {
    h.server.BroadcastEvent(&Event{
        Type: EventProcessingStarted,
        Payload: map[string]interface{}{
            "totalImages": len(msg.ImagePaths),
            "startTime":   time.Now().Unix(),
        },
    })
}
```

**Broadcast progress updates**:
```go
// After each successful image processing (around line 1602)
if h.server != nil {
    h.server.BroadcastEvent(&Event{
        Type: EventImageProgress,
        Payload: map[string]interface{}{
            "processed": len(metadataList),
            "total":     len(msg.ImagePaths),
            "current":   originalFileName,
        },
    })
}
```

### Phase 2: Frontend Event Handling

#### 2.1 Create New Progress Store
**File**: `src/stores/imageProcessingStore.ts` (NEW)

```typescript
import { create } from "zustand";

interface ImageProcessingState {
    isProcessing: boolean;
    totalImages: number;
    processedImages: number;
    currentImage: string | null;
    startTime: number | null;
}

interface ImageProcessingActions {
    startProcessing: (totalImages: number) => void;
    updateProgress: (processed: number, current: string) => void;
    completeProcessing: () => void;
    reset: () => void;
}

export const useImageProcessingStore = create<ImageProcessingState & ImageProcessingActions>()((set) => ({
    isProcessing: false,
    totalImages: 0,
    processedImages: 0,
    currentImage: null,
    startTime: null,

    startProcessing: (totalImages: number) => set({
        isProcessing: true,
        totalImages,
        processedImages: 0,
        currentImage: null,
        startTime: Date.now(),
    }),

    updateProgress: (processed: number, current: string) => set((state) => ({
        processedImages: processed,
        currentImage: current,
    })),

    completeProcessing: () => set({
        isProcessing: false,
        currentImage: null,
    }),

    reset: () => set({
        isProcessing: false,
        totalImages: 0,
        processedImages: 0,
        currentImage: null,
        startTime: null,
    }),
}));
```

#### 2.2 Create Progress Bar Component
**File**: `src/components/ImageProcessingProgress.tsx` (NEW)

```typescript
import React from "react";
import { useImageProcessingStore } from "../stores/imageProcessingStore";

export function ImageProcessingProgress() {
    const { isProcessing, totalImages, processedImages, currentImage, startTime } = useImageProcessingStore();

    if (!isProcessing) return null;

    const progress = totalImages > 0 ? (processedImages / totalImages) * 100 : 0;
    const elapsed = startTime ? Date.now() - startTime : 0;

    return (
        <div className="fixed top-4 right-4 bg-gray-800 p-4 rounded-lg shadow-lg z-50 min-w-80">
            <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-white">Processing Images</span>
                <span className="text-sm text-gray-300">{processedImages}/{totalImages}</span>
            </div>
            
            <div className="w-full bg-gray-700 rounded-full h-2 mb-2">
                <div 
                    className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${progress}%` }}
                />
            </div>
            
            {currentImage && (
                <div className="text-xs text-gray-400 truncate">
                    Processing: {currentImage}
                </div>
            )}
            
            <div className="text-xs text-gray-500 mt-1">
                {Math.round(elapsed / 1000)}s elapsed
            </div>
        </div>
    );
}
```

#### 2.3 Update Real-Time Processing Hook
**File**: `src/hooks/useRealTimeImageProcessing.tsx`

**Replace the entire file content**:

```typescript
import { useEffect, useRef } from "react";
import { imagesStore } from "../stores/images";
import { useImageProcessingStore } from "../stores/imageProcessingStore";
import { type rendererImage } from "../types/rendererTypes";
import { 
    type DaemonImageProcessedPayload,
    type DaemonImageErrorPayload,
    type DaemonProcessingCompletePayload,
    type DaemonImagesUpdatedPayload
} from "../../shared/types/daemonEvents";

export function useRealTimeImageProcessing() {
    const cleanupRef = useRef<(() => void) | null>(null);
    const { addImage } = imagesStore();
    const { startProcessing, updateProgress, completeProcessing } = useImageProcessingStore();

    useEffect(() => {
        const timer = setTimeout(() => {
            try {
                if (!window.API_RENDERER?.goDaemon?.on) {
                    console.error("goDaemon event methods not available");
                    return;
                }

                const handleProcessingStarted = (...args: unknown[]) => {
                    const data = args[0] as { totalImages: number };
                    console.log("Processing started:", data);
                    startProcessing(data.totalImages);
                };

                const handleImageProcessed = (...args: unknown[]) => {
                    const data = args[0] as DaemonImageProcessedPayload;
                    try {
                        console.log("Image processed:", data);
                        
                        const newImage: rendererImage = {
                            id: parseInt(data.id),
                            name: data.uniqueFileName,
                            path: data.path,
                            width: data.width,
                            height: data.height,
                            format: data.format,
                            size: data.size,
                            thumbnails: data.thumbnails,
                            selection: {
                                isChecked: false,
                                isSelected: false,
                                selectedAt: undefined,
                                selectedPlaylists: []
                            },
                            time: data.createdAt
                        };
                        
                        addImage(newImage);
                    } catch (error) {
                        console.error("Error handling image_processed event:", error);
                    }
                };

                const handleImageProgress = (...args: unknown[]) => {
                    const data = args[0] as { processed: number; total: number; current: string };
                    console.log("Image progress:", data);
                    updateProgress(data.processed, data.current);
                };

                const handleImageError = (...args: unknown[]) => {
                    const data = args[0] as DaemonImageErrorPayload;
                    console.error("Image processing error:", data);
                };

                const handleProcessingComplete = (...args: unknown[]) => {
                    const data = args[0] as DaemonProcessingCompletePayload;
                    console.log("Processing complete:", data);
                    completeProcessing();
                };

                // Register event listeners
                window.API_RENDERER.goDaemon.on('processing_started', handleProcessingStarted);
                window.API_RENDERER.goDaemon.on('image_processed', handleImageProcessed);
                window.API_RENDERER.goDaemon.on('image_progress', handleImageProgress);
                window.API_RENDERER.goDaemon.on('image_error', handleImageError);
                window.API_RENDERER.goDaemon.on('processing_complete', handleProcessingComplete);

                cleanupRef.current = () => {
                    window.API_RENDERER.goDaemon.off('processing_started', handleProcessingStarted);
                    window.API_RENDERER.goDaemon.off('image_processed', handleImageProcessed);
                    window.API_RENDERER.goDaemon.off('image_progress', handleImageProgress);
                    window.API_RENDERER.goDaemon.off('image_error', handleImageError);
                    window.API_RENDERER.goDaemon.off('processing_complete', handleProcessingComplete);
                };
            } catch (error) {
                console.error("Error setting up real-time image processing:", error);
            }
        }, 1000);

        return () => {
            clearTimeout(timer);
            if (cleanupRef.current) {
                cleanupRef.current();
            }
        };
    }, [addImage, startProcessing, updateProgress, completeProcessing]);
}
```

### Phase 3: Simplify Image Components

#### 3.1 Update ImageCard Component
**File**: `src/components/ImageCard.tsx`

**Remove thumbnail management logic**:
- Remove `useThumbnail` hook usage
- Remove thumbnail loading states
- Use thumbnail paths directly from image data
- Remove lazy loading logic

**Simplified version**:
```typescript
function ImageCard({ Image }: ImageCardProps) {
    const [selected, setSelected] = useState(Image.selection?.isSelected ?? false);
    const [isChecked, setIsChecked] = useState(Image.selection?.isChecked ?? false);
    const [imageSrc, setImageSrc] = useState<string>("");
    const { activeMonitor } = useMonitorStore();

    // Load image path only
    useEffect(() => {
        if (!Image.name) return;
        
        const loadImagePath = async () => {
            try {
                const imagePath = await goDaemon.getImageSrc(Image.name);
                if (imagePath) {
                    setImageSrc(`atom://${imagePath}`);
                }
            } catch (error) {
                console.error("Failed to load image path:", error);
            }
        };
        
        loadImagePath();
    }, [Image.name]);

    // Get thumbnail path from image data
    const getThumbnailSrc = () => {
        if (!Image.thumbnails) return "";
        
        const screenWidth = window.innerWidth;
        let thumbnailPath = "";
        
        if (screenWidth >= 2560) {
            thumbnailPath = Image.thumbnails["1440p"] || Image.thumbnails["1080p"] || Image.thumbnails["720p"];
        } else if (screenWidth >= 1920) {
            thumbnailPath = Image.thumbnails["1080p"] || Image.thumbnails["720p"];
        } else {
            thumbnailPath = Image.thumbnails["720p"];
        }
        
        return thumbnailPath ? `atom://${thumbnailPath}` : "";
    };

    const thumbnailSrc = getThumbnailSrc();

    // Rest of component remains the same...
}
```

#### 3.2 Remove Thumbnail Store
**File**: `src/stores/thumbnailStore.ts`

**Delete this file entirely** - it's no longer needed.

#### 3.3 Update Images Store
**File**: `src/stores/images.tsx`

**Remove skeleton-related methods**:
- Remove `skeletonsToShow` from state
- Remove `setSkeletons` method
- Remove `clearSkeletons` method
- Remove skeleton-related logic from `addImages` and `addImage`

### Phase 4: Update Electron Layer

#### 4.1 Remove Thumbnail IPC Methods
**File**: `electron/main.ts`

**Remove these IPC handlers**:
- `get_image_src` (around line 564)
- `get_thumbnail_src` (around line 570)
- `create_thumbnail` (around line 578)

#### 4.2 Update GoDaemonClient
**File**: `electron/goDaemonClient.ts`

**Remove these methods**:
- `getImageSrc`
- `getThumbnailSrc`
- `createThumbnail`

#### 4.3 Update Exposed API
**File**: `electron/exposedApi.ts`

**Remove these methods**:
- `getImageSrc`
- `getThumbnailSrc`
- `createThumbnail`

### Phase 5: Update App Integration

#### 5.1 Update App Component
**File**: `src/App.tsx`

**Remove thumbnail listener setup**:
- Remove `setupThumbnailListener` import and usage
- Add `ImageProcessingProgress` component

```typescript
import { ImageProcessingProgress } from "./components/ImageProcessingProgress";

const App = () => {
    // ... existing hooks
    
    return (
        <HashRouter>
            <ImageProcessingProgress />
            <Drawer>
                <NavBar />
                {/* ... rest of app */}
            </Drawer>
        </HashRouter>
    );
};
```

#### 5.2 Update Open Images Hook
**File**: `src/hooks/useOpenImages.tsx`

**Simplify the workflow**:
```typescript
const openImagesStore = create<State & Actions>(set => ({
    isActive: false,
    openImages: async ({ action }) => {
        set(() => ({ isActive: true }));
        const imagesObject: imagesObject | undefined = await openFiles(action);
        set(() => ({ isActive: false }));
        
        if (imagesObject === undefined) return;
        
        // Send images to daemon for processing
        await handleOpenImages(imagesObject);
        // Progress will be handled by real-time events
        // Images will appear automatically as they're processed
    }
}));
```

### Phase 6: Clean Up Daemon

#### 6.1 Remove Thumbnail IPC Handler
**File**: `daemon-go/internal/ipc/handler.go`

**Remove `handleCreateThumbnail` method** (around line 1630-1700)

#### 6.2 Update IPC Command Router
**File**: `daemon-go/internal/ipc/handler.go`

**Remove `create_thumbnail` case** from the command router.

## Implementation Order

1. **Phase 1**: Enhance daemon events (most critical)
2. **Phase 2**: Create new frontend event handling
3. **Phase 3**: Simplify image components
4. **Phase 4**: Update electron layer
5. **Phase 5**: Update app integration
6. **Phase 6**: Clean up daemon

## Testing Strategy

1. **Unit Tests**: Test each component individually
2. **Integration Tests**: Test the full workflow from UI to daemon
3. **Performance Tests**: Ensure no memory leaks or performance issues
4. **Error Handling**: Test with invalid images, network issues, etc.

## Rollback Plan

If issues arise:
1. Keep the old thumbnail store as backup
2. Use feature flags to switch between old/new systems
3. Maintain backward compatibility during transition

## Benefits

1. **Eliminates Infinite Loops**: No more thumbnail recreation requests
2. **Simplifies Frontend**: Removes complex queue management
3. **Better UX**: Real-time progress updates
4. **Reduces IPC Calls**: Fewer round trips between frontend and daemon
5. **More Reliable**: Daemon controls processing speed
6. **Cleaner Architecture**: Event-driven design is more maintainable

## Files to Delete

- `src/stores/thumbnailStore.ts`
- `src/hooks/useImageState.tsx` (if not used elsewhere)
- Any skeleton-related components

## Files to Create

- `src/stores/imageProcessingStore.ts`
- `src/components/ImageProcessingProgress.tsx`

## Files to Modify

- `daemon-go/internal/ipc/handler.go`
- `daemon-go/internal/types/events.go`
- `src/hooks/useRealTimeImageProcessing.tsx`
- `src/components/ImageCard.tsx`
- `src/stores/images.tsx`
- `src/App.tsx`
- `src/hooks/useOpenImages.tsx`
- `electron/main.ts`
- `electron/goDaemonClient.ts`
- `electron/exposedApi.ts`
- `electron/goDaemonRendererClient.ts`

This plan provides a complete roadmap for implementing the new event-driven architecture while maintaining system stability and providing clear rollback options.