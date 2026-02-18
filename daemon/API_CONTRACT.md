# Waypaper Engine Daemon — API Contract

> **Transport**: HTTP over Unix domain socket  
> **Default socket**: `$XDG_RUNTIME_DIR/waypaper-engine.sock`  
> **Content-Type**: `application/json` (unless noted otherwise)  
> **Router**: [go-chi/chi](https://github.com/go-chi/chi)

---

## Table of Contents

- [Error Format](#error-format)
- [Health & System](#health--system)
- [Images](#images)
- [Wallpaper](#wallpaper)
- [Playlists](#playlists)
- [Monitors](#monitors)
- [Config](#config)
- [Backends](#backends)
- [Server-Sent Events (SSE)](#server-sent-events-sse)
- [Data Models](#data-models)
- [Enums & Constants](#enums--constants)

---

## Error Format

All error responses use:

```json
{
  "error": "human-readable message",
  "code": 400
}
```

---

## Health & System

### `GET /healthz`

Liveness probe.

**Response** `200`:
```json
{
  "status": "ok"
}
```

---

### `GET /info`

Daemon metadata.

**Response** `200`:
```json
{
  "version": "v2.0.4",
  "pid": 12345,
  "hostname": "myhost",
  "uptime": "2h15m30s",
  "go_version": "go1.23.1",
  "os": "linux",
  "arch": "amd64"
}
```

---

### `POST /shutdown`

Gracefully stops the daemon.

**Response** `200`:
```json
{
  "status": "shutting_down"
}
```

---

## Images

### `GET /images`

Paginated, sortable, filterable image gallery.

**Query Parameters**:

| Parameter    | Type   | Default       | Description                                  |
|-------------|--------|---------------|----------------------------------------------|
| `page`      | int    | `1`           | Page number (1-indexed)                      |
| `per_page`  | int    | `50`          | Items per page (max 200)                     |
| `sort_by`   | string | `imported_at` | Sort field: `name`, `imported_at`, `file_size` |
| `sort_order` | string | `desc`        | Sort direction: `asc`, `desc`                |
| `media_type` | string | —             | Filter: `image`, `video`, `gif`              |
| `search`    | string | —             | Case-insensitive fuzzy search on name/tags   |
| `tags`      | string | —             | Comma-separated tag filter                   |

**Response** `200`:
```json
{
  "data": [Image],
  "pagination": {
    "page": 1,
    "per_page": 50,
    "total_items": 120,
    "total_pages": 3
  }
}
```

See [Image model](#image).

---

### `POST /images`

Import images into the gallery. Processing happens asynchronously. Progress is reported via SSE events (`processing_started`, `image_processed`, `image_error`, `processing_complete`).

**Request Body**:
```json
{
  "paths": ["/home/user/wallpapers/photo.png", "/home/user/wallpapers/art.jpg"]
}
```

**Response** `202`:
```json
{
  "status": "processing",
  "total": 2
}
```

---

### `DELETE /images`

Delete images by ID. Removes files from disk and database.

**Request Body**:
```json
{
  "ids": [1, 5, 12]
}
```

**Response** `200`:
```json
{
  "deleted": 3
}
```

---

### `GET /images/count`

Total image count.

**Response** `200`:
```json
{
  "count": 120
}
```

---

### `GET /images/{id}`

Get a single image by ID.

**Response** `200`: [`Image`](#image) object.

**Response** `404`: Image not found.

---

### `PATCH /images/{id}`

Update mutable image fields.

**Request Body** (partial — only include fields to update):
```json
{
  "name": "new display name",
  "tags": ["landscape", "dark"],
  "is_selected": true
}
```

**Response** `200`: Updated [`Image`](#image) object.

---

### `POST /images/select-all`

Batch select/deselect all images.

**Request Body**:
```json
{
  "selected": true
}
```

**Response** `200`:
```json
{
  "updated": 120,
  "selected": true
}
```

---

### `GET /images/{id}/thumbnail`

Get the path to a thumbnail file.

**Query Parameters**:

| Parameter    | Type   | Default   | Values                                     |
|-------------|--------|-----------|--------------------------------------------|
| `resolution` | string | `default` | `default`, `720p`, `1080p`, `1440p`, `4k` |

**Response** `200`:
```json
{
  "path": "/home/user/.cache/waypaper-engine/thumbnails/1_1080p.webp"
}
```

---

### `GET /images/{id}/thumbnail/raw`

Serves the thumbnail file directly as `image/webp`.

**Query Parameters**: Same as above (`resolution`).

**Response** `200`: Binary image data (`Content-Type: image/webp`).

---

### `GET /images/{id}/raw`

Serves the original image file directly.

**Response** `200`: Binary image data (`Content-Type: image/{format}`).

---

### `GET /images/history`

Global wallpaper change history (most recent first).

**Query Parameters**:

| Parameter  | Type   | Default | Description                              |
|-----------|--------|---------|------------------------------------------|
| `limit`   | int    | `50`    | Max entries to return                    |
| `monitor` | string | —       | Filter by monitor name                   |
| `since_id` | int   | —       | Only entries with ID greater than this   |

**Response** `200`:
```json
[ImageHistoryEntry]
```

See [ImageHistoryEntry model](#imagehistoryentry).

---

## Wallpaper

### `POST /wallpaper/set`

Set a specific image as wallpaper.

**Request Body**:
```json
{
  "image_id": 2,
  "monitor": "*",
  "mode": "individual"
}
```

| Field      | Type   | Default        | Description                                   |
|-----------|--------|----------------|-----------------------------------------------|
| `image_id` | int    | **required**   | ID of the image to set                        |
| `monitor`  | string | `"*"` (all)    | Target monitor name, or `"*"` for all monitors |
| `mode`     | string | `"individual"` | Monitor mode: `individual`, `clone`, `extend`  |

**Response** `200`:
```json
{
  "status": "set",
  "image_id": 2,
  "monitor": "*",
  "mode": "individual"
}
```

---

### `POST /wallpaper/random`

Set a random image from the gallery.

**Request Body** (optional):
```json
{
  "monitor": "*",
  "mode": "individual"
}
```

**Response** `200`:
```json
{
  "status": "set",
  "image_id": 7,
  "monitor": "*",
  "mode": "individual"
}
```

---

### `POST /wallpaper/history/next`

Navigate forward in wallpaper history.

**Response** `501`: Not yet implemented.

---

### `POST /wallpaper/history/previous`

Navigate backward in wallpaper history.

**Response** `501`: Not yet implemented.

---

## Playlists

### `GET /playlists`

List all playlists.

**Response** `200`:
```json
[Playlist]
```

See [Playlist model](#playlist).

---

### `POST /playlists`

Create a new playlist.

**Request Body**:
```json
{
  "name": "Evening rotation",
  "configuration": {
    "type": "timer",
    "interval": 300,
    "order": "ordered",
    "show_animations": true,
    "always_start_on_first_image": false
  },
  "images": [
    { "image_id": 1 },
    { "image_id": 5 },
    { "image_id": 12 }
  ]
}
```

Fields `id`, `created_at`, `updated_at` are auto-generated.

For `time_of_day` playlists, each image entry includes a `time` field (minutes since midnight, 0–1439):
```json
{
  "images": [
    { "image_id": 1, "time": 0 },
    { "image_id": 5, "time": 480 },
    { "image_id": 12, "time": 1080 }
  ]
}
```

**Response** `201`: Created [`Playlist`](#playlist) object.

---

### `GET /playlists/{id}`

Get a single playlist.

**Response** `200`: [`Playlist`](#playlist) object.

---

### `PATCH /playlists/{id}`

Update playlist fields. Only provided fields are updated.

**Request Body** (partial):
```json
{
  "name": "New name",
  "configuration": { "interval": 600 },
  "images": [{ "image_id": 3 }, { "image_id": 7 }]
}
```

**Response** `200`: Updated [`Playlist`](#playlist) object.

---

### `DELETE /playlists/{id}`

Delete a playlist.

**Response** `200`:
```json
{
  "status": "deleted"
}
```

---

### `POST /playlists/{id}/start`

Start playing a playlist.

**Request Body**:
```json
{
  "monitor": {
    "id": "*",
    "mode": "individual"
  }
}
```

| Field        | Type   | Default        | Description                           |
|-------------|--------|----------------|---------------------------------------|
| `monitor.id` | string | `"*"` (all)   | Target monitor or `"*"` for all       |
| `monitor.mode` | string | `"individual"` | `individual`, `clone`, `extend`      |

**Response** `200`:
```json
{
  "status": "started"
}
```

---

### `POST /playlists/{id}/stop`

**Response** `200`: `{"status": "stopped"}`

### `POST /playlists/{id}/pause`

**Response** `200`: `{"status": "paused"}`

### `POST /playlists/{id}/resume`

**Response** `200`: `{"status": "resumed"}`

### `POST /playlists/{id}/next`

Advance to next image in the playlist.

**Response** `200`: `{"status": "advanced"}`

### `POST /playlists/{id}/previous`

Go back to previous image in the playlist.

**Response** `200`: `{"status": "rewound"}`

---

### `GET /playlists/active`

Get all currently running playlists, grouped by playlist with monitors nested inside.

**Response** `200`:
```json
[
  {
    "playlist_id": 1,
    "playlist_name": "Evening rotation",
    "current_index": 2,
    "current_image_id": 12,
    "previous_image_id": 5,
    "next_image_id": 1,
    "total_images": 3,
    "paused": false,
    "started_at": "2026-02-15T14:30:00Z",
    "next_change_at": "2026-02-15T14:35:00Z",
    "monitors": [
      { "name": "DP-1", "mode": "clone" },
      { "name": "HDMI-A-1", "mode": "clone" }
    ]
  }
]
```

See [ActivePlaylistResponse model](#activeplaylistresponse).

---

### `GET /playlists/active/{monitor}`

Get the active playlist for a specific monitor.

**Response** `200`: [`ActivePlaylistInstance`](#activeplaylistinstance) object.

**Response** `404`: No active playlist on this monitor.

---

### Bulk playlist actions

These operate on ALL active playlists across all monitors:

| Endpoint                      | Response field | Description         |
|-------------------------------|---------------|---------------------|
| `POST /playlists/active/stop`    | `stopped`     | Stop all playlists  |
| `POST /playlists/active/pause`   | `paused`      | Pause all           |
| `POST /playlists/active/resume`  | `resumed`     | Resume all          |
| `POST /playlists/active/next`    | `advanced`    | Advance all         |
| `POST /playlists/active/previous`| `reversed`    | Rewind all          |

**Response** `200` example:
```json
{
  "message": "all playlists stopped",
  "stopped": 2
}
```

---

## Monitors

### `GET /monitors`

List all connected monitors.

**Response** `200`:
```json
[Monitor]
```

See [Monitor model](#monitor).

---

### `GET /monitors/{name}`

Get a specific monitor by output name (e.g. `DP-1`).

**Response** `200`: [`Monitor`](#monitor) object.

**Response** `404`: Monitor not found.

---

## Config

### `GET /config`

Get the full daemon configuration.

**Response** `200`:
```json
{
  "app": AppConfig,
  "daemon": DaemonConfig,
  "backend": { "type": "swww" },
  "monitors": MonitorsConfig
}
```

See [Config models](#config-models).

---

### `PATCH /config`

Update multiple config sections at once.

**Request Body**:
```json
{
  "app": {
    "theme": "light",
    "images_per_page": 100
  },
  "monitors": {
    "image_set_type": "clone"
  }
}
```

**Response** `200`: Updated full config object.

Publishes `config_changed` SSE event.

---

### `GET /config/{section}`

Get a specific config section. Valid sections: `app`, `daemon`, `backend`, `monitors`.

For `backend`: returns the active backend's specific config (e.g. swww transition settings), NOT the `BackendSection` struct.

**Response** `200`: Section object or raw JSON for backend.

---

### `PATCH /config/{section}`

Update a single config section.

**For non-backend sections** — request body is `map[string]any`:
```json
{
  "theme": "dark",
  "images_per_page": 50
}
```

**Response** `200`: Updated section object.

**For `backend` section** — request body is the raw backend config JSON. It is validated by the active backend's `ValidateConfig()` before being saved:
```json
{
  "transition_type": "grow",
  "transition_duration": 2,
  "transition_fps": 144,
  "resize": "crop"
}
```

**Response** `200`:
```json
{
  "status": "updated"
}
```

Publishes `config_changed` SSE event.

---

## Backends

### `GET /backends`

List all registered backends and their availability.

**Response** `200`:
```json
[
  {
    "name": "swww",
    "available": true,
    "capabilities": {
      "compositors": ["wayland"],
      "media_types": ["image"],
      "transitions": true,
      "per_monitor": true,
      "native_extend": false,
      "daemon_process": true
    }
  },
  {
    "name": "feh",
    "available": false,
    "capabilities": {
      "compositors": ["x11"],
      "media_types": ["image"],
      "transitions": false,
      "per_monitor": true,
      "native_extend": false,
      "daemon_process": false
    }
  }
]
```

---

### `POST /backends/{name}/activate`

Switch the active wallpaper backend.

**Response** `200`:
```json
{
  "status": "activated",
  "backend": "swww"
}
```

---

## Server-Sent Events (SSE)

### `GET /events`

Persistent streaming connection. Each event has:
- `event:` — the event type string
- `data:` — JSON payload

### Event Types

#### Image Processing Events

| Event                  | Data                                                                 |
|-----------------------|----------------------------------------------------------------------|
| `processing_started`  | `{"total": 5}`                                                       |
| `image_processed`     | `{"id": 3, "name": "photo.png", "index": 1, "total": 5}`           |
| `image_error`         | `{"path": "/path/to/file.png", "error": "unsupported format"}`      |
| `processing_complete` | `{"processed": 4, "errors": 1, "total": 5}`                         |

#### Wallpaper Events

| Event               | Data                                                                           |
|--------------------|--------------------------------------------------------------------------------|
| `wallpaper_changed` | `{"image_id": 2, "monitors": ["DP-1","HDMI-A-1"], "mode": "individual", "source": "manual", "backend": "swww"}` |

#### Playlist Events

| Event                    | Data                                                        |
|-------------------------|-------------------------------------------------------------|
| `playlist_started`       | `{"playlist_id": 1, "monitor": "DP-1"}`                    |
| `playlist_stopped`       | `{"playlist_id": 1, "monitor": "DP-1"}`                    |
| `playlist_paused`        | `{"playlist_id": 1, "monitor": "DP-1"}`                    |
| `playlist_resumed`       | `{"playlist_id": 1, "monitor": "DP-1"}`                    |
| `playlist_image_changed` | `{"playlist_id": 1, "image_id": 5, "monitor": "DP-1"}`    |

#### Monitor Events

| Event                  | Data                              |
|-----------------------|-----------------------------------|
| `monitor_connected`    | `{"name": "HDMI-A-1"}`          |
| `monitor_disconnected` | `{"name": "HDMI-A-1"}`          |

#### Config Events

| Event            | Data                                    |
|-----------------|-----------------------------------------|
| `config_changed` | `{"sections": ["app", "monitors"]}`    |

#### Gallery Events

| Event              | Data  |
|-------------------|-------|
| `images_updated`   | `{}`  |
| `playlists_updated`| `{}`  |

---

## Data Models

### Image

```json
{
  "id": 1,
  "name": "sunset_wallpaper",
  "path": "/home/user/.local/share/waypaper-engine/images/sunset_wallpaper.png",
  "media_type": "image",
  "width": 3840,
  "height": 2160,
  "format": "png",
  "file_size": 8542190,
  "checksum": "sha256:abc123...",
  "tags": ["landscape", "sunset"],
  "imported_at": "2026-02-15T14:30:00Z",
  "source_path": "/home/user/Pictures/sunset.png",
  "is_selected": false,
  "thumbnails": {
    "default": "/home/user/.cache/waypaper-engine/thumbnails/1_default.webp",
    "720p": "/home/user/.cache/waypaper-engine/thumbnails/1_720p.webp",
    "1080p": "/home/user/.cache/waypaper-engine/thumbnails/1_1080p.webp",
    "1440p": "/home/user/.cache/waypaper-engine/thumbnails/1_1440p.webp",
    "4k": "/home/user/.cache/waypaper-engine/thumbnails/1_4k.webp"
  }
}
```

---

### ImageHistoryEntry

```json
{
  "id": 42,
  "image_id": 2,
  "image_name": "sunset_wallpaper",
  "monitors": ["DP-1", "HDMI-A-1"],
  "mode": "individual",
  "set_at": "2026-02-15T14:30:00Z",
  "source": {
    "type": "manual"
  },
  "backend": "swww"
}
```

The `source` object varies by type:

| `source.type` | Extra fields                                        |
|---------------|-----------------------------------------------------|
| `manual`      | —                                                   |
| `random`      | —                                                   |
| `playlist`    | `playlist_id` (int), `playlist_name` (string)       |
| `history`     | `history_id` (int)                                  |
| `restore`     | — (set during daemon startup wallpaper restore)     |

---

### Playlist

```json
{
  "id": 1,
  "name": "Evening rotation",
  "created_at": "2026-02-15T10:00:00Z",
  "updated_at": "2026-02-15T14:30:00Z",
  "configuration": {
    "type": "timer",
    "interval": 300,
    "order": "ordered",
    "show_animations": true,
    "always_start_on_first_image": false
  },
  "images": [
    { "image_id": 1 },
    { "image_id": 5 },
    { "image_id": 12 }
  ]
}
```

**Playlist configuration types**:

| `type`         | Behavior                                                     |
|---------------|--------------------------------------------------------------|
| `timer`       | Rotates every `interval` seconds. `order`: `ordered`/`random`|
| `manual`      | Only changes on explicit next/previous calls                 |
| `time_of_day` | Each image has a `time` (minutes since midnight, 0–1439)     |
| `day_of_week` | Each image maps to a day (0=Sunday through 6=Saturday)       |

For `time_of_day`, images include the `time` field:
```json
{ "image_id": 1, "time": 480 }
```

---

### ActivePlaylistInstance

Per-monitor representation, returned by `GET /playlists/active/{monitor}`:

```json
{
  "playlist_id": 1,
  "playlist_name": "Evening rotation",
  "current_index": 2,
  "current_image_id": 12,
  "previous_image_id": 5,
  "next_image_id": 1,
  "total_images": 3,
  "paused": false,
  "mode": "individual",
  "started_at": "2026-02-15T14:30:00Z",
  "next_change_at": "2026-02-15T14:35:00Z"
}
```

### ActivePlaylistResponse

Playlist-centric representation, returned by `GET /playlists/active`:

```json
{
  "playlist_id": 1,
  "playlist_name": "Evening rotation",
  "current_index": 2,
  "current_image_id": 12,
  "previous_image_id": 5,
  "next_image_id": 1,
  "total_images": 3,
  "paused": false,
  "started_at": "2026-02-15T14:30:00Z",
  "next_change_at": "2026-02-15T14:35:00Z",
  "monitors": [
    { "name": "DP-1", "mode": "clone" },
    { "name": "HDMI-A-1", "mode": "clone" }
  ]
}
```

`previous_image_id`, `next_image_id`, and `next_change_at` may be `null`.

---

### Monitor

```json
{
  "name": "DP-1",
  "width": 2560,
  "height": 1440,
  "x": 0,
  "y": 0,
  "scale": 1.0,
  "refresh_rate": 165.0,
  "transform": 0
}
```

`transform` values: `0`=normal, `1`=90°, `2`=180°, `3`=270°, `4`=flipped, `5`=flipped-90°, `6`=flipped-180°, `7`=flipped-270°.

---

### Config Models

#### AppConfig

```json
{
  "kill_daemon_on_exit": false,
  "notifications": true,
  "start_minimized": false,
  "minimize_instead_of_close": false,
  "images_per_page": 50,
  "theme": "dark",
  "image_history_limit": 100,
  "sort_by": "imported_at",
  "sort_order": "desc"
}
```

#### DaemonConfig

```json
{
  "images_dir": "~/.local/share/waypaper-engine/images",
  "thumbnails_dir": "~/.cache/waypaper-engine/thumbnails",
  "database_dir": "~/.local/share/waypaper-engine/db",
  "socket_path": "/run/user/1000/waypaper-engine.sock",
  "log_level": "info",
  "log_file": "~/.local/share/waypaper-engine/daemon.log",
  "log_max_size_mb": 10,
  "log_max_backups": 3,
  "compositor": "auto"
}
```

#### BackendSection

```json
{
  "type": "swww"
}
```

Note: `GET /config/backend` returns the **active backend's specific config** (see below), not this object.

#### swww Backend Config

Returned by `GET /config/backend` when the active backend is `swww`. Updated by `PATCH /config/backend`.

```json
{
  "transition_type": "wipe",
  "transition_step": 90,
  "transition_duration": 3,
  "transition_fps": 60,
  "transition_angle": 45,
  "transition_pos": "center",
  "transition_bezier": "0.25,0.1,0.25,1.0",
  "transition_wave": "20,20",
  "resize": "crop",
  "fill_color": "000000",
  "filter_type": "Lanczos3",
  "invert_y": false
}
```

TOML config supports both hyphens and underscores (e.g. `transition-type` and `transition_type` are equivalent).

#### MonitorsConfig

```json
{
  "selected_monitors": ["DP-1", "HDMI-A-1"],
  "image_set_type": "individual"
}
```

---

## Enums & Constants

### Monitor Modes

| Value        | Description                                          |
|-------------|------------------------------------------------------|
| `individual` | Set wallpaper on a single specific monitor           |
| `clone`      | Same image on every monitor                          |
| `extend`     | Span one image across all monitors (auto-sliced)     |

### Playlist Types

| Value          | Description                              |
|---------------|------------------------------------------|
| `timer`        | Rotates on interval (seconds)            |
| `manual`       | Next/previous only                       |
| `time_of_day`  | Image per time slot (minutes since midnight) |
| `day_of_week`  | Image per weekday                        |

### Playlist Order

| Value     | Description              |
|----------|--------------------------|
| `ordered` | Sequential playback      |
| `random`  | Random shuffle           |

### swww Transition Types

`none`, `simple`, `fade`, `left`, `right`, `top`, `bottom`, `wipe`, `wave`, `grow`, `center`, `any`, `outer`, `random`

### swww Transition Positions

`center`, `top`, `bottom`, `left`, `right`, `top-left`, `top-right`, `bottom-left`, `bottom-right`

### swww Resize Types

`crop`, `fit`, `no`, `stretch`

### swww Filter Types

`Lanczos3`, `Bilinear`, `CatmullRom`, `Mitchell`, `Nearest`

### Compositor Types

`wayland`, `x11`

### History Source Types

`manual`, `random`, `playlist`, `history`, `restore`

---

## Default File Paths (XDG)

| Purpose        | Default path                                          |
|---------------|-------------------------------------------------------|
| Config file    | `$XDG_CONFIG_HOME/waypaper-engine/config.toml`       |
| Unix socket    | `$XDG_RUNTIME_DIR/waypaper-engine.sock`              |
| Images cache   | `$XDG_DATA_HOME/waypaper-engine/images`              |
| Thumbnails     | `$XDG_CACHE_HOME/waypaper-engine/thumbnails`         |
| Database       | `$XDG_DATA_HOME/waypaper-engine/db`                  |
| Log file       | `$XDG_DATA_HOME/waypaper-engine/daemon.log`          |
| PID lock       | `$XDG_RUNTIME_DIR/waypaper-engine.pid`               |

Typical Linux defaults: `$XDG_CONFIG_HOME` = `~/.config`, `$XDG_DATA_HOME` = `~/.local/share`, `$XDG_CACHE_HOME` = `~/.cache`, `$XDG_RUNTIME_DIR` = `/run/user/<uid>`.
