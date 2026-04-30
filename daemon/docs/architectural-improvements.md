# waypaper-engine daemon — architectural and general improvements

A concise review focused on **bloat control**, **spec alignment**, **tests**, and **dead or misleading surface area**. The codebase is still evolving; use [`routes.go`](../internal/server/routes.go) and handlers as the runtime truth.

**Companion docs:** [`ARCHITECTURE.md`](./ARCHITECTURE.md) · [`openapi.yaml`](./openapi.yaml) · human prose [API_CONTRACT.md](../API_CONTRACT.md)

---

## 1. Spec and documentation drift (highest impact)

1. **Missing from `API_CONTRACT.md` (as of the OpenAPI pass)** — these exist in `routes.go` and are now listed in `openapi.yaml`:
   - `POST /images/import-web`
   - `POST /images/{id}/ensure-browser-preview`
   - `POST /images/{id}/video-loop-export`  
   **Action:** Add sections to `API_CONTRACT.md` (request/response, errors, async notes) and keep examples in sync with `internal/handler`.

2. **`openapi.yaml` uses `GenericJSON` placeholders** for most bodies/responses.  
   **Action:** Over time, extract **shared DTOs** from `internal/handler` / `internal/store` into `components/schemas` (or use `oapi-codegen` / `ogen` to generate from OpenAPI, if you commit to spec-first). Prefer one direction: spec-first *or* generate OpenAPI from Go structs (e.g. `swag`, custom reflect), but avoid four parallel definitions.

3. **Version field** in `openapi.yaml` is decoupled from the daemon build (`main.version` / `GET /info`).  
   **Action:** Document or automate bump (CI check that `info.version` matches `GET /info` in release builds, or remove version from `info` and rely on `/info` only).

---

## 2. Tests — reduce noise, not coverage

| Issue | Suggestion |
|--------|------------|
| **`internal/store/store_test.go`** — many distinct `TestImageStore_*` functions | Consider **table-driven** tests where scenarios share setup (list/pagination, filters). Merge only when it improves readability; do **not** delete assertions that protect Clover query behavior. |
| **`playlist/compat_test.go`** | Name suggests “legacy.” It tests `findCompatibleIndex` and playlist/backend rules — **rename** to e.g. `find_compatible_index_test.go` with `TestFindCompatibleIndex_*` only, or a single table-driven `TestFindCompatibleIndex`. |
| **Packages with `no test files`** | `internal/backend/feh`, `hyprpaper`, `internal/config` are candidates for small **smoke tests** (constructor + capabilities) *or* explicit `//` note that they are thin wrappers—avoid both zero tests and silent untested code paths. |
| **`test:daemon:integration` → `go test ./test/...`** | If `./daemon/test` is **empty** or missing, the script is a **no-op** or fails depending on `go` version. **Either** add real HTTP-over-socket tests **or** remove/rename the npm script until integration tests exist. |
| **Duplicate patterns** in `handler/helpers_test.go` / similar | Use shared `assertX` helpers only if it reduces line count without hiding failures. |
| **High value — keep** | SSE tests (`internal/server/sse_test.go`), `events` bus tests, `waylandutauri` client/mapping tests, `pathsecure` tests, playlist scheduler tests. |

**Principle:** Shrink test **lines** and **file count** by consolidation; do not strip tests whose failure would catch a production bug. Run **`go test -short ./...`**, then **`go test -cover ./...`** and focus deletion/consolidation on **stable, pure** packages first.

---

## 3. Dead code and lint candidates

- Run **periodically** (or in CI if fast enough): `staticcheck ./...`, and consider `deadcode` / `unparam` on `daemon/` to find unused exports and dead branches.
- Grep for **`TODO` / `FIXME`** in `internal/` and either resolve or move to a tracked list (avoid orphan TODOs in hot paths).
- **Unused public identifiers:** after refactors, run `golangci-lint` or `staticcheck` with unused checks—internal packages still accumulate dead methods.

---

## 4. API surface and handler shape

- **One handler package** (`internal/handler`) is large. Optional future **split** by tag (`handler/images.go` already): ensure each file stays a **cohesive** slice (images vs playlists) without circular imports. Not urgent if navigation is already split by file.
- **Error JSON** is documented in `API_CONTRACT.md`; **standardize** on a single `writeAPIError` (or similar) with stable `code` where clients branch—see wal-utauri’s lesson on stringly HTTP errors.

---

## 5. npm / CI scripts

- Align `test:daemon:integration` with reality (add tests or change script).
- Consider **`test:daemon:short`** as default in pre-commit, full suite in CI (already have `-short` in `test:daemon:unit` from repo root `waypaper-engine`).

---

## 6. Suggested execution order (see `plan.md`)

1. Fix **API_CONTRACT** gap for the three `POST /images/...` routes.  
2. **Validate** `openapi.yaml` in CI (e.g. `npx @redocly/cli lint` or `swagger-cli validate`) to catch YAML/structure issues.  
3. **Triage tests:** rename `compat_test`, consider table-driven merges in `store_test` (incremental).  
4. **Integration test story:** add `daemon/test` or remove broken npm target.  
5. **Deeper spec:** replace `GenericJSON` in OpenAPI with real schemas in stages (images first, then wallpaper, then playlists).  
6. **staticcheck** in CI (optional) on `daemon/`.

---

---

## 8. Deepening opportunities (2026-04-29 pass)

Four candidates surfaced during the post-control-plane architecture review. Candidate 5 (event payload normalization) is being worked now; the rest are queued.

### 8.1 Split root `handler` package into sub-packages

**Files:** `internal/handler/images.go`, `playlists.go`, `wallpaper.go`, `folders.go`, `monitors.go`, `health.go`

**Problem:** `confighandler` and `backendshandler` are already isolated sub-packages with their own tests. The remaining five handlers share a flat `handler` namespace — every test file can see every handler's internals, and `main.go` wires a flat list of nine constructors with no grouping. Seams between handlers are invisible.

**Solution:** Move each handler into its own sub-package (`imageshandler`, `wallpaperhandler`, `playlistshandler`, `foldershandler`, `monitorshandler`, `healthhandler`). Mechanical split; no behavior changes.

**Benefits:** Each handler's constructor seam is explicitly bounded. Test isolation improves. `main.go` imports declare what each route group needs. Locality: a bug in folder recursion lives entirely in `foldershandler`.

---

### 8.2 Extract monitor resolution policy out of `WallpaperHandler`

**Files:** `internal/handler/wallpaper.go:274–328`, `internal/handler/playlists.go`

**Problem:** `WallpaperHandler.resolveMonitors()` and `ensureBackendForMedia()` contain real policy — `”*”` expansion, priority-based backend selection, fallback rules. The same logic likely needs to be applied by playlists. Each handler re-implements or silently ignores edge cases. Policy that should be in one place is scattered across callers.

**Solution:** Lift monitor resolution and backend-for-media selection into `internal/wallpaper` (which already owns `Apply` and `Restore`). `WallpaperHandler` and `PlaylistHandler` become adapters over this policy.

**Benefits:** One place to test monitor expansion. Adding a new fallback rule touches one function. The question “what monitor does this wallpaper apply to?” is answered in one package.

---

### 8.3 Extract web-capabilities sync from `ImageHandler.Update`

**Files:** `internal/handler/images.go:207–350`

**Problem:** `Update` is ~140 lines of mixed concerns: field-whitelist validation, web-meta merging, manifest writes, and renderer sync — all inline. The web-capabilities sync path (read manifest → merge → write → publish event) has no seam. Any future caller needing capability sync (e.g., post-import) must duplicate or import from a handler.

**Solution:** Extract the web-capabilities sync path into a function or small module in `internal/image` alongside `Processor`. The `Update` handler becomes: validate fields → save image → (if web) sync capabilities → done.

**Benefits:** Sync logic is independently testable. Manifest merging lives in one function. The handler is easier to read. Future callers reuse the same sync path.

---

### 8.4 Narrow OpenAPI `GenericJSON` and align `daemon-go-types.ts`

**Files:** `electron/daemon-go-types.ts`, `daemon/docs/openapi.yaml`, `electron/daemonClient/imagesClient.ts`, `playlistsClient.ts`, `wallpaperClient.ts`

**Problem:** Config/backend types are already concrete. Images, playlists, and wallpaper routes still use `GenericJSON` in OpenAPI and rely on manually-maintained TS types that can silently drift from Go structs. Type mismatches surface only at runtime.

**Solution:** Replace `GenericJSON` with concrete schemas in OpenAPI for each remaining route group (images first, then playlists, then wallpaper). Align `daemon-go-types.ts` against those schemas. Documentation + type alignment pass, not a code change.

**Benefits:** TS clients get compile-time guarantees when types drift. OpenAPI becomes a usable contract for tooling. The Go ↔ TypeScript seam is explicit.

---

## 7. What not to do in a “cleanup” pass

- Do **not** remove **vendored** or **platform-specific** backend code just because a developer’s machine has no feh/hyprpaper.  
- Do **not** delete **Clover** or image pipeline tests to speed CI unless those tests are provably duplicate.
