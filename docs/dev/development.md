# Development guide

This is the guide I use when I'm hacking on waypaper-engine. It covers how the pieces fit together, where to find things, and how to add features without breaking the contract.

---

## Quick start

```bash
git clone https://github.com/0bCdian/Waypaper-Engine.git
cd Waypaper-Engine
mise install          # pins Node 22, Go 1.26, Python 3.12
npm install
npm run dev           # builds daemon, starts Vite + Electron
```

`npm run dev` builds the Go daemon first. **A broken daemon build means no UI**—fix daemon errors before chasing frontend issues.

---

## Repo layout

```
waypaper-engine/
├── daemon/                   # Go daemon (source of truth for all state)
│   ├── cmd/daemon/           # Cobra CLI entry point + subcommands
│   └── internal/
│       ├── server/           # chi HTTP router, SSE broker, middleware
│       ├── handler/          # HTTP handlers (one file per resource group)
│       ├── backend/          # Pluggable backend interface + implementations
│       ├── config/           # Viper-backed config manager (TOML)
│       ├── store/            # CloverDB collections (images, playlists, folders, wallpaper state)
│       ├── playlist/         # Playlist scheduler and timer/cron logic
│       ├── wallpaper/        # Wallpaper state management + apply logic
│       ├── image/            # Image processing (import, thumbnail generation, color extraction)
│       ├── media/            # Video/media handling
│       ├── monitor/          # Monitor detection (wlr-randr, wlroots)
│       ├── events/           # Pub/sub event bus + SSE type constants
│       ├── parallaxdriver/   # Hyprland parallax effect support
│       └── system/           # Filesystem helpers, XDG paths
├── src/                      # React renderer (Vite)
│   ├── routes/               # Page components (Home, Settings, ShaderStudio, ...)
│   ├── components/           # Shared UI components
│   ├── hooks/                # Custom React hooks (useSSE, useGallery, ...)
│   ├── stores/               # Zustand global state
│   ├── contexts/             # React Context providers
│   └── types/                # TypeScript types mirroring daemon shapes
├── electron/                 # Electron main process
│   ├── main.ts               # Entry point
│   └── managers/             # DaemonManager, IPCManager, WindowManager, ThemeManager
├── shared/                   # Types shared between electron/ and src/
├── globals/                  # Daemon startup, native menus, config reader
├── e2e/                      # Playwright tests
└── docs/                     # This VitePress site
```

---

## Architecture: how the pieces connect

```
┌─────────────────────────────────────────────────────┐
│                   Electron process                   │
│  ┌──────────────┐   IPC   ┌───────────────────────┐ │
│  │   Renderer   │ ◄─────► │  Main process         │ │
│  │  (React/Vite)│         │  DaemonManager        │ │
│  │  window.API_ │         │  IPCManager           │ │
│  │  RENDERER    │         │  WindowManager        │ │
│  └──────────────┘         └────────┬──────────────┘ │
└───────────────────────────────────┼─────────────────┘
                                    │ HTTP over Unix socket
                           $XDG_RUNTIME_DIR/waypaper-engine.sock
                                    │
┌───────────────────────────────────▼─────────────────┐
│                     Go daemon                        │
│  chi router → handlers → store (CloverDB)            │
│  event bus → SSE broker (GET /events)                │
│  backend interface → awww/hyprpaper/feh/mpvpaper/    │
│                      wayland-utauri                  │
└─────────────────────────────────────────────────────┘
```

**Key invariants:**

- The daemon owns all persistent state. The Electron main process and renderer are thin clients.
- The renderer never speaks to the socket directly—it goes through the preload bridge (`window.API_RENDERER`). Path fields (`path`, `thumbnails.*`) are rewritten to `atom://` URLs before reaching the renderer.
- Everything that changes publishes to the internal event bus, which fans out to all SSE subscribers.
- The daemon can run without Electron (headless/systemd) and the full HTTP API still works.

---

## The daemon in detail

### HTTP routing (`internal/server/`)

Routes are registered in `routes.go`. Each resource group (images, playlists, monitors, config, backends, wallpaper) has its own handler file in `internal/handler/`. Adding a new endpoint:

1. Write the handler function in the appropriate `handler/` file.
2. Register it in `routes.go` with the correct HTTP method and path.
3. Add it to `daemon/docs/openapi.yaml` (path + operation).
4. Document it in `daemon/API_CONTRACT.md`.

### SSE (`internal/server/sse.go` + `internal/events/`)

The event bus is a pub/sub system in `internal/events/`. Any package can publish an event:

```go
eventBus.Publish(events.WallpaperChanged, payload)
```

The SSE broker subscribes to the bus and fans events to connected clients. Event type string constants are in `internal/events/types.go`—add new types there and keep `API_CONTRACT.md` in sync.

Clients filter by type via `?types=event_a,event_b`. The broker matches against registered type strings.

### Backends (`internal/backend/`)

Each backend implements the `Backend` interface (defined in `internal/backend/backend.go`):

```go
type Backend interface {
    Name() string
    Available() bool
    Capabilities() Capabilities
    Set(ctx context.Context, req SetRequest) error
    Stop() error
    ValidateConfig(raw json.RawMessage) error
}
```

To add a new backend:

1. Create `internal/backend/<name>/backend.go` implementing the interface.
2. Register it in the backend registry (see existing backends for the pattern).
3. Add its config struct and defaults to `internal/config/`.
4. Wire its config section in `daemon/API_CONTRACT.md` and `openapi.yaml`.

### Config (`internal/config/`)

Viper reads the TOML file. The `ConfigManager` interface wraps Viper so no other package imports Viper directly—this keeps the config backend swappable in tests.

Per-backend config lives under `[backend.<name>]` in the TOML and is accessed as raw `json.RawMessage` via `GetBackendConfig("name")`. Each backend validates its own config with `ValidateConfig`.

### Storage (`internal/store/`)

CloverDB is a simple document store. Collections:

- `images` — Image records (metadata, tags, colors, thumbnails, folder)
- `playlists` — Playlist documents
- `folders` — Folder tree
- `wallpaper_state` — Per-monitor, per-backend wallpaper state (for restore on startup)
- `history` — Wallpaper change log

No schema migrations—CloverDB uses documents. If you add a field, existing documents just won't have it (handle the zero value).

---

## The Electron layer

### DaemonManager (`electron/managers/DaemonManager.ts`)

Responsible for:

- Starting the daemon binary if it is not already running.
- Checking daemon health via `GET /healthz`.
- Killing the daemon on app exit (if `kill_daemon_on_exit` is set).

### IPCManager (`electron/managers/IPCManager.ts`)

Registers IPC handlers that proxy to the daemon HTTP API. The renderer calls `window.API_RENDERER.someMethod()` → IPC → main process → HTTP to socket → back.

Most channels wrap responses as `{ success: true, data: ... }` or `{ success: false, error: "..." }`. The exception is `go-daemon-command`, which passes raw data through.

### Preload bridge (`electron/preload.ts`)

Exposes `window.API_RENDERER` to the renderer. **Never** call daemon HTTP directly from the renderer—always go through the bridge.

---

## The React renderer

### State management

- **Zustand** stores for global state (gallery, active playlist, monitor list, config).
- **React Query** for server data fetching and cache management.
- **SSE hook** (`src/hooks/useSSE.ts`) for subscribing to daemon events—components that need live updates use this.

### Adding a new route

1. Create `src/routes/MyRoute.tsx`.
2. Add it to the router in `src/App.tsx`.
3. Add a nav link in the layout.
4. Add Playwright tests in `e2e/` for the critical path.

### Typing

Types that mirror daemon JSON shapes live in `src/types/`. When you add a new daemon field or endpoint, update these in sync. The `shared/` directory holds types that need to be consistent between `electron/` and `src/`.

---

## Testing

| Command                           | What                                                              |
| --------------------------------- | ----------------------------------------------------------------- |
| `npm run test:daemon:unit`        | Fast Go tests (`-short`). Run these often.                        |
| `npm run test:daemon:integration` | Full daemon integration tests (start/stop/import flows).          |
| `npm run test:daemon:race`        | Race detector. Run before PRs.                                    |
| `npm run test`                    | Vitest (React/TypeScript).                                        |
| `npm run test:e2e`                | Playwright end-to-end (needs a built daemon).                     |
| `npm run ci:check`                | Full CI gate: build + format + lint + typecheck + short Go tests. |

Run `npm run ci:check` before opening a PR. It catches formatter drift (oxfmt, oxlint, gofmt) and TS errors that tests might not.

---

## Code style

- **Go:** `gofmt` + standard Go idioms. No external log libraries in new code—use the daemon's internal logger.
- **TypeScript/React:** `oxfmt` + `oxlint`. No `any` in types that mirror daemon shapes.
- **No backward-compat shims.** This is an active rewrite—rename, move, break freely. Fix forward.
- **No comments explaining what code does.** Write comments only for non-obvious WHY (constraints, workarounds, subtle invariants).

---

## Docs

From the repo root:

```bash
npm run docs:dev    # VitePress dev server (copies openapi.yaml, then starts)
npm run docs:build  # Production build (what GitHub Pages runs on release tags)
```

If a doc page drifts from what the code does, that's a bug—fix the doc or the code, not both in opposite directions.

**GitHub Pages setup (one-time, for repo admins):**  
Settings → Pages → Build and deployment → set **Source** to **GitHub Actions**. The `docs.yml` workflow publishes on every `v*` tag and can be triggered manually. If you rename the repo, update `VITEPRESS_BASE` in the workflow to `/<new-repo-name>/`.

---

## Adding a feature: checklist

1. Read the relevant daemon handler and data model first—don't guess from docs.
2. If it's a new endpoint: handler → route → openapi.yaml → API_CONTRACT.md.
3. If it's a new SSE event: `events/types.go` → publish in handler → API_CONTRACT.md SSE table.
4. If it touches config: config struct → Viper defaults → `config.toml` example in docs → config.md here.
5. Write at least a unit test for the daemon-side logic.
6. If it's user-facing: add a screenshot placeholder in `docs/guide/app.md`.
7. Run `npm run ci:check` clean before opening a PR.
