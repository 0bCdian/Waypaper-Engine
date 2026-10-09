# Development

How to run Waypaper Engine from source, where things live, and what to run before opening a PR.

## Quick start

```bash
git clone https://github.com/0bCdian/Waypaper-Engine.git
cd Waypaper-Engine
mise install   # Node, pnpm, Go, Python from .mise.toml
pnpm install
pnpm run dev   # builds the daemon, then starts Vite + Electron
```

A broken daemon build means no UI, so check the Go errors first.

## Repo map

| Path | What's there |
| --- | --- |
| `daemon/` | Go daemon and CLI. Owns all state. |
| `daemon/docs/openapi.yaml` | API description; `daemon/API_CONTRACT.md` is the prose contract. |
| `electron/` | Main process: window, IPC, daemon HTTP client, preload bridge. |
| `src/` | React renderer (Vite): routes, components, stores, themes. |
| `shared/` | Types and helpers used by `electron/` and `src/`. |
| `globals/` | Main-process startup: spawning the daemon, menus, config reader. |
| `e2e/` | Playwright tests. |
| `docs/` | This VitePress site. |
| `packaging/` | Packaging notes. |

## Architecture

```text
renderer (React) -> preload -> Electron main (IPC) -> HTTP over Unix socket -> Go daemon
                                                        <- SSE (GET /events) <-
```

The daemon owns the state; Electron and the renderer are thin clients, and the renderer never touches the socket. Live updates arrive over SSE ([Events](/reference/events)). Inside the daemon, `daemon/internal/` has one package per concern (`handler`, `server`, `backend`, `store`, `playlist`, `wallpaper`, `config`, `events`, `monitor`, ...); browse the source tree.

## Commands

| Task | Command |
| --- | --- |
| Run in dev | `pnpm run dev` |
| Renderer/electron tests | `pnpm test` |
| Daemon tests | `pnpm run test:daemon` (`:unit` for `-short`, `:race` before a PR) |
| E2E | `pnpm run test:e2e`, `pnpm run test:ui` |
| Lint / fix | `pnpm run lint:check` / `pnpm run lint` |
| Format / fix | `pnpm run format:check` / `pnpm run format` |
| Go format | `pnpm run gofmt:check` |
| Typecheck | `pnpm exec tsc --noEmit` |
| Regenerate API types | `pnpm run generate:types` |
| Everything CI runs | `pnpm run ci:check` |
| Docs dev server | `pnpm run docs:dev` |
| Regenerate CLI docs | `cd daemon && UPDATE_CLI_DOCS=1 go test ./cmd/daemon -run TestCLIDocs` |

`electron/daemon-go-types.generated.ts` comes from `openapi.yaml`; commit it, CI fails if it's stale. `electron/daemon-go-types.ts` is hand-written.

## Packaging

The root `Makefile` is the source of truth; recipes should call it. AUR packages live in a [separate repo](https://github.com/0bCdian/waypaper_packages_aur); details in [`packaging/README.md`](https://github.com/0bCdian/Waypaper-Engine/blob/main/packaging/README.md).

```bash
make deps
make electron
make install-system DESTDIR="$pkgdir" INSTALL_PREFIX_SYSTEM=/usr
```

`make help` lists the other targets. Wallpaper backends are separate packages; list them as optional dependencies.

## Adding a feature

- New endpoint: handler in `daemon/internal/handler/<group>/`, route in `daemon/internal/server/routes.go`, schema in `openapi.yaml` and `API_CONTRACT.md`, then `pnpm run generate:types`.
- New SSE event: constant in `daemon/internal/events/types.go`, then `API_CONTRACT.md`, `electron/daemon-go-types.ts` and [Events](/reference/events).
- New config key: Go struct and default in `daemon/internal/config/`, then [Config](/reference/config).
- New or changed CLI command: regenerate `docs/reference/cli.md` (command above).
- Keep Go types, `electron/daemon-go-types.ts` and `src/types/` in sync.
- Add a daemon unit test, update the [Manual](/manual/first-run) page if it's user-facing, and make `pnpm run ci:check` pass.

This is an unreleased rewrite: no compatibility shims or legacy aliases, break things and fix forward.
