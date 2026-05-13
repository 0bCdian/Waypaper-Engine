# Glossary

Short definitions of terms used across these docs. Authoritative behavior (flags, keys, JSON shapes) lives in the linked pages and in the in-repo [API contract](https://github.com/0bCdian/Waypaper-Engine/blob/main/daemon/API_CONTRACT.md).

| Term                            | What it is                                                                                                                                                                                                                                       |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **waypaper-engine**             | The **desktop app** — Electron + React. This is what you launch from the menu or by running the `waypaper-engine` command after install.                                                                                                         |
| **waypaper-daemon**             | The **Go daemon** — one process that holds gallery data, runs playlists, talks to **backends**, and serves **HTTP on a Unix socket**. The same binary is a **Cobra CLI** (`waypaper-daemon start`, `status`, `events`, etc.).                    |
| **Backend** (wallpaper backend) | An **external** tool the daemon invokes to apply a wallpaper: `awww`, `hyprpaper`, `feh`, `mpvpaper`, or `wal-qt`. The daemon does not embed them; they must be installed and on `PATH` (or reported unavailable — see `GET /backends`). |
| **Auto** (backend selection)    | A mode where the daemon picks a backend per **media type** using ordered priority lists. Contrast with **fixed**, which always uses the selected backend. See [The app (UI) — Backend](/guide/app#backend).                                      |
| **Control plane**               | The daemon’s **HTTP API** on the Unix socket: JSON request/response, same contract the UI uses.                                                                                                                                                  |
| **Unix socket**                 | Default path `$XDG_RUNTIME_DIR/waypaper-engine.sock` (overridable via `socket_path` in config). `curl` and scripts use `curl --unix-socket … http://localhost/…`. See [Daemon & paths](./daemon).                                                |
| **SSE** (Server-Sent Events)    | Long-lived `GET /events` stream of wallpaper, playlist, config, and processing events. Filter with `?types=`. See [Events & SSE](/api/sse).                                                                                                      |
| **CloverDB**                    | Embedded document store (Go **clover** module) for images, playlists, folders, history, and related state. Default directory: `$XDG_DATA_HOME/waypaper-engine/db`. See [Daemon & paths](./daemon#default-xdg-layout).                            |
| **Gallery**                     | The in-app **library** of imported images and videos (and web entries); browsed on the home route. Not the same as “wallpaper history” (see **History**).                                                                                        |
| **History**                     | Per-monitor log of **applied** wallpapers (manual, random, playlist, etc.). Route `#/history`.                                                                                                                                                   |
| **wal-qt**              | Optional **wal-qt** binary for image, video, and **HTML** wallpapers on Wayland. It is a **separate** project; the daemon spawns/controls it through the `wal-qt` backend package, not the webview inside Electron.              |
| **XDG directories**             | Config, data, cache, and runtime layout (`XDG_CONFIG_HOME`, `XDG_DATA_HOME`, `XDG_CACHE_HOME`, `XDG_RUNTIME_DIR`). Defaults: [Daemon & paths](./daemon#default-xdg-layout) · [Configuration — defaults](/guide/config).                          |
| **Wallhaven**                   | Built-in browser/downloader for [wallhaven.cc](https://wallhaven.cc) inside the app (`#/wallhaven`). API key and behavior: [The app (UI) — Wallhaven](/guide/app#wallhaven-wallhaven).                                                           |

---

## Confusingly similar words

- **“Backend”** in Waypaper means a **wallpaper setter binary**, not “the Go server” and not “a cloud API.”
- **waypaper-engine** vs **waypaper-daemon**: the **GUI** vs the **long-lived service + CLI**; both may run together on a normal desktop.
- **Socket path** (where the HTTP API listens) is unrelated to the **socket your compositor** might use — only the Waypaper **daemon** `socket_path` matters for `curl` and `waypaper-daemon`.

If a term is missing, search the [FAQ](./faq) or the [OpenAPI spec](/api/openapi) for the feature name.
