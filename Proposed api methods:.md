# Waypaper Engine — Go Daemon API Specification

> **Version:** 2.0 (rebuild)
> **Transport:** HTTP/1.1 over Unix domain socket
> **Socket path:** `$XDG_RUNTIME_DIR/waypaper-engine/daemon.sock` (configurable)
> **Content-Type:** `application/json` for all request/response bodies
> **Streaming:** Server-Sent Events (SSE) for real-time events

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [API Endpoints](#api-endpoints)
   - [Health & System](#health--system)
   - [Images](#images)
   - [Playlists](#playlists)
   - [Monitors](#monitors)
   - [Configuration](#configuration)
   - [Backends](#backends)
   - [Wallpaper](#wallpaper)
   - [Events (SSE)](#events-sse)
3. [Data Models](#data-models)
4. [Error Handling](#error-handling)
5. [SSE Event Catalog](#sse-event-catalog)
6. [Dependencies](#dependencies)
7. [Project Structure](#project-structure)
8. [Internal Architecture (Go)](#internal-architecture-go)
   - [Go Module and Package Map](#go-module-and-package-map)
   - [Backend Abstraction](#backend-abstraction)
   - [Monitor / Platform Abstraction](#monitor--platform-abstraction)
   - [Configuration Management (Viper)](#configuration-management-viper)
   - [Wallpaper Setting Flow](#wallpaper-setting-flow)
   - [How to Add a New Backend](#how-to-add-a-new-backend)
9. [Electron ↔ Daemon Bridge (Node.js Side)](#electron--daemon-bridge-nodejs-side)
10. [CLI Commands (via Cobra)](#cli-commands-via-cobra)

---

## Architecture Overview

```
React (renderer) ←→ Electron main process ←→ Unix Socket (HTTP) ←→ Go Daemon
      ipcRenderer         ipcMain              net/http over UDS
```

- **Go daemon** exposes a standard HTTP server on a Unix domain socket.
- **Electron main** connects using Node's `http.request({ socketPath })`.
- **Renderer** only talks to Electron main via `ipcRenderer` — never touches the socket.
- **SSE** stream is held open by Electron main; events are fanned out to renderer windows via `ipcMain.emit()`.
- **CLI tools** or any other process can also connect to the same socket — the daemon doesn't care who the client is.

### Design Principles

- **Standard HTTP semantics** — proper methods, status codes, JSON bodies.
- **No framework** — `net/http` + a lightweight router (`chi` or hand-rolled `http.ServeMux`). Zero framework magic.
- **Resource-oriented** — endpoints map to nouns. Actions on resources use sub-paths (e.g. `POST /playlists/{id}/start`).
- **Idempotent where possible** — PUT/PATCH are safe to retry.
- **Streaming via SSE** — single `GET /events` endpoint, no WebSocket complexity.

---

## API Endpoints

All paths are relative to the socket root. Responses always include an appropriate HTTP status code.

Successful responses return the resource directly (or an array of resources).
Mutation endpoints return the updated resource.

---

### Health & System

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/healthz` | Liveness probe. Returns `{"status": "ok"}` |
| `GET` | `/info` | Daemon metadata (version, uptime, counts) |
| `POST` | `/shutdown` | Graceful shutdown. Stops playlists, cleans up backends, exits. |

#### `GET /healthz`

**Response** `200 OK`
```json
{ "status": "ok" }
```

#### `GET /info`

**Response** `200 OK`
```json
{
  "version": "2.0.0",
  "uptime_seconds": 3661,
  "image_count": 142,
  "playlist_count": 5,
  "monitor_count": 2,
  "active_playlists": 1,
  "backend": "swww",
  "compositor": "wayland",
  "pid": 12345
}
```

#### `POST /shutdown`

**Response** `202 Accepted`
```json
{ "message": "shutting down" }
```

---

### Images

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/images` | List images (paginated) |
| `GET` | `/images/{id}` | Get single image by ID |
| `POST` | `/images` | Import new images (batch) |
| `PATCH` | `/images/{id}` | Update image metadata |
| `DELETE` | `/images` | Delete images (batch) |
| `GET` | `/images/history` | Get wallpaper history |

#### `GET /images`

Query parameters for pagination and filtering:

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `page` | int | `1` | Page number (1-indexed) |
| `per_page` | int | `50` | Items per page (max 200) |
| `sort_by` | string | `"imported_at"` | Sort field: `name`, `imported_at`, `file_size` |
| `sort_order` | string | `"desc"` | `asc` or `desc` |
| `media_type` | string | — | Filter: `image`, `video`, or `gif` |
| `search` | string | — | Fuzzy search on name and tags |
| `tag` | string | — | Filter by tag (repeatable) |

**Response** `200 OK`
```json
{
  "data": [ Image, ... ],
  "pagination": {
    "page": 1,
    "per_page": 50,
    "total_items": 142,
    "total_pages": 3
  }
}
```

#### `GET /images/{id}`

**Response** `200 OK` — single `Image` object.
**Response** `404 Not Found` if image does not exist.

#### `POST /images`N
Import images into the gallery. The daemon copies files to its cache, generates thumbnails, extracts metadata.

**Request body:**
```json
{
  "paths": [
    "/home/user/Pictures/wallpaper1.png",
    "/home/user/Pictures/wallpaper2.jpg"
  ]
}
```

**Response** `202 Accepted` — processing starts asynchronously. Progress reported via SSE events (`processing_started`, `image_processed`, `processing_complete`).
```json
{
  "message": "processing started",
  "total": 2
}
```

#### `PATCH /images/{id}`

Update mutable fields on an image (name, tags, selection state).

**Request body** (partial — only include fields to update):
```json
{
  "name": "sunset-mountains",
  "tags": ["nature", "sunset"],
  "is_selected": true
}
```

**Response** `200 OK` — updated `Image` object.

#### `DELETE /images`

Batch delete images by ID. Removes files from cache and thumbnails from disk.

**Request body:**
```json
{
  "ids": [1, 5, 12]
}
```

**Response** `200 OK`
```json
{
  "deleted": 3
}
```

#### `GET /images/history`

Returns the **global wallpaper history** — a linear, append-only transaction log of every wallpaper change across the entire daemon, regardless of source (manual set, playlist rotation, random, etc.).

Each entry has a sequential integer `id` that only increments. The daemon enforces a sliding window (configurable via `app.image_history_limit`, default `1000`) — oldest entries are trimmed when the limit is exceeded.

> **This is NOT playlist state.** Playlists maintain their own internal cursor (previous/current/next) independently. The global history is a unified audit trail of what was actually displayed, when, and where.

Query parameters:

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `limit` | int | `50` | Max entries to return |
| `monitor` | string | — | Filter by monitor name |
| `since_id` | int | — | Only return entries with `id` greater than this (for polling) |

**Response** `200 OK`
```json
{
  "data": [ ImageHistoryEntry, ... ]
}
```

Entries are returned in reverse chronological order (newest first).

---

### Playlists

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/playlists` | List all playlists |
| `GET` | `/playlists/{id}` | Get single playlist |
| `POST` | `/playlists` | Create new playlist |
| `PATCH` | `/playlists/{id}` | Partial update of playlist |
| `DELETE` | `/playlists/{id}` | Delete playlist |
| | | |
| `POST` | `/playlists/{id}/start` | Start playlist on monitor(s) |
| `POST` | `/playlists/{id}/stop` | Stop a specific playlist |
| `POST` | `/playlists/{id}/pause` | Pause a specific playlist |
| `POST` | `/playlists/{id}/resume` | Resume a specific playlist |
| `POST` | `/playlists/{id}/next` | Advance to next image in a specific playlist |
| `POST` | `/playlists/{id}/previous` | Go to previous image in a specific playlist |
| | | |
| `GET` | `/playlists/active` | Get all currently running playlists |
| `POST` | `/playlists/active/stop` | Stop **all** running playlists |
| `POST` | `/playlists/active/pause` | Pause **all** running playlists |
| `POST` | `/playlists/active/resume` | Resume **all** paused playlists |
| `POST` | `/playlists/active/next` | Advance **all** running playlists to their next image |
| `POST` | `/playlists/active/previous` | Return **all** running playlists to their previous image |

#### `GET /playlists`

**Response** `200 OK`
```json
{
  "data": [ Playlist, ... ]
}
```

#### `GET /playlists/{id}`

**Response** `200 OK` — single `Playlist` object.

#### `POST /playlists`

ID is generated daemon-side (sequential integer).

**Request body:**
```json
{
  "name": "Evening rotation",
  "configuration": {
    "type": "timer",
    "interval": 300,
    "order": "random",
    "show_animations": true,
    "always_start_on_first_image": false
  },
  "images": [
    { "image_id": 1 },
    { "image_id": 5 },
    { "image_id": 12, "time": 1080 }
  ]
}
```

**Response** `201 Created` — full `Playlist` object with generated `id` and timestamps.

#### `PATCH /playlists/{id}`

Partial update. Only provided fields are changed.

**Request body** (example — update just the interval):
```json
{
  "configuration": {
    "interval": 600
  }
}
```

**Response** `200 OK` — updated `Playlist`.

#### `DELETE /playlists/{id}`

Stops the playlist if running, then deletes it.

**Response** `200 OK`
```json
{ "deleted": true }
```

#### `POST /playlists/{id}/start`

**Request body:**
```json
{
  "monitor": {
    "id": "HDMI-A-1",
    "mode": "individual"
  }
}
```

`id` can be a specific monitor name or `"*"` for all monitors.
`mode` is `"individual"`, `"extend"`, or `"clone"`.

If another playlist is already running on the target monitor(s), it is stopped first (conflict resolution).

**Response** `200 OK`
```json
{ "message": "playlist started", "playlist_id": 3 }
```

#### `POST /playlists/{id}/stop`

**Response** `200 OK`
```json
{ "message": "playlist stopped" }
```

#### `POST /playlists/{id}/pause`

**Response** `200 OK`
```json
{ "message": "playlist paused" }
```

#### `POST /playlists/{id}/resume`

**Response** `200 OK`
```json
{ "message": "playlist resumed" }
```

#### `POST /playlists/{id}/next`

**Response** `200 OK`
```json
{ "message": "advanced to next image", "current_index": 4 }
```

#### `POST /playlists/{id}/previous`

**Response** `200 OK`
```json
{ "message": "returned to previous image", "current_index": 2 }
```

#### `GET /playlists/active`

Returns all currently running playlist instances, keyed by monitor.

**Response** `200 OK`
```json
{
  "data": {
    "HDMI-A-1": {
      "playlist_id": 3,
      "playlist_name": "Evening rotation",
      "current_index": 4,
      "current_image_id": 5,
      "previous_image_id": 1,
      "next_image_id": 12,
      "total_images": 8,
      "paused": false,
      "mode": "individual",
      "started_at": "2026-02-15T20:00:00Z",
      "next_change_at": "2026-02-15T22:05:00Z"
    },
    "eDP-1": {
      "playlist_id": 7,
      "playlist_name": "Work backgrounds",
      "current_index": 1,
      "current_image_id": 22,
      "previous_image_id": null,
      "next_image_id": 30,
      "total_images": 4,
      "paused": true,
      "mode": "individual",
      "started_at": "2026-02-15T18:00:00Z",
      "next_change_at": null
    }
  }
}
```

#### `POST /playlists/active/stop`

Stops every running playlist across all monitors. Useful for app exit or "clear everything" actions.

No request body required.

**Response** `200 OK`
```json
{ "message": "all playlists stopped", "stopped": 2 }
```

#### `POST /playlists/active/pause`

Pauses every running (non-paused) playlist. Already-paused playlists are unaffected.

No request body required.

**Response** `200 OK`
```json
{ "message": "all playlists paused", "paused": 2 }
```

#### `POST /playlists/active/resume`

Resumes every paused playlist. Already-running playlists are unaffected.

No request body required.

**Response** `200 OK`
```json
{ "message": "all playlists resumed", "resumed": 1 }
```

#### `POST /playlists/active/next`

Advances every running playlist to its next image simultaneously.

No request body required.

**Response** `200 OK`
```json
{ "message": "all playlists advanced", "advanced": 2 }
```

#### `POST /playlists/active/previous`

Returns every running playlist to its previous image simultaneously.

No request body required.

**Response** `200 OK`
```json
{ "message": "all playlists reversed", "reversed": 2 }
```

---

### Monitors

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/monitors` | List all detected monitors |
| `GET` | `/monitors/{name}` | Get single monitor by name |

#### `GET /monitors`

Re-detects monitors from the compositor and returns the current state.

**Response** `200 OK`
```json
{
  "data": [ Monitor, ... ]
}
```

#### `GET /monitors/{name}`

Where `{name}` is the monitor identifier (e.g. `HDMI-A-1`, `eDP-1`).

**Response** `200 OK` — single `Monitor` object.
**Response** `404 Not Found` if monitor is not detected.

---

### Configuration

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/config` | Get full configuration |
| `PATCH` | `/config` | Partial update of configuration |
| `GET` | `/config/{section}` | Get a single config section |
| `PATCH` | `/config/{section}` | Partial update of a section |

Sections: `app`, `daemon`, `backend`, `monitors`

#### `GET /config`

**Response** `200 OK` — full `Config` object.

#### `PATCH /config`

**Request body** (partial — merge into existing):
```json
{
  "app": {
    "theme": "dark",
    "images_per_page": 100
  },
  "backend": {
    "swww": {
      "transition_type": "wipe",
      "transition_duration": 2
    }
  }
}
```

**Response** `200 OK` — full updated `Config`.
Emits `config_changed` SSE event.

#### `GET /config/{section}`

Example: `GET /config/app`

**Response** `200 OK` — just the section object.

#### `PATCH /config/{section}`

Example: `PATCH /config/backend`

**Request body:**
```json
{
  "swww": {
    "transition_type": "grow"
  }
}
```

**Response** `200 OK` — updated section object.

> **Note on backend config:** The `backend` section contains a `type` field (the active backend name) plus one sub-object per registered backend (e.g. `swww`, `feh`, `hyprpaper`). Each sub-object's shape is **opaque and backend-specific** — the daemon core does not parse it. The frontend should use `GET /backends` to discover which fields a backend supports and conditionally render its settings UI.

---

### Backends

Backend discovery and activation. Backends are compiled into the daemon; this endpoint lets the frontend discover what's available and switch between them.

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/backends` | List all registered backends with capabilities |
| `POST` | `/backends/{name}/activate` | Switch the active backend |

#### `GET /backends`

Returns all backends that are compiled into the daemon, whether or not they are installed on the system.

**Response** `200 OK`
```json
{
  "data": [
    {
      "name": "swww",
      "available": true,
      "active": true,
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
      "available": true,
      "active": false,
      "capabilities": {
        "compositors": ["x11"],
        "media_types": ["image"],
        "transitions": false,
        "per_monitor": false,
        "native_extend": false,
        "daemon_process": false
      }
    },
    {
      "name": "hyprpaper",
      "available": false,
      "active": false,
      "capabilities": {
        "compositors": ["wayland"],
        "media_types": ["image"],
        "transitions": false,
        "per_monitor": true,
        "native_extend": false,
        "daemon_process": true
      }
    }
  ]
}
```

**Capability fields:**

| Field | Type | Description |
|-------|------|-------------|
| `compositors` | `string[]` | Which compositors this backend supports: `"wayland"`, `"x11"`, or both |
| `media_types` | `string[]` | Supported media: `"image"`, `"video"`, `"gif"`, `"html"` |
| `transitions` | `bool` | Whether the backend supports animated transitions between wallpapers |
| `per_monitor` | `bool` | Whether the backend can target a single monitor (vs. setting the root wallpaper for all) |
| `native_extend` | `bool` | Whether the backend can span an image across monitors natively (if false, the daemon splits the image itself) |
| `daemon_process` | `bool` | Whether the backend requires a long-running background process |

The frontend uses capabilities to adapt its UI:
- Hide transition settings when `transitions = false`
- Disable individual monitor mode when `per_monitor = false`
- Show only backends where `available = true` as selectable options

#### `POST /backends/{name}/activate`

Switches the active wallpaper backend. The daemon will:
1. Call `Shutdown()` on the currently active backend
2. Call `Initialize()` on the new backend
3. Update `backend.type` in the config file

**Response** `200 OK`
```json
{
  "message": "backend activated",
  "name": "feh",
  "capabilities": {
    "compositors": ["x11"],
    "media_types": ["image"],
    "transitions": false,
    "per_monitor": false,
    "native_extend": false,
    "daemon_process": false
  }
}
```

**Response** `404 Not Found` if backend name is not registered.
**Response** `503 BACKEND_UNAVAILABLE` if the backend is registered but not installed on the system (`available = false`).

---

### Wallpaper

Direct wallpaper control, independent of playlists.

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/wallpaper/set` | Set a specific image as wallpaper |
| `POST` | `/wallpaper/random` | Set a random image from the gallery |
| `POST` | `/wallpaper/history/next` | Navigate forward in the global history log |
| `POST` | `/wallpaper/history/previous` | Navigate backward in the global history log |

#### Monitor Modes — How They Work

Before the endpoint examples, here's what each mode actually does at the backend level:

| Mode | Behavior | `monitor.id` | What the daemon does |
|------|----------|--------------|----------------------|
| `individual` | One image on one monitor | Specific monitor name (e.g. `"HDMI-A-1"`) | Calls `swww img <path> --outputs <monitor>` |
| `clone` | Same image on every monitor | Ignored (always applies to all) | Calls `swww img <path>` with no `--outputs` flag (swww applies to all), or loops over each monitor |
| `extend` | One image split/spanned across all monitors | Ignored (always applies to all) | Daemon crops/splits the source image into per-monitor regions based on monitor layout (position + resolution), then calls `swww img <cropped-region> --outputs <monitor>` for each monitor |

For `extend` mode, the daemon needs to know the physical layout of monitors (their `x`, `y`, `width`, `height` from `GET /monitors`) to compute which slice of the source image maps to which monitor.

> **Capability-driven behavior:** The extend mode description above assumes the backend has `native_extend = false` (e.g. swww, feh). The daemon performs the image splitting itself. If a future backend reports `native_extend = true` (e.g. a browser-based wallpaper engine), the daemon passes the full image and all monitor geometry to the backend and lets it handle the spanning natively. This is transparent to the API — the request body is the same either way.

---

#### `POST /wallpaper/set`

##### Example 1: Individual mode — one image on one monitor

```json
{
  "image_id": 42,
  "monitor": {
    "id": "HDMI-A-1",
    "mode": "individual"
  }
}
```

**What happens:** Image 42 is set on `HDMI-A-1` only. All other monitors are untouched.

**Response** `200 OK`
```json
{
  "image_id": 42,
  "monitors_affected": ["HDMI-A-1"],
  "mode": "individual"
}
```

**History entry created:**
```json
{
  "id": 587,
  "image_id": 42,
  "image_name": "sunset-mountains.png",
  "monitors": ["HDMI-A-1"],
  "mode": "individual",
  "source": { "type": "manual" },
  ...
}
```

##### Example 2: Clone mode — same image on all monitors

```json
{
  "image_id": 42,
  "monitor": {
    "id": "*",
    "mode": "clone"
  }
}
```

**What happens:** The same image (unmodified) is sent to every connected monitor. Each monitor shows the full image, scaled to fit its own resolution.

**Response** `200 OK`
```json
{
  "image_id": 42,
  "monitors_affected": ["HDMI-A-1", "eDP-1"],
  "mode": "clone"
}
```

**History entry created:** one single transaction covering both monitors.
```json
{
  "id": 588,
  "image_id": 42,
  "image_name": "sunset-mountains.png",
  "monitors": ["HDMI-A-1", "eDP-1"],
  "mode": "clone",
  "source": { "type": "manual" },
  ...
}
```

> Note: `monitor.id` is ignored in clone mode — it always targets all monitors. You can pass `"*"` or any monitor name; the result is the same.

##### Example 3: Extend mode — image spanned across all monitors

```json
{
  "image_id": 42,
  "monitor": {
    "id": "*",
    "mode": "extend"
  }
}
```

**What happens:** The daemon takes the source image and slices it according to the physical monitor layout. For example, given two monitors:

```
Monitor layout:
┌──────────────┬──────────────┐
│  eDP-1       │  HDMI-A-1    │
│  1920×1080   │  2560×1440   │
│  x:0 y:0     │  x:1920 y:0  │
└──────────────┴──────────────┘
Total canvas: 4480×1440
```

The daemon:
1. Computes the bounding box of all monitors → `4480×1440`
2. Scales/fits the source image to `4480×1440`
3. Crops the region `(0, 0, 1920, 1080)` → sets on `eDP-1`
4. Crops the region `(1920, 0, 2560, 1440)` → sets on `HDMI-A-1`
5. Caches the cropped slices so repeated calls don't re-process

**Response** `200 OK`
```json
{
  "image_id": 42,
  "monitors_affected": ["eDP-1", "HDMI-A-1"],
  "mode": "extend",
  "processed_images": {
    "eDP-1": "/home/user/.cache/waypaper-engine/processed/42_eDP-1_1920x1080.png",
    "HDMI-A-1": "/home/user/.cache/waypaper-engine/processed/42_HDMI-A-1_2560x1440.png"
  }
}
```

**History entry created:** one single transaction.
```json
{
  "id": 589,
  "image_id": 42,
  "image_name": "sunset-mountains.png",
  "monitors": ["eDP-1", "HDMI-A-1"],
  "mode": "extend",
  "source": { "type": "manual" },
  ...
}
```

> Note: `monitor.id` is ignored in extend mode — it always uses all monitors. The `processed_images` field is informational (the daemon handles everything internally).

---

#### `POST /wallpaper/random`

Picks a random image from the gallery and sets it. Supports all three modes.

##### Example 1: Random on one monitor

```json
{
  "monitor": {
    "id": "HDMI-A-1",
    "mode": "individual"
  }
}
```

**Response** `200 OK`
```json
{
  "image_id": 87,
  "image_name": "forest-dawn.jpg",
  "monitors_affected": ["HDMI-A-1"],
  "mode": "individual"
}
```

##### Example 2: Random clone across all monitors

```json
{
  "monitor": {
    "id": "*",
    "mode": "clone"
  }
}
```

**Response** `200 OK`
```json
{
  "image_id": 87,
  "image_name": "forest-dawn.jpg",
  "monitors_affected": ["HDMI-A-1", "eDP-1"],
  "mode": "clone"
}
```

##### Example 3: Random extend across all monitors

```json
{
  "monitor": {
    "id": "*",
    "mode": "extend"
  }
}
```

**Response** `200 OK`
```json
{
  "image_id": 87,
  "image_name": "forest-dawn.jpg",
  "monitors_affected": ["eDP-1", "HDMI-A-1"],
  "mode": "extend",
  "processed_images": {
    "eDP-1": "/home/user/.cache/waypaper-engine/processed/87_eDP-1_1920x1080.png",
    "HDMI-A-1": "/home/user/.cache/waypaper-engine/processed/87_HDMI-A-1_2560x1440.png"
  }
}
```

---

#### `POST /wallpaper/history/next`

Navigate **forward** in the global history log (toward more recent entries). This walks the global transaction log, not any playlist's internal queue. The daemon maintains a cursor position per monitor; calling "next" moves toward the present.

When replaying a history entry, the daemon re-applies the wallpaper using the same mode that was originally used. If the original entry was `extend`, the daemon re-applies the split. If it was `clone`, it clones again.

If the cursor is already at the most recent entry, this is a no-op and returns `204 No Content`.

**Request body:**
```json
{
  "monitor": {
    "id": "HDMI-A-1",
    "mode": "individual"
  }
}
```

> Note: For history navigation, `mode` in the request body is a hint for *which cursor to walk*. In `individual` mode, it walks the history of that specific monitor. In `clone`/`extend` mode, it walks history entries that affected all monitors and replays them.

**Response** `200 OK`
```json
{
  "image_id": 43,
  "history_id": 588,
  "monitors_affected": ["HDMI-A-1"],
  "mode": "individual"
}
```

#### `POST /wallpaper/history/previous`

Navigate **backward** in the global history log (toward older entries). Same cursor mechanics as `/history/next` but in the opposite direction.

If the cursor is at the oldest available entry, this is a no-op and returns `204 No Content`.

Same request body and response shape as `/history/next`.

---

### Events (SSE)

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/events` | SSE stream of real-time daemon events |

#### `GET /events`

Opens a persistent SSE connection. The daemon sends events as they occur.

Query parameters:

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `types` | string | `"*"` | Comma-separated event types to subscribe to, or `"*"` for all |

**Response** `200 OK` with `Content-Type: text/event-stream`

```
event: wallpaper_changed
data: {"image_id":42,"monitor":"HDMI-A-1","timestamp":"2026-02-15T21:30:00Z"}

event: playlist_image_changed
data: {"playlist_id":3,"monitor":"HDMI-A-1","image_id":5,"index":4,"timestamp":"2026-02-15T21:35:00Z"}

event: image_processed
data: {"image_id":143,"name":"new-wallpaper.png","progress":{"current":1,"total":5},"timestamp":"2026-02-15T21:36:00Z"}
```

Each SSE message has:
- `event:` — the event type string
- `data:` — JSON payload (always includes `timestamp`)

---

## Data Models

All JSON field names use `snake_case`.

### Image

```json
{
  "id": 42,
  "name": "sunset-mountains.png",
  "path": "/home/user/.cache/waypaper-engine/images/sunset-mountains.png",
  "media_type": "image",
  "width": 3840,
  "height": 2160,
  "format": "png",
  "file_size": 8420156,
  "checksum": "sha256:abc123...",
  "tags": ["nature", "sunset"],
  "imported_at": "2026-02-10T14:30:00Z",
  "source_path": "/home/user/Pictures/sunset-mountains.png",
  "is_selected": false,
  "thumbnails": {
    "default": "/home/user/.cache/waypaper-engine/thumbnails/42_default.webp",
    "720p": "/home/user/.cache/waypaper-engine/thumbnails/42_720p.webp",
    "1080p": "/home/user/.cache/waypaper-engine/thumbnails/42_1080p.webp",
    "1440p": "/home/user/.cache/waypaper-engine/thumbnails/42_1440p.webp",
    "4k": "/home/user/.cache/waypaper-engine/thumbnails/42_4k.webp"
  }
}
```

### ImageHistoryEntry

A single transaction in the global wallpaper history log. Every wallpaper change — whether triggered manually, by a playlist, or by a random action — appends one entry.

The `id` is a sequential, ever-incrementing integer. It never resets. When the log exceeds the configured limit (default 1000), the oldest entries are trimmed from the bottom.

```json
{
  "id": 587,
  "image_id": 42,
  "image_name": "sunset-mountains.png",
  "monitors": ["HDMI-A-1"],
  "mode": "individual",
  "set_at": "2026-02-15T21:30:00Z",
  "source": {
    "type": "playlist",
    "playlist_id": 3,
    "playlist_name": "Evening rotation"
  },
  "backend": "swww"
}
```

`source.type` — what caused this wallpaper change:

| Source type | Description | Extra fields |
|-------------|-------------|-------------|
| `"manual"` | User set the image via `/wallpaper/set` | — |
| `"playlist"` | A playlist rotation set the image | `playlist_id`, `playlist_name` |
| `"random"` | User triggered `/wallpaper/random` | — |
| `"history"` | User navigated history via `/wallpaper/history/*` | `history_id` (the entry being replayed) |

`monitors` is an array because `clone` and `extend` modes affect multiple monitors in a single transaction.

### Playlist

```json
{
  "id": 3,
  "name": "Evening rotation",
  "created_at": "2026-02-01T10:00:00Z",
  "updated_at": "2026-02-15T20:00:00Z",
  "configuration": {
    "type": "timer",
    "interval": 300,
    "order": "random",
    "show_animations": true,
    "always_start_on_first_image": false
  },
  "images": [
    { "image_id": 1, "time": null },
    { "image_id": 5, "time": null },
    { "image_id": 12, "time": 1080 }
  ]
}
```

`configuration.type` — one of:
| Type | Description |
|------|-------------|
| `timer` | Rotates every `interval` seconds |
| `manual` | Only changes via next/previous actions |
| `time_of_day` | Each image has a `time` (minutes since midnight, 0–1439). The daemon picks the correct image based on current time. |
| `day_of_week` | Each image maps to a weekday (0=Sunday..6=Saturday). The daemon picks based on current day. |

`configuration.order` — `"ordered"` or `"random"` (only applies to `timer` type).

`images[].time` — used by `time_of_day` playlists (minutes since midnight). Null for other types.

### ActivePlaylistInstance

Represents a running playlist on a specific monitor. Returned by `GET /playlists/active`.

The playlist maintains its **own internal cursor** — it knows which image it just showed, which one is current, and which one is next in line. This is independent of the global wallpaper history. Calling `POST /playlists/{id}/next` advances *this* cursor; calling `POST /wallpaper/history/next` walks the *global log* instead.

```json
{
  "playlist_id": 3,
  "playlist_name": "Evening rotation",
  "current_index": 4,
  "current_image_id": 5,
  "previous_image_id": 1,
  "next_image_id": 12,
  "total_images": 8,
  "paused": false,
  "mode": "individual",
  "started_at": "2026-02-15T20:00:00Z",
  "next_change_at": "2026-02-15T22:05:00Z"
}
```

- `previous_image_id` / `next_image_id` — may be `null` if at the beginning/end of an ordered playlist, or always populated for random/looping playlists.
- `next_change_at` — `null` when paused or for `manual` type playlists.

### Monitor

```json
{
  "name": "HDMI-A-1",
  "width": 2560,
  "height": 1440,
  "x": 0,
  "y": 0,
  "scale": 1.0,
  "refresh_rate": 144.0,
  "current_wallpaper": {
    "image_id": 42,
    "image_name": "sunset-mountains.png",
    "set_at": "2026-02-15T21:30:00Z"
  }
}
```

### MonitorTarget

Used in request bodies to specify which monitor(s) an action targets.

```json
{
  "id": "HDMI-A-1",
  "mode": "individual"
}
```

- `id` — monitor name (e.g. `"HDMI-A-1"`, `"eDP-1"`) or `"*"` for all monitors.
- `mode` — `"individual"`, `"extend"`, or `"clone"`.

### BackendInfo

Returned by `GET /backends`. Describes a registered backend and its capabilities.

```json
{
  "name": "swww",
  "available": true,
  "active": true,
  "capabilities": {
    "compositors": ["wayland"],
    "media_types": ["image"],
    "transitions": true,
    "per_monitor": true,
    "native_extend": false,
    "daemon_process": true
  }
}
```

### Config

Configuration is managed by [Viper](https://github.com/spf13/viper) and stored as a TOML file. The daemon exposes it as JSON over the API.

The `backend` section contains `type` (the active backend name) plus one sub-object per registered backend. **Each backend's sub-object is opaque** — its shape is defined by the backend itself, not the daemon core. Use `GET /backends` to discover capabilities and `GET /config/backend` to read the current config for all backends.

```json
{
  "app": {
    "kill_daemon_on_exit": false,
    "notifications": true,
    "start_minimized": false,
    "minimize_instead_of_close": true,
    "images_per_page": 50,
    "theme": "dark",
    "image_history_limit": 1000,
    "sort_by": "imported_at",
    "sort_order": "desc"
  },
  "daemon": {
    "images_dir": "~/.cache/waypaper-engine/images",
    "thumbnails_dir": "~/.cache/waypaper-engine/thumbnails",
    "database_dir": "~/.local/share/waypaper-engine/db",
    "socket_path": "$XDG_RUNTIME_DIR/waypaper-engine/daemon.sock",
    "log_level": "info",
    "log_file": "~/.local/share/waypaper-engine/daemon.log",
    "log_max_size_mb": 10,
    "log_max_backups": 5,
    "compositor": "auto"
  },
  "backend": {
    "type": "swww",
    "swww": {
      "transition_type": "wipe",
      "transition_step": 90,
      "transition_duration": 3,
      "transition_angle": 45,
      "transition_pos": "center",
      "transition_bezier": "0.25,0.1,0.25,1.0",
      "transition_wave": "20,20",
      "resize": "crop",
      "fill_color": "#000000"
    },
    "feh": {
      "mode": "fill"
    },
    "hyprpaper": {
      "splash": false,
      "ipc": true
    }
  },
  "monitors": {
    "selected_monitors": ["HDMI-A-1"],
    "image_set_type": "individual"
  }
}
```

---

## Error Handling

All errors return a consistent JSON envelope:

```json
{
  "error": {
    "code": "NOT_FOUND",
    "message": "image with id 999 not found",
    "details": {}
  }
}
```

### Error Codes

| HTTP Status | Code | When |
|-------------|------|------|
| `400` | `BAD_REQUEST` | Malformed JSON, missing required fields, invalid values |
| `404` | `NOT_FOUND` | Resource does not exist |
| `409` | `CONFLICT` | Playlist already running on target monitor (informational — daemon auto-resolves) |
| `422` | `VALIDATION_ERROR` | Structurally valid JSON but semantically invalid (e.g. interval < 1) |
| `500` | `INTERNAL_ERROR` | Unexpected daemon error |
| `503` | `BACKEND_UNAVAILABLE` | Wallpaper backend (e.g. swww) is not running or not installed |

---

## SSE Event Catalog

### Image Processing Events

| Event | Payload | When |
|-------|---------|------|
| `processing_started` | `{ total: int }` | Batch image import begins |
| `image_processed` | `{ image_id: int, name: string, progress: { current: int, total: int } }` | Single image finished processing |
| `image_error` | `{ path: string, error: string, progress: { current: int, total: int } }` | Single image failed to process |
| `processing_complete` | `{ total_processed: int, total_errors: int }` | Batch import finished |

### Playlist Events

| Event | Payload | When |
|-------|---------|------|
| `playlist_started` | `{ playlist_id: int, monitor: string, mode: string }` | Playlist begins running |
| `playlist_stopped` | `{ playlist_id: int, monitor: string }` | Playlist stopped |
| `playlist_paused` | `{ playlist_id: int, monitor: string }` | Playlist paused |
| `playlist_resumed` | `{ playlist_id: int, monitor: string }` | Playlist resumed |
| `playlist_image_changed` | `{ playlist_id: int, monitor: string, image_id: int, index: int }` | Playlist advanced to new image |

### Wallpaper Events

| Event | Payload | When |
|-------|---------|------|
| `wallpaper_changed` | `{ image_id: int, monitor: string, mode: string }` | Wallpaper changed on a monitor (any source) |

### Monitor Events

| Event | Payload | When |
|-------|---------|------|
| `monitor_connected` | `{ monitor: Monitor }` | New monitor detected |
| `monitor_disconnected` | `{ name: string }` | Monitor removed |

### Configuration Events

| Event | Payload | When |
|-------|---------|------|
| `config_changed` | `{ section: string, changes: object }` | Configuration updated |

### Gallery Events

| Event | Payload | When |
|-------|---------|------|
| `images_updated` | `{ action: "added"\|"deleted"\|"updated", ids: int[] }` | Gallery contents changed |
| `playlists_updated` | `{ action: "created"\|"deleted"\|"updated", ids: int[] }` | Playlist list changed |

---

## Dependencies

### Core (no-framework approach)

| Dependency | Purpose |
|------------|---------|
| `net/http` (stdlib) | HTTP server over Unix socket |
| `log/slog` (stdlib) | Structured logging |
| `encoding/json` (stdlib) | JSON encoding/decoding |
| `net` (stdlib) | Unix domain socket listener |
| `context` (stdlib) | Request cancellation and timeouts |

### Routing (pick one)

| Option | Notes |
|--------|-------|
| `net/http.ServeMux` (stdlib, Go 1.22+) | Now supports method + path patterns like `GET /images/{id}`. Zero deps. Preferred. |
| `github.com/go-chi/chi/v5` | Lightweight stdlib-compatible router. Only if you need middleware chains. |

### Configuration

| Dependency | Purpose |
|------------|---------|
| `github.com/spf13/viper` | TOML config reading, path expansion, defaults |

### Image Processing

| Dependency | Purpose |
|------------|---------|
| `golang.org/x/image` | Extended image format support |
| `github.com/disintegration/imaging` | Resize, crop, thumbnail generation |
| `github.com/chai2010/webp` | WebP encoding for thumbnails |

### CLI

| Dependency | Purpose |
|------------|---------|
| `github.com/spf13/cobra` | CLI subcommands (`waypaper-daemon start`, `waypaper-daemon stop`, etc.) |

### Database / Storage

| Dependency | Purpose |
|------------|---------|
| `github.com/ostafen/clover/v2` | Lightweight embedded document-oriented NoSQL database. Stores images, playlists, history as JSON documents in collections. Built-in querying, indexing, and persistence — no external server needed. |

### Logging

| Dependency | Purpose |
|------------|---------|
| `log/slog` (stdlib) | Base structured logger |
| `gopkg.in/natefinish/lumberjack.v2` | Log file rotation |
| `github.com/samber/slog-multi` | Fan-out to file + stderr |

### System

| Dependency | Purpose |
|------------|---------|
| `github.com/lucasb-eyer/go-colorful` | Color extraction / manipulation (optional, for future features) |

---

## Project Structure

Go module: `waypaper-engine/daemon` (lives at repo root in `daemon/`).

Clean separation of concerns. Each package has a single responsibility.

```
daemon/                              # Go module root
├── cmd/
│   └── daemon/
│       └── main.go              # Entry point, wiring, graceful shutdown
├── internal/
│   ├── server/
│   │   ├── server.go            # HTTP server setup, Unix socket listener
│   │   ├── routes.go            # Route registration (all endpoints in one place)
│   │   ├── middleware.go         # Logging, recovery, request ID injection
│   │   └── sse.go               # SSE broker: manages client connections, fans out events
│   ├── handler/
│   │   ├── health.go            # GET /healthz, GET /info, POST /shutdown
│   │   ├── images.go            # /images endpoints
│   │   ├── playlists.go         # /playlists endpoints
│   │   ├── monitors.go          # /monitors endpoints
│   │   ├── config.go            # /config endpoints
│   │   ├── backends.go          # /backends endpoints
│   │   ├── wallpaper.go         # /wallpaper endpoints
│   │   └── helpers.go           # JSON response helpers, error rendering, param parsing
│   ├── store/
│   │   ├── db.go                # CloverDB initialization, collection setup, shared *clover.DB
│   │   ├── image_store.go       # Image registry: CRUD over "images" collection, indexing
│   │   ├── playlist_store.go    # Playlist CRUD over "playlists" collection
│   │   ├── history_store.go     # Wallpaper history: append, trim, query over "history" collection
│   │   ├── state_store.go       # Runtime state: active playlists, current wallpapers (in-memory, not persisted)
│   │   └── models.go            # All data structs (Image, Playlist, Monitor, Config, etc.)
│   ├── playlist/
│   │   ├── manager.go           # Playlist lifecycle: start, stop, pause, resume
│   │   └── scheduler.go         # Timer, time-of-day, day-of-week scheduling logic
│   ├── backend/
│   │   ├── backend.go           # Backend interface, Capabilities, WallpaperRequest  [EXISTS]
│   │   ├── registry.go          # Registry interface + BackendInfo                   [EXISTS]
│   │   ├── swww/
│   │   │   └── config.go        # swww Config struct + type enums                   [EXISTS]
│   │   ├── feh/
│   │   │   └── config.go        # feh Config struct                                 [EXISTS]
│   │   └── hyprpaper/
│   │       └── config.go        # hyprpaper Config struct                           [EXISTS]
│   ├── image/
│   │   ├── processor.go         # Image import pipeline: copy, metadata, thumbnails
│   │   └── thumbnailer.go       # Multi-resolution thumbnail generation
│   ├── monitor/
│   │   ├── types.go             # Monitor, MonitorMode, MonitorTarget, CompositorType [EXISTS]
│   │   ├── provider.go          # MonitorProvider interface                           [EXISTS]
│   │   └── manager.go           # MonitorManager interface                            [EXISTS]
│   ├── config/
│   │   ├── config.go            # ConfigManager interface (wraps Viper)               [EXISTS]
│   │   └── types.go             # Config, AppConfig, DaemonConfig, MonitorsConfig     [EXISTS]
│   ├── media/
│   │   └── types.go             # MediaType enum                                      [EXISTS]
│   ├── events/
│   │   ├── bus.go               # In-process pub/sub event bus
│   │   └── types.go             # Event type constants                                [EXISTS]
│   └── system/
│       ├── lock.go              # PID file / process lock
│       └── paths.go             # XDG path resolution, directory creation
├── go.mod                       # module waypaper-engine/daemon                        [EXISTS]
├── go.sum                                                                              [EXISTS]
└── Makefile
```

> Files marked `[EXISTS]` are already implemented (interfaces and type definitions only). Everything else is pending implementation.

### Key Architectural Decisions

1. **Handlers are thin** — they parse the request, call a service/store method, and write the response. No business logic in handlers.
2. **Stores own persistence** — each store manages its own CloverDB collection(s). A shared `*clover.DB` instance is injected at startup; each store operates on its own collection(s). Stores are goroutine-safe (CloverDB handles internal locking).
3. **Event bus is the glue** — components publish events; the SSE broker and other components subscribe. No direct coupling between, say, playlist manager and SSE.
4. **CloverDB for persistence** — embedded document-oriented NoSQL (CloverDB). Each resource type (images, playlists, history) is a collection. CloverDB handles querying, indexing, and persistence internally. For a desktop app with <10k images, this is more than fast enough and avoids manual JSON file management.
5. **Handlers receive dependencies via struct** — each handler group is a struct with store/manager references injected at startup. No globals.
6. **Backend config is opaque to the core** — each backend owns its config struct. The daemon core passes `json.RawMessage` / `any` through without inspecting it.
7. **Capability-driven behavior** — the daemon checks `backend.Capabilities()` to decide whether to split images (extend mode), show transitions, etc.

---

## Internal Architecture (Go)

This section documents the Go-side interfaces, how packages relate to each other, and the key data flows. All interfaces described here **already exist as compiled Go code** in `daemon/internal/`. This is the source of truth for implementation.

### Go Module and Package Map

**Module:** `waypaper-engine/daemon`
**Go version:** 1.24
**Key dependencies:** `github.com/spf13/viper` v1.21.0, `github.com/ostafen/clover/v2` (embedded document DB)

| Package | Import path | Responsibility |
|---------|-------------|----------------|
| `backend` | `waypaper-engine/daemon/internal/backend` | `Backend` interface, `Registry` interface, `Capabilities`, `WallpaperRequest` |
| `backend/swww` | `.../backend/swww` | swww config struct + transition/resize/filter type enums |
| `backend/feh` | `.../backend/feh` | feh config struct + mode enum |
| `backend/hyprpaper` | `.../backend/hyprpaper` | hyprpaper config struct |
| `monitor` | `.../internal/monitor` | `Monitor` struct, `MonitorProvider` interface, `MonitorManager` interface, `MonitorMode`, `CompositorType` |
| `config` | `.../internal/config` | `ConfigManager` interface, `Config` / `AppConfig` / `DaemonConfig` / `MonitorsConfig` structs |
| `store` | `.../internal/store` | `DB`, `ImageStore`, `PlaylistStore`, `HistoryStore`, `StateStore` interfaces; `Image`, `Playlist`, `ImageHistoryEntry` models; collection/index constants |
| `media` | `.../internal/media` | `MediaType` enum (`image`, `video`, `gif`, `html`) |
| `events` | `.../internal/events` | `EventType` constants matching the SSE Event Catalog |

**Dependency graph** (packages only import downward, never upward):

```
handler/     ──→  backend    ──→  monitor
   │               │               │
   ├──→  store     ├──→  media     │ (no deps)
   │               │               │
   ├──→  playlist  │               │
   │               │               │
   └──→  config    │               │
                   │               │
server/  ──→  events              │
```

`backend` imports `monitor` (for `Monitor`, `CompositorType`, `MonitorMode`) and `media` (for `MediaType`).
`config` has no internal imports.
`monitor` has no internal imports.
`media` has no internal imports.
`events` has no internal imports.

---

### Backend Abstraction

**File:** `daemon/internal/backend/backend.go`

Every wallpaper backend (swww, feh, hyprpaper, future browser engine) implements the `Backend` interface:

```go
type Backend interface {
    // Identity & discovery
    Name() string                                       // "swww", "feh", etc.
    IsAvailable() bool                                  // Is the binary in $PATH?
    Capabilities() Capabilities                         // What this backend supports

    // Lifecycle (called by daemon core)
    Initialize(ctx context.Context) error               // Start daemon process if needed
    Shutdown(ctx context.Context) error                 // Clean up on exit or backend switch

    // Core operation
    SetWallpaper(ctx context.Context, req WallpaperRequest) error

    // Configuration (each backend owns its own config shape)
    RegisterDefaults(v *viper.Viper)                    // e.g. v.SetDefault("backend.swww.transition_type", "wipe")
    ValidateConfig(raw json.RawMessage) error           // Validate a config patch
    ParseConfig(raw json.RawMessage) (any, error)       // Decode JSON into backend's typed struct
}
```

**Capabilities** — declares what the backend supports:

```go
type Capabilities struct {
    Compositors   []monitor.CompositorType   // ["wayland"], ["x11"], or both
    MediaTypes    []media.MediaType          // ["image"], ["image","video","gif","html"]
    Transitions   bool                       // Animated transitions between wallpapers
    PerMonitor    bool                       // Can target a single monitor
    NativeExtend  bool                       // Can span across monitors natively
    DaemonProcess bool                       // Requires a background process
}
```

**WallpaperRequest** — everything a backend needs:

```go
type WallpaperRequest struct {
    ImagePath string              // Absolute path to image file
    Monitors  []monitor.Monitor   // Target monitor(s) with geometry
    Mode      monitor.MonitorMode // "individual", "clone", "extend"
    Config    any                 // Backend's own typed config (opaque to core)
}
```

**Registry** — manages all registered backends:

```go
type Registry interface {
    Register(b Backend) error                           // Add a backend at startup
    Get(name string) (Backend, bool)                    // Lookup by name
    Active() Backend                                    // Current active backend
    SetActive(name string) error                        // Switch active backend
    Available() []BackendInfo                           // All backends + capabilities
    Compatible(compositor monitor.CompositorType) []BackendInfo
}
```

**BackendInfo** — API-facing representation (returned by `GET /backends`):

```go
type BackendInfo struct {
    Name         string       `json:"name"`
    Available    bool         `json:"available"`
    Active       bool         `json:"active"`
    Capabilities Capabilities `json:"capabilities"`
}
```

#### Per-Backend Config Structs

Each backend defines its own config in its sub-package. These use `mapstructure` tags (for Viper/TOML) and `json` tags (for API). The daemon core never inspects these — it passes `json.RawMessage` to the backend's `ValidateConfig` / `ParseConfig`.

**swww** (`daemon/internal/backend/swww/config.go`):
- `Config` struct: `TransitionType`, `TransitionStep`, `TransitionDuration`, `TransitionFPS`, `TransitionAngle`, `TransitionPos`, `TransitionBezier`, `TransitionWave`, `Resize`, `FillColor`, `FilterType`, `InvertY`
- Enums: `TransitionType` (14 values), `TransitionPosition` (9 values), `ResizeType` (4 values), `FilterType` (5 values)

**feh** (`daemon/internal/backend/feh/config.go`):
- `Config` struct: `Mode`
- Enum: `FehMode` — `fill`, `scale`, `tile`, `center`, `max`

**hyprpaper** (`daemon/internal/backend/hyprpaper/config.go`):
- `Config` struct: `Splash`, `IPC`

---

### Monitor / Platform Abstraction

**Files:** `daemon/internal/monitor/types.go`, `provider.go`, `manager.go`

Monitor detection is compositor-specific. The `MonitorProvider` interface abstracts different detection tools:

```go
type MonitorProvider interface {
    Name() string                                      // "hyprctl", "wlr-randr", etc.
    IsAvailable() bool                                 // Is the tool installed?
    Compositor() CompositorType                        // Which compositor this serves
    Priority() int                                     // Higher = preferred
    Detect(ctx context.Context) ([]Monitor, error)     // Fresh query
}
```

**Built-in providers** (to be implemented):

| Provider | Compositor | Priority | Tool | Notes |
|----------|-----------|----------|------|-------|
| hyprctl | wayland | 20 | `hyprctl monitors -j` | JSON output, best for Hyprland |
| swaymsg | wayland | 20 | `swaymsg -t get_outputs` | JSON output, best for Sway |
| wlr-randr | wayland | 10 | `wlr-randr` | Generic wlroots fallback |
| xrandr | x11 | 10 | `xrandr --query` | Standard X11 |

The `MonitorManager` wraps a provider with caching:

```go
type MonitorManager interface {
    GetMonitors(ctx context.Context) ([]Monitor, error)
    GetMonitorByName(ctx context.Context, name string) (Monitor, error)
    Refresh(ctx context.Context) error                 // Force re-detect
    Compositor() CompositorType
}
```

**Auto-selection logic** (to be implemented in `NewMonitorManager`):
1. Detect compositor from `$XDG_SESSION_TYPE`, `$WAYLAND_DISPLAY`, `$DISPLAY`
2. Filter providers by compositor
3. Sort by priority descending
4. Pick the first one where `IsAvailable() == true`

**Core types:**

```go
type CompositorType string  // "wayland" or "x11"
type MonitorMode string     // "individual", "clone", "extend"

type Monitor struct {
    Name        string   // e.g. "HDMI-A-1"
    Width       int      // Horizontal resolution (px)
    Height      int      // Vertical resolution (px)
    X           int      // Position in compositor coordinate space
    Y           int      // Position in compositor coordinate space
    Scale       float64  // Output scale factor (1.0, 1.5, 2.0)
    RefreshRate float64  // Hz (60.0, 144.0)
    Transform   int      // 0=normal, 1=90, 2=180, 3=270, 4-7=flipped variants
}

type MonitorTarget struct {
    ID   string      // Monitor name or "*" for all
    Mode MonitorMode
}
```

---

### Configuration Management (Viper)

**Files:** `daemon/internal/config/config.go`, `types.go`

Configuration is backed by [Viper](https://github.com/spf13/viper). The daemon accesses config through the `ConfigManager` interface — no package imports Viper directly except the implementation.

```go
type ConfigManager interface {
    // Full config
    GetConfig() (*Config, error)
    UpdateConfig(section string, values map[string]any) error

    // Section access
    GetSection(section string) (map[string]any, error)
    UnmarshalSection(section string, target any) error    // e.g. "backend.swww" → swww.Config

    // Backend config (opaque JSON)
    GetBackendConfig(backendName string) (json.RawMessage, error)
    SetBackendConfig(backendName string, raw json.RawMessage) error

    // Active backend
    GetActiveBackendType() string
    SetActiveBackendType(name string) error

    // Change notification
    OnConfigChange(callback func(section string))

    // Resolved paths
    GetSocketPath() string
    GetImagesDir() string
    GetThumbnailsDir() string
    GetLogFile() string
}
```

**How Viper maps to the TOML file:**

```toml
[app]                    # → config.AppConfig struct
kill_daemon_on_exit = false
theme = "dark"
image_history_limit = 1000

[daemon]                 # → config.DaemonConfig struct
database_dir = "~/.local/share/waypaper-engine/db"
socket_path = "$XDG_RUNTIME_DIR/waypaper-engine/daemon.sock"
log_level = "info"

[backend]                # → config.BackendSection struct (only `type` field)
type = "swww"

[backend.swww]           # → swww.Config struct (opaque to core, accessed via GetBackendConfig)
transition_type = "wipe"
transition_duration = 3

[backend.feh]            # → feh.Config struct
mode = "fill"

[monitors]               # → config.MonitorsConfig struct
selected_monitors = ["HDMI-A-1"]
image_set_type = "individual"
```

**Key Viper operations used internally:**

| Operation | What it does |
|-----------|-------------|
| `viper.SetDefault("backend.swww.transition_type", "wipe")` | Register backend defaults at startup |
| `viper.UnmarshalKey("app", &appCfg)` | Decode a TOML section into a Go struct |
| `viper.Sub("backend.swww")` | Get a scoped Viper instance for a backend |
| `viper.Set("app.theme", "dark")` | Update a value in memory |
| `viper.WriteConfig()` | Persist to TOML file |
| `viper.WatchConfig()` + `OnConfigChange()` | File watching via fsnotify |

**Config struct hierarchy** (all use `mapstructure` + `json` tags):

- `Config` → top-level container
  - `AppConfig` → app behavior (theme, history limit, sort, etc.)
  - `DaemonConfig` → paths, logging, compositor override
  - `BackendSection` → just `Type string` (active backend name)
  - `MonitorsConfig` → selected monitors, image set type

---

### Wallpaper Setting Flow

This is the end-to-end flow when a wallpaper is set via `POST /wallpaper/set`:

```
1. HTTP handler receives request:
   { image_id: 42, monitor: { id: "HDMI-A-1", mode: "extend" } }

2. Handler resolves image_id → image path from image store

3. Handler resolves monitor target:
   - If id is "*" → get all monitors from MonitorManager
   - If id is specific → get that monitor from MonitorManager

4. Handler gets active backend from Registry

5. Handler checks backend.Capabilities().NativeExtend:

   IF NativeExtend == false AND mode == "extend":
     a. Image splitter computes bounding box from monitor geometry
     b. Scales source image to fit bounding box
     c. Crops per-monitor regions based on X, Y, Width, Height
     d. Calls backend.SetWallpaper() once per monitor with:
        - Mode: "individual"
        - ImagePath: path to cropped slice
        - Monitors: [single monitor]

   IF NativeExtend == true AND mode == "extend":
     a. Calls backend.SetWallpaper() once with:
        - Mode: "extend"
        - ImagePath: path to original image
        - Monitors: [all monitors with geometry]

   IF mode == "clone":
     a. Calls backend.SetWallpaper() for each monitor with same image

   IF mode == "individual":
     a. Calls backend.SetWallpaper() once for the target monitor

6. Append entry to global wallpaper history log (ImageHistoryEntry)

7. Emit wallpaper_changed SSE event

8. Return response to client
```

---

### How to Add a New Backend

To add a new backend (e.g. `swaybg`), an implementor needs to:

**1. Create the config package:**

```
daemon/internal/backend/swaybg/
  config.go    # Config struct with mapstructure + json tags
```

```go
package swaybg

type Config struct {
    Mode  string `mapstructure:"mode"  json:"mode"`   // "fill", "fit", "stretch", "center", "tile"
    Color string `mapstructure:"color" json:"color"`  // fallback color
}
```

**2. Create the implementation** (in the same package or a separate file):

```
daemon/internal/backend/swaybg/
  config.go
  swaybg.go    # implements backend.Backend
```

The implementation must satisfy all methods of `backend.Backend`:
- `Name()` returns `"swaybg"`
- `IsAvailable()` checks if `swaybg` exists in `$PATH`
- `Capabilities()` returns the capability declaration
- `Initialize()` / `Shutdown()` manage the swaybg process
- `SetWallpaper()` executes the swaybg command
- `RegisterDefaults()` sets `viper.SetDefault("backend.swaybg.mode", "fill")`
- `ValidateConfig()` / `ParseConfig()` handle the `Config` struct

**3. Register in `main.go`:**

```go
registry.Register(swaybg.New())
```

**4. Add default config section to the TOML defaults:**

```toml
[backend.swaybg]
mode = "fill"
color = "#000000"
```

**That's it.** No changes needed to:
- The daemon core / handler layer
- The API spec (endpoints are backend-agnostic)
- The frontend bridge
- Any other backend's code

The `GET /backends` endpoint will automatically include `swaybg` with its capabilities, and the frontend can render its config UI based on the capability flags.

---

## Electron ↔ Daemon Bridge (Node.js Side)

For reference, the Electron main process connects to the daemon like this:

```typescript
import http from "node:http";

function daemonRequest(method: string, path: string, body?: unknown): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const options: http.RequestOptions = {
      socketPath: "/run/user/1000/waypaper-engine/daemon.sock",
      path,
      method,
      headers: { "Content-Type": "application/json" },
    };
    const req = http.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => resolve(JSON.parse(data)));
    });
    req.on("error", reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

// SSE connection
function connectSSE() {
  const req = http.request({
    socketPath: "/run/user/1000/waypaper-engine/daemon.sock",
    path: "/events?types=*",
    method: "GET",
    headers: { Accept: "text/event-stream" },
  });
  req.on("response", (res) => {
    res.on("data", (chunk) => {
      // Parse SSE frames and forward to renderer via ipcMain
    });
  });
  req.end();
}
```

---

## CLI Commands (via Cobra)

The daemon binary doubles as a CLI tool:

```
waypaper-daemon start              # Start daemon (foreground)
waypaper-daemon start -d           # Start daemon (background/daemonize)
waypaper-daemon stop               # Graceful shutdown (POST /shutdown)
waypaper-daemon status             # GET /info, print human-readable
waypaper-daemon set <image-id>     # POST /wallpaper/set
waypaper-daemon random             # POST /wallpaper/random
waypaper-daemon playlist list      # GET /playlists
waypaper-daemon playlist start <id> # POST /playlists/{id}/start
waypaper-daemon playlist stop <id>  # POST /playlists/{id}/stop
waypaper-daemon images list        # GET /images
waypaper-daemon images add <paths> # POST /images
waypaper-daemon config get         # GET /config
waypaper-daemon config set <k> <v> # PATCH /config
```

This means power users can control wallpapers from scripts, keybindings, or cron jobs without needing the Electron app running.
