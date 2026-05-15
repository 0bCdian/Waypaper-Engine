# Backend Abstraction Refactor — Execution Plan

**Status:** in-flight. Delete this file after Task 16 lands and the working tree is clean.

This is the authoritative spec for refactoring the backend boundary. Every executing subagent reads this file first and follows the task it was assigned. Designs locked in below. **Do not deviate or speculate.**

---

## 1. Locked design (do not re-litigate)

### The model

```
INTENT          monitor_state (per-monitor row) + image_history (per-monitor timeline)
                Source of truth.

ORCHESTRATION   daemon. Reads intent + monitor topology. Resolves images. Splits
                for extend. Builds a flat Snapshot. Validates. Pushes to backend.

BACKEND         pure executor. Receives Snapshot. Reads its own viper config
                section at Apply time. Executes setter-specific commands.
```

### Wire shape (final)

```go
type Snapshot struct {
    Outputs []Output
}

type Output struct {
    Monitor monitor.Monitor
    Content Content
}

type Content interface {
    isContent()
    Path() string
}

// Sealed variants
type StaticImage  struct { Path_ string }                              // ext: jpg, png, etc.
type GIF          struct { Path_ string }
type Video        struct { Path_ string; AudioEnabled bool }
type WebWallpaper struct {
    ManifestPath      string
    PackageRoot       string
    Config            json.RawMessage  // merged manifest defaults ⊕ user overrides
    ParallaxDirection string           // empty = no override
}

type ContentKind string
const (
    KindStaticImage  ContentKind = "static_image"
    KindGIF          ContentKind = "gif"
    KindVideo        ContentKind = "video"
    KindWebWallpaper ContentKind = "web_wallpaper"
)

type Mode string  // STORAGE ONLY — never appears in Snapshot or on the wire
const (
    ModeClone  Mode = "clone"   // same image on N≥1 monitors (N=1 ≡ "single")
    ModeExtend Mode = "extend"  // image split across N≥2 monitors
)
```

### Backend interface (final)

```go
type Backend interface {
    Name() string
    IsAvailable() bool
    Capabilities() Capabilities

    Initialize(ctx context.Context) error
    Shutdown(ctx context.Context) error

    Apply(ctx context.Context, snap Snapshot) error

    RegisterDefaults(v *viper.Viper)
    ValidateConfig(raw json.RawMessage) error
}

type Capabilities struct {
    ContentKinds []ContentKind
    Compositors  []monitor.CompositorType
}
```

### Apply contract

1. If Apply returns nil, every Output is reflected on its monitor. **Never return nil on partial success.**
2. On error, display state is indeterminate (between prior and target). Caller must not assume rollback.
3. Apply MUST be idempotent (same snapshot twice = same result as once).
4. Apply MUST honor ctx cancellation.
5. After Apply returns (success OR failure), the backend MUST be in a state where the next Apply can succeed.

### Orchestration flows

```
APPLY (user/playlist):
  1. validate request (capabilities, image exists, target sensible, mode/kind compatible)
  2. build prospective snapshot (current monitor_state + new row, in memory)
  3. backend.Apply(snapshot)
  4. on nil: persist monitor_state, append image_history, SSE wallpaper_changed
  5. on error: DB unchanged, SSE wallpaper_apply_failed

RESTORE (boot):
  1. build snapshot from monitor_state, filtered by connected monitors
  2. backend.Apply(snapshot)

RECONFIGURE (PATCH config):
  1. ValidateConfig(raw)
  2. viper.Set(...)
  3. build snapshot, backend.Apply(snapshot)
  4. on error: viper change remains (R1 policy); user can PATCH to revert

HOTPLUG:
  1. build snapshot, filtered by new topology
  2. backend.Apply(snapshot)
```

### Per-backend capabilities (locked)

| Backend | ContentKinds | Compositors |
|---|---|---|
| feh | [StaticImage] | X11 |
| swaybg | [StaticImage] | Wayland |
| hyprpaper | [StaticImage, GIF] | Wayland |
| mpvpaper | [Video] | Wayland |
| awww | [StaticImage, GIF] *(verify against existing capabilities)* | Wayland |
| wal-qt | [StaticImage, GIF, Video, WebWallpaper] | Wayland |

### What is explicitly NOT in this design

- ❌ `TryBatchRestore` / `batchRestorer` interface — deleted entirely.
- ❌ `SetWallpaper(WallpaperRequest)` — replaced by `Apply(Snapshot)`.
- ❌ `OnConfigChanged` — daemon does viper.Set + Apply; no backend notification method.
- ❌ `ParseConfig` (public) — backends parse viper internally if needed.
- ❌ `WallpaperRequest`, `IndividualLoadTarget`, `IndividualTargets`, `ExtendGroup`, `WaitForCompletion`, `Monitors`, `Mode`, `WallpaperConfigValues`, `ParallaxDirection`, `Config any` — all deleted.
- ❌ `Capabilities.MediaTypes`, `Capabilities.Transitions`, `Capabilities.PerMonitor`, `Capabilities.DaemonProcess` — deleted (descriptive but unused).
- ❌ "NativeExtend" / "PreSplitExtend" capability split — no backend natively extends; daemon always pre-splits.
- ❌ `Snapshot.Reason`, `Snapshot.Transition`, `TransitionHint` — speculative, no consumer. Transitions are viper config consumed by the backend at Apply time.
- ❌ Backend-name special-case branches (`if Backend.Name() == "hyprpaper"`) — replaced by capability + variant dispatch.
- ❌ Per-monitor backend conditional branches — gone.

---

## 2. Anti-patterns sonnet must NOT introduce

Read these before every task. These are real failure modes observed in this codebase.

1. **Speculative capabilities.** Do not add fields to `Capabilities` "for future use." If no current backend populates a field non-trivially, the field does not exist.
2. **Copying patterns wholesale.** If a backend has logic that looks similar to another's, do not copy it without verifying the underlying setter behaves the same way. The hyprpaper `TryBatchRestore` bug was an LLM copying wal-qt's `parallax_direction` and `wallpaper_config` equality checks — features hyprpaper does not have.
3. **Inventing methods for "consistency."** Backends differ. Do not add empty `OnConfigChanged` or no-op `Configure` methods to "match" other backends.
4. **Comments that describe aspirational behavior.** Comments describe what the code does, period. Do not write "in the future this could…" or "this would support X if Y."
5. **Backwards-compatibility shims.** This is pre-release. Delete old code aggressively. Do not add deprecation paths or coexistence layers.
6. **Over-engineering.** Three similar lines beats a premature abstraction. Do not create helper functions that would be used once.
7. **Adding fields to Content variants beyond what's locked.** The variant types are fixed. If a backend needs more info, it reads viper.
8. **Hallucinated APIs.** Before writing a call to an external library/setter, verify the call exists. Check the setter binary's `--help`, the openapi schema, the existing test fixtures.

---

## 3. Verification protocol (between tasks)

After each task, the orchestrator (Opus, not sonnet) checks:

- [ ] Code compiles: `cd daemon && go build ./...`
- [ ] Tests pass for the touched package: `cd daemon && go test ./internal/<pkg>/...`
- [ ] Linter clean: `pnpm run gofmt:check` for the touched files
- [ ] Git diff has no unintended changes (no formatting churn, no unrelated edits)
- [ ] No new file outside the task's declared paths
- [ ] No anti-pattern violations from §2
- [ ] Task-specific AC items all met

If verification fails, the task is restarted (or fixed inline) before moving on.

---

## 4. Tasks

### T1 — Foundation types

**Goal:** Introduce the new vocabulary in the `backend` package. No callers yet.

**Files:**
- `daemon/internal/backend/content.go` *(new)* — Content sealed interface + four variants. Each variant implements `isContent()` and `Path()`. No other methods.
- `daemon/internal/backend/snapshot.go` *(new)* — `Snapshot`, `Output`, `ContentKind` enum.
- `daemon/internal/backend/backend.go` *(modified)* — replace `MediaTypes []media.MediaType` in `Capabilities` with `ContentKinds []ContentKind`. Remove `Transitions`, `PerMonitor`, `DaemonProcess` fields. Update all backends' `Capabilities()` methods to use the new field. Do **not** add `Apply` to the interface yet.

**Acceptance criteria:**
- [ ] `go build ./...` clean.
- [ ] All existing tests still pass.
- [ ] Compile check: `_ = backend.Content(backend.StaticImage{})` valid; sealed interface enforced.
- [ ] No `MediaTypes` references remain in `internal/`.
- [ ] No `Transitions` / `PerMonitor` / `DaemonProcess` references in `Capabilities`.

**Watch for:**
- Sonnet may try to add an `Apply` method here. **It must not.** That's T5.
- Sonnet may try to add helper functions like `NewStaticImage(path string)`. Variants are plain structs; no constructors.
- The `media.MediaType` type may still be used elsewhere (in `store.Image.MediaType`). Leave it alone — only the `Capabilities` field changes name and type.

---

### T2 — Image reference cascade

**Goal:** A reusable operation that removes all DB references to an image_id. Called from both DELETE and orphan detection.

**Files:**
- `daemon/internal/store/cascade.go` *(new)* — `PurgeImageReferences(ctx, imageID int) (PurgeResult, error)`. Removes from `monitor_state`, `image_history`, and `playlists.images[]`. Returns counts in `PurgeResult`. Idempotent.
- `daemon/internal/store/cascade_test.go` *(new)*.
- `daemon/internal/handler/imageshandler/images.go` *(modified)* — `Delete` handler: for each ID, call `PurgeImageReferences` before deleting the image row and files.
- `daemon/internal/handler/wallpaperhandler/wallpaper.go` *(modified)* — **remove** the lazy patch-up in `GetCurrent` (lines around `removing monitor state for deleted image`). The cascade now handles it eagerly.
- `daemon/internal/events/events.go` *(modified)* — add `ImageOrphanPurged` event type.

**PurgeResult shape:**
```go
type PurgeResult struct {
    ImageID              int
    MonitorStatesPurged  []string  // monitor names
    HistoryEntriesPurged int
    PlaylistsAffected    []int     // playlist IDs
}
```

**Acceptance criteria:**
- [ ] `PurgeImageReferences` removes from all three tables in a single call.
- [ ] Idempotent: calling twice with the same ID returns counts of zero on second call.
- [ ] `Delete` handler calls cascade before removing image row.
- [ ] Tests verify each reference table is cleaned.
- [ ] Lazy patch-up code in `GetCurrent` is gone (the cascade-on-delete replaces it).
- [ ] All existing tests pass.

**Watch for:**
- Sonnet may try to add this as a method on `imageStore`. It should be a top-level function in the `store` package (or a method on a higher-level `Store` aggregator if one exists) — it touches multiple collections.
- Playlist cleanup needs scan-and-update on each playlist doc. CloverDB lacks multi-collection transactions; that's fine, idempotency covers it.

---

### T3 — Snapshot builder

**Goal:** One function maps `[]monitor_state` rows → `Snapshot`. Handles extend splitting, web config merging, parallax resolution, capability filtering, orphan detection.

**Files:**
- `daemon/internal/wallpaper/snapshot.go` *(new)* — `BuildSnapshot(ctx, states, connected, images, splitter, backend, store) (Snapshot, []SkipReason, error)`. The `store` parameter is for triggering orphan cascade.
- `daemon/internal/wallpaper/snapshot_test.go` *(new)*.

**SkipReason shape:**
```go
type SkipReason struct {
    MonitorName string
    ImageID     int       // 0 if unknown
    Kind        SkipKind
    Detail      string
}

type SkipKind string
const (
    SkipMonitorDisconnected SkipKind = "monitor_disconnected"
    SkipImageMissing        SkipKind = "image_missing"  // file gone or row gone
    SkipManifestUnreadable  SkipKind = "manifest_unreadable"
    SkipSplitFailed         SkipKind = "split_failed"
    SkipKindUnsupported     SkipKind = "content_kind_unsupported"
)
```

**Builder logic:**
1. Group `monitor_state` rows by `(image_id, mode)`. Each group is an "assignment."
2. For each assignment:
   - Drop monitors not in `connected`.
   - Look up image. If not found → emit `SkipImageMissing`, call `PurgeImageReferences`, emit SSE.
   - Stat image path. If missing → same as above.
   - Check `image.kind ∈ backend.Capabilities().ContentKinds`. If not → emit `SkipKindUnsupported`.
   - For Mode=Extend: call `splitter.Split`. On failure → emit `SkipSplitFailed`.
   - For each remaining monitor, build the resolved `Content`:
     - StaticImage: `Path_ = original or split crop`
     - GIF: `Path_ = original`
     - Video: `Path_ = original, AudioEnabled = image.AudioEnabled && videoAudioDefault`
     - WebWallpaper: `ManifestPath = image.WebMeta.ManifestPath, Config = merged, ParallaxDirection = resolved`
   - Append `Output{Monitor, Content}` to snapshot.
3. Return `(snapshot, skips, nil)` on success. Return `(_, _, err)` only for infrastructure failures (image store unreachable).

**Acceptance criteria:**
- [ ] Tests cover: single image; clone (2 monitors, same image); extend (2 monitors, split paths verified); video; web wallpaper (merged config, parallax); orphan (cascade triggered, skip emitted); disconnected monitor (skipped); incompatible kind for backend (skipped).
- [ ] Web config merging happens here, not in any backend.
- [ ] Splitter is called once per extend assignment.
- [ ] On orphan: cascade is called and event is published; row is dropped from snapshot.

**Watch for:**
- Sonnet may put backend-name conditionals in the builder. **Do not.** Dispatch is purely on `Capabilities.ContentKinds`.
- Sonnet may add a `Reason` field to the returned `Snapshot`. **No.** `Reason` was explicitly dropped.
- Sonnet may try to skip the `images store.ImageStore` parameter and read from a global. Pass it explicitly.

---

### T4 — Request validation

**Goal:** Typed validation for user-Apply requests. Runs before snapshot building. Fails fast with typed errors.

**Files:**
- `daemon/internal/wallpaper/validate.go` *(new)* — `ValidateApplyRequest(ctx, req, backend, images, connected) error`. Sequential checks, returns first failure.
- `daemon/internal/wallpaper/validate_test.go` *(new)*.

**Typed errors:**
```go
var (
    ErrImageNotFound          = errors.New("wallpaper: image not found")
    ErrTargetEmpty            = errors.New("wallpaper: target has no monitors")
    ErrMonitorNotConnected    = errors.New("wallpaper: target monitor not connected")
    ErrContentKindUnsupported = errors.New("wallpaper: backend does not support content kind")
    ErrExtendNotSupported     = errors.New("wallpaper: extend mode requires static image content")
)
```

**Acceptance criteria:**
- [ ] All five errors have unit tests demonstrating they're returned for the matching condition.
- [ ] No backend dependency in validate.go (uses `backend.Backend` interface only via `Capabilities()`).
- [ ] No DB writes. No snapshot built. Pure read-side validation.

**Watch for:**
- Sonnet may stat the image file here. **Do not.** File-existence checks belong in T3 (snapshot builder), as orphan detection.

---

### T5 — Add Apply to Backend interface; shim implementations

**Goal:** Every backend has an `Apply(ctx, Snapshot) error` method. Initial implementations convert Snapshot to the existing internal flow and call legacy `SetWallpaper` plumbing. Old `SetWallpaper`, `OnConfigChanged`, `ParseConfig` remain on the interface for now — Task 14 deletes them.

**Files:**
- `daemon/internal/backend/backend.go` *(modified)* — add `Apply(ctx context.Context, snap Snapshot) error` to the interface.
- One shim file per backend, e.g. `daemon/internal/backend/hyprpaper/apply_shim.go` *(new)*, etc. The shim converts a `Snapshot` to a legacy `WallpaperRequest` and calls the existing internal logic (e.g., `setWallpaperConfig`). The conversion is mechanical — sonnet maps each `Output.Content` variant to the equivalent `WallpaperRequest` fields.
- `daemon/internal/testutil/mocks.go` *(modified)* — `MockBackend.ApplyFn` field added.

**Per-backend shim logic (approximate, sonnet implements faithfully):**
- For all backends: walk `snap.Outputs`, build the equivalent `WallpaperRequest` (with `Monitors`, `IndividualTargets` for hyprpaper/wal-qt, `ImagePath` for clone), call the existing internal setter logic.
- The shim does NOT modify any existing behavior. It just provides a new entry point.

**Acceptance criteria:**
- [ ] Every backend has an `Apply` method that compiles.
- [ ] Existing tests still pass (old path untouched).
- [ ] A new shared test verifies that `Apply(s)` produces the same setter command as `SetWallpaper(toLegacyRequest(s))` for a smoke fixture per backend.

**Watch for:**
- Sonnet may rewrite the internal setter logic instead of just shimming. **It must not.** This is a coexistence step. T7–T12 do the native rewrite.

---

### T6 — Shadow execution harness

**Goal:** A testing helper that, for a given fixture, runs both `SetWallpaper(legacy)` and `Apply(snapshot)` and asserts the setter-side effects are byte-identical. Used in T7–T12 to verify each backend's migration didn't change behavior.

**Files:**
- `daemon/internal/backend/shadowtest/shadowtest.go` *(new)* — `RunBothAndCompare(t *testing.T, b Backend, fixture Fixture)` helper. Captures setter-side output via test-injected hooks (e.g., a fake `writeConfig` for hyprpaper, a recorded `startProcess` for swaybg, an httptest server for wal-qt).
- Test seams added to backends as needed (refactored from existing code, not new abstractions).

**Acceptance criteria:**
- [ ] Shadow harness works for at least one backend (e.g., hyprpaper, where it can capture the rendered conf string).
- [ ] One sample shadow test passes for hyprpaper.

**Watch for:**
- Sonnet may want to refactor backend internals to add test seams. Where the existing code already has a seam (a function pointer, an exported helper), use it. Where it doesn't, prefer the smallest possible change — extracting one function — over a big refactor.

---

### T7 — Migrate swaybg to native Snapshot

**Goal:** `swaybg.Apply` consumes `Snapshot` directly. Builds `-o NAME -i PATH -m MODE` args from Outputs. Kills, restarts. Old shim from T5 deleted.

**Files:**
- `daemon/internal/backend/swaybg/swaybg.go` *(modified)* — rewrite `Apply` to consume Snapshot natively.
- `daemon/internal/backend/swaybg/apply_shim.go` *(deleted)*.
- `daemon/internal/backend/swaybg/swaybg_test.go` *(modified)* — new tests using shadow harness; verify the multi-monitor partial-update bug is gone.

**Acceptance criteria:**
- [ ] Shadow tests pass for: single monitor; two monitors with same image; two monitors with different images.
- [ ] **Regression test:** apply image A to monitor 1, then apply image B to monitor 2, verify final argv contains both `-o 1 -i A` and `-o 2 -i B`. Today this is broken.
- [ ] No `SetWallpaper` calls remain in production code paths within swaybg package.

**Watch for:**
- Sonnet may try to keep swaybg's old `SetWallpaper` method (since T5 only added Apply). For T7 specifically, the method may be kept (deleted in T14) but is no longer the implementation path — `Apply` is now native and `SetWallpaper`, if present, delegates to `Apply` via reverse-shim or is left as a stub.

---

### T8 — Migrate feh to native Snapshot

Same shape as T7. feh handles `[StaticImage]` only. For multi-output: feh on X11 historically sets the root window — `feh --bg-fill PATH` per monitor or via composite. Match existing feh.go behavior.

**Acceptance criteria:**
- [ ] Shadow tests pass.
- [ ] feh.go's Apply method consumes Snapshot directly.

---

### T9 — Migrate mpvpaper to native Snapshot

mpvpaper handles `[Video]` only. Diffs Snapshot against currently-running mpvpaper instances by output name. Kill, start, restart as needed.

**Acceptance criteria:**
- [ ] Shadow tests pass for: start one video; add a second; change one; remove one.
- [ ] Per-output process state correctly reconciled.

---

### T10 — Migrate awww to native Snapshot

awww handles `[StaticImage, GIF]` (verify against current capabilities). Existing transitions config in viper.

**Acceptance criteria:**
- [ ] Shadow tests pass.
- [ ] Transitions still work (viper config consumed by backend at Apply time).

---

### T11 — Migrate hyprpaper to native Snapshot

hyprpaper handles `[StaticImage, GIF]`. **Deletes `try_batch_restore.go` and `try_batch_restore_test.go` entirely.** Apply writes conf, kills, restarts.

**Files:**
- `daemon/internal/backend/hyprpaper/hyprpaper.go` *(modified)*.
- `daemon/internal/backend/hyprpaper/try_batch_restore.go` *(deleted)*.
- `daemon/internal/backend/hyprpaper/try_batch_restore_test.go` *(deleted)*.
- `daemon/internal/backend/hyprpaper/apply_shim.go` *(deleted, if T5 created one here)*.

**Acceptance criteria:**
- [ ] Shadow tests pass.
- [ ] **Regression test:** apply image A to monitor 1, then apply image B to monitor 2, verify final conf has BOTH wallpaper blocks. (The bug we manually fixed earlier in this branch should be protected here.)
- [ ] No `TryBatchRestore` method anywhere in the hyprpaper package.

**Watch for:**
- Sonnet may try to keep `TryBatchRestore` "for safety." Delete it. The Snapshot is always the whole world; there's nothing to batch.

---

### T12 — Migrate wal-qt to native Snapshot

wal-qt handles all four content kinds. Single multi-target POST to wal-qt's `/wallpaper/load` API. Reads transition config from its viper section.

**Files:**
- `daemon/internal/backend/walqt/walqt.go` *(modified)*.
- `daemon/internal/backend/walqt/mapping.go` *(modified)* — `buildIndividualTargetsLoadRequest` collapses; Snapshot already carries per-output structure.
- `daemon/internal/backend/walqt/walqt.go` *(modified)* — delete `TryBatchRestore` method.

**Acceptance criteria:**
- [ ] Shadow tests pass for every content kind, with clone and extend.
- [ ] **The wal-qt `LoadTargetBody` payload is exactly `{name, kind?, target}` per output** — no extra fields. This must match the openapi spec at `wal-qt/renderer/src/generated/control-plane.ts`.
- [ ] All existing wal-qt integration tests pass.

**Watch for:**
- Sonnet may invent fields on wal-qt's load request based on previous (buggy) `TryBatchRestore` code — `parallax_direction` etc. on per-target rows. **Per-target rows have THREE fields.** Other parallax/config goes on the root `LoadBody`, not per-target. Refer to the openapi spec.
- The `parallax_direction` field on `LoadBody` is per-load, not per-target. If a snapshot has multiple Web wallpapers with different `ParallaxDirection` values, wal-qt's API today can't express that — this is a real limitation; document it and pick one (e.g., the first), do not invent API fields.

---

### T13 — Switch orchestration to new flow

**Goal:** `apply.go`, `restore.go`, reconfigure handler, hotplug handler all go through `BuildSnapshot → backend.Apply`. Backend-name special cases deleted.

**Files:**
- `daemon/internal/wallpaper/apply.go` *(rewritten)* — flow is exactly the four steps from §1 ("APPLY"). `applyExtendNonImage`, `applyExtendImage`, `applyDefault` deleted.
- `daemon/internal/wallpaper/restore.go` *(rewritten)* — single function: build snapshot, Apply. Deletes `restoreExtendGroup`, `restoreNonExtendIndividuals`, `restoreIndividual`, `extendGroup` type, `batchRestorer` interface, `restoreFailure` type, `classifyRestoreError`, the deferred-daemon-restore logic kept as a thin wrapper.
- HTTP handler for `PATCH /config/backends/{name}` *(modified)* — flow per §1 ("RECONFIGURE").
- Monitor hotplug handler *(modified)* — flow per §1 ("HOTPLUG").

**Acceptance criteria:**
- [ ] No `if Backend.Name() == "hyprpaper"` (or any other backend name) branches anywhere.
- [ ] No `batchRestorer` interface anywhere.
- [ ] All four flows live as small functions: validate (apply only) → BuildSnapshot → Apply.
- [ ] Reconfigure persists viper before Apply (R1 policy).
- [ ] All existing tests pass; new tests cover the four flows end-to-end with `MockBackend`.

**Watch for:**
- Sonnet may try to keep the special-case branches "in case." Delete them.
- Sonnet may try to add `Snapshot.Reason` to differentiate flows. The flows already differ in which DB writes happen; the snapshot itself is identical in shape.

---

### T14 — Delete the old surface

**Goal:** All legacy types and methods are removed.

**Files:**
- `daemon/internal/backend/backend.go` *(modified)* — remove `SetWallpaper`, `OnConfigChanged`, `ParseConfig` from `Backend` interface. Remove `WallpaperRequest`, `IndividualLoadTarget` types.
- Every backend *(modified)* — remove its `SetWallpaper`, `OnConfigChanged`, `ParseConfig` implementations. Remove any helper methods that were only used by the old path.
- `daemon/internal/testutil/mocks.go` *(modified)* — remove `MockBackend.SetWallpaperFn`, `OnConfigChangedFn`, `ParseConfigFn`, `TryBatchRestoreFn`. Tests using these are migrated to `ApplyFn`.

**Acceptance criteria:**
- [ ] `cd daemon && go build ./...` clean.
- [ ] `cd daemon && go test ./...` clean.
- [ ] `grep -rn 'WallpaperRequest\|SetWallpaper\|TryBatchRestore\|OnConfigChanged\|batchRestorer\|IndividualLoadTarget\|IndividualTargets\|ExtendGroup' daemon/internal/` returns zero hits.

**Watch for:**
- Sonnet may leave `OnConfigChanged` as an empty stub. **Delete the method entirely.**

---

### T15 — Frontend type sync

**Goal:** TS types reflect the new wire. If HTTP response shapes changed (e.g., `media_type` → `content_kind`), propagate to TS and any React consumers.

**Files:**
- `electron/daemon-go-types.ts` *(regenerated)*.
- Any React component switching on media kind *(updated)*.

**Acceptance criteria:**
- [ ] `pnpm run ci:check` passes.
- [ ] No TS `any` introduced as a stop-gap.

---

### T16 — Documentation

**Goal:** One-pager for "how to add a backend" reflecting the final shape. Delete REFACTOR_PLAN.md.

**Files:**
- `daemon/internal/backend/README.md` *(new)* — interface contract, Content variants, capabilities, Apply contract, snapshot lifecycle. References to `daemon/API_CONTRACT.md` for HTTP wire.
- `CLAUDE.md` *(workspace root, modified)* — pointer to the new README; remove outdated guidance about `SetWallpaper`.
- `daemon/API_CONTRACT.md` *(updated if HTTP wire changed)*.
- `REFACTOR_PLAN.md` *(deleted)*.

**Acceptance criteria:**
- [ ] Someone reading `daemon/internal/backend/README.md` alone can implement a new backend without reading any other backend's source.
- [ ] No references to deleted types (`WallpaperRequest`, etc.) in any markdown.

---

## 5. Dispatch order

```
T1 ──► T2 (parallel-safe with T3, but T3 imports T2's PurgeImageReferences)
T1 ──► T3
T1 ──► T4
T1, T3 ──► T5 (Apply method + shims; needs Snapshot types from T1)
T5 ──► T6 (shadow harness)
T6 ──► T7 (swaybg)
T7 ──► T8 (feh)         ┐
T8 ──► T9 (mpvpaper)    │ Strictly sequential to learn from each migration
T9 ──► T10 (awww)       │ before tackling wal-qt.
T10 ──► T11 (hyprpaper) │
T11 ──► T12 (wal-qt)    ┘
T12 ──► T13 (orchestration)
T13 ──► T14 (delete old)
T14 ──► T15 (frontend) — can be parallel with T16
T14 ──► T16 (docs)
```

Recommended: do T1+T2+T3+T4 in one batch (foundation), then T5 (shims), then T6 (harness), then T7–T12 strictly in order, then T13+T14 together, then T15+T16.

---

## 6. End-of-refactor sanity checks

After T16, the orchestrator verifies:

- [ ] `cd daemon && go build ./... && go test ./... && go vet ./...` all clean.
- [ ] `pnpm run ci:check` passes.
- [ ] `make daemon` builds.
- [ ] Manual smoke test: start daemon with hyprpaper active, apply two different images to two monitors via API, verify both display.
- [ ] Manual smoke test: same with swaybg.
- [ ] Manual smoke test: same with wal-qt.
- [ ] Restart daemon, verify Restore brings both monitors back to their persisted state.
- [ ] `git diff --stat main...HEAD` shows a net **deletion** of code (the new types are smaller than what they replace).
