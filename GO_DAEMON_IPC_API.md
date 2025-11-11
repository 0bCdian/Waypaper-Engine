# Go Daemon IPC API Documentation

**Version:** 2.0.0  
**Last Updated:** November 11, 2025  
**Purpose:** Complete API reference for frontend integration with the Go daemon

---

## Table of Contents

1. [Overview](#overview)
2. [Connection & Communication](#connection--communication)
3. [Protocol Structure](#protocol-structure)
4. [Message Categories](#message-categories)
5. [System Operations](#system-operations)
6. [Playlist Operations](#playlist-operations)
7. [Image Operations](#image-operations)
8. [Configuration Operations](#configuration-operations)
9. [Miscellaneous Operations](#miscellaneous-operations)
10. [Event System](#event-system)
11. [Validation Rules](#validation-rules)
12. [Error Handling](#error-handling)
13. [Examples & Patterns](#examples--patterns)

---

## Overview

The Go daemon communicates with the frontend via **Unix Domain Socket** (on Linux) using a JSON-based IPC protocol. All communication is asynchronous and follows a request-response pattern, with additional real-time event broadcasting.

### Key Concepts

- **Socket Path:** `/tmp/waypaper-engine.sock` (configurable via `config.toml`)
- **Protocol:** JSON messages over Unix socket
- **Message Format:** All requests use the `Message` structure
- **Response Format:** All responses use the `Response` structure
- **Events:** Real-time events are broadcast to subscribed clients

### Communication Flow

```
Frontend                  Daemon
   |                        |
   |----[Message]---------->|
   |                        | (Process)
   |<---[Response]----------|
   |                        |
   |<====[Events]===========| (Broadcast)
```

---

## Connection & Communication

### Establishing Connection

```typescript
// Connect to Unix socket
const socket = new Net.Socket();
socket.connect('/tmp/waypaper-engine.sock', () => {
  console.log('Connected to daemon');
});

// Handle incoming data
socket.on('data', (data) => {
  const response = JSON.parse(data.toString());
  handleResponse(response);
});
```

### Message ID System

Use `messageId` to correlate requests with responses:

```typescript
let messageIdCounter = 1;

function sendMessage(action: string, payload: any) {
  const message = {
    action,
    messageId: messageIdCounter++,
    ...payload
  };
  socket.write(JSON.stringify(message) + '\n');
}
```

---

## Protocol Structure

### Message Structure

**TypeScript Interface:**

```typescript
interface Message {
  // Required
  action: string;                    // Action to perform
  
  // Optional
  messageId?: number;                // Request tracking
  playlistId?: number;               // Playlist identifier
  playlistName?: string;             // Playlist name
  playlist?: RendererPlaylist;       // Playlist data
  imageIds?: number[];               // Array of image IDs
  imagePaths?: string[];             // Array of file paths
  fileNames?: string[];              // Array of file names
  image?: ImageInfo;                 // Image metadata
  activeMonitor?: MonitorSelection;  // Monitor configuration
  monitors?: string[];               // Monitor names array
  monitorName?: string;              // Single monitor name
  config?: ConfigData;               // Configuration data
  eventTypes?: string[];             // Event subscriptions
}
```

### Response Structure

**TypeScript Interface:**

```typescript
interface Response {
  action: string;        // Original action or "pong"
  messageId?: number;    // Matches request messageId
  data?: any;            // Response payload (varies by action)
  error?: string;        // Error message if operation failed
}
```

### Common Sub-structures

#### MonitorSelection

```typescript
interface MonitorSelection {
  id: string;              // Unique identifier (monitor name or "*")
  monitors: Monitor[];     // Array of selected monitors
  mode: MonitorMode;       // How to apply image
}

type MonitorMode = "individual" | "clone" | "extend";

interface Monitor {
  name: string;
  width: number;
  height: number;
  x?: number;
  y?: number;
  scale?: number;
}
```

#### RendererPlaylist

```typescript
interface RendererPlaylist {
  name: string;
  images: RendererImage[];
  configuration: PlaylistConfiguration;
  activeMonitor?: MonitorSelection;
}

interface RendererImage {
  id: number;
  time?: number;  // For time_of_day playlists (minutes since midnight, 0-1439)
}

interface PlaylistConfiguration {
  type: PlaylistType;
  interval?: number;              // Seconds for timer playlists
  order?: "ordered" | "random";
  showAnimations: boolean;
  alwaysStartOnFirstImage: boolean;
  currentImageIndex: number;
}

type PlaylistType = "timer" | "never" | "manual" | "time_of_day" | "day_of_week" 
                  | "timeofday" | "dayofweek";  // Legacy formats supported
```

#### ImageInfo

```typescript
interface ImageInfo {
  id: number;
  name: string;
}
```

#### ConfigData

```typescript
interface ConfigData {
  // For single key updates (legacy)
  configSection?: string;  // "app" | "daemon" | "backend" | "monitors"
  configKey?: string;
  configValue?: any;
  
  // For partial bulk updates (modern)
  frontendConfig?: {
    app?: Partial<AppConfig>;
    daemon?: Partial<DaemonConfig>;
    backend?: Partial<BackendConfig>;
    monitors?: Partial<MonitorsConfig>;
  };
}
```

---

## Message Categories

All IPC actions organized by category:

### System (7 actions)
- `ping` - Health check
- `get_info` - Daemon information
- `get_diagnostics` - Playlist diagnostics
- `get_monitors` - Monitor information
- `get_daemon_status` - Status summary
- `kill_daemon` - Terminate daemon
- `stop_daemon` - Graceful shutdown

### Playlists (13 actions)
- `get_playlists` - List all playlists
- `get_playlist` - Get single playlist
- `upsert_playlist` / `save_playlist` - Create/update playlist
- `delete_playlist` - Delete playlist
- `start_playlist` - Start playlist
- `stop_playlist` - Stop playlist
- `pause_playlist` - Pause playlist
- `resume_playlist` - Resume playlist
- `next_playlist_image` - Next image
- `previous_playlist_image` - Previous image
- `get_running_playlists` - List active playlists
- `get_active_playlist` (legacy) - Redirects to `get_running_playlists`
- `get_playlist_images` (legacy) - Redirects to `get_playlist`

### Images (6 actions)
- `get_images` - List all images
- `process_images` - Import images
- `delete_images` / `delete_image_from_gallery` - Delete images
- `upsert_image` - Update image
- `get_image_history` - Image history
- `process_for_monitors` - Process image for monitors

### Configuration (5 actions)
- `get_config` - Get configuration
- `upsert_config` / `set_config` - Update configuration
- `set_selected_monitor` - Set monitor selection
- `get_selected_monitor` - Get monitor selection

### Miscellaneous (6 actions)
- `set_image` - Set image manually
- `set_image_across_monitors` - Split image across monitors
- `next_image_history` - Navigate history forward
- `previous_image_history` - Navigate history backward
- `random_image` - Set random image

### Event Subscription (2 actions)
- `subscribe` - Subscribe to events
- `unsubscribe` - Unsubscribe from events

---

## System Operations

### ping

**Purpose:** Health check / connection test

**Request:**
```json
{
  "action": "ping",
  "messageId": 1
}
```

**Response:**
```json
{
  "action": "pong",
  "messageId": 1,
  "data": "pong"
}
```

---

### get_info

**Purpose:** Get daemon information

**Request:**
```json
{
  "action": "get_info"
}
```

**Response:**
```json
{
  "action": "get_info",
  "data": {
    "status": "running",
    "version": "2.0.0"
  }
}
```

---

### get_monitors

**Purpose:** Get connected monitor information

**Request:**
```json
{
  "action": "get_monitors"
}
```

**Response:**
```json
{
  "action": "get_monitors",
  "data": [
    {
      "name": "DP-1",
      "width": 2560,
      "height": 1440,
      "x": 0,
      "y": 0,
      "scale": 1.0,
      "refreshRate": 144
    },
    {
      "name": "HDMI-1",
      "width": 1920,
      "height": 1080,
      "x": 2560,
      "y": 0,
      "scale": 1.0,
      "refreshRate": 60
    }
  ]
}
```

---

### get_daemon_status

**Purpose:** Get comprehensive daemon status

**Request:**
```json
{
  "action": "get_daemon_status"
}
```

**Response:**
```json
{
  "action": "get_daemon_status",
  "data": {
    "running": true,
    "uptime": "unknown",
    "version": "2.0.0",
    "monitors": 2,
    "playlists": 1,
    "images": 150
  }
}
```

---

### get_diagnostics

**Purpose:** Get playlist diagnostics (all monitors or specific monitor)

**Request (all monitors):**
```json
{
  "action": "get_diagnostics"
}
```

**Request (specific monitor):**
```json
{
  "action": "get_diagnostics",
  "monitorName": "DP-1"
}
```

**Response (specific monitor):**
```json
{
  "action": "get_diagnostics",
  "data": {
    "monitor": "DP-1",
    "playlistId": 12345,
    "playlistName": "Nature Wallpapers",
    "currentIndex": 3,
    "paused": false,
    "totalImages": 20,
    "status": "ok"
  }
}
```

**Response (all monitors):**
```json
{
  "action": "get_diagnostics",
  "data": {
    "DP-1": { /* diagnostics */ },
    "HDMI-1": { /* diagnostics */ }
  }
}
```

---

### kill_daemon / stop_daemon

**Purpose:** Terminate daemon process

**Request:**
```json
{
  "action": "kill_daemon"
}
```

**Response:**
```json
{
  "action": "kill_daemon",
  "data": "daemon_kill_requested"
}
```

**Note:** Actual termination is handled by main process after response.

---

## Playlist Operations

### get_playlists

**Purpose:** List all saved playlists

**Request:**
```json
{
  "action": "get_playlists"
}
```

**Response:**
```json
{
  "action": "get_playlists",
  "data": [
    {
      "id": "playlist_1699999999",
      "name": "Nature Wallpapers",
      "metadata": {
        "version": "1.0",
        "createdAt": "2025-11-10T10:00:00Z",
        "lastModified": "2025-11-10T15:30:00Z"
      },
      "configuration": {
        "type": "timer",
        "interval": 300,
        "showAnimations": true,
        "alwaysStartOnFirstImage": false,
        "order": "ordered"
      },
      "images": [
        {
          "imageId": "1",
          "imagePath": "/path/to/image1.jpg",
          "mediaType": "image",
          "index": 0,
          "addedAt": "2025-11-10T10:00:00Z"
        }
      ]
    }
  ]
}
```

---

### get_playlist

**Purpose:** Get single playlist by ID

**Request:**
```json
{
  "action": "get_playlist",
  "playlistId": 1699999999
}
```

**Response:**
```json
{
  "action": "get_playlist",
  "data": {
    "id": "playlist_1699999999",
    "name": "Nature Wallpapers",
    /* ...full playlist data... */
  }
}
```

**Error Response:**
```json
{
  "action": "get_playlist",
  "error": "playlist ID is required"
}
```

---

### upsert_playlist (save_playlist)

**Purpose:** Create or update a playlist

**Request:**
```json
{
  "action": "upsert_playlist",
  "playlist": {
    "name": "My New Playlist",
    "images": [
      { "id": 1, "time": null },
      { "id": 5, "time": null },
      { "id": 12, "time": null }
    ],
    "configuration": {
      "type": "timer",
      "interval": 600,
      "order": "ordered",
      "showAnimations": true,
      "alwaysStartOnFirstImage": false,
      "currentImageIndex": 0
    }
  }
}
```

**Request (TIME_OF_DAY playlist):**
```json
{
  "action": "upsert_playlist",
  "playlist": {
    "name": "Daily Schedule",
    "images": [
      { "id": 1, "time": 480 },   // 8:00 AM
      { "id": 2, "time": 720 },   // 12:00 PM
      { "id": 3, "time": 1020 }   // 5:00 PM
    ],
    "configuration": {
      "type": "time_of_day",
      "showAnimations": true,
      "alwaysStartOnFirstImage": false,
      "currentImageIndex": 0
    }
  }
}
```

**Response:**
```json
{
  "action": "upsert_playlist",
  "data": {
    "id": "playlist_1731310000",
    "name": "My New Playlist",
    "message": "playlist saved successfully"
  }
}
```

**Error Response:**
```json
{
  "action": "upsert_playlist",
  "error": "image with ID 999 not found"
}
```

**Events Emitted:**
- `playlists_updated` with action "saved"

---

### delete_playlist

**Purpose:** Delete a playlist by name

**Request:**
```json
{
  "action": "delete_playlist",
  "playlistName": "My Old Playlist"
}
```

**Response:**
```json
{
  "action": "delete_playlist",
  "data": "playlist deleted"
}
```

**Error Response:**
```json
{
  "action": "delete_playlist",
  "error": "playlist not found"
}
```

**Events Emitted:**
- `playlists_updated` with action "deleted"

---

### start_playlist

**Purpose:** Start a playlist on specified monitor(s)

**Request (single monitor):**
```json
{
  "action": "start_playlist",
  "playlistId": 1699999999,
  "activeMonitor": {
    "id": "DP-1",
    "monitors": [
      {
        "name": "DP-1",
        "width": 2560,
        "height": 1440
      }
    ],
    "mode": "individual"
  }
}
```

**Request (extend mode - split image):**
```json
{
  "action": "start_playlist",
  "playlistId": 1699999999,
  "activeMonitor": {
    "id": "DP-1_HDMI-1",
    "monitors": [
      { "name": "DP-1", "width": 2560, "height": 1440 },
      { "name": "HDMI-1", "width": 1920, "height": 1080 }
    ],
    "mode": "extend"
  }
}
```

**Response:**
```json
{
  "action": "start_playlist",
  "data": "playlist started"
}
```

**What Happens:**
1. Daemon loads playlist configuration from JSON store
2. Checks playlist type: `timer`, `never`, `time_of_day`, or `day_of_week`
3. Stops any conflicting playlists on overlapping monitors
4. Starts appropriate execution:
   - **timer:** Starts goroutine with `time.Ticker` for automatic rotation
   - **time_of_day:** Binary search for current time image, schedules next change
   - **day_of_week:** Sets image for current weekday, schedules midnight change
   - **never/manual:** Sets first image, no automatic rotation

**Events Emitted:**
- `playlist_started`
- `wallpaper_changed` (when first image is set)

---

### stop_playlist

**Purpose:** Stop a running playlist

**Request (by monitor):**
```json
{
  "action": "stop_playlist",
  "activeMonitor": {
    "id": "DP-1",
    "monitors": [],
    "mode": "individual"
  }
}
```

**Request (by playlist name):**
```json
{
  "action": "stop_playlist",
  "playlistName": "Nature Wallpapers"
}
```

**Request (by monitor names):**
```json
{
  "action": "stop_playlist",
  "monitors": ["DP-1", "HDMI-1"]
}
```

**Request (all monitors):**
```json
{
  "action": "stop_playlist",
  "activeMonitor": {
    "id": "*",
    "monitors": [],
    "mode": "individual"
  }
}
```

**Response:**
```json
{
  "action": "stop_playlist",
  "data": "playlist stopped"
}
```

**What Happens:**
1. Finds running playlist instance
2. Stops timer/ticker if running
3. Closes goroutine channels
4. Removes instance from active playlists
5. Emits `playlist_stopped` event

**Events Emitted:**
- `playlist_stopped`

---

### pause_playlist

**Purpose:** Pause automatic rotation (keeps current image)

**Request:**
```json
{
  "action": "pause_playlist",
  "activeMonitor": {
    "id": "DP-1",
    "monitors": [],
    "mode": "individual"
  }
}
```

**Request (all monitors):**
```json
{
  "action": "pause_playlist",
  "activeMonitor": {
    "id": "*",
    "monitors": [],
    "mode": "individual"
  }
}
```

**Response:**
```json
{
  "action": "pause_playlist",
  "data": "playlist paused"
}
```

**What Happens:**
1. Sets `Paused = true` on instance
2. Stops ticker (for timer playlists)
3. Goroutine continues running but doesn't advance images

**Events Emitted:**
- `playlist_paused`

---

### resume_playlist

**Purpose:** Resume automatic rotation from current position

**Request:**
```json
{
  "action": "resume_playlist",
  "activeMonitor": {
    "id": "DP-1",
    "monitors": [],
    "mode": "individual"
  }
}
```

**Request (all monitors):**
```json
{
  "action": "resume_playlist",
  "activeMonitor": {
    "id": "*",
    "monitors": [],
    "mode": "individual"
  }
}
```

**Response:**
```json
{
  "action": "resume_playlist",
  "data": "playlist resumed"
}
```

**What Happens:**
1. Sets `Paused = false` on instance
2. Restarts ticker (for timer playlists)
3. Goroutine resumes advancing images

**Events Emitted:**
- `playlist_resumed`

---

### next_playlist_image

**Purpose:** Manually advance to next image in playlist

**Request:**
```json
{
  "action": "next_playlist_image",
  "activeMonitor": {
    "id": "DP-1",
    "monitors": [],
    "mode": "individual"
  }
}
```

**Request (all monitors):**
```json
{
  "action": "next_playlist_image",
  "activeMonitor": {
    "id": "*",
    "monitors": [],
    "mode": "individual"
  }
}
```

**Response:**
```json
{
  "action": "next_playlist_image",
  "data": "image changed"
}
```

**What Happens:**
1. Calculates next index: `(currentIndex + 1) % totalImages`
2. Sets wallpaper for that image
3. Updates `currentIndex` on instance

**Events Emitted:**
- `playlist_image_changed`
- `wallpaper_changed`

---

### previous_playlist_image

**Purpose:** Manually go to previous image in playlist

**Request:**
```json
{
  "action": "previous_playlist_image",
  "activeMonitor": {
    "id": "DP-1",
    "monitors": [],
    "mode": "individual"
  }
}
```

**Response:**
```json
{
  "action": "previous_playlist_image",
  "data": "image changed"
}
```

**What Happens:**
1. Calculates previous index: `(currentIndex - 1 + totalImages) % totalImages`
2. Sets wallpaper for that image
3. Updates `currentIndex` on instance

**Events Emitted:**
- `playlist_image_changed`
- `wallpaper_changed`

---

### get_running_playlists (get_active_playlist)

**Purpose:** Get information about all currently running playlists

**Request:**
```json
{
  "action": "get_running_playlists"
}
```

**Response:**
```json
{
  "action": "get_running_playlists",
  "data": {
    "DP-1": {
      "playlist_id": 1699999999,
      "playlist_name": "Nature Wallpapers",
      "active_monitor": {
        "id": "DP-1",
        "monitors": [/* ... */],
        "mode": "individual"
      },
      "paused": false
    },
    "HDMI-1": {
      "playlist_id": 1700000000,
      "playlist_name": "Cityscapes",
      "active_monitor": {
        "id": "HDMI-1",
        "monitors": [/* ... */],
        "mode": "individual"
      },
      "paused": true
    }
  }
}
```

**Note:** `get_active_playlist` is legacy and redirects to `get_running_playlists`

---

## Image Operations

### get_images

**Purpose:** Get all images from gallery

**Request:**
```json
{
  "action": "get_images"
}
```

**Response:**
```json
{
  "action": "get_images",
  "data": [
    {
      "id": 1,
      "name": "sunset.jpg",
      "path": "/home/user/.cache/waypaper-engine/images/sunset.jpg",
      "thumbnailPath": "/home/user/.cache/waypaper-engine/thumbnails/sunset.jpg",
      "width": 3840,
      "height": 2160,
      "size": 2457600,
      "format": "jpeg",
      "addedAt": "2025-11-10T10:00:00Z",
      "tags": ["nature", "sunset"],
      "metadata": {
        "photographer": "John Doe"
      }
    }
  ]
}
```

---

### process_images

**Purpose:** Import images into the gallery (copy to cache, generate thumbnails)

**Request:**
```json
{
  "action": "process_images",
  "imagePaths": [
    "/home/user/Pictures/photo1.jpg",
    "/home/user/Pictures/photo2.png"
  ],
  "fileNames": [
    "photo1.jpg",
    "photo2.png"
  ]
}
```

**Response:**
```json
{
  "action": "process_images",
  "data": [
    {
      "fileName": "photo1.jpg",
      "width": 3840,
      "height": 2160,
      "format": "jpeg"
    },
    {
      "fileName": "photo2.png",
      "width": 2560,
      "height": 1440,
      "format": "png"
    }
  ]
}
```

**What Happens:**
1. Generates unique file names (if conflicts exist)
2. Copies images to cache directory (`~/.cache/waypaper-engine/images/`)
3. Generates default thumbnails
4. Creates smart resolution thumbnails for monitor resolutions
5. Adds images to JSON gallery

**Events Emitted (per image):**
- `image_processed` with metadata
- `processing_complete` at end
- `images_updated` with total count

---

### delete_images (delete_image_from_gallery)

**Purpose:** Delete images from gallery and storage

**Request:**
```json
{
  "action": "delete_images",
  "imageIds": [1, 5, 12]
}
```

**Response:**
```json
{
  "action": "delete_images",
  "data": "images deleted"
}
```

**What Happens:**
1. Removes images from JSON gallery
2. Deletes image files from cache directory
3. Deletes thumbnail files

**Events Emitted:**
- `images_updated` with total deleted

**Note:** `delete_image_from_gallery` is legacy and redirects to `delete_images`

---

### upsert_image

**Purpose:** Update image metadata (currently only name)

**Request:**
```json
{
  "action": "upsert_image",
  "image": {
    "id": 5,
    "name": "Beautiful Sunset.jpg"
  }
}
```

**Response:**
```json
{
  "action": "upsert_image",
  "data": "image updated"
}
```

**Note:** Protocol currently only supports ID and name. For tags/metadata updates, protocol needs extension.

---

### get_image_history

**Purpose:** Get recently set wallpapers (newest first)

**Request:**
```json
{
  "action": "get_image_history"
}
```

**Response:**
```json
{
  "action": "get_image_history",
  "data": [
    {
      "imageId": "5",
      "timestamp": "2025-11-11T15:30:00Z",
      "monitorName": "DP-1"
    },
    {
      "imageId": "3",
      "timestamp": "2025-11-11T15:00:00Z",
      "monitorName": "DP-1"
    }
  ]
}
```

**Note:** Limit is configurable via `app.image_history_limit` (default 50)

---

### process_for_monitors

**Purpose:** Process image for multi-monitor setup (preview/calculation)

**Request:**
```json
{
  "action": "process_for_monitors",
  "image": { "id": 5 },
  "activeMonitor": {
    "id": "DP-1_HDMI-1",
    "monitors": [
      { "name": "DP-1", "width": 2560, "height": 1440 },
      { "name": "HDMI-1", "width": 1920, "height": 1080 }
    ],
    "mode": "extend"
  }
}
```

**Response:**
```json
{
  "action": "process_for_monitors",
  "data": {
    "DP-1": "<base64 image data>",
    "HDMI-1": "<base64 image data>"
  }
}
```

**Note:** Used for preview before actually setting wallpaper.

---

## Configuration Operations

### get_config

**Purpose:** Get complete daemon configuration

**Request:**
```json
{
  "action": "get_config"
}
```

**Response:**
```json
{
  "action": "get_config",
  "data": {
    "app": {
      "kill_daemon_on_exit": false,
      "notifications": true,
      "start_minimized": false,
      "minimize_instead_of_close": true,
      "show_monitor_modal_on_start": false,
      "images_per_page": 50,
      "theme": "dark",
      "sort_by": "name",
      "sort_order": "asc",
      "image_history_limit": 50
    },
    "daemon": {
      "database_path": "/home/user/.local/share/waypaper-engine/waypaper.db",
      "images_dir": "/home/user/.cache/waypaper-engine/images",
      "thumbnails_dir": "/home/user/.cache/waypaper-engine/thumbnails",
      "monitors_state_file": "/home/user/.local/share/waypaper-engine/monitors.json",
      "socket_path": "/tmp/waypaper-engine.sock",
      "log_level": "info",
      "log_file": "/home/user/.local/share/waypaper-engine/daemon.log",
      "log_max_size": 10,
      "log_max_age": 7,
      "log_max_backups": 3,
      "compositor": "wayland"
    },
    "backend": {
      "type": "swww",
      "swww": {
        "transition_type": "fade",
        "transition_step": 90,
        "transition_duration": 2,
        "transition_angle": 0,
        "transition_pos": "center",
        "transition_bezier": "0.4,0.0,0.6,1.0",
        "transition_wave": "20,20"
      }
    },
    "monitors": {
      "selected_monitors": ["DP-1"],
      "image_set_type": "individual"
    }
  }
}
```

---

### upsert_config (set_config)

**Purpose:** Update configuration (single key or bulk partial update)

**Request (single key - legacy):**
```json
{
  "action": "upsert_config",
  "config": {
    "configSection": "app",
    "configKey": "theme",
    "configValue": "light"
  }
}
```

**Request (partial bulk update - modern):**
```json
{
  "action": "upsert_config",
  "config": {
    "frontendConfig": {
      "app": {
        "theme": "light",
        "notifications": true,
        "images_per_page": 100
      },
      "backend": {
        "type": "swww"
      }
    }
  }
}
```

**Response (single key):**
```json
{
  "action": "upsert_config",
  "data": true
}
```

**Response (bulk update):**
```json
{
  "action": "upsert_config",
  "data": {
    "updated_sections": ["app", "backend"],
    "success": true
  }
}
```

**Events Emitted:**
- `config_changed` for each updated section

**Type Validation:**

The daemon validates types before applying:
- `bool` fields must be boolean
- `int` fields must be numeric
- `string` fields must be string
- `[]string` fields must be string array

**Note:** `set_config` is legacy and redirects to `upsert_config`

---

### set_selected_monitor

**Purpose:** Set active monitor selection

**Request:**
```json
{
  "action": "set_selected_monitor",
  "activeMonitor": {
    "id": "DP-1",
    "monitors": [
      {
        "name": "DP-1",
        "width": 2560,
        "height": 1440
      }
    ],
    "mode": "individual"
  }
}
```

**Response:**
```json
{
  "action": "set_selected_monitor",
  "data": "monitor configuration updated"
}
```

**What Happens:**
1. Validates monitor configuration
2. Updates in-memory state
3. Saves to TOML config for persistence

**Validation Rules:**
- `individual`: Exactly 1 monitor required
- `clone` or `extend`: At least 2 monitors required

---

### get_selected_monitor

**Purpose:** Get currently selected monitor configuration

**Request:**
```json
{
  "action": "get_selected_monitor"
}
```

**Response:**
```json
{
  "action": "get_selected_monitor",
  "data": {
    "id": "DP-1",
    "monitors": [/* ... */],
    "mode": "individual"
  }
}
```

---

## Miscellaneous Operations

### set_image

**Purpose:** Manually set an image as wallpaper

**Request (individual mode):**
```json
{
  "action": "set_image",
  "image": { "id": 5 },
  "activeMonitor": {
    "id": "DP-1",
    "monitors": [
      { "name": "DP-1", "width": 2560, "height": 1440 }
    ],
    "mode": "individual"
  }
}
```

**Request (clone mode - same image on all monitors):**
```json
{
  "action": "set_image",
  "image": { "id": 5 },
  "activeMonitor": {
    "id": "DP-1_HDMI-1",
    "monitors": [
      { "name": "DP-1", "width": 2560, "height": 1440 },
      { "name": "HDMI-1", "width": 1920, "height": 1080 }
    ],
    "mode": "clone"
  }
}
```

**Request (extend mode - split image across monitors):**
```json
{
  "action": "set_image",
  "image": { "id": 5 },
  "activeMonitor": {
    "id": "DP-1_HDMI-1",
    "monitors": [
      { "name": "DP-1", "width": 2560, "height": 1440, "x": 0, "y": 0 },
      { "name": "HDMI-1", "width": 1920, "height": 1080, "x": 2560, "y": 0 }
    ],
    "mode": "extend"
  }
}
```

**Response:**
```json
{
  "action": "set_image",
  "data": "image changed"
}
```

**What Happens:**

- **individual:** Sets image on each selected monitor separately (full image)
- **clone:** Sets same image on all monitors (duplicate, full image)
- **extend:** Splits image into N parts and sets them in order (multi-monitor wallpaper)

**Side Effects:**
1. Adds entry to image history
2. Resets history navigation state
3. Stops any running playlist on those monitors

**Events Emitted:**
- `wallpaper_changed`

---

### set_image_across_monitors

**Purpose:** Explicitly split image across monitors (extend mode)

**Request:**
```json
{
  "action": "set_image_across_monitors",
  "image": { "id": 5 },
  "activeMonitor": {
    "id": "DP-1_HDMI-1",
    "monitors": [
      { "name": "DP-1", "width": 2560, "height": 1440, "x": 0, "y": 0 },
      { "name": "HDMI-1", "width": 1920, "height": 1080, "x": 2560, "y": 0 }
    ],
    "mode": "extend"
  }
}
```

**Response:**
```json
{
  "action": "set_image_across_monitors",
  "data": "image set across monitors"
}
```

**Note:** This is equivalent to `set_image` with `mode: "extend"`.

---

### next_image_history

**Purpose:** Navigate to next (newer) image in history

**Request:**
```json
{
  "action": "next_image_history",
  "activeMonitor": {
    "id": "DP-1",
    "monitors": [],
    "mode": "individual"
  }
}
```

**Response:**
```json
{
  "action": "next_image_history",
  "data": "image changed from history"
}
```

**Error Response:**
```json
{
  "action": "next_image_history",
  "error": "already at oldest image in history"
}
```

**How It Works:**
- History is stored newest-first (index 0 = most recent)
- Next = index + 1 (older entry)
- State is tracked per monitor

---

### previous_image_history

**Purpose:** Navigate to previous (older) image in history

**Request:**
```json
{
  "action": "previous_image_history",
  "activeMonitor": {
    "id": "DP-1",
    "monitors": [],
    "mode": "individual"
  }
}
```

**Response:**
```json
{
  "action": "previous_image_history",
  "data": "image changed from history"
}
```

**Error Response:**
```json
{
  "action": "previous_image_history",
  "error": "already at newest image in history"
}
```

**How It Works:**
- Previous = index - 1 (newer entry)
- State is tracked per monitor

---

### random_image

**Purpose:** Set a random image from gallery

**Request:**
```json
{
  "action": "random_image",
  "activeMonitor": {
    "id": "DP-1",
    "monitors": [],
    "mode": "individual"
  }
}
```

**Request (all monitors):**
```json
{
  "action": "random_image",
  "activeMonitor": {
    "id": "*",
    "monitors": [],
    "mode": "individual"
  }
}
```

**Response:**
```json
{
  "action": "random_image",
  "data": "image changed"
}
```

**What Happens:**
1. Loads all images from gallery
2. Selects random image using `math/rand`
3. Sets it as wallpaper

---

## Event System

### Event Types

The daemon broadcasts real-time events to subscribed clients.

**Event Structure:**

```typescript
interface Event {
  type: EventType;
  payload: any;
}
```

**Available Event Types:**

```typescript
// Image Processing
"processing_started"
"image_processed"
"image_progress"
"image_error"
"processing_complete"

// Playlist Events
"playlist_started"
"playlist_stopped"
"playlist_paused"
"playlist_resumed"
"playlist_image_changed"

// Wallpaper Events
"wallpaper_changed"
"image_changed"

// Monitor Events
"monitor_changed"
"monitor_disconnected"

// Configuration Events
"config_changed"

// Gallery Events
"images_updated"
"playlists_updated"
```

### subscribe

**Purpose:** Subscribe to specific event types

**Request:**
```json
{
  "action": "subscribe",
  "eventTypes": [
    "playlist_started",
    "playlist_stopped",
    "wallpaper_changed"
  ]
}
```

**Request (subscribe to all events):**
```json
{
  "action": "subscribe",
  "eventTypes": ["*"]
}
```

**Response:**
```json
{
  "action": "subscribe",
  "data": "subscribed to events"
}
```

### unsubscribe

**Purpose:** Unsubscribe from event types

**Request:**
```json
{
  "action": "unsubscribe",
  "eventTypes": ["wallpaper_changed"]
}
```

**Request (unsubscribe from all):**
```json
{
  "action": "unsubscribe",
  "eventTypes": ["*"]
}
```

**Response:**
```json
{
  "action": "unsubscribe",
  "data": "unsubscribed from events"
}
```

### Receiving Events

Events are sent as JSON on the same socket connection:

```typescript
socket.on('data', (data) => {
  const message = JSON.parse(data.toString());
  
  // Check if it's an event (has "type" but not "action")
  if (message.type && !message.action) {
    handleEvent(message);
  } else {
    handleResponse(message);
  }
});

function handleEvent(event: Event) {
  switch (event.type) {
    case 'playlist_started':
      console.log('Playlist started:', event.payload);
      break;
    case 'wallpaper_changed':
      console.log('Wallpaper changed:', event.payload);
      break;
    // ... handle other events
  }
}
```

### Event Payloads

**playlist_started:**
```json
{
  "type": "playlist_started",
  "payload": {
    "playlistID": 1699999999,
    "monitorName": "DP-1"
  }
}
```

**playlist_stopped:**
```json
{
  "type": "playlist_stopped",
  "payload": {
    "monitorName": "DP-1",
    "playlistID": 1699999999
  }
}
```

**playlist_image_changed:**
```json
{
  "type": "playlist_image_changed",
  "payload": {
    "monitorName": "DP-1",
    "playlistID": 1699999999,
    "imageIndex": 3,
    "imageID": "5"
  }
}
```

**image_processed:**
```json
{
  "type": "image_processed",
  "payload": {
    "originalFileName": "photo.jpg",
    "uniqueFileName": "photo_1.jpg",
    "width": 3840,
    "height": 2160,
    "format": "jpeg"
  }
}
```

**images_updated:**
```json
{
  "type": "images_updated",
  "payload": {
    "totalAdded": 5
  }
}
```

**playlists_updated:**
```json
{
  "type": "playlists_updated",
  "payload": {
    "action": "saved",
    "playlistId": "playlist_1699999999",
    "playlistName": "Nature Wallpapers"
  }
}
```

**config_changed:**
```json
{
  "type": "config_changed",
  "payload": {
    "section": "app",
    "key": "theme",
    "value": "light",
    "timestamp": 1699999999
  }
}
```

---

## Validation Rules

The daemon validates all incoming messages before processing.

### Playlist Validation

**Playlist Types:**
- Valid: `"timer"`, `"never"`, `"manual"`, `"time_of_day"`, `"day_of_week"`, `"timeofday"`, `"dayofweek"`

**Playlist Order:**
- Valid: `"ordered"`, `"random"`

**Timer Playlists:**
- `interval` must be positive integer (seconds)
- `interval` required for `type: "timer"`

**TIME_OF_DAY Playlists:**
- Each image must have `time` field
- `time` must be 0-1439 (minutes since midnight)
- Images should be sorted by time (ascending)

**DAY_OF_WEEK Playlists:**
- Should have 7 images (one per day) but can have fewer
- Images indexed 0-6 (Sunday-Saturday)

### Monitor Validation

**MonitorSelection:**
- `id` required
- `monitors` array required (non-empty)
- `mode` must be "individual", "clone", or "extend"

**Mode Requirements:**
- `individual`: Exactly 1 monitor
- `clone`: At least 2 monitors
- `extend`: At least 2 monitors + position (x, y) for each

### Image Validation

**ImageInfo:**
- `id` must be positive integer
- `name` must be non-empty string (if provided)

**Image Processing:**
- `imagePaths` and `fileNames` arrays must have same length
- File paths must be valid, readable files

### Configuration Validation

**Type Validation:**
- Boolean fields reject non-boolean values
- Integer fields reject non-numeric values
- String fields reject non-string values
- Array fields reject non-array values

**Backend Config:**
- `type` must be "swww", "hyprpaper", "swaybg", etc.
- SWWW transition types: "none", "simple", "fade", "wipe", "grow", "wave", etc.

---

## Error Handling

### Error Response Format

All errors are returned in the `error` field of the response:

```json
{
  "action": "start_playlist",
  "error": "missing playlist ID or monitor info"
}
```

### Common Error Messages

**Missing Required Fields:**
```json
{ "error": "playlist ID is required" }
{ "error": "active monitor is required" }
{ "error": "image and activeMonitor are required" }
{ "error": "missing image or monitor info" }
```

**Not Found:**
```json
{ "error": "playlist not found" }
{ "error": "image with ID 999 not found" }
{ "error": "no playlist running on monitor DP-1" }
```

**Invalid Data:**
```json
{ "error": "playlist type must be one of: timer, never, manual, time_of_day, day_of_week" }
{ "error": "invalid monitor configuration" }
{ "error": "expected string, got number" }
```

**State Errors:**
```json
{ "error": "playlist Nature Wallpapers is empty (no images)" }
{ "error": "already at oldest image in history" }
{ "error": "no image history available" }
```

**File Operations:**
```json
{ "error": "failed to load playlists: permission denied" }
{ "error": "processing failed: invalid image format" }
```

### Error Handling Best Practices

1. **Always check for error field:**
```typescript
if (response.error) {
  console.error('Operation failed:', response.error);
  showErrorNotification(response.error);
  return;
}
// Process response.data
```

2. **Handle validation errors gracefully:**
```typescript
// Validate before sending
if (!playlistId || !activeMonitor) {
  showError('Missing required fields');
  return;
}
```

3. **Retry on transient failures:**
```typescript
async function sendWithRetry(message, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    const response = await send(message);
    if (!response.error) return response;
    
    if (response.error.includes('temporary')) {
      await sleep(1000 * (i + 1)); // Exponential backoff
      continue;
    }
    throw new Error(response.error);
  }
}
```

---

## Examples & Patterns

### Complete Workflow Examples

#### Example 1: Import and Set Wallpaper

```typescript
// 1. Import images
const importResponse = await send({
  action: 'process_images',
  imagePaths: ['/home/user/Pictures/sunset.jpg'],
  fileNames: ['sunset.jpg']
});

if (importResponse.error) {
  console.error('Import failed:', importResponse.error);
  return;
}

// 2. Get image ID (from get_images or process response)
const imagesResponse = await send({
  action: 'get_images'
});

const image = imagesResponse.data.find(img => img.name === 'sunset.jpg');

// 3. Set as wallpaper
const setResponse = await send({
  action: 'set_image',
  image: { id: image.id },
  activeMonitor: {
    id: 'DP-1',
    monitors: [{ name: 'DP-1', width: 2560, height: 1440 }],
    mode: 'individual'
  }
});

console.log('Wallpaper set!');
```

#### Example 2: Create and Start Timer Playlist

```typescript
// 1. Create playlist
const createResponse = await send({
  action: 'upsert_playlist',
  playlist: {
    name: 'My Slideshow',
    images: [
      { id: 1 },
      { id: 5 },
      { id: 12 }
    ],
    configuration: {
      type: 'timer',
      interval: 300, // 5 minutes
      order: 'ordered',
      showAnimations: true,
      alwaysStartOnFirstImage: false,
      currentImageIndex: 0
    }
  }
});

const playlistId = parseInt(createResponse.data.id.split('_')[1]);

// 2. Start playlist
await send({
  action: 'start_playlist',
  playlistId: playlistId,
  activeMonitor: {
    id: 'DP-1',
    monitors: [{ name: 'DP-1', width: 2560, height: 1440 }],
    mode: 'individual'
  }
});

console.log('Playlist started and will rotate every 5 minutes!');
```

#### Example 3: Subscribe to Events and Handle Updates

```typescript
// Subscribe to relevant events
await send({
  action: 'subscribe',
  eventTypes: [
    'playlist_started',
    'playlist_stopped',
    'wallpaper_changed',
    'playlist_image_changed'
  ]
});

// Handle events
socket.on('data', (data) => {
  const lines = data.toString().split('\n').filter(l => l.trim());
  
  lines.forEach(line => {
    const message = JSON.parse(line);
    
    if (message.type) {
      // It's an event
      handleEvent(message);
    } else if (message.action) {
      // It's a response
      handleResponse(message);
    }
  });
});

function handleEvent(event) {
  switch (event.type) {
    case 'playlist_started':
      updateUI({ playlistRunning: true });
      showNotification('Playlist started');
      break;
      
    case 'wallpaper_changed':
      refreshPreview();
      break;
      
    case 'playlist_image_changed':
      updateCurrentIndex(event.payload.imageIndex);
      break;
  }
}
```

#### Example 4: Multi-Monitor Setup (Extend Mode)

```typescript
// Get monitors first
const monitorsResponse = await send({
  action: 'get_monitors'
});

const monitors = monitorsResponse.data; // [{ name: 'DP-1', ... }, { name: 'HDMI-1', ... }]

// Set image across monitors (split mode)
await send({
  action: 'set_image',
  image: { id: 5 },
  activeMonitor: {
    id: 'DP-1_HDMI-1',
    monitors: monitors,
    mode: 'extend'
  }
});

console.log('Image split across all monitors!');
```

#### Example 5: TIME_OF_DAY Playlist

```typescript
// Create time-of-day playlist
await send({
  action: 'upsert_playlist',
  playlist: {
    name: 'Daily Schedule',
    images: [
      { id: 1, time: 480 },   // 8:00 AM morning wallpaper
      { id: 2, time: 720 },   // 12:00 PM afternoon wallpaper
      { id: 3, time: 1020 },  // 5:00 PM evening wallpaper
      { id: 4, time: 1320 }   // 10:00 PM night wallpaper
    ],
    configuration: {
      type: 'time_of_day',
      showAnimations: true,
      alwaysStartOnFirstImage: false,
      currentImageIndex: 0
    }
  }
});

// Start it - will automatically show correct image for current time
await send({
  action: 'start_playlist',
  playlistId: playlistId,
  activeMonitor: { /* ... */ }
});

console.log('TIME_OF_DAY playlist started - images will change at scheduled times!');
```

### Helper Functions

```typescript
// Type-safe message sender
async function sendMessage<T = any>(action: string, payload?: any): Promise<Response<T>> {
  return new Promise((resolve, reject) => {
    const messageId = ++messageIdCounter;
    const message = { action, messageId, ...payload };
    
    // Store promise resolver
    pendingRequests.set(messageId, { resolve, reject });
    
    // Send message
    socket.write(JSON.stringify(message) + '\n');
    
    // Timeout after 30 seconds
    setTimeout(() => {
      if (pendingRequests.has(messageId)) {
        pendingRequests.delete(messageId);
        reject(new Error('Request timeout'));
      }
    }, 30000);
  });
}

// Response handler
socket.on('data', (data) => {
  const lines = data.toString().split('\n').filter(l => l.trim());
  
  lines.forEach(line => {
    const message = JSON.parse(line);
    
    if (message.messageId && pendingRequests.has(message.messageId)) {
      const { resolve } = pendingRequests.get(message.messageId);
      pendingRequests.delete(message.messageId);
      resolve(message);
    } else if (message.type) {
      eventBus.emit(message.type, message.payload);
    }
  });
});

// Usage
const monitors = await sendMessage<Monitor[]>('get_monitors');
const images = await sendMessage<Image[]>('get_images');
```

---

## Migration from Node.js Daemon

### Key Differences

1. **Playlist Types:**
   - Old: `"timeofday"`, `"dayofweek"`
   - New: `"time_of_day"`, `"day_of_week"` (legacy formats still work)

2. **Timer Intervals:**
   - Old: Milliseconds
   - New: Seconds

3. **Monitor Selection:**
   - Must use `MonitorSelection` structure with `mode` field

4. **Image Processing:**
   - Now returns detailed metadata immediately
   - Smart thumbnail generation included

5. **Event System:**
   - Must explicitly subscribe to events
   - Events separated from responses

### Backward Compatibility

The Go daemon maintains backward compatibility for:
- ✅ Legacy action names (`save_playlist`, `delete_image_from_gallery`, etc.)
- ✅ Legacy playlist types (`timeofday`, `dayofweek`)
- ✅ Legacy config format
- ✅ Existing JSON database structure

---

## Performance Considerations

### Best Practices

1. **Batch Operations:**
```typescript
// Good: Batch image processing
await send({
  action: 'process_images',
  imagePaths: [...all paths...],
  fileNames: [...all names...]
});

// Bad: Process one at a time
for (const path of paths) {
  await send({ action: 'process_images', imagePaths: [path], ... });
}
```

2. **Event Subscription:**
```typescript
// Good: Subscribe to only needed events
await send({
  action: 'subscribe',
  eventTypes: ['playlist_started', 'wallpaper_changed']
});

// Avoid: Subscribe to all events unless necessary
await send({
  action: 'subscribe',
  eventTypes: ['*']
});
```

3. **Monitor Queries:**
```typescript
// Cache monitor list, only refresh on monitor_changed event
let cachedMonitors = await send({ action: 'get_monitors' });

eventBus.on('monitor_changed', async () => {
  cachedMonitors = await send({ action: 'get_monitors' });
});
```

---

## Troubleshooting

### Common Issues

**1. Socket Connection Fails**
```
Error: ENOENT: no such file or directory, connect '/tmp/waypaper-engine.sock'
```
**Solution:** Check if daemon is running: `ps aux | grep waypaper-engine`

**2. Message Not Responded**
```
Error: Request timeout
```
**Solution:** Check daemon logs for errors, verify message format

**3. Validation Errors**
```
{ "error": "playlist type must be one of: ..." }
```
**Solution:** Review validation rules section, check field types

**4. Image Not Found**
```
{ "error": "image with ID 999 not found" }
```
**Solution:** Call `get_images` first to get valid IDs

**5. Monitor Not Found**
```
{ "error": "no playlist running on monitor DP-1" }
```
**Solution:** Check monitor name matches output from `get_monitors`

---

## Appendix

### Full Type Definitions

```typescript
// Complete TypeScript definitions for frontend integration

interface Message {
  action: string;
  messageId?: number;
  playlistId?: number;
  playlistName?: string;
  playlist?: RendererPlaylist;
  imageIds?: number[];
  imagePaths?: string[];
  fileNames?: string[];
  image?: ImageInfo;
  activeMonitor?: MonitorSelection;
  monitors?: string[];
  monitorName?: string;
  config?: ConfigData;
  eventTypes?: string[];
}

interface Response<T = any> {
  action: string;
  messageId?: number;
  data?: T;
  error?: string;
}

interface Event<T = any> {
  type: EventType;
  payload: T;
}

type EventType = 
  | "processing_started"
  | "image_processed"
  | "image_progress"
  | "image_error"
  | "processing_complete"
  | "playlist_started"
  | "playlist_stopped"
  | "playlist_paused"
  | "playlist_resumed"
  | "playlist_image_changed"
  | "wallpaper_changed"
  | "image_changed"
  | "monitor_changed"
  | "monitor_disconnected"
  | "config_changed"
  | "images_updated"
  | "playlists_updated";

interface MonitorSelection {
  id: string;
  monitors: Monitor[];
  mode: "individual" | "clone" | "extend";
}

interface Monitor {
  name: string;
  width: number;
  height: number;
  x?: number;
  y?: number;
  scale?: number;
  refreshRate?: number;
}

interface RendererPlaylist {
  name: string;
  images: RendererImage[];
  configuration: PlaylistConfiguration;
  activeMonitor?: MonitorSelection;
}

interface RendererImage {
  id: number;
  time?: number;
}

interface PlaylistConfiguration {
  type: "timer" | "never" | "manual" | "time_of_day" | "day_of_week" | "timeofday" | "dayofweek";
  interval?: number;
  order?: "ordered" | "random";
  showAnimations: boolean;
  alwaysStartOnFirstImage: boolean;
  currentImageIndex: number;
}

interface ImageInfo {
  id: number;
  name: string;
}

interface Image {
  id: number;
  name: string;
  path: string;
  thumbnailPath: string;
  width: number;
  height: number;
  size: number;
  format: string;
  addedAt: string;
  tags?: string[];
  metadata?: Record<string, any>;
}

interface Playlist {
  id: string;
  name: string;
  metadata: {
    version: string;
    createdAt: string;
    lastModified: string;
  };
  configuration: {
    type: string;
    interval?: number;
    showAnimations: boolean;
    alwaysStartOnFirstImage: boolean;
    order: string;
  };
  images: PlaylistImage[];
}

interface PlaylistImage {
  imageId: string;
  imagePath: string;
  mediaType: string;
  index: number;
  addedAt: string;
  time?: number;
}

interface ConfigData {
  configSection?: string;
  configKey?: string;
  configValue?: any;
  frontendConfig?: {
    app?: Partial<AppConfig>;
    daemon?: Partial<DaemonConfig>;
    backend?: Partial<BackendConfig>;
    monitors?: Partial<MonitorsConfig>;
  };
}

interface WaypaperConfig {
  app: AppConfig;
  daemon: DaemonConfig;
  backend: BackendConfig;
  monitors: MonitorsConfig;
}

// ... (full config interfaces)
```

---

## Support & Resources

- **GitHub:** [waypaper-engine repository]
- **Documentation:** [Full project documentation]
- **Issues:** Report bugs and feature requests on GitHub
- **Logs:** Check `~/.local/share/waypaper-engine/daemon.log` for daemon errors

---

**End of Documentation**

*This document covers the complete IPC API for the Go daemon v2.0.0. For implementation questions, refer to the source code in `daemon-go/internal/ipc/`.*

