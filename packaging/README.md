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
| Install | `make install DESTDIR=<staging> PREFIX=/usr` | Installs everything to the staging root |
| Clean | `make clean` | Removes all build artifacts |

The `DESTDIR` variable stages files under a temporary root (standard for packaging).
The `PREFIX` variable controls the system prefix (default `/usr`).

### What `make install` places

```
/opt/waypaper-engine/          Electron app (unpacked)
/usr/bin/waypaper-engine       Launcher script
/usr/bin/waypaper-daemon       Go daemon binary
/usr/share/applications/       Desktop entry
/usr/share/icons/hicolor/      App icons (16-512px)
/usr/lib/systemd/user/         Systemd user service
/usr/share/licenses/...        License file
```

### Additional targets

- `make appimage` -- builds a portable AppImage instead of a directory package
- `make install-daemon` -- installs only the daemon binary
- `make uninstall` -- removes all installed files
- `make dist` -- creates a source tarball from the git tree
- `make help` -- prints all available targets

## Adding a New Format

1. Create a subdirectory here (e.g., `packaging/flatpak/`)
2. Write the format's metadata file (spec, snapcraft.yaml, etc.)
3. Use `make deps`, `make electron`, and `make install DESTDIR=...` in the build/install steps
4. List runtime dependencies: `electron`, `hicolor-icon-theme`
5. List optional dependencies: `swww`, `hyprpaper`, `feh`, `wlr-randr`
6. List build dependencies: `go`, `npm`, `nodejs`, `git`

## Existing Formats

| Format | Directory | Status |
|--------|-----------|--------|
| Arch Linux (AUR) | Root `PKGBUILD` (reference; real one in separate AUR repo) | Active |
| Snap | `packaging/snap/` | Template |
| RPM (Fedora/openSUSE) | `packaging/rpm/` | Template |
