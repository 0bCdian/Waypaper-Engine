# Configuration Precedence Guide

This document explains the configuration hierarchy and precedence in the Waypaper Engine daemon.

## Configuration Hierarchy

**Priority Order (highest to lowest):**
1. **Environment Variables** (highest precedence)
2. **Playlist-specific backend configuration** 
3. **TOML Configuration file**
4. **Backend Defaults** (lowest precedence)

## Environment Variables

All environment variables override TOML configuration settings.

### Core Settings
- `WAYPAPER_DATABASE_PATH` - Override database path
- `WAYPAPER_IMAGES_DIR` - Override images directory
- `WAYPAPER_SOCKET_PATH` - Override socket path
- `WAYPAPER_LOG_LOG_LEVEL` - Override log level (debug, info, warn, error)

### Backend Settings
- `WAYPAPER_BACKEND_TYPE` - Override backend type (swww, feh, nitrogen, etc.)
- `WAYPAPER_SW_TRANSITION_DURATION` - Override SWW transition duration (milliseconds)
- `WAYPAPER_SW_TRANSITION_TYPE` - Override SWW transition type
- `WAYPAPER_RESIZE_TYPE` - Override resize type (fit, crop, fill, stretch)

### App Settings
- `WAYPAPER_IMAGES_PER_PAGE` - Override images per page
- `WAYPAPER_IMAGE_HISTORY_LIMIT` - Override image history limit

## Playlist-Specific Backend Configuration

Each playlist can override global backend settings by including a `backend` configuration in the playlist JSON:

```json
{
  "id": "gaming-playlist",
  "name": "gaming-wallpapers",
  "backend": {
    "type": "mpv",
    "config": {
      "loop": "inf",
      "volume": 0.0,
      "fullscreen": true,
      "video-only": true
    },
    "fallbackTo": "swww",
    "mediaRestrictions": {
      "allowedTypes": ["video", "image"],
      "requiredFeatures": ["hardware-decoding"]
    }
  },
  "configuration": {
    "type": "timer",
    "interval": 30,
    "filters": {
      "mediaTypes": ["video", "image"],
      "formats": ["mp4", "jpg", "png"]
    }
  },
  "images": [
    {
      "imageId": "dragon-video",
      "imagePath": "/home/user/Videos/dragon-rain.mp4",
      "mediaType": "video",
      "index": 0,
      "backendOverride": {
        "type": "mpv",
        "config": {
          "transitionDuration": 0  // No transition for video
        }
      }
    },
    {
      "imageId": "dragon-image",
      "imagePath": "/home/user/Pictures/dragon.jpg", 
      "mediaType": "image",
      "index": 1,
      "backendOverride": {
        "type": "swww",
        "config": {
          "transitionDuration": 500  // Special transition for this image
        }
      }
    }
  ]
}
```

## TOML Configuration

The main configuration file (`~/.config/waypaper-engine/config.toml`) provides defaults:

```toml
# Waypaper Engine Configuration

[app]
kill_daemon_on_exit = true
notifications = true
start_minimized = false
minimize_instead_of_close = true
random_image_monitor = "individual"
show_monitor_modal_on_start = false
images_per_page = 20
theme = "dark"
sidebar_collapsed = false
sort_by = "name"
sort_order = "asc"
image_history_limit = 50

[daemon]
database_path = "~/.config/waypaper-engine/waypaper.db"
images_dir = "~/.waypaper-engine/images"
thumbnails_dir = "~/.cache/waypaper-engine/thumbnails"
monitors_state_file = "~/.cache/waypaper-engine/monitors.json"
socket_path = "/tmp/waypaper-engine.sock"
log_level = "info"

[backend]
type = "swww"

[backend.swww]
transition_type = "simple"
transition_step = 90
transition_duration = 200  # Fast default for manual setting
transition_angle = 45
transition_pos = "center"
transition_bezier = "0.4,0.0,0.2,1"
transition_wave = "0,0,0,0"

[monitors]
selected_monitors = []
image_set_type = "individual"
```

## Backend Defaults

Each backend provides sensible defaults that are used when no TOML configuration is present.

### SWWW Defaults
```go
BackendConfig{
    BackendType: "swww",
    TransitionType: "simple",
    TransitionDuration: 200,  // 200ms - fast default
    TransitionStep: 90,
    TransitionAngle: 0,
    TransitionPos: "center",
    ResizeType: "fit",
    FillColor: "#000000",
}
```

### MPV Defaults (for video)
```go
BackendConfig{
    BackendType: "mpv",
    ResizeType: "stretch",
    CustomOptions: map[string]interface{}{
        "fullscreen": true,
        "video-only": true,
        "loop": "inf",
        "volume": 0.0,
    },
}
```

## Configuration Resolution Examples

### Example 1: Manual Image Setting
When a user manually sets an image:

1. **Start with SWWW defaults**: `transition_duration = 200ms`
2. **Apply TOML config**: `transition_duration = 500ms` (if set in config.toml)
3. **Apply environment**: `transition_duration = 1000ms` (if `WAYPAPER_SW_TRANSITION_DURATION=1000`)

**Final result**: `transition_duration = 1000ms`

### Example 2: Playlist Execution
When a playlist runs:

1. **Start with SWWW defaults**: `transition_duration = 200ms`
2. **Apply TOML config**: `transition_duration = 500ms`
3. **Apply environment**: `transition_duration = 1000ms`
4. **Apply playlist config**: `transition_duration = 2000ms` (if specified in playlist)

**Final result**: `transition_duration = 2000ms`

### Example 3: Per-image Override
When a specific image has backend override:

1. **Start with SWWW defaults**: `transition_duration = 200ms`
2. **Apply TOML config**: `transition_duration = 500ms`
3. **Apply environment**: `transition_duration = 1000ms`
4. **Apply playlist config**: `transition_duration = 2000ms`
5. **Apply image override**: `transition_duration = 3000ms` (highest precedence)

**Final result**: 'transition_duration = 3000ms'

### Example 4: Multi-media Playlist
For a playlist with both images and videos:

**Video file**:
1. **Start with MPV defaults**: `backend = mpv`, `loop = inf`
2. **Apply playlist config**: `swww as fallback`
3. **Environment might override**: `backend = mpv` (unchanged)
4. **Final**: Uses MPV for video

**Image file**:
1. **Start with SWWW defaults**: `transition_duration = 200ms`
2. **Apply playlist config**: Any playlist-specific settings
3. **Final**: Uses SWW for image

## Practical Usage Patterns

### Development Mode
```bash
export WAYPAPER_LOG_LOG_LEVEL=debug
export WAYPAPER_BACKEND_TYPE=feh  # Fast, no transitions for debugging
waypaper-daemon
```

### Production with Custom Transitions
```bash
export WAYPAPER_SW_TRANSITION_DURATION=3000
export WAYPAPER_SW_TRANSITION_TYPE=wave
waypaper-daemon
```

### Testing Different Backends
```bash
export WAYPAPER_BACKEND_TYPE=nitrogen
waypaper-daemon  # Uses nitrogen backend
```

## Best Practices

1. **Use TOML for user preferences** - Things users typically configure once
2. **Use environment variables for temporary overrides** - Testing, debugging
3. **Use playlist config for specific use cases** - Gaming vs work playlists
4. **Use per-image overrides sparingly** - Only for special cases
5. **Prefer fast defaults** - 200ms transitions for manual setting, longer for playlists

## Backward Compatibility

- ✅ **Existing TOML configs work unchanged**
- ✅ **No breaking changes to current workflows**
- ✅ **Environment variables are optional**
- ✅ **Playlist backend config is optional**
- ✅ **Falls back gracefully if configs missing**
