# Glossary

| Term | Meaning |
| ---- | ------- |
| waypaper-engine | The desktop app (Electron and React). |
| daemon (`waypaper-daemon`) | The Go process behind the app: gallery, playlists, backends, API. The same binary is the [CLI](/reference/cli). |
| backend (setter) | The external program that paints the wallpaper: `awww`, `feh`, `hyprpaper`, `mpvpaper`, `swaybg` or `wal-qt`. Not bundled. See [Backends](/manual/backends). |
| active backend | The one in use (`backend.type`). |
| selection mode | `fixed` uses the active backend; `auto` picks one per media kind. See [config.toml](/reference/config#backend). |
| awww / swww | `awww` is the Wayland wallpaper daemon formerly called `swww`. v3 looks for `awww` only. |
| wal-qt / wal-qt-host | The Qt WebEngine wallpaper host for Wayland. `wal-qt` is the user command; the daemon spawns `wal-qt-host` from `PATH`. |
| web wallpaper | An HTML folder rendered as a live wallpaper (media type `web`); wal-qt only. See [HTML wallpapers](/manual/html-wallpapers). |
| media type | Kind of gallery entry: image, gif, video or web. Backends support different kinds. |
| monitor / output | A display as the compositor names it, e.g. `DP-1`. See [Displays](/manual/displays). |
| image set type | How a wallpaper spreads over monitors: `individual`, `clone` or `extend` (one image sliced across all; stills only). |
| gallery | Your library of images, videos and web wallpapers. See [Gallery](/manual/gallery). |
| playlist | Gallery items that change the wallpaper on a timer or schedule. See [Playlists](/manual/playlists). |
| history | Wallpapers applied, per monitor. |
| parallax | Pan-and-zoom that follows workspace switches; wal-qt only. See [Parallax](/manual/parallax). |
| user theme | A `.css` palette in `~/.config/waypaper-engine/themes/`. See [Themes](/manual/themes). |
| SSE | Server-Sent Events: the `GET /events` stream. See [Events](/reference/events). |
| Unix socket | `$XDG_RUNTIME_DIR/waypaper-engine.sock`; the API lives here, not on TCP. See [HTTP API](/reference/api). |
| CloverDB | The embedded database for images, playlists, folders and history. |
| XDG directories | Standard config, data, cache and runtime locations (`XDG_CONFIG_HOME` and friends). |

"Backend" always means a wallpaper setter, not the Go server.
