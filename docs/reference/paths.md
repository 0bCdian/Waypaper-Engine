# Paths & files

Where Waypaper Engine keeps things. Defaults follow the XDG spec (typically `~/.config`, `~/.local/share`, `~/.cache`, `/run/user/<uid>`); directories the daemon creates are mode `0700`.

| What | Default | Override |
| ---- | ------- | -------- |
| Config file | `$XDG_CONFIG_HOME/waypaper-engine/config.toml` | `--config` / `-c` flag |
| User themes | `$XDG_CONFIG_HOME/waypaper-engine/themes/*.css` ([Themes](/manual/themes)) | |
| API socket | `$XDG_RUNTIME_DIR/waypaper-engine.sock` | `daemon.socket_path` |
| PID lock | `$XDG_RUNTIME_DIR/waypaper-engine.pid` | `--lock-path` flag |
| Image library (imports, HTML wallpaper folders, video loop exports) | `$XDG_DATA_HOME/waypaper-engine/images` | `daemon.images_dir` |
| Split-image cache (`extend` mode) | `<images_dir>/processed` | |
| Database (CloverDB) | `$XDG_DATA_HOME/waypaper-engine/db` | `daemon.database_dir` |
| Thumbnails (`<size>/<id>.webp`, video previews in `video_preview/`) | `$XDG_CACHE_HOME/waypaper-engine/thumbnails` | `daemon.thumbnails_dir` |
| Log file | `$XDG_DATA_HOME/waypaper-engine/daemon.log` | `daemon.log_file` |
| wal-qt socket | `$XDG_RUNTIME_DIR/wal-qt.sock` | `backend.wal-qt.socket_path` |
| hyprpaper config | `$XDG_CONFIG_HOME/hypr/hyprpaper.conf` | `backend.hyprpaper.config_path` |

Environment: `XDG_CONFIG_HOME`, `XDG_DATA_HOME` and `XDG_CACHE_HOME` fall back to `~/.config`, `~/.local/share` and `~/.cache`. If `XDG_RUNTIME_DIR` is unset, the daemon's socket and PID file go in `/tmp/waypaper-engine-<uid>`. `WAYPAPER_LOG_LEVEL` sets the log level when `--log-level` isn't given. Keys: [config.toml](/reference/config).

::: warning
The `waypaper-daemon` CLI ignores `daemon.socket_path` and always uses the default socket. If you moved it, use `curl --unix-socket`.
:::

If the daemon died badly and won't restart, check nothing is running, then remove the stale socket (more in [Troubleshooting](/manual/troubleshooting)):

```bash
pgrep -a waypaper-daemon
rm -f "$XDG_RUNTIME_DIR/waypaper-engine.sock"
```
