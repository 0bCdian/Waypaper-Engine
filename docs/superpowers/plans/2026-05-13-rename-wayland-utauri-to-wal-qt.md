# Rename wayland-utauri → wal-qt Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminate the `wayland-utauri` name from `waypaper-engine` and `wal-qt`. The Wayland WebEngine wallpaper host is now first-class `wal-qt`; the daemon spawns and talks to it by that name. The HTTP API shape stays identical; only identifiers, paths, and labels change.

**Architecture:** Coordinated, breaking rename across two repos. The runtime contract (binary on PATH, Unix socket path, `/health.service` string, backend ID in config) all change in lock-step:

- Binary on PATH: `wayland-utauri` → `wal-qt` (wal-qt's CMake target is already `wal-qt`; the engine simply spawns it by its real name)
- Socket: `$XDG_RUNTIME_DIR/wayland-utauri.sock` → `wal-qt.sock` (lock `.lock` likewise)
- `GET /health` `service` field: `"wayland-utauri"` → `"wal-qt"`
- TOML backend type & table: `wayland-utauri` / `[backend.wayland-utauri]` → `wal-qt` / `[backend.wal-qt]`
- Internal HTTP host placeholder: `http://wayland-utauri.local` → `http://wal-qt.local`
- LayerShell scope: `wayland-utauri-monitor-N` → `wal-qt-monitor-N`
- Go package `daemon/internal/backend/waylandutauri/` → `walqt/`; type `WaylandUtauri` → `WalQt`; const `WaylandUtauriBackendName` → `WalQtBackendName`
- TS type `WaylandUtauriConfig` → `WalQtConfig`; UI/field-prefix mapping updated
- CLAUDE.md says "no compatibility shims or legacy aliases" — we do not accept the old name anywhere. Users with stale `[backend.wayland-utauri]` in `config.toml` must rename it; we surface a clear error.

**Tech Stack:** Go 1.26 (daemon), TypeScript / React (Electron renderer), C++/Qt6 + Vite TS renderer (wal-qt). pnpm 9. CMake. Both repos in `/home/obsy/dev/waypaper/`.

**Branches:** `waypaper-engine` → `refactor/waypaper-engine`. `wal-qt` → `main`.

**Coordination note for the executor:** wal-qt and waypaper-engine **must be released together** because the socket path and service name change simultaneously. Phase A (wal-qt) and Phase B–E (waypaper-engine) can be developed independently but the integration test in Phase F requires both.

**Pre-existing tangential terms in the codebase** that are NOT in scope of this rename:
- `wal-utauri` / `waypaper-tauri` — historical predecessor project names; cleaned only where they appear in comments alongside `wayland-utauri` and the surrounding sentence is being rewritten anyway. Do not chase them globally.

---

## File Structure

### Repo: `wal-qt/` (host)

| Path | Change |
|------|--------|
| `src/util/socket_path.cpp` | socket / lock filenames |
| `src/app/single_instance.cpp` | comment |
| `src/wallpaper/wallpaper_controller.cpp` | `service` JSON field in `/health` |
| `src/wallpaper/wallpaper_window.cpp` | LayerShell scope |
| `tests/test_socket_path.cpp` | expected paths |
| `tests/test_health_contract.cpp` | expected `service` value |
| `scripts/install-waypaper-hijack.sh` | rename to `scripts/install-wal-qt.sh`; install `wal-qt` directly (no symlink renaming) |
| `scripts/verify-waypaper-engine-api.sh` | socket path + jq assertion |
| `renderer/src/renderer/types.ts` | comment header |
| `renderer/src/generated/control-plane.ts` | example string in OpenAPI-generated file |
| `README.md` | full rewrite of integration section |
| `docs/CONTEXT.md` | drop "hijack symlink" framing |

### Repo: `waypaper-engine/` (daemon + Electron)

| Path | Change |
|------|--------|
| `daemon/internal/backend/waylandutauri/` (directory) | rename to `daemon/internal/backend/walqt/`; package `waylandutauri` → `walqt`; type `WaylandUtauri` → `WalQt`; file `waylandutauri.go` → `walqt.go` (+ matching `_test.go`) |
| `daemon/internal/backend/backend.go` | `WaylandUtauriBackendName` → `WalQtBackendName`; doc comments |
| `daemon/internal/backenddefaults/defaults.go` | const + switch case |
| `daemon/internal/config/types.go` | doc comments |
| `daemon/internal/config/viper_manager.go` | default priority lists |
| `daemon/internal/handler/healthhandler/health.go` & test | `monitor_provider_order` default |
| `daemon/internal/handler/confighandler/config_test.go` | test data |
| `daemon/internal/handler/wallpaperhandler/wallpaper_current_response_test.go` | test data |
| `daemon/internal/wallpaper/{apply,restore,push_web_config,audio,push_source_target}.go` & `restore_test.go` | comments + branching strings + user-facing error |
| `daemon/internal/playlist/{manager,restore_test}.go` | comments |
| `daemon/internal/monitor/{types,provider,provider_wayland}.go` | comments + provider name `"wayland-utauri"` → `"wal-qt"` |
| `daemon/internal/events/types.go` | comment |
| `daemon/internal/daemon/daemon.go` | comment |
| `daemon/cmd/daemon/main.go` | comment |
| `daemon/cmd/daemon/monitor_providers.go` | comment |
| `daemon/internal/backend/select_test.go` | test data |
| `config.toml` | `type = "wal-qt"`, `[backend.wal-qt]` |
| `electron/daemon-go-types.ts` | `WaylandUtauriConfig` → `WalQtConfig`; field key `"wayland-utauri"` / `waylandutauri` → `"wal-qt"` (no alias) |
| `src/utils/backendFieldPrefixes.ts` | mapping entry |
| `src/utils/__tests__/backendFieldPrefixes.test.ts` | tests |
| `src/utils/monitorNames.ts` | delete legacy normalizer (CLAUDE.md no-shims) **and** update callers — see Task 17 for the explicit option |
| `src/utils/__tests__/monitorNames.test.ts` | adjust |
| `src/utils/resolveWallpaperImageId.ts` & test | update or remove legacy normalizer call |
| `src/utils/__tests__/resolveWallpaperImageId.test.ts` | update |
| `src/utils/__tests__/settingsNavStorage.test.ts` | adjust persisted keys |
| `src/utils/settingsSearchIndex.ts` | description copy |
| `src/components/ImageDetailSidebar.tsx` | imports + branching + user-facing copy |
| `src/components/settings/sections/BackendSettingsSection.tsx` | all branches, field group names, copy |
| `src/stores/__tests__/{monitors,settingsStore}.test.ts` | test data |
| `tools/parallax_set_offset_monitor.sh` | socket + HTTP host |
| `daemon/API_CONTRACT.md` | header / examples |
| `daemon/docs/ARCHITECTURE.md` | description |
| `docs/guide/{app,backends,faq,glossary,first-run,config,packaging,introduction}.md`, `docs/api/{overview,sse}.md`, `docs/dev/development.md`, `docs/index.md` | replace identifier; keep tone |
| `docs/superpowers/plans/2026-04-30-daemon-architecture.md` | leave as historical; only fix if it's a checked spec actively executed (it isn't) — **skip** |
| `packaging/README.md` | optional-deps list, AUR row |

---

## Phase A — wal-qt host repo

Work entirely inside `/home/obsy/dev/waypaper/wal-qt/`. Default branch `main`.

### Task 1: Rename socket and lock paths in wal-qt source

**Files:**
- Modify: `wal-qt/src/util/socket_path.cpp`
- Modify: `wal-qt/src/app/single_instance.cpp`

- [ ] **Step 1: Update `socket_path.cpp`**

Replace the two literal filenames:

```cpp
QString socketPath() { return base() + "/wal-qt.sock"; }
QString lockPath()   { return base() + "/wal-qt.lock"; }
```

- [ ] **Step 2: Update the orphan-lock comment in `single_instance.cpp`**

Find:

```
    // orphan $XDG_RUNTIME_DIR/wayland-utauri.lock blocks every new start forever.
```

Replace with:

```
    // orphan $XDG_RUNTIME_DIR/wal-qt.lock blocks every new start forever.
```

- [ ] **Step 3: Update the socket-path unit test**

Edit `wal-qt/tests/test_socket_path.cpp`. Replace the three literal strings:

```cpp
QCOMPARE(walqt::socketPath(), QString("/run/user/1000/wal-qt.sock"));
QCOMPARE(walqt::lockPath(),   QString("/run/user/1000/wal-qt.lock"));
...
QVERIFY(walqt::socketPath().endsWith("/wal-qt.sock"));
```

- [ ] **Step 4: Build and run tests**

```bash
cd /home/obsy/dev/waypaper/wal-qt && make build && make test
```

Expected: all ctest cases pass.

- [ ] **Step 5: Commit**

```bash
cd /home/obsy/dev/waypaper/wal-qt
git add src/util/socket_path.cpp src/app/single_instance.cpp tests/test_socket_path.cpp
git commit -m "rename: socket/lock paths to wal-qt.{sock,lock}"
```

### Task 2: Rename `service` field in `/health` and update the health test

**Files:**
- Modify: `wal-qt/src/wallpaper/wallpaper_controller.cpp`
- Modify: `wal-qt/tests/test_health_contract.cpp`

- [ ] **Step 1: Update the `service` string in `wallpaper_controller.cpp` line 119**

Find:

```cpp
        h["service"] = QStringLiteral("wayland-utauri");
```

Replace with:

```cpp
        h["service"] = QStringLiteral("wal-qt");
```

- [ ] **Step 2: Update the health contract test**

In `wal-qt/tests/test_health_contract.cpp` around line 38, change the expected literal from `QStringLiteral("wayland-utauri")` to `QStringLiteral("wal-qt")`.

- [ ] **Step 3: Rebuild and test**

```bash
cd /home/obsy/dev/waypaper/wal-qt && make build && make test
```

Expected: all tests pass; specifically `test_health_contract` reports the new service string.

- [ ] **Step 4: Commit**

```bash
cd /home/obsy/dev/waypaper/wal-qt
git add src/wallpaper/wallpaper_controller.cpp tests/test_health_contract.cpp
git commit -m "rename: /health.service is now \"wal-qt\""
```

### Task 3: Rename LayerShell scope per monitor

**Files:**
- Modify: `wal-qt/src/wallpaper/wallpaper_window.cpp`

- [ ] **Step 1: Edit line 84**

Find:

```cpp
    ls->setScope(QStringLiteral("wayland-utauri-monitor-%1").arg(monitorIndex_));
```

Replace with:

```cpp
    ls->setScope(QStringLiteral("wal-qt-monitor-%1").arg(monitorIndex_));
```

- [ ] **Step 2: Rebuild**

```bash
cd /home/obsy/dev/waypaper/wal-qt && make build
```

Expected: clean build.

- [ ] **Step 3: Commit**

```bash
cd /home/obsy/dev/waypaper/wal-qt
git add src/wallpaper/wallpaper_window.cpp
git commit -m "rename: LayerShell scope to wal-qt-monitor-N"
```

### Task 4: Replace `install-waypaper-hijack.sh` with a plain `install-wal-qt.sh`

Why: with the binary now named `wal-qt` end-to-end, there is no "hijack symlink" — the script just installs the binary onto `PATH`.

**Files:**
- Delete: `wal-qt/scripts/install-waypaper-hijack.sh`
- Create: `wal-qt/scripts/install-wal-qt.sh`

- [ ] **Step 1: Read the existing script to keep the env-override convention**

```bash
cat /home/obsy/dev/waypaper/wal-qt/scripts/install-waypaper-hijack.sh
```

- [ ] **Step 2: Create `install-wal-qt.sh`**

Write `wal-qt/scripts/install-wal-qt.sh` with this content:

```bash
#!/usr/bin/env bash
# Install the wal-qt binary onto PATH so waypaper-engine's daemon can spawn it.
set -euo pipefail

SRC="${WAL_QT_BINARY:-${1:-build/wal-qt}}"
DEST_DIR="${WAL_QT_INSTALL_BIN_DIR:-$HOME/.local/bin}"
LINK_PATH="${DEST_DIR}/wal-qt"

if [[ ! -x "$SRC" ]]; then
  echo "wal-qt binary not found or not executable: $SRC" >&2
  echo "Build it with: make build" >&2
  exit 1
fi

mkdir -p "$DEST_DIR"
ln -sfn "$(realpath "$SRC")" "$LINK_PATH"
echo "Installed: $LINK_PATH -> $(realpath "$SRC")"
echo "Ensure $DEST_DIR is on \$PATH."
echo "Stop any existing wal-qt host before starting the engine; remove stale"
echo "  \$XDG_RUNTIME_DIR/wal-qt.sock and \$XDG_RUNTIME_DIR/wal-qt.lock if needed."
```

```bash
chmod +x /home/obsy/dev/waypaper/wal-qt/scripts/install-wal-qt.sh
```

- [ ] **Step 3: Remove the old script**

```bash
cd /home/obsy/dev/waypaper/wal-qt
git rm scripts/install-waypaper-hijack.sh
```

- [ ] **Step 4: Commit**

```bash
cd /home/obsy/dev/waypaper/wal-qt
git add scripts/install-wal-qt.sh
git commit -m "rename: install script (drop hijack framing)"
```

### Task 5: Update `verify-waypaper-engine-api.sh`

**Files:**
- Modify: `wal-qt/scripts/verify-waypaper-engine-api.sh`

- [ ] **Step 1: Replace socket and service references**

Apply these literal substitutions across the file:
- `wayland-utauri.sock` → `wal-qt.sock` (three occurrences)
- `.service == "wayland-utauri"` → `.service == "wal-qt"` (in the `jq -e` assertion)
- Update the top comment: `# Exercise every HTTP path the waypaper-engine daemon uses on wal-qt`

```bash
cd /home/obsy/dev/waypaper/wal-qt
sed -i 's/wayland-utauri\.sock/wal-qt.sock/g; s/\.service == "wayland-utauri"/.service == "wal-qt"/g; s/uses on wayland-utauri/uses on wal-qt/g' scripts/verify-waypaper-engine-api.sh
```

- [ ] **Step 2: Verify no stragglers**

```bash
cd /home/obsy/dev/waypaper/wal-qt && grep -n "wayland-utauri" scripts/verify-waypaper-engine-api.sh || echo OK
```

Expected: `OK`.

- [ ] **Step 3: Commit**

```bash
cd /home/obsy/dev/waypaper/wal-qt
git add scripts/verify-waypaper-engine-api.sh
git commit -m "rename: verify script uses wal-qt socket/service"
```

### Task 6: Renderer type comment and generated control-plane example

**Files:**
- Modify: `wal-qt/renderer/src/renderer/types.ts`
- Modify: `wal-qt/renderer/src/generated/control-plane.ts`

- [ ] **Step 1: Update the renderer types header comment**

In `renderer/src/renderer/types.ts` line 2: change `Wire-contract types for the wayland-utauri renderer.` to `Wire-contract types for the wal-qt renderer.`

- [ ] **Step 2: Update the generated control-plane example**

In `renderer/src/generated/control-plane.ts` around line 405: change `@example wayland-utauri` to `@example wal-qt`.

Note: this file is auto-generated; if the wal-qt build regenerates it from an OpenAPI spec, also update the source spec. Search:

```bash
cd /home/obsy/dev/waypaper/wal-qt && grep -rn "wayland-utauri" --include="*.yaml" --include="*.yml" --include="*.json" 2>/dev/null | grep -v node_modules | grep -v build
```

If hits found, update the matching `example:` field there too.

- [ ] **Step 3: Run renderer checks**

```bash
cd /home/obsy/dev/waypaper/wal-qt/renderer && npm run check:all:strict
```

Expected: pass.

- [ ] **Step 4: Commit**

```bash
cd /home/obsy/dev/waypaper/wal-qt
git add renderer/src/renderer/types.ts renderer/src/generated/control-plane.ts
git commit -m "rename: renderer wire-contract comment and example"
```

### Task 7: Rewrite `wal-qt/README.md` and `docs/CONTEXT.md` — drop the hijack story

**Files:**
- Modify: `wal-qt/README.md`
- Modify: `wal-qt/docs/CONTEXT.md`

- [ ] **Step 1: Rewrite the README intro section**

Open `wal-qt/README.md`. Replace the integration paragraph (currently lines ~3 and ~30–51) so it reads — keep the surrounding structure / TOC unchanged:

```
`wal-qt` is a Wayland wallpaper host process written in C++/Qt6 that places one full-screen
`QWebEngineView` per physical output on the Wayland compositor's background layer via
`zwlr_layer_shell_v1` (using LayerShellQt), and serves an HTTP control API over a Unix
domain socket so the waypaper-engine Go daemon can drive it.
```

Replace the "Use with waypaper-engine" section so that:
- Drop every mention of "hijack" and the rename-symlink to `wayland-utauri`.
- Document the new install path: `./scripts/install-wal-qt.sh` puts `~/.local/bin/wal-qt -> build/wal-qt`. Override dir with `WAL_QT_INSTALL_BIN_DIR`, source with `WAL_QT_BINARY` or first positional arg.
- Stale-socket recovery: delete `$XDG_RUNTIME_DIR/wal-qt.sock` and `wal-qt.lock`.
- Tested integration: same Hyprland setup; layer-shell namespace is now `wal-qt-monitor-N`.

- [ ] **Step 2: Update `docs/CONTEXT.md`**

Replace the paragraph on line ~52 that describes the symlink trick. Suggested new wording:

```
`scripts/install-wal-qt.sh` installs `~/.local/bin/wal-qt -> build/wal-qt` so the
waypaper-engine Go daemon spawns it directly. wal-qt's HTTP control surface is the
authoritative API — wire compatibility with prior `wayland-utauri` builds is no longer
maintained.
```

- [ ] **Step 3: Sanity-check no straggler references remain in repo**

```bash
cd /home/obsy/dev/waypaper/wal-qt && grep -rin "wayland-utauri\|waylandUtauri\|WaylandUtauri" --exclude-dir=build --exclude-dir=build-release --exclude-dir=node_modules --exclude-dir=.git --exclude-dir=.cache . || echo OK
```

Expected: `OK`. If anything appears, fix it in this task before committing.

- [ ] **Step 4: Final build + tests + renderer check**

```bash
cd /home/obsy/dev/waypaper/wal-qt && make build && make test && (cd renderer && npm run check:all:strict)
```

Expected: all green.

- [ ] **Step 5: Commit**

```bash
cd /home/obsy/dev/waypaper/wal-qt
git add README.md docs/CONTEXT.md
git commit -m "docs: rebrand wal-qt as first-class host (drop hijack framing)"
```

---

## Phase B — Daemon package rename and core constants

Work inside `/home/obsy/dev/waypaper/waypaper-engine/` on branch `refactor/waypaper-engine`.

### Task 8: Rename the Go package directory and files

**Files:**
- Rename: `daemon/internal/backend/waylandutauri/` → `daemon/internal/backend/walqt/`
- Within the renamed dir: `waylandutauri.go` → `walqt.go`, `waylandutauri_test.go` → `walqt_test.go`

- [ ] **Step 1: Move the directory and rename the two top-level files**

```bash
cd /home/obsy/dev/waypaper/waypaper-engine
git mv daemon/internal/backend/waylandutauri daemon/internal/backend/walqt
git mv daemon/internal/backend/walqt/waylandutauri.go daemon/internal/backend/walqt/walqt.go
git mv daemon/internal/backend/walqt/waylandutauri_test.go daemon/internal/backend/walqt/walqt_test.go
```

- [ ] **Step 2: Rewrite the `package` declaration in every file in the renamed dir**

```bash
cd /home/obsy/dev/waypaper/waypaper-engine
sed -i 's/^package waylandutauri$/package walqt/' daemon/internal/backend/walqt/*.go
```

Verify:

```bash
grep -l "^package " daemon/internal/backend/walqt/*.go | xargs grep "^package " | sort -u
```

Expected: every file shows `package walqt`.

- [ ] **Step 3: Update imports across the daemon**

```bash
cd /home/obsy/dev/waypaper/waypaper-engine
grep -rl "waypaper-engine/daemon/internal/backend/waylandutauri" daemon/ | xargs sed -i 's|waypaper-engine/daemon/internal/backend/waylandutauri|waypaper-engine/daemon/internal/backend/walqt|g'
```

Verify no leftover import paths:

```bash
grep -rn "internal/backend/waylandutauri" /home/obsy/dev/waypaper/waypaper-engine/daemon || echo OK
```

Expected: `OK`.

- [ ] **Step 4: Rename the package-local identifiers in the renamed dir**

Inside `daemon/internal/backend/walqt/walqt.go` and its test file, rename the type and the binary-name / viper-key constants:

```bash
cd /home/obsy/dev/waypaper/waypaper-engine/daemon/internal/backend/walqt
# Type: WaylandUtauri -> WalQt (struct, methods, var assertion, ctor)
sed -i 's/\bWaylandUtauri\b/WalQt/g' *.go
# Binary name constant (the literal string is also updated)
sed -i 's/const binaryName = "wayland-utauri"/const binaryName = "wal-qt"/' walqt.go
# Viper key
sed -i 's/const viperBackendKey = "backend\.wayland-utauri"/const viperBackendKey = "backend.wal-qt"/' walqt.go
# defaultExpectedService in config.go
sed -i 's/defaultExpectedService = "wayland-utauri"/defaultExpectedService = "wal-qt"/' config.go
# HTTP host placeholder in client.go
sed -i 's|http://wayland-utauri\.local|http://wal-qt.local|g' client.go
# Socket file in config.go
sed -i 's|"wayland-utauri\.sock"|"wal-qt.sock"|g' config.go
```

Then update every log message / error message in the renamed dir — they currently say "wayland-utauri:", change to "wal-qt:":

```bash
sed -i 's/wayland-utauri/wal-qt/g' *.go
```

This second sweep also rewrites the `// Comments` referring to wayland-utauri inside this package. That is intentional — they belong to this backend.

- [ ] **Step 5: Confirm nothing in the package still says `wayland-utauri`**

```bash
cd /home/obsy/dev/waypaper/waypaper-engine && grep -n "wayland-utauri\|waylandutauri\|WaylandUtauri" daemon/internal/backend/walqt/*.go || echo OK
```

Expected: `OK`.

- [ ] **Step 6: Update `backend.WaylandUtauriBackendName` callers and definition**

Edit `daemon/internal/backend/backend.go` lines ~22–23 — change the constant name and value:

```go
// WalQtBackendName is the stable Name() value for the wal-qt backend.
const WalQtBackendName = "wal-qt"
```

Then rewrite each comment in `backend.go` that mentions `wayland-utauri` (lines ~82, 155, 176, 183) by replacing `wayland-utauri` with `wal-qt`.

Update every reference across the daemon:

```bash
cd /home/obsy/dev/waypaper/waypaper-engine
grep -rl "WaylandUtauriBackendName" daemon/ | xargs sed -i 's/\bWaylandUtauriBackendName\b/WalQtBackendName/g'
```

Verify:

```bash
grep -rn "WaylandUtauriBackendName" /home/obsy/dev/waypaper/waypaper-engine || echo OK
```

Expected: `OK`.

- [ ] **Step 7: Build the daemon**

```bash
cd /home/obsy/dev/waypaper/waypaper-engine && make daemon
```

Expected: clean build. If `go build` fails because of a missed identifier, grep for `waylandutauri`/`WaylandUtauri` and fix.

- [ ] **Step 8: Commit**

```bash
cd /home/obsy/dev/waypaper/waypaper-engine
git add -A daemon/
git commit -m "rename: daemon backend package waylandutauri -> walqt"
```

### Task 9: Rewrite remaining daemon string literals and comments

Comment-only and string-literal updates in non-backend daemon files. Each change is a literal substitution; the build must stay green.

**Files:**
- Modify: `daemon/internal/backenddefaults/defaults.go`
- Modify: `daemon/internal/config/types.go`
- Modify: `daemon/internal/config/viper_manager.go`
- Modify: `daemon/internal/handler/healthhandler/health.go`
- Modify: `daemon/internal/handler/healthhandler/health_test.go`
- Modify: `daemon/internal/handler/confighandler/config_test.go`
- Modify: `daemon/internal/handler/wallpaperhandler/wallpaper_current_response_test.go`
- Modify: `daemon/internal/wallpaper/apply.go`
- Modify: `daemon/internal/wallpaper/restore.go`
- Modify: `daemon/internal/wallpaper/restore_test.go`
- Modify: `daemon/internal/wallpaper/push_web_config.go`
- Modify: `daemon/internal/wallpaper/audio.go`
- Modify: `daemon/internal/wallpaper/push_source_target.go`
- Modify: `daemon/internal/playlist/manager.go`
- Modify: `daemon/internal/playlist/restore_test.go`
- Modify: `daemon/internal/monitor/types.go`
- Modify: `daemon/internal/monitor/provider.go`
- Modify: `daemon/internal/monitor/provider_wayland.go`
- Modify: `daemon/internal/events/types.go`
- Modify: `daemon/internal/daemon/daemon.go`
- Modify: `daemon/cmd/daemon/main.go`
- Modify: `daemon/cmd/daemon/monitor_providers.go`
- Modify: `daemon/internal/backend/select_test.go`

- [ ] **Step 1: Sweep `wayland-utauri` → `wal-qt` across daemon code**

```bash
cd /home/obsy/dev/waypaper/waypaper-engine
grep -rl "wayland-utauri" daemon/ | xargs sed -i 's/wayland-utauri/wal-qt/g'
```

This covers:
- `waylandUtauriBackendName` constant in `backenddefaults/defaults.go` (its string value) — `case waylandUtauriBackendName:` switch reference still works because it's a local const. Also rename the const itself:

```bash
cd /home/obsy/dev/waypaper/waypaper-engine
sed -i 's/\bwaylandUtauriBackendName\b/walQtBackendName/g' daemon/internal/backenddefaults/defaults.go
```

Also rename the `Name: "wayland-utauri"` → `Name: "wal-qt"` literal in test fixtures (already covered by the bulk sed above), and `RegisterDefaults` keys (also covered).

- [ ] **Step 2: Fix the `TestRestore_WaylandUtauriBatchesIndividualImageRows` test function name**

```bash
cd /home/obsy/dev/waypaper/waypaper-engine
sed -i 's/TestRestore_WaylandUtauriBatchesIndividualImageRows/TestRestore_WalQtBatchesIndividualImageRows/' daemon/internal/wallpaper/restore_test.go
```

- [ ] **Step 3: Verify no leftover `wayland-utauri` (any casing) anywhere in daemon code**

```bash
cd /home/obsy/dev/waypaper/waypaper-engine && grep -rin "wayland-utauri\|waylandutauri\|WaylandUtauri" daemon/ || echo OK
```

Expected: `OK`. If matches appear in markdown under `daemon/docs/` or `daemon/API_CONTRACT.md`, they will be handled in Task 14 — but the bulk sed above will already have changed them; that's fine.

- [ ] **Step 4: Build daemon and run all daemon tests**

```bash
cd /home/obsy/dev/waypaper/waypaper-engine && make daemon && pnpm run test:daemon
```

Expected: all green.

- [ ] **Step 5: Commit**

```bash
cd /home/obsy/dev/waypaper/waypaper-engine
git add -A daemon/
git commit -m "rename: drop wayland-utauri identifier from daemon"
```

### Task 10: Update `config.toml` example

**Files:**
- Modify: `waypaper-engine/config.toml`

- [ ] **Step 1: Replace the `type` enum hint and the table header**

```bash
cd /home/obsy/dev/waypaper/waypaper-engine
sed -i 's/"awww" | "hyprpaper" | "feh" | "wayland-utauri"/"awww" | "hyprpaper" | "feh" | "wal-qt"/' config.toml
sed -i 's/^\[backend\.wayland-utauri\]$/[backend.wal-qt]/' config.toml
sed -i 's/expected_service = "wayland-utauri"/expected_service = "wal-qt"/' config.toml
```

If the existing example also uses `type = "wayland-utauri"`, change to `type = "wal-qt"`:

```bash
grep -n '^type = "wayland-utauri"' config.toml && sed -i 's/^type = "wayland-utauri"$/type = "wal-qt"/' config.toml
```

- [ ] **Step 2: Verify**

```bash
grep -n "wayland-utauri\|waylandutauri" /home/obsy/dev/waypaper/waypaper-engine/config.toml || echo OK
```

Expected: `OK`.

- [ ] **Step 3: Commit**

```bash
cd /home/obsy/dev/waypaper/waypaper-engine
git add config.toml
git commit -m "config: example uses wal-qt backend type/table"
```

---

## Phase C — Electron / renderer TS

### Task 11: Update `electron/daemon-go-types.ts`

**Files:**
- Modify: `waypaper-engine/electron/daemon-go-types.ts`

- [ ] **Step 1: Rename the config-type interface and the union key**

Apply these substitutions to `electron/daemon-go-types.ts`:

```bash
cd /home/obsy/dev/waypaper/waypaper-engine
# Interface name
sed -i 's/\bWaylandUtauriConfig\b/WalQtConfig/g' electron/daemon-go-types.ts
# Key on the merged BackendConfig union: keep ONE form, "wal-qt"; drop both legacy aliases per CLAUDE.md no-shims rule
sed -i 's/"wayland-utauri"?: WalQtConfig;/"wal-qt"?: WalQtConfig;/' electron/daemon-go-types.ts
sed -i '/waylandutauri?: WalQtConfig;/d' electron/daemon-go-types.ts
# Doc comments
sed -i 's/wayland-utauri/wal-qt/g' electron/daemon-go-types.ts
# The comment 'Merged from [backend.wayland-utauri]' is rewritten by the above pass.
```

- [ ] **Step 2: Verify**

```bash
grep -n "wayland-utauri\|waylandutauri\|WaylandUtauri" /home/obsy/dev/waypaper/waypaper-engine/electron/daemon-go-types.ts || echo OK
```

Expected: `OK`.

- [ ] **Step 3: Run typecheck**

```bash
cd /home/obsy/dev/waypaper/waypaper-engine && pnpm exec tsc -p tsconfig.json --noEmit
```

Expected: any TS errors come from callers — those are fixed in the next tasks; do not panic. Note the failing files for cross-reference.

- [ ] **Step 4: Commit**

```bash
cd /home/obsy/dev/waypaper/waypaper-engine
git add electron/daemon-go-types.ts
git commit -m "types: rename WaylandUtauriConfig -> WalQtConfig"
```

### Task 12: Update field-prefix mapping and its test

**Files:**
- Modify: `src/utils/backendFieldPrefixes.ts`
- Modify: `src/utils/__tests__/backendFieldPrefixes.test.ts`

- [ ] **Step 1: Update the map entry**

In `src/utils/backendFieldPrefixes.ts` line 10, change:

```ts
"wayland-utauri": "waylandutauri.",
```

to:

```ts
"wal-qt": "walqt.",
```

- [ ] **Step 2: Update the unit test fixtures**

In `src/utils/__tests__/backendFieldPrefixes.test.ts`, swap `wayland-utauri` for `wal-qt` and `waylandutauri.` for `walqt.` wherever they appear:

```bash
cd /home/obsy/dev/waypaper/waypaper-engine
sed -i 's/wayland-utauri/wal-qt/g; s/waylandutauri\./walqt./g' src/utils/__tests__/backendFieldPrefixes.test.ts
```

- [ ] **Step 3: Run the test**

```bash
cd /home/obsy/dev/waypaper/waypaper-engine && pnpm vitest run src/utils/__tests__/backendFieldPrefixes.test.ts
```

Expected: pass.

- [ ] **Step 4: Commit**

```bash
cd /home/obsy/dev/waypaper/waypaper-engine
git add src/utils/backendFieldPrefixes.ts src/utils/__tests__/backendFieldPrefixes.test.ts
git commit -m "rename: field-prefix map key wal-qt -> walqt."
```

### Task 13: Update settings UI components

**Files:**
- Modify: `src/components/ImageDetailSidebar.tsx`
- Modify: `src/components/settings/sections/BackendSettingsSection.tsx`
- Modify: `src/utils/settingsSearchIndex.ts`

- [ ] **Step 1: `ImageDetailSidebar.tsx` — rename helper and import**

Apply:

```bash
cd /home/obsy/dev/waypaper/waypaper-engine
sed -i \
  -e 's/\bWaylandUtauriConfig\b/WalQtConfig/g' \
  -e 's/\bwaylandUtauriFromUnified\b/walQtFromUnified/g' \
  -e 's/"wayland-utauri"/"wal-qt"/g' \
  -e 's/b\["wayland-utauri"\] ?? b\.waylandutauri/b["wal-qt"]/g' \
  src/components/ImageDetailSidebar.tsx
```

Then manually rewrite the two user-facing copy strings (lines ~426 and ~450) from "Backend → wayland-utauri" to "Backend → wal-qt":

```bash
cd /home/obsy/dev/waypaper/waypaper-engine
sed -i 's/Backend → wayland-utauri/Backend → wal-qt/g' src/components/ImageDetailSidebar.tsx
```

Also rename the local variable `wutCfg`/`wut` for clarity — leave names as-is; renaming locals is out of scope. Only the function name change matters.

- [ ] **Step 2: `BackendSettingsSection.tsx` — many references**

Bulk rewrite all `wayland-utauri` strings and the `waylandUtauri*` field-group identifiers:

```bash
cd /home/obsy/dev/waypaper/waypaper-engine
sed -i \
  -e 's/"wayland-utauri"/"wal-qt"/g' \
  -e 's/\[\"wayland-utauri\"\] ?? b\.waylandutauri/["wal-qt"]/g' \
  -e 's/\bwaylandUtauriTransitionFields\b/walQtTransitionFields/g' \
  -e 's/\bwaylandUtauriImageFields\b/walQtImageFields/g' \
  -e 's/\bwaylandUtauriParallaxFields\b/walQtParallaxFields/g' \
  -e 's/\bwaylandUtauriVideoFields\b/walQtVideoFields/g' \
  -e 's/\bwaylandUtauriAdvancedFields\b/walQtAdvancedFields/g' \
  src/components/settings/sections/BackendSettingsSection.tsx
```

Now sweep the remaining inline doc strings — every `wayland-utauri` (in user-visible copy and comments inside this file) becomes `wal-qt`. The historical references to `wal-utauri` / `waypaper-tauri` in the same descriptions should be removed where they read as "matches old name X" — they no longer add value. Apply two edits manually with the Edit tool:

1. In the field with description starting with `"Syncs parallax to wayland-utauri ..."` and `... wal-utauri elastic-wraps past ±0.5.` — rewrite to:

   > "Syncs parallax to wal-qt (POST /wallpaper/parallax: zoom, step, animation, easing, reset). The compositor driver sends one parallax-move per workspace change; offsets accumulate and wal-qt elastic-wraps past ±0.5."

2. In the field with description containing `"Transition style used by wayland-utauri (matches waypaper-tauri TransitionMode)"` — rewrite to:

   > "Transition style used by wal-qt."

Run a final wide sweep to catch the rest:

```bash
cd /home/obsy/dev/waypaper/waypaper-engine
sed -i 's/wayland-utauri/wal-qt/g; s/wal-utauri/wal-qt/g' src/components/settings/sections/BackendSettingsSection.tsx
```

Verify:

```bash
grep -n "wayland-utauri\|waylandutauri\|wal-utauri\|waypaper-tauri" src/components/settings/sections/BackendSettingsSection.tsx || echo OK
```

Expected: `OK`. If `waypaper-tauri` still appears, manually edit those sentences to drop the parenthetical.

- [ ] **Step 3: `settingsSearchIndex.ts` — three description strings**

```bash
cd /home/obsy/dev/waypaper/waypaper-engine
sed -i 's/wayland-utauri transition length in seconds/wal-qt transition length in seconds/; s|Transition preset for wayland-utauri / waypaper-tauri|Transition preset for wal-qt|; s/reset_ms to wayland-utauri/reset_ms to wal-qt/' src/utils/settingsSearchIndex.ts
```

Verify:

```bash
grep -n "wayland-utauri\|waypaper-tauri\|wal-utauri" /home/obsy/dev/waypaper/waypaper-engine/src/utils/settingsSearchIndex.ts || echo OK
```

Expected: `OK`.

- [ ] **Step 4: Typecheck**

```bash
cd /home/obsy/dev/waypaper/waypaper-engine && pnpm exec tsc -p tsconfig.json --noEmit
```

Expected: pass.

- [ ] **Step 5: Commit**

```bash
cd /home/obsy/dev/waypaper/waypaper-engine
git add src/components/ImageDetailSidebar.tsx src/components/settings/sections/BackendSettingsSection.tsx src/utils/settingsSearchIndex.ts
git commit -m "ui: rename wayland-utauri references to wal-qt in settings/sidebar"
```

### Task 14: Remove the legacy monitor-name normalizer (CLAUDE.md no-shims policy)

This deletes `normalizeLegacyWaylandUtauriMonitorName` because CLAUDE.md says no compatibility shims. Users with persisted stable_ids from very-old builds may lose monitor-image associations and have to re-bind. That is the explicit project policy; raise it with the maintainer **before** running this task only if you (the executor) believe a single user note in the changelog isn't enough — otherwise proceed.

**Files:**
- Modify: `src/utils/monitorNames.ts`
- Modify: `src/utils/__tests__/monitorNames.test.ts`
- Modify: `src/utils/resolveWallpaperImageId.ts`
- Modify: `src/utils/__tests__/resolveWallpaperImageId.test.ts`
- Modify: `src/utils/__tests__/settingsNavStorage.test.ts`
- Modify: `src/stores/__tests__/monitors.test.ts`
- Modify: `src/stores/__tests__/settingsStore.test.ts`

- [ ] **Step 1: Read `monitorNames.ts` to understand exactly what to remove**

```bash
cat /home/obsy/dev/waypaper/waypaper-engine/src/utils/monitorNames.ts
```

- [ ] **Step 2: Delete the legacy normalizer**

Open `src/utils/monitorNames.ts`. Remove:
- The header comment that mentions "older wayland-utauri builds".
- The exported function `normalizeLegacyWaylandUtauriMonitorName`.
- Any internal helper (e.g. the loop using `norm`) that exists only to serve the legacy function.

Anything in this file that does NOT depend on the legacy normalizer stays.

- [ ] **Step 3: Update `resolveWallpaperImageId.ts`**

Remove the import of `normalizeLegacyWaylandUtauriMonitorName` and rewrite the comparison to match `s.monitor_name === monitorName` directly. The function now reads:

```ts
import { ... } from "./monitorNames"; // drop the legacy import entirely if it leaves the import empty

// inside the body:
return states.find((s) => s.monitor_name === monitorName);
```

(Preserve any other logic that does not depend on the normalizer.)

- [ ] **Step 4: Delete every test asserting legacy-name behaviour**

```bash
cd /home/obsy/dev/waypaper/waypaper-engine && grep -ln "normalizeLegacyWaylandUtauriMonitorName\|wayland-utauri" src/utils/__tests__ src/stores/__tests__
```

For each hit, open the file and either:
- Delete the test cases that specifically exercise the legacy normalization.
- Or update non-legacy cases to use plain monitor names (no `wayland-utauri` mentions).

After editing, no test in `src/` should reference `wayland-utauri` or the deleted function.

- [ ] **Step 5: Run all renderer unit tests**

```bash
cd /home/obsy/dev/waypaper/waypaper-engine && pnpm test
```

Expected: pass. Fix any compilation failures by removing remaining import references.

- [ ] **Step 6: Verify**

```bash
cd /home/obsy/dev/waypaper/waypaper-engine && grep -rn "normalizeLegacyWaylandUtauriMonitorName\|wayland-utauri\|waylandutauri\|WaylandUtauri" src/ electron/ || echo OK
```

Expected: `OK`.

- [ ] **Step 7: Commit**

```bash
cd /home/obsy/dev/waypaper/waypaper-engine
git add -A src/ electron/
git commit -m "remove: legacy wayland-utauri monitor-name normalizer (no compat shims)"
```

---

## Phase D — Scripts, ancillary tooling, and docs

### Task 15: Update the parallax helper script

**Files:**
- Modify: `waypaper-engine/tools/parallax_set_offset_monitor.sh`

- [ ] **Step 1: Rewrite three string occurrences**

```bash
cd /home/obsy/dev/waypaper/waypaper-engine
sed -i 's|wayland-utauri\.sock|wal-qt.sock|g; s|http://wayland-utauri\.local|http://wal-qt.local|g; s/wayland-utauri/wal-qt/g' tools/parallax_set_offset_monitor.sh
```

- [ ] **Step 2: Verify**

```bash
grep -n "wayland-utauri\|waylandutauri" /home/obsy/dev/waypaper/waypaper-engine/tools/parallax_set_offset_monitor.sh || echo OK
```

Expected: `OK`.

- [ ] **Step 3: Commit**

```bash
cd /home/obsy/dev/waypaper/waypaper-engine
git add tools/parallax_set_offset_monitor.sh
git commit -m "tools: parallax helper points at wal-qt socket"
```

### Task 16: Update daemon docs (`API_CONTRACT.md`, `daemon/docs/ARCHITECTURE.md`)

**Files:**
- Modify: `waypaper-engine/daemon/API_CONTRACT.md`
- Modify: `waypaper-engine/daemon/docs/ARCHITECTURE.md`

- [ ] **Step 1: Bulk rewrite identifiers**

```bash
cd /home/obsy/dev/waypaper/waypaper-engine
sed -i 's/wayland-utauri/wal-qt/g; s/waylandutauri/walqt/g' daemon/API_CONTRACT.md daemon/docs/ARCHITECTURE.md
```

- [ ] **Step 2: Manually scan the modified docs to catch parenthetical "(wal-utauri)" wording**

```bash
grep -n "wal-utauri\|waypaper-tauri" /home/obsy/dev/waypaper/waypaper-engine/daemon/API_CONTRACT.md /home/obsy/dev/waypaper/waypaper-engine/daemon/docs/ARCHITECTURE.md
```

Rewrite any sentence so it reads naturally (e.g. delete the parenthetical historical name). Use the Edit tool for each occurrence.

- [ ] **Step 3: Commit**

```bash
cd /home/obsy/dev/waypaper/waypaper-engine
git add daemon/API_CONTRACT.md daemon/docs/ARCHITECTURE.md
git commit -m "docs(daemon): API contract and architecture use wal-qt"
```

### Task 17: Update user-facing docs site

**Files:**
- Modify: `docs/index.md`
- Modify: `docs/guide/{introduction,first-run,backends,glossary,app,packaging,faq,config}.md`
- Modify: `docs/api/{overview,sse}.md`
- Modify: `docs/dev/development.md`

- [ ] **Step 1: Bulk replace**

```bash
cd /home/obsy/dev/waypaper/waypaper-engine
grep -rl "wayland-utauri\|waylandutauri" docs/ | xargs sed -i 's/wayland-utauri/wal-qt/g; s/waylandutauri/walqt/g'
```

- [ ] **Step 2: Pass a human eye over the changed files**

```bash
cd /home/obsy/dev/waypaper/waypaper-engine
grep -rln "wal-utauri\|waypaper-tauri" docs/ || echo OK
```

For any hits, open the file and rewrite the surrounding sentence so it does not reference the historical predecessor (a single short note in `docs/guide/glossary.md` may be retained intentionally — at your discretion, keep one historical mention there with a clear `Historical:` prefix; remove everywhere else).

- [ ] **Step 3: Commit**

```bash
cd /home/obsy/dev/waypaper/waypaper-engine
git add docs/
git commit -m "docs(site): rename wayland-utauri to wal-qt across user docs"
```

### Task 18: Update `packaging/README.md`

**Files:**
- Modify: `waypaper-engine/packaging/README.md`

- [ ] **Step 1: Bulk rewrite identifiers and AUR row**

```bash
cd /home/obsy/dev/waypaper/waypaper-engine
sed -i 's/wayland-utauri/wal-qt/g' packaging/README.md
```

Then open the file and verify the AUR row reads sensibly (the AUR name itself is in `waypaper_packages_aur/` and is not in this rename's scope, but the dependency hint should now mention `wal-qt`).

- [ ] **Step 2: Commit**

```bash
cd /home/obsy/dev/waypaper/waypaper-engine
git add packaging/README.md
git commit -m "docs(packaging): list wal-qt as runtime dep"
```

### Task 19: Update root `CLAUDE.md`

**Files:**
- Modify: `/home/obsy/dev/waypaper/CLAUDE.md`

- [ ] **Step 1: Rewrite the daemon-row sentence about the `wayland-utauri` backend id and socket**

The current row reads:

> The daemon still uses the `wayland-utauri` backend id and `$XDG_RUNTIME_DIR/wayland-utauri.sock` HTTP contract when talking to `wal-qt` (drop-in binary name `wayland-utauri` on `PATH`; see `wal-qt/README.md`). Unix-socket HTTP + SSE between daemon and UI.

Rewrite to:

> The daemon talks to `wal-qt` via Unix-socket HTTP at `$XDG_RUNTIME_DIR/wal-qt.sock` (backend id `wal-qt`, binary `wal-qt` on `PATH`; see `wal-qt/README.md`). SSE between daemon and UI.

- [ ] **Step 2: Drop the **`wayland-utauri`** HTTP contract** mention from the "Quirks" section's HTML-wallpapers bullet — replace "wal-qt / daemon wayland-utauri backend" with "wal-qt backend".

- [ ] **Step 3: Verify nothing remains**

```bash
grep -n "wayland-utauri\|waylandutauri\|WaylandUtauri" /home/obsy/dev/waypaper/CLAUDE.md || echo OK
```

Expected: `OK`.

- [ ] **Step 4: Commit (in waypaper-engine if CLAUDE.md is tracked there; otherwise treat as workspace file and skip the commit)**

```bash
cd /home/obsy/dev/waypaper
git -C waypaper-engine status -s ../CLAUDE.md 2>/dev/null || true
# If CLAUDE.md is not tracked by any of the three repos, leave it; the user manages it.
```

---

## Phase E — Full verification

### Task 20: Whole-repo greps

- [ ] **Step 1: waypaper-engine — every flavour of the old name**

```bash
cd /home/obsy/dev/waypaper/waypaper-engine && grep -rin "wayland-utauri\|waylandutauri\|WaylandUtauri" --exclude-dir=node_modules --exclude-dir=dist --exclude-dir=dist-electron --exclude-dir=.worktrees --exclude-dir=release --exclude-dir=.git . || echo OK
```

Expected: `OK`. If the historical plan `docs/superpowers/plans/2026-04-30-daemon-architecture.md` lights up, leave it (historical artifact) — but document the skip by adding a one-line note at the top of that file:

```
> Historical: predates the wal-qt rename (2026-05). Identifiers below are obsolete.
```

If anything else matches, fix it before proceeding.

- [ ] **Step 2: wal-qt — same sweep**

```bash
cd /home/obsy/dev/waypaper/wal-qt && grep -rin "wayland-utauri\|waylandutauri\|WaylandUtauri" --exclude-dir=build --exclude-dir=build-release --exclude-dir=node_modules --exclude-dir=.git --exclude-dir=.cache . || echo OK
```

Expected: `OK`. Historical plan files in `docs/superpowers/plans/` may retain the old name with a `> Historical:` note (use the same approach as above).

### Task 21: Full CI gates

- [ ] **Step 1: waypaper-engine — formatting, lint, gofmt, type, daemon, tests**

```bash
cd /home/obsy/dev/waypaper/waypaper-engine && pnpm run ci:check
```

Expected: pass. If the script ordering differs from the gates we want, also run individually:

```bash
cd /home/obsy/dev/waypaper/waypaper-engine && pnpm run format:check && pnpm run lint:check && pnpm run gofmt:check && pnpm run test:daemon && pnpm test
```

Expected: all pass.

- [ ] **Step 2: wal-qt — build + tests + renderer**

```bash
cd /home/obsy/dev/waypaper/wal-qt && make build && make test && (cd renderer && npm run check:all:strict)
```

Expected: all green.

### Task 22: Integration smoke test

- [ ] **Step 1: Install the wal-qt binary onto PATH**

```bash
cd /home/obsy/dev/waypaper/wal-qt && ./scripts/install-wal-qt.sh
which wal-qt
```

Expected: prints `~/.local/bin/wal-qt` (or the override directory).

- [ ] **Step 2: Clean any stale runtime state from the old name**

```bash
rm -f "$XDG_RUNTIME_DIR/wayland-utauri.sock" "$XDG_RUNTIME_DIR/wayland-utauri.lock" "$XDG_RUNTIME_DIR/wal-qt.sock" "$XDG_RUNTIME_DIR/wal-qt.lock"
```

- [ ] **Step 3: Start waypaper-engine dev**

```bash
cd /home/obsy/dev/waypaper/waypaper-engine && pnpm run dev
```

In the UI: open Settings → Backend, confirm the backend list shows **wal-qt** (not wayland-utauri) and selecting it spawns the `wal-qt` process, binds `$XDG_RUNTIME_DIR/wal-qt.sock`, and serves `GET /health` with `"service":"wal-qt"`. Smoke-test setting a wallpaper end-to-end. Note any UI strings still referring to the old name and fix them.

- [ ] **Step 4: Run the verify script against the live socket**

```bash
cd /home/obsy/dev/waypaper/wal-qt && WAYPAPER_ENGINE_BIN="$(which wal-qt)" ./scripts/verify-waypaper-engine-api.sh
```

Expected: clean exit.

### Task 23: Final commits and changelog note

- [ ] **Step 1: Add a top-of-README "Breaking change" note in `waypaper-engine/README.md` and `wal-qt/README.md`**

Each note should read something like:

```
> Breaking change (2026-05): the Wayland WebEngine backend is now named `wal-qt` end-to-end.
> Existing configs using `type = "wayland-utauri"` or `[backend.wayland-utauri]` must be renamed
> to `wal-qt` and `[backend.wal-qt]`. Stale `$XDG_RUNTIME_DIR/wayland-utauri.{sock,lock}` files
> are unused and can be deleted.
```

- [ ] **Step 2: Commit each repo separately**

```bash
cd /home/obsy/dev/waypaper/waypaper-engine
git add README.md
git commit -m "docs(readme): announce wayland-utauri -> wal-qt breaking rename"

cd /home/obsy/dev/waypaper/wal-qt
git add README.md
git commit -m "docs(readme): announce wayland-utauri -> wal-qt breaking rename"
```

- [ ] **Step 3: Push (do NOT push without user confirmation — stop and confirm)**

This step requires the user to authorize a push to each repo's remote. Stop and ask before pushing.

---

## Self-review

- Spec coverage: each surface called out by the user (binary, references, docs, types, socket, layer-shell scope, health field) has a dedicated task. The historical "wal-utauri / waypaper-tauri" mentions are addressed inside individual tasks (13, 16, 17) and an explicit grep gate (Task 20).
- No placeholders. Each shell command is concrete and executable from the absolute working directory.
- Identifier consistency: backend id is `wal-qt`, package `walqt`, Go type `WalQt`, Go constant `WalQtBackendName`, TS interface `WalQtConfig`, field-prefix `walqt.`, viper key `backend.wal-qt`, socket `wal-qt.sock`, lock `wal-qt.lock`, health service `wal-qt`, HTTP host `wal-qt.local`, LayerShell scope `wal-qt-monitor-N`, binary on PATH `wal-qt` — these match across every task that references them.
- The legacy-normalizer deletion (Task 14) is the most disputable choice; the task body flags it for confirmation, consistent with the user's "delete all references" instruction and CLAUDE.md's "no compatibility shims" rule.
