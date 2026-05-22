# Waypaper Engine Daemon — API Contract

> **See also (generated / structural docs):** [daemon architecture](docs/ARCHITECTURE.md) · [OpenAPI map](docs/openapi.yaml) (machine-readable path index) · [improvement backlog](docs/architectural-improvements.md)

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
- [Folders](#folders)
- [Monitors](#monitors)
- [Config](#config)
- [Backends](#backends)
- [Server-Sent Events (SSE)](#server-sent-events-sse)
- [Electron Renderer Bridge Notes](#electron-renderer-bridge-notes)
- [Data Models](#data-models)
- [Enums & Constants](#enums--constants)

---

## Error Format

All error responses use:

```json
{
  "error": "human-readable message",
  "code": 400,
  "details": "optional additional context"
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
  "go_version": "go1.26",
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

| Parameter     | Type   | Default       | Description                                                                                                    |
| ------------- | ------ | ------------- | -------------------------------------------------------------------------------------------------------------- |
| `page`        | int    | `1`           | Page number (1-indexed)                                                                                        |
| `per_page`    | int    | `50`          | Items per page (max 200)                                                                                       |
| `sort_by`     | string | `imported_at` | Sort field: `name`, `imported_at`, `file_size`                                                                 |
| `sort_order`  | string | `desc`        | Sort direction: `asc`, `desc`                                                                                  |
| `media_type`  | string | —             | Filter: `image`, `video`, `gif`                                                                                |
| `search`      | string | —             | Case-insensitive fuzzy search on name/tags                                                                     |
| `tags`        | string | —             | Comma-separated tag filter                                                                                     |
| `colors`      | string | —             | Comma-separated dominant color filter (hex; each must appear as a swatch, AND)                                 |
| `colors_near` | string | —             | Comma-separated `#hex~maxDeltaE` perceptual match (CIE76 vs stored palette; AND); forces in-memory filter path |
| `folder_id`   | string | —             | Folder filter (`root`/`0` for root, or ID)                                                                     |

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
  "paths": ["/home/user/wallpapers/photo.png", "/home/user/wallpapers/art.jpg"],
  "folder_id": 12
}
```

**Response** `202`:

```json
{
  "status": "processing",
  "total": 2,
  "batch_id": "db7f4388-4a6d-4a66-b27a-39c8a3f67e49"
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

### `GET /images/{id}`

Get a single image by ID.

**Response** `200`: [`Image`](#image) object.

**Response** `404`: Image not found.

---

### `PATCH /images/{id}`

Update mutable image fields. Renaming (display name + underlying file) is handled here — there is no separate rename endpoint.

**Request Body** (partial — only include fields to update):

```json
{
  "name": "new display name",
  "tags": ["landscape", "dark"],
  "colors": ["#1a2b3c", "#fefefe"],
  "folder_id": 4,
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

### `GET /images/tags`

Returns all distinct tags across stored images.

**Response** `200`:

```json
{
  "tags": ["landscape", "anime", "dark"]
}
```

---

### `POST /images/cancel-import`

Cancel an in-flight image import batch.

**Request Body**:

```json
{
  "batch_id": "db7f4388-4a6d-4a66-b27a-39c8a3f67e49"
}
```

**Response** `200`:

```json
{
  "status": "cancelled",
  "batch_id": "db7f4388-4a6d-4a66-b27a-39c8a3f67e49"
}
```

---

### `GET /images/{id}/thumbnail`

Get the path to a thumbnail file.

**Query Parameters**:

| Parameter    | Type   | Default   | Values                                    |
| ------------ | ------ | --------- | ----------------------------------------- |
| `resolution` | string | `default` | `default`, `720p`, `1080p`, `1440p`, `4k` |

**Response** `200`:

```json
{
  "path": "/home/user/.cache/waypaper-engine/thumbnails/1_1080p.webp"
}
```

---

### `GET /images/{id}/raw`

Serves the original image file directly.

**Response** `200`: Binary image data (`Content-Type: image/{format}`).

---

### `GET /images/history`

Global wallpaper change history (most recent first).

**Query Parameters**:

| Parameter  | Type   | Default | Description                            |
| ---------- | ------ | ------- | -------------------------------------- |
| `limit`    | int    | `50`    | Max entries to return                  |
| `monitor`  | string | —       | Filter by monitor name                 |
| `since_id` | int    | —       | Only entries with ID greater than this |

**Response** `200`:

```json
[ImageHistoryEntry]
```

See [ImageHistoryEntry model](#imagehistoryentry).

---

### `DELETE /images/history`

Clear global wallpaper history.

**Response** `200`:

```json
{
  "status": "cleared"
}
```

Publishes `history_cleared` SSE event.

---

## Wallpaper

### `GET /wallpaper/current`

Current wallpaper summary for the **active** backend only. Persisted rows from other
backends are omitted so scripts do not see stale monitor keys after switching backends.

Within that backend, `monitors` includes only rows whose `monitor_name` matches a
**currently connected** display (same list as `GET /monitors`). Orphaned persisted
keys from older naming schemes (e.g. `Monitor 0` vs `DP-1`) are omitted. If monitor
detection fails or returns no outputs, the filter is skipped and all rows for the
active backend are returned (best-effort).

**Response** `200`:

```json
{
  "backend": "awww",
  "image_id": 2,
  "image_name": "sunset_wallpaper",
  "image_path": "/home/user/.local/share/waypaper-engine/images/sunset_wallpaper.png",
  "mode": "clone",
  "monitors": [
    {
      "monitor_name": "DP-1",
      "image_id": 2,
      "image_name": "sunset_wallpaper",
      "image_path": "/home/user/.local/share/waypaper-engine/images/sunset_wallpaper.png",
      "set_at": "2026-02-15T14:30:00Z"
    }
  ],
  "set_at": "2026-02-15T14:30:00Z"
}
```

Top-level `image_*`, `mode`, and `set_at` come from the monitor row with the newest
`set_at` among the included rows (tie-break: lexicographic `monitor_name`). `monitors`
is sorted by `monitor_name`. When nothing is set for the active backend (after
filters), `monitors` is `[]` and `set_at` is omitted.

See [MonitorState](#monitorstate) for the persisted per-monitor document shape (internal).

---

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

| Field      | Type   | Default        | Description                                    |
| ---------- | ------ | -------------- | ---------------------------------------------- |
| `image_id` | int    | **required**   | ID of the image to set                         |
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

### Local Spec v0 Compatibility (Wayland-Utani Web Wallpapers)

This section is additive and provisional. It documents how a first-party
`wal-qt` backend can expose local web wallpapers while remaining
compatible with the existing gallery + wallpaper APIs.

Compatibility goals:

- Keep existing endpoints and core payloads valid (`/images`, `/wallpaper/set`).
- Preserve `image_id` as the selector for `POST /wallpaper/set`.
- Extend metadata, not control semantics.

Provisional media extension:

- `Image.media_type` may include `"web"` in addition to existing values.
- `GET /images` `media_type` filter may include `"web"` for compatible backends.

Provisional sidecar metadata shape for `media_type="web"`:

```json
{
  "kind": "web",
  "source": {
    "package_root": "/abs/path/to/package",
    "manifest_path": "/abs/path/to/package/project.json",
    "entry_path": "/abs/path/to/package/index.html",
    "preview_path": "/abs/path/to/package/preview.jpg"
  },
  "engine": {
    "type": "wallpaper_engine_web",
    "version": 1,
    "workshop_id": "1234567890",
    "workshop_url": "https://steamcommunity.com/..."
  },
  "properties": {},
  "validation": {
    "warnings": [],
    "missing_assets": []
  }
}
```

Set semantics remain unchanged:

- Client still calls `POST /wallpaper/set` with `{ "image_id": <id> }`.
- Backend resolves image by ID and dispatches appropriate renderer path based on
  media type (`image` vs `web`).

When the active backend is **wal-qt**, `SyncRuntimeFromConfig` pushes `POST /settings/network` on the host control socket so global HTML allow matches config. That call can cause the host to **reload** active HTML wallpaper webviews when **effective** outbound `network` permission changes (brief flicker).

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
    "always_start_on_first_image": false
  },
  "images": [{ "image_id": 1 }, { "image_id": 5 }, { "image_id": 12 }]
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

| Field          | Type   | Default        | Description                     |
| -------------- | ------ | -------------- | ------------------------------- |
| `monitor.id`   | string | `"*"` (all)    | Target monitor or `"*"` for all |
| `monitor.mode` | string | `"individual"` | `individual`, `clone`, `extend` |

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

Get all currently running playlists as active instances.

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
    "mode": "clone",
    "started_at": "2026-02-15T14:30:00Z",
    "next_change_at": "2026-02-15T14:35:00Z",
    "monitors": ["DP-1", "HDMI-A-1"]
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

| Endpoint                          | Response field | Description        |
| --------------------------------- | -------------- | ------------------ |
| `POST /playlists/active/stop`     | `stopped`      | Stop all playlists |
| `POST /playlists/active/pause`    | `paused`       | Pause all          |
| `POST /playlists/active/resume`   | `resumed`      | Resume all         |
| `POST /playlists/active/next`     | `advanced`     | Advance all        |
| `POST /playlists/active/previous` | `reversed`     | Rewind all         |

**Response** `200` example:

```json
{
  "message": "all playlists stopped",
  "stopped": 2
}
```

---

## Folders

### `GET /folders`

List folders. Supports hierarchy filtering and search.

**Query Parameters**:

| Parameter   | Type   | Default | Description                                         |
| ----------- | ------ | ------- | --------------------------------------------------- |
| `parent_id` | string | —       | Parent folder id, or `root` / `null` for root level |
| `search`    | string | —       | Name search (returns matching folders only)         |

**Response** `200`:

```json
{
  "data": [Folder]
}
```

---

### `POST /folders`

Create a folder.

**Request Body**:

```json
{
  "name": "Landscapes",
  "parent_id": null
}
```

**Response** `201`: Created [`Folder`](#folder) object.

---

### `POST /folders/move-images`

Move images to a folder (or root when `folder_id` is `null`).

**Request Body**:

```json
{
  "image_ids": [1, 2, 3],
  "folder_id": 12
}
```

**Response** `200`:

```json
{
  "moved": 3
}
```

---

### `GET /folders/{id}`

Get a folder by ID.

**Response** `200`: [`Folder`](#folder) object.

---

### `PATCH /folders/{id}`

Update folder fields (`name`, `parent_id`).

**Request Body** (partial):

```json
{
  "name": "Favorites",
  "parent_id": 4
}
```

**Response** `200`: Updated [`Folder`](#folder) object.

---

### `DELETE /folders/{id}`

Delete a folder.

**Query Parameters**:

| Parameter | Type   | Default         | Description                                                          |
| --------- | ------ | --------------- | -------------------------------------------------------------------- |
| `mode`    | string | `keep_contents` | `keep_contents` re-parents content, `delete_all` recursively deletes |

**Response** `200`:

```json
{
  "deleted": true,
  "mode": "keep_contents"
}
```

---

### `GET /folders/{id}/path`

Get the full folder path from root to the folder.

**Response** `200`:

```json
{
  "data": [Folder]
}
```

---

## Monitors

### `GET /monitors`

List all connected monitors.

Each entry’s `name` is the compositor output identifier (for example `HDMI-A-1`, `eDP-1`). When the active backend is **`wal-qt`**, names come directly from the host’s control API topology (not synthetic `Monitor N` labels).

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
  "backend": { "type": "awww" },
  "monitors": MonitorsConfig,
  "wallhaven": WallhavenConfig
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

Publishes one `config_changed` SSE event per updated section (each with that section name in `sections`).

---

### `GET /config/{section}`

Get a specific TOML config section. Typical names: `app`, `daemon`, `monitors`, `wallhaven`. The top-level `backend` key in the full config is the small [`BackendSection`](#backendsection) object (only `type`), not per-renderer settings.

**Path `section=backend`**: `404` — the old active-backend alias for renderer JSON is removed. Use [`GET /config/backends/{backend}`](#get-configbackendsbackend).

**Response** `200`: Section object.

**Response** `404`: Unknown section (including path `backend`).

---

### `PATCH /config/{section}`

Update a single TOML config section. Request body is `map[string]any` for the section's fields.

**Path `section=backend`**: `404` — do not use this path for renderer JSON. Use [`PATCH /config/backends/{backend}`](#patch-configbackendsbackend).

**Response** `200`: Updated section object.

Publishes one `config_changed` SSE event per successful call (with that section in `sections`).

---

### `GET /config/backends/{backend}`

Returns the persisted configuration JSON for a **named** registered backend (e.g. `awww`, `mpvpaper`, `wal-qt`). This is the preferred way to read per-renderer settings for any backend, not only the active one.

**Path**: `{backend}` is the registry name (URL-encoded if needed, e.g. `wal-qt`).

**Response** `200`: Same JSON shape as the legacy active-only backend body (flat map of that backend’s options).

**Response** `404`: Unknown backend name (not in the registry).

---

### `PATCH /config/backends/{backend}`

Updates a named backend’s subsection. Body is a JSON object merged into that backend’s config; it is validated with that backend’s `ValidateConfig()` before save.

**Runtime sync**: when `{backend}` equals the **currently active** backend, the daemon rebuilds the current snapshot and calls `backend.Apply` so the new config takes effect immediately.

**Response** `200`: `{"status":"updated"}` (or equivalent success body used elsewhere for config patches).

Publishes `config_changed` SSE event.

**Preferred** for all per-renderer JSON reads and writes (active or inactive backend).

---

## Backends

### `GET /backends`

List all registered backends and their availability.

**Response** `200`:

```json
[
  {
    "name": "wal-qt",
    "available": true,
    "active": true,
    "capabilities": {
      "content_kinds": ["static_image", "gif", "video", "web_wallpaper"],
      "compositors": ["wayland"]
    }
  },
  {
    "name": "awww",
    "available": true,
    "active": false,
    "capabilities": {
      "content_kinds": ["static_image", "gif"],
      "compositors": ["wayland"]
    }
  },
  {
    "name": "feh",
    "available": false,
    "active": false,
    "capabilities": {
      "content_kinds": ["static_image"],
      "compositors": ["x11"]
    }
  },
  {
    "name": "mpvpaper",
    "available": true,
    "active": false,
    "capabilities": {
      "content_kinds": ["video"],
      "compositors": ["wayland"]
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
  "backend": "awww"
}
```

---

## Server-Sent Events (SSE)

### `GET /events`

Persistent streaming connection. Each event has:

- `event:` — the event type string
- `data:` — JSON payload

`data` payloads always include a `timestamp` field (injected server-side).

### Event Types

#### Image Processing Events

| Event                  | Data                                                                                                                  |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `processing_started`   | `{"batch_id":"...","total":5,"timestamp":"..."}`                                                                      |
| `image_processed`      | `{"batch_id":"...","image":{...},"current":1,"total":5,"elapsed_ms":91,"timestamp":"..."}`                            |
| `image_error`          | `{"batch_id":"...","path":"/path/to/file.png","error":"...","current":1,"total":5,"elapsed_ms":12,"timestamp":"..."}` |
| `processing_complete`  | `{"batch_id":"...","total":5,"succeeded":4,"failed":1,"elapsed_ms":901,"timestamp":"..."}`                            |
| `processing_cancelled` | `{"batch_id":"...","total":5,"succeeded":2,"failed":1,"elapsed_ms":420,"timestamp":"..."}`                            |

#### Wallpaper Events

| Event               | Data                                                                                                                                                                                                                                                                                                                                                                                                |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `wallpaper_changed` | `{"image_id": 2, "media_type": "image", "path": "/var/.../gallery/file.jpg", "tags": ["anime","sky"], "colors": ["#abc123"]?, "monitors": ["DP-1","HDMI-A-1"], "mode": "individual", "source": "manual", "backend": "awww"}` — `media_type` is `image` (includes GIF), `web`, or `video`; `colors` is only present when the gallery row has a non-empty palette; `path` is the cached gallery file. |

#### Playlist Events

| Event                    | Data                                                   |
| ------------------------ | ------------------------------------------------------ |
| `playlist_started`       | `{"playlist_id": 1, "monitor": "DP-1"}`                |
| `playlist_stopped`       | `{"playlist_id": 1, "monitor": "DP-1"}`                |
| `playlist_paused`        | `{"playlist_id": 1, "monitor": "DP-1"}`                |
| `playlist_resumed`       | `{"playlist_id": 1, "monitor": "DP-1"}`                |
| `playlist_image_changed` | `{"playlist_id": 1, "image_id": 5, "monitor": "DP-1"}` |

#### Monitor Events

| Event                  | Data                   |
| ---------------------- | ---------------------- |
| `monitor_connected`    | `{"name": "HDMI-A-1"}` |
| `monitor_disconnected` | `{"name": "HDMI-A-1"}` |

#### Config Events

| Event            | Data                                |
| ---------------- | ----------------------------------- |
| `config_changed` | `{"sections": ["app", "monitors"]}` |

#### Gallery Events

| Event               | Data                                                     |
| ------------------- | -------------------------------------------------------- |
| `images_updated`    | `{"action":"added","count":5,"timestamp":"..."}`         |
| `playlists_updated` | `{"action":"updated","playlist_id":3,"timestamp":"..."}` |
| `folders_updated`   | `{"action":"created","folder_id":12,"timestamp":"..."}`  |
| `history_cleared`   | `{"timestamp":"..."}`                                    |

---

## Electron Renderer Bridge Notes

This document defines daemon HTTP behavior. The Electron renderer interacts through the preload bridge (`window.API_RENDERER`) and not by calling daemon HTTP directly.

Important bridge behavior:

- **IPC channel**: `"daemon"` — the main-process `IPCManager` handles `ipcMain.handle("daemon", ...)`.
- **Request shape**: `DaemonRequest` — a TypeScript discriminated union (`electron/ipc-types.ts`); each variant's `type` field corresponds to a daemon action.
- **Response shape**: raw daemon JSON — **not** wrapped in `{ success, data }`. Errors propagate as rejections.
- **Client singleton**: React code imports `daemonClient` from `src/client/` instead of calling `window.API_RENDERER.goDaemon` directly.
- Some daemon image payload paths are rewritten for renderer use:
  - `path` and `thumbnails.*` may be converted from filesystem paths to `atom://...` URLs.
  - This affects renderer-visible payloads for actions like image listing and get.
- Renderer convenience method signatures (for example `shutdown(): Promise<void>`) may abstract raw daemon return payloads (daemon still returns `{ "status": "shutting_down" }`).

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
  "colors": ["#1a2b3c", "#fefefe"],
  "imported_at": "2026-02-15T14:30:00Z",
  "source_path": "/home/user/Pictures/sunset.png",
  "is_selected": false,
  "folder_id": 4,
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

### Folder

```json
{
  "id": 12,
  "name": "Landscapes",
  "parent_id": null,
  "created_at": "2026-02-15T14:30:00Z",
  "updated_at": "2026-02-15T14:30:00Z"
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
  "backend": "awww"
}
```

The `source` object varies by type:

| `source.type` | Extra fields                                    |
| ------------- | ----------------------------------------------- |
| `manual`      | —                                               |
| `random`      | —                                               |
| `playlist`    | `playlist_id` (int), `playlist_name` (string)   |
| `history`     | `history_id` (int)                              |
| `restore`     | — (set during daemon startup wallpaper restore) |

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
    "always_start_on_first_image": false
  },
  "images": [{ "image_id": 1 }, { "image_id": 5 }, { "image_id": 12 }]
}
```

**Playlist configuration types**:

| `type`        | Behavior                                                      |
| ------------- | ------------------------------------------------------------- |
| `timer`       | Rotates every `interval` seconds. `order`: `ordered`/`random` |
| `manual`      | Only changes on explicit next/previous calls                  |
| `time_of_day` | Each image has a `time` (minutes since midnight, 0–1439)      |
| `day_of_week` | Each image maps to a day (0=Sunday through 6=Saturday)        |

For `time_of_day`, images include the `time` field:

```json
{ "image_id": 1, "time": 480 }
```

---

### ActivePlaylistInstance

Returned by `GET /playlists/active/{monitor}` (single instance) and by `GET /playlists/active` (array of instances):

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
  "next_change_at": "2026-02-15T14:35:00Z",
  "monitors": ["DP-1"]
}
```

`previous_image_id`, `next_image_id`, and `next_change_at` may be `null`.

### ActivePlaylistResponse

Alias of [`ActivePlaylistInstance`](#activeplaylistinstance), used for historical naming compatibility in this document.

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
  "mode": "clone",
  "started_at": "2026-02-15T14:30:00Z",
  "next_change_at": "2026-02-15T14:35:00Z",
  "monitors": ["DP-1", "HDMI-A-1"]
}
```

---

### MonitorState

Persisted per-monitor wallpaper document in CloverDB (not the `GET /wallpaper/current`
JSON shape; that endpoint aggregates active-backend rows into a single summary object):

```json
{
  "monitor_name": "DP-1",
  "image_id": 2,
  "image_name": "sunset_wallpaper",
  "image_path": "/home/user/.local/share/waypaper-engine/images/sunset_wallpaper.png",
  "mode": "individual",
  "backend": "awww",
  "set_at": "2026-02-15T14:30:00Z"
}
```

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
  "show_monitor_modal_on_start": false,
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
  "type": "awww"
}
```

Note: Per-renderer option blobs (transitions, mpv flags, etc.) are **not** this struct — use [`GET /config/backends/{backend}`](#get-configbackendsbackend). The top-level `backend` section in TOML only holds `type`.

#### awww Backend Config

Returned by `GET /config/backends/awww`. Updated by `PATCH /config/backends/awww`.

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
  "invert_y": false,
  "daemon_format": ""
}
```

TOML config supports both hyphens and underscores (e.g. `transition-type` and `transition_type` are equivalent).

`daemon_format` is passed to `awww-daemon --format` (`argb` | `abgr` | `rgb` | `bgr`; empty = awww default). It is read only when the daemon spawns `awww-daemon`, so it takes effect on the next awww-daemon restart, and only when waypaper started the daemon itself.

#### mpvpaper Backend Config

Returned by `GET /config/backends/mpvpaper`. Updated by `PATCH /config/backends/mpvpaper`.

```json
{
  "mpv_options": "loop",
  "verbose": 0,
  "auto_pause": false,
  "auto_stop": false,
  "layer": "",
  "slideshow_secs": 0
}
```

#### wal-qt Backend Config

Returned by `GET /config/backends/wal-qt`. Updated by `PATCH /config/backends/wal-qt`.
Only the fields relevant to process environment are shown here:

```json
{
  "env": ["QTWEBENGINE_CHROMIUM_FLAGS=--disable-gpu --ignore-gpu-blocklist", "QSG_RHI_BACKEND=software"]
}
```

`env` is a list of `KEY=VALUE` entries merged into the `wal-qt` process environment at spawn — the escape hatch for Qt/Chromium rendering knobs. It is stored as a list (not a map) because Viper lowercases map keys and environment variable names are case-sensitive. `PATCH` rejects entries that are not in `KEY=VALUE` form and entries whose key is daemon-managed: `WAYLAND_DISPLAY`, `XDG_RUNTIME_DIR`, `DISPLAY`, `PATH`, `HOME`, `LD_PRELOAD`, `LD_LIBRARY_PATH`. Read only at spawn, so changes take effect on the next wal-qt restart.

#### MonitorsConfig

```json
{
  "selected_monitors": ["DP-1", "HDMI-A-1"],
  "image_set_type": "individual"
}
```

#### WallhavenConfig

```json
{
  "api_key": "",
  "enabled": false,
  "scroll_mode": "paginated"
}
```

---

## Enums & Constants

### Monitor Modes

| Value        | Description                                      |
| ------------ | ------------------------------------------------ |
| `individual` | Set wallpaper on a single specific monitor       |
| `clone`      | Same image on every monitor                      |
| `extend`     | Span one image across all monitors (auto-sliced) |

### Playlist Types

| Value         | Description                                  |
| ------------- | -------------------------------------------- |
| `timer`       | Rotates on interval (seconds)                |
| `manual`      | Next/previous only                           |
| `time_of_day` | Image per time slot (minutes since midnight) |
| `day_of_week` | Image per weekday                            |

### Playlist Order

| Value     | Description         |
| --------- | ------------------- |
| `ordered` | Sequential playback |
| `random`  | Random shuffle      |

### awww Transition Types

`none`, `simple`, `fade`, `left`, `right`, `top`, `bottom`, `wipe`, `wave`, `grow`, `center`, `any`, `outer`, `random`

### awww Transition Positions

`center`, `top`, `bottom`, `left`, `right`, `top-left`, `top-right`, `bottom-left`, `bottom-right`

### awww Resize Types

`crop`, `fit`, `no`, `stretch`

### awww Filter Types

`Lanczos3`, `Bilinear`, `CatmullRom`, `Mitchell`, `Nearest`

### Compositor Types

`wayland`, `x11`

### History Source Types

`manual`, `random`, `playlist`, `history`, `restore`

---

## Default File Paths (XDG)

| Purpose      | Default path                                   |
| ------------ | ---------------------------------------------- |
| Config file  | `$XDG_CONFIG_HOME/waypaper-engine/config.toml` |
| Unix socket  | `$XDG_RUNTIME_DIR/waypaper-engine.sock`        |
| Images cache | `$XDG_DATA_HOME/waypaper-engine/images`        |
| Thumbnails   | `$XDG_CACHE_HOME/waypaper-engine/thumbnails`   |
| Database     | `$XDG_DATA_HOME/waypaper-engine/db`            |
| Log file     | `$XDG_DATA_HOME/waypaper-engine/daemon.log`    |
| PID lock     | `$XDG_RUNTIME_DIR/waypaper-engine.pid`         |
| User themes  | `$XDG_CONFIG_HOME/waypaper-engine/themes/`     |

Typical Linux defaults: `$XDG_CONFIG_HOME` = `~/.config`, `$XDG_DATA_HOME` = `~/.local/share`, `$XDG_CACHE_HOME` = `~/.cache`, `$XDG_RUNTIME_DIR` = `/run/user/<uid>`.

---

## Themes

User-provided palette CSS files dropped into `$XDG_CONFIG_HOME/waypaper-engine/themes/`.

### `GET /api/themes`

Returns metadata for all `*.css` files in the user themes directory.

**Response:** `200 OK`, `application/json` — array of theme objects:

```json
[
  {
    "name": "my-palette",
    "displayName": "my-palette",
    "source": "user",
    "url": "/api/themes/my-palette.css"
  }
]
```

Returns an empty array `[]` when no themes directory exists or it is empty.

### `GET /api/themes/{name}.css`

Streams the raw CSS for the named palette.

**Response:** `200 OK`, `text/css; charset=utf-8` — the file contents.

**Errors:**
- `404 Not Found` — name not found or path traversal attempt.

**Security:** Any name containing `/`, `\`, or empty string is rejected before disk access.
