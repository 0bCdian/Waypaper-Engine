# Events (SSE)

The daemon streams everything it does (wallpaper changes, playlist ticks, imports, config edits) as Server-Sent Events. Use it to keep your own tools in sync or to hook Waypaper into the rest of your rice.

```bash
curl -N --unix-socket "$XDG_RUNTIME_DIR/waypaper-engine.sock" http://localhost/events
waypaper-daemon events --types wallpaper_changed,playlist_started   # CLI: one JSON line per event
```

`GET /events?types=a,b` filters by type; omit it (or pass `*`) for all. A `: keepalive` comment arrives every 30 seconds. Each client has a 64-event buffer and loses events if it falls behind, so re-fetch state if you suspect a gap. The socket isn't TCP, so a browser `EventSource` can't connect.

Each event is an `event:` line plus a `data:` JSON object; payload fields are top-level and the daemon adds a `timestamp`:

```text
event: wallpaper_changed
data: {"image_id":42,"media_type":"image","monitors":["DP-1"],"mode":"individual","source":"manual","backend":"awww","path":"/home/me/wall.png","tags":[],"timestamp":"2026-07-09T23:00:00.123456789+02:00"}
```

`monitors` is always a list of output names. There's no event for plugging a monitor in or out; poll `GET /monitors`.

## Wallpaper

| Event | Payload |
| ----- | ------- |
| `wallpaper_changed` | `image_id`, `media_type` (`image`, `video`, `web`), `path`, `tags`, `monitors`, `mode`, `source` (`manual`, `random`, `playlist`, `restore`), `backend`, `colors` (only if the image has a palette) |
| `wallpaper_apply_failed` | `image_id`, `error`, `backend` |
| `wallpaper_restore_failed` | `backend`, `error` (re-applying saved wallpapers failed) |

## Playlists

| Event | Payload |
| ----- | ------- |
| `playlist_started` | `playlist_id`, `playlist_name`, `monitors`, `applied_to`, `extend` |
| `playlist_stopped` | `playlist_id`; stop-all sends `action: "stop_all"`, `stopped` (count) |
| `playlist_paused` | `playlist_id`; pause-all sends `action: "pause_all"`, `paused` (count) |
| `playlist_resumed` | `playlist_id`; resume-all sends `action: "resume_all"`, `resumed` (count) |
| `playlist_image_changed` | `playlist_id`, `image_index`, `image_id`, `monitors`, and `source: "missed_event_recovery"` when catching up after a missed tick |
| `playlist_skipped_incompatible` | `playlist_id`, `playlist_name`, `backend`, `skipped`, `applied_index`, `skipped_items` (list of `image_id`, `media_type`, `slot_index`) |
| `playlist_no_compatible_item` | `playlist_id`, `playlist_name`, `total_images`, and `backend` (fixed mode) or `media_type` (auto mode) |

Next-all and previous-all emit one `playlist_image_changed` per running playlist.

## Import and processing

Emitted during a batch import from `POST /images`; all carry the `batch_id` that call returned.

| Event | Payload |
| ----- | ------- |
| `processing_started` | `batch_id`, `total` |
| `image_processed` | `batch_id`, `image` (full record), `current`, `total`, `elapsed_ms` |
| `image_error` | `batch_id`, `path`, `error`, `current`, `total`, `elapsed_ms` |
| `processing_complete` | `batch_id`, `total`, `succeeded`, `failed`, `elapsed_ms` |
| `processing_cancelled` | `batch_id`, `total`, `succeeded`, `failed`, `elapsed_ms` |

## Config

| Event | Payload |
| ----- | ------- |
| `config_changed` | `sections` (list: `app`, `daemon`, `backend`, `backend.<name>`, `monitors`, `wallhaven`); `source` (`file`, `api_reset_all`, `api_reset_backend`) on file edits and resets |

## Gallery

| Event | Payload |
| ----- | ------- |
| `gallery_changed` | `domain`: `images`, `folders`, `playlists` or `history`. Re-fetch that collection. |
| `image_orphan_purged` | `image_id`, `reason` (`row_missing`, `file_missing`), `monitor_states_purged`, `history_entries_purged`, `playlists_affected` |

## Backend

| Event | Payload |
| ----- | ------- |
| `backend_unavailable` | `message`, plus `backend` and `retrying` (startup failure), `backend` alone (retries exhausted) or `checked` (list of backends looked for, none installed) |

## Recipes

Re-theme on every wallpaper change:

```bash
waypaper-daemon events --types wallpaper_changed | while read -r line; do
  wal -i "$(jq -r '.data.path' <<<"$line")" -n
done
```

Notify when a playlist hits an unusable item:

```bash
waypaper-daemon events --types playlist_skipped_incompatible,playlist_no_compatible_item \
  | jq --unbuffered -r '"\(.event): \(.data.playlist_name)"' \
  | while read -r msg; do notify-send "Waypaper" "$msg"; done
```
