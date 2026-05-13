# waypaper-engine daemon — architecture

Go **control-plane + gallery + orchestration** for wallpaper backends. Serves the **Electron** UI and other clients over an **HTTP API on a Unix domain socket** and **Server-Sent Events (SSE)** for live updates. This document describes the daemon only (`daemon/`). Treat it as **orientation**; the router in code is authoritative for the route map.

**Related**

- Human-oriented API reference: [`../API_CONTRACT.md`](../API_CONTRACT.md)
- Machine-readable map (paths, operationIds): [`openapi.yaml`](./openapi.yaml)
- Improvement backlog: [`architectural-improvements.md`](./architectural-improvements.md)

---

## Role in the system

| Piece                  | Responsibility                                                                                                                                                                                         |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Daemon**             | Config (Viper TOML), CloverDB, image import/processing, playlists, monitor metadata, **active backend** selection, **wallpaper apply** coordination, parallax/wal-qt client calls, HTTP + SSE. |
| **Electron / React**   | UI; calls daemon over the socket via the `"daemon"` IPC channel; subscribes to `/events`.                                                                                                              |
| **Setters (backends)** | External processes or APIs (awww, feh, hyprpaper, mpvpaper, **wal-qt**, …) invoked or driven by the daemon.                                                                                    |

The daemon is **not** the wallpaper webview: **wal-qt** is a separate process with its own HTTP API on `$XDG_RUNTIME_DIR/wal-qt.sock`. The daemon talks to it through `internal/backend/walqt`.

---

## Process model

1. **CLI** (`cmd/daemon`) — Cobra: `start`, config helpers, events tail, etc.
2. **`start` → `daemon.New(opts).Start(ctx)`**:
   - In `main.go`: PID **lock** → load **config** → **logging** → ensure DB dir → open **Clover** → create/register **backends** → activate backend → compositor override → signal-aware `context` → build `daemon.Options` → `daemon.New(opts).Start(ctx)`.
   - Inside `daemon.Start`: **event bus** → **monitor manager** → **image processor** + **splitter** → **restore** or **deferred restore** → **playlist manager** → **HTTP+SSE** on the socket → **config hot-reload** wiring → long-running **goroutines** → block on `ctx.Done()` → graceful shutdown.
3. **Goroutines** (non-exhaustive): video browser preview backfill (context-aware), deferred restore retry, import pipelines, optional watchers.

Concurrency rule of thumb: **HTTP handlers** run on the default server pool; **backend** and **store** use explicit `context` and documented mutexes where present — see packages before making cross-goroutine changes.

---

## Transport & API surface

- **Base**: HTTP/1.1 over **Unix domain socket** (default `$XDG_RUNTIME_DIR/waypaper-engine.sock` — see config).
- **Router**: [chi](https://github.com/go-chi/chi) v5. Registration: [`internal/server/routes.go`](../internal/server/routes.go) (`NewRouter`). **This file is the canonical route list.**
- **Route count**: 58 routes as of v3.0.0 (see routes.go; below is a functional summary).
- **JSON**: `application/json` for typical bodies; some endpoints stream binary (thumbnails, raw image).
- **SSE**: `GET /events` — in-process **event bus** (`internal/events`) feeds live updates (config change, import progress, wallpaper change, etc.).

### Route summary

| Group            | Routes                                                                                                                                                    |
| ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Health/System** | `GET /healthz`, `GET /info`, `GET /capabilities`, `POST /shutdown`, `GET /events`                                                                        |
| **Images**        | `GET/POST/DELETE /images`, `GET /images/tags`, `GET/DELETE /images/history`, `POST /images/cancel-import`, `POST /images/select-all`                     |
| **Image (by id)** | `GET/PATCH /images/{id}`, `GET /images/{id}/thumbnail`, `GET /images/{id}/raw`, `POST /images/{id}/ensure-browser-preview`, `POST /images/{id}/video-loop-export` |
| **Wallpaper**     | `GET /wallpaper/current`, `POST /wallpaper/set`, `POST /wallpaper/random`                                                                                |
| **Playlists**     | `GET/POST /playlists`, `GET/PATCH/DELETE /playlists/{id}`, `POST /playlists/{id}/start\|stop\|pause\|resume\|next\|previous`                             |
| **Active playlists** | `GET /playlists/active`, `GET /playlists/active/{monitor}`, `POST /playlists/active/stop\|pause\|resume\|next\|previous`                              |
| **Folders**       | `GET/POST /folders`, `POST /folders/move-images`, `GET/PATCH/DELETE /folders/{id}`, `GET /folders/{id}/path`                                             |
| **Monitors**      | `GET /monitors`, `GET /monitors/{name}`                                                                                                                   |
| **Config**        | `GET/PATCH /config`, `GET/PATCH /config/{section}`, `GET/PATCH /config/backends/{backend}`                                                               |
| **Backends**      | `GET /backends`, `POST /backends/{name}/activate`                                                                                                         |

---

## Data & persistence

- **Database**: [Clover](https://github.com/ostafen/clover) on disk under the configured database directory. Abstractions: `internal/store` (image, playlist, state, history, monitor state, etc.).
- **On-disk media**: image directory, thumbnails, generated previews/splits; paths configured via Viper and `internal/system`.

---

## Package map (internal)

| Area             | Path                      | Notes                                                                                                               |
| ---------------- | ------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| **Daemon wiring**| `internal/daemon`         | `daemon.New(opts).Start(ctx)` — assembles all subsystems, runs HTTP, manages graceful shutdown.                     |
| **HTTP routes**  | `internal/server`         | Router, middleware, SSE broker, request ID / logging.                                                               |
| **Handlers**     | `internal/handler`        | JSON mapping to store + services; thin where possible.                                                              |
| **Control**      | `internal/control`        | Config/backend policy: named backend config, active backend activation, restore after activation, `config_changed`. |
| **Backends**     | `internal/backend`        | Registry, switch, one package per setter (`awww`, `feh`, `hyprpaper`, `mpvpaper`, `walqt`, …).             |
| **Wallpaper**    | `internal/wallpaper`      | `Apply`, restore, web capabilities, waypaper.json merge, parallax direction glue.                                   |
| **Parallax**     | `internal/parallaxdriver` | Compositor-specific input (Sway, Hyprland, …) feeding backend requests.                                            |
| **Images**       | `internal/image`          | Import, ffmpeg, palette, Web import, video loop export, splitter.                                                   |
| **Playlists**    | `internal/playlist`       | Manager, scheduler, playback persist, per-backend compatibility.                                                    |
| **Monitors**     | `internal/monitor`        | Merged list from wlr-randr, XRandR, wal-qt provider.                                                       |
| **Config**       | `internal/config`         | Viper loader, `OnConfigChange` → SSE.                                                                               |
| **Events**       | `internal/events`         | Bus types + SSE.                                                                                                    |
| **Test helpers** | `internal/testutil`       | Temp DB, sample rows.                                                                                               |

**CLI** (`cmd/daemon`) wires subcommands and builds `daemon.Options`; all runtime logic lives in `internal/daemon`.

---

## Backend interface

Each backend implements these 10 methods (`internal/backend/backend.go`):

| Method              | Description                                                                                      |
| ------------------- | ------------------------------------------------------------------------------------------------ |
| `Name() string`     | Registry key (e.g. `"awww"`, `"wal-qt"`).                                               |
| `IsAvailable() bool`| Runtime check — binary present, socket reachable, etc.                                           |
| `Capabilities()`    | Declares compositor support, media types, `DaemonProcess` flag, etc.                             |
| `Initialize(ctx)`   | Called once on `SetActive`; starts daemon process if needed.                                     |
| `Shutdown(ctx)`     | Called on deactivation or daemon exit.                                                            |
| `SetWallpaper(ctx, WallpaperRequest)` | Core apply path; receives image path, mode, monitor list, and optional `ExtendGroup []string`. |
| `RegisterDefaults(viper)` | Registers Viper defaults for this backend's config subtree.                               |
| `ValidateConfig(json.RawMessage) error` | Validates a config blob before it is persisted.                               |
| `ParseConfig(json.RawMessage) error`    | Parses and applies a config blob to runtime state.                                    |
| `OnConfigChanged(ctx, json.RawMessage) error` | Called by the config hot-reload path when backend config changes.           |

`RuntimeConfigSync` and `ExtendParallaxGroupNotifier` interfaces have been removed. Config sync is handled by `OnConfigChanged`; extend-group targets are passed directly in `WallpaperRequest.ExtendGroup`.

---

## Backends and wallpaper apply

- **`backend.Registry`**: register built-ins, `SetActive` from config, **capabilities** (media types, `DaemonProcess` for wal-qt-style daemons).
- **`wallpaper.Apply`**: shared path for handler + playlist: normalize media, merge config, call backend, emit events, update history/monitor state.
- **wal-qt**: HTTP client + monitor mapping, transitions, parallax, respawn in `internal/backend/walqt`.

---

## Config hot reload

External edits to the TOML call `OnConfigChange` on the Viper manager. The daemon:

1. Publishes a `config_changed` SSE event.
2. If the changed section belongs to the **active backend**, calls `backend.OnConfigChanged(ctx, configJSON)`.

There is no `RuntimeConfigSync` interface. Backends that need to push config to an external process (e.g. wal-qt's `/settings/network`) do so inside their `OnConfigChanged` implementation.

---

## Electron IPC bridge

The Electron renderer never calls the daemon socket directly. All daemon calls go through:

```
React component
  → daemonClient (src/client/daemonClient.ts)
  → window.API_RENDERER.goDaemon.<method>(args)
  → preload.ts invoke({ type: "action", ...fields })
  → ipcRenderer.invoke("daemon", req)     ← typed DaemonRequest discriminated union
  → IPCManager (main process) ipcMain.handle("daemon", ...)
  → HTTP call to daemon Unix socket
  → returns raw daemon JSON to renderer
```

Key points:

- **IPC channel name**: `"daemon"` (not the old `"go-daemon-command"`).
- **Request type**: `DaemonRequest` — a TypeScript discriminated union in `electron/ipc-types.ts`. Each variant's `type` field maps 1:1 to a method name.
- **Response type**: `DaemonResponse<T>` — a conditional type map in the same file; raw daemon JSON, not wrapped in `{ success, data }`.
- **Client singleton**: `daemonClient` in `src/client/` wraps every `goDaemon` method; import from `@/client` instead of accessing `window.API_RENDERER` directly.
- **Type authority**: `electron/daemon-go-types.ts` (hand-maintained) is the authoritative source. `electron/daemon-go-types.generated.ts` is generated from openapi.yaml via openapi-typescript and is used as a pipeline artifact / contract reference only — the generated types are too loose (GenericJSON) for production use.

---

## Testing layout

- **Unit / package tests**: colocated `*_test.go` under `internal/...` (`go test -short ./...` from `daemon/`).
- **Integration**: `package.json` defines `test:daemon:integration` → `go test ./test/...`. Integration tests exist under `daemon/test/`.
- **Frontend**: `pnpm test` runs Vitest against `src/` and `electron/`.

---

## Security notes (pointers)

- **Path allowlisting** (e.g. user paths for imports): `internal/pathsecure` and handler validation — do not bypass.
- **wal-qt** and **web** policies are enforced in both daemon (capabilities, waypaper.json) and the setter; see backend code, not this doc only.

---

## When this doc is wrong

If **`routes.go`**, **`API_CONTRACT.md`**, and **`openapi.yaml`** disagree, order of fix is:

1. Implement truth in `routes.go` and handlers.
2. Regenerate or update **`openapi.yaml`**.
3. Update **`API_CONTRACT.md`** for prose and examples.

The [`architectural-improvements.md`](./architectural-improvements.md) file tracks **drift**, **bloat**, and **test** cleanup work.
