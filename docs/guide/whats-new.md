# What changed in v3

The big shift is replacing the old **Node.js** backend with a **Go daemon**: one process owns gallery state, playlist scheduling, image processing, and backend orchestration. It exposes a **chi** HTTP router on the socket, a **Cobra** CLI, a **pub/sub event bus** wired to **SSE** (`/events`), and pluggable **Go** `backend` packages. Storage is **CloverDB**.

## Backend surface — `Apply` + capabilities

Backends now expose a single **`Apply`** entrypoint with declared **`Capabilities`**; the legacy `WallpaperRequest` / `TryBatchRestore` paths are gone. Auto mode reads capabilities per media type. See `daemon/internal/backend/README.md` in the repo for the current contract — that file is the source of truth for adding a new setter.

## Design system pass

The UI got a tokens + density sweep. Highlights:

- **UI Scale** setting (`compact` / `default` / `comfortable` / `large`) — scales the renderer, sidebar rail, and icons. Lives in **Settings → General → Theme & Appearance**. See [The app — Settings](/guide/app#settings).
- **Font scale tokens** + **muted text tokens** (`--wp-text-muted`, `--wp-text-faint`) — replaced ad-hoc `opacity-60/70` sweeps.
- **`<Kbd>`** primitive for keyboard hints (used in Looper and Shader studios).
- **Neobrutalist radius** slider wired to `--wp-radius-*` tokens; gallery cards and sidebar respect it.
- **Image details sidebar** — redesigned: tighter type scale, restructured metadata, palette swatch delete, sticky footer.
- **Settings modal** — density pass: token sweep, dropped dead `xl:` ramps, lighter header weight.

## Wallhaven route

The in-app Wallhaven browser is now closer to feature parity with the gallery:

- **Resolution-match** badge per result (exact / good / poor vs. largest monitor).
- **NSFW blur** toggle (`config.wallhaven.blur_nsfw_thumbnails`) — unblurs on hover.
- **Ratio filter** chips, **color filter** swatch picker.
- **Hide downloaded** toggle to skip wallpapers already in the gallery.
- **Set popover** on cards (per-monitor set), inline **download** and **playlist** menu icons.
- **Clickable tags** in the detail modal — click to seed a new search.
- **Selection bar** + **back-to-top** in long result sets.
- Detail modal scales to viewport and uses the full-resolution image, not the 600px thumb.

See [The app — Wallhaven](/guide/app#wallhaven-wallhaven).

## Contrast audit

`pnpm run audit:contrast` (script: `scripts/audit-contrast.mjs`, uses `culori`) checks token contrast pairs across themes. Output is `audit-contrast.json` at the repo root. Useful when adding a theme or shifting muted-text tokens.

## Migration assumptions

If you are carrying notes from older versions, treat [the API contract on GitHub](https://github.com/0bCdian/Waypaper-Engine/blob/main/daemon/API_CONTRACT.md) and [OpenAPI](/api/openapi) as the current surface; the daemon’s [`routes.go` on GitHub](https://github.com/0bCdian/Waypaper-Engine/blob/main/daemon/internal/server/routes.go) is the final word on which paths exist.
