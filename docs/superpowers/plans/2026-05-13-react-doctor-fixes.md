# React Doctor 405-Issue Cleanup Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Resolve every issue surfaced by `react-doctor` on the `waypaper-engine` package (currently 405 across 126 files, score 63/100) and raise the score to 90+.

**Architecture:** Work in waves: pure-mechanical sweeps first (high volume, low risk), then bug-class fixes (correctness/errors), then performance refactors, then architectural work (giant components, dead code). Re-run `npx react-doctor . --verbose` after each phase to verify count drops. Each phase ends with `pnpm run ci:check` and a commit on `refactor/waypaper-engine`.

**Tech Stack:** React 19.2 + TypeScript + Vite + Tailwind (oxlint, oxfmt), framer-motion (LazyMotion), Zustand stores, Playwright (e2e), Vitest.

**Working directory:** `waypaper-engine/`. All `pnpm` / `npx` commands run there. Working branch: `refactor/waypaper-engine`.

**Baseline:** 405 issues, score 63/100. After every phase, the executor MUST run:
```bash
npx react-doctor@latest . 2>&1 | tail -15
```
and record the new count in the phase's final commit message.

---

## Conventions for every task

- **Read the file** before editing (Read tool) so the Edit tool has accurate context.
- **One concern per commit.** Commit message format: `chore(react-doctor): <phase> — <short description> (-N issues)`.
- **After each task:** run `pnpm run lint:check` to catch oxlint regressions. After each phase: `pnpm run ci:check`.
- **Do not introduce new APIs.** Use the smallest change that resolves the rule. No "while I'm here" cleanups unless explicitly listed.
- **If a fix looks wrong / would break behavior**, stop and surface the conflict in the commit body. Do not silently skip.

---

## Phase 0 — Baseline & branch setup

**Files:** none

- [ ] **Step 1:** Confirm working tree is clean on `refactor/waypaper-engine`.

```bash
git -C /home/obsy/dev/waypaper/waypaper-engine status
git -C /home/obsy/dev/waypaper/waypaper-engine branch --show-current
```
Expected: `refactor/waypaper-engine`, clean tree.

- [ ] **Step 2:** Record baseline.

```bash
cd /home/obsy/dev/waypaper/waypaper-engine
npx react-doctor@latest . 2>&1 | tail -10 > /tmp/react-doctor-baseline.txt
cat /tmp/react-doctor-baseline.txt
```
Expected: `405 issues across 126/296 files`, score `63 / 100`.

- [ ] **Step 3:** Verify `ci:check` is green before any change.

```bash
pnpm run ci:check
```
Expected: PASS. If FAIL, stop and fix the existing breakage before starting the plan.

---

## Phase 1 — Mechanical Tailwind & typography sweeps

These are pure find-and-replace. Touch only the listed lines; do not refactor surrounding code.

### Task 1.1 — `w-N h-N` → `size-N` (68 occurrences)

**Files (all in `src/`):**

`components/PlaylistController.tsx:267,280,284,292,304`,
`components/ImageCard.tsx:454,539`,
`components/ToastContainer.tsx:30,46,62,78`,
`components/FolderPickerModal.tsx:88,194,265`,
`components/Gallery.tsx:151`,
`components/ImageDetailSidebar.tsx:863,879,1237,1374`,
`components/Monitor.tsx:193`,
`components/PlaylistTrack.tsx:397`,
`components/GalleryFilterCheatsheetModal.tsx:24`,
`components/settings/DaemonStatusComponent.tsx:140,198,220,237`,
`components/Breadcrumbs.tsx:61,81,103`,
`routes/LoopStudio.tsx:1047`,
`components/FolderCard.tsx:164,204`,
`components/LoadPlaylistModal.tsx:134`,
`components/ImageProcessingProgress.tsx:44`,
`routes/Wallhaven.tsx:185,527,532,627`,
`components/layout/ModernSidebar.tsx:254,540`,
`components/ContextMenu.tsx:255`,
`components/settings/InlineThemeSelector.tsx:131`,
`components/DragPreview.tsx:26,56,94,98`,
`components/settings/SettingsTabs.tsx:217,284`,
`routes/ShaderStudio.tsx:469`,
`components/settings/SettingsModal.tsx:83`,
`components/Filters.tsx:393,516,520,539,543`,
`components/AddToPlaylistModal.tsx:97,115`,
`components/settings/SettingsSearch.tsx:120,157`,
`components/settings/sections/WallhavenSettingsSection.tsx:104,119`,
`components/loopStudio/LoopStudioYtDlpBanner.tsx:14`,
`components/loopStudio/LoopStudioFfmpegRequiredScreen.tsx:29`,
`components/UrlImportWarningModal.tsx:35`,
`components/WallhavenDisclaimerModal.tsx:32`,
`components/PlaylistConfigurationModal.tsx:169`,
`components/MonitorButton.tsx:42,59`.

- [ ] **Step 1: For each line above, read the file and replace.**

Pattern: any occurrence of `w-<N> h-<N>` (same N) inside a `className` string becomes `size-<N>`. Variants with breakpoints (`md:w-4 md:h-4`) become `md:size-4`. Leave `w-X h-Y` where X != Y untouched.

Example (`components/PlaylistController.tsx:267`):
```diff
- className="w-4 h-4"
+ className="size-4"
```

- [ ] **Step 2: Re-run react-doctor for this rule only.**

```bash
npx react-doctor@latest . --verbose 2>&1 | grep -A2 "design-no-redundant-size-axes"
```
Expected: rule disappears or count = 0.

- [ ] **Step 3: Lint & commit.**

```bash
pnpm run format:check && pnpm run lint:check
git add -A && git commit -m "chore(react-doctor): collapse w-N h-N to size-N (-68 issues)"
```

### Task 1.2 — `px-N py-N` → `p-N` (1 occurrence)

**Files:**
- Modify: `src/components/settings/SettingsTabs.tsx:193`

- [ ] **Step 1:** Read the file. Replace `px-2 py-2` with `p-2` in the className on line 193. Leave any other axis-split utilities alone.

- [ ] **Step 2:** Commit.
```bash
git add src/components/settings/SettingsTabs.tsx
git commit -m "chore(react-doctor): collapse px-2 py-2 to p-2 (-1 issue)"
```

### Task 1.3 — `font-bold` on headings → `font-semibold` (15 occurrences)

**Files:**
`components/FolderPickerModal.tsx:175`,
`components/Gallery.tsx:183`,
`components/ImageDetailSidebar.tsx:1229`,
`routes/History.tsx:187`,
`components/GalleryFilterCheatsheetModal.tsx:72,103`,
`routes/LoopStudio.tsx:836,1160`,
`components/ErrorBoundary.tsx:35`,
`components/layout/ModernSidebar.tsx:548`,
`components/FolderImportModal.tsx:43`,
`routes/ShaderStudio.tsx:487`,
`components/ConfirmDialog.tsx:67`,
`components/UrlImportWarningModal.tsx:32`,
`components/WallhavenDisclaimerModal.tsx:29`.

- [ ] **Step 1: For each location, replace `font-bold` → `font-semibold` *only* on heading elements (`<h1>`–`<h6>`) at the listed line.**

Do not touch `font-bold` on non-heading elements (paragraph emphasis, button labels) — the rule is heading-specific.

- [ ] **Step 2: Commit.**
```bash
git add -A
git commit -m "chore(react-doctor): font-semibold for headings instead of font-bold (-15 issues)"
```

### Task 1.4 — Em dash → comma/colon/parens in JSX text (9 occurrences)

**Files:**
- `src/components/ImageDetailSidebar.tsx:540, 559, 1354`
- `src/components/GalleryFilterCheatsheetModal.tsx:59, 109`
- `src/routes/LoopStudio.tsx:867, 912`
- `src/routes/ShaderStudio.tsx:489`
- `src/components/loopStudio/LoopStudioFfmpegRequiredScreen.tsx:49`

- [ ] **Step 1: Read each line. Replace the em dash (`—`) inside JSX text with the most natural alternative based on context:**

| Context | Preferred replacement |
|---|---|
| Aside or pause mid-sentence | `,` |
| Followed by a definition/list | `:` |
| Parenthetical | wrap with `(` `)` |
| Strong break | `;` or `.` |

Leave em dashes in non-JSX-text contexts (strings used for tooltips, log messages, code comments) alone — the rule only targets visible JSX text.

- [ ] **Step 2: Commit.**
```bash
git add -A
git commit -m "chore(react-doctor): replace em dashes in JSX text (-9 issues)"
```

### Task 1.5 — `...` → `…` ellipsis character (2 occurrences)

**Files:**
- `src/components/Monitor.tsx:176`
- `src/components/settings/DaemonStatusComponent.tsx:128`

- [ ] **Step 1:** Replace three-period `...` with the single character `…` in JSX text at each line.

- [ ] **Step 2: Commit.**
```bash
git add -A
git commit -m "chore(react-doctor): use typographic ellipsis character (-2 issues)"
```

### Task 1.6 — Vague button labels (4 occurrences, 1 production + 3 tests)

**Files:**
- `src/components/ImageDetailSidebar.tsx:1512` — button labelled "Done"
- `src/components/ui/__tests__/Button.test.tsx:7, 14, 19` — test fixture labels

- [ ] **Step 1:** Read `ImageDetailSidebar.tsx` around line 1512 to identify what the button actually does. Rename "Done" to the verb form (e.g. "Save changes", "Close details", "Apply"). Pick the label that matches the surrounding handler's action.

- [ ] **Step 2:** In `Button.test.tsx`, rename test-fixture button labels (currently generic "Click me" / "Done" / "OK") to descriptive labels such as "Save profile", "Submit form", "Cancel order". Update any `getByText` assertions to match.

- [ ] **Step 3: Run tests.**
```bash
pnpm test -- src/components/ui/__tests__/Button.test.tsx
```
Expected: PASS.

- [ ] **Step 4: Commit.**
```bash
git add -A
git commit -m "chore(react-doctor): name button actions instead of vague labels (-4 issues)"
```

### Task 1.7 — Side-tab thick border (2 occurrences)

**Files:**
- `src/components/GalleryFilterCheatsheetModal.tsx:107, 112`

- [ ] **Step 1: Read both lines.** Replace `border-l-4` (with whatever color modifier follows) with a subtler accent. Use a `box-shadow: inset` or a `bg-primary/10` background, or just drop the border entirely if the content is already clearly delimited. Pick the simplest of these that preserves the visual grouping.

- [ ] **Step 2: Commit.**
```bash
git add src/components/GalleryFilterCheatsheetModal.tsx
git commit -m "chore(react-doctor): replace border-l-4 with subtler accent (-2 issues)"
```

### Task 1.8 — Pure black background (2 occurrences)

**Files:**
- `src/routes/LoopStudio.tsx:926`
- `src/routes/ShaderStudio.tsx:596`

- [ ] **Step 1:** Replace `bg-black` with `bg-neutral-950` (DaisyUI) or `bg-base-300` if the surrounding code uses DaisyUI semantic tokens. Choose `bg-neutral-950` for video/canvas backdrop areas (these are video previews); choose `bg-base-300` for chrome.

- [ ] **Step 2: Commit.**
```bash
git add -A
git commit -m "chore(react-doctor): replace pure black with tinted near-black (-2 issues)"
```

### Task 1.9 — `z-index: 9999` (1 occurrence)

**Files:**
- `src/components/ContextMenu.tsx:112`

- [ ] **Step 1:** Read the file to understand the stacking context. Replace `z-[9999]` (or `style={{ zIndex: 9999 }}`) with `z-50` plus an `isolation: isolate` (`className="isolate"`) on the closest portal/root if a new stacking context is needed.

- [ ] **Step 2:** Manually verify the context menu still appears above modals, drag previews, and other overlays. (Open app, right-click in gallery, drag while menu open.) If anything else still hits 9999, do not raise the new value — refactor whichever component is sitting on top of the menu to a sibling stacking context.

- [ ] **Step 3: Commit.**
```bash
git add src/components/ContextMenu.tsx
git commit -m "chore(react-doctor): use z-50 + isolate instead of z-9999 (-1 issue)"
```

### Task 1.10 — SVG decimal precision (1 occurrence)

**Files:**
- `src/components/AddFoldersIcon.tsx:9`

- [ ] **Step 1:** Read the file. Round every numeric value in the `d=` (and `transform=`, `points=`) attributes to 2 decimal places. Visually verify the icon still renders the same in the dev server.

- [ ] **Step 2: Commit.**
```bash
git add src/components/AddFoldersIcon.tsx
git commit -m "chore(react-doctor): truncate SVG path precision (-1 issue)"
```

### Phase 1 verification

- [ ] **Run full check.**
```bash
pnpm run ci:check
npx react-doctor@latest . 2>&1 | tail -10
```
Expected: ci:check PASS. react-doctor issue count: ~302 (-103 from baseline). Score should rise by ~5 points.

---

## Phase 2 — React 19 `forwardRef` removal (6 occurrences)

**Background:** React 19+ accepts `ref` as a regular prop on function components. Remove the `forwardRef` wrapper and pass `ref` directly. This is mechanical but every file's component signature changes.

### Reusable conversion pattern (apply per file)

```diff
- import { forwardRef } from "react";
+ // (drop forwardRef import; keep other named imports)

  type Props = { /* ... existing fields ... */ };

- const Card = forwardRef<HTMLDivElement, Props>(({ children, ...rest }, ref) => {
+ function Card({ children, ref, ...rest }: Props & { ref?: React.Ref<HTMLDivElement> }) {
    return <div ref={ref} {...rest}>{children}</div>;
- });
- Card.displayName = "Card";
+ }
```

Notes:
- The element type (`HTMLDivElement` above) is whatever the existing `forwardRef<E, P>` second-arg ref points at.
- If the existing code uses `useImperativeHandle(ref, () => ...)`, keep that block untouched — only the outer wrapper changes.
- After conversion, `displayName` is set automatically by function name; drop the manual assignment.
- Run `pnpm exec tsc --noEmit` after each file to catch consumer breakage.

### Task 2.1 — `Card.tsx`

**Files:**
- Modify: `src/components/ui/Card.tsx:1` (and below)

- [ ] **Step 1: Read file.** Identify the `forwardRef` wrapper, the generic type args, and the props interface.

- [ ] **Step 2: Refactor.**
  - Drop `import { forwardRef } from "react"` (keep other named imports).
  - Add `ref?: React.Ref<HTMLDivElement>` (or matching element type) to the props interface.
  - Convert `forwardRef<E, P>((props, ref) => ...)` to `function Card({ ref, ...props }: P & { ref?: React.Ref<E> }) { ... }`.
  - If the file uses `displayName`, drop it (function declarations have it automatically).

- [ ] **Step 3: Run typecheck.**
```bash
pnpm run lint:check
pnpm exec tsc --noEmit
```
Expected: PASS. If any consumer fails because it spreads `{...ref}` separately, update that call site too.

- [ ] **Step 4: Commit.**
```bash
git add src/components/ui/Card.tsx
git commit -m "refactor(Card): drop forwardRef for React 19 ref-as-prop (-1 issue)"
```

### Task 2.2 — `Modal.tsx`

Same pattern as Task 2.1.

**Files:**
- Modify: `src/components/Modal.tsx:1`

- [ ] **Step 1:** Read. Locate `forwardRef`. Note: `Modal` is consumed via the `ModalHandle` type from the existing code — keep the `useImperativeHandle` shape; only the wrapper changes.

- [ ] **Step 2:** Apply the same conversion as Task 2.1.

- [ ] **Step 3:** Typecheck + commit.
```bash
pnpm exec tsc --noEmit
git add src/components/Modal.tsx
git commit -m "refactor(Modal): drop forwardRef for React 19 ref-as-prop (-1 issue)"
```

### Task 2.3 — `ThemeContext.tsx`

**Files:**
- Modify: `src/contexts/ThemeContext.tsx:4`

- [ ] **Step 1:** Read. The `forwardRef` here likely wraps a `ThemeProvider` or similar. Apply the same conversion.

- [ ] **Step 2:** Typecheck + commit.
```bash
pnpm exec tsc --noEmit
git add src/contexts/ThemeContext.tsx
git commit -m "refactor(ThemeContext): drop forwardRef (-1 issue)"
```

### Task 2.4 — `Filters.tsx`

**Files:**
- Modify: `src/components/Filters.tsx:3`

- [ ] **Step 1:** Read. Apply conversion.

- [ ] **Step 2:** Typecheck + commit.
```bash
pnpm exec tsc --noEmit
git add src/components/Filters.tsx
git commit -m "refactor(Filters): drop forwardRef (-1 issue)"
```

### Task 2.5 — Test files (`PlaylistConfigurationModal.test.tsx`, `LoadPlaylistModal.test.tsx`)

**Files:**
- Modify: `src/components/__tests__/LoadPlaylistModal.test.tsx:48`
- Modify: `src/components/__tests__/PlaylistConfigurationModal.test.tsx:35`

- [ ] **Step 1:** Read each file. The `forwardRef` here is in test scaffolding/mocks. Convert the same way.

- [ ] **Step 2:** Run the affected tests.
```bash
pnpm test -- src/components/__tests__/LoadPlaylistModal.test.tsx src/components/__tests__/PlaylistConfigurationModal.test.tsx
```
Expected: PASS.

- [ ] **Step 3: Commit.**
```bash
git add src/components/__tests__/LoadPlaylistModal.test.tsx src/components/__tests__/PlaylistConfigurationModal.test.tsx
git commit -m "refactor(tests): drop forwardRef in modal test scaffolding (-2 issues)"
```

### Phase 2 verification

- [ ] **Verify.**
```bash
pnpm run ci:check
npx react-doctor@latest . 2>&1 | tail -10
```
Expected: ci:check PASS. Issue count drops by 6 → ~296.

---

## Phase 3 — Correctness bugs (errors only)

These are flagged severity=error: hard bugs that leak memory or break behavior. Do these before any perf work.

### Task 3.1 — Missing `useEffect` cleanup in `useLoadMonitors.ts`

**Files:**
- Modify: `src/hooks/useLoadMonitors.ts:17`

- [ ] **Step 1: Read.** Identify the `setTimeout` (or similar) call inside the `useEffect` body.

- [ ] **Step 2: Add cleanup.**
```ts
useEffect(() => {
  const id = setTimeout(() => { /* existing body */ }, delay);
  return () => clearTimeout(id);
}, [/* existing deps */]);
```

- [ ] **Step 3:** If the rule still fires, the lint report counted three subscriptions in this hook — handle every `setTimeout`/`setInterval`/`on(...)` registration in the same effect.

- [ ] **Step 4: Commit.**
```bash
git add src/hooks/useLoadMonitors.ts
git commit -m "fix(useLoadMonitors): return cleanup for setTimeout (-1 issue, leak)"
```

### Task 3.2 — Missing cleanup in `useSetLastActivePlaylist.ts`

**Files:**
- Modify: `src/hooks/useSetLastActivePlaylist.ts:106`

- [ ] **Step 1: Read.** Identify the subscription/timer at line 106. Add the matching cleanup as in Task 3.1.

- [ ] **Step 2: Commit.**
```bash
git add src/hooks/useSetLastActivePlaylist.ts
git commit -m "fix(useSetLastActivePlaylist): return cleanup for effect subscription (-1 issue)"
```

### Task 3.3 — Missing cleanup in `Modals.tsx`

**Files:**
- Modify: `src/components/Modals.tsx:39`

- [ ] **Step 1:** Read. Add cleanup matching the registration.

- [ ] **Step 2: Commit.**
```bash
git add src/components/Modals.tsx
git commit -m "fix(Modals): return cleanup for effect subscription (-1 issue)"
```

### Task 3.4 — Mutable `location.*` in deps (`ShaderStudio.tsx`)

**Files:**
- Modify: `src/routes/ShaderStudio.tsx:321`

- [ ] **Step 1: Read** around line 321 to find the `useEffect` with `location.pathname` (or similar) in its deps array.

- [ ] **Step 2: Move the mutable read inside the effect body.** Remove `location.pathname` from deps. If the effect *needs* to react to URL changes, replace with `useLocation()` from `react-router-dom` (already a project dep) and depend on its `pathname` instead.

```ts
// Before (broken):
useEffect(() => { /* uses location.pathname */ }, [location.pathname]);

// After:
const { pathname } = useLocation();
useEffect(() => { /* uses pathname */ }, [pathname]);
```

- [ ] **Step 3: Commit.**
```bash
git add src/routes/ShaderStudio.tsx
git commit -m "fix(ShaderStudio): subscribe to router pathname instead of mutable location (-1 issue)"
```

### Task 3.5 — Stale closure in `setFilters` (AdvancedFiltersModal)

**Files:**
- Modify: `src/components/AdvancedFiltersModal.tsx:44`

- [ ] **Step 1: Read.** Find `setFilters({ ...filters, key: value })`.

- [ ] **Step 2: Convert to functional form.**
```ts
setFilters((prev) => ({ ...prev, key: value }));
```

- [ ] **Step 3: Commit.**
```bash
git add src/components/AdvancedFiltersModal.tsx
git commit -m "fix(AdvancedFiltersModal): functional setState avoids stale closure (-1 issue)"
```

### Task 3.6 — Stale closure in `setFilters` (SavePlaylistModal)

**Files:**
- Modify: `src/components/SavePlaylistModal.tsx:96`

- [ ] **Step 1:** Same conversion as Task 3.5.

- [ ] **Step 2: Commit.**
```bash
git add src/components/SavePlaylistModal.tsx
git commit -m "fix(SavePlaylistModal): functional setState avoids stale closure (-1 issue)"
```

### Task 3.7 — Array index used as key (3 occurrences)

**Files:**
- `src/components/ImageDetailSidebar.tsx:1361`
- `src/components/PlaylistTrack.tsx:286`
- `src/components/ContextMenu.tsx:138`

- [ ] **Step 1: For each file, read around the listed line** to find the `.map((item, i) => ..., key={i})` (or `key={\`${prefix}-${i}\`}`).

- [ ] **Step 2: Replace with a stable id.**
  - If the item has an `id` / `slug` / `path` field: `key={item.id}`.
  - If the list is a static menu, use `key={item.label}` (assuming labels are unique).
  - If neither is available, generate a stable id once with `useMemo` keyed on the list.

- [ ] **Step 3:** For `ContextMenu.tsx:138`, the menu item is built from `MenuItem` records — use `item.id` if the type already has it; otherwise add it to the type and update callers (`utils/contextMenuItems.ts`) to set ids.

- [ ] **Step 4: Commit.**
```bash
git add -A
git commit -m "fix(react-doctor): stable keys instead of array index (-3 issues)"
```

### Phase 3 verification

- [ ] **Verify.**
```bash
pnpm run ci:check
npx react-doctor@latest . 2>&1 | tail -10
```
Expected: error count goes from 5 → 0 (or 5 - resolved-here). Issue count drops by ~10.

---

## Phase 4 — Effect → handler conversions

These effects exist only to react to a flag that an event handler already controls. Inlining the logic eliminates a re-render cycle and a hidden dependency.

### Reusable conversion pattern (apply per file)

```diff
  function MyModal({ ...props }) {
-   const [pendingX, setPendingX] = useState<X | null>(null);
+   const [pendingX, setPendingX] = useState<X | null>(null); // state may still be needed for render
    const modalRef = useRef<ModalHandle>(null);

-   useEffect(() => {
-     if (pendingX) modalRef.current?.showModal();
-   }, [pendingX]);

    const onTrigger = (x: X) => {
      setPendingX(x);
+     modalRef.current?.showModal();   // moved out of effect
    };
    // ...
  }
```

Rule of thumb: if the effect only does *one* imperative call gated by a flag, AND that flag is only flipped from a handler, inline the imperative call into the handler and delete the effect. If the flag is also flipped from multiple places (e.g. an effect, a context, a callback prop), centralize via a small helper or keep the effect (and suppress the rule with a comment).

### Task 4.1 — `Gallery.tsx` effect → handler

**Files:**
- Modify: `src/components/Gallery.tsx:49` (existing)

- [ ] **Step 1: Read** lines 44–55. The pattern:
```ts
useEffect(() => {
  if (pendingShadertoyFile) shadertoyModalRef.current?.showModal();
}, [pendingShadertoyFile]);
```
The state is set in `handleDrop` (around line 67). Move the `showModal()` call directly into that handler at the same spot where `setPendingShadertoyFile(files[i])` is called.

- [ ] **Step 2: Remove the `useEffect`.**

- [ ] **Step 3: Commit.**
```bash
git add src/components/Gallery.tsx
git commit -m "refactor(Gallery): show shadertoy modal in handler instead of effect (-1 issue)"
```

### Task 4.2 — `ConfirmDialog.tsx` effect → handler

**Files:**
- Modify: `src/components/ConfirmDialog.tsx:52`

- [ ] **Step 1: Read.** Identify the `useEffect` and which event handler sets the state it watches.

- [ ] **Step 2: Inline the logic into the handler.** Delete the effect.

- [ ] **Step 3: Commit.**
```bash
git add src/components/ConfirmDialog.tsx
git commit -m "refactor(ConfirmDialog): effect → handler (-1 issue)"
```

### Task 4.3 — `FolderPickerModal.tsx` effect → handler

**Files:**
- Modify: `src/components/FolderPickerModal.tsx:124`

- [ ] **Step 1: Read.** Same pattern.

- [ ] **Step 2: Inline + delete.**

- [ ] **Step 3: Commit.**
```bash
git add src/components/FolderPickerModal.tsx
git commit -m "refactor(FolderPickerModal): effect → handler (-1 issue)"
```

### Task 4.4 — `UrlImportWarningModal.tsx` effect → handler

**Files:**
- Modify: `src/components/UrlImportWarningModal.tsx:22`

- [ ] **Step 1: Read.** Probably a `useEffect` that calls `showModal()` when `isOpen` flips. Inline.

- [ ] **Step 2: Commit.**
```bash
git add src/components/UrlImportWarningModal.tsx
git commit -m "refactor(UrlImportWarningModal): effect → handler (-1 issue)"
```

### Task 4.5 — `ImageDetailSidebar.tsx` effect → handler

**Files:**
- Modify: `src/components/ImageDetailSidebar.tsx:996`

- [ ] **Step 1: Read.** Identify the effect.

- [ ] **Step 2: Inline + delete.** Be careful: this file is 1500+ lines; verify the handler it pairs with.

- [ ] **Step 3: Commit.**
```bash
git add src/components/ImageDetailSidebar.tsx
git commit -m "refactor(ImageDetailSidebar): effect → handler (-1 issue)"
```

### Task 4.6 — `WallhavenDisclaimerModal.tsx` effect → handler

**Files:**
- Modify: `src/components/WallhavenDisclaimerModal.tsx:19`

- [ ] **Step 1: Read + inline.**

- [ ] **Step 2: Commit.**
```bash
git add src/components/WallhavenDisclaimerModal.tsx
git commit -m "refactor(WallhavenDisclaimerModal): effect → handler (-1 issue)"
```

### Task 4.7 — `ContextMenu.tsx` effect → handler

**Files:**
- Modify: `src/components/ContextMenu.tsx:174`

- [ ] **Step 1: Read.** This file has both effect→handler (line 174) AND cascading setState (line 28, fixed in Phase 5). Handle line 174 only here.

- [ ] **Step 2: Inline + delete.**

- [ ] **Step 3: Commit.**
```bash
git add src/components/ContextMenu.tsx
git commit -m "refactor(ContextMenu): effect → handler at line 174 (-1 issue)"
```

### Task 4.8 — `FolderImportModal.tsx` effect → handler

**Files:**
- Modify: `src/components/FolderImportModal.tsx:21`

- [ ] **Step 1: Read + inline.**

- [ ] **Step 2: Commit.**
```bash
git add src/components/FolderImportModal.tsx
git commit -m "refactor(FolderImportModal): effect → handler (-1 issue)"
```

### Task 4.9 — `useEffectEvent` wrap for non-reactive callbacks (4 occurrences)

`useEffectEvent` is a React 19 hook (`import { experimental_useEffectEvent as useEffectEvent } from "react"` — confirm the actual import path in `node_modules/react/package.json` since some 19.2.x builds expose it without the prefix).

**Files:**
- `src/contexts/ThemeContext.tsx:187` — `setTheme` read only inside `addEventListener`
- `src/components/ImageDetailSidebar.tsx:1144`
- `src/routes/LoopStudio.tsx:524`
- `src/routes/LoopStudio.tsx:815`

- [ ] **Step 1: Confirm hook export.**
```bash
node -e "console.log(Object.keys(require('react')).filter(k => k.toLowerCase().includes('effect')))"
```
If `useEffectEvent` is in the list, import it. If only `experimental_useEffectEvent` is present, import that and alias it: `import { experimental_useEffectEvent as useEffectEvent } from "react";`.

- [ ] **Step 2: For each file, read around the listed line and apply the pattern:**
```ts
// Before:
useEffect(() => {
  function handler() { /* uses setTheme(...) */ }
  window.addEventListener("X", handler);
  return () => window.removeEventListener("X", handler);
}, [setTheme]);

// After:
const onChange = useEffectEvent(() => { /* uses setTheme(...) */ });
useEffect(() => {
  function handler() { onChange(); }
  window.addEventListener("X", handler);
  return () => window.removeEventListener("X", handler);
}, []);
```

- [ ] **Step 3:** For `LoopStudio.tsx` (two occurrences, lines 524 and 815) the callback is `captureFrames` per the diagnostic — same pattern.

- [ ] **Step 4: Run tests touching ThemeContext.**
```bash
pnpm test -- src/contexts
```
Expected: PASS.

- [ ] **Step 5: Commit.**
```bash
git add -A
git commit -m "refactor(react-doctor): wrap non-reactive callbacks with useEffectEvent (-4 issues)"
```

### Task 4.10 — Derive state instead of mirroring props (5 occurrences)

**Files:**
- `src/contexts/ThemeContext.tsx:56` — `initialSyncWithSystem`
- `src/components/settings/sections/BackendSettingsSection.tsx:527, 586, 635, 638`

- [ ] **Step 1: For each location, read context.** Confirm the `useState(initialProp)` is never updated (i.e. only the prop should drive its value). If so, replace with a direct read:
```ts
// Before:
const [syncWithSystem, setSyncWithSystem] = useState(initialSyncWithSystem);

// After (if setter is never called):
const syncWithSystem = initialSyncWithSystem;
```

- [ ] **Step 2: Edge case** — if a setter IS called somewhere, the state is truly local: rename the prop to `defaultX` (initial-only) to make the intent clear, and leave the `useState` alone. (This may not fully resolve the rule; document the decision in the commit body if it doesn't.)

- [ ] **Step 3:** For `BackendSettingsSection.tsx`, three of the four flagged states (527, 586, 638) also appear in the "rerender-state-only-in-handlers" list (Phase 6) — convert those to `useRef` then; here, only address derivation if the value is also read in JSX.

- [ ] **Step 4: Commit.**
```bash
git add -A
git commit -m "refactor(react-doctor): derive state from props instead of mirroring (-5 issues)"
```

### Phase 4 verification

- [ ] **Verify.**
```bash
pnpm run ci:check
npx react-doctor@latest . 2>&1 | tail -10
```
Expected: -17 issues across this phase.

---

## Phase 5 — State consolidation (`useReducer` + cascading setState)

### Task 5.1 — Cascading `setState` in `useEffect` (6 occurrences)

**Files:**
- `src/components/PlaylistController.tsx:42`
- `src/routes/LoopStudio.tsx:161, 481`
- `src/components/ContextMenu.tsx:28`
- `src/routes/ShaderStudio.tsx:150`
- `src/hooks/useRealTimeImageProcessing.tsx:58`

**Pattern:** an effect calls 3+ `setX(...)` calls in sequence; each triggers a render before the next runs (React 18+ batches inside event handlers but NOT inside async effect bodies if there's an `await` between sets).

- [ ] **Step 1: For each file, read the effect.** Identify the set calls.

- [ ] **Step 2: Choose strategy per location:**
  - **All sets fire together with no `await` between them:** wrap with `React.unstable_batchedUpdates(() => { ... })` — NO, in React 19 sets are auto-batched in effects too. Instead, consolidate into one `useReducer` if the values are logically related, otherwise leave alone and document.
  - **There's an `await` between sets:** combine into a single state object `{ a, b, c }` and one `setState({ ... })` after the await.
  - **State is genuinely independent:** convert to `useReducer({ type: "...", payload: ... })` with one dispatch.

- [ ] **Step 3:** For `PlaylistController.tsx:42` specifically — read the effect body; this is likely the marquee-coordinate effect. Use a single state object.

- [ ] **Step 4:** For `ContextMenu.tsx:28` — this opens the menu; the three sets are probably `position`, `items`, `isOpen`. Consolidate into one `menu: { open, x, y, items }` state.

- [ ] **Step 5:** For `LoopStudio.tsx:161, 481` — separate consolidations per effect, each into its own state object.

- [ ] **Step 6:** Test in dev (`pnpm run dev`) — verify the affected UI still works.

- [ ] **Step 7: Commit per file** (6 commits) so each can be reviewed/reverted independently.
```bash
git add src/components/PlaylistController.tsx
git commit -m "refactor(PlaylistController): consolidate cascading setState (-1 issue)"
# repeat per file
```

### Task 5.2 — `useReducer` for components with 5+ `useState` (8 occurrences)

**Files:**
- `src/components/FolderPickerModal.tsx:108` (5 useStates)
- `src/contexts/ThemeContext.tsx:51`
- `src/components/ImageDetailSidebar.tsx:297, 611, 895`
- `src/routes/LoopStudio.tsx:74`
- `src/routes/ShaderStudio.tsx:93` (9 useStates)
- `src/components/Filters.tsx:111`

This is a structural refactor per component. Some of these are also "giant component" candidates (Phase 13) — if a component is on both lists, do this refactor as part of Phase 13 and skip it here. Specifically: `ImageDetailSidebar`, `LoopStudio`, `ShaderStudio`, `Filters` are giant-components.

That leaves THIS task with only:
- `src/components/FolderPickerModal.tsx:108`
- `src/contexts/ThemeContext.tsx:51`

- [ ] **Step 1: For each remaining file, read the component.** List the related state slices.

- [ ] **Step 2: Group only state that mutates together** into one reducer. State that has independent lifecycles stays as `useState`.

- [ ] **Step 3:** Define an action type union (e.g. `type Action = { type: "open"; folderId: string } | { type: "close" }`) and a reducer that returns the new state.

- [ ] **Step 4:** Replace the `useState` declarations with `const [state, dispatch] = useReducer(reducer, initialState)`. Update each set-call to `dispatch({ type: "..." })`.

- [ ] **Step 5: Type check + smoke test in dev.**

- [ ] **Step 6: Commit per file.**
```bash
git add src/components/FolderPickerModal.tsx
git commit -m "refactor(FolderPickerModal): consolidate state into useReducer (-1 issue)"
git add src/contexts/ThemeContext.tsx
git commit -m "refactor(ThemeContext): consolidate state into useReducer (-1 issue)"
```

### Phase 5 verification

- [ ] **Verify.**
```bash
pnpm run ci:check
npx react-doctor@latest . 2>&1 | tail -10
```
Expected: -8 issues (cascading 6 + 2 useReducer; the other 6 useReducer cases are deferred to Phase 13).

---

## Phase 6 — Render performance

### Task 6.1 — `useState` → `useRef` (17 occurrences)

**Files & semantics:**
- `src/components/PlaylistController.tsx:37` — `slot` state, value only used in handlers/effects, never in JSX return
- `src/components/FolderPickerModal.tsx:133`
- `src/components/ImageDetailSidebar.tsx:331, 332, 986`
- `src/components/MonitorsModal.tsx:34`
- `src/routes/LoopStudio.tsx:92, 104, 136`
- `src/components/FolderImportModal.tsx:12`
- `src/components/Filters.tsx:139, 140, 141`
- `src/components/settings/sections/AppSettingsSection.tsx:245`
- `src/components/settings/sections/BackendSettingsSection.tsx:527, 586, 638`

- [ ] **Step 1: For each file/line, read the surrounding component.**

- [ ] **Step 2: Confirm the state is never read in the JSX return (and never read via a derived `useMemo` that feeds JSX).** Search within the file:
```bash
grep -n "<the-state-name>" path/to/file
```
If the only readers are inside event handlers, callbacks, or effects, the conversion is safe. If JSX reads it, STOP — the rule may be a false positive; document in the commit body and skip that line.

- [ ] **Step 3: Convert.**
```ts
// Before:
const [slot, setSlot] = useState<SlotShape | null>(null);
// somewhere in a handler:
setSlot(newValue);
// somewhere in another handler:
if (slot != null) doX(slot);

// After:
const slotRef = useRef<SlotShape | null>(null);
// handler:
slotRef.current = newValue;
// reader:
if (slotRef.current != null) doX(slotRef.current);
```

- [ ] **Step 4:** If a downstream callback receives the state, pass `slotRef` (or `slotRef.current` if already inside a handler).

- [ ] **Step 5:** For `BackendSettingsSection.tsx` lines 527/586/638 — these overlap with Phase 4.10 (derived state). After Phase 4 they may already be removed/derived; if so this task no-ops for them.

- [ ] **Step 6: Smoke test in dev.** Open the relevant UI surfaces (playlist controller, folder picker, monitors modal, loop studio, filters, settings) and exercise the flows.

- [ ] **Step 7: Commit per file** to keep reviews tractable. Example:
```bash
git add src/components/PlaylistController.tsx
git commit -m "perf(PlaylistController): slot stored in ref, not state (-1 issue)"
```

### Task 6.2 — `useTransition` for non-async loading flags (2 occurrences)

**Files:**
- `src/contexts/ThemeContext.tsx:57`
- `src/components/settings/DaemonStatusComponent.tsx:62`

- [ ] **Step 1: For each, read.** Confirm the `isLoading` flag wraps a synchronous state transition (e.g. switching the active theme rebuilds derived data) — NOT a real network/IO fetch.

- [ ] **Step 2: Convert.**
```ts
// Before:
const [isLoading, setIsLoading] = useState(false);
const onSwitch = (next) => {
  setIsLoading(true);
  doExpensiveSwitch(next);
  setIsLoading(false);
};

// After:
const [isPending, startTransition] = useTransition();
const onSwitch = (next) => {
  startTransition(() => { doExpensiveSwitch(next); });
};
// use `isPending` wherever `isLoading` was read
```

- [ ] **Step 3:** If `isLoading` is also consumed by parents via props/context, audit those readers. Pass `isPending` through with the same name to avoid prop churn.

- [ ] **Step 4: Commit.**
```bash
git add -A
git commit -m "perf(react-doctor): useTransition for synchronous loading state (-2 issues)"
```

### Task 6.3 — Hoist static JSX (`FolderCard.tsx`)

**Files:**
- Modify: `src/components/FolderCard.tsx:162`

- [ ] **Step 1: Read.** Locate the `emptyIcon` JSX declared inside the component.

- [ ] **Step 2: Move the const declaration to module scope** (above the component function). Drop any closures over component scope — if there are any, leave inline and skip.

```ts
// Before (inside component):
const emptyIcon = <svg>...</svg>;

// After (above component):
const EMPTY_ICON = <svg>...</svg>;
// inside component, use {EMPTY_ICON}
```

- [ ] **Step 3: Commit.**
```bash
git add src/components/FolderCard.tsx
git commit -m "perf(FolderCard): hoist static empty-state icon to module scope (-1 issue)"
```

### Task 6.4 — `LazyMotion` migration (3 files)

**Files:**
- `src/components/layout/ModernSidebar.tsx:11`
- `src/components/PlaylistTrack.tsx:3`
- `src/components/settings/SettingsModal.tsx:2`

Each saves ~10 KB by switching `motion` → `m` inside a `LazyMotion features={domAnimation}` boundary. PaginatedGallery already uses this pattern — reference it for style.

- [ ] **Step 1 (per file): Read.** Identify every `<motion.X>` and `<AnimatePresence>` usage and which features each animation needs (`opacity`, `x`, `y`, `scale`, `layout`, etc. — all covered by `domAnimation`).

- [ ] **Step 2: Change import.**
```ts
// Before:
import { motion, AnimatePresence } from "framer-motion";

// After:
import { LazyMotion, m, AnimatePresence, domAnimation } from "framer-motion";
```

- [ ] **Step 3: Rename JSX:** `<motion.X>` → `<m.X>`, `</motion.X>` → `</m.X>` (sed-friendly within the file scope).

- [ ] **Step 4: Wrap the component's top-level JSX in `<LazyMotion features={domAnimation}>...</LazyMotion>`.** Only one LazyMotion needed per tree — if a parent already provides it (e.g. PaginatedGallery wraps the gallery subtree), the child does not need its own wrapper. Check tree placement:

| File | Parent that already has LazyMotion? |
|---|---|
| `ModernSidebar.tsx` | No — add wrapper around its JSX root |
| `PlaylistTrack.tsx` | Yes — `PaginatedGallery` wraps `BottomDock` → `PlaylistTrack`. Just swap `motion`→`m`, no new wrapper. |
| `SettingsModal.tsx` | No — add wrapper |

- [ ] **Step 5:** For `PlaylistTrack.tsx`, also remove the `LayoutGroup` import if not actually used after the switch. If it IS used, keep it (`LayoutGroup` is fine inside LazyMotion).

- [ ] **Step 6: Smoke test in dev** — open sidebar (toggle pin), open a playlist (track animations), open settings (modal entrance). Confirm animations still play.

- [ ] **Step 7: Build bundle to confirm reduction.**
```bash
pnpm run build
```
Expected: build succeeds. Optional: compare bundle size against pre-task `dist/` contents.

- [ ] **Step 8: Commit per file.**
```bash
git add src/components/layout/ModernSidebar.tsx
git commit -m "perf(ModernSidebar): switch to LazyMotion m components"
# repeat per file
```

### Phase 6 verification

- [ ] **Verify.**
```bash
pnpm run ci:check
npx react-doctor@latest . 2>&1 | tail -10
```
Expected: -23 issues from this phase.

---

## Phase 7 — Async / parallelization

### Task 7.1 — `await` in loop → `Promise.all` (17 occurrences)

**Files (file:line):**
- `src/shaderStudio/captureShaderPreviewPngs.ts:77, 104`
- `src/utils/galleryDrop.ts:130`
- `src/utils/loopStudio/waitGalleryImport.ts:18`
- `electron/exportWallpapersToFolder.ts:63`
- `electron/shaderWallpaperPreviewWriter.ts:30`
- `src/hooks/useOpenImages.tsx:35`
- `electron/managers/IPCManager.ts:267`
- `electron/scanDirectoryForImports.ts:49`
- `src/stores/foldersStore.ts:32`
- `scripts/vite-plugin-theme-registry.ts:52`
- `e2e/fixtures.ts:85`
- `globals/startDaemons.ts:95, 136`
- `e2e/ui-fixtures.ts:77`
- `e2e/tests/wallpaper.spec.ts:15`
- `src/stores/wallhavenStore.ts:491`

- [ ] **Step 1: For each file, read the loop.** Decide if the iterations are independent or have ordering requirements:
  - **Independent** (most common: importing files, fetching previews, writing assets): convert to `await Promise.all(items.map(async item => { ... }))`.
  - **Ordered** (rarely — usually has shared mutable state or rate limits): leave the loop, but switch from `for…of` over awaits to a manual queue with a concurrency cap if rate is the concern. For this plan: ONLY mark the lint comment `// eslint-disable-next-line react-doctor/async-await-in-loop -- ordered: <reason>` and explain in the commit body.

- [ ] **Step 2: For `globals/startDaemons.ts:95, 136`** — daemon startup almost certainly is ordered (one daemon must come up before the next that depends on it). Verify by reading the surrounding code. If truly ordered, suppress; if not, parallelize.

- [ ] **Step 3: For `electron/managers/IPCManager.ts:267`** — handler iteration is likely independent.

- [ ] **Step 4: Commit per file** so each refactor is reviewable.
```bash
git add <file>
git commit -m "perf(<area>): parallelize independent awaits (-N issues)"
```

### Task 7.2 — Independent sequential `await`s (4 + 1 occurrences)

**Files:**
- `electron/managers/DaemonMonitor.ts:99, 118`
- `e2e/ui-fixtures.ts:202, 220`
- `src/routes/LoopStudio.tsx:377` (`server-sequential-independent-await`)

- [ ] **Step 1: For each, read.** Confirm the second await does NOT use the result of the first.

- [ ] **Step 2: Convert.**
```ts
// Before:
const a = await fetchA();
const b = await fetchB();
return [a, b];

// After:
const [a, b] = await Promise.all([fetchA(), fetchB()]);
return [a, b];
```

- [ ] **Step 3: Commit.**
```bash
git add -A
git commit -m "perf(react-doctor): parallelize independent awaits (-5 issues)"
```

### Task 7.3 — `await` blocking sync early return (1 occurrence)

**Files:**
- `src/hooks/useSetLastActivePlaylist.ts:78`

- [ ] **Step 1: Read** lines 70–95. Identify the `await` that happens before an early-return guard that does NOT use the awaited value.

- [ ] **Step 2: Move the synchronous guard above the await.**
```ts
// Before:
const result = await fetch(...);
if (!isMounted) return; // doesn't use `result`

// After:
if (!isMounted) return;
const result = await fetch(...);
```

- [ ] **Step 3: Commit.**
```bash
git add src/hooks/useSetLastActivePlaylist.ts
git commit -m "perf(useSetLastActivePlaylist): hoist sync guard above await (-1 issue)"
```

### Phase 7 verification

- [ ] **Verify.**
```bash
pnpm run ci:check
npx react-doctor@latest . 2>&1 | tail -10
```
Expected: -22 issues.

---

## Phase 8 — Algorithmic & idiomatic JS

### Task 8.1 — `Array.includes()` in loop → `Set` (7 occurrences)

**Files:**
- `src/utils/settingsSearchIndex.ts:53, 54, 55, 56`
- `src/components/Filters.tsx:182, 198`
- `scripts/vite-plugin-theme-registry.ts:23`

- [ ] **Step 1: For `settingsSearchIndex.ts`** — read context. Lines 53–56 are `e.label.toLowerCase().includes(t)` style **string** includes (not array includes), which IS still O(n) per token. The fix here: precompute `lowerLabel`, `lowerDescription`, etc. ONCE per entry when the index is built, and store in the entry record. Then the loop becomes 4× substring checks on already-lowercased strings.

- [ ] **Step 2: For `Filters.tsx:182, 198`** — read. These are likely `array.includes(filterToken)` in a `.filter()` callback. Convert the search-target array to a `Set` once outside the filter, then `set.has(token)` inside.

- [ ] **Step 3: For `scripts/vite-plugin-theme-registry.ts:23`** — same pattern. Build a `Set` outside the loop.

- [ ] **Step 4: Commit per file.**
```bash
git add src/utils/settingsSearchIndex.ts
git commit -m "perf(settingsSearchIndex): precompute lowercased fields (-4 issues)"
git add src/components/Filters.tsx
git commit -m "perf(Filters): Set for token membership tests (-2 issues)"
git add scripts/vite-plugin-theme-registry.ts
git commit -m "perf(vite-plugin-theme-registry): Set for membership lookup (-1 issue)"
```

### Task 8.2 — `array.find()` in loop → `Map` (1 occurrence)

**Files:**
- `src/utils/loopStudio/waitGalleryImport.ts:24`

- [ ] **Step 1: Read.** Identify the `.find(...)` call inside a loop.

- [ ] **Step 2: Build a `Map` keyed by the find criterion BEFORE the loop.** Use `Map.get(key)` inside.

- [ ] **Step 3: Commit.**
```bash
git add src/utils/loopStudio/waitGalleryImport.ts
git commit -m "perf(waitGalleryImport): Map index instead of find-in-loop (-1 issue)"
```

### Task 8.3 — `.filter().map()` → single pass (6 occurrences)

**Files:**
- `src/shaderStudio/shadertoyImport.ts:84`
- `src/utils/galleryDrop.ts:84, 94`
- `src/routes/LoopStudio.tsx:81, 650`
- `src/components/settings/sections/BackendSettingsSection.tsx:771`

- [ ] **Step 1: For each, read.** Convert to `.reduce()` accumulating only the mapped values that pass the filter:
```ts
// Before:
const out = items.filter(x => isValid(x)).map(x => transform(x));

// After:
const out = items.reduce<T[]>((acc, x) => {
  if (isValid(x)) acc.push(transform(x));
  return acc;
}, []);
```

Or `.flatMap()` if the filter is `Boolean(transform(x))`:
```ts
const out = items.flatMap(x => isValid(x) ? [transform(x)] : []);
```

Prefer `.flatMap()` for readability when applicable. Use `.reduce()` only when the transform is heavy and re-running `transform()` for the filter check would be wasteful.

- [ ] **Step 2: Commit.**
```bash
git add -A
git commit -m "perf(react-doctor): single-pass filter+map (-6 issues)"
```

### Task 8.4 — `.map().filter(Boolean)` → `.flatMap()` (1 occurrence)

**Files:**
- `scripts/vite-plugin-theme-registry.ts:17`

- [ ] **Step 1: Read.** Convert to `.flatMap(x => predicate(x) ? [value] : [])`.

- [ ] **Step 2: Commit.**
```bash
git add scripts/vite-plugin-theme-registry.ts
git commit -m "perf(vite-plugin-theme-registry): flatMap instead of map+filter (-1 issue)"
```

### Task 8.5 — `[...arr].sort()` → `.toSorted()` (7 occurrences)

**Files:**
- `src/components/PlaylistTrack.tsx:141`
- `src/hooks/useFilteredImages.ts:20`
- `src/utils/playlistStripReorder.ts:24`
- `src/utils/skipStartAfterPlaylistSave.ts:7, 8`
- `src/components/settings/sections/BackendSettingsSection.tsx:891`
- `src/stores/__tests__/playlist.test.ts:220`

- [ ] **Step 1: For each, read the surrounding line.**

- [ ] **Step 2:** Replace `[...arr].sort(cmp)` → `arr.toSorted(cmp)`. If TypeScript complains the array element type doesn't have a `toSorted` (lib target too low), bump `lib` to `ES2023` in `tsconfig.json` or use the explicit array prototype method shim — but oxlint already passes the rule, so the type should already be available.

- [ ] **Step 3: Run vitest where applicable.**
```bash
pnpm test
```

- [ ] **Step 4: Commit.**
```bash
git add -A
git commit -m "perf(react-doctor): toSorted instead of spread+sort (-7 issues)"
```

### Task 8.6 — Length check before `.every()` (2 occurrences)

**Files:**
- `src/components/ImageDetailSidebar.tsx:257`
- `src/utils/skipStartAfterPlaylistSave.ts:9`

- [ ] **Step 1: For each, read** the comparison pattern. Convert:
```ts
// Before:
if (a.every((x, i) => x === b[i])) ...

// After:
if (a.length === b.length && a.every((x, i) => x === b[i])) ...
```

- [ ] **Step 2: Commit.**
```bash
git add -A
git commit -m "perf(react-doctor): length-check before every (-2 issues)"
```

### Phase 8 verification

- [ ] **Verify.**
```bash
pnpm run ci:check
npx react-doctor@latest . 2>&1 | tail -10
```
Expected: -24 issues.

---

## Phase 9 — Accessibility

### Task 9.1 — Labels without associated controls (5 occurrences)

**Files:**
- `src/components/settings/InlineThemeSelector.tsx:126`
- `src/components/ImageDetailSidebar.tsx:1349`
- `src/components/settings/sections/AppSettingsSection.tsx:307`
- `src/components/FolderImportModal.tsx:54, 78`

- [ ] **Step 1: For each, read** the `<label>...</label>` element and the input it should associate with.

- [ ] **Step 2: Choose one of:**
  - Wrap the input inside the `<label>` element (preferred when input is visually next to label).
  - Add `htmlFor` to the `<label>` and a matching `id` to the input.
  - If the label is decorative (no associated control), change to `<span>` or `<div>`.

- [ ] **Step 3: Commit.**
```bash
git add -A
git commit -m "fix(a11y): associate form labels with controls (-5 issues)"
```

### Task 9.2 — Click handlers without key handlers (4 occurrences)

**Files:**
- `src/components/ImageCard.tsx:483, 568`
- `src/components/FolderCard.tsx:196`
- `src/routes/Wallhaven.tsx:598`

- [ ] **Step 1: For each, read** the `<div onClick=...>` element.

- [ ] **Step 2: Convert to `<button type="button">`** if the element is purely a control. This is the cleanest fix because buttons get keyboard handling free.

- [ ] **Step 3: If the element must remain a `<div>`** (because it wraps complex content with its own interactive children — e.g. ImageCard wraps an image + child buttons), add:
  - `role="button"`
  - `tabIndex={0}`
  - `onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onClickHandler(e); } }}`

- [ ] **Step 4: Commit.**
```bash
git add -A
git commit -m "fix(a11y): add keyboard handlers / use buttons for clickable elements (-4 issues)"
```

### Task 9.3 — Static element with interactions (1 occurrence)

**Files:**
- `src/routes/Wallhaven.tsx:598`

- [ ] **Step 1:** This overlaps with Task 9.2's `Wallhaven.tsx:598`. The same fix (convert to `<button>` or add `role`/`tabIndex`/keyboard handlers) resolves both rules.

- [ ] **Step 2:** If Task 9.2 was already merged for this line, this task is automatically resolved.

- [ ] **Step 3: Verify** by re-running react-doctor.

### Task 9.4 — `autoFocus` attribute (1 occurrence)

**Files:**
- `src/components/FolderPickerModal.tsx:231`

- [ ] **Step 1: Read** line 231. Decide: is autoFocus genuinely needed for the user flow (e.g. it's a search input in a modal that just opened)?

- [ ] **Step 2:**
  - **If yes:** keep autoFocus but suppress the rule for this line with `// oxlint-disable-next-line jsx-a11y/no-autofocus` and a comment explaining why.
  - **If no:** remove `autoFocus`.

For modal search inputs, autoFocus IS appropriate (focus management for accessibility is improved, not harmed). Suppress with rationale.

- [ ] **Step 3: Commit.**
```bash
git add src/components/FolderPickerModal.tsx
git commit -m "fix(a11y): document autoFocus rationale on folder picker (-1 issue)"
```

### Phase 9 verification

- [ ] **Verify.**
```bash
pnpm run ci:check
npx react-doctor@latest . 2>&1 | tail -10
```
Expected: -11 issues.

---

## Phase 10 — Form `preventDefault` decisions (5 occurrences)

**Context:** Waypaper is an Electron app. JavaScript is always present; progressive enhancement (server actions) is irrelevant. The rule fires because forms use `<form onSubmit={e => { e.preventDefault(); ... }}>`. The fix is to either:
(a) replace `<form>` with a `<div>` + explicit `<button onClick>` if the form-ness wasn't load-bearing, or
(b) keep the form but document the suppression.

**Files:**
- `src/components/LoadPlaylistModal.tsx:170`
- `src/components/AdvancedFiltersModal.tsx:67`
- `src/components/SavePlaylistModal.tsx:152`
- `src/components/AddToPlaylistModal.tsx:160`
- `src/components/PlaylistConfigurationModal.tsx:185`

### Task 10.1 — Audit + fix

- [ ] **Step 1: For each form, read** to see if it actually uses form semantics (`form.requestSubmit()`, Enter-key submission, native validation, FormData reads). If yes → keep form + suppress rule. If no → convert to `<div>` + click handler.

- [ ] **Step 2:** In practice for these modals: Enter-key submission IS used. So they keep `<form>` and we suppress the rule:
```tsx
{/* oxlint-disable-next-line react-doctor/no-prevent-default -- Electron app: JS always present, form gives us Enter-to-submit */}
<form onSubmit={(e) => { e.preventDefault(); save(); }}>
```

- [ ] **Step 3: Apply identical suppression to all 5 files.**

- [ ] **Step 4: Commit.**
```bash
git add -A
git commit -m "fix(react-doctor): document preventDefault on forms (Electron app) (-5 issues)"
```

### Phase 10 verification

- [ ] **Verify.**
```bash
pnpm run ci:check
npx react-doctor@latest . 2>&1 | tail -10
```
Expected: -5 issues.

---

## Phase 11 — Handler naming (8 occurrences)

**Files:**
- `src/components/ImageCard.tsx:434, 519`
- `src/routes/History.tsx:109`
- `src/components/FolderCard.tsx:183`
- `src/routes/Wallhaven.tsx:511`
- `src/components/settings/sections/BackendSettingsSection.tsx:561, 615, 664`

### Task 11.1 — Rename handlers to describe actions

- [ ] **Step 1: For each occurrence, read** the handler. Identify what it actually does.

- [ ] **Step 2: Rename** from `handleClick` / `handleChange` to a verb describing the action. Use `grep -n "handleClick"` within the file to update every call site (the prop pass and any deps array entries).

Examples (your specific renames will depend on what each handler does):
- `handleClick` on an image card → `openImageDetails` / `toggleImageSelection`
- `handleClick` on a folder card → `enterFolder`
- `handleClick` on history row → `restoreFromHistory`
- Backend settings handlers → `saveBackend`, `testConnection`, `clearCache`, etc.

- [ ] **Step 3: Commit per file (or one combined commit if small).**
```bash
git add -A
git commit -m "refactor(react-doctor): rename generic handlers to action names (-8 issues)"
```

### Phase 11 verification

- [ ] **Verify.**
```bash
pnpm run ci:check
npx react-doctor@latest . 2>&1 | tail -10
```
Expected: -8 issues.

---

## Phase 12 — Giant component refactors (9 occurrences)

Each file flagged as "giant" needs a structural split. This is the longest phase. Treat each file as its own mini-project.

**Files & sizes (from diagnostics):**
1. `src/components/ImageCard.tsx:39` — 556 lines
2. `src/routes/ShaderStudio.tsx:93` — 518 lines (also has 9 useStates)
3. `src/components/ImageDetailSidebar.tsx:895` — 1500+ lines (also has multiple useReducer candidates)
4. `src/components/settings/sections/BackendSettingsSection.tsx:831` — 800+ lines
5. `src/routes/LoopStudio.tsx:74` — 1100+ lines
6. `src/components/PlaylistTrack.tsx:102`
7. `src/routes/Wallhaven.tsx:31`
8. `src/components/layout/ModernSidebar.tsx:157`
9. `src/components/Filters.tsx:111`

For each, the refactor follows the same shape. Pick a tractable order (smallest first to build confidence): Filters → PlaylistTrack → Wallhaven → ModernSidebar → ImageCard → ShaderStudio → BackendSettingsSection → LoopStudio → ImageDetailSidebar.

### Task 12.x template (apply per file)

- [ ] **Step 1: Read the full file** to understand its structure. List the major sections (header, body, actions, list, footer, etc.).

- [ ] **Step 2: Identify pure presentational subtrees** that take props but don't need component-local state. Each becomes its own file under `src/components/<original>/<Section>.tsx`.

- [ ] **Step 3: Extract one subtree at a time:**
  1. Create the new file.
  2. Move the JSX + any helper functions used only by it.
  3. Define the prop interface.
  4. Replace the original block with `<ExtractedSection {...props} />`.
  5. Run `pnpm exec tsc --noEmit` and `pnpm test` to confirm nothing broke.
  6. Commit: `refactor(<file>): extract <Section> (<original-line-count>→<new-line-count>)`.

- [ ] **Step 4: Repeat extraction** until the parent file is under ~300 lines OR until no further pure-subtree extraction is obvious.

- [ ] **Step 5: When applicable, fold in the `prefer-useReducer` rule for this same file** — by the time you've extracted subcomponents, the remaining state in the parent is usually small and either consolidates cleanly into a reducer or splits naturally with the components.

- [ ] **Step 6: Smoke-test the affected UI in dev.**

**Per-file notes:**

- **`Filters.tsx` (Task 12.1):** Pull out filter pill groups (`SourceFilters`, `RatioFilters`, `TagFilters`) and the keyboard cheatsheet trigger.
- **`PlaylistTrack.tsx` (Task 12.2):** Extract `TrackItem`, `TrackHeader`, drag handle.
- **`Wallhaven.tsx` (Task 12.3):** Split into `WallhavenSearch`, `WallhavenResults`, `WallhavenDetailPane`.
- **`ModernSidebar.tsx` (Task 12.4):** Extract `SidebarNav`, `SidebarFooter`, `SidebarRail`. NOTE: this is also a `LazyMotion` target (Task 6.4) — do the motion migration first so the extracted children import `m` not `motion`.
- **`ImageCard.tsx` (Task 12.5):** Extract `ImageCardActions`, `ImageCardOverlay`, `ImageCardBadges`, `ImageCardThumbnail`.
- **`ShaderStudio.tsx` (Task 12.6):** Extract `ShaderEditorPane`, `ShaderPreviewPane`, `ShaderControlsPane`. After this, fold the 9 useStates into a reducer (Task 5.2 deferred).
- **`BackendSettingsSection.tsx` (Task 12.7):** Each backend (Hyprland, Mpvpaper, wal-qt, etc.) becomes its own section component.
- **`LoopStudio.tsx` (Task 12.8):** Extract `LoopStudioToolbar`, `LoopStudioTimeline`, `LoopStudioPreview`, `LoopStudioExport`.
- **`ImageDetailSidebar.tsx` (Task 12.9):** Largest file. Extract `MetadataPanel`, `PlaylistsPanel`, `MonitorsPanel`, `ActionsBar`, `TagEditor`, `ColorSwatchPanel`.

### Phase 12 verification

After each file's extraction is complete, re-run react-doctor and confirm the `giant-component` flag is gone for that file. After all 9:

- [ ] **Verify.**
```bash
pnpm run ci:check
npx react-doctor@latest . 2>&1 | tail -10
```
Expected: -9 giant-component issues; usually also drops several prefer-useReducer and rerender-state-only-in-handlers issues that overlapped.

---

## Phase 13 — e2e fixture hook violations (4 occurrences)

**Files:**
- `e2e/fixtures.ts:208, 214`
- `e2e/ui-fixtures.ts:213, 222`

**Diagnosis:** Lint complains that React Hook `use` is called inside an async function. In Playwright fixtures, the `use(...)` is **Playwright's** `use` callback — *not* React's `use` hook. The oxlint rule is misfiring on the name.

### Task 13.1 — Suppress with rationale

- [ ] **Step 1: Read** each location to confirm the `use(...)` call is from a Playwright fixture argument (`async ({ ... }, use) => { await use(value); }`), NOT React's `use`.

- [ ] **Step 2: Suppress per line.**
```ts
// oxlint-disable-next-line react-hooks/rules-of-hooks -- Playwright fixture `use`, not React `use`
await use(value);
```

- [ ] **Step 3: Commit.**
```bash
git add e2e/fixtures.ts e2e/ui-fixtures.ts
git commit -m "fix(e2e): suppress react-hooks false positive for Playwright use() (-4 issues)"
```

### Phase 13 verification

- [ ] **Verify.**
```bash
pnpm run ci:check
npx react-doctor@latest . 2>&1 | tail -10
```
Expected: -4 errors (errors count to 0).

---

## Phase 14 — Dead code cleanup

**147 issues total**, but mostly false positives waiting to be filtered (entry points, dynamically loaded modules, build config). Approach: build the kill list, verify each entry, then delete.

### Task 14.1 — Filter knip false positives in `unused files`

**Source:** `knip/files` rule, 33 entries.

- [ ] **Step 1: For each path** in the diagnostic file (`/tmp/react-doctor-37a09f51-.../knip--files.txt`), classify:
  - **Entry points** (do NOT delete, mark as keep): `electron/main.ts`, `electron/preload.ts`, `e2e/playwright.config.ts`, `e2e/playwright-ui.config.ts`, `docs/.vitepress/config.mts`, `docs/.vitepress/theme/index.ts`.
  - **Build-config tools** that are entry points but referenced indirectly: `scripts/vite-plugin-theme-registry.ts` (used in `vite.config.ts`).
  - **Dynamically loaded** (verify by grepping for the filename in source as a string): `globals/menus.ts`, `globals/setup.ts`, `globals/startDaemons.ts`, `shared/constants.ts`, anything in `electron/managers/`.
  - **Genuinely dead:** old screen wrappers, generated types files no longer imported.

Run this verification grep per suspected-orphan file:
```bash
fname=$(basename <path> .ts)
grep -rn "$fname" --include="*.ts" --include="*.tsx" --include="*.json" --include="*.mts" --include="*.cjs" -l
```
If only the file itself appears, it really is unreferenced.

- [ ] **Step 2: Configure knip** to know about the entry points. Add or update `knip.json` / `knip.config.ts` at the project root:
```json
{
  "entry": [
    "electron/main.ts",
    "electron/preload.ts",
    "e2e/playwright.config.ts",
    "e2e/playwright-ui.config.ts",
    "docs/.vitepress/config.mts",
    "docs/.vitepress/theme/index.ts",
    "scripts/vite-plugin-theme-registry.ts"
  ],
  "project": [
    "src/**/*.{ts,tsx}",
    "electron/**/*.ts",
    "shared/**/*.ts",
    "globals/**/*.ts",
    "scripts/**/*.ts",
    "e2e/**/*.ts"
  ]
}
```
(If the file already exists, merge — do not overwrite — and update the entries to include any project-specific patterns already present.)

- [ ] **Step 3: Re-run react-doctor** to confirm the false-positive count drops.
```bash
npx react-doctor@latest . 2>&1 | grep -A2 "knip/files"
```

- [ ] **Step 4: Delete the genuinely unused files** that remain. For each, also remove orphaned tests if any.

- [ ] **Step 5: Commit knip config + deletions separately.**
```bash
git add knip.json # or knip.config.ts
git commit -m "chore(knip): register entry points to suppress false positives"
git rm <list-of-truly-unused-files>
git commit -m "chore(dead-code): remove unused files (-N issues)"
```

### Task 14.2 — Unused exports (28 occurrences)

**Source:** `knip/exports` rule.

- [ ] **Step 1: Read each export's file** and remove the `export` keyword (turning the symbol into a module-private declaration) OR delete the symbol entirely if also unused within its file.

- [ ] **Step 2:** Special cases to NOT touch:
  - Any export consumed by the production Electron build via `electron-builder` config.
  - Any export consumed by tests in workspace siblings that are not part of `waypaper-engine` (unlikely but check).

- [ ] **Step 3: After each batch, run `pnpm run ci:check`** to confirm nothing depends on the removed exports.

- [ ] **Step 4: Commit in groups of ~5 exports** to keep diffs reviewable.
```bash
git add -A
git commit -m "chore(dead-code): remove unused exports batch N (-K issues)"
```

### Task 14.3 — Unused types (68 occurrences)

**Source:** `knip/types` rule.

- [ ] **Step 1: For each type/interface** flagged, search the codebase:
```bash
grep -rn "<TypeName>" --include="*.ts" --include="*.tsx" | grep -v "/<file-with-decl>:"
```
If no consumers, delete the declaration.

- [ ] **Step 2:** Special case: types from `daemon-go-types.generated.ts` should NOT be hand-edited. If it's the generated file flagging unused types, configure knip to ignore it instead (`.knipignore` or per-rule ignore in config).

- [ ] **Step 3: Commit in batches of ~10 type removals.**
```bash
git add -A
git commit -m "chore(dead-code): remove unused types batch N (-K issues)"
```

### Task 14.4 — Duplicate exports (18 occurrences)

**Source:** `knip/duplicates` rule — same symbol exported from two places (likely default + named).

- [ ] **Step 1: For each file** in the diagnostic, identify the duplicate (e.g. `export default X` AND `export const X = ...` AND `export { X }`).

- [ ] **Step 2: Pick ONE export form per symbol.** Prefer named exports unless a consumer specifically does `import X from`; for those, keep default and remove the named export.

- [ ] **Step 3: Update any inconsistent import sites** to match.

- [ ] **Step 4: Commit.**
```bash
git add -A
git commit -m "chore(dead-code): canonical exports, remove duplicates (-18 issues)"
```

### Phase 14 verification

- [ ] **Verify.**
```bash
pnpm run ci:check
npx react-doctor@latest . 2>&1 | tail -10
```
Expected: -130 to -147 issues (depends on how many were false positives).

---

## Phase 15 — Final verification & sweep

- [ ] **Step 1: Run full suite.**
```bash
pnpm run ci:check
pnpm run test:daemon
```
Expected: PASS.

- [ ] **Step 2: Run react-doctor.**
```bash
npx react-doctor@latest . 2>&1 | tail -15
```
Expected: score ≥ 90 / 100. Remaining issues should be either:
- Genuinely intentional, with `oxlint-disable-next-line` comments and rationale.
- New issues introduced by Phase 12 refactors (rare; address inline).

- [ ] **Step 3: If issue count > 30 (i.e. unexpected residue),** run `--verbose` and audit each remaining rule against this plan. Add a small follow-up task per residual cluster.

- [ ] **Step 4: Manual smoke test in dev.**
```bash
pnpm run dev
```
Walk the major flows:
1. Open gallery, scroll, marquee select, drag to playlist.
2. Drag-and-drop an image from the OS.
3. Open ImageDetailSidebar, edit tags, close.
4. Switch themes (light / dark / neobrutalist).
5. Open Shader Studio, load a sample, save.
6. Open Loop Studio, import clip, export.
7. Configure a playlist, save, load on app restart.
8. Open settings → backends, switch active backend, toggle wal-qt options.
9. Right-click for context menu in gallery and on a playlist track.
10. Resize window between 800px wide and ultrawide; confirm gallery grid still feels right (this also exercises last week's Tailwind breakpoint fix).

Any regression here: open an issue and fix it before merging.

- [ ] **Step 5: Final commit.**
```bash
git commit --allow-empty -m "chore(react-doctor): plan complete — score N/100"
```
Replace `N` with the actual final score.

---

## Self-review checklist (executor: read this before starting)

- The plan groups issues by *type of fix*, not by *file*. Several files appear in multiple phases (e.g. `ImageDetailSidebar.tsx` is in Phases 1, 3, 4, 5, 6, 8, 12). That's intentional — each pass exposes only the change that pass cares about, keeping commits focused.
- Phases 1, 7, 8, 14 are largely mechanical and can be parallelized across subagents.
- Phase 12 (giant components) is sequential because each refactor depends on the file being relatively quiescent.
- If any task discovers behavior you can't preserve, STOP, surface the conflict to the human reviewer, and skip that one task — do not silently regress.
- The plan never asks you to write new features. Any "extract section" task is a pure move, not a redesign.

---

## Quick reference: issue → phase

| Rule | Count | Phase | Task |
|---|---|---|---|
| design-no-redundant-size-axes | 68 | 1 | 1.1 |
| design-no-redundant-padding-axes | 1 | 1 | 1.2 |
| design-no-bold-heading | 15 | 1 | 1.3 |
| design-no-em-dash-in-jsx-text | 9 | 1 | 1.4 |
| design-no-three-period-ellipsis | 2 | 1 | 1.5 |
| design-no-vague-button-label | 4 | 1 | 1.6 |
| no-side-tab-border | 2 | 1 | 1.7 |
| no-pure-black-background | 2 | 1 | 1.8 |
| no-z-index-9999 | 1 | 1 | 1.9 |
| rendering-svg-precision | 1 | 1 | 1.10 |
| no-react19-deprecated-apis | 6 | 2 | 2.1–2.5 |
| effect-needs-cleanup | 3 | 3 | 3.1–3.3 |
| no-mutable-in-deps | 1 | 3 | 3.4 |
| rerender-functional-setstate | 2 | 3 | 3.5–3.6 |
| no-array-index-as-key | 3 | 3 | 3.7 |
| no-effect-event-handler | 8 | 4 | 4.1–4.8 |
| prefer-use-effect-event | 4 | 4 | 4.9 |
| no-derived-useState | 5 | 4 | 4.10 |
| no-cascading-set-state | 6 | 5 | 5.1 |
| prefer-useReducer | 8 | 5 / 12 | 5.2 + 12.x |
| rerender-state-only-in-handlers | 17 | 6 | 6.1 |
| rendering-usetransition-loading | 2 | 6 | 6.2 |
| rendering-hoist-jsx | 1 | 6 | 6.3 |
| use-lazy-motion | 3 | 6 | 6.4 |
| async-await-in-loop | 17 | 7 | 7.1 |
| async-parallel | 4 | 7 | 7.2 |
| server-sequential-independent-await | 1 | 7 | 7.2 |
| async-defer-await | 1 | 7 | 7.3 |
| js-set-map-lookups | 7 | 8 | 8.1 |
| js-index-maps | 1 | 8 | 8.2 |
| js-combine-iterations | 6 | 8 | 8.3 |
| js-flatmap-filter | 1 | 8 | 8.4 |
| js-tosorted-immutable | 7 | 8 | 8.5 |
| js-length-check-first | 2 | 8 | 8.6 |
| jsx-a11y/label-has-associated-control | 5 | 9 | 9.1 |
| jsx-a11y/click-events-have-key-events | 4 | 9 | 9.2 |
| jsx-a11y/no-static-element-interactions | 1 | 9 | 9.3 |
| jsx-a11y/no-autofocus | 1 | 9 | 9.4 |
| no-prevent-default | 5 | 10 | 10.1 |
| no-generic-handler-names | 8 | 11 | 11.1 |
| no-giant-component | 9 | 12 | 12.1–12.9 |
| react-hooks/rules-of-hooks (e2e) | 4 | 13 | 13.1 |
| knip/files | 33 | 14 | 14.1 |
| knip/exports | 28 | 14 | 14.2 |
| knip/types | 68 | 14 | 14.3 |
| knip/duplicates | 18 | 14 | 14.4 |
| **TOTAL** | **405** | | |
