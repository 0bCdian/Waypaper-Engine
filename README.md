<div align="center">
  <img src="./readme_files/Waypaper_Engine.png" width="500px" alt="banner"/>

![GitHub last commit (branch)](https://img.shields.io/github/last-commit/0bCdian/Waypaper-Engine/main?style=for-the-badge&logo=git&color=%2389B482)
![AUR last modified](https://img.shields.io/aur/last-modified/waypaper-engine?style=for-the-badge&logo=arch-linux&color=%23438287)
![GitHub Repo stars](https://img.shields.io/github/stars/0bCdian/Waypaper-Engine?style=for-the-badge&logo=github&color=%232AAEA3)
![Badge Language](https://img.shields.io/github/languages/top/0bCdian/Waypaper-Engine?style=for-the-badge&logo=typescript)
![Badge License](https://img.shields.io/github/license/0bCdian/Waypaper-Engine?style=for-the-badge&logo=gnu)

### _A wallpaper setter gui, developed with ricing in mind!_ 🍚

**[<kbd> <br> Overview <br>  </kbd>](#overview)**
**[<kbd> <br> How to install <br> </kbd>](#install)**
**[<kbd> <br> Usage <br> </kbd>](#usage)**
**[<kbd> <br> TODO <br> </kbd>](#todo)**
**[<kbd> <br> Gallery <br> </kbd>](#gallery)**
**[<kbd> <br> Special Thanks <br> </kbd>](#special-thanks)**

</div>

> [!IMPORTANT]
> **Project Status:** Waypaper Engine is under active development and in a major rewrite cycle. Release-ready work currently happens on `main` and `refactor/wayaper-daemon` until the rewrite fully lands in `main`. Expect rapid iteration and occasional breaking changes before stable tags.

**Operations docs:** [Install](docs/INSTALL.md) · [Production readiness](docs/PRODUCTION_READINESS.md) · [Critical user journeys](docs/CRITICAL_USER_JOURNEYS.md) · [Architecture](docs/ARCHITECTURE.md)

# Overview

**Waypaper Engine** is a Linux wallpaper manager (**Wayland and X11**) with a gallery, playlists, imports (including [Wallhaven](https://wallhaven.cc/)), and per-monitor history. A **Go daemon** stores your library and drives pluggable backends; the **Electron** UI is the control center. Use classic tools like [awww](https://github.com/LGFae/awww), [hyprpaper](https://github.com/hyprwm/hyprpaper), or [feh](https://feh.finalrewind.org/), or pair with **[wayland-utauri](https://github.com/0bCdian/wayland-utauri)** for local HTML and video wallpapers on Wayland.

# What's New (v2 Rewrite)

The v2 line replaces the old Node.js backend with a Go daemon and a rebuilt frontend. Highlights:

### Architecture
-   **Go daemon backend** — A standalone Go service that handles all wallpaper, playlist, image, and monitor operations over a Unix socket HTTP API. Replaces the old Node.js/SQLite backend entirely.
-   **Pluggable wallpaper backends** — Support for [awww](https://github.com/LGFae/awww), [hyprpaper](https://github.com/hyprwm/hyprpaper), [feh](https://feh.finalrewind.org/), and first-party Wayland integration via `wayland-utauri`, with a registry that allows runtime switching.
-   **CloverDB storage** — Lightweight embedded database replacing SQLite, managed entirely by the daemon.
-   **Server-Sent Events (SSE)** — Real-time event streaming from daemon to frontend for image processing progress, wallpaper changes, playlist updates, and config changes.
-   **Cobra CLI** — Full CLI (`start`, `stop`, `status`, `set`, `random`, `next`, `previous`, image/playlist/monitor/backend/config management) that talks to the running daemon over the socket.

**HTML wallpapers (wayland-utauri):** Outbound network starts **denied** until **`allow_network_wallpapers`** is on **and** the wallpaper manifest sets **`capabilities.network`**; other manifest capabilities are honored as stored. The daemon syncs the global network flag to **wayland-utauri**. See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md#14-security-daemon-socket--html-wallpapers) and the [Web wallpaper spec](https://github.com/0bCdian/wayland-utauri/blob/main/docs/WEB_WALLPAPER_SPEC.md).

### Features
-   **Image renaming** — Rename images from the gallery (inline or detail sidebar), with automatic deduplication and physical file rename on disk. Playlists are unaffected since they reference images by stable IDs.
-   **Wallhaven integration** — Search, browse, and download wallpapers from [Wallhaven](https://wallhaven.cc/) directly into your gallery.
-   **URL/drag-and-drop import** — Drop image URLs or files onto the window to import them. HTTP(S) URLs are downloaded automatically.
-   **Image detail sidebar** — View metadata, edit tags with autocomplete, and rename images from a slide-over panel.
-   **Context menus** — Right-click context menus throughout the gallery with wallpaper setting, playlist management, selection, rename, delete, and file manager integration.
-   **Multi-resolution thumbnails** — Automatic thumbnail generation at multiple resolutions (720p, 1080p, 1440p, 4K) for fast gallery rendering.
-   **Monitor auto-detection** — On Wayland: wayland-utauri control API when available, otherwise `wlr-randr`. On X11: `xrandr`. Manual override supported.
-   **Wallpaper history** — Per-monitor history log with forward/back navigation.

### UI
-   **Neobrutalist design mode** — Optional design mode with configurable shadow offsets, border widths, corner radius, and polaroid-style image cards. Toggleable alongside the standard DaisyUI look.
-   **Expanded theme library** — 30+ themes including Gruvbox, Catppuccin, Tokyo Night, Nord, Dracula, Rosé Pine, Everforest, and more, on top of all DaisyUI built-in themes.
-   **Modernized layout** — Drawer-based navigation with sidebar, image processing progress overlay, toast notifications, and confirm dialogs.

# Legacy Features

These features carry over from the original version:

-   Multi monitor support.
-   Four different types of playlists (Time of day, daily, interval based or static).
-   Tray controls.
-   Filter images by format, resolution, name, etc.

---

![image](https://github.com/0bCdian/Waypaper-Engine/assets/101421807/40318ad6-aa5a-42c2-98c8-63d988069407)

https://github.com/0bCdian/Waypaper-Engine/assets/101421807/4d49225a-cbdc-42a0-af67-aac823c47f98

---

# Install

Full guide (AppImage, `make install`, Arch/AUR, distro packaging): **[docs/INSTALL.md](docs/INSTALL.md)**.

**Quick start — user-local from source**

```bash
git clone https://github.com/0bCdian/Waypaper-Engine.git
cd Waypaper-Engine
make deps && make electron && make install
```

**Quick start — Arch**

```bash
yay -S waypaper-engine
# or: yay -S waypaper-engine-git
```

**Quick start — portable AppImage** — download `*.AppImage` from [Releases](https://github.com/0bCdian/Waypaper-Engine/releases), `chmod +x`, run. The daemon is bundled inside the AppImage.

Packagers: use `make electron` and `make install-system DESTDIR=…` (see [packaging/README.md](packaging/README.md)).

## Releases and contributing

-   Active branches: **`main`**, **`refactor/wayaper-daemon`**.
-   **Git tags** `v*` drive GitHub Releases; **`package.json`** `version` must match the tag.
-   Published assets: **`*.AppImage`** (bundled daemon), **`waypaper-daemon`**, **`checksums.txt`**.

Maintainer checklist (PR bump, tag push, artifacts): **[docs/INSTALL.md](docs/INSTALL.md#github-releases-and-tags)**.

**Local CI (contributors):**

```bash
npm run ci:check
```

Optional: `pipx install pre-commit && pre-commit install` — hooks match formatting, lint, and `gofmt` (see [.pre-commit-config.yaml](.pre-commit-config.yaml)).

# Usage

Open the app, add wallpapers to the gallery, and **double-click** to set them (or **right-click** for more actions). Use the checkboxes that appear on hover to build **playlists**, configure them in the sidebar, and save—playlists can follow time-of-day, daily, interval, or static rules.

# Examples

### Autostart on hyprland just the daemon

Add to your hyprland.conf the following lines:

```bash
exec-once=waypaper-engine daemon
```

### Add scripts to run on each image set

> [!WARNING]
> Make sure the script in question has execution permissions by using `chmod +x scriptname.sh`
> Put you bash scripts in this path:

```bash
$HOME/.waypaper_engine/scripts
```

The scripts are always passsed as an argument the path of the image being set, so you can do stuff like this:

![carbon](https://github.com/0bCdian/Waypaper-Engine/assets/101421807/c594babf-198a-47a0-8dce-5fd8d64b862c)

https://github.com/0bCdian/Waypaper-Engine/assets/101421807/f454a904-7fa7-4ce9-86e9-f8fbc86e8c2b

# TODO

-   [x] Add testing.
-   [x] Have a ci/cd pipeline.
-   [x] Implement a logger for errors.
-   [x] Publish in the aur.
-   [x] Find a good icon/logo for the app (Thank you [Cristian Avendaño](https://github.com/c-avendano)!).
-   [ ] Add flatpak support.
-   [x] Add scripts feature.
-   [x] Add playlists per monitor.

_If you encounter any problems or would like to make a suggestion, please feel free to open an issue_.

# Gallery

![image](https://github.com/0bCdian/Waypaper-Engine/assets/101421807/d78b9373-daf8-401a-8e85-cd1e286b31ce)
![image](https://github.com/0bCdian/Waypaper-Engine/assets/101421807/aceae307-7a2a-430e-a357-c710bb660eb7)
![image](https://github.com/0bCdian/Waypaper-Engine/assets/101421807/c78b7fc9-48a6-4ffa-b07f-a58f73ca91b6)
![image](https://github.com/0bCdian/Waypaper-Engine/assets/101421807/cb6afa04-b577-46a6-ba53-70fdf304c1b6)
![image](https://github.com/0bCdian/Waypaper-Engine/assets/101421807/51e2e981-8916-475e-92cd-b33e4a9bbaa5)
![image](https://github.com/0bCdian/Waypaper-Engine/assets/101421807/495d6702-7ce9-4d5b-9870-5cf0d2aa56bb)
![image](https://github.com/0bCdian/Waypaper-Engine/assets/101421807/ba5993ff-ea36-4594-bc77-671c082f09c2)

# Special Thanks

**[LGFae](https://github.com/LGFae)** - _for the amazing little tool that awww is !_ ❤️

**[Simon Ser](https://git.sr.ht/~emersion/)** - _for wlr-randr, without it making this work across different wayland wm's would've been a nightmare_ 🥲

**[Cristian Avendaño](https://github.com/c-avendano)** - _for creating the amazing logo!_ 💪
