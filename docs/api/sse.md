# Events & SSE

Everything that happens in the daemon — wallpaper changes, playlist activity, imports, config edits — is published on an internal event bus and streamed to clients over **Server-Sent Events** at `GET /events`. Subscribe once, react forever; no polling.

Implementation: `daemon/internal/server/sse.go` (broker) and `daemon/internal/events/types.go` (event types).

---

## Connecting

```bash
# Everything
curl -N --unix-socket "${XDG_RUNTIME_DIR}/waypaper-engine.sock" http://localhost/events

# Only what you care about
curl -N --unix-socket "${XDG_RUNTIME_DIR}/waypaper-engine.sock" \
  "http://localhost/events?types=wallpaper_changed,playlist_started"
```

Or skip `curl` entirely — the CLI wraps the stream and prints each event as a **JSON line**, which pipes nicely into `jq`:

```bash
waypaper-daemon events
waypaper-daemon events --types wallpaper_changed,playlist_started
```

**Filtering:** `?types=` takes a comma-separated list of event types. Omit it (or pass `*`) to receive everything.

---

## Wire format

Standard SSE: an `event:` line with the type, a `data:` line with a JSON payload, blank-line separated. Every payload includes a `timestamp` field (injected by the broker).

```
event: wallpaper_changed
data: {"monitor":"DP-1", ..., "timestamp":"2026-07-09T23:00:00Z"}

: keepalive
```

> [!NOTE]
> The `: keepalive` comment is sent every **30 seconds** so dead connections get detected. SSE-aware clients ignore comment lines automatically; if you parse by hand, skip lines starting with `:`.

---

## Event types

From `daemon/internal/events/types.go` — this table tracks the code, not the other way around.

### Wallpaper

| Type | When |
| --- | --- |
| `wallpaper_changed` | A wallpaper was applied on any monitor (manual, random, or playlist). |
| `wallpaper_apply_failed` | A backend failed to apply a wallpaper. |
| `wallpaper_restore_failed` | One or more monitors could not restore their persisted wallpaper on daemon startup. |

### Playlists

| Type | When |
| --- | --- |
| `playlist_started` | A playlist began running. |
| `playlist_stopped` | A playlist stopped. |
| `playlist_paused` | A playlist was paused. |
| `playlist_resumed` | A paused playlist resumed. |
| `playlist_image_changed` | A running playlist advanced to another image. |
| `playlist_skipped_incompatible` | Items incompatible with the active backend were skipped. |
| `playlist_no_compatible_item` | The whole playlist was exhausted with nothing the active backend can display. |

### Import & processing

Emitted during batch image import.

| Type | When |
| --- | --- |
| `processing_started` | A batch import began. |
| `image_processed` | One image finished processing (thumbnails, palette, ...). |
| `image_error` | One image failed to process. |
| `processing_complete` | The batch finished. |
| `processing_cancelled` | The batch was cancelled. |

### Monitors, config & gallery

| Type | When |
| --- | --- |
| `monitor_connected` | An output appeared. |
| `monitor_disconnected` | An output went away. |
| `config_changed` | Config was updated (any writer: UI, CLI, `PATCH /config`). |
| `gallery_changed` | Any gallery collection changed. The payload's `domain` field says which: `images`, `folders`, `playlists`, or `history`. Treat it as a "re-fetch that collection" signal. |
| `image_orphan_purged` | All database references to a deleted image were removed. |

### Backend lifecycle

| Type | When |
| --- | --- |
| `backend_unavailable` | A long-lived renderer backend (e.g. wal-qt) could not be reached after retries. |

---

## Recipes

React to every wallpaper change (e.g. re-theme your terminal):

```bash
waypaper-daemon events --types wallpaper_changed | while read -r line; do
  echo "wallpaper changed: $line"
  # your pywal/matugen/whatever hook here
done
```

> [!NOTE]
> The daemon binds a **Unix socket**, not TCP — a browser `EventSource` can't reach it directly. Use `curl -N --unix-socket`, the CLI, or any HTTP client that speaks Unix sockets.

Exact payload shapes per event live in the [API contract](https://github.com/0bCdian/Waypaper-Engine/blob/main/daemon/API_CONTRACT.md).
