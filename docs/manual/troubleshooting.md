# Troubleshooting

Find your symptom, apply the fix. These three commands answer most questions:

```sh
waypaper-daemon status      # daemon alive? version, pid, uptime
waypaper-daemon backends    # every backend and whether it's available
waypaper-daemon monitors    # what the daemon thinks your monitors are
```

## The GUI opens but nothing works, or the daemon exits right away

Run the daemon in a terminal and read its output:

```sh
waypaper-daemon start --log-level debug
```

If it says another daemon instance is already running, stop it with `waypaper-daemon stop`. If the PID in that message belongs to an unrelated process, delete the lock file:

```sh
rm -f "$XDG_RUNTIME_DIR/waypaper-engine.pid"
```

You can also restart the daemon from **Settings, Daemon**.

## `waypaper-daemon status` says the daemon isn't reachable

- The daemon isn't running. Start it with `waypaper-daemon start`, the app, or `systemctl --user start waypaper-daemon.service`.
- `$XDG_RUNTIME_DIR` isn't set in your shell. A normal login session sets it; a bare `su` or some containers don't.
- You changed `socket_path` in `config.toml`. The CLI always uses the default socket, so set it back.

## The systemd unit fails with "No such file or directory"

The unit runs `/usr/bin/waypaper-daemon`. If you installed to `~/.local` or `/usr/local`, override `ExecStart`; see [Install](/manual/install#from-source).

## Banner says "No wallpaper backends found"

Install a backend (`awww`, `hyprpaper`, `swaybg`, `mpvpaper`, `feh` or `wal-qt`); the banner clears within a few seconds. If it still doesn't set anything, activate it in **Settings, Backend** or restart the daemon. See [Backends](/manual/backends).

## A backend shows as unavailable, or the wallpaper never changes

`"available": false` in `waypaper-daemon backends` means the binary isn't on the `PATH` **the daemon** sees. A daemon started from systemd or a compositor autostart can have a smaller `PATH` than your shell. Install the package system-wide, symlink the binary into `/usr/local/bin`, or start the daemon from a shell with the right `PATH`.

If the backend is installed but fails to start, the reason is in `daemon.log`. Switch backend in **Settings, Backend** or with `waypaper-daemon backends activate NAME`.

## Monitors are missing or have the wrong names

Check what the daemon sees:

```sh
waypaper-daemon monitors --direct
```

If it picked the wrong session type, force it in `config.toml`:

```toml
[daemon]
compositor = "wayland"   # auto | wayland | x11
```

On X11, make sure `xrandr` is installed. See [Displays](/manual/displays).

## An HTML wallpaper can't load anything from the internet

Network access is off by default and both switches must be on:

1. **Settings, Backend, wal-qt:** "Allow network for HTML wallpapers".
2. The wallpaper's detail sidebar, **Capabilities**: enable `network`. It's locked until the global switch is on.

See [HTML wallpapers](/manual/html-wallpapers).

## HTML wallpapers: wal-qt-host not found

`wal-qt-host` must be on the daemon's `PATH`, not just your shell's. Systemd user units and compositor autostart often have a minimal one. Check with `which wal-qt-host`, then install it to a system path or set `PATH` for the daemon.

## Where are the logs?

| Log | Location |
| --- | --- |
| Daemon | `~/.local/share/waypaper-engine/daemon.log` |
| GUI | `~/.local/share/waypaper-engine/electron.log` (may carry a suffix; `ls` the folder) |

For more detail:

```sh
waypaper-daemon start --log-level debug    # one run
WAYPAPER_LOG_LEVEL=debug waypaper-engine   # GUI and daemon
```

## Coming from v2

v3 is a rewrite and there is no migration tool. Your v2 folder is left untouched.

- **Gallery:** starts empty in `~/.local/share/waypaper-engine/`. Re-import your images from `~/.waypaper_engine/images/` with **Add images from directory**.
- **Playlists:** recreate them. The v2 `never` type is now `manual`, and "show animations" is gone (transitions are a backend setting).
- **Hook scripts:** the v2 `scripts` folder no longer runs. Use [`waypaper-daemon events`](/manual/scripting).
- **Tools using the v2 CLI or socket:** rewrite them against the [CLI](/reference/cli) or [API](/reference/api).
- **Building from source:** use `pnpm`, not `npm`.

The GUI recreates an empty `~/.waypaper_engine` folder on launch, so don't be surprised if it reappears after you delete it.

Still stuck? Open an issue with your compositor, your backend and the last lines of `daemon.log`.
