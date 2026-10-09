# config.toml

Every setting Waypaper Engine stores lives in one TOML file. The daemon creates it on first start and fills in missing keys with defaults.

Default path: `$XDG_CONFIG_HOME/waypaper-engine/config.toml` (usually `~/.config/waypaper-engine/config.toml`). Override with `waypaper-daemon --config <file>`. The daemon rewrites the file on API writes, so hand-written comments won't survive. `~` and `$VAR` are expanded in path values.

Edit it by hand, from Settings, or at runtime:

```bash
waypaper-daemon config set daemon '{"log_level":"debug"}'
```

Config routes are listed in the [HTTP API](/reference/api). `backend` is not a plain section:

::: warning
`config get backend` and `config set backend` return 404. Patch `{"backend": {...}}` via `PATCH /config`, a backend's own keys via `PATCH /config/backends/{name}`, and switch backends with `POST /backends/{name}/activate`.
:::

| Where | When changes apply |
| ----- | ------------------ |
| File edited on disk | Re-read automatically; emits [`config_changed`](/reference/events#config). |
| `[daemon]` | Restart the daemon. |
| `[backend.<name>]` | Next wallpaper change. Patching the active backend re-applies the current wallpaper. |
| `[app]`, `[monitors]`, `[wallhaven]` | Stored for the GUI; the daemon doesn't read them. |

Section patches (`app`, `daemon`, `monitors`, `wallhaven`) aren't range-checked. Backend patches are validated, as noted per backend.

## `[app]`

| Key | Default | Description |
| --- | ------- | ----------- |
| `kill_daemon_on_exit` | `false` | Stop the daemon when the app quits. |
| `notifications` | `true` | Desktop notifications for daemon events while the window is hidden. |
| `start_minimized` | `false` | Launch with the window hidden. |
| `minimize_instead_of_close` | `false` | Closing the window hides it instead of quitting. |
| `show_monitor_modal_on_start` | `true` | Show the monitor picker on launch. |
| `startup_intro` | `true` | Play the startup boot sequence. |
| `images_per_page` | `50` | Gallery page size (API caps `per_page` at 200). |
| `theme` | `"kolision-raw"` | A built-in or [user theme](/manual/themes) name, or `"system"` for OS light/dark. |
| `font_preset` | `"bundled"` | `bundled`, `google_sans`, `system`, `custom`. Unknown values use `bundled`. |
| `font_family_body` | `""` | CSS font-family for body text when `font_preset = "custom"`. |
| `font_family_display` | `""` | Same, for headings. |
| `font_family_mono` | `""` | Same, for monospace. |
| `image_history_limit` | `100` | (unused) |
| `sort_by` | `"imported_at"` | Default gallery sort: `name`, `imported_at`, `file_size`. |
| `sort_order` | `"desc"` | `asc` or `desc`. |

## `[daemon]`

| Key | Default | Description |
| --- | ------- | ----------- |
| `images_dir` | `$XDG_DATA_HOME/waypaper-engine/images` | Where imported images are copied. |
| `thumbnails_dir` | `$XDG_CACHE_HOME/waypaper-engine/thumbnails` | Thumbnails and video previews. |
| `database_dir` | `$XDG_DATA_HOME/waypaper-engine/db` | CloverDB directory. |
| `socket_path` | `$XDG_RUNTIME_DIR/waypaper-engine.sock` | Unix socket the daemon listens on. |
| `log_level` | `"info"` | `debug`, `info`, `warn`, `error`. `--log-level` and `WAYPAPER_LOG_LEVEL` override it. |
| `log_file` | `$XDG_DATA_HOME/waypaper-engine/daemon.log` | Rotated JSON log (also logged to stderr). |
| `log_max_size_mb` | `10` | Rotate the log at this size (> 0). |
| `log_max_backups` | `3` | Rotated files to keep (> 0). |
| `compositor` | `"auto"` | `auto`, `wayland`, `x11`. `auto` detects from the session environment. |

::: tip
The `waypaper-daemon` CLI always uses the default socket path. If you change `socket_path`, use `curl --unix-socket`. See [Paths & files](/reference/paths).
:::

## `[backend]`

Which setter is active ([Backends](/manual/backends)).

| Key | Default | Description |
| --- | ------- | ----------- |
| `type` | `"awww"` | `awww`, `feh`, `hyprpaper`, `mpvpaper`, `swaybg`, `wal-qt`. Falls back to the first installed one. |
| `selection_mode` | `"fixed"` | `fixed` always uses `type`; `auto` picks per media kind from `auto_priorities`. |
| `auto_priorities.image` | `["awww", "hyprpaper", "swaybg", "feh", "wal-qt"]` | Backends tried for still images in `auto` mode, in order. |
| `auto_priorities.video` | `["mpvpaper", "wal-qt"]` | Same, for videos. |
| `auto_priorities.web` | `["wal-qt"]` | Same, for HTML wallpapers. |
| `transition_duration_seconds` | not set | `0` to `120`. When above 0, overrides `awww.transition_duration` and `wal-qt.duration_ms`. |

### `[backend.awww]`

Rejected on write: `transition_duration` outside 0 to 120, invalid `daemon_format`.

| Key | Default | Description |
| --- | ------- | ----------- |
| `transition_type` | `"wipe"` | `none`, `simple`, `fade`, `left`, `right`, `top`, `bottom`, `wipe`, `wave`, `grow`, `center`, `any`, `outer`, `random`. |
| `transition_step` | `90` | Step size per frame. Skipped when `transition_type = "none"`. |
| `transition_duration` | `3` | Seconds, `0` to `120`. `0` omits the flag. |
| `transition_fps` | `60` | Transition frame rate. |
| `transition_angle` | `45` | Angle in degrees for directional effects. |
| `transition_pos` | `"center"` | Origin for `grow` / `outer`: `center`, `top`, `bottom`, `left`, `right`, `top-left`, `top-right`, `bottom-left`, `bottom-right`. |
| `transition_bezier` | `"0.25,0.1,0.25,1.0"` | Easing curve: four comma-separated numbers. |
| `transition_wave` | `"20,20"` | `width,height` for the `wave` effect. |
| `resize` | `"crop"` | `crop`, `fit`, `no`, `stretch`. |
| `fill_color` | `"000000"` | Padding colour for `fit` / `no`; hex, no `#`. |
| `filter_type` | `"Lanczos3"` | `Lanczos3`, `Bilinear`, `CatmullRom`, `Mitchell`, `Nearest`. |
| `invert_y` | `false` | Invert the Y axis of the transition position. |
| `daemon_format` | `""` | Pixel format for `awww-daemon`: `""` (awww default), `argb`, `abgr`, `rgb`, `bgr`. |

### `[backend.feh]`

| Key | Default | Description |
| --- | ------- | ----------- |
| `mode` | `"fill"` | `fill`, `scale`, `tile`, `center`, `max`. Unknown values use `fill`. |

### `[backend.hyprpaper]`

| Key | Default | Description |
| --- | ------- | ----------- |
| `fit_mode` | `"cover"` | `cover`, `contain`, `tile`, `fill`. |
| `config_path` | `""` | The `hyprpaper.conf` the daemon rewrites. Empty means `$XDG_CONFIG_HOME/hypr/hyprpaper.conf`. |

### `[backend.swaybg]`

| Key | Default | Description |
| --- | ------- | ----------- |
| `fit_mode` | `"fill"` | `stretch`, `fit`, `fill`, `center`, `tile`. |

### `[backend.mpvpaper]`

Rejected on write: `verbose` outside 0 to 2, negative `slideshow_secs`.

| Key | Default | Description |
| --- | ------- | ----------- |
| `mpv_options` | `"loop"` | mpv option string, passed as `-o`. |
| `verbose` | `0` | `0`, `1` (`-v`), `2` (`-vv`). |
| `auto_pause` | `false` | Pause when the wallpaper is hidden (`-p`). |
| `auto_stop` | `false` | Stop when the wallpaper is hidden (`-s`). |
| `layer` | `""` | Passed as `-l <layer>` when set. |
| `slideshow_secs` | `0` | Passed as `-n <secs>` when above 0. |

### `[backend.wal-qt]`

Qt WebEngine host for image, video and HTML wallpapers ([HTML wallpapers](/manual/html-wallpapers)). Rejected on write: bad `transition_bezier`, `parallax_direction`, `image_fit_mode`, `image_rendering` or `fill_color`; any `env` entry that isn't `KEY=VALUE` or sets `WAYLAND_DISPLAY`, `XDG_RUNTIME_DIR`, `DISPLAY`, `PATH`, `HOME`, `LD_PRELOAD` or `LD_LIBRARY_PATH`.

**Connection**

| Key | Default | Description |
| --- | ------- | ----------- |
| `socket_path` | `$XDG_RUNTIME_DIR/wal-qt.sock` | wal-qt control socket. |
| `expected_service` | `"wal-qt"` | Service name the health check must report. |
| `expected_api_version` | `"0"` | API version the health check must report. |
| `connect_timeout_ms` | `500` | Health-check timeout at startup (> 0). |
| `request_timeout_ms` | `1500` | Per-request timeout (> 0). |
| `load_timeout_ms` | `15000` | Wallpaper load timeout (> 0). |
| `env` | `[]` | Extra `KEY=VALUE` environment for `wal-qt-host`. |

**Transitions**

| Key | Default | Description |
| --- | ------- | ----------- |
| `transition` | `"none"` | `none`, `fade`, `left`, `right`, `top`, `bottom`, `wipe`, `grow`, `outer`, `wave`, `center`, `blur_through`, `any`, `random`. Unknown names fall back to `fade`. |
| `duration_ms` | `300` | Transition length (> 0). |
| `transition_bezier` | `"0.54,0,0.34,0.99"` | Easing curve: four numbers. |
| `transition_angle_deg` | `0` | Angle, wrapped into 0 to 359. |
| `transition_origin_x_percent` | `50` | Horizontal origin for `grow` / `outer`; `-200` to `200`. |
| `transition_origin_y_percent` | `50` | Vertical origin; `-200` to `200`. |
| `transition_wave_amplitude_percent` | `5` | `wave` amplitude (>= 0). |
| `transition_wave_frequency` | `3` | `wave` frequency (>= 0). |

**Rendering**

| Key | Default | Description |
| --- | ------- | ----------- |
| `image_fit_mode` | `"cover"` | CSS `object-fit`: `fill`, `contain`, `cover`, `none`, `scale-down`. |
| `image_rendering` | `"auto"` | CSS `image-rendering`: `auto`, `smooth`, `high-quality`, `crisp-edges`, `pixelated`. |
| `fill_color` | `"000000ff"` | `RRGGBB` or `RRGGBBAA` (unused). |
| `video_audio_default` | `false` | Play video audio by default. |
| `allow_network_wallpapers` | `false` | Let HTML wallpapers reach the network. |

**Parallax** ([Parallax](/manual/parallax))

| Key | Default | Description |
| --- | ------- | ----------- |
| `parallax_enabled` | `false` | Workspace-driven parallax. |
| `parallax_zoom` | `120` | Zoom in percent (`120` = 1.2x). Below 100 becomes 1.0x. |
| `parallax_step_percent` | `5` | Pan per workspace step, in percent (> 0). |
| `parallax_workspace_chunk_size` | `10` | Workspace ids per chunk (>= 1). |
| `parallax_animation_ms` | `600` | Pan animation length (> 0). |
| `parallax_reset_ms` | `400` | Reset animation length (> 0). |
| `parallax_easing` | `"0.215,0.610,0.355,1.000"` | Four numbers. Bad input uses the default. |
| `parallax_compositor_driver` | `"auto"` | `auto`, `off`, `hyprland`, `sway`. `auto` detects Hyprland or Sway. |
| `parallax_direction` | `"horizontal"` | `horizontal` or `vertical`. A wallpaper's `waypaper.json` can override it. |

## `[monitors]`

| Key | Default | Description |
| --- | ------- | ----------- |
| `selected_monitors` | `[]` | Output names the GUI targets (see `GET /monitors`). |
| `image_set_type` | `"individual"` | `individual`, `clone`, `extend`. `extend` only slices still images; others use `clone`. See [Displays](/manual/displays). |

## `[wallhaven]`

| Key | Default | Description |
| --- | ------- | ----------- |
| `enabled` | `false` | Turn the [Wallhaven](/manual/wallhaven) page on. |
| `api_key` | `""` | Your wallhaven.cc API key, stored in plain text. |
| `scroll_mode` | `"paginated"` | `paginated` or `infinite`. |
| `blur_nsfw_thumbnails` | `true` | Blur NSFW thumbnails. |
