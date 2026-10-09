# HTTP API

The GUI, the `waypaper-daemon` CLI and your scripts all use the same JSON API, served on a Unix socket at `$XDG_RUNTIME_DIR/waypaper-engine.sock` (see [Paths & files](/reference/paths)). There is no authentication; the socket's file permissions are the access control.

```bash
SOCK="$XDG_RUNTIME_DIR/waypaper-engine.sock"
curl -sS --unix-socket "$SOCK" http://localhost/wallpaper/current
curl -sS --unix-socket "$SOCK" -X POST http://localhost/wallpaper/random \
  -H 'Content-Type: application/json' -d '{"monitor":"*"}'
```

Bodies are JSON except thumbnails, raw files, theme CSS and the event stream. Lists take `page` (from 1) and `per_page` (default 50, max 200). Full schema: [`openapi.yaml`](https://github.com/0bCdian/Waypaper-Engine/blob/main/daemon/docs/openapi.yaml).

## Errors

Failures return a non-2xx status and:

```json
{ "error": "message", "code": 400, "details": "...", "error_code": "no_backend", "meta": {} }
```

`error` and `code` (same as the HTTP status) are always present. `details`, `error_code` (`incompatible_backend` or `no_backend`, from wallpaper routes) and `meta` appear sometimes. Statuses: `400` bad input, `404` unknown id/section/backend, `500` internal, `503` no backend installed. Every response has an `X-Request-ID` header that also appears in the daemon log.

## Routes

`{id}` is an integer.

### Health and daemon

| Method | Path | Notes |
| ------ | ---- | ----- |
| GET | `/healthz` | `status: "ok"`. |
| GET | `/info` | `version`, `pid`, `hostname`, `uptime`, `go_version`, `os`, `arch`. |
| GET | `/capabilities` | `ffmpeg_available`. |
| POST | `/shutdown` | Replies `{"status":"shutting_down"}`, then stops. |
| GET | `/events` | SSE stream; `?types=a,b` filters. See [Events](/reference/events). |

### Images

| Method | Path | Notes |
| ------ | ---- | ----- |
| GET | `/images` | Paged gallery. Query: `page`, `per_page`, `sort_by` (`name`, `imported_at`, `file_size`, `hue`), `sort_order` (`asc`, `desc`; default `desc`), `media_type`, `search`, `tags` (comma list), `colors` (comma list of hex), `colors_near` (`#hex~maxDeltaE`, comma list), `hue_group` (0 to 11, or 99 for neutral), `palette_similar_to` (image id), `palette_max_delta_e`, `folder_id`. |
| POST | `/images` | Import files. Body: `paths` (list), optional `folder_id`. Async; returns `status`, `total`, `batch_id`; progress arrives as events. |
| POST | `/images/import-web` | Import an HTML wallpaper folder. Body: `path`, optional `folder_id`. |
| DELETE | `/images` | Body: `ids` (list). Returns `deleted` count. |
| GET | `/images/tags` | Distinct tag list. |
| GET | `/images/history` | Apply history. Query: `monitor`, `limit`, `since_id`. |
| DELETE | `/images/history` | Clear history. |
| POST | `/images/cancel-import` | Cancel a running import by `batch_id`. |
| POST | `/images/select-all` | Body: `selected` (bool). |
| GET | `/images/{id}` | One image. |
| PATCH | `/images/{id}` | Update metadata. Patching `name` renames the file on disk. |
| GET | `/images/{id}/thumbnail` | WebP. Query: `resolution` (`default`, `720p`, `1080p`, `1440p`, `4k`). |
| GET | `/images/{id}/raw` | The original file. |
| POST | `/images/{id}/ensure-browser-preview` | Build an H.264 preview for a video if missing; `?force=1` rebuilds. Needs ffmpeg. |
| POST | `/images/{id}/video-loop-export` | Body: `in_seconds`, `out_seconds`, `preset`, `action`, optional `folder_id`, `blend_halves`. |
| POST | `/images/{id}/extract-video-palette` | Body: `time_seconds`. Stores and returns `colors`. |

### Wallpaper

| Method | Path | Notes |
| ------ | ---- | ----- |
| GET | `/wallpaper/current` | Current wallpaper per monitor. |
| POST | `/wallpaper/set` | Body: `image_id`, `monitor` or `monitors`, `mode` (`individual`, `clone`, `extend`). |
| POST | `/wallpaper/random` | Optional body: `monitor` (default `*`), `mode` (default `individual`). |

### Playlists

| Method | Path | Notes |
| ------ | ---- | ----- |
| GET | `/playlists` | List. |
| POST | `/playlists` | Create. Returns `201`. |
| GET | `/playlists/{id}` | One playlist. |
| PATCH | `/playlists/{id}` | Update. |
| DELETE | `/playlists/{id}` | Delete. |
| POST | `/playlists/{id}/start` | Body: `monitors` (list), `extend` (bool). |
| POST | `/playlists/{id}/stop` | |
| POST | `/playlists/{id}/pause` | |
| POST | `/playlists/{id}/resume` | |
| POST | `/playlists/{id}/next` | |
| POST | `/playlists/{id}/previous` | |
| GET | `/playlists/active` | Running playlists. |
| GET | `/playlists/active/{monitor}` | Running playlist on one monitor. |
| POST | `/playlists/active/stop` | Stop all. Returns `stopped` count. |
| POST | `/playlists/active/pause` | Pause all. Returns `paused`. |
| POST | `/playlists/active/resume` | Resume all. Returns `resumed`. |
| POST | `/playlists/active/next` | Advance all. Returns `advanced`. |
| POST | `/playlists/active/previous` | Step all back. Returns `reversed`. |

### Folders

| Method | Path | Notes |
| ------ | ---- | ----- |
| GET | `/folders` | Query: `parent_id` (id, `root` or `null`), `search`. |
| POST | `/folders` | Body: `name`, `parent_id`. Returns `201`. |
| POST | `/folders/move-images` | Body: `image_ids`, `folder_id`. |
| GET | `/folders/{id}` | One folder. |
| PATCH | `/folders/{id}` | Rename or move. |
| DELETE | `/folders/{id}` | Query: `mode` = `keep_contents` (default) or `delete_all`. |
| GET | `/folders/{id}/path` | Breadcrumb path. |

### Monitors

| Method | Path | Notes |
| ------ | ---- | ----- |
| GET | `/monitors` | Connected outputs. |
| GET | `/monitors/{name}` | One output, e.g. `DP-1`. |

### Config and backends

Keys: [config.toml](/reference/config).

| Method | Path | Notes |
| ------ | ---- | ----- |
| GET | `/config` | Whole config; backend settings under `backend.<name>`. |
| PATCH | `/config` | Body: `{"<section>": {...}}`. |
| POST | `/config/reset` | Reset to factory defaults. |
| GET | `/config/{section}` | `app`, `daemon`, `monitors`, `wallhaven`. `backend` returns 404. |
| PATCH | `/config/{section}` | Same sections. Returns the updated section. |
| GET | `/config/backends/{backend}` | One backend's settings. |
| PATCH | `/config/backends/{backend}` | Validated by the backend; `400` if invalid. |
| POST | `/config/backends/{backend}/reset` | Reset one backend to defaults. |
| GET | `/backends` | Every backend, whether installed, and its capabilities. |
| POST | `/backends/{name}/activate` | Switch the active backend. |

### User themes

| Method | Path | Notes |
| ------ | ---- | ----- |
| GET | `/api/themes` | User palettes ([Themes](/manual/themes)). |
| GET | `/api/themes/{name}.css` | The CSS file. |
