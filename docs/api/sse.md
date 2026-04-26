# Events & SSE

The daemon exposes a **Server-Sent Events** stream on **`GET /events`**. Each frame has an **`event:`** line (the type) and a **`data:`** line (**JSON**). The server injects a **`timestamp`** into payloads (and **keepalive comments** about every 30s so intermediaries and dead peers are detectable).

You can **filter** which event types a connection receives: **`?types=wallpaper_changed,playlist_started`** (comma-separated). **Omit** `types`, leave it **empty**, or set **`types=*`** to receive **all** event types. This is implemented in the broker (`internal/server/sse.go` in the repo).

---

## `waypaper-daemon` CLI

The Cobra build ships an **`events`** subcommand that prints one JSON line per event—handy for scripts:

```bash
waypaper-daemon events --types wallpaper_changed,playlist_started
```

The implementation opens **`GET /events?types=...`** on the same socket transport as the rest of the CLI and parses SSE **lines** into JSON objects: `{"event":"...","data":...}` (see `cli_events.go` on GitHub). **Ctrl+C** ends the stream.

---

## Event types (authoritative in code)

The string constants live in `daemon/internal/events/types.go`. Grouped for readability:

### Image import

| `event` | When |
|---------|------|
| `processing_started` | A batch import began (`batch_id`, `total`, …) |
| `image_processed` | One file finished (includes image payload, **current** / **total** progress) |
| `image_error` | One path failed (error string + progress) |
| `processing_complete` | Import batch finished (success/fail counts) |
| `processing_cancelled` | `POST /images/cancel-import` won the race |

### Wallpaper

| `event` | When |
|---------|------|
| `wallpaper_changed` | A wallpaper was applied (image id, **monitors**, **mode**, **source**, **backend**, …) |

### Playlists

| `event` | When |
|---------|------|
| `playlist_started` | A playlist run started (playlist id, monitor) |
| `playlist_stopped` | Stopped |
| `playlist_paused` / `playlist_resumed` | Pause state |
| `playlist_image_changed` | The active image in a run changed |

| `event` | When |
|---------|------|
| `playlist_skipped_incompatible` | Items skipped for the **active backend** |
| `playlist_no_compatible_item` | Nothing left that matches the active backend’s media rules |

### Monitors

| `event` | When |
|---------|------|
| `monitor_connected` | A new output name appeared |
| `monitor_disconnected` | An output went away |

### Config and gallery

| `event` | When |
|---------|------|
| `config_changed` | Config changed (sections array in payload) |
| `images_updated` | Gallery set changed (e.g. add/remove) |
| `playlists_updated` | A playlist document changed |
| `folders_updated` | Folder tree changed |
| `history_cleared` | `DELETE /images/history` ran |

### Backend / lifecycle

| `event` | When |
|---------|------|
| `backend_unavailable` | A long-lived backend (e.g. wayland-utauri) was not reachable after retries |
| `wallpaper_restore_failed` | Startup could not restore a persisted wallpaper for one or more monitors |

Payload shapes for the “happy path” events are also summarized in the [API contract (SSE section) on GitHub](https://github.com/0bCdian/Waypaper-Engine/blob/main/daemon/API_CONTRACT.md#server-sent-events-sse). If the two ever disagree, **trust the running daemon** and `events/types.go`, then file a doc bug.

---

## Subscribe in **Go** (HTTP over Unix + SSE)

Use a **custom `http.Transport` `DialContext`** to dial `"unix"`, not `"tcp"`. Read the body with a **bufio** scanner; track `event:` and `data:` lines like the CLI does, or unmarshal the JSON from each `data:` into your own struct.

```go
package main

import (
	"bufio"
	"context"
	"fmt"
	"net"
	"net/http"
	"os"
	"strings"
)

func main() {
	rt := os.Getenv("XDG_RUNTIME_DIR")
	if rt == "" {
		panic("XDG_RUNTIME_DIR is empty")
	}
	socketPath := rt + "/waypaper-engine.sock"

	transport := &http.Transport{
		DialContext: func(ctx context.Context, network, addr string) (net.Conn, error) {
			var d net.Dialer
			return d.DialContext(ctx, "unix", socketPath)
		},
		// Avoid idle reuse quirks on long streams.
		DisableKeepAlives: true,
	}
	client := &http.Client{Transport: transport, Timeout: 0}

	req, err := http.NewRequest(http.MethodGet, "http://localhost/events?types=wallpaper_changed,config_changed", nil)
	if err != nil {
		panic(err)
	}
	resp, err := client.Do(req)
	if err != nil {
		panic(err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		panic(resp.Status)
	}

	sc := bufio.NewScanner(resp.Body)
	// (Optional) limit token size for huge single lines.
	sc.Buffer(make([]byte, 0, 64*1024), 1024*1024)

	var currentEvent string
	for sc.Scan() {
		line := sc.Text()
		if strings.HasPrefix(line, "event:") {
			currentEvent = strings.TrimSpace(strings.TrimPrefix(line, "event:"))
			continue
		}
		if strings.HasPrefix(line, "data:") {
			data := strings.TrimSpace(strings.TrimPrefix(line, "data:"))
			fmt.Printf("event=%s data=%s\n", currentEvent, data)
			currentEvent = ""
		}
		// keepalive is ": keepalive" — ignore
	}
	if err := sc.Err(); err != nil {
		panic(err)
	}
}
```

In production, wire **`Context`** cancellation, **signals**, and **backoff** for reconnects. The integration tests in `internal/server/sse_test.go` show how the server side formats frames and filters by `?types=`.

---

## `curl` one-liner (quick sanity check)

```bash
curl -N --unix-socket "${XDG_RUNTIME_DIR}/waypaper-engine.sock" \
  "http://localhost/events?types=wallpaper_changed"
```

**`-N`** disables buffer so you see lines as they arrive. Point **another** session at the UI or API to trigger `wallpaper_changed` and you should see events roll in.

---

## Polling without SSE

If you cannot keep a long-lived stream, you can still poll `GET /wallpaper/current`, `GET /playlists/active`, and list endpoints, but you will work harder to stay in sync. **SSE is the intended path** for “something changed” on the client.
