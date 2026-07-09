# First 10 minutes

From zero to a wallpaper on your screen, and a playlist rotating on its own. This is the happy path — every step links to a deeper page if you want the details. If you're the scripting type, there's a taste of the API at the end.

**Prerequisites:**

- A Wayland or X11 compositor.
- One backend binary on `PATH` — for Wayland images, [`awww`](https://github.com/LGFae/awww) is the recommended start. See [Backends & dependencies](/guide/backends) for the full menu.
- On wlroots compositors (Hyprland, sway, ...): [`wlr-randr`](https://sr.ht/~emersion/wlr-randr/) for reliable monitor detection.

> [!NOTE]
> No backend installed yet? The app still launches — you'll see a banner with an install link, and it clears on its own once a backend appears on `PATH`.

---

## 1. Install

On Arch, simply:

```bash
yay -S waypaper-engine
```

Every other method (AppImage, from source, daemon-only) lives in [Install & run](/guide/install).

## 2. Launch it

Start **Waypaper Engine** from your app launcher, or:

```bash
waypaper-engine
```

The daemon starts automatically in the background if it isn't already running — it keeps running after you close the window, so playlists don't die with the GUI.

## 3. Pick your backend

Open **Settings → Backend** and select the one you installed (e.g. `awww`). Backends missing from `PATH` are greyed out. `auto` mode picks a backend per media type — you can come back for that later ([Backend settings](/guide/app#backend)).

## 4. Choose your displays

If you have more than one monitor, the **Choose Display** modal (monitor button in the top bar) shows your actual layout. Pick between:

- **Wallpaper per display** — each monitor gets its own image.
- **Clone** — same image everywhere.
- **Stretch** — one image spanning all monitors (static images only).

Single monitor? Skip this — it just works.

## 5. Import wallpapers

Drag and drop images, videos, or whole folders onto the window (or use the import button in the toolbar). Thumbnails, color palettes, and tags are generated in the background — progress shows inline. Formats and details: [The app — Gallery](/guide/app#gallery).

## 6. Set one

**Double-click** any image. That's your wallpaper.

**Right-click** for more: set on a specific monitor, set random, tags, folders, rename, delete.

## 7. Make it rotate — your first playlist

1. Hover images in the gallery and tick the **checkbox** that appears — they land in the playlist track at the bottom.
2. Hit **Configure** on the track and pick a schedule: **timer** (every N seconds), **manual** (next/prev only), **time of day**, or **day of week**.
3. **Save**, give it a name, and start it.

The playlist runs **in the daemon** — close the window, it keeps going.

And you're done! Wallpaper set, playlist rotating.

---

## Day two (for the scripting type)

Everything the UI does goes through a JSON HTTP API on a Unix socket, and everything that happens emits an event you can subscribe to:

```bash
# Is the daemon happy?
curl --unix-socket "${XDG_RUNTIME_DIR}/waypaper-engine.sock" http://localhost/healthz

# Watch wallpaper changes live, as JSON lines
waypaper-daemon events --types wallpaper_changed
```

Run the daemon headless (no GUI at all) from your compositor's autostart — see [Daemon only](/guide/install#daemon-only-headless-autostart). Full API surface: [API overview](/api/overview) · [Events & SSE](/api/sse).

---

_Something didn't work? [FAQ & troubleshooting](/guide/faq) covers the common failure modes — and if yours isn't there, open an issue with your compositor and backend._
