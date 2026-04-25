# Plan: Fix React Doctor issues (Electron GUI)

This plan orders work by **risk / payoff** and ties each item to **why it matters** for a desktop Electron app (React 19 + React Compiler) and **how we avoid regressions**.

---

## Context: what matters in an Electron GUI

| Factor | Implication |
|--------|-------------|
| **No SSR** | “Impure render” / `Date.now()` are not hydration bugs, but they **still** cause **nondeterministic UI** on re-renders and can **fight the React Compiler** — worth fixing where flagged. |
| **Single embedded webview** | Cascading renders and unnecessary effects still cost **CPU**; large lists (gallery) amplify this. |
| **Keyboard + screen reader users** | A11y findings matter for **desktop** users (Tab, Enter, focus). Not “web-only.” |
| **Progressive enhancement / `form action`** | **Low priority** here: the UI does not need to work without JS. Warnings are **informational** unless you want stricter a11y patterns. |
| **React Compiler** | “Can’t optimize” means **lost compiler benefits** — treat as **tech debt** with performance/maintainability impact, not always user-visible bugs. |

**Reference command:** `npx -y react-doctor@latest . --verbose --diff` (from repo root).

Last scan (representative): **79 / 100**, 35 errors, 51 warnings; issues span Settings, Filters, modals, Loop/Shader routes, `ThemeContext`, context menus, gallery cards, Wallhaven, etc. Re-run after each phase to confirm errors trend down.

---

## Phase 0: Baseline (regression safety net)

**Goal:** Later changes can be compared to a known-good state.

1. Record current React Doctor **score and diagnostic list** (same branch/diff you use for quality).
2. **Automated gate (must stay green after each phase):**
   - `npx tsc --noEmit`
   - `npm run lint:check`
   - `npm test` (Vitest)
3. **E2E:** Note which `e2e/` flows touch **Settings**, **Filters**, **Modals**, **Wallhaven**, **Loop/Shader** — manual or Playwright pass should cover touched areas.

**Optional:** Add/extend a **smoke e2e** (Settings tabs, one modal, keyboard activation) where coverage is missing.

**Exit criterion:** A short **checklist** (or script) run before/after every phase/PR.

---

## Phase 1: High-signal, localized fixes (low regression risk)

**Why:** **Pattern fixes** in a few files; behavior should match user intent: same UI, fewer footguns for the Compiler and future edits.

| Theme | Why it’s a problem (Electron) | Direction |
|-------|------------------------------|-----------|
| **`Date.now()` in render** (`DaemonStatusComponent`) | Re-renders can show **flicker or inconsistent “now”**; Compiler flags impure render. | Move to **effect** + state, a **ticking clock** in an effect, or a **stable timestamp** from props/store. |
| **Refs read during render** (`ConfirmDialog`, `AppSettingsSection`) | Breaks **update ordering**; can cause **stale UI** when dialog/settings open/close. | Use `ref.current` only in **effects** or **event handlers**; `useLayoutEffect` for layout if needed. |
| **Hooks as values** + **inner `Inner` in `Filters`** | Rules-of-hooks / **remounts child** — bad for **filters** (lost focus, reset). | **Stable child** at module scope; do not pass hooks as data. |
| **Trivial `useMemo`** (`Filters`) | **Extra work** every render. | Remove or replace with a **plain derived value**. |

**Regression testing**

- **Unit:** Update/add tests for `Filters` and dialog-related components where `__tests__` exist.
- **Manual:** Open **Filters**, edit query, blur/focus — no reset loop.
- **E2E (if available):** Settings + one **Confirm** path.

---

## Phase 2: `useEffect` and state synchronization (medium risk)

**Why:** Synchronous `setState` in effects **extra render passes**; in dense UIs (settings, modals) this can feel like **jank** or **focus bugs**. The Electron main/renderer model still has **one UI thread** for the window.

**Files previously flagged (examples):** `SettingsTabs`, `Monitor`, `SettingsSearch`, `BackendSettingsSection`, `FolderPickerModal`, plus “reset state in effect” / “effect simulating handler” on several modals.

**Direction (conceptual only):**

- **Derive during render** when possible: `const x = f(prop)` instead of `useState` + `useEffect` to mirror props.
- **Reset on identity change** with **`<Section key={…} />`** instead of effects that zero many fields.
- **Move** “when X, do Y” to the **event** that caused X (open modal, select row) when that matches the real UX.

**Regression testing**

- **RTL/component tests** for **SettingsSearch** and **SettingsTabs** (search query, active tab, **no effect loops**).
- **E2E:** All **Settings** tabs; **settings search**; **Monitor** if applicable; **FolderPicker** open/cancel/confirm; **Backend** patch still works (per test env: mock or live daemon).
- **Behavioral:** **No extra flash** on tab change; **no cursor jump** in search.

**Ship in small PRs** (e.g. Settings cluster vs modals) to bisect regressions.

---

## Phase 3: React Compiler — `try/catch` in render paths

**Why:** The Compiler can’t **optimize** those regions. Often not a user bug, but **worse deopt** on hot paths (`ThemeContext`, **Loop/Shader**).

**Strategy:** **Move `try/catch` out** of the render function: helpers returning `Result` types; or parse in **handlers** / **loaders** / **effects** depending on when data is needed.

**Regression testing**

- **Unit tests** for theme, shadertoy/JSON import, loop-related utilities — cover **error paths** (invalid JSON, parse failure) so success and failure match previous behavior.
- **Manual:** Theme switch; Shader JSON import; Loop actions touching flagged lines.

---

## Phase 4: A11y and markup (verify keyboard/desktop UX)

**Why in Electron:** **Tab** through gallery and modals; screen reader users on all platforms. Click-only **`<div onClick>`** without keyboard support is a **real desktop bug**.

| Type | Note |
|------|------|
| **Clickable non-interactive + no keyboard** | Prefer **`<button type="button">`**, or **`role` + `tabIndex` + `onKeyDown` (Enter/Space)**. |
| **Static elements + handlers need `role`** | Align with the above. |
| **Form labels** | **`label` + `htmlFor`** or **`aria-label`**. |
| **`autoFocus`** | Can break focus order — remove or **focus after open** in `useLayoutEffect` with a clear UX reason. |
| **Index as `key`** | Reorder bugs in **menus/lists** — use **stable ids**. |
| **Form `preventDefault` / “server action”** | **Deprioritize** in Electron unless adopting a stricter a11y policy. |

**Regression testing**

- **Keyboard-only pass:** gallery card, folder card, **Wallhaven**, modals (Tab, Enter, Esc).
- **RTL:** Accessible name / role on **one representative** control per file class, where tests already exist.
- **E2E (optional):** same action via **click** and **keyboard** if stable.

---

## Phase 5: Cosmetic / debt (optional)

- **Very large components** — extract **presentational** pieces only; **no behavior change**; same E2E + tests.
- **`useReducer` suggestions** — only if Phase 2 still leaves **tangled** state; otherwise YAGNI.
- **`z-index: 9999`**, **pure `bg-black`** — verify **stacking** (modals over gallery) in **light and dark** themes.
- **Form PE warnings** — lowest priority for this app.

**Regression testing:** visual smoke + existing E2E.

---

## Cross-cutting: “regression free” definition

1. **CI / pre-merge:** `tsc` + `lint:check` + `npm test` + **E2E** (full or **documented subset** in CI if slow).
2. **React Doctor:** re-run with same flags; **error count should not increase**; target **monotonic decrease** in **errors** (warnings can be phased).
3. **Manual smoke (short):** launch → gallery → set wallpaper (if in scope) → **Settings** → one **modal** → **Wallhaven** if touched.
4. **PR checklist:** for each touched file in Phases 2–3, name at least one **test or e2e step** that covers it.

---

## Suggested execution order

1. **Phase 0** — baseline and checklist.
2. **Phase 1** — impure render, ref usage, `Filters` structure, trivial memo.
3. **Phase 2** — effects/derived state (**small PRs** per area).
4. **Phase 3** — Compiler `try/catch` refactors.
5. **Phase 4** — a11y in **batches** by route.
6. **Phase 5** — as time allows.

This order addresses **correctness and Compiler issues first**, then **behavior-heavy effects**, then **a11y** with keyboard verification—minimizing risk of **window-level regressions** while keeping **Vitest** and **Playwright** as the main safety net.
