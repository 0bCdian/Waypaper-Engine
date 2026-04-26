# Backends & dependencies

The daemon delegates the actual wallpaper-setting call to a **backend** binary. Each backend is a separate program you install independently—waypaper-engine just orchestrates them.

**Be advised** — the active backend binary must be on `PATH` when the daemon starts. If it is not found, `GET /backends` will show `"available": false` and nothing will be set. You can switch backends at runtime from Settings without restarting the daemon.

---

## Choosing a backend

| Backend | Compositor | Media types | Transitions | Best for |
|---------|------------|-------------|-------------|----------|
| **awww** | Wayland | Images, GIFs | ✓ Rich | Default Wayland choice |
| **hyprpaper** | Wayland (Hyprland) | Images | — | Hyprland users wanting tight integration |
| **feh** | X11 | Images | — | X11 setups |
| **mpvpaper** | Wayland | Videos | — | Video wallpapers on Wayland |
| **wayland-utauri** | Wayland | Images, video, HTML/CSS/JS | ✓ | HTML, animated, and interactive wallpapers |

---

## awww

[awww](https://codeberg.org/LGFae/awww) is a Wayland wallpaper daemon with smooth transition support, previously called swww. From version 3.0 of waypaper-engine onwards, we look for awww instead of swww to respect the author's name change decision.

### Install

```bash
# Arch (AUR)
yay -S awww

```

For further details go to the awww repository linked above.

> Make sure `awww` and `awww-daemon` are on `PATH`.

### Config keys (`[backend.awww]` in `config.toml`)

```toml
[backend.awww]
transition_type = "wipe"        # none|simple|fade|left|right|top|bottom|wipe|wave|grow|center|any|outer|random
transition_step = 90            # pixels per frame (speed)
transition_duration = 3         # seconds
transition_fps = 60             # frames per second
transition_angle = 45           # degrees (for directional transitions)
transition_pos = "center"       # center|top|bottom|left|right|top-left|top-right|bottom-left|bottom-right
transition_bezier = "0.25,0.1,0.25,1.0"
transition_wave = "20,20"       # wave amplitude,length
resize = "crop"                 # crop|fit|no|stretch
fill_color = "000000"           # hex background fill (no leading #)
filter_type = "Lanczos3"        # Lanczos3|Bilinear|CatmullRom|Mitchell|Nearest
invert_y = false
```

> TOML accepts both hyphens and underscores: `transition-type` and `transition_type` are equivalent.

---

## hyprpaper

[hyprpaper](https://github.com/hyprwm/hyprpaper) is the official Hyprland wallpaper utility. It runs as a separate daemon managed by Hyprland.

### Install

```bash
yay -S hyprpaper
```

Make sure `hyprpaper` is on `PATH`. The waypaper daemon handles loading wallpapers into it—you do not need a separate `hyprpaper.conf`.

### Config keys (`[backend.hyprpaper]`)

Hyprpaper does not expose transition config. No additional config keys are supported in the current release.

---

## feh

[feh](https://feh.finalrewind.org/) is the classic X11 image viewer and wallpaper setter. Still in beta as of <span>{{ new Date().toLocaleDateString() }}</span>, I don't have a x11 system to try, and haven't bothered yet to use a vm to test. If it doesn't work open an issue in github.

### Install

```bash
# Arch
yay -S feh
```

### Config keys (`[backend.feh]`)

feh does not support transitions or per-backend config keys in the current release. Mode is controlled by the monitor `image_set_type` in `[monitors]`.

---

## mpvpaper

[mpvpaper](https://github.com/GhostNaN/mpvpaper) plays videos as Wayland wallpapers using mpv.

### Install

```bash
yay -S mpvpaper
```

Requires [mpv](https://mpv.io/) as a dependency—mpvpaper will pull it in.

### Config keys (`[backend.mpvpaper]`)

```toml
[backend.mpvpaper]
mpv_options = "loop"      # raw mpv options string passed to the process
verbose = 0               # verbosity level (0–2)
auto_pause = false        # pause video when window is unfocused
auto_stop = false         # stop video when window is unfocused
layer = ""                # Wayland layer (leave blank for default)
slideshow_secs = 0        # 0 = no slideshow; > 0 = slideshow interval in seconds
```

---

## wayland-utauri

[wayland-utauri](https://github.com/0bCdian/wayland-utauri) is my Tauri-based Wayland wallpaper renderer. It places a WebKit webview on the **background** layer using `gtk-layer-shell`, enabling **HTML, CSS, JavaScript, and video** wallpapers.

This is an **optional backend**—only install it if you want web or video wallpapers on Wayland.

### What it enables

- Set any image or video as a wallpaper (same as other backends, but via WebKit).
- Set **HTML web wallpapers**: packages containing `index.html`, a manifest (`project.json`), and optional assets.
- Import Shadertoy shaders via Shader Studio and set them as live wallpapers.
- JavaScript access to audio, time, monitor info via a JS API provided by wayland-utauri.

### Install

```bash
# AUR
yay -S wayland-utauri
# or git version
yay -S wayland-utauri-git
```

Or build from source (requires Rust in your system for building locally):

```bash
git clone https://github.com/0bCdian/wayland-utauri.git
cd wayland-utauri
npm install && make build && make install
```

### Runtime dependencies

| Dependency | Purpose |
|------------|---------|
| `gtk4` | GTK4 window/widget system |
| `gtk4-layer-shell` | Places the webview on the Wayland background layer |
| `webkit2gtk-4.1` | WebKit engine (renders HTML wallpapers) |
| `gstreamer` + plugins | GStreamer for media playback (video wallpapers, the `asset://` protocol) |

On Arch, these are pulled in as dependencies by the AUR package.

### Config keys (`[backend.wayland-utauri]`)

The wayland-utauri backend config is managed in the Settings UI under the backend section. Key options:

- **Network allow:** global toggle for whether HTML wallpapers can make outbound network requests. Off by default. Individual wallpaper manifests also control this per-wallpaper.
- **Transition type:** crossfade between wallpapers (duration set by `transition_duration_seconds` in `[backend]`).

> **Be advised** — when you change the global network permission in Settings, the daemon pushes the new setting to the wayland-utauri control socket, which may briefly reload active HTML wallpaper webviews (a short flicker is normal).

### Web wallpaper spec

HTML wallpapers follow the [web wallpaper spec](https://github.com/0bCdian/wayland-utauri/blob/main/docs/WEB_WALLPAPER_SPEC.md) defined in the wayland-utauri repo. A minimal web wallpaper is a directory with:

```
my-wallpaper/
├── waypaper.json     # manifest (name, author, capabilities)
└── index.html       # entry point
```

Import the directory into the gallery—it appears as a `web` media-type item and can be set via the wayland-utauri backend.

---

## Auto backend selection

When `selection_mode = "auto"` in `[backend]`, the daemon picks a backend per media type using ordered priority lists:

```toml
[backend]
type = "awww"              # fallback if no auto match
selection_mode = "auto"

[backend.auto_priorities]
image = ["awww", "hyprpaper", "feh"]
video = ["mpvpaper", "wayland-utauri"]
web   = ["wayland-utauri"]
```

The daemon picks the **first available** backend in each list. If none in the list are available it falls back to the fixed `type`.

---

## Monitor detection dependency: wlr-randr

The daemon uses [`wlr-randr`](https://sr.ht/~emersion/wlr-randr/) to enumerate Wayland outputs (name, resolution, position). Without it, monitor-specific features (individual mode, multi-monitor targeting) degrade to best-effort.

```bash
# Arch
yay -S wlr-randr
```

`wlr-randr` works with wlroots-based compositors (sway, Hyprland, river, etc.).

If `wlr-randr` is missing, there's a fallback to `wayland-utauri` on wayland systems, but it is recommended to have `wlr-randr` installed. On x11 systems `xrandr` is used.
