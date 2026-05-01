# Packaging Waypaper Engine

This directory contains packaging templates for various Linux distributions.
The root `Makefile` is the single source of truth for building and installing --
packaging scripts should delegate to it rather than reimplementing install logic.

## Makefile Contract

Every packaging format should use these targets:

| Step         | Command                                                            | What it does                                                                                           |
| ------------ | ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------ |
| Dependencies | `make deps`                                                        | Runs `npm ci` to install Node.js dependencies                                                          |
| Build        | `make electron`                                                    | Builds daemon, frontend, and packages the Electron app                                                 |
| Install      | `make install-system DESTDIR=<staging> INSTALL_PREFIX_SYSTEM=/usr` | Stages FHS layout (use `/usr` on Arch/Fedora-style prefixes; default without override is `/usr/local`) |
| Clean        | `make clean`                                                       | Removes all build artifacts                                                                            |

The `DESTDIR` variable stages files under a temporary root (standard for packaging).
The default `make install` target is user-local (`~/.local`). Packaging should use
`make install-system` to stage system-style paths.

**`DESTDIR` vs runtime paths:** files are copied under `$(DESTDIR)` + the normal install prefix (e.g. `$(DESTDIR)/opt/waypaper-engine`). The `waypaper-engine` launcher is generated so **`GUI_BIN` uses `ELECTRON_APP_ROOT` only** (for `install-system`, `/opt/waypaper-engine/...`) — never the staging path inside `DESTDIR`. The AppImage wrapper uses **`APPIMAGE_APP_ROOT`** the same way. If your distro puts the unpacked Electron tree somewhere other than `/opt/waypaper-engine`, override **`ELECTRON_APP_ROOT`** when invoking `make install` / `install-system` so the launcher matches.

### What `make install-system` places

With the default **`INSTALL_PREFIX_SYSTEM=/usr/local`** (omit on the command line to use this):

```
/opt/waypaper-engine/              Electron app (unpacked)
/usr/local/bin/waypaper-engine     Launcher script (generated from waypaper-engine.sh.in)
/usr/local/bin/waypaper-daemon     Go daemon binary
/usr/local/share/applications/     Desktop entry
/usr/local/share/pixmaps/          App icon (`waypaper-engine.png`; override `ICON_DIR` for hicolor paths)
/usr/local/lib/systemd/user/       Systemd user service
```

On **Arch** and most distro packages, pass **`INSTALL_PREFIX_SYSTEM=/usr`** so the same layout uses `/usr/bin`, `/usr/share`, `/usr/lib/systemd/user`, etc. Example `package()` body:

```bash
make install-system DESTDIR="$pkgdir" INSTALL_PREFIX_SYSTEM=/usr
```

Optional hicolor icon (desktop `Icon=waypaper-engine`):

```bash
make install-system DESTDIR="$pkgdir" INSTALL_PREFIX_SYSTEM=/usr \
  ICON_DIR="$pkgdir/usr/share/icons/hicolor/512x512/apps"
```

(License files or extra icon sizes, if required by policy, are not installed by the stock `Makefile` — add them in the package recipe, e.g. `install -Dm644 LICENSE …`.)

### Additional targets

- `make appimage` -- builds a portable AppImage instead of a directory package
- `make install-daemon` -- installs only the daemon binary
- `make uninstall` -- removes all installed files
- `make help` -- prints all available targets

## Adding a New Format

1. Create a subdirectory here (e.g., `packaging/flatpak/`)
2. Write the format's metadata file (spec, snapcraft.yaml, etc.)
3. Use `make deps`, `make electron`, and `make install-system DESTDIR=...` in the build/install steps
4. List runtime dependencies: `electron`, `hicolor-icon-theme`
5. List runtime dependencies for your target path: first-party Wayland path should include `wayland-utauri`; optional backends remain `awww`, `hyprpaper`, `feh`, plus monitor tooling like `wlr-randr`
6. List build dependencies: `go`, `npm`, `nodejs`, `git`

## Existing Formats

| Format                                  | Directory                                                                 | Status                                                        |
| --------------------------------------- | ------------------------------------------------------------------------- | ------------------------------------------------------------- |
| Arch Linux — `waypaper-engine` / `-git` | [waypaper_packages_aur](https://github.com/0bCdian/waypaper_packages_aur) | Active (`make install-system` + `INSTALL_PREFIX_SYSTEM=/usr`) |
| Arch Linux — `wayland-utauri` / `-git`  | Same AUR meta-repo                                                        | Active (first-party Wayland host for HTML wallpapers)         |
| Snap                                    | `packaging/snap/`                                                         | Template                                                      |
| RPM (Fedora/openSUSE)                   | `packaging/rpm/`                                                          | Template                                                      |
