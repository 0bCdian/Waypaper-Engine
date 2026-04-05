# Packaging Waypaper Engine

This directory contains packaging templates for various Linux distributions.
The root `Makefile` is the single source of truth for building and installing --
packaging scripts should delegate to it rather than reimplementing install logic.

## Makefile Contract

Every packaging format should use these targets:

| Step | Command | What it does |
|------|---------|-------------|
| Dependencies | `make deps` | Runs `npm ci` to install Node.js dependencies |
| Build | `make electron` | Builds daemon, frontend, and packages the Electron app |
| Install | `make install-system DESTDIR=<staging>` | Installs everything to the staging root with system paths |
| Clean | `make clean` | Removes all build artifacts |

The `DESTDIR` variable stages files under a temporary root (standard for packaging).
The default `make install` target is user-local (`~/.local`). Packaging should use
`make install-system` to stage system-style paths.

**`DESTDIR` vs runtime paths:** files are copied under `$(DESTDIR)` + the normal install prefix (e.g. `$(DESTDIR)/opt/waypaper-engine`). The `waypaper-engine` launcher is generated so **`GUI_BIN` uses `ELECTRON_APP_ROOT` only** (for `install-system`, `/opt/waypaper-engine/...`) — never the staging path inside `DESTDIR`. The AppImage wrapper uses **`APPIMAGE_APP_ROOT`** the same way. If your distro puts the unpacked Electron tree somewhere other than `/opt/waypaper-engine`, override **`ELECTRON_APP_ROOT`** when invoking `make install` / `install-system` so the launcher matches.

### What `make install-system` places

```
/opt/waypaper-engine/              Electron app (unpacked)
/usr/local/bin/waypaper-engine     Launcher script (generated from waypaper-engine.sh.in)
/usr/local/bin/waypaper-daemon     Go daemon binary
/usr/local/share/applications/     Desktop entry
/usr/local/share/pixmaps/          App icon (`waypaper-engine.png`; override `ICON_DIR` for hicolor paths)
/usr/local/lib/systemd/user/      Systemd user service
```

(License files or extra icon sizes, if added by a specific package recipe, are not created by the stock `Makefile`.)

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

| Format | Directory | Status |
|--------|-----------|--------|
| Arch Linux (AUR) | Root `PKGBUILD` (reference; real one in separate AUR repo) | Active |
| Snap | `packaging/snap/` | Template |
| RPM (Fedora/openSUSE) | `packaging/rpm/` | Template |
