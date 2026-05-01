# Configuration reference

The daemon reads a single **TOML** file at startup and watches it for changes. Most settings are also writable at runtime via the `PATCH /config` API (or the Settings UI).

**Default path:** `$XDG_CONFIG_HOME/waypaper-engine/config.toml`  
Typically: `~/.config/waypaper-engine/config.toml`

If the file does not exist at startup, the daemon creates it with defaults. You can edit it by hand while the daemon is running—the config watcher will hot-reload and emit a `config_changed` SSE event.

---

## File layout

```toml
[app]
# UI and app behavior

[daemon]
# Paths, logging, compositor detection

[backend]
# Active backend and selection mode
# Also contains [backend.awww], [backend.mpvpaper], etc. subsections

[monitors]
# Monitor selection and image-set mode

[wallhaven]
# Wallhaven API integration
```

---

## `[app]`

Controls the Electron app's behavior and gallery defaults.

```toml
[app]
kill_daemon_on_exit         = false   # Stop daemon when Electron window closes
notifications               = true    # Desktop notifications
start_minimized             = false   # Hide window on launch
minimize_instead_of_close   = false   # Send to tray on window close
show_monitor_modal_on_start = false   # Show monitor picker every launch
images_per_page             = 50      # Gallery page size (max 200)
theme                       = "dark"  # DaisyUI theme name, or "system"
font_preset                 = ""      # "", "kolision", "google-sans", or "custom"
font_family_body            = ""      # CSS font-family when font_preset = "custom"
font_family_display         = ""      # CSS font-family for display/headings
font_family_mono            = ""      # CSS font-family for mono
image_history_limit         = 100     # Max wallpaper history entries
sort_by                     = "imported_at"  # Gallery default sort: name|imported_at|file_size
sort_order                  = "desc"         # asc|desc
```

### Theme values

The theme string is a DaisyUI theme name or `"system"`. Available themes include: `dark`, `light`, `cupcake`, `bumblebee`, `emerald`, `corporate`, `synthwave`, `retro`, `cyberpunk`, `valentine`, `halloween`, `garden`, `forest`, `aqua`, `lofi`, `pastel`, `fantasy`, `wireframe`, `black`, `luxury`, `dracula`, `cmyk`, `autumn`, `business`, `acid`, `lemonade`, `night`, `coffee`, `winter`, plus custom "neo" presets. The full list shows in the Settings theme picker.

---

## `[daemon]`

Controls daemon internals: where files live and how logging works.

```toml
[daemon]
images_dir      = "~/.local/share/waypaper-engine/images"     # Imported image cache
thumbnails_dir  = "~/.cache/waypaper-engine/thumbnails"       # Generated thumbnails
database_dir    = "~/.local/share/waypaper-engine/db"         # CloverDB files
socket_path     = "/run/user/1000/waypaper-engine.sock"       # Unix socket path
log_level       = "info"    # debug|info|warn|error
log_file        = "~/.local/share/waypaper-engine/daemon.log"
log_max_size_mb = 10        # Rotate log at this size
log_max_backups = 3         # Keep this many rotated log files
compositor      = "auto"    # auto|wayland|x11
```

### Notes

- `socket_path` defaults to `$XDG_RUNTIME_DIR/waypaper-engine.sock`. Override only if your runtime dir is non-standard.
- `compositor = "auto"` detects from environment variables (`WAYLAND_DISPLAY`, `DISPLAY`). Force to `wayland` or `x11` if detection fails.
- `~` in paths is expanded to `$HOME`.

---

## `[backend]`

Selects the active backend and controls selection mode.

```toml
[backend]
type                        = "awww"       # Active backend name
selection_mode              = "fixed"      # fixed|auto
transition_duration_seconds = 0.0          # Canonical transition duration (see below)

[backend.auto_priorities]
# Used when selection_mode = "auto"
image = ["awww", "hyprpaper", "feh"]
video = ["mpvpaper", "wayland-utauri"]
web   = ["wayland-utauri"]
```

### `transition_duration_seconds`

A canonical duration shared across backends. When set to `> 0`, wayland-utauri and awww use this value instead of their own legacy `duration_ms` / `transition_duration` fields. Set it to `0` (or omit) to let each backend use its own duration field independently.

### Per-backend subsections

Each backend's config lives under `[backend.<name>]`. You can have multiple backends configured at once; switching backends does not lose the previous backend's settings.

#### `[backend.awww]`

```toml
[backend.awww]
transition_type     = "wipe"
transition_step     = 90
transition_duration = 3
transition_fps      = 60
transition_angle    = 45
transition_pos      = "center"
transition_bezier   = "0.25,0.1,0.25,1.0"
transition_wave     = "20,20"
resize              = "crop"          # crop|fit|no|stretch
fill_color          = "000000"        # hex, no leading #
filter_type         = "Lanczos3"      # Lanczos3|Bilinear|CatmullRom|Mitchell|Nearest
invert_y            = false
```

Transition types: `none`, `simple`, `fade`, `left`, `right`, `top`, `bottom`, `wipe`, `wave`, `grow`, `center`, `any`, `outer`, `random`

Transition positions: `center`, `top`, `bottom`, `left`, `right`, `top-left`, `top-right`, `bottom-left`, `bottom-right`

#### `[backend.mpvpaper]`

```toml
[backend.mpvpaper]
mpv_options    = "loop"   # raw mpv CLI options
verbose        = 0        # 0|1|2
auto_pause     = false
auto_stop      = false
layer          = ""       # Wayland layer override
slideshow_secs = 0        # 0 = off; > 0 = slideshow interval
```

#### `[backend.hyprpaper]`

No additional keys currently supported.

#### `[backend.feh]`

No additional keys currently supported.

#### `[backend.wayland-utauri]`

wayland-utauri config is primarily managed through the daemon's network settings API and the Settings UI. The backend section is present in the config but most options are managed at runtime.

---

## `[monitors]`

```toml
[monitors]
selected_monitors = ["DP-1", "HDMI-A-1"]   # Which outputs to use
image_set_type    = "individual"            # individual|clone|extend
```

### `image_set_type`

| Value        | Behavior                                          |
| ------------ | ------------------------------------------------- |
| `individual` | Each monitor gets its own wallpaper independently |
| `clone`      | Same image cloned to every selected monitor       |
| `extend`     | One image sliced and extended across all monitors |

`selected_monitors` is a list of output names as returned by `GET /monitors` (e.g. `DP-1`, `eDP-1`, `HDMI-A-1`). The monitor selection UI in Settings populates this from the live monitor list.

> Important, only static images work on `extend` mode, on images of type `video` and `web`, or `gifs` ,`extend` mode fallbacks to `clone`, this is a limitation we have that is too bothersome to work around

---

## `[wallhaven]`

```toml
[wallhaven]
api_key     = ""            # Your Wallhaven API key (optional)
enabled     = false         # Show the Wallhaven section in the app
scroll_mode = "paginated"   # paginated|infinite
```

Leave `api_key` blank for anonymous browsing (SFW content only). With an API key you get access to your user data, favorites, and NSFW content (if enabled in your Wallhaven account settings).

---

## Default file paths (XDG)

All paths respect XDG base directories. Typical values on Linux:

| Purpose             | Default path                                |
| ------------------- | ------------------------------------------- |
| Config file         | `~/.config/waypaper-engine/config.toml`     |
| Unix socket         | `/run/user/<uid>/waypaper-engine.sock`      |
| Images (library)    | `~/.local/share/waypaper-engine/images`     |
| Thumbnails          | `~/.cache/waypaper-engine/thumbnails`       |
| Database (CloverDB) | `~/.local/share/waypaper-engine/db`         |
| Log file            | `~/.local/share/waypaper-engine/daemon.log` |
| PID lock            | `/run/user/<uid>/waypaper-engine.pid`       |

Override any of these in `[daemon]`. Changes take effect on next daemon start.

---

## Reading and writing config at runtime programatically

The daemon exposes all config sections through the HTTP API:

```bash
SOCK="${XDG_RUNTIME_DIR}/waypaper-engine.sock"

# Read full config
curl -s --unix-socket "$SOCK" http://localhost/config | jq

# Read one section
curl -s --unix-socket "$SOCK" http://localhost/config/app | jq

# Update app section
curl -s -X PATCH --unix-socket "$SOCK" http://localhost/config/app \
  -H 'Content-Type: application/json' \
  -d '{"images_per_page": 100, "theme": "dracula"}'

# Read backend config for a specific backend
curl -s --unix-socket "$SOCK" http://localhost/config/backends/awww | jq

# Update awww config (even if it's not the active backend)
curl -s -X PATCH --unix-socket "$SOCK" http://localhost/config/backends/awww \
  -H 'Content-Type: application/json' \
  -d '{"transition_type": "fade", "transition_duration": 2}'
```

Config changes via the API are persisted to disk and emit a `config_changed` SSE event. See [API overview](/api/overview) and [Events & SSE](/api/sse).
