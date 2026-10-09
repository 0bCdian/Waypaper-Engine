# Install

On Arch it's one command. Anywhere else, use the AppImage or build from source. Then head to [First run](/manual/first-run).

```sh
yay -S waypaper-engine
```

Waypaper Engine drives a [backend](/manual/backends) (awww, hyprpaper, swaybg, feh, mpvpaper or wal-qt) that you install separately. The app starts without one and shows a banner until a backend appears on your `PATH`.

## Runtime dependencies

| Dependency | Needed for | Required? |
| --- | --- | --- |
| A [backend](/manual/backends) | Setting wallpapers | Yes, at least one, on `PATH` |
| `ffmpeg` (with `ffprobe`) | Video import, video previews, Loop Studio export | Needed for videos |
| `yt-dlp` | YouTube downloads in Loop Studio | Optional |
| `xrandr` (`xorg-xrandr` on Arch) | Monitor detection on X11, `feh` backend | X11 only |

## Arch Linux (AUR)

```sh
yay -S waypaper-engine       # release
yay -S waypaper-engine-git   # latest commit (conflicts with the above; remove one before installing the other)
```

Backends are optional dependencies. Install the ones you want:

```sh
yay -S awww                  # animated transitions on Wayland
yay -S wal-qt                # HTML wallpapers on Wayland
```

## AppImage

1. Download and run it:

   ```sh
   curl -LO https://github.com/0bCdian/Waypaper-Engine/releases/latest/download/waypaper-engine.AppImage
   chmod +x waypaper-engine.AppImage
   ./waypaper-engine.AppImage
   ```

2. Install a backend on your system; backends are not bundled.

The GUI starts the bundled daemon for you. There is no `waypaper-daemon` on your `PATH`, so for CLI use either build from source or extract it (`./waypaper-engine.AppImage --appimage-extract`) and put `squashfs-root/resources/waypaper-daemon` on your `PATH`.

## From source

You need Go, Node, pnpm and a C toolchain with the Wayland client headers (`wayland` on Arch, `libwayland-dev` on Debian-likes). Versions are pinned in [`.mise.toml`](https://github.com/0bCdian/Waypaper-Engine/blob/main/.mise.toml); `mise install` fetches them.

1. Clone and build:

   ```sh
   git clone https://github.com/0bCdian/Waypaper-Engine.git
   cd Waypaper-Engine
   make deps
   make electron
   ```

2. Install, either per-user (no sudo) or system-wide:

   ```sh
   make install                  # ~/.local
   sudo make install-system      # /usr/local
   ```

Make sure `~/.local/bin` is on your `$PATH`, or your shell and the systemd unit won't find the binaries.

::: warning The systemd unit hardcodes /usr/bin
The unit runs `/usr/bin/waypaper-daemon`, which is right for the AUR but wrong for `~/.local` or `/usr/local`. Fix it with `systemctl --user edit waypaper-daemon.service`:

```ini
[Service]
ExecStart=
ExecStart=%h/.local/bin/waypaper-daemon start
```
:::

Custom prefixes, `DESTDIR` staging and uninstalling are covered in [Development](/dev/development) and `make help`.

## Run the daemon without the GUI

The daemon keeps playlists running with the window closed, so you can run it alone from autostart.

```ini
# Hyprland (hyprland.conf)
exec-once = waypaper-daemon start
```

```ini
# sway (config)
exec waypaper-daemon start
```

Or with systemd (installed by the AUR and `make install`; see the warning above for non-AUR installs):

```sh
systemctl --user enable --now waypaper-daemon.service
```

With the AppImage, use `./waypaper-engine.AppImage --daemon` (extra arguments go to the daemon).

::: tip Started from a unit or script and sees no monitors?
The daemon needs `XDG_RUNTIME_DIR` plus `XDG_SESSION_TYPE`, `WAYLAND_DISPLAY` or `DISPLAY` in its environment. Or set `compositor = "wayland"` (or `"x11"`) under `[daemon]` in [config.toml](/reference/config).
:::

## The launcher is also the CLI

```sh
waypaper-engine                    # open the GUI
waypaper-engine run --debug        # GUI with debug logging
waypaper-engine status             # same as: waypaper-daemon status
```

Anything that isn't a GUI command goes to the daemon CLI. Every command is in the [CLI reference](/reference/cli).

## Updating

- **AUR:** `yay -Syu`
- **AppImage:** download the new file over the old one.
- **From source:** `git pull`, then `make deps && make electron && make install`.

Your gallery, playlists and config live in your home directory ([Paths](/reference/paths)), so updating doesn't touch them. What changed is in the [changelog](/manual/changelog). Coming from v2? There's no migration; see [Coming from v2](/manual/troubleshooting#coming-from-v2).
