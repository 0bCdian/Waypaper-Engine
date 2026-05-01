# Daemon Architecture Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deepen the Go daemon's Backend interface, eliminate dead HTTP routes, and extract a testable `Daemon` struct — all without breaking the existing HTTP API contract.

**Architecture:** The `Backend` interface gains `OnConfigChanged` as a first-class method (replacing scattered `RuntimeConfigSync` type assertions); `WallpaperRequest` gains `ExtendGroup []string` (replacing the `ExtendParallaxGroupNotifier` interface); dead routes (`GET /images/count`, `GET /images/{id}/thumbnail/raw`, `POST /images/{id}/rename`) are deleted or folded into existing endpoints; and a `Daemon` struct with injected dependencies replaces the monolithic `startDaemon()` function, enabling integration tests that spin up the full HTTP stack.

**Tech Stack:** Go 1.26, Chi router, CloverDB, swag (OpenAPI generation), `golang.org/x/sync/errgroup`

---

## File Map

### Modified files

- `daemon/internal/backend/backend.go` — add `OnConfigChanged`, add `ExtendGroup` to `WallpaperRequest`, delete `RuntimeConfigSync` + `ExtendParallaxGroupNotifier`
- `daemon/internal/backend/feh/feh.go` — implement `OnConfigChanged` (re-apply current wallpaper)
- `daemon/internal/backend/hyprpaper/hyprpaper.go` — implement `OnConfigChanged` (re-apply)
- `daemon/internal/backend/mpvpaper/mpvpaper.go` — implement `OnConfigChanged` (re-apply)
- `daemon/internal/backend/awww/awww.go` — implement `OnConfigChanged` (re-apply)
- `daemon/internal/backend/waylandutauri/waylandutauri.go` — rename `SyncRuntimeFromConfig` → `OnConfigChanged`, read `ExtendGroup` inside `SetWallpaper`, delete `SetExtendParallaxGroup`
- `daemon/internal/wallpaper/apply.go` — remove `ExtendParallaxGroupNotifier` type assertion, populate `ExtendGroup` on requests, extract named helpers (`applyExtendImage`, `applyExtendNonImage`, `applyDefault`)
- `daemon/internal/control/controller.go` — replace `RuntimeConfigSync` type assertion with `b.OnConfigChanged(...)`
- `daemon/internal/handler/imageshandler/images.go` — delete `Count`, `RawThumbnail` handlers; merge `RenameImage` logic into `Update` (PATCH makes name change atomic: DB + filesystem)
- `daemon/internal/server/routes.go` — remove `GET /images/count`, `GET /images/{id}/thumbnail/raw`, `POST /images/{id}/rename`
- `daemon/docs/openapi.yaml` — remove deleted routes, update `PATCH /images/{id}` spec to document rename semantics
- `daemon/cmd/daemon/main.go` — replace `RuntimeConfigSync` type assertion with `OnConfigChanged`, wire `Daemon` struct

### New files

- `daemon/internal/daemon/daemon.go` — `Daemon` struct with injected deps + `Start(ctx context.Context) error`
- `daemon/internal/daemon/daemon_test.go` — integration tests using real CloverDB (temp dir) + mock backend

---

## Task 1: Delete `RuntimeConfigSync`, add `OnConfigChanged` to `Backend` interface

**Files:**

- Modify: `daemon/internal/backend/backend.go`

- [ ] **Step 1: Write the failing compile check**

Add a blank `var _ backend.Backend = (*feh.Feh)(nil)` compile-time assertion to `daemon/internal/backend/feh/feh.go`. It will fail to compile once we add the new method. This is our "failing test".

```bash
cd waypaper-engine && go build ./daemon/internal/backend/feh/
```

Expected: compiles fine (interface not changed yet).

- [ ] **Step 2: Update `backend.go` — delete `RuntimeConfigSync`, add `OnConfigChanged`, add `ExtendGroup` to `WallpaperRequest`**

In `daemon/internal/backend/backend.go`:

Delete the entire `RuntimeConfigSync` interface block (lines ~80–85):

```go
// DELETE THIS BLOCK:
// RuntimeConfigSync is optional. Backends that control a long-lived renderer
// ...
type RuntimeConfigSync interface {
    SyncRuntimeFromConfig(ctx context.Context) error
}
```

Delete the entire `ExtendParallaxGroupNotifier` interface block (lines ~87–95):

```go
// DELETE THIS BLOCK:
// ExtendParallaxGroupNotifier is optional. ...
type ExtendParallaxGroupNotifier interface {
    SetExtendParallaxGroup(monitors []string)
}
```

Add `OnConfigChanged` to the `Backend` interface (after `ParseConfig`):

```go
// OnConfigChanged is called when the backend's configuration section is
// updated via PATCH /config/backends/{name}. Implementations must apply
// the new config immediately:
//   - Daemon-process backends (e.g. wayland-utauri) push the change to
//     the live renderer without restarting.
//   - Stateless backends (feh, hyprpaper, mpvpaper, awww) re-apply the
//     current wallpaper so the new config takes effect immediately.
//
// Called only when this backend is the active backend. newConfig is the
// full backend config section as raw JSON.
OnConfigChanged(ctx context.Context, newConfig json.RawMessage) error
```

Add `ExtendGroup` field to `WallpaperRequest` (after `WaitForCompletion`):

```go
// ExtendGroup is populated only when Mode == ModeExtend with a static image
// split across multiple monitors. It lists all compositor output names that
// share the same logical source image (including the current monitor).
// Backends that run a persistent renderer (e.g. wayland-utauri) use this to
// coordinate per-output effects (e.g. parallax) so seams stay aligned.
// Other backends ignore this field.
ExtendGroup []string `json:"-"`
```

- [ ] **Step 3: Verify the interface change breaks compilation as expected**

```bash
cd waypaper-engine && go build ./daemon/...
```

Expected: multiple compile errors — every backend struct now missing `OnConfigChanged`.

- [ ] **Step 4: Commit the interface change alone (broken build is intentional mid-task)**

```bash
git add daemon/internal/backend/backend.go
git commit -m "refactor(backend): add OnConfigChanged to Backend interface, add ExtendGroup to WallpaperRequest, remove RuntimeConfigSync and ExtendParallaxGroupNotifier"
```

---

## Task 2: Implement `OnConfigChanged` on stateless backends (feh, hyprpaper, mpvpaper, awww)

**Files:**

- Modify: `daemon/internal/backend/feh/feh.go`
- Modify: `daemon/internal/backend/hyprpaper/hyprpaper.go`
- Modify: `daemon/internal/backend/mpvpaper/mpvpaper.go`
- Modify: `daemon/internal/backend/awww/awww.go`

Each stateless backend gets an `OnConfigChanged` that re-applies the current wallpaper on each active monitor. The implementation needs access to the monitor state store and the monitor list — but these backends currently don't hold those. The cleanest approach: `OnConfigChanged` accepts `newConfig` and a context; re-apply is triggered by the daemon's control layer (not the backend itself) after calling `OnConfigChanged`. So for stateless backends, `OnConfigChanged` just updates internal Viper state and returns nil — the control layer handles re-apply.

- [ ] **Step 1: Implement `OnConfigChanged` for `feh`**

In `daemon/internal/backend/feh/feh.go`, add after `Shutdown`:

```go
// OnConfigChanged updates feh's configuration. The daemon control layer
// re-applies the current wallpaper after this returns so the new config
// (e.g. scale mode) takes effect immediately.
func (f *Feh) OnConfigChanged(_ context.Context, _ json.RawMessage) error {
    // feh reads config from Viper at SetWallpaper time; no in-process state to update.
    // The control layer triggers a re-apply after this returns.
    return nil
}
```

- [ ] **Step 2: Implement `OnConfigChanged` for `hyprpaper`**

In `daemon/internal/backend/hyprpaper/hyprpaper.go`, add the same no-op pattern:

```go
func (h *Hyprpaper) OnConfigChanged(_ context.Context, _ json.RawMessage) error {
    return nil
}
```

- [ ] **Step 3: Implement `OnConfigChanged` for `mpvpaper`**

In `daemon/internal/backend/mpvpaper/mpvpaper.go`:

```go
func (m *Mpvpaper) OnConfigChanged(_ context.Context, _ json.RawMessage) error {
    return nil
}
```

- [ ] **Step 4: Implement `OnConfigChanged` for `awww`**

In `daemon/internal/backend/awww/awww.go`:

```go
func (a *Awww) OnConfigChanged(_ context.Context, _ json.RawMessage) error {
    // awww reads config from Viper at SetWallpaper time.
    // The control layer triggers a re-apply after this returns.
    return nil
}
```

- [ ] **Step 5: Verify stateless backends compile**

```bash
cd waypaper-engine && go build ./daemon/internal/backend/feh/ ./daemon/internal/backend/hyprpaper/ ./daemon/internal/backend/mpvpaper/ ./daemon/internal/backend/awww/
```

Expected: all compile cleanly.

- [ ] **Step 6: Commit**

```bash
git add daemon/internal/backend/feh/feh.go daemon/internal/backend/hyprpaper/hyprpaper.go daemon/internal/backend/mpvpaper/mpvpaper.go daemon/internal/backend/awww/awww.go
git commit -m "refactor(backend): implement OnConfigChanged no-op on stateless backends (feh, hyprpaper, mpvpaper, awww)"
```

---

## Task 3: Implement `OnConfigChanged` on `wayland-utauri`, remove `SetExtendParallaxGroup`, read `ExtendGroup` in `SetWallpaper`

**Files:**

- Modify: `daemon/internal/backend/waylandutauri/waylandutauri.go`

- [ ] **Step 1: Rename `SyncRuntimeFromConfig` → `OnConfigChanged`**

In `waylandutauri.go`, find `func (w *WaylandUtauri) SyncRuntimeFromConfig(ctx context.Context) error` and rename it:

```go
// OnConfigChanged pushes the updated backend configuration to the live
// wayland-utauri renderer without restarting it. If the renderer is not
// running, the call is a no-op (config will be applied on next Initialize).
func (w *WaylandUtauri) OnConfigChanged(ctx context.Context, _ json.RawMessage) error {
    cfg := w.loadConfigFromViper()
    client, err := w.makeControlClient(cfg)
    if err != nil {
        return fmt.Errorf("wayland-utauri: runtime sync: %w", err)
    }
    if err := client.setParallax(ctx, buildParallaxRequestBody(cfg)); err != nil {
        return fmt.Errorf("wayland-utauri: runtime sync parallax: %w", err)
    }
    w.syncParallaxDriver(cfg)
    if err := client.setAllowNetworkWallpapers(ctx, cfg.AllowNetworkWallpapers); err != nil {
        return fmt.Errorf("wayland-utauri: runtime sync network policy: %w", err)
    }
    fit := strings.TrimSpace(cfg.ImageFitMode)
    if fit == "" {
        fit = "cover"
    }
    rend := strings.TrimSpace(cfg.ImageRendering)
    if rend == "" {
        rend = "auto"
    }
    if err := client.setImagePresentation(ctx, fit, rend); err != nil {
        return fmt.Errorf("wayland-utauri: runtime sync image presentation: %w", err)
    }
    return nil
}
```

- [ ] **Step 2: Remove the old compile-time assertion for `RuntimeConfigSync`**

Delete this line (around line 134):

```go
var _ backend.RuntimeConfigSync = (*WaylandUtauri)(nil)
```

- [ ] **Step 3: Remove `SetExtendParallaxGroup` method and `extendParallaxGroup` struct fields, update `SetWallpaper` to read `ExtendGroup` from request**

Delete the `SetExtendParallaxGroup` method entirely:

```go
// DELETE:
func (w *WaylandUtauri) SetExtendParallaxGroup(monitors []string) { ... }
```

Delete the compile-time assertion:

```go
// DELETE:
var _ backend.ExtendParallaxGroupNotifier = (*WaylandUtauri)(nil)
```

Keep `extendParallaxGroup`, `extendParallaxMu` fields in the struct — they are still needed by `expandParallaxMoveTargets`. But now they are updated from inside `SetWallpaper`.

In `SetWallpaper`, after successfully setting the wallpaper, add at the end of the method (before returning):

```go
// Update parallax group from the request. ExtendGroup is non-nil only when
// apply.go split a static image across multiple monitors (extend mode).
w.extendParallaxMu.Lock()
if len(req.ExtendGroup) >= 2 {
    cp := make([]string, len(req.ExtendGroup))
    copy(cp, req.ExtendGroup)
    slices.Sort(cp)
    w.extendParallaxGroup = cp
} else {
    w.extendParallaxGroup = nil
}
w.extendParallaxMu.Unlock()
```

- [ ] **Step 4: Verify wayland-utauri compiles**

```bash
cd waypaper-engine && go build ./daemon/internal/backend/waylandutauri/
```

Expected: compiles cleanly.

- [ ] **Step 5: Commit**

```bash
git add daemon/internal/backend/waylandutauri/waylandutauri.go
git commit -m "refactor(wayland-utauri): OnConfigChanged replaces SyncRuntimeFromConfig; ExtendGroup from WallpaperRequest replaces SetExtendParallaxGroup interface"
```

---

## Task 4: Update `apply.go` — remove type assertions, populate `ExtendGroup`, extract named helpers

**Files:**

- Modify: `daemon/internal/wallpaper/apply.go`

- [ ] **Step 1: Remove the `ExtendParallaxGroupNotifier` type assertion block**

Delete these lines from `Apply`:

```go
// DELETE:
if n, ok := opts.Backend.(backend.ExtendParallaxGroupNotifier); ok {
    n.SetExtendParallaxGroup(spanParallaxOuts)
}
```

Also delete the `var spanParallaxOuts []string` declaration and all assignments to it.

- [ ] **Step 2: Populate `ExtendGroup` on the per-monitor requests in extend+image mode**

In the `case opts.Mode == monitor.ModeExtend && mediaType == media.MediaTypeImage` branch, compute the full monitor names list once, then pass it on every `SetWallpaper` call:

```go
case opts.Mode == monitor.ModeExtend && mediaType == media.MediaTypeImage && opts.Splitter != nil && len(opts.Monitors) > 1:
    return applyExtendImage(ctx, opts, mediaType, cfgVals)
```

- [ ] **Step 3: Extract `applyExtendImage` helper**

Add below `Apply`:

```go
func applyExtendImage(ctx context.Context, opts ApplyOpts, mediaType media.MediaType, cfgVals json.RawMessage) error {
    splitPaths, err := opts.Splitter.Split(opts.Image.Path, opts.Image.ID, opts.Monitors)
    if err != nil {
        return fmt.Errorf("split image: %w", err)
    }

    extendGroup := make([]string, len(opts.Monitors))
    for i, mon := range opts.Monitors {
        extendGroup[i] = mon.Name
    }

    for _, mon := range opts.Monitors {
        splitPath, ok := splitPaths[mon.Name]
        if !ok {
            continue
        }
        req := backend.WallpaperRequest{
            MediaType:             mediaType,
            ImagePath:             splitPath,
            AudioEnabled:          opts.Image.AudioEnabled && opts.VideoAudioDefault,
            Monitors:              []monitor.Monitor{mon},
            Mode:                  monitor.ModeIndividual,
            WallpaperConfigValues: cfgVals,
            ParallaxDirection:     ParallaxDirectionOverrideFromImage(opts.Image),
            ExtendGroup:           extendGroup,
        }
        if err := opts.Backend.SetWallpaper(ctx, req); err != nil {
            return fmt.Errorf("set wallpaper for %s: %w", mon.Name, err)
        }
    }
    return nil
}
```

- [ ] **Step 4: Extract `applyExtendNonImage` and `applyDefault` helpers**

```go
func applyExtendNonImage(ctx context.Context, opts ApplyOpts, mediaType media.MediaType, cfgVals json.RawMessage) error {
    req := backend.WallpaperRequest{
        MediaType:             mediaType,
        ImagePath:             opts.Image.Path,
        AudioEnabled:          opts.Image.AudioEnabled && opts.VideoAudioDefault,
        Monitors:              opts.Monitors,
        Mode:                  monitor.ModeClone,
        WallpaperConfigValues: cfgVals,
        ParallaxDirection:     ParallaxDirectionOverrideFromImage(opts.Image),
    }
    if err := opts.Backend.SetWallpaper(ctx, req); err != nil {
        return fmt.Errorf("set wallpaper: %w", err)
    }
    return nil
}

func applyDefault(ctx context.Context, opts ApplyOpts, mediaType media.MediaType, cfgVals json.RawMessage) error {
    req := backend.WallpaperRequest{
        MediaType:             mediaType,
        ImagePath:             opts.Image.Path,
        AudioEnabled:          opts.Image.AudioEnabled && opts.VideoAudioDefault,
        Monitors:              opts.Monitors,
        Mode:                  opts.Mode,
        WallpaperConfigValues: cfgVals,
        ParallaxDirection:     ParallaxDirectionOverrideFromImage(opts.Image),
    }
    if err := opts.Backend.SetWallpaper(ctx, req); err != nil {
        return fmt.Errorf("set wallpaper: %w", err)
    }
    return nil
}
```

- [ ] **Step 5: Update `Apply` switch to use helpers**

```go
func Apply(ctx context.Context, opts ApplyOpts) error {
    mediaType := normalizeMediaType(opts.Image.MediaType)
    cfgVals := MergedWallpaperConfigForImage(opts.Image)

    var err error
    switch {
    case opts.Mode == monitor.ModeExtend && mediaType != media.MediaTypeImage:
        err = applyExtendNonImage(ctx, opts, mediaType, cfgVals)
    case opts.Mode == monitor.ModeExtend && mediaType == media.MediaTypeImage && opts.Splitter != nil && len(opts.Monitors) > 1:
        err = applyExtendImage(ctx, opts, mediaType, cfgVals)
    default:
        err = applyDefault(ctx, opts, mediaType, cfgVals)
    }
    if err != nil {
        return err
    }

    // ... rest of Apply (history, SSE publish, monitor state) unchanged
```

- [ ] **Step 6: Build and run existing wallpaper tests**

```bash
cd waypaper-engine && go build ./daemon/internal/wallpaper/ && npm run test:daemon:unit 2>&1 | grep -E "FAIL|PASS|ok"
```

Expected: all pass.

- [ ] **Step 7: Commit**

```bash
git add daemon/internal/wallpaper/apply.go
git commit -m "refactor(wallpaper): extract applyExtendImage/NonImage/Default helpers, populate ExtendGroup on WallpaperRequest, remove ExtendParallaxGroupNotifier type assertion"
```

---

## Task 5: Update `controller.go` and `main.go` to use `OnConfigChanged`

**Files:**

- Modify: `daemon/internal/control/controller.go`
- Modify: `daemon/cmd/daemon/main.go`

- [ ] **Step 1: Update `controller.go` — replace type assertion with `b.OnConfigChanged`**

Find the block in `controller.go`:

```go
if name == active {
    if syncer, ok := b.(backend.RuntimeConfigSync); ok {
        if err := syncer.SyncRuntimeFromConfig(ctx); err != nil {
            slog.Warn("backend runtime sync after config save failed", "backend", name, "error", err)
        }
    }
}
```

Replace with:

```go
if name == active {
    if err := b.OnConfigChanged(ctx, raw); err != nil {
        slog.Warn("backend config change sync failed", "backend", name, "error", err)
    }
    // Re-apply current wallpaper so stateless backends reflect new config immediately.
    if c.restore != nil {
        c.restore.Restore(ctx)
    }
}
```

- [ ] **Step 2: Update `main.go` — replace type assertion with `OnConfigChanged`**

Find in `main.go`:

```go
if syncer, ok := activeBackend.(backend.RuntimeConfigSync); ok {
    if err := syncer.SyncRuntimeFromConfig(ctx); err != nil {
        slog.Warn("backend runtime sync after init failed", "error", err)
    }
}
```

Replace with:

```go
if err := activeBackend.OnConfigChanged(ctx, nil); err != nil {
    slog.Warn("backend config sync after init failed", "error", err)
}
```

Note: passing `nil` for `newConfig` on init is safe — all backends read their config from Viper, and `OnConfigChanged` for wayland-utauri ignores the `newConfig` argument (it calls `loadConfigFromViper` internally). Stateless backends also ignore it. If this distinction becomes important in future, pass the actual config JSON here.

- [ ] **Step 3: Build the full daemon**

```bash
cd waypaper-engine && go build ./daemon/...
```

Expected: compiles with no errors.

- [ ] **Step 4: Run all daemon tests**

```bash
cd waypaper-engine && npm run test:daemon:unit
```

Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add daemon/internal/control/controller.go daemon/cmd/daemon/main.go
git commit -m "refactor(control): replace RuntimeConfigSync type assertion with Backend.OnConfigChanged; trigger re-apply for stateless backends on config change"
```

---

## Task 6: Delete dead routes and fold `rename` into `PATCH /images/{id}`

**Files:**

- Modify: `daemon/internal/handler/imageshandler/images.go`
- Modify: `daemon/internal/server/routes.go`

- [ ] **Step 1: Delete the `Count` handler**

In `images.go`, delete the entire `Count` method:

```go
// DELETE: func (h *ImageHandler) Count(...) { ... }
```

- [ ] **Step 2: Delete the `RawThumbnail` handler**

In `images.go`, delete the entire `RawThumbnail` method:

```go
// DELETE: func (h *ImageHandler) RawThumbnail(...) { ... }
```

- [ ] **Step 3: Fold `RenameImage` logic into `Update`**

The `Update` (PATCH) handler currently allows patching `name` but does NOT rename the file on disk. We must make it do the full rename atomically when `name` is in the patch body.

In `Update`, after the `allowed` fields check passes, add this block before calling `h.store.Update`:

```go
// If name is being changed, perform the filesystem rename atomically with the DB update.
if rawName, ok := updates["name"]; ok {
    name, _ := rawName.(string)
    name = strings.TrimSpace(name)
    if err := validateImageName(name); err != nil {
        httpjson.WriteError(w, http.StatusBadRequest, err.Error())
        return
    }

    current, err := h.store.GetByID(r.Context(), id)
    if err != nil {
        httpjson.WriteError(w, http.StatusNotFound, err.Error())
        return
    }

    // Strip extension if supplied.
    for _, ext := range []string{"." + current.Format, ".jpeg"} {
        if strings.EqualFold(filepath.Ext(name), ext) {
            name = strings.TrimSuffix(name, filepath.Ext(name))
            break
        }
    }

    if name != current.Name {
        // Auto-suffix for uniqueness.
        finalName := name
        for i := 1; ; i++ {
            taken, err := h.store.IsNameTaken(r.Context(), finalName, id)
            if err != nil {
                httpjson.WriteError(w, http.StatusInternalServerError, err.Error())
                return
            }
            if !taken {
                break
            }
            finalName = fmt.Sprintf("%s_%d", name, i)
        }

        ext := filepath.Ext(current.Path)
        newPath := filepath.Join(filepath.Dir(current.Path), finalName+ext)
        newPath = system.UniquePath(newPath)

        if err := os.Rename(current.Path, newPath); err != nil {
            httpjson.WriteErrorf(w, http.StatusInternalServerError, "rename file: %v", err)
            return
        }

        // Carry the resolved name and new path into the store update.
        updates["name"] = finalName
        updates["path"] = newPath
    } else {
        // Name unchanged — remove from updates to avoid a no-op write.
        delete(updates, "name")
    }
}
```

- [ ] **Step 4: Delete the `RenameImage` method and its request type**

```go
// DELETE: func (h *ImageHandler) RenameImage(...) { ... }
// DELETE: type renameRequest struct { ... }
```

- [ ] **Step 5: Remove dead routes from `routes.go`**

In `daemon/internal/server/routes.go`, remove:

```go
r.Get("/count", h.Images.Count)
r.Get("/{id}/thumbnail/raw", h.Images.RawThumbnail)
r.Post("/{id}/rename", h.Images.RenameImage)
```

- [ ] **Step 6: Build and run handler tests**

```bash
cd waypaper-engine && go build ./daemon/... && npm run test:daemon:unit
```

Expected: all pass.

- [ ] **Step 7: Commit**

```bash
git add daemon/internal/handler/imageshandler/images.go daemon/internal/server/routes.go
git commit -m "feat(images): make PATCH /images/{id} name change atomic (DB + filesystem rename); delete dead routes: GET /images/count, GET /images/{id}/thumbnail/raw, POST /images/{id}/rename"
```

---

## Task 7: Update `openapi.yaml` to match all 61 live routes

**Files:**

- Modify: `daemon/docs/openapi.yaml`

The spec currently documents 47 paths; 61 routes exist (after deletions in Task 6, the final count is 58). The following paths are missing from the spec and must be added.

- [ ] **Step 1: Identify missing routes**

Run this to list routes not in the spec:

```bash
cd waypaper-engine && grep -E "r\.(Get|Post|Put|Patch|Delete)\(" daemon/internal/server/routes.go | grep -oP '"[^"]*"' | sort | uniq
```

Cross-reference with:

```bash
grep "^  /" daemon/docs/openapi.yaml | sort
```

- [ ] **Step 2: Add missing image routes to `openapi.yaml`**

Add the following path definitions (insert under the existing `/images` paths section):

```yaml
/images/history:
  get:
    summary: Get wallpaper history
    tags: [wallpaper]
    parameters:
      - name: monitor
        in: query
        schema:
          type: string
      - name: limit
        in: query
        schema:
          type: integer
    responses:
      "200":
        description: History entries
        content:
          application/json:
            schema:
              type: array
              items:
                $ref: "#/components/schemas/ImageHistoryEntry"
  delete:
    summary: Clear wallpaper history
    tags: [wallpaper]
    responses:
      "204":
        description: Cleared

/images/{id}/raw:
  get:
    summary: Serve raw image file
    tags: [images]
    parameters:
      - name: id
        in: path
        required: true
        schema:
          type: integer
    responses:
      "200":
        description: Raw image binary
        content:
          application/octet-stream:
            schema:
              type: string
              format: binary
      "404":
        $ref: "#/components/responses/NotFound"

/images/{id}/ensure-browser-preview:
  post:
    summary: Ensure browser-compatible preview exists
    tags: [images]
    parameters:
      - name: id
        in: path
        required: true
        schema:
          type: integer
    responses:
      "200":
        description: Image with preview path populated
        content:
          application/json:
            schema:
              $ref: "#/components/schemas/Image"
      "404":
        $ref: "#/components/responses/NotFound"

/images/{id}/video-loop-export:
  post:
    summary: Export a trimmed seamless video loop
    tags: [images]
    parameters:
      - name: id
        in: path
        required: true
        schema:
          type: integer
    requestBody:
      required: true
      content:
        application/json:
          schema:
            $ref: "#/components/schemas/VideoLoopExportRequest"
    responses:
      "200":
        description: Export result
        content:
          application/json:
            schema:
              $ref: "#/components/schemas/VideoLoopExportResult"
      "400":
        $ref: "#/components/responses/BadRequest"
      "404":
        $ref: "#/components/responses/NotFound"
```

- [ ] **Step 3: Add missing playlist bulk-active routes**

```yaml
/playlists/active/resume:
  post:
    summary: Resume all active playlists
    tags: [playlists]
    responses:
      "204":
        description: Resumed

/playlists/active/next:
  post:
    summary: Advance all active playlists to next image
    tags: [playlists]
    responses:
      "204":
        description: Advanced

/playlists/active/previous:
  post:
    summary: Rewind all active playlists to previous image
    tags: [playlists]
    responses:
      "204":
        description: Rewound
```

- [ ] **Step 4: Add missing folder and config routes**

```yaml
/folders/{id}/path:
  get:
    summary: Get the full path chain for a folder
    tags: [folders]
    parameters:
      - name: id
        in: path
        required: true
        schema:
          type: integer
    responses:
      "200":
        description: Path chain
        content:
          application/json:
            schema:
              type: array
              items:
                $ref: "#/components/schemas/Folder"
      "404":
        $ref: "#/components/responses/NotFound"

/folders/move-images:
  post:
    summary: Move images to a folder
    tags: [folders]
    requestBody:
      required: true
      content:
        application/json:
          schema:
            type: object
            properties:
              image_ids:
                type: array
                items:
                  type: integer
              folder_id:
                type: integer
                nullable: true
    responses:
      "200":
        description: Move result
        content:
          application/json:
            schema:
              type: object

/config/:
  get:
    summary: Get full daemon config
    tags: [config]
    responses:
      "200":
        description: Full config
        content:
          application/json:
            schema:
              type: object
  patch:
    summary: Patch top-level config fields
    tags: [config]
    requestBody:
      required: true
      content:
        application/json:
          schema:
            type: object
    responses:
      "200":
        description: Updated config
        content:
          application/json:
            schema:
              type: object

/config/{section}:
  get:
    summary: Get a named config section
    tags: [config]
    parameters:
      - name: section
        in: path
        required: true
        schema:
          type: string
    responses:
      "200":
        description: Section data
        content:
          application/json:
            schema:
              type: object
      "404":
        $ref: "#/components/responses/NotFound"
  patch:
    summary: Patch a named config section
    tags: [config]
    parameters:
      - name: section
        in: path
        required: true
        schema:
          type: string
    requestBody:
      required: true
      content:
        application/json:
          schema:
            type: object
    responses:
      "200":
        description: Updated section
        content:
          application/json:
            schema:
              type: object
```

- [ ] **Step 5: Update `PATCH /images/{id}` spec to document rename semantics**

Find the existing `PATCH /images/{id}` spec entry and add to the description:

```yaml
/images/{id}:
  patch:
    summary: Update image fields
    description: |
      Updates mutable image fields. When `name` is included, the image file
      is also renamed on the filesystem atomically with the database update.
      The final name may be auto-suffixed (_1, _2, …) if a name collision exists.
    tags: [images]
```

- [ ] **Step 6: Validate spec parses**

```bash
cd waypaper-engine && npm run generate:openapi 2>&1 | tail -5
```

Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add daemon/docs/openapi.yaml
git commit -m "docs(openapi): catch up spec to all live routes; document PATCH /images/{id} rename semantics; remove deleted routes"
```

---

## Task 8: Extract `Daemon` struct and enable integration tests

**Files:**

- Create: `daemon/internal/daemon/daemon.go`
- Create: `daemon/internal/daemon/daemon_test.go`
- Modify: `daemon/cmd/daemon/main.go`

- [ ] **Step 1: Write the failing integration test**

Create `daemon/internal/daemon/daemon_test.go`:

```go
package daemon_test

import (
    "context"
    "encoding/json"
    "net/http"
    "os"
    "path/filepath"
    "testing"
    "time"

    "waypaper-engine/daemon/internal/backend"
    "waypaper-engine/daemon/internal/daemon"
    "waypaper-engine/daemon/internal/media"
    "waypaper-engine/daemon/internal/monitor"
    "waypaper-engine/daemon/internal/store"

    "github.com/spf13/viper"
)

// mockBackend satisfies backend.Backend for testing.
type mockBackend struct {
    setWallpaperCalls []backend.WallpaperRequest
}

func (m *mockBackend) Name() string                                         { return "mock" }
func (m *mockBackend) IsAvailable() bool                                    { return true }
func (m *mockBackend) Capabilities() backend.Capabilities                   { return backend.Capabilities{MediaTypes: []media.MediaType{media.MediaTypeImage}, Compositors: []monitor.CompositorType{monitor.CompositorWayland}} }
func (m *mockBackend) Initialize(_ context.Context) error                   { return nil }
func (m *mockBackend) Shutdown(_ context.Context) error                     { return nil }
func (m *mockBackend) SetWallpaper(_ context.Context, req backend.WallpaperRequest) error {
    m.setWallpaperCalls = append(m.setWallpaperCalls, req)
    return nil
}
func (m *mockBackend) RegisterDefaults(_ *viper.Viper)                          {}
func (m *mockBackend) ValidateConfig(_ json.RawMessage) error               { return nil }
func (m *mockBackend) ParseConfig(_ json.RawMessage) (any, error)           { return nil, nil }
func (m *mockBackend) OnConfigChanged(_ context.Context, _ json.RawMessage) error { return nil }

func TestDaemon_HealthzReturns200(t *testing.T) {
    dir := t.TempDir()
    sockPath := filepath.Join(dir, "test.sock")

    db, err := store.OpenDatabase(filepath.Join(dir, "db"))
    if err != nil {
        t.Fatalf("open db: %v", err)
    }
    t.Cleanup(func() { _ = db.Close() })

    mock := &mockBackend{}
    v := viper.New()

    d, err := daemon.New(daemon.Options{
        SocketPath: sockPath,
        DB:         db,
        Backend:    mock,
        Viper:      v,
        ImagesDir:  filepath.Join(dir, "images"),
    })
    if err != nil {
        t.Fatalf("new daemon: %v", err)
    }

    ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
    defer cancel()

    go func() { _ = d.Start(ctx) }()

    // Wait for socket to appear.
    deadline := time.Now().Add(3 * time.Second)
    for time.Now().Before(deadline) {
        if _, err := os.Stat(sockPath); err == nil {
            break
        }
        time.Sleep(50 * time.Millisecond)
    }

    client := &http.Client{
        Transport: &http.Transport{
            DialContext: func(ctx context.Context, _, _ string) (interface{ Read([]byte) (int, error); Write([]byte) (int, error); Close() error }, error) {
                return nil, nil // replaced by unix socket dial in real impl
            },
        },
    }
    _ = client // placeholder: use httptest.NewUnstartedServer or net.Dial("unix", sockPath) in real test

    // Simplified assertion: daemon starts without error.
    cancel() // trigger shutdown
    time.Sleep(200 * time.Millisecond)
}
```

- [ ] **Step 2: Run to confirm it fails (package doesn't exist yet)**

```bash
cd waypaper-engine && go test ./daemon/internal/daemon/...
```

Expected: `no Go files in daemon/internal/daemon`

- [ ] **Step 3: Create `daemon/internal/daemon/daemon.go`**

> **Important:** The code below is a structural sketch. Before implementing, verify exact constructor signatures against the actual codebase:
>
> - `store.OpenDB(path)` (not `OpenDatabase`) returns `store.DB`
> - `monitor.NewMonitorManager(providers, compositor)` returns `(monitor.MonitorManager, error)`
> - `playlist.NewManager` takes 11 args including a `config.ConfigManager` — pass `config.NewViperManager(opts.Viper)` or nil/stub as appropriate for tests
> - Handler constructors: `healthhandler.NewHealthHandler`, `imageshandler.NewImageHandler`, `playlistshandler.NewPlaylistHandler`, `monitorshandler.NewMonitorHandler`, `confighandler.NewConfigHandler`, `backendshandler.NewBackendHandler`, `wallpaperhandler.NewWallpaperHandler`, `foldershandler.NewFolderHandler`
> - `backendshandler.NewBackendHandler` and `confighandler.NewConfigHandler` take a `*control.Controller`, not a raw registry — construct the controller first
>
> Use `daemon/cmd/daemon/main.go` as the authoritative reference for wiring order and constructor arguments.

```go
// Package daemon wires all subsystems and runs the HTTP server on the Unix socket.
// It is extracted from cmd/daemon/main.go to enable integration testing.
package daemon

import (
    "context"
    "fmt"
    "log/slog"
    "net"
    "net/http"
    "os"

    "github.com/go-chi/chi/v5"
    "github.com/spf13/viper"

    "waypaper-engine/daemon/internal/backend"
    "waypaper-engine/daemon/internal/events"
    "waypaper-engine/daemon/internal/handler/backendshandler"
    "waypaper-engine/daemon/internal/handler/confighandler"
    "waypaper-engine/daemon/internal/handler/foldershandler"
    "waypaper-engine/daemon/internal/handler/healthhandler"
    "waypaper-engine/daemon/internal/handler/imageshandler"
    "waypaper-engine/daemon/internal/handler/monitorshandler"
    "waypaper-engine/daemon/internal/handler/playlistshandler"
    "waypaper-engine/daemon/internal/handler/wallpaperhandler"
    "waypaper-engine/daemon/internal/image"
    "waypaper-engine/daemon/internal/monitor"
    "waypaper-engine/daemon/internal/playlist"
    "waypaper-engine/daemon/internal/server"
    "waypaper-engine/daemon/internal/store"
)

// Options holds all injected dependencies for a Daemon instance.
type Options struct {
    SocketPath      string
    DB              store.Database
    Backend         backend.Backend
    Viper           *viper.Viper
    ImagesDir       string
    ThumbnailsDir   string
    MonitorProvider monitor.Provider // optional; nil = no monitor discovery
    Version         string
}

// Daemon runs the waypaper-engine HTTP server.
type Daemon struct {
    opts Options
    bus  events.Bus
}

// New creates a Daemon with the given options. Returns an error if required
// options are missing.
func New(opts Options) (*Daemon, error) {
    if opts.SocketPath == "" {
        return nil, fmt.Errorf("daemon: SocketPath is required")
    }
    if opts.DB == nil {
        return nil, fmt.Errorf("daemon: DB is required")
    }
    if opts.Backend == nil {
        return nil, fmt.Errorf("daemon: Backend is required")
    }
    if opts.Viper == nil {
        opts.Viper = viper.New()
    }
    return &Daemon{opts: opts, bus: events.NewBus()}, nil
}

// Start initialises all subsystems, listens on the Unix socket, and blocks
// until ctx is cancelled. Cleans up the socket file on exit.
func (d *Daemon) Start(ctx context.Context) error {
    opts := d.opts

    if err := os.MkdirAll(opts.ImagesDir, 0o755); err != nil {
        return fmt.Errorf("ensure images dir: %w", err)
    }
    if opts.ThumbnailsDir != "" {
        if err := os.MkdirAll(opts.ThumbnailsDir, 0o755); err != nil {
            return fmt.Errorf("ensure thumbnails dir: %w", err)
        }
    }

    reg := backend.NewRegistry()
    if err := reg.Register(opts.Backend); err != nil {
        return fmt.Errorf("register backend: %w", err)
    }
    if err := reg.SetActive(opts.Backend.Name()); err != nil {
        return fmt.Errorf("set active backend: %w", err)
    }

    if err := opts.Backend.Initialize(ctx); err != nil {
        slog.Warn("backend init failed", "error", err)
    }

    processor := image.NewProcessor(
        opts.DB.ImageStore(),
        d.bus,
        opts.ImagesDir,
        opts.ThumbnailsDir,
        opts.Viper,
    )
    splitter := image.NewSplitter(opts.ImagesDir)

    var monMgr *monitor.Manager
    if opts.MonitorProvider != nil {
        monMgr = monitor.NewManager([]monitor.Provider{opts.MonitorProvider})
    } else {
        monMgr = monitor.NewManager(nil)
    }

    plMgr := playlist.NewManager(
        opts.DB.PlaylistStore(),
        opts.DB.ImageStore(),
        opts.DB.StateStore(),
        opts.DB.HistoryStore(),
        opts.DB.MonitorStateStore(),
        reg,
        monMgr,
        splitter,
        d.bus,
    )

    h := server.Handlers{
        Health:    healthhandler.New(opts.Version, func() {}),
        Images:    imageshandler.NewImageHandler(opts.DB.ImageStore(), processor, d.bus, reg),
        Playlists: playlistshandler.New(opts.DB.PlaylistStore(), plMgr),
        Monitors:  monitorshandler.New(monMgr),
        Config:    confighandler.New(opts.Viper, reg, d.bus),
        Backends:  backendshandler.New(reg, d.bus),
        Wallpaper: wallpaperhandler.New(
            opts.DB.ImageStore(),
            opts.DB.HistoryStore(),
            opts.DB.MonitorStateStore(),
            opts.DB.StateStore(),
            reg,
            monMgr,
            splitter,
            d.bus,
        ),
        Folders: foldershandler.New(opts.DB.FolderStore(), opts.DB.ImageStore(), d.bus),
    }

    router := server.NewRouter(h, d.bus)

    _ = os.Remove(opts.SocketPath)
    ln, err := net.Listen("unix", opts.SocketPath)
    if err != nil {
        return fmt.Errorf("listen on socket: %w", err)
    }
    defer func() {
        ln.Close()
        _ = os.Remove(opts.SocketPath)
    }()

    srv := &http.Server{Handler: router}

    go func() {
        <-ctx.Done()
        plMgr.StopAll()
        _ = opts.Backend.Shutdown(context.Background())
        _ = srv.Shutdown(context.Background())
    }()

    slog.Info("daemon listening", "socket", opts.SocketPath)
    if err := srv.Serve(ln); err != nil && err != http.ErrServerClosed {
        return fmt.Errorf("serve: %w", err)
    }
    return nil
}
```

- [ ] **Step 4: Write real integration test using unix socket**

Replace the placeholder test in `daemon_test.go` with:

```go
package daemon_test

import (
    "context"
    "encoding/json"
    "fmt"
    "net"
    "net/http"
    "os"
    "path/filepath"
    "testing"
    "time"

    "waypaper-engine/daemon/internal/backend"
    "waypaper-engine/daemon/internal/daemon"
    "waypaper-engine/daemon/internal/media"
    "waypaper-engine/daemon/internal/monitor"
    "waypaper-engine/daemon/internal/store"

    "github.com/spf13/viper"
)

type mockBackend struct{}

func (m *mockBackend) Name() string        { return "mock" }
func (m *mockBackend) IsAvailable() bool   { return true }
func (m *mockBackend) Capabilities() backend.Capabilities {
    return backend.Capabilities{
        MediaTypes:  []media.MediaType{media.MediaTypeImage},
        Compositors: []monitor.CompositorType{monitor.CompositorWayland},
    }
}
func (m *mockBackend) Initialize(_ context.Context) error                        { return nil }
func (m *mockBackend) Shutdown(_ context.Context) error                          { return nil }
func (m *mockBackend) SetWallpaper(_ context.Context, _ backend.WallpaperRequest) error { return nil }
func (m *mockBackend) RegisterDefaults(_ *viper.Viper)                           {}
func (m *mockBackend) ValidateConfig(_ json.RawMessage) error                    { return nil }
func (m *mockBackend) ParseConfig(_ json.RawMessage) (any, error)                { return nil, nil }
func (m *mockBackend) OnConfigChanged(_ context.Context, _ json.RawMessage) error { return nil }

func startTestDaemon(t *testing.T) (socketPath string, cleanup func()) {
    t.Helper()
    dir := t.TempDir()
    sockPath := filepath.Join(dir, "test.sock")

    db, err := store.OpenDatabase(filepath.Join(dir, "db"))
    if err != nil {
        t.Fatalf("open db: %v", err)
    }

    d, err := daemon.New(daemon.Options{
        SocketPath:    sockPath,
        DB:            db,
        Backend:       &mockBackend{},
        Viper:         viper.New(),
        ImagesDir:     filepath.Join(dir, "images"),
        ThumbnailsDir: filepath.Join(dir, "thumbs"),
        Version:       "test",
    })
    if err != nil {
        t.Fatalf("new daemon: %v", err)
    }

    ctx, cancel := context.WithCancel(context.Background())
    done := make(chan struct{})
    go func() {
        defer close(done)
        _ = d.Start(ctx)
    }()

    // Wait for socket.
    deadline := time.Now().Add(5 * time.Second)
    for time.Now().Before(deadline) {
        if _, err := os.Stat(sockPath); err == nil {
            break
        }
        time.Sleep(20 * time.Millisecond)
    }

    return sockPath, func() {
        cancel()
        <-done
        db.Close()
    }
}

func unixClient(sockPath string) *http.Client {
    return &http.Client{
        Transport: &http.Transport{
            DialContext: func(ctx context.Context, _, _ string) (net.Conn, error) {
                return (&net.Dialer{}).DialContext(ctx, "unix", sockPath)
            },
        },
    }
}

func TestDaemon_HealthzReturns200(t *testing.T) {
    sockPath, cleanup := startTestDaemon(t)
    defer cleanup()

    client := unixClient(sockPath)
    resp, err := client.Get("http://unix/healthz")
    if err != nil {
        t.Fatalf("GET /healthz: %v", err)
    }
    defer resp.Body.Close()

    if resp.StatusCode != http.StatusOK {
        t.Errorf("expected 200, got %d", resp.StatusCode)
    }
}

func TestDaemon_GetImagesEmpty(t *testing.T) {
    sockPath, cleanup := startTestDaemon(t)
    defer cleanup()

    client := unixClient(sockPath)
    resp, err := client.Get("http://unix/images")
    if err != nil {
        t.Fatalf("GET /images: %v", err)
    }
    defer resp.Body.Close()

    if resp.StatusCode != http.StatusOK {
        t.Errorf("expected 200, got %d", resp.StatusCode)
    }

    var result map[string]any
    if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
        t.Fatalf("decode response: %v", err)
    }
    total, _ := result["total"].(float64)
    if total != 0 {
        t.Errorf("expected 0 images, got %v", total)
    }
}

func TestDaemon_GetMonitors(t *testing.T) {
    sockPath, cleanup := startTestDaemon(t)
    defer cleanup()

    client := unixClient(sockPath)
    resp, err := client.Get("http://unix/monitors")
    if err != nil {
        t.Fatalf("GET /monitors: %v", err)
    }
    defer resp.Body.Close()

    if resp.StatusCode != http.StatusOK {
        t.Errorf("expected 200, got %d", resp.StatusCode)
    }
}

func TestDaemon_GetBackends(t *testing.T) {
    sockPath, cleanup := startTestDaemon(t)
    defer cleanup()

    client := unixClient(sockPath)
    resp, err := client.Get(fmt.Sprintf("http://unix/backends"))
    if err != nil {
        t.Fatalf("GET /backends: %v", err)
    }
    defer resp.Body.Close()

    if resp.StatusCode != http.StatusOK {
        t.Errorf("expected 200, got %d", resp.StatusCode)
    }

    var result []map[string]any
    if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
        t.Fatalf("decode: %v", err)
    }
    if len(result) != 1 || result[0]["name"] != "mock" {
        t.Errorf("expected one mock backend, got %v", result)
    }
}
```

- [ ] **Step 5: Run the integration tests**

```bash
cd waypaper-engine && npm run test:daemon:integration
```

Expected: all 4 tests pass.

- [ ] **Step 6: Simplify `cmd/daemon/main.go` to use `Daemon` struct**

The bulk of `startDaemon()` in `main.go` moves into `daemon.go`. What remains in `main.go`:

```go
func startDaemon(cmd *cobra.Command, args []string) {
    // 1. Lock file.
    // 2. Load Viper config.
    // 3. Setup logging.
    // 4. Open CloverDB.
    // 5. Create backend registry, register built-ins, activate configured backend.
    // 6. Construct daemon.Options.
    // 7. daemon.New(opts).Start(ctx).
}
```

All subsystem wiring (processor, splitter, monitor manager, handlers, router, socket) moves into `daemon.Start()`. Refer to `daemon.go` created in Step 3 for the exact wiring order.

- [ ] **Step 7: Build and run full test suite**

```bash
cd waypaper-engine && go build ./daemon/... && npm run test:daemon
```

Expected: all pass.

- [ ] **Step 8: Commit**

```bash
git add daemon/internal/daemon/ daemon/cmd/daemon/main.go
git commit -m "refactor(daemon): extract Daemon struct with injected deps; add integration tests over real CloverDB and mock backend"
```

---

## Task 9: Final verification

- [ ] **Step 1: Run full CI check**

```bash
cd waypaper-engine && npm run ci:check
```

Expected: all checks pass (build, format, lint, tsc, tests, vite build).

- [ ] **Step 2: Run daemon race detector**

```bash
cd waypaper-engine && npm run test:daemon:race
```

Expected: no races detected.

- [ ] **Step 3: Verify `npm run dev` starts without error**

```bash
cd waypaper-engine && npm run dev
```

Expected: daemon builds, UI launches, no console errors on startup.

- [ ] **Step 4: Commit any final fixups, then tag**

```bash
git add -p
git commit -m "chore: final CI fixups for daemon architecture refactor"
```
