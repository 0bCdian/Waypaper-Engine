# Hue Filter Strip + Rainbow Sort Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** One-click hue filter strip (12 hue groups + neutral) in the gallery filter bar, plus a "Rainbow" sort mode, both computed daemon-side from the stored per-image k-means palette.

**Architecture:** Hue group is derived on the fly from `Image.Colors` (hexes ordered by dominance) inside the daemon's existing in-memory query path in `imageStore.GetAll`. New `hue_group` query param + `sort_by=hue`. Client adds `hueGroup` to `Filters`, a 5th sort-cycle state, and a `HueFilterStrip` component in the filter bar.

**Tech Stack:** Go 1.26 (daemon, testify), React 19 + TypeScript + Zustand (renderer, vitest), Tailwind/DaisyUI.

## Global Constraints

- Work in worktree `/home/obsy/dev/waypaper/.worktrees/waypaper-engine-hue` on branch `feat/hue-filter-rainbow-sort`. All paths below are relative to that directory.
- TDD: write the failing test first, watch it fail, then implement. Commit after each green cycle.
- Package manager is **pnpm only** (never npm/npx). Go tests: `pnpm run test:daemon:unit` or targeted `go test` from `daemon/`.
- Formatters: gofmt for Go (`pnpm run gofmt:check`), oxfmt/oxlint for TS (`pnpm run format:check && pnpm run lint:check`). Match surrounding code style exactly; no drive-by refactors.
- Hue group domain: integers **0–11** (30° buckets, red-centered) and **99** (neutral). Chromatic swatch thresholds: saturation ≥ **0.18**, lightness in **[0.12, 0.92]** (HSL).
- No compatibility shims; the daemon HTTP contract may change freely but must be reflected in `daemon/API_CONTRACT.md`.

---

### Task 1: Hue bucketing in the `cielab` package (Go)

**Files:**
- Create: `daemon/internal/cielab/hue.go`
- Test: `daemon/internal/cielab/hue_test.go`

**Interfaces:**
- Consumes: `hexToRGB(hex string) (r, g, b uint8, ok bool)` — already exists unexported in `daemon/internal/cielab/cielab.go:102`.
- Produces (used by Task 2):
  - `const NeutralHueGroup = 99`
  - `func HueGroupFromPalette(swatches []string) int` — group of the first chromatic swatch, else `NeutralHueGroup`.
  - `func HueSortKey(swatches []string) (group int, saturation float64)` — same group plus the winning swatch's HSL saturation (neutral → `(99, 0)`).

- [ ] **Step 1: Write the failing test**

Create `daemon/internal/cielab/hue_test.go`:

```go
package cielab

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestHueGroupFromPalette(t *testing.T) {
	tests := []struct {
		name     string
		swatches []string
		want     int
	}{
		{"pure red", []string{"#ff0000"}, 0},
		{"red wraps high hue (350deg)", []string{"#ff002b"}, 0},   // hue ≈ 350
		{"orange (30deg)", []string{"#ff8000"}, 1},                 // hue ≈ 30
		{"yellow (60deg)", []string{"#ffff00"}, 2},                 // hue = 60
		{"green (120deg)", []string{"#00ff00"}, 4},                 // hue = 120
		{"cyan (180deg)", []string{"#00ffff"}, 6},                  // hue = 180
		{"blue (240deg)", []string{"#0000ff"}, 8},                  // hue = 240
		{"magenta (300deg)", []string{"#ff00ff"}, 10},              // hue = 300
		{"pink (330deg)", []string{"#ff0080"}, 11},                 // hue = 330
		{"dominance order wins: first chromatic swatch", []string{"#0000ff", "#ff0000"}, 8},
		{"skips achromatic dominant swatch", []string{"#808080", "#ff0000"}, 0},
		{"skips near-black swatch", []string{"#160505", "#00ff00"}, 4}, // lightness < 0.12
		{"skips near-white swatch", []string{"#fdf3f2", "#00ff00"}, 4}, // lightness > 0.92
		{"all gray is neutral", []string{"#111111", "#808080", "#eeeeee"}, NeutralHueGroup},
		{"empty palette is neutral", nil, NeutralHueGroup},
		{"invalid hex skipped", []string{"nope", "#00ff00"}, 4},
		{"only invalid hex is neutral", []string{"zzz"}, NeutralHueGroup},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			assert.Equal(t, tt.want, HueGroupFromPalette(tt.swatches))
		})
	}
}

func TestHueSortKey(t *testing.T) {
	g, s := HueSortKey([]string{"#ff0000"})
	assert.Equal(t, 0, g)
	assert.InDelta(t, 1.0, s, 0.001) // pure red: HSL saturation 1

	g, s = HueSortKey([]string{"#808080"})
	assert.Equal(t, NeutralHueGroup, g)
	assert.Equal(t, 0.0, s)

	// Muted but chromatic red (#b06060: sat ≈ 0.34) still lands in group 0 with its own saturation.
	g, s = HueSortKey([]string{"#b06060"})
	assert.Equal(t, 0, g)
	assert.Greater(t, s, 0.18)
	assert.Less(t, s, 0.6)
}
```

- [ ] **Step 2: Run test to verify it fails**

Run from `daemon/`: `go test ./internal/cielab/ -run 'TestHueGroupFromPalette|TestHueSortKey' -v`
Expected: FAIL — `undefined: HueGroupFromPalette`, `undefined: NeutralHueGroup`, `undefined: HueSortKey`.

- [ ] **Step 3: Write the implementation**

Create `daemon/internal/cielab/hue.go`:

```go
package cielab

import "math"

// NeutralHueGroup is the hue group for palettes with no chromatic swatch
// (grayscale / near-black / near-white images).
const NeutralHueGroup = 99

// Chromatic swatch thresholds (HSL). A swatch below the saturation floor or
// outside the lightness band reads as neutral to the eye and is skipped when
// picking the palette's representative hue.
const (
	minChromaticSaturation = 0.18
	minChromaticLightness  = 0.12
	maxChromaticLightness  = 0.92
)

// HueGroupFromPalette returns the 30°-bucket hue group (0-11, red-centered:
// hue >= 345° or < 15° → 0) of the first chromatic swatch in dominance order,
// or NeutralHueGroup when no swatch qualifies. Invalid hexes are skipped.
func HueGroupFromPalette(swatches []string) int {
	group, _ := HueSortKey(swatches)
	return group
}

// HueSortKey returns the hue group plus the winning swatch's HSL saturation,
// for rainbow ordering (group asc, saturation desc). Neutral → (99, 0).
func HueSortKey(swatches []string) (int, float64) {
	for _, hex := range swatches {
		r, g, b, ok := hexToRGB(hex)
		if !ok {
			continue
		}
		h, s, l := rgbToHSL(r, g, b)
		if s < minChromaticSaturation || l < minChromaticLightness || l > maxChromaticLightness {
			continue
		}
		return hueBucket(h), s
	}
	return NeutralHueGroup, 0
}

// hueBucket maps a hue in [0, 360) to a red-centered 30° bucket: shifting by
// +15° makes [345, 360)∪[0, 15) land in bucket 0.
func hueBucket(h float64) int {
	shifted := math.Mod(h+15, 360)
	return int(shifted/30) % 12
}

func rgbToHSL(r, g, b uint8) (h, s, l float64) {
	rf := float64(r) / 255
	gf := float64(g) / 255
	bf := float64(b) / 255
	max := math.Max(rf, math.Max(gf, bf))
	min := math.Min(rf, math.Min(gf, bf))
	l = (max + min) / 2
	d := max - min
	if d == 0 {
		return 0, 0, l
	}
	if l > 0.5 {
		s = d / (2 - max - min)
	} else {
		s = d / (max + min)
	}
	switch max {
	case rf:
		h = math.Mod((gf-bf)/d, 6)
	case gf:
		h = (bf-rf)/d + 2
	default:
		h = (rf-gf)/d + 4
	}
	h *= 60
	if h < 0 {
		h += 360
	}
	return h, s, l
}
```

- [ ] **Step 4: Run test to verify it passes**

Run from `daemon/`: `go test ./internal/cielab/ -v`
Expected: PASS (all, including pre-existing cielab tests).

- [ ] **Step 5: gofmt + commit**

```bash
gofmt -l daemon/internal/cielab/   # expect no output
git add daemon/internal/cielab/hue.go daemon/internal/cielab/hue_test.go
git commit -m "feat(daemon): hue-group bucketing from stored palette in cielab"
```

---

### Task 2: `hue_group` filter + `sort_by=hue` in store and handler (Go) + API contract

**Files:**
- Modify: `daemon/internal/store/store.go` (ImageQueryOpts, ~line 40-60)
- Modify: `daemon/internal/store/image_store_impl.go` (GetAll ~line 72-116, helpers at end of file)
- Modify: `daemon/internal/handler/imageshandler/images.go` (List, ~line 78-120; swagger comments ~line 66-71)
- Modify: `daemon/API_CONTRACT.md` (GET /images params table, ~line 106-112)
- Test: `daemon/internal/store/store_test.go` (append; model on `TestImageStore_GetAll_ColorsNear` at line 79 for harness/seeding)
- Test: `daemon/internal/handler/imageshandler/images_hue_test.go` (create)

**Interfaces:**
- Consumes (Task 1): `cielab.HueGroupFromPalette(swatches []string) int`, `cielab.HueSortKey(swatches []string) (int, float64)`, `cielab.NeutralHueGroup`.
- Produces (used by Tasks 3/4 over HTTP): `GET /images?hue_group=<0-11|99>` filter; `GET /images?sort_by=hue&sort_order=asc|desc` rainbow ordering. Invalid `hue_group` → 400 `{"error":"invalid hue_group"}`.

- [ ] **Step 1: Write failing store tests**

Append to `daemon/internal/store/store_test.go` (reuse the file's existing helpers for creating the store and seeding images — read `TestImageStore_GetAll_ColorsNear` first and copy its setup style, seeding images whose `Colors` fields are set as below):

```go
func TestImageStore_GetAll_HueGroupFilter(t *testing.T) {
	// Seed three images (same helper style as TestImageStore_GetAll_ColorsNear):
	//   "red"  → Colors: []string{"#ff0000", "#808080"}
	//   "blue" → Colors: []string{"#0000ff"}
	//   "gray" → Colors: []string{"#808080"}
	// Then:
	red := 0
	res, err := is.GetAll(ctx, store.ImageQueryOpts{HueGroup: &red, Page: 1, PerPage: 50})
	require.NoError(t, err)
	require.Len(t, res.Data, 1)
	assert.Equal(t, "red", res.Data[0].Name)

	neutral := 99
	res, err = is.GetAll(ctx, store.ImageQueryOpts{HueGroup: &neutral, Page: 1, PerPage: 50})
	require.NoError(t, err)
	require.Len(t, res.Data, 1)
	assert.Equal(t, "gray", res.Data[0].Name)
}

func TestImageStore_GetAll_SortByHue(t *testing.T) {
	// Seed four images in this insertion order (so imported_at/id order differs from hue order):
	//   "gray"      → Colors: []string{"#808080"}
	//   "blue"      → Colors: []string{"#0000ff"}          // group 8, sat 1.0
	//   "mutedred"  → Colors: []string{"#b06060"}          // group 0, sat ≈ 0.34
	//   "vividred"  → Colors: []string{"#ff0000"}          // group 0, sat 1.0
	res, err := is.GetAll(ctx, store.ImageQueryOpts{SortBy: "hue", SortOrder: "asc", Page: 1, PerPage: 50})
	require.NoError(t, err)
	require.Len(t, res.Data, 4)
	// Rainbow asc: group 0 (vivid before muted red), then group 8, neutral last.
	assert.Equal(t, "vividred", res.Data[0].Name)
	assert.Equal(t, "mutedred", res.Data[1].Name)
	assert.Equal(t, "blue", res.Data[2].Name)
	assert.Equal(t, "gray", res.Data[3].Name)

	// desc reverses group order but neutral stays last.
	res, err = is.GetAll(ctx, store.ImageQueryOpts{SortBy: "hue", SortOrder: "desc", Page: 1, PerPage: 50})
	require.NoError(t, err)
	require.Len(t, res.Data, 4)
	assert.Equal(t, "blue", res.Data[0].Name)
	assert.Equal(t, "vividred", res.Data[1].Name)
	assert.Equal(t, "mutedred", res.Data[2].Name)
	assert.Equal(t, "gray", res.Data[3].Name)
}
```

(The comment lines describe seeding you must write with the file's real helper functions — read the existing tests and use the same creation calls; do not invent new helpers.)

- [ ] **Step 2: Run tests to verify they fail**

From `daemon/`: `go test ./internal/store/ -run 'HueGroup|SortByHue' -v`
Expected: FAIL — `unknown field HueGroup in struct literal` (compile error).

- [ ] **Step 3: Implement store support**

In `daemon/internal/store/store.go`, inside `ImageQueryOpts`, after the `SortBy` field update its doc comment and add `HueGroup` after `ColorsNear`:

```go
	// Sort field: "name", "imported_at", "file_size", or "hue" (rainbow:
	// hue group asc/desc, neutral last, saturation desc within a group).
	SortBy string
```

```go
	// HueGroup filters to images whose palette's dominant chromatic swatch
	// falls in this 30° hue bucket (0-11) or cielab.NeutralHueGroup (99).
	// Computed on the fly from Colors; forces the in-memory filter path.
	HueGroup *int
```

In `daemon/internal/store/image_store_impl.go`:

1. Add `"github.com/..."`-style import of the cielab package matching the existing import in the same module (see `filterImagesByColorsNear` which already uses `cielab` — the import already exists; verify).

2. Replace the sort-field block (currently lines ~72-79):

```go
	sortField := "imported_at"
	if opts.SortBy != "" && opts.SortBy != "hue" {
		sortField = opts.SortBy
	}
	sortDir := -1
	if strings.ToLower(opts.SortOrder) == "asc" {
		sortDir = 1
	}
	// Rainbow sort happens in memory; pin the DB pre-sort to newest-first so
	// in-group ties resolve to imported_at desc via the stable sort below.
	if opts.SortBy == "hue" {
		sortDir = -1
	}
```

3. Extend the in-memory path condition:

```go
	if opts.Search != "" || filterRootFolder || len(opts.ColorsNear) > 0 || opts.PaletteSimilarTo != nil || opts.HueGroup != nil || opts.SortBy == "hue" {
```

4. Inside that branch, after the `PaletteSimilarTo` filter block and before `return Paginate(...)`:

```go
	if opts.HueGroup != nil {
		allImages = filterImagesByHueGroup(allImages, *opts.HueGroup)
	}
	if opts.SortBy == "hue" {
		sortImagesByHue(allImages, strings.ToLower(opts.SortOrder) == "desc")
	}
```

5. Append helpers at the end of the file, next to `filterImagesByColorsNear`:

```go
// filterImagesByHueGroup keeps images whose palette maps to the given hue group.
func filterImagesByHueGroup(images []Image, group int) []Image {
	filtered := make([]Image, 0, len(images))
	for _, im := range images {
		if cielab.HueGroupFromPalette(im.Colors) == group {
			filtered = append(filtered, im)
		}
	}
	return filtered
}

// sortImagesByHue orders images rainbow-style: hue group ascending (or
// descending), neutral group always last, most-saturated first within a
// group. Stable, so the caller's imported_at pre-sort breaks remaining ties.
func sortImagesByHue(images []Image, desc bool) {
	type hueKey struct {
		group int
		sat   float64
	}
	keys := make(map[int]hueKey, len(images))
	for _, im := range images {
		g, s := cielab.HueSortKey(im.Colors)
		keys[im.ID] = hueKey{group: g, sat: s}
	}
	sort.SliceStable(images, func(i, j int) bool {
		a, b := keys[images[i].ID], keys[images[j].ID]
		if a.group != b.group {
			if a.group == cielab.NeutralHueGroup {
				return false
			}
			if b.group == cielab.NeutralHueGroup {
				return true
			}
			if desc {
				return a.group > b.group
			}
			return a.group < b.group
		}
		return a.sat > b.sat
	})
}
```

(Add `"sort"` to imports if not present.)

- [ ] **Step 4: Run store tests**

From `daemon/`: `go test ./internal/store/ -v -short`
Expected: PASS (new tests plus all pre-existing ones).

- [ ] **Step 5: Write failing handler test**

Create `daemon/internal/handler/imageshandler/images_hue_test.go`:

```go
package imageshandler

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestParseHueGroupParam(t *testing.T) {
	tests := []struct {
		raw    string
		want   int
		wantOK bool
	}{
		{"0", 0, true},
		{"11", 11, true},
		{"99", 99, true},
		{" 5 ", 5, true},
		{"12", 0, false},
		{"-1", 0, false},
		{"98", 0, false},
		{"abc", 0, false},
		{"", 0, false},
	}
	for _, tt := range tests {
		t.Run(tt.raw, func(t *testing.T) {
			got, ok := parseHueGroupParam(tt.raw)
			assert.Equal(t, tt.wantOK, ok)
			if tt.wantOK {
				assert.Equal(t, tt.want, got)
			}
		})
	}
}
```

Run from `daemon/`: `go test ./internal/handler/imageshandler/ -run TestParseHueGroupParam -v`
Expected: FAIL — `undefined: parseHueGroupParam`.

- [ ] **Step 6: Implement handler support**

In `daemon/internal/handler/imageshandler/images.go`:

1. Next to `parseColorsNearQuery` (~line 825), add:

```go
// parseHueGroupParam validates the hue_group query value: 0-11 or 99.
func parseHueGroupParam(raw string) (int, bool) {
	v, err := strconv.Atoi(strings.TrimSpace(raw))
	if err != nil {
		return 0, false
	}
	if (v >= 0 && v <= 11) || v == 99 {
		return v, true
	}
	return 0, false
}
```

2. In `List`, after the `colors_near` block (~line 101):

```go
	if hg := strings.TrimSpace(q.Get("hue_group")); hg != "" {
		v, ok := parseHueGroupParam(hg)
		if !ok {
			httpjson.WriteError(w, http.StatusBadRequest, "invalid hue_group")
			return
		}
		opts.HueGroup = &v
	}
```

3. Update the swagger comment block above `List` — extend the `sort_by` param description to mention `hue` and add:

```go
// @Param        hue_group             query     int     false  "Hue group filter: 0-11 (30° buckets, red-centered) or 99 (neutral)"
```

- [ ] **Step 7: Run handler tests**

From `daemon/`: `go test ./internal/handler/imageshandler/ -v -short`
Expected: PASS.

- [ ] **Step 8: Update API contract**

In `daemon/API_CONTRACT.md`, GET /images parameter table (~line 106): change the `sort_by` row's allowed values to `name`, `imported_at`, `file_size`, `hue` and add a row after `colors_near`:

```markdown
| `hue_group`   | int    | —             | Hue group filter: 0–11 (30° buckets, red-centered) or 99 (neutral); computed from the stored palette; forces in-memory filter path |
```

Also note next to `sort_by`: `hue` = rainbow order (hue group asc/desc, neutral last, saturation desc within group; in-memory).

- [ ] **Step 9: Full daemon unit pass, gofmt, commit**

```bash
pnpm run test:daemon:unit
pnpm run gofmt:check
git add daemon/internal/store/ daemon/internal/handler/imageshandler/ daemon/API_CONTRACT.md
git commit -m "feat(daemon): hue_group filter and sort_by=hue rainbow ordering on GET /images"
```

---

### Task 3: Client filter model — types, param mapping, persistence (TS)

**Files:**
- Modify: `electron/daemon-go-types.ts` (`ImageQueryParams`, ~line 33-47)
- Modify: `src/types/rendererTypes.ts` (`Filters`, line 22-33)
- Modify: `src/utils/galleryFilterTokens.ts` (`mapFiltersToImageQueryParams` line 145-180, `galleryHasActiveFilters` line 243-250)
- Modify: `src/utils/galleryFilterStorage.ts` (`defaultGalleryFilters` line 41-51, `migrateFromLegacyV1` return line 104-113, `normalizeV2` line 123-163)
- Test: `src/utils/__tests__/galleryFilterTokens.test.ts` (append)

**Interfaces:**
- Consumes (Task 2 wire format): `hue_group` query param (0–11 | 99), `sort_by: "hue"`.
- Produces (used by Task 4):
  - `Filters.hueGroup: number | null` and `Filters.type: "name" | "id" | "hue"` — every construction site of `Filters` compiles with the new field.
  - `mapFiltersToImageQueryParams` emits `hue_group` and `sort_by`.
  - `galleryHasActiveFilters` returns true when `hueGroup != null`.

- [ ] **Step 1: Write failing tests**

Append to `src/utils/__tests__/galleryFilterTokens.test.ts` (read the file first and reuse its existing helper for building a `Filters` object if one exists; otherwise build literals including ALL current fields plus `hueGroup`):

```ts
describe("hue group filter mapping", () => {
  const baseFilters = {
    order: "desc" as const,
    type: "id" as const,
    mediaType: "all" as const,
    filterTokens: [] as string[],
    paletteSimilarToId: null,
    paletteSimilarMaxDeltaE: 18,
    hueGroup: null as number | null,
  };

  it("omits hue_group when null", () => {
    const params = mapFiltersToImageQueryParams(baseFilters);
    expect(params.hue_group).toBeUndefined();
  });

  it("emits hue_group when set", () => {
    const params = mapFiltersToImageQueryParams({ ...baseFilters, hueGroup: 4 });
    expect(params.hue_group).toBe(4);
  });

  it("emits neutral group 99", () => {
    const params = mapFiltersToImageQueryParams({ ...baseFilters, hueGroup: 99 });
    expect(params.hue_group).toBe(99);
  });

  it("maps type hue to sort_by hue", () => {
    const params = mapFiltersToImageQueryParams({ ...baseFilters, type: "hue", order: "asc" });
    expect(params.sort_by).toBe("hue");
    expect(params.sort_order).toBe("asc");
  });
});
```

Run: `pnpm vitest run src/utils/__tests__/galleryFilterTokens.test.ts`
Expected: FAIL (type errors / missing `hue_group`).

- [ ] **Step 2: Implement type + mapping changes**

`electron/daemon-go-types.ts`, in `ImageQueryParams` after `colors_near`:

```ts
  /** Hue group filter: 0-11 (30° buckets, red-centered) or 99 (neutral). */
  hue_group?: number;
```

`src/types/rendererTypes.ts`, in `Filters`:

```ts
  type: "name" | "id" | "hue";
```

and after `paletteSimilarMaxDeltaE`:

```ts
  /** Hue group filter for the swatch strip: 0-11 or 99 (neutral); null = off. */
  hueGroup: number | null;
```

`src/utils/galleryFilterTokens.ts`:
- `mapFiltersToImageQueryParams` `Pick<...>` gains `| "hueGroup"`.
- `sort_by` line becomes:

```ts
    sort_by: filters.type === "name" ? "name" : filters.type === "hue" ? "hue" : "imported_at",
```

- After the `paletteSimilarToId` block:

```ts
  if (filters.hueGroup != null) {
    out.hue_group = filters.hueGroup;
  }
```

- In `galleryHasActiveFilters`, after the `paletteSimilarToId` check:

```ts
  if (filters.hueGroup != null) return true;
```

`src/utils/galleryFilterStorage.ts`:
- `defaultGalleryFilters()` return gains `hueGroup: null,`.
- `migrateFromLegacyV1` return gains `hueGroup: null,`.
- `normalizeV2`: the `type` check becomes `f.type === "name" || f.type === "id" || f.type === "hue" ? f.type : base.type`; add before the return:

```ts
  const hg = f.hueGroup;
  const hueGroup =
    typeof hg === "number" && Number.isInteger(hg) && ((hg >= 0 && hg <= 11) || hg === 99)
      ? hg
      : null;
```

and `hueGroup,` in the returned object.

- [ ] **Step 3: Fix remaining compile errors**

Run: `pnpm exec tsc --noEmit -p tsconfig.json` (or `pnpm run ci:check`'s typecheck step). Any other site constructing a full `Filters` literal must add `hueGroup: null`. Do NOT change behavior anywhere else.

- [ ] **Step 4: Run tests**

Run: `pnpm vitest run src/utils/__tests__/galleryFilterTokens.test.ts`
Expected: PASS. Then `pnpm vitest run` (whole suite) — PASS.

- [ ] **Step 5: Format, lint, commit**

```bash
pnpm run format:check && pnpm run lint:check
git add electron/daemon-go-types.ts src/types/rendererTypes.ts src/utils/galleryFilterTokens.ts src/utils/galleryFilterStorage.ts src/utils/__tests__/galleryFilterTokens.test.ts
# plus any files fixed in Step 3
git commit -m "feat(renderer): hueGroup filter + hue sort in gallery filter model"
```

---

### Task 4: UI — HueFilterStrip component + Rainbow in the sort cycle

**Files:**
- Create: `src/components/HueFilterStrip.tsx`
- Modify: `src/components/Filters.tsx` (SORT_CYCLE lines 51-65, `PartialFilters` lines 28-42, `clearAll` lines 205-222, render block ~line 359-387)
- Modify: `src/hooks/useFilteredImages.ts` (lines 17-20)
- Test: `src/components/__tests__/HueFilterStrip.test.tsx` (create; check `src/components/__tests__/` for the existing component-test setup and mimic it — if the directory has no comparable store-driven component test, a pure unit test of the exported `HUE_GROUPS` constant + toggle handler contract is acceptable)

**Interfaces:**
- Consumes (Task 3): `useImagesStore` `filters.hueGroup`, `setFilters`, `fetchPage`.
- Produces: `<HueFilterStrip />` default export, rendered inside the filter bar pill group.

- [ ] **Step 1: Write the component**

Create `src/components/HueFilterStrip.tsx`:

```tsx
import { useImagesStore } from "../stores/images";
import { cn } from "../utils/cn";

/** 12 hue groups (30° buckets, group k centered at k*30°) + neutral (99). */
export const HUE_GROUPS: { value: number; label: string; color: string }[] = [
  ...Array.from({ length: 12 }, (_, k) => ({
    value: k,
    label: [
      "Red",
      "Orange",
      "Yellow",
      "Lime",
      "Green",
      "Teal",
      "Cyan",
      "Sky",
      "Blue",
      "Indigo",
      "Purple",
      "Pink",
    ][k],
    color: `hsl(${k * 30} 65% 45%)`,
  })),
  { value: 99, label: "Neutral", color: "hsl(0 0% 45%)" },
];

function HueFilterStrip() {
  const hueGroup = useImagesStore((s) => s.filters.hueGroup);

  const toggle = (value: number) => {
    const base = useImagesStore.getState().filters;
    useImagesStore.getState().setFilters({
      ...base,
      hueGroup: base.hueGroup === value ? null : value,
    });
    useImagesStore.getState().fetchPage(1);
  };

  return (
    <div
      className="flex items-center gap-1 px-1"
      role="group"
      aria-label="Filter by dominant color"
    >
      {HUE_GROUPS.map(({ value, label, color }) => {
        const selected = hueGroup === value;
        return (
          <button
            key={value}
            type="button"
            title={selected ? `Clear ${label.toLowerCase()} filter` : `Filter by ${label.toLowerCase()}`}
            aria-label={`Filter by ${label.toLowerCase()}`}
            aria-pressed={selected}
            onClick={() => toggle(value)}
            className={cn(
              "size-4 shrink-0 cursor-pointer rounded-full border border-base-content/20 transition-transform duration-100",
              "hover:scale-125 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary",
              selected && "scale-125 ring-2 ring-primary ring-offset-1 ring-offset-base-100",
            )}
            style={{ backgroundColor: color }}
          />
        );
      })}
    </div>
  );
}

export default HueFilterStrip;
```

- [ ] **Step 2: Wire into the filter bar and sort cycle**

In `src/components/Filters.tsx`:

1. `PartialFilters.type` becomes `"name" | "id" | "hue"` (line 30) — it mirrors `Filters["type"]`.

2. Replace the sort-cycle block (lines 51-65):

```ts
/* Sort cycles through 5 states: name↑ name↓ id↑ id↓ rainbow */
type SortState = { type: "name" | "id" | "hue"; order: "asc" | "desc" };
const SORT_CYCLE: SortState[] = [
  { type: "name", order: "asc" },
  { type: "name", order: "desc" },
  { type: "id", order: "asc" },
  { type: "id", order: "desc" },
  { type: "hue", order: "asc" },
];
function nextSort(current: SortState): SortState {
  const idx = SORT_CYCLE.findIndex((s) => s.type === current.type && s.order === current.order);
  return SORT_CYCLE[(idx + 1) % SORT_CYCLE.length];
}
function sortLabel(s: SortState) {
  if (s.type === "hue") return "Rainbow";
  return `${s.type === "name" ? "Name" : "ID"} ${s.order === "asc" ? "↑" : "↓"}`;
}
```

Note: `nextSort` returns `SORT_CYCLE[0]` on `findIndex === -1`? No — `(-1 + 1) % 5 === 0`, which is already correct fallback behavior; leave as is.

3. Update the sort button `title` (line 375): `"Cycle sort: Name↑ → Name↓ → ID↑ → ID↓ → Rainbow"`.

4. Import and render the strip after the Filters button inside the pill group `<div>` (after line 386, still inside the first group div):

```tsx
<HueFilterStrip />
```

with `import HueFilterStrip from "./HueFilterStrip";` at the top.

5. In `clearAll` (line 205), add `hueGroup: null,` to the `setFilters({...})` object so the search-bar clear button also clears the strip.

In `src/hooks/useFilteredImages.ts`, replace lines 17-20:

```ts
  const sortedImages =
    filters.type === "id" || filters.type === "hue"
      ? deferredImages
      : deferredImages.toSorted((a, b) => b.name.localeCompare(a.name));
```

(`"hue"` must keep the daemon's rainbow order — client re-sorting by name would destroy it.)

- [ ] **Step 3: Write the test**

Look at `src/components/__tests__/` for the established pattern. Minimum coverage in `src/components/__tests__/HueFilterStrip.test.tsx`:

```tsx
import { describe, expect, it } from "vitest";
import { HUE_GROUPS } from "../HueFilterStrip";

describe("HUE_GROUPS", () => {
  it("has 12 hue buckets plus neutral", () => {
    expect(HUE_GROUPS).toHaveLength(13);
    expect(HUE_GROUPS.map((g) => g.value)).toEqual([...Array(12).keys(), 99]);
  });

  it("centers group k at k*30 degrees", () => {
    expect(HUE_GROUPS[0].color).toBe("hsl(0 65% 45%)");
    expect(HUE_GROUPS[8].color).toBe("hsl(240 65% 45%)");
    expect(HUE_GROUPS[12].color).toBe("hsl(0 0% 45%)");
  });
});
```

If the directory has store-driven render tests (e.g. via @testing-library/react + zustand), additionally cover: clicking a swatch sets `filters.hueGroup`, clicking it again clears to `null`.

- [ ] **Step 4: Run tests + typecheck**

```bash
pnpm vitest run
pnpm exec tsc --noEmit -p tsconfig.json
```
Expected: PASS, no type errors.

- [ ] **Step 5: Format, lint, commit**

```bash
pnpm run format:check && pnpm run lint:check
git add src/components/HueFilterStrip.tsx src/components/Filters.tsx src/hooks/useFilteredImages.ts src/components/__tests__/HueFilterStrip.test.tsx
git commit -m "feat(renderer): hue filter strip and Rainbow sort in gallery filter bar"
```

---

### Task 5: Full verification gate

**Files:** none new — fixes only if gates fail.

- [ ] **Step 1: Run the full CI check**

From the worktree root:

```bash
pnpm run ci:check
pnpm run test:daemon:unit
```

Expected: both PASS. If anything fails, fix the specific failure (staying within this feature's files) and re-run.

- [ ] **Step 2: Build daemon binary as a smoke check**

```bash
make daemon
```

Expected: builds cleanly.

- [ ] **Step 3: Commit any fixes**

```bash
git status --porcelain   # commit only if fixes were needed
```
