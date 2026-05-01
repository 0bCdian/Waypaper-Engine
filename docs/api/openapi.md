# OpenAPI spec

The `openapi.yaml` spec is shipped with the repo under `daemon/docs/openapi.yaml`. It is a machine-readable route map—useful for generating clients, exploring path shapes, or feeding into tooling.

**Be advised** — the daemon listens on a **Unix domain socket**, not TCP. No browser-based "try it" tool can reach it directly. Use `curl` with `--unix-socket` instead (examples below).

---

## Download / view raw

- **In this repo:** [`daemon/docs/openapi.yaml`](https://github.com/0bCdian/Waypaper-Engine/blob/main/daemon/docs/openapi.yaml)
- **Served from this site:** [`/openapi.yaml`](/openapi.yaml) (copied at build time)

Load it into any OpenAPI viewer (Swagger UI, Stoplight, Insomnia) for a rendered reference—just know the "send" button won't work against a Unix socket.

---

## curl examples

Everything goes through `--unix-socket`. Set the socket path once:

```bash
SOCK="${XDG_RUNTIME_DIR}/waypaper-engine.sock"
```

**Health check:**

```bash
curl -s --unix-socket "$SOCK" http://localhost/healthz
```

**List images (paginated):**

```bash
curl -s --unix-socket "$SOCK" "http://localhost/images?page=1&per_page=20" | jq
```

**Set a wallpaper:**

```bash
curl -s -X POST --unix-socket "$SOCK" http://localhost/wallpaper/set \
  -H 'Content-Type: application/json' \
  -d '{"image_id": 3, "monitor": "*", "mode": "individual"}'
```

**Set a random wallpaper:**

```bash
curl -s -X POST --unix-socket "$SOCK" http://localhost/wallpaper/random \
  -H 'Content-Type: application/json' -d '{}'
```

**List backends and availability:**

```bash
curl -s --unix-socket "$SOCK" http://localhost/backends | jq
```

**Switch active backend:**

```bash
curl -s -X POST --unix-socket "$SOCK" http://localhost/backends/awww/activate
```

**Get full config:**

```bash
curl -s --unix-socket "$SOCK" http://localhost/config | jq
```

**Update app config:**

```bash
curl -s -X PATCH --unix-socket "$SOCK" http://localhost/config/app \
  -H 'Content-Type: application/json' \
  -d '{"theme": "dracula", "images_per_page": 100}'
```

**Stream SSE events:**

```bash
curl -N --unix-socket "$SOCK" \
  "http://localhost/events?types=wallpaper_changed,playlist_started"
```

See [API overview](./overview) for the full surface, and [Events & SSE](./sse) for SSE details and a Go client example.

---

## Using the spec with tooling

1. Download `/openapi.yaml` from this site or grab it from the repo.
2. Import into Insomnia, Postman, or any OpenAPI-aware client.
3. Set the base URL to `http://localhost` and configure the tool to proxy through `--unix-socket` (Insomnia supports this natively; for Postman use a local proxy).

The `servers` entry in the spec reads `http://localhost` with a note that it is a placeholder—the real transport is the Unix socket.
