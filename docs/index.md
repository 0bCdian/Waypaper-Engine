---
layout: home

hero:
  name: Waypaper Engine
  text: A wallpaper setter GUI, built for ricing
  tagline: Gallery, playlists, pluggable backends—and a Go daemon you can script. HTTP over Unix socket, live updates over SSE.
  image:
    src: /logo.png
    alt: Waypaper Engine
  actions:
    - theme: brand
      text: Install & run
      link: /guide/install
    - theme: alt
      text: API & events
      link: /api/overview

features:
  - icon: 🖼️
    title: Gallery-first
    details: Import images, videos, and HTML wallpapers. Thumbnails at multiple sizes, folders, tags, color swatches, and Wallhaven built in.
  - icon: 🔁
    title: Playlists that make sense
    details: Timer, manual, time-of-day, and day-of-week schedules—all run in the daemon with clear events you can react to.
  - icon: 🧩
    title: Pluggable backends
    details: awww (transitions, Wayland), hyprpaper, feh (X11), mpvpaper (video), or wayland-utauri for HTML/video wallpapers. Auto mode picks the right one per media type.
  - icon: 🔌
    title: Integrate with anything
    details: The same JSON API the UI uses is open to scripts and tools. Subscribe to GET /events with Server-Sent Events—filter by type or tail from the CLI.
  - icon: 🎨
    title: Theme & font presets
    details: Ships with a long list of DaisyUI themes and font presets (including a "neo" gallery look). Pick in Settings or wire your own CSS stack.
  - icon: 🎬
    title: Beta studios
    details: Looper Studio for in/out points on video, and Shader Studio for importing Shadertoy JSON and saving WebGL wallpapers into the gallery.
---

---

### Quick links

- **Install** — [Install & run](/guide/install) (AUR, AppImage, from source, systemd)
- **New here** — [First 10 minutes](/guide/first-run) · [Glossary](/guide/glossary)
- **Stuck?** — [FAQ & troubleshooting](/guide/faq) (stale socket, backends, monitors, logs)
- **Backends** — [Backends & dependencies](/guide/backends) (awww, hyprpaper, feh, mpvpaper, wayland-utauri)
- **Config** — [Configuration reference](/guide/config) (every TOML key explained)
- **Automate** — [Events & SSE](/api/sse) (`?types=wallpaper_changed`, or `waypaper-daemon events`)
- **API spec** — [OpenAPI spec & curl examples](/api/openapi) · [Full prose contract](/api/contract)

---

_Something wrong or confusing in these docs? Open an issue—I want them to match what the code actually does._
