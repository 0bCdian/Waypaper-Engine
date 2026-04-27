# First 10 minutes

You already have **Waypaper Engine installed** and at least one **wallpaper backend** (e.g. `awww` on Wayland) on your `PATH`. If not, do [Install & run](./install) and [Backends & dependencies](./backends) first.

This is the happy path: open the app, point the daemon at a backend, add one wallpaper, and apply it. Everything else links out so we do not duplicate long sections.

---

## 1. Start the app

Simply launch **Waypaper Engine** from your app launcher, or run `waypaper-engine` in a terminal (see [Install & run — From source / paths](./install#from-source) if you use `make install` to `~/.local/bin`).

On first open, the **daemon** is started for you if it is not already running. The UI talks to it over a Unix socket; you do not need to run `waypaper-daemon` by hand for normal desktop use.

> **Be advised** — the GUI binary is `waypaper-engine`; the headless process is `waypaper-daemon`. See [Glossary](./glossary) if the split is confusing.

---

## 2. Pick a backend (Settings)

Open **Settings** (route `#/settings` — the app uses a [hash router](/guide/app#settings-settings)).

1. In **Backend**, choose a **type** your system actually has installed (`awww`, `hyprpaper`, `feh`, `mpvpaper`, or `wayland-utauri`). Unavailable options are disabled when the binary is missing from `PATH`.
2. If you are unsure, start with **fixed** mode and a single backend you know works. **Auto** mode picks per media type using priority lists (see [The app (UI) — Backend](/guide/app#backend)).
3. Adjust **Monitors** if you have multiple outputs (individual, clone, or extend—described in the same page).

Details: [The app (UI)](/guide/app) · [Backends & dependencies](/guide/backends) · TOML keys: [Configuration](/guide/config).

---

## 3. Add something to the gallery

The **Gallery** is the home route (`#/`). Import a file you already have:

- Drag an **image** or **folder** onto the window, **or**
- Use the **import** control in the toolbar to browse the filesystem.

Import runs through the daemon; progress shows in the UI and is also reflected in SSE (see [Events & SSE](/api/sse) if you care for scripting).

**Success check:** you see a thumbnail in the grid.

---

## 4. Set it as the wallpaper

On the same gallery view:

- **Double-click** the image to apply it (see [The app (UI) — Gallery](/guide/app#gallery-home), *Setting a wallpaper*).

**Success check:** your desktop background updates for the active monitor configuration. If nothing happens, see [FAQ & troubleshooting](./faq) (stale socket, backend unavailable, or missing `wlr-randr` on Wayland).

---

## 5. (Optional) Prove the daemon is there

If you like terminals:

```bash
curl --unix-socket "${XDG_RUNTIME_DIR}/waypaper-engine.sock" http://localhost/healthz
```

You should get JSON with `"status": "ok"`. The default socket path and overrides are in [Daemon & paths](./daemon) and [Configuration](./config). When `XDG_RUNTIME_DIR` is unset, the Go daemon still resolves paths under a temp subdir (see `daemon/internal/system/paths.go` in the repo if you are debugging that case).

---

## Day two

| Want to… | Read |
|----------|------|
| Playlists, timers, scheduling | [The app (UI)](/guide/app) (gallery: selection checkboxes, playlist flow); types are `timer`, `manual`, `time_of_day`, `day_of_week` in the API/types |
| Pull from Wallhaven | [The app (UI) — Wallhaven](/guide/app#wallhaven-wallhaven) |
| Automate or script | [API overview](/api/overview) · [Events & SSE](/api/sse) · `waypaper-daemon` subcommands in [Install & run — Daemon only](/guide/install#daemon-only-headless-autostart) |
| Tune TOML or data paths | [Configuration](/guide/config) · [Daemon & paths](./daemon) |

If anything in this page disagrees with the code, the code wins—open an issue and we will fix the doc.

---

*Questions or rough edges? I want this path to match what you actually see on your machine—especially on non-Arch distros.*
