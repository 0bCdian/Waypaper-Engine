---
layout: home

hero:
  name: Waypaper Engine
  text: A wallpaper setter GUI, built for ricing
  tagline: Gallery, playlists, multiple backends supported on wayland and x11, SSE events, multiple themes and fonts, written in typescript and go.
  image:
    src: /logo.png
    alt: Waypaper Engine
  actions:
    - theme: brand
      text: Install & run
      link: /guide/install

features:
  - icon: 🖼️
    title: Beautiful Gallery
    details: Import images, videos, and HTML wallpapers. Thumbnails at multiple sizes, folders, tags, color swatches, and Wallhaven built in.
  - icon: 🔁
    title: Playlists just like Wallpaper Engine
    details: Timer, manual, time-of-day, and day-of-week schedules—all run in the daemon with clear events you can react to.
  - icon: 🧩
    title: Multiple backends to choose from
    details: awww (transitions, Wayland), hyprpaper, swaybg, feh (X11), mpvpaper (video), or wal-qt for HTML/video wallpapers. Auto mode picks the right one per media type.
  - icon: 🔌
    title: Integrate with anything
    details: The same JSON API the UI uses is open to scripts and tools. Subscribe to GET /events with Server-Sent Events—filter by type or tail from the CLI.
  - icon: 🎨
    title: Theme & font presets
    details: Ships with a long list of DaisyUI themes and font presets (including a "neo" gallery look). Pick in Settings or wire your own CSS stack.
  - icon: 🎬
    title: Looper and Shader Studio (Beta)
    details: Looper Studio for in/out points on video, and Shader Studio for importing Shadertoy JSON and saving WebGL wallpapers into the gallery.
---
