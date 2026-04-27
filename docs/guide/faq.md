# FAQ & troubleshooting

Symptoms first—then what the daemon and filesystem are doing. Deeper background lives in the linked guides and in the in-repo [API contract](https://github.com/0bCdian/Waypaper-Engine/blob/main/daemon/API_CONTRACT.md).

---

### The app or GUI won’t start, or the daemon exits immediately

**Be advised** — a **stale Unix socket** or **PID lock** from a crash can block a new process from binding. The default paths are under `$XDG_RUNTIME_DIR` (see [Daemon & paths](./daemon#default-xdg-layout)).

1. Remove both files, then start again:
   ```bash
   rm -f "${XDG_RUNTIME_DIR}/waypaper-engine.sock"
   rm -f "${XDG_RUNTIME_DIR}/waypaper-engine.pid"
   ```
2. If you are on an unusual environment where `XDG_RUNTIME_DIR` is **not** set, the Go daemon still picks a directory under the system temp dir and places `waypaper-engine.sock` *inside* it (implementation: `waypaper-engine/daemon/internal/system/paths.go` — `RuntimeDir` + `DefaultSocketPath`). On a normal desktop session, you should not need this.

Full walkthrough: [Install & run — Troubleshooting startup](./install#troubleshooting-startup).

---

### `curl: (7) Failed to connect` / `waypaper-daemon status` says the daemon is not reachable

- The **daemon** may not be running. Launch the app, run `waypaper-daemon start`, or enable `waypaper-daemon.service` (see [Install & run](./install)).
- You might be using the **wrong socket path** if you overrode `socket_path` in `config.toml` — match whatever you set there, or `GET` your config from the API. Default remains `$XDG_RUNTIME_DIR/waypaper-engine.sock` (documented in [Configuration](./config) and [Daemon & paths](./daemon)).

When it is up, a quick check is:

```bash
curl --unix-socket "${XDG_RUNTIME_DIR}/waypaper-engine.sock" http://localhost/healthz
```

`waypaper-daemon status` calls `GET /info` on that socket.

---

### A backend shows as unavailable, or the wallpaper never changes

The daemon only applies wallpapers through **backends** you install and put on **`PATH`**. It does not bundle `awww`, `hyprpaper`, `feh`, `mpvpaper`, or `wayland-utauri`.

```bash
curl --unix-socket "${XDG_RUNTIME_DIR}/waypaper-engine.sock" http://localhost/backends
```

An entry with `"available": false` means the executable was not found. Pick an installed backend in **Settings** and see [Backends & dependencies](./backends).

---

### Monitors are missing, wrong names, or per-monitor mode acts weird (Wayland)

On Wayland, the daemon builds a monitor list from several providers. `GET /healthz` includes **`monitor_provider_order`**: in current code that is `wayland-utauri`, `wlr-randr`, `xrandr` (see `daemon/internal/handler/health.go`).

For wlroots-based compositors, installing [`wlr-randr`](https://sr.ht/~emersion/wlr-randr/) is strongly recommended; without it, things degrade to best-effort. See [Backends & dependencies — wlr-randr](./backends#monitor-detection-dependency-wlr-randr).

---

### HTML / web wallpaper cannot load remote assets

Outbound network is **off** until you allow it: enable the **global** allow in **Settings** *and* satisfy the **wallpaper manifest** (wayland-utauri side). The spec lives in the [wayland-utauri `WEB_WALLPAPER_SPEC`](https://github.com/0bCdian/wayland-utauri/blob/main/docs/WEB_WALLPAPER_SPEC.md). Short note: [Introduction](./introduction) (bottom).

---

### Where is the log file?

**Default:** `$XDG_DATA_HOME/waypaper-engine/daemon.log` — typically `~/.local/share/waypaper-engine/daemon.log` when `XDG_DATA_HOME` is unset (`daemon/internal/system/paths.go` — `DefaultLogFile`).

```bash
tail -f ~/.local/share/waypaper-engine/daemon.log
```

---

### What version am I running?

- **CLI (binary):** `waypaper-daemon version` — prints `waypaper-daemon <version>` (Cobra subcommand in `daemon/cmd/daemon/cli.go`).
- **Running daemon:** `waypaper-daemon status` (JSON from `GET /info`) or read the `version` field in that response.
- **Dev tree:** the app’s `package.json` has a `version` field; releases are tagged on GitHub.

---

### I want events in the terminal, not raw `curl`

```bash
waypaper-daemon events
waypaper-daemon events --types wallpaper_changed,playlist_started
```

This wraps `GET /events` (SSE) and prints JSON lines. Details: [Events & SSE](../api/sse).

---

*Still stuck? Open an issue on GitHub with your compositor, backend choice, and (if you can) a snippet of `GET /healthz` and the last lines of `daemon.log`.*
