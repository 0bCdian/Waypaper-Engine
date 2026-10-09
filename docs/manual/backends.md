# Backends

A backend is the tool that paints your wallpaper (awww, hyprpaper, mpvpaper, ...). Waypaper Engine hands it the image and handles the gallery, playlists and monitors. Install the ones you want, then switch in **Settings → Backend**.

| Backend | Compositor | Media | Transitions | Install (Arch) |
| --- | --- | --- | --- | --- |
| [awww](#awww) | Wayland | Images, GIFs | Yes, lots | `yay -S awww` |
| [hyprpaper](#hyprpaper) | Wayland (Hyprland) | Images | No | `yay -S hyprpaper` |
| [swaybg](#swaybg) | Wayland (wlroots) | Images | No | `pacman -S swaybg` |
| [feh](#feh) | X11 | Images | No | `yay -S feh` |
| [mpvpaper](#mpvpaper) | Wayland | Videos | No | `yay -S mpvpaper` |
| [wal-qt](#wal-qt) | Wayland (layer-shell) | Images, GIFs, videos, [HTML wallpapers](/manual/html-wallpapers) | Yes | `yay -S wal-qt` |

The backend must be on your `PATH` when the daemon starts, otherwise it shows as "(not installed)" in Settings. One installed later isn't activated automatically: pick it in Settings or run `waypaper-daemon backends activate <name>`. `waypaper-daemon backends` lists what the daemon can see ([CLI reference](/reference/cli)).

## Which one should I use?

- Images on Wayland with transitions: awww (the default).
- Hyprland and you want the official tool: hyprpaper.
- Videos: mpvpaper, or wal-qt to cover everything with one backend.
- HTML wallpapers: wal-qt is the only option. X11: feh.

Per-backend options live in `config.toml` under `[backend.<id>]` and in Settings → Backend. Every key and default is in the [config reference](/reference/config).

## awww

[awww](https://codeberg.org/LGFae/awww) (formerly swww) is a Wayland daemon with lots of transitions. It needs `awww` and `awww-daemon` on `PATH`; the old `swww` names are no longer used. If `awww query` already answers, Waypaper reuses the running daemon, otherwise it starts and stops its own.

`daemon_format` only matters if colours look swapped; leave it empty otherwise.

## hyprpaper

[hyprpaper](https://github.com/hyprwm/hyprpaper) is the official Hyprland utility. GIFs are accepted, but whether they animate is up to hyprpaper.

::: warning Waypaper owns your hyprpaper.conf
On every change the daemon rewrites the file at `config_path` and restarts hyprpaper, so anything you had in it is overwritten. Back it up or point `config_path` elsewhere, and don't also start hyprpaper from your Hyprland config.
:::

## swaybg

[swaybg](https://github.com/swaywm/swaybg) is the small classic for wlroots compositors (sway, river, Wayfire, ...). Static images only. It has no daemon mode, so it is restarted on every change.

## feh

[feh](https://feh.finalrewind.org/) sets wallpapers on X11, static images only. It also needs `xrandr` to order multiple monitors.

## mpvpaper

[mpvpaper](https://github.com/GhostNaN/mpvpaper) plays a video as your Wayland wallpaper. Videos only, one process per monitor. Audio is muted by default; sound is controlled by `video_audio_default` in the wal-qt config section, even when mpvpaper plays the video.

## wal-qt

[wal-qt](https://github.com/0bCdian/wal-qt) is my backend for what the others can't do: videos, GIFs and HTML/CSS/JS wallpapers, rendered with Qt WebEngine on every monitor.

- Needs `wal-qt-host` on `PATH`. Install steps are in [HTML wallpapers](/manual/html-wallpapers#installing-wal-qt).
- Needs a compositor with `zwlr_layer_shell_v1` (Hyprland, sway, river, Niri, Wayfire, ...). It does not run on GNOME.
- Transitions, image fit, parallax and the network switch are in the [config reference](/reference/config). Parallax is explained in [Parallax](/manual/parallax).

## Auto mode

By default one backend handles everything, and setting something it can't show (a video on awww) fails. In **Settings → Backend → Selection Mode** choose **auto** to pick a backend per media type: the first installed backend in the matching priority list that supports it is used.

```toml
[backend]
selection_mode = "auto"

[backend.auto_priorities]
image = ["awww", "hyprpaper", "swaybg", "feh", "wal-qt"]
video = ["mpvpaper", "wal-qt"]
web   = ["wal-qt"]
```

Those are the defaults; reorder them in Settings or the TOML.

::: warning No fallback
If nothing in a list is installed and capable, the apply fails. `type` is not used as a safety net.
:::

Writing your own backend? See [Adding a backend](/dev/backends).
