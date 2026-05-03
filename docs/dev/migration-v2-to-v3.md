# Migration plan: Waypaper Engine v2 → v3

This document describes how to migrate **user playlists and images** from **Waypaper-Engine** (v2, SQLite + Electron/legacy daemon) into **waypaper-engine** (v3, CloverDB + Go daemon). It is analysis-only; implementation is out of scope here.

**Repos analyzed**

- **v2:** `Waypaper-Engine` at branch `main`
- **v3:** `waypaper/waypaper-engine` at branch `feature/image-detail-editable-colors` (current working branch at time of writing)

---

## 1. Sources of truth

| Area | v2 | v3 |
|------|----|----|
| **Gallery DB** | SQLite: `~/.waypaper_engine/images_database.sqlite3` (`database/database.ts`) | CloverDB under `daemon.database_dir`; default **`~/.local/share/waypaper-engine/db`** (`daemon/internal/system/paths.go`) |
| **Cached image files** | **`~/.waypaper_engine/images/<filename>`** (`globals/config.ts`; aligns with DB `Images.name`) | Default **`~/.local/share/waypaper-engine/images`** |
| **Playlist persistence** | Relational: `Playlists` + `imagesInPlaylist` + optional `activePlaylists` | One document per playlist: `store.Playlist` in the **`playlists`** collection (`daemon/internal/store/models.go`, `playlist_store_impl.go`) |
| **Control plane** | Legacy daemon socket + TS daemon (`daemon/playlist.ts`) | HTTP over Unix socket — `/playlists`, `/images`, etc. (`daemon/internal/server/routes.go`, `daemon/docs/openapi.yaml`) |

**Path note:** v2 uses **`~/.waypaper_engine/`**, not `$HOME/.waypaper/`. If documentation or tooling refers to another directory (e.g. a symlink or a unified cache path), surface that explicitly so **`Images.name`** in SQLite matches files on disk.

---

## 2. Image migration

### v2 model

`Images` table: `id`, unique `name` (basename), dimensions, `format`, flags (`shared/types/image.ts`, `database/schema.ts`).

### v3 model

Rich `store.Image`: `path`, `media_type`, `duration`, `checksum`, `source_path`, thumbnails, optional `folder_id`, etc. (`daemon/internal/store/models.go`).

### Recommended pipeline

1. Open **`images_database.sqlite3` read-only**; enumerate `Images` rows.
2. Build absolute paths: `join(v2_images_dir, row.name)` (same idea as v2 `utils/imageOperations.ts`).
3. Call v3 **`POST /images`** (OpenAPI: import images from paths — `importImages`) so behaviour matches normal imports (thumbnails, video probing, checksums, async batch).
4. Build **`v2_id → v3_id`** after import:
   - Prefer **checksum** when available from list/detail APIs.
   - Fallback: **`name`** (v2 enforces unique `name`; no multi-folder ambiguity in v2).
5. Optional: map **`is_selected`** via **`PATCH /images/{id}`**; **`is_checked`** has no direct v3 field — omit or defer.

Wait for import completion (or poll gallery) before playlist migration if playlists depend on stable v3 IDs.

---

## 3. Playlist schema mapping (best-effort 1:1)

### Structural mapping

| v2 (`Playlists` + `imagesInPlaylist`) | v3 (`store.Playlist`) |
|--------------------------------------|------------------------|
| `name` (unique) | `name` — v3 assigns new integer `id`; preserve display name (suffix if clash with existing v3 playlists) |
| `type`: `timer` \| `never` \| `timeofday` \| `dayofweek` | `configuration.type`: `timer` \| **`manual`** \| `time_of_day` \| `day_of_week` |
| `interval` | v2 daemon uses **milliseconds** (`setInterval(..., this.interval)` in `daemon/playlist.ts`). v3 uses **seconds** (`time.Duration(cfg.Interval) * time.Second` in `daemon/internal/playlist/scheduler.go`). Convert: **`floor(interval_ms / 1000)`** and document rounding. |
| `order`: `ordered` \| `random` \| `null` (`null` behaves like ordered in `getPlaylistImages`) | `configuration.order`: `ordered` \| `random` (meaningful for **`timer`**) |
| `alwaysStartOnFirstImage` | `configuration.always_start_on_first_image` |
| `showAnimations` | **No field on v3 `PlaylistConfiguration`.** v2 uses this per playlist to choose swww transition vs `"none"` (`utils/imageOperations.ts`). Treat as **global / backend** behaviour in v3 — **parity gap**. |
| `currentImageIndex` | **`playback.current_index`** once strip order is fixed (below). For timer + random, optionally populate **`timer_indices`** / **`timer_cursor`** (`playback_persist.go`, `scheduler.go`). |

**Membership:** Read `imagesInPlaylist` with **`ORDER BY indexInPlaylist`** and build `[]PlaylistImage{ image_id: mapped_v3_id, time: ... }`.

**`time` (time-of-day):** v2 stores **minutes since midnight**. v3 uses `PlaylistImage.Time` as `*int` in the same unit — **copy when non-null**. Rows with null `time` on time-of-day playlists are invalid; flag in dry-run.

### Behaviour parity notes

**Timer, ordered:** Canonical strip = `indexInPlaylist` order; `currentImageIndex` maps directly to that strip index.

**Timer, random (important):**  
When `order === "random"`, v2 **`getPlaylistImages`** uses **`ORDER BY RANDOM()`** (`database/dbOperations.ts`). Permutation is **not persisted**; `currentImageIndex` only refers to **that query’s row order**. Restarts reshuffle in v2.

**Migration approach:**

- Export using **`ORDER BY indexInPlaylist` only** — do not use the random ordering path.
- Treat **canonical strip** as source of truth for membership.
- Map **`currentImageIndex`** to the **same wallpaper file** as in one explicit snapshot (prefer canonical order for stability).
- For v3 **`timer_indices`:** Either omit (let v3 generate on first run) or use a **deterministic shuffle** (e.g. seeded from playlist name + image checksums) so v3 random timer survives restarts — document that this will not match any historical v2 permutation.

**`never` → `manual`:** v3 **`manual`** scheduler does not auto-advance (`daemon/internal/playlist/scheduler.go`) — aligns with “apply once, advance manually.”

**`timeofday`:** v2 **`findClosestImageIndex`** assumes time-sorted semantics on the loaded strip; v3 **`buildTimeSlots`** sorts by minutes (`daemon/internal/playlist/manager.go`). Preserve **`indexInPlaylist` order** in `images[]`; v3 derives sorted slots internally.

**`dayofweek`:** v2 uses **`Date.getDay()`** with clamping; v3 uses **`time.Weekday()`** with `min(weekday, totalImages-1)` (`scheduler.go`). Same Sunday=0 convention; parity holds if strip order matches weekday indices (v2 UI caps additions at seven images for this mode).

---

## 4. Active playlists and runtime state

**v2:** `activePlaylists` stores `playlistID`, `activeMonitor` JSON, `activeMonitorName`.

**v3:** **`PlaylistPlayback`** on the playlist document (`was_running`, `paused`, `mode`, `monitors`, `current_index`, optional timer shuffle fields). Active runs are in-memory; restore reads persisted playback (`daemon/internal/playlist/playback_persist.go`, `restore_test.go`).

**Optional restore after migration:**

1. Map v2 `playlistID` → v3 playlist `id` (via stable name or export-side map).
2. Map v2 **`ActiveMonitor`** JSON → v3 **`playback.mode`** + **`playback.monitors`** (same conceptual monitor targeting).
3. Set **`was_running`** only if product policy wants auto-resume; align **`current_index`** with migrated strip.

**Edge case:** One v2 playlist active on multiple monitors — v3 has **one playback blob per playlist**; define conflict resolution (single winner vs manual restart).

---

## 5. Explicit non-goals / parity gaps

1. **`showAnimations`** per playlist — not on v3 playlist config; document loss or handle via global transition settings only.
2. **Exact timer-random sequence** — not stored in v2; only snapshot-stable policies are possible.
3. **Numeric playlist IDs** — v3 allocates new IDs; migrate **names and semantics**, not primary keys.
4. **`imageHistory`, `monitor_state`, `swwwConfig`, `appConfig`** — separate effort; v3 history shape differs (`store.ImageHistoryEntry`).

---

## 6. Suggested migration tool shape (spec only)

1. **Inputs:** Path to v2 SQLite DB; path to v2 images directory; v3 daemon socket / HTTP-over-UDS client config.
2. **Dry run:** Parse SQLite; report counts; missing files; invalid time-of-day rows; playlist name clashes with existing v3 data.
3. **Import images:** `POST /images` with path list; build **`v2_id → v3_id`** map.
4. **Import playlists:** `POST /playlists` per playlist with mapped `images` + `configuration`. Confirm whether **`playback`** can be set via public API or requires daemon-internal / extended endpoint for “cold” migration.
5. **Optional resume:** Set persisted playback per policy, or instruct users to start playlists manually after migration.

Follow-up testing: golden SQLite fixtures → expected v3 playlist JSON (TDD-friendly).

---

## 7. Summary

| Topic | Approach |
|-------|----------|
| **Images** | Paths from `Images.name` + v2 images dir → v3 import API → correlate IDs by checksum/name. |
| **Playlists** | Same membership order via `indexInPlaylist`; convert types and **interval ms→s**; **`never` → `manual`**; time/day modes align structurally. |
| **Hardest 1:1 gap** | **Timer + random**: v2 does not persist shuffle; stabilise on canonical order + explicit shuffle policy for v3. |
| **Hardest product gap** | **Per-playlist `showAnimations`** — absent in v3; document or add v3 support if strict parity is required. |

---

## 8. Open question for implementation

Confirm whether v3 allows **setting `playback`** (or equivalent) through the public API for migration, or whether migrated playlists should be created **without** playback and users restart runs manually.
