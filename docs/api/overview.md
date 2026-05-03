# API overview

The daemon speaks **JSON** over **HTTP/1.1** on a **Unix domain socket** (not plain TCP in the default build). The router is [chi](https://github.com/go-chi/chi); the **canonical list of routes** is `internal/server/routes.go` in the repo on GitHub.

| Topic                                              | Where                                                                                                        |
| -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| Human-oriented prose, examples, and models         | [API contract (GitHub)](https://github.com/0bCdian/Waypaper-Engine/blob/main/daemon/API_CONTRACT.md)         |
| Machine-readable path map and `operationId` values | [OpenAPI spec](/api/openapi) (also `daemon/docs/openapi.yaml` in the repo)                                   |
| **SSE** event types and filters                    | [Events & SSE](/api/sse)                                                                                     |
| **Architecture** (packages, data, backends)        | [ARCHITECTURE.md (GitHub)](https://github.com/0bCdian/Waypaper-Engine/blob/main/daemon/docs/ARCHITECTURE.md) |

**Content type:** `application/json` for most bodies. Thumbnail and “raw” image routes return **binary** with appropriate `Content-Type`.

**Errors:** the contract describes a common envelope (`error`, `code`, optional `details`).

---

## `curl` over the socket

```bash
SOCK="${XDG_RUNTIME_DIR}/waypaper-engine.sock"
curl -sS --unix-socket "$SOCK" "http://localhost/images?page=1&per_page=5"
curl -sS --unix-socket "$SOCK" "http://localhost/wallpaper/current"
curl -sS --unix-socket -X POST "$SOCK" "http://localhost/wallpaper/random" \
  -H 'Content-Type: application/json' -d '{}'
```

---

## Surface at a glance

- **Health / meta:** `GET /healthz`, `GET /info`, `GET /capabilities` (e.g. whether **ffmpeg** is available), `POST /shutdown`
- **SSE:** `GET /events` — see [Events & SSE](/api/sse)
- **Images:** `GET/POST/DELETE /images`, tags, import cancel, **browser video preview** (`POST /images/{id}/ensure-browser-preview`), **loop export** (`POST /images/{id}/video-loop-export`), thumbnails, raw files, **history** under `/images/history`, …
- **Playlists:** CRUD, start/stop/pause/resume, next/prev, bulk active operations, `GET /playlists/active` and `GET /playlists/active/{monitor}`
- **Folders:** tree operations and `POST /folders/move-images`
- **Monitors:** `GET /monitors`, `GET /monitors/{name}`
- **Config:** whole-config and per-section (app, monitors, wallhaven, backend, …) — exact sections match the [contract on GitHub](https://github.com/0bCdian/Waypaper-Engine/blob/main/daemon/API_CONTRACT.md#config)
- **Backends:** `GET /backends`, `POST /backends/{name}/activate`
- **Wallpaper:** `GET /wallpaper/current`, `POST /wallpaper/set`, `POST /wallpaper/random`

**NOTE** — _Web / local spec:_ the contract on GitHub includes a **”Local Spec v0”** section for `media_type: web` and wayland-utauri—read that if you build HTML walls.

**NOTE** — _Electron UI:_ the renderer uses `daemonClient` (from `src/client/`) → preload bridge → `"daemon"` IPC channel → main process → socket. It never calls the socket directly. See the **bridge** section in the [API contract](https://github.com/0bCdian/Waypaper-Engine/blob/main/daemon/API_CONTRACT.md#electron-renderer-bridge-notes).

**NOTE** — _No browser try-it:_ the daemon binds a Unix domain socket, not TCP. Browser-based “try it” tools cannot reach it. Use `curl --unix-socket` — see [OpenAPI spec & curl examples](/api/openapi) for copy-pasteable commands.
