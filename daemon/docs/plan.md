# waypaper-engine daemon — execution plan (agents)

Use this checklist to **shrink bloat**, **align docs**, and **harden the API story** without breaking the product. Work from **`waypaper-engine/`** (npm scripts) and **`waypaper-engine/daemon/`** (Go module).

**Constraints**

- `internal/server/routes.go` is the **authoritative** route list until OpenAPI is generated from the same source.
- Breaking JSON changes: coordinate with the **Electron** client and any other callers.
- Verify: `cd waypaper-engine/daemon && go test -short ./...` and from repo root `npm run test:daemon:unit` (or `test:daemon` for full run).

---

## Phase 0 — Baseline (no refactors)

1. `cd waypaper-engine/daemon && go test -short ./...` — record any flake or slow package.
2. `cd waypaper-engine/daemon && go test -cover ./...` — note coverage % per package; flag packages at 0% with non-trivial code.
3. If `./test` is missing, confirm `npm run test:daemon:integration` from `waypaper-engine` — fix or document (see `architectural-improvements.md` §2).

**Done when:** Baseline is green; integration script behavior is known.

---

## Phase 1 — Spec alignment (human + machine)

1. **API_CONTRACT.md** — add full sections for:
   - `POST /images/import-web`
   - `POST /images/{id}/ensure-browser-preview`
   - `POST /images/{id}/video-loop-export`  
   Match handler signatures and real status codes (read the Go handler code).
2. **openapi.yaml** — ensure paths, methods, and `operationId` values still match `routes.go` after any handler rename.
3. **Optional:** Add CI step to **lint OpenAPI** (Redocly/Spectral/swagger-cli) on `daemon/docs/openapi.yaml`.

**Done when:** No documented route in `routes.go` is missing from both `API_CONTRACT.md` and `openapi.yaml`.

---

## Phase 2 — OpenAPI depth (incremental)

1. Pick **one** area (e.g. **wallpaper** `POST /wallpaper/set` or **errors**).  
2. Extract **concrete** `components/schemas` in `openapi.yaml` from the actual struct JSON tags.  
3. If adopting **codegen** for the Electron client or a future SDK, consider generating **TypeScript** types from the same file—*only* after schemas are real, not `GenericJSON`.

**Done when:** At least one tag group has non-placeholder schemas; CI still passes.

---

## Phase 3 — Test suite hygiene

1. **Rename** `internal/playlist/compat_test.go` → a name that reflects `findCompatibleIndex` (or fold into a single file with a clear name).
2. **`store_test`:** group **table-driven** subtests for repeated patterns (e.g. pagination + filter permutations) **without** removing distinct edge cases.  
3. Grep for **identical** test setup (temp DB) — extract small helpers in `testutil` if duplication exceeds ~5 copy-pastes.  
4. Re-run `go test -short ./...` and ensure **count** and **time** are acceptable for CI.

**Done when:** Renames and consolidations are merged; test failures still pinpoint behavior.

---

## Phase 4 — Tooling and dead code

1. `cd waypaper-engine/daemon && staticcheck ./...` — fix or suppress with justification.  
2. Run **`deadcode`** (or `go tool` equivalent) and remove truly unused unexported code; for unused exports, confirm no `//go:build` or plugin use.  
3. Address or ticket **`TODO`/`FIXME`** in touched packages.

**Done when:** staticcheck is clean; deadcode PR is small and reviewable.

---

## Phase 5 — Integration tests (or script fix)

1. **Either** add `daemon/test/...` with a minimal test that boots the **router** and hits **GET /healthz** over an in-memory or temp socket **or** change `test:daemon:integration` to a no-op with a log line / remove from `ci:check` if unused.  
2. Document the decision in `ARCHITECTURE.md` (“Testing layout” section).

**Done when:** `npm run test:daemon:integration` is honest.

---

## Final verification (every PR touching daemon)

```bash
cd /home/obsy/dev/waypaper/waypaper-engine/daemon
go test -short ./...
go build -o /dev/null ./cmd/daemon
```

From `waypaper-engine/`:

```bash
npm run test:daemon:unit
# optional full:
npm run test:daemon
```

---

## PR boundaries

| PR | Content |
|----|---------|
| 1 | Phase 1 (API_CONTRACT + OpenAPI path parity + CI lint optional) |
| 2 | Phase 3 (test renames + table-driven, no behavior change) |
| 3 | Phase 2 (schemas for one tag group) |
| 4 | Phase 4 (staticcheck / deadcode) |
| 5 | Phase 5 (integration or npm script) |

Phases 2 and 3 can be parallel if different authors; Phase 1 should land first so docs stay consistent.
