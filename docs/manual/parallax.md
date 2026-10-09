# Parallax

Switch workspaces and your wallpaper slides a little with you. It's off by default.

## Requirements

- `wal-qt` is the active backend ([Backends & dependencies](/manual/backends)). No other backend has parallax.
- You're on Hyprland (`hyprctl` on `PATH`, `$HYPRLAND_INSTANCE_SIGNATURE` set) or sway (`$SWAYSOCK` set, or `swaymsg` working). KDE, GNOME, X11 and other compositors do nothing.
- `parallax_enabled = true`.

Each time the active workspace on a monitor changes, the wallpaper on that monitor nudges one step: right (or down) when the workspace number goes up, left (or up) when it goes down. Monitors are tracked separately.

## Turn it on

Use **Settings, Backend, wal-qt, Parallax**; saving applies right away. Or edit `config.toml`:

```toml
[backend.wal-qt]
parallax_enabled = true
```

## Options

All other keys are optional; the defaults are shown. Full listing in the [config reference](/reference/config).

| Key | Default | What it does |
| --- | --- | --- |
| `parallax_enabled` | `false` | Master switch. |
| `parallax_compositor_driver` | `"auto"` | `auto`, `hyprland`, `sway` or `off`. |
| `parallax_direction` | `"horizontal"` | `horizontal` (left/right) or `vertical` (up/down). |
| `parallax_workspace_chunk_size` | `10` | Set it close to how many workspaces you use, so wrapping from your last workspace to 1 reads as one step forward (1 to 64). |
| `parallax_step_percent` | `5` | How far one workspace switch moves the wallpaper (1 to 50). |
| `parallax_zoom` | `120` | Zoom in percent. 100 leaves no spare image, so nothing visibly moves (100 to 200). |
| `parallax_animation_ms` | `600` | Duration of each slide (16 to 5000). |
| `parallax_reset_ms` | `400` | Duration when parallax is disabled or the offset snaps back to center (16 to 10000). |
| `parallax_easing` | `"0.215,0.610,0.355,1.000"` | Cubic-bezier points `x1,y1,x2,y2`. |

A web wallpaper can set its own axis with `parallax_direction` in its `waypaper.json`, which overrides yours until you apply a regular image.

Images and videos move on their own. Web (HTML) wallpapers get a `wallpaper:parallax` event and have to move themselves; see [HTML wallpapers](/manual/html-wallpapers).

## Nothing moves?

1. Is `wal-qt` the active backend, and is `parallax_enabled` on?
2. Are you on Hyprland or sway? If you start the daemon from a systemd unit or launcher that doesn't inherit your session env, it can't see `$HYPRLAND_INSTANCE_SIGNATURE` or `$SWAYSOCK`.
3. Is `parallax_zoom` above 100?
4. Run `waypaper-daemon -l debug` and look for `parallax compositor driver inactive`, which means no compositor was detected.

More in [Troubleshooting](/manual/troubleshooting).
