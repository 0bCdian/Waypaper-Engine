# Wayland-Utani First-Party Integration Specification

> Status: proposal, implementation-ready
> Scope: spec-first milestone (no adapter implementation in this document)
> Projects: `waypaper-engine` and `wayland-utauri` (to be renamed to `Wayland-Utani`)

## 1) Goal

Formalize a stable first-party integration contract so `waypaper-engine` can use the Tauri Wayland renderer as a backend while both repositories remain independent projects.

This document defines:

- the full clean-break rename contract
- backend-to-control-API mapping
- capability and error translation rules
- monitor-detection ownership transition plan
- runtime and packaging constraints
- a concrete implementation checklist for follow-up execution

## 2) Naming Contract (Clean Break)

This milestone adopts a full rename, without compatibility aliases.

Brand:

- Product name: `Wayland-Utani`
- Tagline: `Wayland-Utani: Building Better Desktops. A Tauri-powered wallpaper setter for Waypaper-Engine.`

### 2.1 Identifier Mapping

| Surface | Old | New | Notes |
|---|---|---|---|
| Product name | `wayland-utauri` | `Wayland-Utani` | UI/docs/marketing text |
| Rust package | `wayland-utauri` | `wayland-utauri` | Cargo package identity |
| Rust lib name | `wayland_utauri_lib` | `wayland_utani_lib` | Crate lib target |
| Tauri productName | `wayland-utauri` | `Wayland-Utani` | `tauri.conf.json` |
| App identifier | `com.obsy.waylandutauri` | `com.obsy.waylandutauri` | Tauri bundle id |
| Service identity (health payload) | `wayland-utauri` | `wayland-utauri` | `GET /health` body |
| Canonical socket | `${XDG_RUNTIME_DIR}/wayland-utauri.sock` | `${XDG_RUNTIME_DIR}/wayland-utauri.sock` | No old-socket fallback |
| `/tmp` fallback socket | `/tmp/wayland-utauri.sock` | removed | clean-break policy |
| Engine backend type key | `wayland-utauri` (planned) | `wayland-utauri` | `backend.type` value in engine config |
| Packaging dependency name | `wayland-utauri` | `wayland-utauri` | AppImage/package metadata |

### 2.2 Clean-Break Rules

- No backend type aliases (`wayland-utauri` must not be accepted once renamed).
- No socket fallback to old names.
- No API examples/docs using old service identity.
- No runtime dual-name negotiation.

## 3) Existing Contract Baseline

Primary references:

- Engine backend interface: [`/home/obsy/dev/waypaper-engine/daemon/internal/backend/backend.go`](/home/obsy/dev/waypaper-engine/daemon/internal/backend/backend.go)
- Engine API contract: [`/home/obsy/dev/waypaper-engine/daemon/API_CONTRACT.md`](/home/obsy/dev/waypaper-engine/daemon/API_CONTRACT.md)
- Tauri control API contract: [`/home/obsy/dev/wayland-utauri/docs/API_CONTRACT.md`](/home/obsy/dev/wayland-utauri/docs/API_CONTRACT.md)
- Engine monitor model: [`/home/obsy/dev/waypaper-engine/daemon/internal/monitor/types.go`](/home/obsy/dev/waypaper-engine/daemon/internal/monitor/types.go)

## 4) Backend Interface to Control API Mapping

The future engine backend adapter must satisfy `backend.Backend` by translating calls into local Unix-socket HTTP requests.

### 4.1 Lifecycle Mapping

| Engine Backend Method | Wayland-Utani API | Behavior |
|---|---|---|
| `Name()` | n/a | returns `wayland-utauri` |
| `IsAvailable()` | socket probe + `GET /health` | available only if socket exists/connects and health returns `ok=true` with expected API version |
| `Initialize(ctx)` | `GET /health` (required), optional `POST /wallpaper/show` | fail if health fails or API version incompatible |
| `Shutdown(ctx)` | optional `POST /wallpaper/hide` | best-effort; should not hard-fail daemon shutdown |

### 4.2 Wallpaper Mapping

`backend.WallpaperRequest` to `POST /wallpaper/load`:

| Engine field | Wayland-Utani request field | Rule |
|---|---|---|
| `ImagePath` | `target` | absolute local path only |
| `Mode=individual` + single monitor | `targets=[{monitor, target}]` | monitor id resolved from monitor-name mapping table |
| `Mode=clone` | `target` + no per-monitor target list | runtime applies same wallpaper to all monitors |
| `Mode=extend` | Per-monitor `targets` after engine split (static images) or single `target` + clone (gif/video/web) | Engine splits static rasters; runtime receives per-monitor loads like other Wayland backends |
| backend config (`req.Config`) | transition/other fields | adapter maps typed config to control API fields |

The engine adapter sends `wait_for_completion=false` on **`POST /wallpaper/load`** (HTTP **202 Accepted**) so the Go client’s `request_timeout_ms` is not tied to transition duration. The wayland-utauri control API also defaults omitted `wait_for_completion` to **false** (async). Clients that need synchronous load errors on the HTTP response must send `wait_for_completion=true` with a long enough HTTP timeout.

### 4.2.1 Parallax vs load payload

- **Transition and duration** (`transition`, `duration_ms`) come from merged engine config (`backend.wayland-utauri` in TOML — same key as `backend.type`; legacy `backend.waylandutauri` is still read — or `req.Config` when set) and are sent on **`POST /wallpaper/load`** with each wallpaper apply.
- When **`parallax_enabled`** is true, the engine embeds a **`parallax`** object on the same load JSON (same field shapes as **`POST /wallpaper/parallax`**, without `monitor`). The Tauri runtime applies this as a **baseline zoom before the wallpaper transition** in the renderer, and updates native `ParallaxState` before emitting `wallpaper:load`. In that case the engine **does not** send a separate **`POST /wallpaper/parallax`** after load (avoids double-apply and the post-transition zoom pop).
- When parallax is **disabled**, the engine omits `parallax` on load and still calls **`POST /wallpaper/parallax`** after a successful load so the runtime resets/disables parallax. Config fields: `parallax_zoom` (UI percent 100–200 → scale ≥ 1.0), `parallax_step_percent`, `parallax_animation_ms`, `parallax_easing`, `reset_ms` (fixed at **400** ms in the adapter until a config key exists).

### 4.3 Capabilities Mapping

Proposed `Capabilities()` for adapter:

- `Compositors`: `[wayland]`
- `MediaTypes`: `[image, video, web]` (web/video only after validated implementation readiness)
- `Transitions`: `true`
- `PerMonitor`: `true`
- `DaemonProcess`: `true`

The first implemented adapter can conservatively report fewer media types if needed.

## 5) Data Model Compatibility

### 5.1 Monitor Identity Translation

Engine monitor model is name-based (`Monitor.Name`, e.g. `DP-1`), while current tauri runtime status/topology includes numeric monitor ids and stable identifiers.

Adapter translation contract:

1. Build monitor map from `GET /wallpaper/status.topology`.
2. Derive engine-facing `Monitor.Name` from `stable_id` when present.
3. If a stable id is unavailable, use deterministic fallback: `WAYLAND-OUTPUT-{monitor_id}`.
4. Cache map per request cycle; refresh on monitor events or status refresh.

This guarantees deterministic per-monitor targeting in engine APIs.

### 5.2 Status/Telemetry Translation

Adapter must expose a reduced, stable subset to engine logic:

- topology geometry
- per-monitor active/pending state
- transition outcome/timing for observability

Engine should not depend on renderer-internal telemetry fields for core correctness.

## 6) Error and Retry Contract

### 6.1 HTTP to Engine Error Class Mapping

| HTTP status | Adapter class | Engine action |
|---|---|---|
| `400` | validation/unsupported request | fail-fast, no retry |
| `404` | endpoint/version mismatch | fail-fast, mark unavailable |
| `409`/semantic conflict | transient command conflict | optional bounded retry |
| `504` | transition timeout | fail operation, backend remains healthy |
| `5xx` | backend internal failure | bounded retry, then fail |
| transport/socket error | unavailable | mark unavailable and fail over per policy |

### 6.2 Retry Policy

- No retries for `400` and contract mismatches.
- Retry budget for transient transport/internal errors: max 2 retries, exponential backoff (100ms, 300ms).
- If health check fails after retry budget, mark backend unavailable for current operation.

## 7) Versioning and Compatibility Matrix

Version source of truth: `X-API-Version` header from Wayland-Utani responses.

Compatibility policy:

- Engine adapter declares supported API major versions.
- Major mismatch => backend unavailable.
- Minor additive fields are tolerated (ignore unknown fields).

Initial matrix:

| Engine release line | Expected backend type | Supported Wayland-Utani API |
|---|---|---|
| `2.x` with adapter | `wayland-utauri` | `v1` |
| future `3.x` | `wayland-utauri` | `v1`, `v2` (planned) |

## 8) Capability and Selection Policy (Milestone 1)

Milestone-1 selection mode is explicit opt-in:

- Engine does not auto-switch to `wayland-utauri`.
- User/admin explicitly sets `backend.type=wayland-utauri`.
- Existing backends remain selectable and unchanged.

Degraded behavior rules:

- If backend unavailable at startup, engine stays on configured backend failure path.
- If backend becomes unavailable at runtime, operation fails with actionable error; no implicit backend switch in this milestone.

## 9) Monitor-Detection Ownership Roadmap

### Phase A (informational parity)

- Engine Wayland monitor chain: **Wayland-Utani** (control API topology) preferred, then **`wlr-randr`**; **X11**: `xrandr`. Tiling-WM CLIs (`hyprctl`, `swaymsg`) are not used.
- Wayland-Utani topology is both the preferred monitor list (when the socket is up) and the source for adapter-local monitor id translation.

Readiness:

- adapter can set wallpaper on selected monitors reliably
- topology translation test coverage complete

Rollback:

- disable adapter backend; legacy providers continue unchanged

Observability:

- adapter monitor-map build success/failure counters
- mismatch counters (`unknown_monitor_name`, `missing_stable_id`)

### Phase B (optional monitor source)

- *(Largely superseded by default engine behavior.)* Engine prefers Wayland-Utani when healthy; `wlr-randr` remains the Wayland fallback.

Readiness:

- parity validation across major compositors (Hyprland/Sway/wlroots)

Rollback:

- n/a — fall back is generic `wlr-randr`, not compositor-specific CLIs

Observability:

- source selection metrics
- refresh latency and topology drift metrics

### Phase C (preferred monitor source on Wayland)

- Wayland-Utani monitor detection preferred on Wayland when the control socket is available.
- `wlr-randr` used as fallback on Wayland; `xrandr` on X11.

Readiness:

- sustained reliability SLO and error budget adherence
- packaging/distribution guarantees in place

Rollback:

- toggle back to legacy provider preference globally

Observability:

- fallback activation rate
- health/version mismatch rate

## 10) Runtime and Packaging Contract

### 10.1 Runtime

- Canonical socket path: `${XDG_RUNTIME_DIR}/wayland-utauri.sock`.
- No `/tmp` fallback in clean-break model.
- Startup ordering for packaged bundles:
  1. start/check Wayland-Utani
  2. verify health + API version
  3. allow adapter backend initialization
- Health timeout budget:
  - connect timeout: 500ms
  - request timeout: 1500ms

### 10.2 Packaging

- AppImage distributions should include both `waypaper-engine` and `wayland-utauri`.
- Arch packages should declare `wayland-utauri` as required dependency for first-party Wayland path.
- If package split is used, adapter backend package should depend on `wayland-utauri` runtime package.

## 11) Implementation Handoff (For Follow-Up LLM/Engineer)

### 11.1 Files to Create/Modify in `waypaper-engine`

- Create backend package:
  - `daemon/internal/backend/waylandutauri/waylandutauri.go`
  - `daemon/internal/backend/waylandutauri/config.go`
  - `daemon/internal/backend/waylandutauri/client.go`
  - `daemon/internal/backend/waylandutauri/mapping.go`
  - `daemon/internal/backend/waylandutauri/errors.go`
- Register backend in startup:
  - `daemon/cmd/daemon/main.go`
- Add defaults/config handling:
  - `daemon/internal/config/viper_manager.go`
  - `daemon/internal/config/types.go`
- Contract docs updates:
  - `daemon/API_CONTRACT.md`
  - `docs/ARCHITECTURE.md`
- Packaging updates:
  - `packaging/README.md`
  - `packaging/rpm/waypaper-engine.spec`
  - `packaging/snap/snapcraft.yaml`

### 11.2 Tests to Add

- Unit tests:
  - API payload mapping (`WallpaperRequest` -> `/wallpaper/load`)
  - monitor identity translation
  - error/status mapping and retry behavior
  - capability reporting
- Integration tests:
  - unix socket health/version negotiation
  - per-monitor wallpaper set in `individual` mode
  - clone/extend mode behavior
  - unavailable backend startup behavior

### 11.3 Contract Tests Against Wayland-Utani API

- Validate expected `X-API-Version` handling.
- Validate `GET /health` response contract (`ok`, `service`).
- Validate timeout and error semantics for `/wallpaper/load`.

### 11.4 Acceptance Criteria for First Adapter Release

- `backend.type=wayland-utauri` works end-to-end for Wayland image wallpaper operations.
- Explicit opt-in behavior is preserved.
- No rename compatibility aliases are present.
- Packaging metadata for first-party path is updated.
- All new tests pass in CI.

## 12) Non-Goals for This Milestone

- automatic backend auto-selection
- full monitor provider replacement in engine core
- deprecating existing backends (`awww`, `feh`, `hyprpaper`)
- introducing a second transport beyond local Unix socket HTTP
