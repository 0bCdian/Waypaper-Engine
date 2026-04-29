# waypaper-engine daemon — architecture

Go **control-plane + gallery + orchestration** for wallpaper backends. Serves the **Electron** UI and other clients over an **HTTP API on a Unix domain socket** and **Server-Sent Events (SSE)** for live updates. This document describes the daemon only (`daemon/`). Treat it as **orientation**; the router in code is authoritative for the route map.

**Related**

- Human-oriented API reference: [`../API_CONTRACT.md`](../API_CONTRACT.md)
- Machine-readable map (paths, operationIds): [`openapi.yaml`](./openapi.yaml)
- Improvement backlog: [`architectural-improvements.md`](./architectural-improvements.md)

---

## Role in the system

| Piece | Responsibility |
|-------|----------------|
| **Daemon** | Config (Viper TOML), CloverDB, image import/processing, playlists, monitor metadata, **active backend** selection, **wallpaper apply** coordination, parallax/wayland-utauri client calls, HTTP + SSE. |
| **Electron / React** | UI; calls daemon over the socket; subscribes to `/events`. |
| **Setters (backends)** | External processes or APIs (awww, feh, hyprpaper, mpvpaper, **wayland-utauri**, …) invoked or driven by the daemon. |

The daemon is **not** the wallpaper webview: **wayland-utauri** (wal-utauri) is a separate process with its own HTTP API on `$XDG_RUNTIME_DIR/wayland-utauri.sock`. The daemon talks to it through `internal/backend/waylandutauri`.

---

## Process model

1. **CLI** (`cmd/daemon`) — Cobra: `start`, config helpers, events tail, etc.
2. **`start` → `startDaemon`**:  
   - PID **lock** → load **config** → **logging** → ensure dirs → **Clover** → **event bus** → **monitor manager** → **backend registry** → init **active backend** → **image processor** + **splitter** → **restore** or **deferred restore** → **playlist manager** → **HTTP+SSE** on the socket.  
3. **Goroutines** (non-exhaustive): long-running workers (e.g. video browser preview backfill), deferred restore retry, import pipelines, optional watchers.

Concurrency rule of thumb: **HTTP handlers** run on the default server pool; **backend** and **store** use explicit `context` and documented mutexes where present—see packages before making cross-goroutine changes.

---

## Transport & API surface

- **Base**: HTTP/1.1 over **Unix domain socket** (default under `$XDG_RUNTIME_DIR/waypaper-engine.sock` — see config).
- **Router**: [chi](https://github.com/go-chi/chi) v5. Registration: [`internal/server/routes.go`](../internal/server/routes.go) (`NewRouter`). **This file is the canonical route list.**
- **JSON**: `application/json` for typical bodies; some endpoints stream binary (thumbnails, raw image).
- **SSE**: `GET /events` — in-process **event bus** (`internal/events`) feeds live updates (config change, import progress, etc.).

---

## Data & persistence

- **Database**: [Clover](https://github.com/ostafen/clover) on disk under the configured database directory. Abstractions: `internal/store` (image, playlist, state, history, monitor state, etc.).
- **On-disk media**: image directory, thumbnails, generated previews/splits; paths configured via Viper and `internal/system`.

---

## Package map (internal)

| Area | Path | Notes |
|------|------|--------|
| **HTTP routes** | `internal/server` | Router, middleware, SSE broker, request ID / logging. |
| **Handlers** | `internal/handler` | JSON mapping to store + services; thin where possible. |
| **Control** | `internal/control` | Config/backend policy: named backend config, active backend activation, runtime config sync, restore after activation, `config_changed` events. |
| **Backends** | `internal/backend` | Registry, switch, one package per setter (`awww`, `feh`, `hyprpaper`, `mpvpaper`, `waylandutauri`, …). |
| **Wallpaper** | `internal/wallpaper` | `Apply`, restore, web capabilities, waypaper.json merge, parallax direction glue. |
| **Parallax** | `internal/parallaxdriver` | Compositor-specific input (Sway, Hyprland, …) feeding backend requests. |
| **Images** | `internal/image` | Import, ffmpeg, palette, Web import, video loop export, splitter. |
| **Playlists** | `internal/playlist` | Manager, scheduler, playback persist, per-backend compatibility. |
| **Monitors** | `internal/monitor` | Merged list from wlr-randr, XRandR, wayland-utauri provider. |
| **Config** | `internal/config` | Viper loader, `OnConfigChange` → SSE. |
| **Events** | `internal/events` | Bus types + SSE. |
| **Test helpers** | `internal/testutil` | Temp DB, sample rows. |

**CLI** (`cmd/daemon`) wires subcommands only; the long `start` path is the main runtime.

---

## Backends and wallpaper apply

- **`backend.Registry`**: register built-ins, `SetActive` from config, **capabilities** (media types, `DaemonProcess` for wayland-utauri-style daemons).  
- **`wallpaper.Apply`**: shared path for handler + playlist: normalize media, merge config, call backend, emit events, update history/monitor state.  
- **wayland-utauri**: HTTP client + monitor mapping, transitions, parallax, respawn in `internal/backend/waylandutauri`.

---

## Config hot reload

External edits to the TOML call `OnConfigChange` on the Viper manager; the daemon publishes `ConfigChanged` (and may sync runtime config for implementations of `RuntimeConfigSync`).

---

## Testing layout

- **Unit / package tests**: colocated `*_test.go` under `internal/...` (`go test -short ./...` from `daemon/`).  
- **Integration**: `package.json` defines `test:daemon:integration` → `go test ./test/...` — the tree may be **empty** until real integration tests are added (see `architectural-improvements.md`).

---

## Security notes (pointers)

- **Path allowlisting** (e.g. user paths for imports): `internal/pathsecure` and handler validation—do not bypass.  
- **wayland-utauri** and **web** policies are enforced in both daemon (capabilities, waypaper.json) and the setter; see backend code, not this doc only.

---

## When this doc is wrong

If **`routes.go`**, **`API_CONTRACT.md`**, and **`openapi.yaml` disagree, order of fix is:

1. Implement truth in `routes.go` and handlers.  
2. Regenerate or update **`openapi.yaml`**.  
3. Update **`API_CONTRACT.md`** for prose and examples.

The [`architectural-improvements.md`](./architectural-improvements.md) file tracks **drift**, **bloat**, and **test** cleanup work.
