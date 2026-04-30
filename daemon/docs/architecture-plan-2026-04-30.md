# Architecture execution plan — 2026-04-30

Five phases from the grilling session. Execute sequentially — each phase lists exact files, todos, and a verification step. Run `npm run ci:check` (from `waypaper-engine/`) and `npm run test:daemon` after every phase before moving on.

---

## Phase 1 — Playlist SSE fix (one-liner, zero risk)

**Problem:** `playlist/manager.go` holds the event bus on its struct but never passes it to `wallpaper.Apply`. `wallpaper_changed` is never emitted for playlist-driven transitions — scripting consumers (wal/matugen color ricing) and Electron's history refresh are blind to the most common wallpaper change source.

**Files:**
- `internal/playlist/manager.go`

**Todos:**
- [ ] Open `manager.go`, find `doApply` (around line 782).
- [ ] In the `wallpaper.Apply(ctx, wallpaper.ApplyOpts{...})` call (around line 789), add `Bus: m.bus` to the struct literal.
- [ ] Confirm `m.bus` is type `events.Bus` (it is — declared at line 40, received at line 58).
- [ ] No other `wallpaper.Apply` calls exist in this file — confirmed by grep.

**Verification:**
```bash
grep -n "Bus" daemon/internal/playlist/manager.go
# Must show Bus: m.bus in the ApplyOpts literal
npm run test:daemon
```

---

## Phase 2 — Backend policy deepening (independent of handler split)

Two sub-tasks. Can be done in either order within the phase.

### 2a — Extend `PickBackend` with capability filter

**Problem:** `WallpaperHandler.ensureBackendForMedia` in `internal/handler/wallpaper.go` selects a fallback backend when the active one doesn't support the requested media type. `backend/select.go:PickBackend` already owns priority-based selection. Two callers independently implement media-type routing logic; adding a new capability rule requires edits in multiple places.

**Files:**
- `internal/backend/select.go` — extend `PickBackend`
- `internal/handler/wallpaper.go` — replace `ensureBackendForMedia` with a `PickBackend` call

**Todos:**
- [ ] Read `internal/backend/select.go` in full.
- [ ] Read `internal/handler/wallpaper.go`, focusing on `ensureBackendForMedia` and its callers within the file.
- [ ] Add an optional `RequiredCapability` field to the options struct passed to `PickBackend` (or add a new parameter — follow the existing function signature style). The field should be a `backend.Capabilities` bitmask or a predicate `func(backend.Capabilities) bool`.
- [ ] Update `PickBackend` to skip backends whose `Capabilities()` don't satisfy the requirement when the field is set.
- [ ] Replace `ensureBackendForMedia` in `wallpaper.go` with a call to `PickBackend` passing the media-type-derived capability requirement. Delete `ensureBackendForMedia`.
- [ ] Update any existing tests in `internal/backend/` for `PickBackend` to cover the new capability filter path.

**Verification:**
```bash
grep -rn "ensureBackendForMedia" daemon/
# Must return zero results
npm run test:daemon
```

### 2b — `BatchRestorer` optional interface for wayland-utauri

**Problem:** `internal/wallpaper/restore.go` contains `tryWaylandUtauriIndividualRestoreBatch` — backend-specific batching logic named after a concrete backend. The generic restore path branches on `activeBackend.Name() == backend.WaylandUtauriBackendName`. Adding any new batch-capable backend requires editing `restore.go`.

**Files:**
- `internal/backend/backend.go` — add `BatchRestorer` optional interface
- `internal/backend/waylandutauri/` (or wherever the wayland-utauri backend lives) — implement `BatchRestorer`
- `internal/wallpaper/restore.go` — replace the named-check with an interface assertion; delete `tryWaylandUtauriIndividualRestoreBatch`

**Todos:**
- [ ] Read `internal/backend/backend.go` — note the pattern for `RuntimeConfigSync` and `ExtendParallaxGroupNotifier` optional interfaces.
- [ ] Read `internal/wallpaper/restore.go` — find `tryWaylandUtauriIndividualRestoreBatch` and all call sites.
- [ ] Find where the wayland-utauri backend is implemented (search for `WaylandUtauriBackendName`).
- [ ] Define in `backend.go`:
  ```go
  // BatchRestorer is optional. Backends that can apply wallpapers to multiple
  // monitors in a single request implement this interface.
  // restore.go calls TryBatchRestore; if it returns false the caller falls back
  // to per-monitor Apply calls.
  type BatchRestorer interface {
      TryBatchRestore(ctx context.Context, states []store.MonitorState, connected map[string]monitor.Monitor, images store.ImageStore) (*WallpaperRequest, []store.MonitorState, []media.MediaType, bool)
  }
  ```
  (Adjust signature to match what `tryWaylandUtauriIndividualRestoreBatch` currently returns — read the function first.)
- [ ] Move the body of `tryWaylandUtauriIndividualRestoreBatch` (minus the `activeBackend.Name()` guard) into the wayland-utauri backend as `TryBatchRestore`.
- [ ] In `restore.go`, replace the call to `tryWaylandUtauriIndividualRestoreBatch` with:
  ```go
  if br, ok := activeBackend.(backend.BatchRestorer); ok {
      // call br.TryBatchRestore(...)
  }
  ```
- [ ] Delete `tryWaylandUtauriIndividualRestoreBatch` from `restore.go`.
- [ ] Run `go build ./cmd/daemon` to catch any type mismatches before running tests.

**Verification:**
```bash
grep -rn "WaylandUtauriBackendName\|tryWaylandUtauri" daemon/internal/wallpaper/
# Must return zero results (the restore.go references are gone)
npm run test:daemon
```

---

## Phase 3 — Handler package split (mechanical rename)

**Problem:** `confighandler` and `backendshandler` are already isolated sub-packages with their own tests. The remaining five handlers (`images`, `wallpaper`, `playlists`, `folders`, `monitors`, `health`) are flat files in `internal/handler`. Every test can see every handler's internals; `main.go` wires a flat list of constructors with no grouping. Handler seams are invisible.

**Files:**
- `internal/handler/images.go` + `images_test.go` + `images_colors_near_test.go` → `internal/handler/imageshandler/`
- `internal/handler/wallpaper.go` + `wallpaper_current_response.go` + `wallpaper_current_response_test.go` → `internal/handler/wallpaperhandler/`
- `internal/handler/playlists.go` + `playlists_test.go` → `internal/handler/playlistshandler/`
- `internal/handler/folders.go` + `folders_test.go` → `internal/handler/foldershandler/`
- `internal/handler/monitors.go` + `monitors_test.go` → `internal/handler/monitorshandler/`
- `internal/handler/health.go` + `health_test.go` → `internal/handler/healthhandler/`
- `internal/handler/httpjson/` — leave in place, shared utility
- `cmd/daemon/main.go` — update import paths

**Todos:**
- [ ] For each handler group, create the sub-directory and move files into it.
- [ ] Update the `package` declaration at the top of each moved file to the new sub-package name (e.g. `package imageshandler`).
- [ ] Update `cmd/daemon/main.go` imports from `internal/handler` to each new sub-package path. The constructor calls (`handler.NewImageHandler(...)`) become `imageshandler.NewImageHandler(...)` etc.
- [ ] Check if any handler file imports another handler's types — resolve with a shared types file in `internal/handler/` if needed, or inline the type.
- [ ] Delete the now-empty `internal/handler/` directory contents (leave `httpjson/`, `confighandler/`, `backendshandler/`).
- [ ] Run `go build ./cmd/daemon` after each sub-package move, not just at the end — catch import cycles early.

**Verification:**
```bash
go build ./daemon/cmd/daemon
ls daemon/internal/handler/
# Should show only: backendshandler/ confighandler/ httpjson/
npm run test:daemon
```

---

## Phase 4 — Extract `SyncWebImageToRenderer` into `internal/wallpaper`

**Problem:** `ImageHandler.Update` contains ~80 lines of inline web sync logic: merge capabilities JSON → write caps to manifest → push caps to renderer → write config overrides to manifest → push config to renderer. This path has no seam; any future caller needing the same sync (e.g. post-import) must duplicate the handler code. The underlying functions (`WriteWebCapabilitiesToManifest`, `PushWebCapabilitiesToRenderer`, `MergeWebCapabilitiesJSON`, `WriteWallpaperConfigOverridesToManifest`, `PushWallpaperConfigToRenderer`) already live in `internal/wallpaper`.

**Note:** Phase 4 runs after Phase 3, so the handler file is at `internal/handler/imageshandler/images.go`.

**Files:**
- `internal/wallpaper/` — new file `web_sync.go` (or add to an existing file if small)
- `internal/handler/imageshandler/images.go` — replace inline block with one function call

**Todos:**
- [ ] Read `internal/handler/imageshandler/images.go` (post-Phase-3 path), focusing on the `Update` method — find both the `web_capabilities` merge block and the `wallpaper_config_overrides` sync block.
- [ ] Read the existing `internal/wallpaper/` files to find where `WriteWebCapabilitiesToManifest`, `PushWebCapabilitiesToRenderer`, `MergeWebCapabilitiesJSON`, `WriteWallpaperConfigOverridesToManifest`, and `PushWallpaperConfigToRenderer` live.
- [ ] Create `internal/wallpaper/web_sync.go` with:
  ```go
  // SyncWebImageToRenderer writes the image's current web_meta capabilities and
  // wallpaper_config_overrides to its manifest file and pushes both to the live
  // renderer if one is registered. img must be a web-type image with non-nil WebMeta.
  // Both sync paths run; individual failures are logged as warnings, not returned.
  func SyncWebImageToRenderer(ctx context.Context, registry backend.Registry, img *store.Image) error
  ```
  The body is the two inline blocks lifted verbatim from `Update`, with `slog.Warn` calls kept where they are (non-fatal sync failures should stay as warnings).
- [ ] In `imageshandler/images.go`, delete the two inline sync blocks from `Update` and replace with:
  ```go
  if err := wallpaper.SyncWebImageToRenderer(r.Context(), h.registry, image); err != nil {
      slog.Warn("web sync after update failed", "image_id", id, "error", err)
  }
  ```
  Call it unconditionally after `store.Update` when `image.MediaType == "web"` — the function guards internally.
- [ ] Remove the `syncCapsToManifest` bool and its associated flag-setting code from `Update` (it becomes implicit in `SyncWebImageToRenderer`'s internal logic).
- [ ] Add a test for `SyncWebImageToRenderer` in `internal/wallpaper/` (table-driven: caps patch only, config overrides only, both, non-web image is a no-op).

**Verification:**
```bash
grep -n "syncCapsToManifest\|WriteWebCapabilities\|PushWebCapabilities\|WriteWallpaperConfigOverrides\|PushWallpaperConfigToRenderer" daemon/internal/handler/imageshandler/images.go
# Must return zero results — all calls moved to internal/wallpaper/web_sync.go
npm run test:daemon
```

---

## Phase 5 — `swag` annotations + OpenAPI generation (zero-drift)

**Problem:** `openapi.yaml` uses `GenericJSON` placeholders and is maintained by hand. Types in `daemon-go-types.ts` can silently drift from Go structs. The goal is code-first, zero-drift: Go structs are the authority, OpenAPI is generated, TS types are aligned against the generated spec.

**Note:** Run after Phase 3 (handlers in final sub-package locations) and Phase 4 (handler code is clean).

**Files:**
- All handler files in `internal/handler/imageshandler/`, `wallpaperhandler/`, `playlistshandler/`, `foldershandler/`, `monitorshandler/`, `healthhandler/`, `confighandler/`, `backendshandler/`
- `cmd/daemon/main.go` — add `swag` init comment
- `daemon/docs/openapi.yaml` — replace with `swag`-generated output
- `electron/daemon-go-types.ts` — align against generated spec
- `waypaper-engine/package.json` — add `generate:openapi` script
- CI check script — add `swag` validation step

**Todos:**
- [ ] Add `swag` as a Go tool dependency: `go get github.com/swaggo/swag/cmd/swag@latest` in `daemon/`.
- [ ] Add `//go:generate swag init -g cmd/daemon/main.go -o docs --outputTypes yaml` to `cmd/daemon/main.go`.
- [ ] Add `@title`, `@version`, `@BasePath` swag annotations to `main.go`.
- [ ] For each handler method, add `swag` annotations (`@Summary`, `@Tags`, `@Param`, `@Success`, `@Failure`, `@Router`). Start with images routes, then wallpaper, then playlists, then the rest.
- [ ] For each request/response struct used in annotations, add `swag` struct tags or ensure field names and json tags are present.
- [ ] Run `go generate ./cmd/daemon/` to produce `docs/openapi.yaml`. Commit the generated file.
- [ ] Add to `package.json`:
  ```json
  "generate:openapi": "cd daemon && go generate ./cmd/daemon/"
  ```
- [ ] Add to `ci:check` (or a separate `ci:openapi` step):
  ```bash
  cd daemon && go generate ./cmd/daemon/ && git diff --exit-code docs/openapi.yaml
  ```
  This fails CI if the committed spec doesn't match what `swag` would generate from current code.
- [ ] After `openapi.yaml` stabilizes, do a pass over `electron/daemon-go-types.ts` — align each type against the generated schemas. Remove types that no longer match; add missing ones. This is a manual alignment pass, not codegen into TS.
- [ ] Update `daemon/docs/architectural-improvements.md` section 8.4 to mark as complete.

**Verification:**
```bash
cd daemon && go generate ./cmd/daemon/ && git diff --exit-code docs/openapi.yaml
# Exit 0 means spec is in sync with code
npm run ci:check
```

---

## Cross-phase notes

- **Branch:** Do all phases on `refactor/waypaper-engine`.
- **Commit cadence:** One commit per phase. Commit message should reference this plan.
- **Go build check after every file move:** `go build ./daemon/cmd/daemon` — catch import cycles immediately, don't batch.
- **Test gate:** `npm run test:daemon` must be green before starting the next phase.
- **`ci:check` full gate:** Run once after Phase 5 to confirm the whole stack (format, lint, gofmt, TS, tests) is clean.
