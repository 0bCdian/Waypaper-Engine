# Installing Waypaper Engine

Waypaper Engine v2 ships a Go daemon (`waypaper-daemon`), an Electron GUI, and optional portable/AppImage builds. Pick one path below.

**Prerequisites (build from source):** `git`, Go **1.26+**, Node **22+**, `npm`.

---

## 1. AppImage (prebuilt, portable)

Best when you want a single file and no system install.

1. Open [GitHub Releases](https://github.com/0bCdian/Waypaper-Engine/releases) and download the latest `*.AppImage`.
2. Mark it executable and run it:

   ```bash
   chmod +x waypaper-engine.AppImage
   ./waypaper-engine.AppImage
   ```

The AppImage bundles `waypaper-daemon`; you do not need a separate daemon install for GUI use.

**Optional — install into your profile after you built locally:** from a clone, `make appimage` then `make install-appimage` (see the [Makefile](../Makefile) `install-appimage` target).

---

## 2. Manual install (`make install`)

Best for development or a user-local install under `~/.local`.

```bash
git clone https://github.com/0bCdian/Waypaper-Engine.git
cd Waypaper-Engine
make deps
make electron
make install
```

- **Build:** `make electron` builds the daemon, the Vite frontend, and the unpacked Electron app.
- **Install:** `make install` places the GUI under `~/.local/opt/waypaper-engine`, `waypaper-daemon` and the `waypaper-engine` launcher under `~/.local/bin`, plus desktop entry, icon, and systemd user unit.

The launcher is generated from [`waypaper-engine.sh.in`](../waypaper-engine.sh.in); it embeds **`ELECTRON_APP_ROOT`** (default `$(PREFIX)/opt/waypaper-engine`) and does **not** bake `DESTDIR` into paths, so distro packaging can stage with `DESTDIR` safely.

**System-wide on your machine:** `sudo make install-system` (default prefix `/usr/local`; see [Makefile](../Makefile)).

**Uninstall:** `make uninstall` or `sudo make uninstall-system`.

Run `make help` for all targets.

---

## 3. Arch Linux and other packagers (FHS layout)

### Arch (AUR)

```bash
yay -S waypaper-engine
# or tracking latest main:
yay -S waypaper-engine-git
```

`waypaper-engine` and `waypaper-engine-git` conflict; remove one before installing the other.

Packaging lives in a separate [AUR packaging repo](https://github.com/0bCdian/waypaper_packages_aur) (or your maintainer fork). Builds should follow the Makefile contract below, not hand-rolled copies of install paths.

### Makefile contract for distros

Use the top-level [Makefile](../Makefile) as the single source of truth:

| Step | Command |
|------|---------|
| Dependencies | `make deps` |
| Build | `make electron` |
| Stage install | `make install-system DESTDIR="$pkgdir" INSTALL_PREFIX_SYSTEM=/usr` |

For Arch, **`INSTALL_PREFIX_SYSTEM=/usr`** installs binaries and metadata under `/usr` while the GUI tree stays under **`/opt/waypaper-engine`** (set by the `install-system` target). Command-line variables override the Makefile default `/usr/local`.

Optional: override **`ICON_DIR`** if your distro requires icons under `hicolor` instead of `pixmaps` (see [packaging/README.md](../packaging/README.md)).

**Runtime dependencies** depend on which wallpaper backends you use:

- **Default / common:** `awww` (e.g. AUR `awww-bin`), `hicolor-icon-theme`.
- **Optional:** `wayland-utauri` (first-party Wayland HTML/web host), `hyprpaper`, `feh`, `wlr-randr` (monitor detection fallback on Wayland), etc.

---

## GitHub releases and tags

Releases are driven by tags `v*`. **`package.json`** `version` must match the tag (e.g. tag `v3.0.0` → version `3.0.0`).

Pushing a tag runs CI checks and publishes, per release workflow:

- `*.AppImage` (daemon bundled inside)
- `waypaper-daemon` standalone binary
- `checksums.txt`

See [README.md](../README.md#cicd-and-releases) for the maintainer checklist (branch protection, bump version PR, tag push).
