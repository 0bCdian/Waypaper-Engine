# HTML wallpapers

A web wallpaper is a folder with an `index.html` that is rendered as your desktop background, on every monitor, by Chromium. Shaders, canvas animations, audio visualisers, a CSS clock, anything you can put in a web page. It needs the [wal-qt backend](/manual/backends#wal-qt) on a Wayland compositor with layer-shell (not GNOME); in [auto mode](/manual/backends#auto-mode) Waypaper switches to wal-qt for you.

## Installing wal-qt

On Arch:

```bash
yay -S wal-qt        # stable
yay -S wal-qt-git    # rolling (conflicts with wal-qt)
```

From source (needs Qt 6 WebEngine, LayerShellQt, PipeWire, CMake, Node 20+, pnpm and Go):

```bash
git clone https://github.com/0bCdian/wal-qt
cd wal-qt
make build
make install              # to ~/.local; keep ~/.local/bin on your $PATH
# or: sudo make install-system   (to /usr/local)
```

Then pick **wal-qt** under **Settings → Backend** or run `waypaper-daemon backends activate wal-qt`. The daemon starts `wal-qt-host` itself. If the backend shows "(not installed)", check `which wal-qt-host`; `wal-qt health` tells you if the host is running.

## Import a wallpaper

1. In the gallery, click **Import web wallpaper** (globe icon in the add bar).
2. Pick the wallpaper's folder or its `waypaper.json`. Dragging a folder in works too, and so does a parent folder: every directory that directly contains a `waypaper.json` or `project.json` is imported.

The folder is copied into Waypaper's storage, so the original can move. It appears as a `web` item named after the manifest `title`, with the `preview` image as thumbnail. Import fails with a readable error if the manifest, `entry` or `preview` file is missing. [Studios](/manual/studios) can produce web wallpapers too.

## Write your own

A wallpaper is a folder with a `waypaper.json` manifest and your files. Here is a complete one, `pulse/`.

`pulse/waypaper.json`:

```json
{
  "title": "Pulse",
  "author": "you",
  "entry": "index.html",
  "capabilities": {},
  "wallpaper_config": {
    "speed": { "type": "number", "default": 1, "min": 0.1, "max": 4, "step": 0.1, "label": "Speed" },
    "accent": { "type": "color", "default": "#7daea3", "label": "Accent" }
  }
}
```

`pulse/index.html`:

```html
<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <style>
      html, body { margin: 0; width: 100%; height: 100%; overflow: hidden; background: #111; }
      #orb {
        position: absolute; left: 50%; top: 50%;
        width: 40vmin; height: 40vmin; margin: -20vmin 0 0 -20vmin;
        border-radius: 50%;
        background: var(--accent, #7daea3);
        animation: pulse calc(4s / var(--speed, 1)) ease-in-out infinite;
      }
      @keyframes pulse { 50% { transform: scale(1.3); opacity: 0.6; } }
    </style>
  </head>
  <body>
    <div id="orb"></div>
    <script>
      function apply(cfg = {}) {
        const root = document.documentElement.style;
        if (cfg.speed != null) root.setProperty("--speed", cfg.speed);
        if (cfg.accent) root.setProperty("--accent", cfg.accent);
      }
      window.addEventListener("waypaper:config", (ev) => apply(ev.detail));
      apply(window.__WAYPAPER_CONFIG);
    </script>
  </body>
</html>
```

Import the folder and set it like any other wallpaper. Change **Speed** or **Accent** under **Web wallpaper → Wallpaper settings** in the image's detail sidebar and hit **Save** to see it update live.

### Manifest fields

| Field | Required | What it does |
| --- | --- | --- |
| `entry` | Yes | HTML file to load, relative to the folder (`file` also works). Always set it. |
| `title`, `description`, `author` | No | Gallery metadata. |
| `preview` | No | Gallery thumbnail image. |
| `capabilities` | No | What the page may ask for; all `false` by default (see below). |
| `wallpaper_config` | No | Settings form. Each id maps to `type` (`number`, `bool`, `color` or `string`), `default`, `label`, and `min`/`max`/`step` for numbers. |

`project.json` is accepted in place of `waypaper.json` (its `general.properties` become `wallpaper_config`), so Wallpaper Engine style packages may work.

| Capability | What it does |
| --- | --- |
| `network` | Allows `fetch`, XHR and WebSocket to the internet. See [Network](#network). |
| `audio_reactive` | Feeds your desktop audio to the page. Needs PipeWire. |
| `pointer_interactive` | The wallpaper receives mouse input instead of being click-through. |
| `keyboard` | Layer-shell keyboard interactivity for the page. |
| `parallax_aware` | Marks that the page handles parallax itself. |

You can change capabilities after import under **Web wallpaper → Capabilities** in the detail sidebar.

## Page APIs

It's a normal web page, so `Date`, canvas, WebGL and CSS animations just work. wal-qt adds:

| API | When | What you get |
| --- | --- | --- |
| `window.__WAYPAPER_CONFIG` | On load | Your `wallpaper_config` values. |
| `waypaper:config` event on `window` | Every settings change | Values in `ev.detail`. |
| `window.wallpaperRegisterAudioListener(cb)` | `audio_reactive` | `Uint8Array(128)` of bands, 0-255, log-spaced 20 Hz to 20 kHz. |
| `waypaper:audio-reactive` message | `audio_reactive` | `ev.data` has `bands` (0..1), `rms`, `peak`. |
| `wallpaper:parallax` event on `window` | Parallax enabled | `ev.detail` has `enabled`, `zoom`, `offset_x`, `offset_y`, `animation_ms`, `easing`, `reset_ms`. See [Parallax](/manual/parallax). |

## Network

::: warning Remote content may be blocked
Remote requests need both the global switch (**Settings → Backend → wal-qt → Allow network for HTML wallpapers**) and `"network": true` in the manifest, and even then remote scripts, fonts and images may be blocked by wal-qt's content policy. Bundle everything inside the wallpaper's folder. `<iframe>`s are always blocked.
:::

## Videos and GIFs

wal-qt also plays videos and animated GIFs. Video audio is off by default; set `video_audio_default` in the wal-qt config to turn it on. For video only, [mpvpaper](/manual/backends#mpvpaper) is lighter.
