# Parallax compositor driver (Hyprland / Sway)

When the backend is **wayland-utauri** and **parallax** is enabled in settings, the daemon translates **workspace switches** into monitor-scoped **`POST /wallpaper/parallax-move`** updates on the wayland-utauri socket.

## Configuration (`config.toml`)

Under **`[backend.wayland-utauri]`**:

| Key | Values | Default |
|-----|--------|---------|
| `parallax_enabled` | bool | `false` |
| `parallax_compositor_driver` | `auto`, `off`, `hyprland`, `sway` | `auto` |
| `parallax_direction` | `horizontal`, `vertical` | `horizontal` |

**`parallax_direction`** sets whether workspace-driven parallax nudges map to **left/right** (`offset_x`) or **up/down** (`offset_y`). **Web wallpapers** can override per package with top-level **`parallax_direction`** in **`waypaper.json`** (`horizontal` or `vertical`); if omitted, the backend default applies. The engine re-reads `waypaper.json` from disk when applying the wallpaper.

- **`off`**: never run the workspace bridge.
- **`auto`**: run the Hyprland driver if `HYPRLAND_INSTANCE_SIGNATURE` is set and `hyprctl version` succeeds; else the Sway driver if `SWAYSOCK` is set or `swaymsg` works on Wayland.
- **`hyprland`** / **`sway`**: force that driver; if the environment does not match, the driver stays inactive (silent).

On **GNOME, KDE, or other environments**, detection yields no driver: **no error** is shown; parallax config is still pushed, but nothing sends `parallax-move` until you use an external script or a future integration.

## Behavior notes

- **Hyprland:** uses **socket2** (`$XDG_RUNTIME_DIR/hypr/$HYPRLAND_INSTANCE_SIGNATURE/.socket2.sock`) when available; otherwise polls `hyprctl` about every **50 ms**.
- **Sway:** uses **`swaymsg -t subscribe '["workspace"]'`** when possible; otherwise polls **`get_workspaces`** every **50 ms**.
- **Workspace model:** absolute workspace-target mapping per monitor chunk (no geometry-based direction fallback path in current driver).
- **Monitor scope (movement):** workspace driver always sends `parallax-move` with a concrete `monitor` id; movement updates are per-monitor only.
- **Monitor scope (config sync):** runtime config sync (`POST /wallpaper/parallax`) is intentionally global when no monitor is specified (zoom/easing/step policy applies to all monitors).
- **Topology resolve:** driver monitor resolution snapshots topology once per tick context to avoid per-monitor `/wallpaper/status` churn.

## Custom compositors

Use the same HTTP API as the daemon. In the **waypaper-tauri** tree, see `docs/PARALLAX_COMPOSITOR_BRIDGE.md` and `example_scripts/hyprland-parallax.sh`.

## Implementation (developers)

- Go package: `daemon/internal/parallaxdriver`
- Lifecycle: `WaylandUtauri.syncParallaxDriver` after successful `POST /wallpaper/parallax` sync and when utauri is already running at init; stopped on backend shutdown.
