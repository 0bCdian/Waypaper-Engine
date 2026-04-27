# Daemon & paths

The **waypaper-daemon** (built from `daemon/`) is the single source of truth for the gallery, playlists, **active backend**, and wallpaper apply. It listens on **HTTP/1.1 over a Unix domain socket** (see [Socket](#socket) for the default path and overrides).

---

## Socket

**Default path:** `$XDG_RUNTIME_DIR/waypaper-engine.sock`  
Example: `/run/user/1000/waypaper-engine.sock`

**Health check** (from the same machine, any user tool that can speak HTTP-over-UDS):

```bash
curl --unix-socket "${XDG_RUNTIME_DIR}/waypaper-engine.sock" http://localhost/healthz
```

`GET /healthz` returns liveness and a few monitor-stack hints (see the live JSON—**`monitor_stack_version`**, **monitor provider order**—in addition to `status: ok`).

---

## Default XDG layout

These match the in-repo [API contract defaults](https://github.com/0bCdian/Waypaper-Engine/blob/main/daemon/API_CONTRACT.md#default-file-paths-xdg):

| Purpose | Typical path |
|---------|----------------|
| User config (TOML) | `$XDG_CONFIG_HOME/waypaper-engine/config.toml` |
| Unix socket | `$XDG_RUNTIME_DIR/waypaper-engine.sock` |
| Images (library) | `$XDG_DATA_HOME/waypaper-engine/images` |
| Thumbnails | `$XDG_CACHE_HOME/waypaper-engine/thumbnails` |
| CloverDB | `$XDG_DATA_HOME/waypaper-engine/db` |
| Log file | `$XDG_DATA_HOME/waypaper-engine/daemon.log` |
| PID lock | `$XDG_RUNTIME_DIR/waypaper-engine.pid` |

On a typical Linux setup, config is under **`~/.config`**, data under **`~/.local/share`**, cache under **`~/.cache`**, runtime under **`/run/user/<uid>`**.

---

## Live updates and config

The daemon has an in-process **event bus**. Anything that subscribes (including the **SSE** broker) receives structured events. If you **edit `config.toml` on disk** while the daemon runs, the config watcher can hot-reload and emit **`config_changed`** over SSE (see [Events & SSE](/api/sse)).
