# The app (UI)

The app is an Electron shell around a React frontend. Navigation uses a hash router—six routes, each a full-screen view.

---

## Gallery (Home `/`)

The main screen. Everything you do with wallpapers starts here.

<!-- SCREENSHOT PLACEHOLDER: Full gallery view showing the image grid with thumbnails, sidebar, and toolbar -->
<!-- Description: Wide screenshot of the gallery with ~20 wallpapers visible, sidebar on left showing folders tree, toolbar at top with search/filter controls -->

**Importing:**

- Drag-and-drop **images**, **videos**, **folders**, or a **web wallpaper manifest** (`project.json`) directly onto the window.
- Click the **import button** in the toolbar to browse files.
- Paste an `https://` URL to import from the web (where the active backend supports it).
- Supported formats: JPG, PNG, GIF, WebP, BMP, SVG, TIFF (images); MP4, WebM, MKV, MOV (videos).
- Import progress is shown inline and reported live via SSE `processing_*` events.

**Browsing:**

- Filter by **media type** (image, video, GIF, web), **tags**, **dominant colors**, or **folder**.
- **Color filter:** click swatches to filter by palette, or use perceptual matching (`colors_near`).
- **Search:** fuzzy name/tag search in the toolbar.
- **Sort:** by name, import date, or file size—ascending or descending. Persisted in config.

<!-- SCREENSHOT PLACEHOLDER: Gallery with filter panel open, showing tag filters and color swatches selected -->

**Setting a wallpaper:**

- **Double-click** any image to set it on the current monitor configuration.
- **Right-click** for the context menu: set on specific monitor, set random, move to folder, rename, add tags, delete.

**Selecting for playlists:**

- Hover an image to reveal a **checkbox** in the corner. Check multiple images, then open the playlist panel to add them to a new or existing playlist.

<!-- SCREENSHOT PLACEHOLDER: Gallery with 3 images checked, playlist creation panel open on the right -->

**Image detail:**

- Click the image name or use the context menu to open the detail panel.
- Edit **tags**, view **metadata** (dimensions, size, format, import date, colors).
- **Rename on disk:** the rename operation renames the file on disk and updates the database in one step.

**History navigation:**

- The history button (or the **History** route) shows a per-monitor log of every wallpaper change with source (manual, random, playlist). Navigate back and forward.

---

## Settings (`/settings`)

<!-- SCREENSHOT PLACEHOLDER: Settings page showing backend selection, monitor config, and app behavior sections -->

Settings are organized into several sections. Changes are saved immediately and synced to the daemon via `PATCH /config`.

### Backend

Pick which backend sets your wallpaper:

- **Type:** choose from `awww`, `hyprpaper`, `feh`, `mpvpaper`, or `wal-qt`. Unavailable backends (binary not found) are greyed out.
- **Selection mode:**
  - `fixed` — always use the selected backend.
  - `auto` — pick the best available backend per media type, using priority lists you configure.
- **Auto priority lists:** when `auto` is active, set ordered preference lists for images, videos, and web wallpapers independently.
- **Per-backend config:** each backend has its own settings panel (transitions for awww, mpv options for mpvpaper, etc.). See [Backends](/guide/backends).

### Monitors

- **Selected monitors:** choose which connected outputs are active.
- **Image set type:**
  - `individual` — set each monitor's wallpaper independently.
  - `clone` — same image on every monitor.
  - `extend` — span one image across all monitors (auto-sliced by the daemon).

### App behavior

| Setting                     | What it does                                                                         |
| --------------------------- | ------------------------------------------------------------------------------------ |
| Kill daemon on exit         | Stop the daemon when the Electron window closes. Default off (daemon keeps running). |
| Notifications               | Enable/disable desktop notifications.                                                |
| Start minimized             | Hide the window on launch (useful for autostart).                                    |
| Minimize instead of close   | Send to tray on window close button.                                                 |
| Show monitor modal on start | Pop the monitor selector every time the app opens.                                   |
| Images per page             | Gallery pagination size (1–200).                                                     |
| Image history limit         | Max wallpaper history entries before oldest are trimmed.                             |

### Theme & fonts

- **Theme:** choose from the DaisyUI preset list or `system` to follow the OS dark/light setting.
- **Font preset:** bundled Kolision fonts, bundled Google Sans, OS UI stacks, or `custom` where you supply CSS font-family strings.
- **Sort defaults:** set the gallery's default sort field and direction.

### Wallhaven

- **API key:** paste your Wallhaven API key for NSFW content and user collections. Leave blank for anonymous browsing.
- **Scroll mode:** `paginated` (page-by-page) or `infinite` (auto-loads next page as you scroll).

---

## Wallhaven (`/wallhaven`)

<!-- SCREENSHOT PLACEHOLDER: Wallhaven search page with results grid, search bar at top, and filter sidebar -->

Browse and download wallpapers from [wallhaven.cc](https://wallhaven.cc) without leaving the app.

- Search with wallhaven's full query syntax.
- Log in with an API key (set in Settings) to access your user data and NSFW content.
- Click **Save to gallery** on any result to import it into your local library.
- Pagination or infinite scroll depending on your Settings choice.

---

## History (`/history`)

<!-- SCREENSHOT PLACEHOLDER: History page showing a timeline of wallpaper changes, with monitor filter and thumbnails -->

Every wallpaper change is logged here: what was set, on which monitors, by what source (manual, random, playlist name). Filter by monitor or clear the log.

You can re-apply any historical wallpaper by clicking it.

---

## Looper Studio (`/loop-studio`) — beta

<!-- SCREENSHOT PLACEHOLDER: Looper Studio with a video loaded, in/out point sliders, and loop preview playing -->

**Set in/out points on videos** from your library and preview the loop in real-time. Optionally export the trimmed loop to a new file via **ffmpeg** (requires `ffmpeg` on `PATH`).

This is a beta feature—expect rough edges. The exported file can be imported back into the gallery.

---

## Shader Studio (`/shader-studio`) — beta

<!-- SCREENSHOT PLACEHOLDER: Shader Studio with GLSL code editor on left and live WebGL2 preview on right -->

**Import Shadertoy JSON exports** (multipass shaders included) and preview them with a live **WebGL2** renderer. When you are happy with the result, save it as a **web wallpaper** package into the gallery—it shows up as a `web` media type image and can be set via the wal-qt backend.

Steps:

1. Export your shader from shadertoy.com as JSON.
2. Drag the JSON file into Shader Studio (or use the import button).
3. Tweak uniforms or code in the editor—preview updates live.
4. Click **Save to gallery** to package and import.

---

## Tray

Where the desktop environment supports a system tray, Waypaper Engine places a tray icon. Right-click it for quick actions: show/hide window, set random wallpaper, pause/resume playlist, quit.

---

## Keyboard shortcuts

<!-- SCREENSHOT PLACEHOLDER OR TABLE: Keyboard shortcuts reference overlay (press ? in app) -->

| Action                  | Shortcut |
| ----------------------- | -------- |
| Open gallery            | `G`      |
| Open settings           | `S`      |
| Set random wallpaper    | `R`      |
| Next playlist image     | `→`      |
| Previous playlist image | `←`      |

> **NOTE** — Shortcuts are subject to change. Check the in-app help for the current list.
