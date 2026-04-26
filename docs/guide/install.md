# Install & run

Pick the method that fits your setup. The **AUR** is the easiest on Arch. The **AppImage** works on any distro. **From source** gives you the latest commit.

**Be advised** — whatever backend you want (e.g. `awww`, `hyprpaper`, `feh`, `mpvpaper`, `wayland-utauri`) must be installed separately and on `PATH`. The daemon will tell you if the active backend is unavailable. See [Backends & dependencies](/guide/backends).

---

## Arch Linux (AUR)

Simply install with your AUR helper:

```bash
# Stable release
yay -S waypaper-engine

# Tracking git (latest commit)
yay -S waypaper-engine-git
```

> **Be advised** — `waypaper-engine` and `waypaper-engine-git` conflict. If you have one and want the other, **remove the current one first**:
> ```bash
> yay -R waypaper-engine
> yay -S waypaper-engine-git
> ```

The AUR packages install the daemon binary, the Electron app, a `.desktop` file, and a systemd user service. After install, continue to [First run](#first-run).

---

## AppImage (any distro)

1. Grab the latest `*.AppImage` from the [Releases page](https://github.com/0bCdian/Waypaper-Engine/releases).
2. Make it executable:
   ```bash
   chmod +x waypaper-engine-*.AppImage
   ```
3. Run it:
   ```bash
   ./waypaper-engine-*.AppImage
   ```

The AppImage bundles the daemon and Electron—no system install needed. Move it somewhere on your `PATH` if you want to launch it as `waypaper-engine`.

> **NOTE** — You still need backend binaries (e.g. `awww`) on your system PATH. The AppImage does not bundle those.

---

## From source

**Requirements:** [mise](https://mise.jdx.dev/) (or match manually: Node 22, Go 1.26, Python 3.12). See [.mise.toml](https://github.com/0bCdian/Waypaper-Engine/blob/main/.mise.toml) for the pinned versions.

### User-local install (`~/.local`)

This is the default — no sudo required:

```bash
# 1. Clone
git clone https://github.com/0bCdian/Waypaper-Engine.git
cd Waypaper-Engine

# 2. Pin tool versions (skip if you aligned Node/Go manually)
mise install

# 3. Install JS dependencies
make deps

# 4. Build Electron app (Vite + electron-builder, unpacked)
make electron

# 5. Build the daemon binary
make daemon

# 6. Install to ~/.local (bin, opt, applications, pixmaps, systemd user service)
make install
```

Binaries land at `~/.local/bin/waypaper-engine` and `~/.local/bin/waypaper-daemon`. Make sure `~/.local/bin` is on your `PATH`.

### System-wide install (`/usr/local`, needs sudo)

```bash
sudo make install-system
```

This installs to `/usr/local/bin`, `/usr/local/opt`, `/usr/local/share/applications`, and `/usr/local/lib/systemd/user`.

### AppImage from source

```bash
make deps && make electron   # builds waypaper-engine-*.AppImage under dist/
make install-appimage        # installs it to ~/.local/opt/waypaper-engine-appimage
```

### Custom prefix

```bash
make install PREFIX=/opt/my-prefix DESTDIR=/tmp/stage
```

`DESTDIR` stages the tree without baking the path into launchers—correct for distro packaging. See [Packaging](./packaging) for the full `DESTDIR` + `ELECTRON_APP_ROOT` story.

---

## Daemon only (headless / autostart)

If you only want the daemon (no GUI), build and install just that:

```bash
make daemon && make install-daemon
```

Then launch it from your compositor's autostart:

```bash
# Hyprland (hyprland.conf)
exec-once = waypaper-daemon start

# sway (config)
exec waypaper-daemon start
```

Or enable the systemd user service (installed with `make install` or the AUR package):

```bash
systemctl --user enable --now waypaper-daemon.service
```

You can still drive everything from the HTTP API or the CLI—see [API overview](/api/overview).

---

## First run

Simply launch **Waypaper Engine** from your app launcher, or run `waypaper-engine` from a terminal.

1. On first launch the daemon starts automatically if it is not already running.
2. Open **Settings** and pick a backend (e.g. `awww`).
3. Import wallpapers: drag-drop files or folders, or click the import button.
4. **Double-click** an image to set it. **Right-click** for the full context menu. Hover to reveal the select checkbox for playlist building.

And you're done.

---

## Updating

- **AUR:** `yay -Syu waypaper-engine` (or `-git` variant).
- **AppImage:** download the new release and replace the old file.
- **From source:** `git pull`, then repeat the build steps (`make electron && make daemon && make install`).

---

## Troubleshooting startup

**App won't start after a crash:**

The daemon uses a Unix socket at `$XDG_RUNTIME_DIR/waypaper-engine.sock` and a PID lock at `$XDG_RUNTIME_DIR/waypaper-engine.pid`. A stale socket from a previous crash blocks startup.

```bash
rm -f "${XDG_RUNTIME_DIR}/waypaper-engine.sock"
rm -f "${XDG_RUNTIME_DIR}/waypaper-engine.pid"
```

Then relaunch.

**Backend not working:**

```bash
# Check daemon health
curl --unix-socket "${XDG_RUNTIME_DIR}/waypaper-engine.sock" http://localhost/healthz

# List backends and their availability
curl --unix-socket "${XDG_RUNTIME_DIR}/waypaper-engine.sock" http://localhost/backends
```

An `"available": false` backend means the binary is not on `PATH` or not installed. See [Backends & dependencies](/guide/backends).

**Daemon log:**

```bash
tail -f ~/.local/share/waypaper-engine/daemon.log
```
