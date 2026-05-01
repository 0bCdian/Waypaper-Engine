# Introduction

I wanted a Linux wallpaper app that **feels** like part of a rice—not a file picker bolted onto a shell command. That means a real **gallery** with thumbnails, tags, and color swatches; **playlists** that schedule themselves without extra scripts; and a **control plane** you can wire into anything over plain HTTP.

**Waypaper Engine v3** is an **Electron** GUI backed by a **Go daemon**. The daemon owns all state: the gallery (CloverDB), playlists, wallpaper history, and which backend is active. The UI, the CLI, and anything you write talk to it over a **Unix socket** using ordinary JSON HTTP. Live updates (imports, wallpaper changes, playlist events, config changes) stream over **Server-Sent Events** on `GET /events`.

---

## What it does

- **Gallery** — Import images, videos, GIFs, and HTML/web wallpapers. Browse with thumbnails at several sizes, filter by media type, tags, dominant colors, or folder. Rename files in the app. Pull wallpapers from Wallhaven without leaving the window.
- **Playlists** — Four schedule types: **timer** (every N seconds), **manual** (next/prev only), **time-of-day** (image per time slot), **day-of-week** (image per weekday). Each playlist runs in the daemon and fires SSE events the UI (and your scripts) can react to.
- **Pluggable backends** — The daemon delegates the actual `set wallpaper` call to whichever backend you configure. Switch backends in Settings; the daemon will restart the active one.
- **Wallpaper history** — Every change is logged. Navigate backward and forward per monitor.
- **Shader Studio** (beta) — Import Shadertoy JSON (multipass supported), tweak in a live WebGL2 preview, save as a web wallpaper in the gallery.
- **Looper Studio** (beta) — Set in/out points on videos from the library, preview the loop, optionally export via ffmpeg.
- **Scripting / automation** — Same HTTP API the UI uses. Connect, subscribe to SSE, and react. No polling required.

---

## Architecture in one paragraph

The **Go daemon** starts first (either launched by the Electron app or via systemd/autostart). It binds a Unix socket at `$XDG_RUNTIME_DIR/waypaper-engine.sock` and exposes a chi HTTP router. The **Electron main process** spawns the daemon if it is not already running, then the renderer talks to it through a **preload bridge** (`window.API_RENDERER`). Everything that changes emits an SSE event. The daemon also ships a **Cobra CLI** (`waypaper-daemon`) for scripting.

---

## Backends at a glance

| Backend            | Compositor         | Media               | Transitions    | Notes                                                           |
| ------------------ | ------------------ | ------------------- | -------------- | --------------------------------------------------------------- |
| **awww**           | Wayland            | Images, GIFs        | ✓ (many types) | Recommended for Wayland image wallpapers                        |
| **hyprpaper**      | Wayland (Hyprland) | Images              | —              | Tight Hyprland integration                                      |
| **feh**            | X11                | Images              | —              | Classic X11 setter                                              |
| **mpvpaper**       | Wayland            | Videos              | —              | Plays videos as wallpapers                                      |
| **wayland-utauri** | Wayland            | Images, video, HTML | ✓              | Renders full HTML/CSS/JS wallpapers via WebKit; separate binary |

See [Backends & dependencies](/guide/backends) for setup, config, and dependencies per backend.

---

## Runtime dependencies

These are **runtime** requirements—build deps are separate (see [Install & run](/guide/install)).

**Always required:**

- A Wayland or X11 compositor
- At least one **wallpaper backend** binary on `PATH` (see above)

**Required for Wayland monitor detection:**

- [`wlr-randr`](https://sr.ht/~emersion/wlr-randr/) — used by the daemon to enumerate Wayland outputs (monitor names, resolutions). Install it or monitor-specific features degrade to best-effort.

**Optional:**

- [`ffmpeg`](https://ffmpeg.org/) — needed for Looper Studio export and some video preview paths
- [`wayland-utauri`](https://github.com/0bCdian/wayland-utauri) — required only if you want HTML/web wallpapers (`wayland-utauri` backend)

---

## What to read next

| If you want to…                                    | Go to                                                    |
| -------------------------------------------------- | -------------------------------------------------------- |
| Install and start the app                          | [Install & run](/guide/install)                          |
| One happy path from zero to a wallpaper            | [First 10 minutes](/guide/first-run)                     |
| Disambiguate binaries and buzzwords                | [Glossary](/guide/glossary)                              |
| Understand each backend and its config             | [Backends & dependencies](/guide/backends)               |
| Learn every TOML config key                        | [Configuration reference](/guide/config)                 |
| Learn the UI screens (gallery, playlists, studios) | [The app (UI)](/guide/app)                               |
| Wire scripts or other programs to the daemon       | [API overview](/api/overview) + [Events & SSE](/api/sse) |
| Fix startup, backends, or monitor detection        | [FAQ & troubleshooting](/guide/faq)                      |
| Hack on the codebase                               | [Development guide](/dev/development)                    |

---

> **NOTE** — HTML wallpapers (wayland-utauri): outbound network stays off until you enable the global allow in Settings **and** the wallpaper manifest allows it. The web wallpaper spec lives in the [wayland-utauri repo](https://github.com/0bCdian/wayland-utauri/blob/main/docs/WEB_WALLPAPER_SPEC.md).
